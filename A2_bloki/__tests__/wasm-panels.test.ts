/**
 * A2_bloki/__tests__/wasm-panels.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla blend / paneli.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_panels_plan_wasm } from '../../src/wasm/panels/wasm_panels.js';

describe('WASM Panels Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/panels/wasm_panels_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates full panels and plinth in WASM', () => {
    const dims = {
      width_mm: 800,
      height_mm: 720,
      depth_mm: 550
    };

    const params = {
      grubosc_blendy_mm: 18,
      tryb_paneli_bocznych: 'FULL',
      wlacz_lewy: true,
      wlacz_prawy: true,
      wlacz_gorny: true,
      wlacz_dolny: true,
      auto_glebokosc_lewy: true,
      auto_glebokosc_prawy: true,
      auto_glebokosc_gorny: true,
      glebokosc_blendy_lewa_mm: 100,
      glebokosc_blendy_prawa_mm: 100,
      glebokosc_blendy_gora_mm: 100,
      wysokosc_cokolu_mm: 97,
      szczelina_cokolu_mm: 3,
      cofniecie_cokolu_mm: 20,
      luz_lewy_mm: 0,
      luz_prawy_mm: 0,
      luz_gorny_mm: 0
    };

    const res: any = calculate_panels_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(4);

    const left = res.parts.find((p: any) => p.key === 'PANEL_LEFT');
    expect(left).toBeDefined();
    // FULL mode: zBottom = -3 - 97 = -100, zTop = 720 + 18 = 738 => sideH = 838
    expect(left.dim.x).toBe(838);
    expect(left.dim.y).toBe(550); // auto_glebokosc = depth_mm
    expect(left.dim.z).toBe(18);

    const right = res.parts.find((p: any) => p.key === 'PANEL_RIGHT');
    expect(right).toBeDefined();
    expect(right.dim.x).toBe(838);

    const top = res.parts.find((p: any) => p.key === 'PANEL_TOP');
    expect(top).toBeDefined();
    expect(top.dim.x).toBe(800);
    expect(top.dim.y).toBe(550);

    const bottom = res.parts.find((p: any) => p.key === 'PANEL_BOTTOM');
    expect(bottom).toBeDefined();
    expect(bottom.dim.x).toBe(800);
    expect(bottom.dim.y).toBe(18);
    expect(bottom.dim.z).toBe(97);
  });
});

