/**
 * A2_bloki/__tests__/wasm-drawers.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla szuflad.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_drawers_plan_wasm } from '../../src/wasm/drawers/wasm_drawers.js';
import { ensureDrawersWasmInitialized, isDrawersWasmReady } from '../drawers-wasm-bridge.js';
import { calculateDrawersPlan, normalizeDrawersParams } from '../09_drawers-engine.js';

describe('WASM Drawers Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/drawers/wasm_drawers_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates 3 equal drawers in WASM', () => {
    const dims = {
      width_mm: 600,
      height_mm: 720,
      depth_mm: 500
    };

    const params = {
      liczba_szuflad: 3,
      grubosc_frontu_mm: 18,
      nalozenie_gora_mm: 15,
      nalozenie_dol_mm: 15,
      nalozenie_lewe_mm: 15,
      nalozenie_prawe_mm: 15,
      dystans_lewy_mm: 0,
      dystans_prawy_mm: 0,
      auto_wysokosc_frontu: true,
      szczelina_wspolna_mm: 3,
      domyslny_system_prowadnic_id: 'BLUM_ANTARO_M',
      wysokosci_frontow_mm: [],
      szczeliny_indywidualne_mm: []
    };

    const res: any = calculate_drawers_plan_wasm(dims, params);
    expect(res).toBeDefined();
    // 3 fronty + 3 dna + 3 plecy = 9 części
    expect(res.parts).toHaveLength(9);
    expect(res.slots).toHaveLength(3);

    const fronts = res.parts.filter((p: any) => p.role === 'FRONT');
    expect(fronts).toHaveLength(3);
    // Fronty mają szerokość: 600 + 15 + 15 = 630
    for (const front of fronts) {
      expect(front.role).toBe('FRONT');
      expect(front.width).toBe(630);
      expect(front.depth).toBe(18);
    }

    // Wysokość całkowita: 720 + 30 = 750. Szczeliny: 2 * 3 = 6. (750 - 6) / 3 = 248 mm
    expect(res.slots[0].front_h).toBe(248);
    expect(res.slots[1].front_h).toBe(248);
    expect(res.slots[2].front_h).toBe(248);
    expect(res.slots[0].length_mm).toBe(500);
  });

  it('calculates drawers with side spacers in WASM', () => {
    const dims = {
      width_mm: 800,
      height_mm: 720,
      depth_mm: 500
    };

    const params = {
      liczba_szuflad: 2,
      grubosc_frontu_mm: 18,
      nalozenie_gora_mm: 15,
      nalozenie_dol_mm: 15,
      nalozenie_lewe_mm: 15,
      nalozenie_prawe_mm: 15,
      dystans_lewy_mm: 25,
      dystans_prawy_mm: 25,
      auto_wysokosc_frontu: true,
      szczelina_wspolna_mm: 3,
      domyslny_system_prowadnic_id: 'BLUM_ANTARO_M',
      wysokosci_frontow_mm: [],
      szczeliny_indywidualne_mm: []
    };

    const res: any = calculate_drawers_plan_wasm(dims, params);
    // 2 fronty + 2 dna + 2 plecy + 2 dystanse boczne = 8 części
    expect(res.parts).toHaveLength(8);
    expect(res.hardware).toHaveLength(4);
    const spacers = res.parts.filter((p: any) => p.role === 'SPACER');
    expect(spacers).toHaveLength(2);
    expect(spacers[0].width).toBe(25);
  });

  it('routes calculateDrawersPlan through WASM with full hardware and front mounting holes', async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/drawers/wasm_drawers_bg.wasm');
    const ok = await ensureDrawersWasmInitialized(fs.readFileSync(wasmPath));
    expect(ok).toBe(true);
    expect(isDrawersWasmReady()).toBe(true);

    const dims = { width_mm: 600, height_mm: 720, depth_mm: 500 };
    const params = normalizeDrawersParams({
      liczba_szuflad: 3,
      grubosc_frontu_mm: 18,
      nalozenie_gora_mm: 15,
      nalozenie_dol_mm: 15,
      nalozenie_lewe_mm: 15,
      nalozenie_prawe_mm: 15,
      dystans_lewy_mm: 20,
      dystans_prawy_mm: 0,
      auto_wysokosc_frontu: true,
      szczelina_wspolna_mm: 3,
      domyslny_system_prowadnic_id: 'BLUM_ANTARO_M'
    }, dims);

    const res = calculateDrawersPlan(dims, params);
    // 3 fronty + 3 dna + 3 plecy + 1 dystans = 10 części
    expect(res.parts).toHaveLength(10);
    // 3 * 2 prowadnice = 6 okuć
    expect(res.hardware).toHaveLength(6);
    const fronts = res.parts.filter((p) => p.role === 'FRONT');
    expect(fronts).toHaveLength(3);
    for (const front of fronts) {
      expect(front.features && front.features.length).toBeGreaterThan(0);
    }
    expect(res.hardware[0].params?.profile).toBeDefined();
    expect(res.hardware[0].customProperties?.shape).toBe('RAIL');
  });
});

