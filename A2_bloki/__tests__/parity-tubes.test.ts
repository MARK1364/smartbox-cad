import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureTubesWasmInitialized, callTubesPlanWasm } from '../tubes-wasm-bridge.js';
import { calculateTubesPlan, normalizeTubesParams } from '../08_tubes-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initTubesWasm from '../../src/wasm/tubes/wasm_tubes.js';

describe('Tubes Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/tubes/wasm_tubes_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initTubesWasm(wasmBytes);
        await ensureTubesWasmInitialized();
    });

    it('matches tubes plan with top shelf between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 800,
            height_mm: 1200,
            depth_mm: 560
        };
        const rawParams = {
            odstep_gora_mm: 100,
            pokaz_polke: true,
            przestrzen_nad_polka_mm: 50,
            grubosc_polki_mm: 18,
            srednica_drazka_mm: 25
        };
        const norm = normalizeTubesParams(rawParams, dims);

        const tsResult = calculateTubesPlan(dims, norm);
        const wasmResult = callTubesPlanWasm(dims, norm, {
            edgeBanding: {},
            shelfLcs: {},
            shelfRole: 'SHELF_PANEL'
        });

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult.parts.length).toBe(1); // top shelf panel

        const tsP = tsResult.parts[0];
        const wasmP = wasmResult.parts[0];

        expect(wasmP.role).toBe(tsP.role);
        expect(wasmP.dim.x).toBeCloseTo(tsP.dim.x, 2);
        expect(wasmP.dim.y).toBeCloseTo(tsP.dim.y, 2);
        expect(wasmP.dim.z).toBeCloseTo(tsP.dim.z, 2);
        expect(wasmP.loc.x).toBeCloseTo(tsP.loc.x, 2);
        expect(wasmP.loc.y).toBeCloseTo(tsP.loc.y, 2);
        expect(wasmP.loc.z).toBeCloseTo(tsP.loc.z, 2);

        expect(wasmResult.hardware.length).toBe(tsResult.hardware.length);
        expect(wasmResult.hardware.length).toBe(3); // tube rod + 2 sockets

        for (let i = 0; i < tsResult.hardware.length; i++) {
            const tsH = tsResult.hardware[i];
            const wasmH = wasmResult.hardware[i];

            expect(wasmH.id).toBe(tsH.id);
            expect(wasmH.hardwareType).toBe(tsH.hardwareType);
            expect(wasmH.loc.x).toBeCloseTo(tsH.loc.x, 2);
            expect(wasmH.loc.y).toBeCloseTo(tsH.loc.y, 2);
            expect(wasmH.loc.z).toBeCloseTo(tsH.loc.z, 2);
        }
    });
});
