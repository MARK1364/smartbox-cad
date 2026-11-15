import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureSkosneDoorsWasmInitialized, callSkosneDoorsPlanWasm } from '../skosne-doors-wasm-bridge.js';
import { calculateSkosneDoorsPlan, normalizeSkosneDoorsParams } from '../06_skosne-doors-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initSkosneDoorsWasm from '../../src/wasm/skosne_doors/wasm_skosne_doors.js';

describe('Skosne Doors Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/skosne_doors/wasm_skosne_doors_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initSkosneDoorsWasm(wasmBytes);
        await ensureSkosneDoorsWasmInitialized();
    });

    it('matches single slanted door (RIGHT) between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 600,
            height_mm: 1200,
            depth_mm: 560
        };
        const rawParams = {
            rodzaj_drzwi: 'RIGHT' as const,
            dach_kat_deg: 25,
            grubosc_frontu_mm: 18,
            szczelina_mm: 4,
            nalozenie_gora_mm: 14,
            nalozenie_dol_mm: 14,
            nalozenie_lewe_mm: 14,
            nalozenie_prawe_mm: 14,
            domyslny_zawias_id: 'BLUM_71B3550'
        };
        const norm = normalizeSkosneDoorsParams(rawParams, dims);
        expect(norm).not.toBeNull();
        if (!norm) return;

        const tsResult = calculateSkosneDoorsPlan(dims, norm);
        const wasmResult = callSkosneDoorsPlanWasm(dims, norm, {
            doorRuleLcs: {},
            edgeBanding: {},
            buildHingeFeatures: () => [],
            wnetkaLewaMm: dims.height_mm,
            wnetkaPrawaMm: dims.height_mm - dims.width_mm * Math.tan((norm.dach_kat_deg * Math.PI) / 180)
        });

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.parts.length).toBe(tsResult.parts.length);
        expect(wasmResult.parts.length).toBe(1);

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
