import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureSmartFrameWasmInitialized, isSmartFrameWasmReady, callCabinetPlanWasm } from '../smartframe-wasm-bridge.js';
import { calculateCabinetPlan } from '../smartframe-engine.js';
import type { CabinetDimensions_mm, NormalizedCabinetParams } from '../smartframe-types.js';

describe('SmartFrame Rust WebAssembly Engine', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/smartframe/wasm_smartframe_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await ensureSmartFrameWasmInitialized(wasmBytes);
    });

    it('should initialize smartframe WASM binary successfully', () => {
        expect(isSmartFrameWasmReady()).toBe(true);
    });

    it('should generate 1-zone carcase geometry directly via Rust wasm', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 800,
            wysokosc_mm: 720,
            glebokosc_mm: 560
        };
        const params: NormalizedCabinetParams = {
            typ_korpusu: 'korpus3',
            szerokosc_mm: 800,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
            grubosc_plecow_mm: 3,
            cofniecie_plecow_mm: 15,
            wpuszczenie_plecow_mm: 10,
            tryb_wienca_gornego: 'FULL',
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT'
        };

        const result = callCabinetPlanWasm(dims, params, { gruboscPlytyMm: 18 });
        expect(result).not.toBeNull();
        if (!result) return;

        expect(result.zones).toHaveLength(1);
        expect(result.zones[0].zoneKey).toBe('SEKCJA_B');
        expect(result.zones[0].size).toBe(720);

        const roles = result.parts.map(p => p.role);
        expect(roles).toContain('LEFT_SIDE_PANEL');
        expect(roles).toContain('RIGHT_SIDE_PANEL');
        expect(roles).toContain('BOTTOM_PANEL');
        expect(roles).toContain('TOP_PANEL');
        expect(roles).toContain('BACK_PANEL');

        const leftSide = result.parts.find(p => p.role === 'LEFT_SIDE_PANEL');
        expect(leftSide).toBeDefined();
        // Wymiary lewego boku: grubość 18, wysokość 720, głębokość 560
        expect(leftSide?.dim.x).toBe(18);
        expect(leftSide?.dim.y).toBe(720);
        expect(leftSide?.dim.z).toBe(560);

        const bottom = result.parts.find(p => p.role === 'BOTTOM_PANEL');
        expect(bottom).toBeDefined();
        // Wieniec dolny między bokami: 800 - 2*18 = 764
        expect(bottom?.dim.x).toBe(764);
        expect(bottom?.dim.y).toBe(18);
        expect(bottom?.dim.z).toBe(560);
    });

    it('should calculate 2-zone and 3-zone layouts with independent carcases per zone', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 900,
            wysokosc_mm: 2400,
            glebokosc_mm: 600
        };
        const params: NormalizedCabinetParams = {
            typ_korpusu: 'korpus3',
            szerokosc_mm: 900,
            wysokosc_mm: 2400,
            glebokosc_mm: 600,
            liczba_stref: 2,
            wysokosc_strefy_dolnej_mm: 800,
            tryb_wienca_gornego: 'TRAVERSE_H',
            szerokosc_trawersu_mm: 100,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 8,
            strona_blendy: 'LEFT'
        };

        const result = callCabinetPlanWasm(dims, params, { gruboscPlytyMm: 18 });
        expect(result).not.toBeNull();
        if (!result) return;

        expect(result.zones).toHaveLength(2);
        expect(result.zones[0].size).toBe(800);
        expect(result.zones[1].size).toBe(1600);

        // Każda strefa to odrębna szafka z własnymi bokami, wieńcami i plecami
        // Strefa dolna B: 5 formatek (BOK_L, BOK_P, WIENIEC_D, WIENIEC_G, PLECY)
        // Strefa górna T (TRAVERSE_H): 6 formatek (BOK_L, BOK_P, WIENIEC_D, WIENIEC_G_FRONT, WIENIEC_G_BACK, PLECY) = 11 łącznie
        expect(result.parts).toHaveLength(11);
        const keys = result.parts.map(p => p.key);
        expect(keys).toContain('B_BOK_L');
        expect(keys).toContain('B_BOK_P');
        expect(keys).toContain('B_WIENIEC_D');
        expect(keys).toContain('B_WIENIEC_G');
        expect(keys).toContain('B_PLECY');
        expect(keys).toContain('T_BOK_L');
        expect(keys).toContain('T_BOK_P');
        expect(keys).toContain('T_WIENIEC_D');
        expect(keys).toContain('T_WIENIEC_G_FRONT');
        expect(keys).toContain('T_WIENIEC_G_BACK');
        expect(keys).toContain('T_PLECY');
    });

    it('should delegate calculateCabinetPlan transparently to Rust wasm', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 600,
            wysokosc_mm: 800,
            glebokosc_mm: 500
        };
        const params: NormalizedCabinetParams = {
            typ_korpusu: 'korpus3',
            szerokosc_mm: 600,
            wysokosc_mm: 800,
            glebokosc_mm: 500,
            liczba_stref: 1,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 8,
            tryb_wienca_gornego: 'FULL',
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT'
        };

        const result = calculateCabinetPlan(dims, params);
        expect(result.parts.length).toBeGreaterThan(0);
        expect(result.zones).toHaveLength(1);
    });

    it('should handle corner cabinets with blind panels (korpus_rogowy1)', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 1050,
            wysokosc_mm: 720,
            glebokosc_mm: 560
        };
        const params: NormalizedCabinetParams = {
            typ_korpusu: 'korpus_rogowy1',
            szerokosc_mm: 1050,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
            szerokosc_blendy_mm: 100,
            strona_blendy: 'RIGHT',
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 8,
            tryb_wienca_gornego: 'FULL',
            szerokosc_trawersu_mm: 100
        };

        const result = callCabinetPlanWasm(dims, params, { gruboscPlytyMm: 18 });
        expect(result).not.toBeNull();
        if (!result) return;

        const roles = result.parts.map(p => p.role);
        expect(roles).toContain('BLIND_PANEL');
    });

    it('should calculate corner 90 cabinet (korpus_rogowy90) with L-notch panels and corner nailers in Rust wasm', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900
        };
        const params: NormalizedCabinetParams = {
            typ_korpusu: 'korpus_rogowy90',
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            glebokosc_boku_lewego_mm: 560,
            glebokosc_boku_prawego_mm: 560,
            szerokosc_listwy_naroznej_mm: 100,
            typ_listwy_naroznej: 'KATOWA_90',
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 8,
            tryb_wienca_gornego: 'FULL',
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT'
        };

        const result = callCabinetPlanWasm(dims, params, { gruboscPlytyMm: 18 });
        expect(result).not.toBeNull();
        if (!result) return;

        const roles = result.parts.map(p => p.role);
        expect(roles).toContain('LEFT_SIDE_PANEL');
        expect(roles).toContain('RIGHT_SIDE_PANEL');
        expect(roles).toContain('BOTTOM_PANEL');
        expect(roles).toContain('TOP_PANEL');
        expect(roles).toContain('BACK_PANEL');
        expect(roles).toContain('CORNER_NAILER');

        const bottom = result.parts.find(p => p.role === 'BOTTOM_PANEL');
        expect(bottom?.customProperties?.outline2d).toBeDefined();
        expect(bottom?.customProperties?.outline2d?.length).toBe(6);
    });

    it('should calculate slanted roof cabinet (korpus_skosny) with trapezoidal side outlines in Rust wasm', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 600,
            wysokosc_mm: 1200,
            glebokosc_mm: 560
        };
        const params: NormalizedCabinetParams = {
            typ_korpusu: 'korpus_skosny',
            szerokosc_mm: 600,
            wysokosc_mm: 1200,
            glebokosc_mm: 560,
            liczba_stref: 1,
            wysokosc_przod_mm: 700,
            wysokosc_tyl_mm: 1200,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 8,
            tryb_wienca_gornego: 'FULL',
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT'
        };

        const result = callCabinetPlanWasm(dims, params, { gruboscPlytyMm: 18 });
        expect(result).not.toBeNull();
        if (!result) return;

        const roles = result.parts.map(p => p.role);
        expect(roles).toContain('LEFT_SIDE_PANEL');
        expect(roles).toContain('RIGHT_SIDE_PANEL');
        expect(roles).toContain('BOTTOM_PANEL');
        expect(roles).toContain('TOP_PANEL');
        expect(roles).toContain('BACK_PANEL');

        const leftSide = result.parts.find(p => p.role === 'LEFT_SIDE_PANEL');
        expect(leftSide?.customProperties?.outline2d).toBeDefined();
        expect(leftSide?.customProperties?.outline2d?.length).toBe(4);
    });

    it('should calculate slanted LR cabinet (korpus_skosny_lr) in Rust wasm', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 800,
            wysokosc_mm: 1500,
            glebokosc_mm: 500
        };
        const params: NormalizedCabinetParams = {
            typ_korpusu: 'korpus_skosny_lr',
            szerokosc_mm: 800,
            wysokosc_mm: 1500,
            glebokosc_mm: 500,
            liczba_stref: 1,
            wysokosc_lewy_mm: 900,
            wysokosc_prawy_mm: 1500,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 8,
            tryb_wienca_gornego: 'FULL',
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT'
        };

        const result = callCabinetPlanWasm(dims, params, { gruboscPlytyMm: 18 });
        expect(result).not.toBeNull();
        if (!result) return;

        const leftSide = result.parts.find(p => p.role === 'LEFT_SIDE_PANEL');
        const rightSide = result.parts.find(p => p.role === 'RIGHT_SIDE_PANEL');
        expect(leftSide?.dim.y).toBe(900);
        expect(rightSide?.dim.y).toBe(1500);

        const back = result.parts.find(p => p.role === 'BACK_PANEL');
        expect(back?.customProperties?.outline2d).toBeDefined();
    });
});
