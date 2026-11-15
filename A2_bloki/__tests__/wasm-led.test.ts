/**
 * A2_bloki/__tests__/wasm-led.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla profili LED (internal + external).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, {
  calculate_led_internal_plan_wasm,
  calculate_led_external_plan_wasm
} from '../../src/wasm/led/wasm_led.js';

describe('WASM LED Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/led/wasm_led_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates vertical LED profiles (left and right) in WASM', () => {
    const dims = {
      width_mm: 800,
      height_mm: 1200,
      depth_mm: 550
    };

    const params = {
      wariant_led: 'VERTICAL_BOTH_SIDES',
      profil_lewy: true,
      profil_prawy: true,
      profil_tyl: false,
      odsuniecie_od_przodu_lewe_mm: 50,
      odsuniecie_od_przodu_prawe_mm: 50,
      odsuniecie_tyl_od_srodka_mm: 125,
      odsuniecie_od_przodu_mm: 50,
      szerokosc_wpustu_mm: 14,
      glebokosc_wpustu_mm: 9,
      odstep_gora_mm: 20,
      odstep_dol_mm: 20
    };

    const res: any = calculate_led_internal_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(2);

    const lewy = res.parts.find((p: any) => p.name === 'Profil_LED_Pionowy_Lewy');
    const prawy = res.parts.find((p: any) => p.name === 'Profil_LED_Pionowy_Prawy');
    expect(lewy).toBeDefined();
    expect(prawy).toBeDefined();

    // Długość profilu: 1200 - 20 - 20 = 1160 mm
    expect(lewy.dim.y).toBe(1160);
    expect(prawy.dim.y).toBe(1160);
    expect(lewy.role).toBe('LED');
  });

  it('calculates under-cabinet horizontal external LED profile in WASM', () => {
    const dims = {
      width_mm: 900,
      height_mm: 720,
      depth_mm: 320
    };

    const params = {
      odsuniecie_od_przodu_mm: 50,
      szerokosc_wpustu_mm: 14,
      glebokosc_wpustu_mm: 9,
      frezuj_boki: true
    };

    const res: any = calculate_led_external_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(1);

    const led = res.parts[0];
    expect(led.name).toBe('Profil_LED_Podszafkowy');
    expect(led.dim.x).toBe(900);
    expect(led.dim.y).toBe(9);
    expect(led.dim.z).toBe(14);
  });
});

