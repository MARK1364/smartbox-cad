import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureShelvesWasmInitialized, callShelvesPlanWasm } from '../shelves-wasm-bridge.js';
import { calculateShelvesPlan, normalizeShelvesParams } from '../04_shelves-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initShelvesWasm from '../../src/wasm/shelves/wasm_shelves.js';

describe('Shelves Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/shelves/wasm_shelves_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initShelvesWasm(wasmBytes);
        await ensureShelvesWasmInitialized();
    });

    it('matches 3 shelves layout between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 800,
            height_mm: 1200,
            depth_mm: 560
        };
        const rawParams = {
            liczba_polek: 3,
            grubosc_polki_mm: 18,
            odsuniecie_przod_mm: 20,
            luz_boczny_mm: 1.5,
            wzor_nawiercen: 'SINGLE' as const,
            podporka_id: 'HAFELE_DUPLO_5'
        };
        const norm = normalizeShelvesParams(rawParams, dims);

        const tsResult = calculateShelvesPlan(dims, norm);
        const wasmResult = callShelvesPlanWasm(dims, norm, {
            edgeBanding: {},
            lcs: {}
        });

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult.parts.length).toBe(3);

        for (let i = 0; i < tsResult.parts.length; i++) {
            const tsP = tsResult.parts[i];
            const wasmP = wasmResult.parts[i];

            expect(wasmP.key).toBe(tsP.key);
            expect(wasmP.role).toBe(tsP.role);
            expect(wasmP.dim.x).toBeCloseTo(tsP.dim.x, 2);
            expect(wasmP.dim.y).toBeCloseTo(tsP.dim.y, 2);
            expect(wasmP.dim.z).toBeCloseTo(tsP.dim.z, 2);
            expect(wasmP.loc.x).toBeCloseTo(tsP.loc.x, 2);
            expect(wasmP.loc.y).toBeCloseTo(tsP.loc.y, 2);
            expect(wasmP.loc.z).toBeCloseTo(tsP.loc.z, 2);
        }

        expect(wasmResult.hardware.length).toBe(tsResult.hardware.length);
        expect(wasmResult.hardware.length).toBe(12); // 3 shelves * 4 pins = 12 pins

        for (let i = 0; i < tsResult.hardware.length; i++) {
            const tsH = tsResult.hardware[i];
            const wasmH = wasmResult.hardware[i];

            expect(wasmH.id).toBe(tsH.id);
            expect(wasmH.loc.x).toBeCloseTo(tsH.loc.x, 2);
            expect(wasmH.loc.y).toBeCloseTo(tsH.loc.y, 2);
            expect(wasmH.loc.z).toBeCloseTo(tsH.loc.z, 2);
        }
    });
});
