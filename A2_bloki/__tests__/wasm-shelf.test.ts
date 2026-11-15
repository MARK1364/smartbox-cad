/**
 * A2_bloki/__tests__/wasm-shelf.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla pojedynczego wieńca (shelf).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_shelf_plan_wasm } from '../../src/wasm/shelf/wasm_shelf.js';

describe('WASM Shelf Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/shelf/wasm_shelf_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates shelf with bottom reference in WASM', () => {
    const dims = {
      width_mm: 600,
      height_mm: 720,
      depth_mm: 500
    };

    const params = {
      grubosc_wienca_mm: 18,
      odsuniecie_przod_mm: 10,
      odsuniecie_tyl_mm: 20,
      luz_boczny_mm: 2,
      baza_odniesienia: 'bottom',
      odstep_gora_mm: 100,
      odstep_dol_mm: 150
    };

    const res: any = calculate_shelf_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(1);

    const shelf = res.parts[0];
    expect(shelf.name).toBe('Wieniec');
    expect(shelf.role).toBe('SHELF_BOARD');
    expect(shelf.node_type).toBe('PART');
    // efektywna szerokość: 600 - 2 * 2 = 596
    expect(shelf.dim.x).toBe(596);
    // efektywna głębokość: 500 - (10 + 20) = 470
    expect(shelf.dim.y).toBe(470);
    expect(shelf.dim.z).toBe(18);
    // srodek_y: (10 - 20) / 2 = -5
    expect(shelf.loc.y).toBe(-5);
    // srodek_z: 150 + 18 / 2 = 159
    expect(shelf.loc.z).toBe(159);
  });

  it('calculates shelf with top reference in WASM', () => {
    const dims = {
      width_mm: 600,
      height_mm: 720,
      depth_mm: 500
    };

    const params = {
      grubosc_wienca_mm: 18,
      odsuniecie_przod_mm: 0,
      odsuniecie_tyl_mm: 0,
      luz_boczny_mm: 0,
      baza_odniesienia: 'top',
      odstep_gora_mm: 200,
      odstep_dol_mm: 100
    };

    const res: any = calculate_shelf_plan_wasm(dims, params);
    expect(res).toBeDefined();
    const shelf = res.parts[0];
    // srodek_z: 720 - 200 - 9 = 511
    expect(shelf.loc.z).toBe(511);
    expect(shelf.dim.x).toBe(600);
    expect(shelf.dim.y).toBe(500);
  });
});

