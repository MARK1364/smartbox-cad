/**
 * A2_bloki/__tests__/wasm-doors.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla drzwi.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_doors_plan_wasm } from '../../src/wasm/doors/wasm_doors.js';

describe('WASM Doors Engine (Rust binary)', () => {
  beforeAll(async () => {
    // W środowisku Node.js/Vitest przekazujemy zbuforowany plik .wasm bez konieczności używania browserowego fetch
    const wasmPath = path.resolve(__dirname, '../../src/wasm/doors/wasm_doors_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates single left door with Blum hinges in WASM', () => {
    const dims = {
      width_mm: 600,
      height_mm: 720,
      depth_mm: 560
    };

    const params = {
      rodzaj_drzwi: 'LEFT',
      grubosc_frontu_mm: 18,
      szczelina_mm: 4,
      nalozenie_gora_mm: 14,
      nalozenie_dol_mm: 15,
      nalozenie_lewe_mm: 16,
      nalozenie_prawe_mm: 16,
      domyslny_zawias_id: 'BLUM_71B3550',
      aktywne_zawiasy: [
        { index: 1, pozycja_lokalna_z_mm: 120 },
        { index: 6, pozycja_lokalna_z_mm: 600 }
      ]
    };

    const res: any = calculate_doors_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(1);
    
    // Front o wymiarach 600 + 16 + 16 = 632, wys = 720 + 14 + 15 = 749
    const front = res.parts[0];
    expect(front.id).toBe('Drzwi_Lewe');
    expect(front.role).toBe('FRONT');
    expect(front.width).toBe(632);
    expect(front.height).toBe(749);
    expect(front.depth).toBe(18);

    // Dwa zawiasy aktywne
    expect(res.hardware).toHaveLength(2);
    expect(res.hardware[0].hardware_id).toBe('BLUM_71B3550');

    // Cechy nawierceń: puszka + 2 wkręty na każdy zawias = 6 otworów
    expect(res.features).toHaveLength(6);
    const cupHoles = res.features.filter((f: any) => f.rule === 'cup');
    expect(cupHoles).toHaveLength(2);
    expect(cupHoles[0].diameter).toBe(35);
    expect(cupHoles[0].depth).toBe(13);
    expect(cupHoles[0].u).toBe(21.5);
  });

  it('calculates double doors with equal leaves in WASM', () => {
    const dims = {
      width_mm: 800,
      height_mm: 720,
      depth_mm: 560
    };

    const params = {
      rodzaj_drzwi: 'DOUBLE',
      grubosc_frontu_mm: 18,
      szczelina_mm: 4,
      nalozenie_gora_mm: 14,
      nalozenie_dol_mm: 15,
      nalozenie_lewe_mm: 16,
      nalozenie_prawe_mm: 16,
      domyslny_zawias_id: 'BLUM_71B3550',
      aktywne_zawiasy: [
        { index: 1, pozycja_lokalna_z_mm: 120 },
        { index: 6, pozycja_lokalna_z_mm: 600 }
      ]
    };

    const res: any = calculate_doors_plan_wasm(dims, params);
    expect(res.parts).toHaveLength(2);
    expect(res.parts[0].id).toBe('Drzwi_Lewe');
    expect(res.parts[1].id).toBe('Drzwi_Prawe');

    // Szerokość całkowita 800 + 32 = 832. Dwa skrzydła: (832 - 4) / 2 = 414 mm
    expect(res.parts[0].width).toBe(414);
    expect(res.parts[1].width).toBe(414);

    // 4 zawiasy łącznie (2 na skrzydło)
    expect(res.hardware).toHaveLength(4);
    expect(res.features).toHaveLength(12);
  });
});
