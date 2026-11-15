import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureSmartFrameWasmInitialized, isSmartFrameWasmReady, callCabinetPlanWasm } from '../smartframe-wasm-bridge.js';
import {
    calculateStandardCabinetPlan,
    calculateCabinetPlan,
    normalizeCabinetParams
} from '../smartframe-engine.js';
import type { CabinetDimensions_mm, NormalizedCabinetParams } from '../smartframe-types.js';

describe('SmartFrame Parity Tests: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/smartframe/wasm_smartframe_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await ensureSmartFrameWasmInitialized(wasmBytes);
    });

    it('WASM engine is ready', () => {
        expect(isSmartFrameWasmReady()).toBe(true);
    });

    it('exact 1:1 parity for 1-zone standard cabinet', () => {
        const dims: CabinetDimensions_mm = { szerokosc_mm: 800, wysokosc_mm: 720, glebokosc_mm: 560 };
        const rawParams = {
            typ_korpusu: 'korpus3' as const,
            liczba_stref: 1 as const,
            tryb_wienca_gornego: 'FULL' as const,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 8,
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT' as const
        };
        const norm = normalizeCabinetParams(rawParams);

        const tsResult = calculateStandardCabinetPlan(dims, norm);
        const wasmResult = callCabinetPlanWasm(dims, norm, { gruboscPlytyMm: 18 });

        expect(wasmResult).not.toBeNull();
        expect(wasmResult!.parts.length).toBe(tsResult.parts.length);

        for (let i = 0; i < tsResult.parts.length; i++) {
            const tsP = tsResult.parts[i];
            const wasmP = wasmResult!.parts[i];

            expect(wasmP.key).toBe(tsP.key);
            expect(wasmP.role).toBe(tsP.role);
            expect(wasmP.dim.x).toBeCloseTo(tsP.dim.x, 2);
            expect(wasmP.dim.y).toBeCloseTo(tsP.dim.y, 2);
            expect(wasmP.dim.z).toBeCloseTo(tsP.dim.z, 2);
            expect(wasmP.loc.x).toBeCloseTo(tsP.loc.x, 2);
            expect(wasmP.loc.y).toBeCloseTo(tsP.loc.y, 2);
            expect(wasmP.loc.z).toBeCloseTo(tsP.loc.z, 2);
        }
    });

    it('exact 1:1 parity for 2-zone standard cabinet (separate carcase per zone)', () => {
        const dims: CabinetDimensions_mm = { szerokosc_mm: 900, wysokosc_mm: 2000, glebokosc_mm: 600 };
        const rawParams = {
            typ_korpusu: 'korpus3' as const,
            liczba_stref: 2 as const,
            wysokosc_strefy_dolnej_mm: 800,
            tryb_wienca_gornego: 'FULL' as const,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 8,
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT' as const
        };
        const norm = normalizeCabinetParams(rawParams);

        const tsResult = calculateStandardCabinetPlan(dims, norm);
        const wasmResult = callCabinetPlanWasm(dims, norm, { gruboscPlytyMm: 18 });

        expect(wasmResult).not.toBeNull();
        expect(wasmResult!.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult!.parts.length).toBe(10); // 2 zones * 5 parts = 10 parts

        for (let i = 0; i < tsResult.parts.length; i++) {
            const tsP = tsResult.parts[i];
            const wasmP = wasmResult!.parts[i];

            expect(wasmP.key).toBe(tsP.key);
            expect(wasmP.role).toBe(tsP.role);
            expect(wasmP.dim.x).toBeCloseTo(tsP.dim.x, 2);
            expect(wasmP.dim.y).toBeCloseTo(tsP.dim.y, 2);
            expect(wasmP.dim.z).toBeCloseTo(tsP.dim.z, 2);
            expect(wasmP.loc.x).toBeCloseTo(tsP.loc.x, 2);
            expect(wasmP.loc.y).toBeCloseTo(tsP.loc.y, 2);
            expect(wasmP.loc.z).toBeCloseTo(tsP.loc.z, 2);
        }
    });

    it('exact 1:1 parity for 3-zone standard cabinet', () => {
        const dims: CabinetDimensions_mm = { szerokosc_mm: 900, wysokosc_mm: 2400, glebokosc_mm: 600 };
        const rawParams = {
            typ_korpusu: 'korpus3' as const,
            liczba_stref: 3 as const,
            wysokosc_strefy_dolnej_mm: 720,
            wysokosc_strefy_srodkowej_mm: 680,
            tryb_wienca_gornego: 'FULL' as const,
            cofniecie_plecow_mm: 15,
            grubosc_plecow_mm: 3,
            wpuszczenie_plecow_mm: 8,
            szerokosc_trawersu_mm: 100,
            strona_blendy: 'LEFT' as const
        };
        const norm = normalizeCabinetParams(rawParams);

        const tsResult = calculateStandardCabinetPlan(dims, norm);
        const wasmResult = callCabinetPlanWasm(dims, norm, { gruboscPlytyMm: 18 });

        expect(wasmResult).not.toBeNull();
        expect(wasmResult!.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult!.parts.length).toBe(15); // 3 zones * 5 parts = 15 parts

        for (let i = 0; i < tsResult.parts.length; i++) {
            const tsP = tsResult.parts[i];
            const wasmP = wasmResult!.parts[i];

            expect(wasmP.key).toBe(tsP.key);
            expect(wasmP.role).toBe(tsP.role);
            expect(wasmP.dim.x).toBeCloseTo(tsP.dim.x, 2);
            expect(wasmP.dim.y).toBeCloseTo(tsP.dim.y, 2);
            expect(wasmP.dim.z).toBeCloseTo(tsP.dim.z, 2);
            expect(wasmP.loc.x).toBeCloseTo(tsP.loc.x, 2);
            expect(wasmP.loc.y).toBeCloseTo(tsP.loc.y, 2);
            expect(wasmP.loc.z).toBeCloseTo(tsP.loc.z, 2);
        }
    });
});
