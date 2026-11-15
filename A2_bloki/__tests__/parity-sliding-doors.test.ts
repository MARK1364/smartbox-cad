import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureSlidingDoorsWasmInitialized, callSlidingDoorsPlanWasm } from '../sliding-doors-wasm-bridge.js';
import { calculateSlidingDoorsPlan, normalizeSlidingDoorsParams } from '../19_sliding-doors-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';

describe('Sliding Doors Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/sliding_doors/wasm_sliding_doors_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await ensureSlidingDoorsWasmInitialized(wasmBytes);
    });

    it('matches 3-leaf sliding doors plan between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 2400,
            height_mm: 2600,
            depth_mm: 650
        };
        const rawParams = {
            liczba_skrzydel: 3,
            grubosc_frontu_mm: 18,
            szczelina_mm: 4,
            zakladka_mm: 30,
            nalozenie_gora_mm: 0,
            nalozenie_dol_mm: 0,
            nalozenie_lewe_mm: 0,
            nalozenie_prawe_mm: 0,
            typ_rolki: 'BOTTOM' as const,
            pokaz_rolki: true,
            pokaz_raczki: true
        };
        const norm = normalizeSlidingDoorsParams(rawParams, dims);

        const tsResult = calculateSlidingDoorsPlan(dims, norm);
        const wasmResult = callSlidingDoorsPlanWasm(dims, norm);

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);

        for (let i = 0; i < tsResult.parts.length; i++) {
            const tsP = tsResult.parts[i];
            const wasmP = wasmResult.parts[i];

            expect(wasmP.name).toBe(tsP.name);
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

