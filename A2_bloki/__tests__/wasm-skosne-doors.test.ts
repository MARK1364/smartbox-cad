/**
 * A2_bloki/__tests__/wasm-skosne-doors.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla drzwi skośnych.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_skosne_doors_plan_wasm } from '../../src/wasm/skosne_doors/wasm_skosne_doors.js';

describe('WASM Skosne Doors Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/skosne_doors/wasm_skosne_doors_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates single left slanted door in WASM', () => {
    const dims = {
      width_mm: 600,
      height_mm: 1800,
      depth_mm: 550
    };

    const params = {
      rodzaj_drzwi: 'LEFT',
      grubosc_frontu_mm: 18,
      szczelina_mm: 4,
      nalozenie_gora_mm: 18,
      nalozenie_dol_mm: 18,
      nalozenie_lewe_mm: 18,
      nalozenie_prawe_mm: 18,
      dach_kat_deg: 25,
      domyslny_zawias_id: 'BLUM_71B3550',
      aktywne_zawiasy: [
        { index: 1, pozycja_lokalna_z_mm: 120 },
        { index: 6, pozycja_lokalna_z_mm: 1500 }
      ],
      aktywne_zawiasy_lewe: [],
      aktywne_zawiasy_prawe: []
    };

    const res: any = calculate_skosne_doors_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(1);
    expect(res.hardware).toHaveLength(2);

    const door = res.parts[0];
    expect(door.name).toBe('Drzwi_Skosne_Lewe');
    expect(door.role).toBe('FRONT');
    expect(door.dim.x).toBe(636); // 600 + 18 + 18
    expect(door.outline2d).toHaveLength(4);
    expect(door.hinge_side).toBe('left');
  });

  it('calculates double slanted doors in WASM', () => {
    const dims = {
      width_mm: 800,
      height_mm: 1800,
      depth_mm: 550
    };

    const params = {
      rodzaj_drzwi: 'DOUBLE',
      grubosc_frontu_mm: 18,
      szczelina_mm: 4,
      nalozenie_gora_mm: 18,
      nalozenie_dol_mm: 18,
      nalozenie_lewe_mm: 18,
      nalozenie_prawe_mm: 18,
      dach_kat_deg: 25,
      domyslny_zawias_id: 'BLUM_71B3550',
      aktywne_zawiasy: [],
      aktywne_zawiasy_lewe: [
        { index: 1, pozycja_lokalna_z_mm: 120 }
      ],
      aktywne_zawiasy_prawe: [
        { index: 1, pozycja_lokalna_z_mm: 120 }
      ]
    };

    const res: any = calculate_skosne_doors_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(2);
    expect(res.hardware).toHaveLength(2);

    const left = res.parts.find((p: any) => p.name === 'Drzwi_Skosne_Lewe');
    const right = res.parts.find((p: any) => p.name === 'Drzwi_Skosne_Prawe');
    expect(left).toBeDefined();
    expect(right).toBeDefined();
  });
});

