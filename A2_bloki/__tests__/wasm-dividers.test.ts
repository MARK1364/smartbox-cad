/**
 * A2_bloki/__tests__/wasm-dividers.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla przegród.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_dividers_plan_wasm } from '../../src/wasm/dividers/wasm_dividers.js';

describe('WASM Dividers Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/dividers/wasm_dividers_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates equal dividers in WASM', () => {
    const dims = {
      width_mm: 900,
      height_mm: 720,
      depth_mm: 500
    };

    const params = {
      liczba_przegrod: 2,
      grubosc_przegrody_mm: 18,
      tryb_rozstawu: 'EQUAL',
      szerokosci_wnek_mm: []
    };

    const res: any = calculate_dividers_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(2);
    expect(res.slots).toHaveLength(2);

    // 2 przegrody dzielą szerokość 900mm na 3 równe wnęki:
    // (900 - 2 * 18) / 3 = 864 / 3 = 288 mm
    expect(res.slots[0].bay_before).toBe(288);
    expect(res.ostatnia_wneka_mm).toBe(288);

    for (const p of res.parts) {
      expect(p.role).toBe('DIVIDER_PLATE');
      expect(p.dim.x).toBe(720); // wysokość
      expect(p.dim.y).toBe(500); // głębokość
      expect(p.dim.z).toBe(18);  // grubość
    }
  });

  it('docina przegrody do skośnego wieńca górnego (lewy-prawy, dach_kat_deg > 0 i < 0)', async () => {
    const { calculateDividersPlan, normalizeDividersParams } = await import('../10_dividers-engine.js');
    const dims = {
      width_mm: 900,
      height_mm: 1500, // wysokość światła wnęki w środku (x = 0)
      depth_mm: 500
    };

    // 1. Dach rośnie w prawo (dach_kat_deg = +30°)
    const normRight = normalizeDividersParams({
      liczba_przegrod: 2,
      grubosc_przegrody_mm: 18,
      tryb_rozstawu: 'EQUAL',
      dach_kat_deg: 30
    }, dims);
    const planRight = calculateDividersPlan(dims, normRight);
    expect(planRight.parts).toHaveLength(2);

    const tan30 = Math.tan((30 * Math.PI) / 180);
    const p1 = planRight.parts[0]; // xCenter = -153
    const p2 = planRight.parts[1]; // xCenter = +153

    expect(p1.loc.x).toBeCloseTo(-153, 5);
    expect(p2.loc.x).toBeCloseTo(153, 5);

    const expectedH1 = 1500 + (-153) * tan30 + 9 * tan30;
    const expectedH2 = 1500 + 153 * tan30 + 9 * tan30;

    expect(p1.dim.x).toBeCloseTo(expectedH1, 4);
    expect(p1.loc.z).toBeCloseTo(expectedH1 / 2, 4);
    expect(p2.dim.x).toBeCloseTo(expectedH2, 4);
    expect(p2.loc.z).toBeCloseTo(expectedH2 / 2, 4);

    // Ucios na górnej krawędzi (+X): dla dachu rosnącego w prawo wyższe jest prawe lico (Z_MINUS)
    expect(p1.edge_banding?.['+X']?.cutAngle).toBeCloseTo(30, 5);
    expect(p1.edge_banding?.['+X']?.cutAnchor).toBe('Z_MINUS');

    // 2. Dach rośnie w lewo (dach_kat_deg = -25°)
    const normLeft = normalizeDividersParams({
      liczba_przegrod: 2,
      grubosc_przegrody_mm: 18,
      tryb_rozstawu: 'EQUAL',
      dach_kat_deg: -25
    }, dims);
    const planLeft = calculateDividersPlan(dims, normLeft);
    const tan25 = Math.tan((25 * Math.PI) / 180);

    // Przy skosie w lewo lewa przegroda (x=-153) jest wyższa niż prawa (x=+153)
    expect(planLeft.parts[0].dim.x).toBeGreaterThan(planLeft.parts[1].dim.x);
    expect(planLeft.parts[0].dim.x).toBeCloseTo(1500 + 153 * tan25 + 9 * tan25, 4);
    expect(planLeft.parts[0].edge_banding?.['+X']?.cutAngle).toBeCloseTo(25, 5);
    expect(planLeft.parts[0].edge_banding?.['+X']?.cutAnchor).toBe('Z_PLUS');
  });
});

