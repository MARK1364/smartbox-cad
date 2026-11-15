import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensurePanelsWasmInitialized, callPanelsPlanWasm } from '../panels-wasm-bridge.js';
import { calculatePanelsPlan, normalizePanelsParams } from '../11_panels-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initPanelsWasm from '../../src/wasm/panels/wasm_panels.js';

describe('Panels Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/panels/wasm_panels_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initPanelsWasm(wasmBytes);
        await ensurePanelsWasmInitialized();
    });

    it('matches panels plan (plinth, top panel, left side) between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 800,
            height_mm: 720,
            depth_mm: 560
        };
        const rawParams = {
            grubosc_paneli_mm: 18,
            pokaz_cokol: true,
            wysokosc_cokolu_mm: 100,
            cofniecie_cokolu_mm: 30,
            pokaz_panel_gorny: true,
            pokaz_panel_lewy: true,
            tryb_bokow: 'CORPUS_ONLY' as const
        };
        const norm = normalizePanelsParams(rawParams, dims);

        const tsResult = calculatePanelsPlan(dims, norm);
        const wasmResult = callPanelsPlanWasm(dims, norm, {
            edgeBanding: {}
        });

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult.parts.length).toBe(4);

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
