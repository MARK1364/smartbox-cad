/**
 * A2_bloki/__tests__/wasm-corner-doors.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla drzwi narożnych.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_corner_doors_plan_wasm } from '../../src/wasm/corner_doors/wasm_corner_doors.js';

describe('WASM Corner Doors Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/corner_doors/wasm_corner_doors_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates standard corner doors (L-shape) in WASM', () => {
    const dims = {
      width_mm: 352,
      height_mm: 720,
      depth_mm: 352
    };

    const params = {
      grubosc_frontu_mm: 18,
      szczelina_srodkowa_mm: 8,
      nalozenie_gora_mm: 16,
      nalozenie_dol_mm: 16,
      nalozenie_prawe_mm: 16,
      nalozenie_lewe_mm: 16,
      otwieranie: 'jednostronna',
      szablon_zawiasu_domyslny: 'BLUM_71B3550',
      zawiasy: [
        { index: 1, local_z: 120 },
        { index: 6, local_z: 600 }
      ]
    };

    const res: any = calculate_corner_doors_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(2);
    expect(res.hardware).toHaveLength(4); // 2 hinges * 2 leaves

    const prawe = res.parts.find((p: any) => p.name === 'Drzwi_Prawe');
    const lewe = res.parts.find((p: any) => p.name === 'Drzwi_Lewe');
    expect(prawe).toBeDefined();
    expect(lewe).toBeDefined();

    // Standard L: 352 - 4 + 16 - 18 = 346 mm
    expect(prawe.dim.x).toBe(346);
    expect(lewe.dim.x).toBe(346);

    // Total height: 720 + 16 + 16 = 752 mm
    expect(prawe.dim.z).toBe(752);
    expect(lewe.dim.z).toBe(752);
  });
});

