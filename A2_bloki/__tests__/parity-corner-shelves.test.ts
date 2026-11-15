import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureCornerShelvesWasmInitialized, callCornerShelvesPlanWasm } from '../corner-shelves-wasm-bridge.js';
import { calculateCornerShelvesPlan, normalizeCornerShelvesParams } from '../18_corner-shelves-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';

describe('Corner Shelves Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/corner_shelves/wasm_corner_shelves_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await ensureCornerShelvesWasmInitialized(wasmBytes);
    });

    it('matches 2 corner shelves layout between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 900,
            height_mm: 720,
            depth_mm: 900
        };
        const rawParams = {
            liczba_polek: 2,
            grubosc_polki_mm: 18,
            odsuniecie_przod_mm: 10,
            luz_boczny_mm: 1.5,
            bok_lewy_mm: 560,
            bok_prawy_mm: 560,
            wzor_nawiercen: 'SINGLE' as const,
            podporka_id: 'HAFELE_DUPLO_5'
        };
        const norm = normalizeCornerShelvesParams(rawParams, dims);

        const tsResult = calculateCornerShelvesPlan(dims, norm);
        const wasmResult = callCornerShelvesPlanWasm(dims, norm);

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult.parts.length).toBe(2);

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

            expect(wasmP.customProperties?.outline2d).toEqual(tsP.customProperties?.outline2d);
        }

        expect(wasmResult.hardware.length).toBe(tsResult.hardware.length);
        expect(wasmResult.hardware.length).toBe(8); // 2 shelves * 4 pins = 8

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

