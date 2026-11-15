/**
 * A2_bloki/__tests__/wasm-flaps.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla klap.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_flaps_plan_wasm } from '../../src/wasm/flaps/wasm_flaps.js';

describe('WASM Flaps Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/flaps/wasm_flaps_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates top opening flap with 2 hinges in WASM', () => {
    const dims = {
      width_mm: 800,
      height_mm: 360,
      depth_mm: 320
    };

    const params = {
      kierunek_klapy: 'TOP',
      grubosc_frontu_mm: 18,
      nalozenie_gora_mm: 14,
      nalozenie_dol_mm: 15,
      nalozenie_lewe_mm: 16,
      nalozenie_prawe_mm: 16,
      odsuniecie_zawiasu_lewe_mm: 80,
      odsuniecie_zawiasu_prawe_mm: 80,
      zawias_srodkowy: false,
      szablon_zawiasu_domyslny: 'BLUM_71B3550',
      szablon_zawiasu_lewy: undefined,
      szablon_zawiasu_prawy: undefined,
      szablon_zawiasu_srodkowy: undefined
    };

    const res: any = calculate_flaps_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(1);

    const flap = res.parts[0];
    expect(flap.name).toBe('Klapa');
    // Szerokość: 800 + 16 + 16 = 832, Wysokość: 360 + 14 + 15 = 389
    expect(flap.dim.x).toBe(832);
    expect(flap.dim.z).toBe(389);
    expect(flap.dim.y).toBe(18);

    // 2 zawiasy (lewy i prawy)
    expect(res.hardware).toHaveLength(2);
    // 2 zawiasy * 3 otwory (puszka + 2 wkręty) = 6 otworów
    expect(res.features).toHaveLength(6);
    const cupHoles = res.features.filter((f: any) => f.rule === 'cup');
    expect(cupHoles).toHaveLength(2);
  });
});

