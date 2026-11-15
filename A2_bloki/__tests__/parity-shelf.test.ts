import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureShelfWasmInitialized, callShelfPlanWasm } from '../shelf-wasm-bridge.js';
import { calculateShelfPlan, normalizeShelfParams } from '../03_shelf-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initShelfWasm from '../../src/wasm/shelf/wasm_shelf.js';

describe('Shelf Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/shelf/wasm_shelf_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initShelfWasm(wasmBytes);
        await ensureShelfWasmInitialized();
    });

    it('matches single shelf board plan between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 764,
            height_mm: 720,
            depth_mm: 560
        };
        const rawParams = {
            grubosc_wienca_mm: 18,
            odsuniecie_przod_mm: 10,
            odsuniecie_tyl_mm: 15,
            luz_boczny_mm: 0,
            baza_odniesienia: 'bottom' as const,
            odstep_dol_mm: 200
        };
        const norm = normalizeShelfParams(rawParams, dims);

        const tsResult = calculateShelfPlan(dims, norm);
        const wasmResult = callShelfPlanWasm(dims, norm, {});

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult.parts.length).toBe(1);

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

