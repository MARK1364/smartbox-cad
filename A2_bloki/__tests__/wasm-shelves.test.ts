/**
 * A2_bloki/__tests__/wasm-shelves.test.ts
 * 
 * Test integracyjny weryfikujący działanie binarnego silnika WASM dla półek.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import initWasm, { calculate_shelves_plan_wasm } from '../../src/wasm/shelves/wasm_shelves.js';

describe('WASM Shelves Engine (Rust binary)', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../src/wasm/shelves/wasm_shelves_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initWasm(wasmBytes);
  });

  it('calculates 3 equal shelves with single hole pattern in WASM', () => {
    const dims = {
      width_mm: 600,
      height_mm: 720,
      depth_mm: 500
    };

    const params = {
      liczba_polek: 3,
      grubosc_polki_mm: 18,
      odsuniecie_przod_mm: 10,
      luz_boczny_mm: 0.5,
      wzor_nawiercen: 'SINGLE',
      odstep_otworow_przod_mm: 40,
      odstep_otworow_tyl_mm: 40,
      otwory_przod_aktywne: false,
      przesuniecie_otworow_przod_x_mm: 0,
      otwory_tyl_aktywne: false,
      przesuniecie_otworow_tyl_x_mm: 0,
      rozstaw_potrojny_z_mm: 32,
      rozstaw_system32_mm: 32,
      start_system32_z_mm: 100,
      liczba_otworow_system32: 5,
      podporka_id: 'PODPORKA_FI5'
    };

    const res: any = calculate_shelves_plan_wasm(dims, params);
    expect(res).toBeDefined();
    expect(res.parts).toHaveLength(3);
    
    // Wymiary półek: 600 - 2*0.5 = 599 mm szerokości, głębokość 500 - 10 = 490 mm
    for (const shelf of res.parts) {
      expect(shelf.role).toBe('SHELF_PANEL');
      expect(shelf.dim.x).toBe(599);
      expect(shelf.dim.y).toBe(490);
      expect(shelf.dim.z).toBe(18);
    }

    // 4 podpórki na półkę * 3 półki = 12 podpórek
    expect(res.hardware).toHaveLength(12);
    // 4 otwory na półkę = 12 otworów
    expect(res.features).toHaveLength(12);
  });
});

