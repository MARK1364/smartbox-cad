import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLedWasmInitialized, callLedInternalPlanWasm } from '../led-wasm-bridge.js';
import { calculateLedInternalPlan, normalizeLedInternalParams } from '../13_led-internal-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initLedWasm from '../../src/wasm/led/wasm_led.js';

describe('LED Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/led/wasm_led_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initLedWasm(wasmBytes);
        await ensureLedWasmInitialized();
    });

    it('matches internal LED profiles plan between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 800,
            height_mm: 720,
            depth_mm: 560
        };
        const rawParams = {
            wariant_led: 'VERTICAL_BOTH_SIDES' as const,
            profil_lewy: true,
            profil_prawy: true,
            profil_tyl: false,
            odsuniecie_od_przodu_lewe_mm: 50,
            odsuniecie_od_przodu_prawe_mm: 50,
            odsuniecie_tyl_od_srodka_mm: 0,
            szerokosc_profilu_mm: 12,
            glebokosc_profilu_mm: 6,
            odstep_od_scian_mm: 5
        };
        const norm = normalizeLedInternalParams(rawParams, dims);

        const tsResult = calculateLedInternalPlan(dims, norm);
        const wasmResult = callLedInternalPlanWasm(dims, norm);

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult.parts.length).toBe(2); // LED_L, LED_R

        for (let i = 0; i < tsResult.parts.length; i++) {
            const tsP = tsResult.parts[i];
            const wasmP = wasmResult.parts[i];

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
