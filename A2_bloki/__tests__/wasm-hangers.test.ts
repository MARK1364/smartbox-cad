/**
 * A2_bloki/__tests__/wasm-hangers.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla zawieszek (hangers).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_hangers_plan_wasm } from '../../src/wasm/hangers/wasm_hangers.js';

describe('WASM Hangers Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/hangers/wasm_hangers_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates hanger placement in WASM', () => {
    const dims = {
      width_mm: 600,
      height_mm: 720,
      depth_mm: 320
    };

    const params = {
      szablon_id: 'zawieszka_camaro',
      zestaw_id: 'zestaw_camaro',
      odsuniecie_bok_mm: 10,
      odsuniecie_tyl_mm: 5,
      odsuniecie_gora_mm: 15,
      parts: [
        {
          id: 'lewa',
          name: 'Zawieszka Lewa',
          width_mm: 20,
          height_mm: 40,
          depth_mm: 70,
          ref_x: 'LEFT',
          ref_y: 'BACK',
          ref_z: 'TOP',
          offset_x_mm: 0,
          offset_y_mm: 0,
          offset_z_mm: 0,
          frozen: false
        },
        {
          id: 'prawa',
          name: 'Zawieszka Prawa',
          width_mm: 20,
          height_mm: 40,
          depth_mm: 70,
          ref_x: 'RIGHT',
          ref_y: 'BACK',
          ref_z: 'TOP',
          offset_x_mm: 0,
          offset_y_mm: 0,
          offset_z_mm: 0,
          frozen: false
        }
      ]
    };

    const res: any = calculate_hangers_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.hardware).toHaveLength(2);

    const lewa = res.hardware.find((h: any) => h.part_id === 'lewa');
    const prawa = res.hardware.find((h: any) => h.part_id === 'prawa');
    expect(lewa).toBeDefined();
    expect(prawa).toBeDefined();

    // lewa: ref_x: LEFT -> off_x = 0 + 10 = 10 -> bay_x = 10 -> loc_x = 10 - 300 = -290
    expect(lewa.loc.x).toBe(-290);
    // prawa: ref_x: RIGHT -> off_x = 10 -> bay_x = 600 - 10 = 590 -> loc_x = 590 - 300 = 290
    expect(prawa.loc.x).toBe(290);

    // Z góra: H - 15 = 705
    expect(lewa.loc.z).toBe(705);
    expect(prawa.loc.z).toBe(705);
  });
});

