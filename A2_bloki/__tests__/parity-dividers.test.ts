import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDividersWasmInitialized, callDividersPlanWasm } from '../dividers-wasm-bridge.js';
import { calculateDividersPlan, normalizeDividersParams } from '../10_dividers-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initDividersWasm from '../../src/wasm/dividers/wasm_dividers.js';

describe('Dividers Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/dividers/wasm_dividers_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initDividersWasm(wasmBytes);
        await ensureDividersWasmInitialized();
    });

    it('matches 2 dividers layout between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 900,
            height_mm: 720,
            depth_mm: 560
        };
        const rawParams = {
            liczba_przegrod: 2,
            grubosc_przegrody_mm: 18,
            odsuniecie_przod_mm: 15,
            odsuniecie_tyl_mm: 10,
            odstep_dol_mm: 0,
            odstep_gora_mm: 0
        };
        const norm = normalizeDividersParams(rawParams, dims);

        const tsResult = calculateDividersPlan(dims, norm);
        const wasmResult = callDividersPlanWasm(dims, norm, {
            edgeBanding: {},
            lcs: {}
        });

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult.parts.length).toBe(2);

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

