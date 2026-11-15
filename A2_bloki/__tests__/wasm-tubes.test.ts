/**
 * A2_bloki/__tests__/wasm-tubes.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla drążka (tubes).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_tubes_plan_wasm } from '../../src/wasm/tubes/wasm_tubes.js';

describe('WASM Tubes Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/tubes/wasm_tubes_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates rod without top shelf in WASM', () => {
    const dims = {
      width_mm: 800,
      height_mm: 1200,
      depth_mm: 550
    };

    const params = {
      odstep_gora_mm: 70,
      pokaz_polke: false,
      przestrzen_nad_polka_mm: 100,
      grubosc_polki_mm: 18,
      srednica_drazka_mm: 25
    };

    const res: any = calculate_tubes_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(0);
    expect(res.hardware).toHaveLength(3); // 1 rod + 2 sockets

    const rod = res.hardware.find((h: any) => h.role === 'TUBE_ROD');
    expect(rod).toBeDefined();
    expect(rod.dim.x).toBe(798); // 800 - 2
    expect(rod.dim.y).toBe(25);  // średnica
    expect(rod.loc.z).toBe(1200 - 70); // 1130
  });

  it('calculates rod with top shelf in WASM', () => {
    const dims = {
      width_mm: 800,
      height_mm: 1200,
      depth_mm: 550
    };

    const params = {
      odstep_gora_mm: 70,
      pokaz_polke: true,
      przestrzen_nad_polka_mm: 100,
      grubosc_polki_mm: 18,
      srednica_drazka_mm: 25
    };

    const res: any = calculate_tubes_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(1);
    expect(res.hardware).toHaveLength(3);

    const shelf = res.parts[0];
    expect(shelf.dim.x).toBe(796); // 800 - 4
    expect(shelf.dim.y).toBe(540); // 550 - 10
    expect(shelf.dim.z).toBe(18);
  });
});
