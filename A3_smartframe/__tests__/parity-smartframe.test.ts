import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureSmartFrameWasmInitialized, callCabinetPlanWasm } from '../smartframe-wasm-bridge.js';
import { calculateStandardCabinetPlan, calculateRogowy90CabinetPlan, calculateSkosnyCabinetPlan, planCabinet, normalizeCabinetParams } from '../smartframe-engine.js';
import type { CabinetDimensions_mm, NormalizedCabinetParams } from '../smartframe-types.js';

describe('SmartFrame Engine Parity: TypeScript vs Rust WASM (Najprostszy korpus 1 strefa)', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/smartframe/wasm_smartframe_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await ensureSmartFrameWasmInitialized(wasmBytes);
    });

    it('matches 1-zone standard carcase between TS and Rust WASM', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560
        };
        const params: NormalizedCabinetParams = normalizeCabinetParams({
            typ_korpusu: 'korpus3',
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
            tryb_wienca_gornego: 'FULL',
            grubosc_plecow_mm: 3,
            cofniecie_plecow_mm: 15,
            wpuszczenie_plecow_mm: 10
        });

        const tsResult = calculateStandardCabinetPlan(dims, params);
        const wasmResult = callCabinetPlanWasm(dims, params, { gruboscPlytyMm: 18 });

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);

        for (let i = 0; i < tsResult.parts.length; i++) {
            const tsP = tsResult.parts[i];
            const wasmP = wasmResult.parts.find(p => p.key === tsP.key);
            expect(wasmP).toBeDefined();
            if (!wasmP) continue;

            expect(wasmP.role).toBe(tsP.role);
            expect(wasmP.dim.x).toBeCloseTo(tsP.dim.x, 2);
            expect(wasmP.dim.y).toBeCloseTo(tsP.dim.y, 2);
            expect(wasmP.dim.z).toBeCloseTo(tsP.dim.z, 2);

            expect(wasmP.loc.x).toBeCloseTo(tsP.loc.x, 2);
            expect(wasmP.loc.y).toBeCloseTo(tsP.loc.y, 2);
            expect(wasmP.loc.z).toBeCloseTo(tsP.loc.z, 2);

            expect(wasmP.lcs?.rotation).toEqual(tsP.lcs?.rotation);
            expect(wasmP.lcs?.mapping).toEqual(tsP.lcs?.mapping);
        }
    });

    it('matches corner 90 cabinet (korpus_rogowy90) with proper L-notch outline and rot', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900
        };
        const params: NormalizedCabinetParams = normalizeCabinetParams({
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
            wpuszczenie_plecow_mm: 10
        });

        const plan = planCabinet(params);
        expect(plan.parts.length).toBe(8);

        const bokP = plan.parts.find(p => p.key === 'BOK_P');
        expect(bokP).toBeDefined();
        expect(bokP?.lcs?.rotation).toEqual([0, 0, 90]);

        const bokL = plan.parts.find(p => p.key === 'BOK_L');
        expect(bokL).toBeDefined();
        expect(bokL?.lcs?.rotation).toEqual([0, 0, 0]);

        const wieniecD = plan.parts.find(p => p.key === 'WIENIEC_D');
        expect(wieniecD).toBeDefined();
        expect(wieniecD?.customProperties?.shape).toBe('L_NOTCH');
        expect(wieniecD?.customProperties?.outline2d?.length).toBe(6);
        expect(wieniecD?.lcs?.rotation).toEqual([90, 180, 0]);

        const wieniecG = plan.parts.find(p => p.key === 'WIENIEC_G');
        expect(wieniecG).toBeDefined();
        expect(wieniecG?.customProperties?.shape).toBe('L_NOTCH');
        expect(wieniecG?.customProperties?.outline2d?.length).toBe(6);
        expect(wieniecG?.lcs?.rotation).toEqual([-90, 0, 0]);

        const plecyY = plan.parts.find(p => p.key === 'PLECY_Y');
        expect(plecyY).toBeDefined();
        expect(plecyY?.lcs?.rotation).toEqual([180, 0, 0]);

        const plecyX = plan.parts.find(p => p.key === 'PLECY_X');
        expect(plecyX).toBeDefined();
        expect(plecyX?.lcs?.rotation).toEqual([0, 0, -90]);
    });

    it('matches skosny front-back cabinet (korpus_skosny) with slope angle and trapezoid side outlines', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560
        };
        const params: NormalizedCabinetParams = normalizeCabinetParams({
            typ_korpusu: 'korpus_skosny',
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
            wysokosc_przod_mm: 400,
            wysokosc_tyl_mm: 720,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 10
        });

        const plan = planCabinet(params);
        expect(plan.parts.length).toBe(5);

        const wieniecG = plan.parts.find(p => p.key === 'WIENIEC_G');
        expect(wieniecG).toBeDefined();
        // Kąt pochylenia dachu: betaDeg - 90
        const betaDeg = Math.atan2(720 - 400, 560) * 180 / Math.PI;
        expect(wieniecG?.lcs?.rotation?.[0]).toBeCloseTo(betaDeg - 90, 1);

        const bokL = plan.parts.find(p => p.key === 'BOK_L');
        expect(bokL?.customProperties?.shape).toBe('skos_side');
        expect(bokL?.customProperties?.outline2d?.length).toBe(4);

        const bokP = plan.parts.find(p => p.key === 'BOK_P');
        expect(bokP?.customProperties?.shape).toBe('skos_side');
        expect(bokP?.customProperties?.outline2d?.length).toBe(4);
    });

    it('matches skosny left-right cabinet (korpus_skosny_lr) with z-rotation and trapezoid back outline', () => {
        const dims: CabinetDimensions_mm = {
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560
        };
        const params: NormalizedCabinetParams = normalizeCabinetParams({
            typ_korpusu: 'korpus_skosny_lr',
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
            wysokosc_lewy_mm: 400,
            wysokosc_prawy_mm: 720,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 10
        });

        const plan = planCabinet(params);
        expect(plan.parts.length).toBe(5);

        const bokL = plan.parts.find(p => p.key === 'BOK_L');
        const bokP = plan.parts.find(p => p.key === 'BOK_P');
        // Różne wysokości boków: lewy 400 mm, prawy 720 mm
        expect(bokL?.dim.x).toBe(400);
        expect(bokP?.dim.x).toBe(720);

        const wieniecG = plan.parts.find(p => p.key === 'WIENIEC_G');
        expect(wieniecG).toBeDefined();
        // Obrót wieńca w płaszczyźnie czołowej o kąt skosu Z
        expect(wieniecG?.lcs?.rotation?.[2]).toBeLessThan(-20);

        const plecy = plan.parts.find(p => p.key === 'PLECY');
        expect(plecy?.customProperties?.shape).toBe('skos_back');
        expect(plecy?.customProperties?.outline2d?.length).toBe(4);
    });
});
