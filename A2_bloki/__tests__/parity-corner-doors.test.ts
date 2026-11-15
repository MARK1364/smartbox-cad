import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureCornerDoorsWasmInitialized, callCornerDoorsPlanWasm } from '../corner-doors-wasm-bridge.js';
import { calculateCornerDoorsPlan, normalizeCornerDoorsParams } from '../07_corner-doors-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initCornerDoorsWasm from '../../src/wasm/corner_doors/wasm_corner_doors.js';

describe('Corner Doors Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/corner_doors/wasm_corner_doors_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initCornerDoorsWasm(wasmBytes);
        await ensureCornerDoorsWasmInitialized();
    });

    it('matches L-corner doors plan between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 900,
            height_mm: 720,
            depth_mm: 900
        };
        const rawParams = {
            grubosc_frontu_mm: 18,
            szczelina_srodkowa_mm: 4,
            nalozenie_gora_mm: 14,
            nalozenie_dol_mm: 14,
            nalozenie_lewe_mm: 14,
            nalozenie_prawe_mm: 14,
            domyslny_zawias_id: 'BLUM_71B3550'
        };
        const norm = normalizeCornerDoorsParams(rawParams, dims);

        const tsResult = calculateCornerDoorsPlan(dims, norm);
        const wasmResult = callCornerDoorsPlanWasm(dims, norm, {
            lcsPrawe: {},
            lcsLewe: {},
            edgeBanding: {},
            buildHingeFeatures: () => []
        });

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult.parts.length).toBe(2); // Drzwi_Lewe, Drzwi_Prawe

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

        expect(wasmResult.hardware.length).toBe(tsResult.hardware.length);
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

