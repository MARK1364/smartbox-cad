import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureHangersWasmInitialized, callHangersPlanWasm } from '../hangers-wasm-bridge.js';
import { calculateHangersPlan, normalizeHangersParams } from '../17_hangers-engine.js';
import { resolveActiveHangerSet } from '../17_hangers-types.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initHangersWasm from '../../src/wasm/hangers/wasm_hangers.js';

describe('Hangers Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/hangers/wasm_hangers_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initHangersWasm(wasmBytes);
        await ensureHangersWasmInitialized();
    });

    it('matches hangers plan between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 800,
            height_mm: 720,
            depth_mm: 350
        };
        const rawParams = {
            szablon_id: 'zawieszka_camaro',
            odsuniecie_bok_mm: 5,
            odsuniecie_tyl_mm: 10,
            odsuniecie_gora_mm: 15
        };
        const norm = normalizeHangersParams(rawParams, dims);
        const setDef = resolveActiveHangerSet(norm.szablon_id, norm.zestaw_id);

        expect(setDef).toBeDefined();
        if (!setDef) return;

        const tsResult = calculateHangersPlan(dims, norm);
        const wasmResult = callHangersPlanWasm(dims, norm, setDef);

        expect(wasmResult).not.toBeNull();
        if (!wasmResult) return;

        expect(wasmResult.hardware.length).toBe(tsResult.hardware.length);
        expect(wasmResult.hardware.length).toBeGreaterThan(0);

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

