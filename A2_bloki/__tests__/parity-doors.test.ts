import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDoorsWasmInitialized, callDoorsPlanWasm } from '../doors-wasm-bridge.js';
import { calculateDoorsPlan } from '../05_doors-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import type { NormalizedDoorsParams } from '../05_doors-engine.js';
import initWasm from '../../src/wasm/doors/wasm_doors.js';

describe('Doors Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/doors/wasm_doors_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initWasm(wasmBytes);
        await ensureDoorsWasmInitialized();
    });

    it('matches single door layout (LEFT) between TS and Rust', () => {
        const dims: BlokiDimensions_mm = { width_mm: 600, height_mm: 720, depth_mm: 560 };
        const params: NormalizedDoorsParams = {
            rodzaj_drzwi: 'LEFT',
            grubosc_frontu_mm: 18,
            szczelina_mm: 4,
            nalozenie_gora_mm: 14,
            nalozenie_dol_mm: 15,
            nalozenie_lewe_mm: 16,
            nalozenie_prawe_mm: 16,
            domyslny_zawias_id: 'BLUM_71B3550',
            szablony_zawiasow: {},
            aktywne_zawiasy: [
                { index: 1, pozycja_lokalna_z_mm: 120 },
                { index: 6, pozycja_lokalna_z_mm: 600 }
            ]
        };

        const ts = calculateDoorsPlan(dims, params);
        const wasm = callDoorsPlanWasm(dims, params);

        expect(wasm).not.toBeNull();
        if (!wasm) return;

        expect(wasm.parts).toHaveLength(ts.parts.length);
        expect(wasm.hardware).toHaveLength(ts.hardware.length);

        for (let i = 0; i < ts.parts.length; i++) {
            const pTs = ts.parts[i];
            const pWasm = wasm.parts[i];
            expect(pWasm.role).toBe(pTs.role);
            expect(pWasm.dim.x).toBeCloseTo(pTs.dim.x, 2);
            expect(pWasm.dim.y).toBeCloseTo(pTs.dim.y, 2);
            expect(pWasm.dim.z).toBeCloseTo(pTs.dim.z, 2);
            expect(pWasm.loc.x).toBeCloseTo(pTs.loc.x, 2);
            expect(pWasm.loc.y).toBeCloseTo(pTs.loc.y, 2);
            expect(pWasm.loc.z).toBeCloseTo(pTs.loc.z, 2);
        }

        for (let i = 0; i < ts.hardware.length; i++) {
            const hTs = ts.hardware[i];
            const hWasm = wasm.hardware[i];
            expect(hWasm.id).toBe(hTs.id);
            expect(hWasm.loc.x).toBeCloseTo(hTs.loc.x, 2);
            expect(hWasm.loc.y).toBeCloseTo(hTs.loc.y, 2);
            expect(hWasm.loc.z).toBeCloseTo(hTs.loc.z, 2);
        }
    });

    it('matches double door layout (DOUBLE) between TS and Rust', () => {
        const dims: BlokiDimensions_mm = { width_mm: 900, height_mm: 800, depth_mm: 560 };
        const params: NormalizedDoorsParams = {
            rodzaj_drzwi: 'DOUBLE',
            grubosc_frontu_mm: 18,
            szczelina_mm: 4,
            nalozenie_gora_mm: 14,
            nalozenie_dol_mm: 14,
            nalozenie_lewe_mm: 16,
            nalozenie_prawe_mm: 16,
            domyslny_zawias_id: 'BLUM_71B3550',
            szablony_zawiasow: {},
            aktywne_zawiasy: [
                { index: 1, pozycja_lokalna_z_mm: 100 },
                { index: 6, pozycja_lokalna_z_mm: 700 }
            ]
        };

        const ts = calculateDoorsPlan(dims, params);
        const wasm = callDoorsPlanWasm(dims, params);

        expect(wasm).not.toBeNull();
        if (!wasm) return;

        expect(wasm.parts).toHaveLength(ts.parts.length);
        expect(wasm.hardware).toHaveLength(ts.hardware.length);

        for (let i = 0; i < ts.parts.length; i++) {
            const pTs = ts.parts[i];
            const pWasm = wasm.parts[i];
            expect(pWasm.role).toBe(pTs.role);
            expect(pWasm.dim.x).toBeCloseTo(pTs.dim.x, 2);
            expect(pWasm.dim.y).toBeCloseTo(pTs.dim.y, 2);
            expect(pWasm.dim.z).toBeCloseTo(pTs.dim.z, 2);
            expect(pWasm.loc.x).toBeCloseTo(pTs.loc.x, 2);
            expect(pWasm.loc.y).toBeCloseTo(pTs.loc.y, 2);
            expect(pWasm.loc.z).toBeCloseTo(pTs.loc.z, 2);
        }
    });

    it('propagates per-hinge template overrides (e.g. BLUM_71B7550 155 deg) through WASM', () => {
        const dims = { width_mm: 564, height_mm: 764, depth_mm: 560 };
        const params: NormalizedDoorsParams = {
            rodzaj_drzwi: 'LEFT',
            grubosc_frontu_mm: 18,
            szczelina_mm: 2,
            nalozenie_gora_mm: 14,
            nalozenie_dol_mm: 15,
            nalozenie_lewe_mm: 15,
            nalozenie_prawe_mm: 15,
            domyslny_zawias_id: 'BLUM_71B3550',
            szablony_zawiasow: { 1: 'BLUM_71B7550' },
            aktywne_zawiasy: [
                { index: 1, pozycja_lokalna_z_mm: 100 },
                { index: 6, pozycja_lokalna_z_mm: 664 }
            ]
        };

        const wasm = callDoorsPlanWasm(dims, params);
        expect(wasm).not.toBeNull();
        if (!wasm) return;

        const h1 = wasm.hardware.find(h => h.id === 'hinge_left_1');
        const h6 = wasm.hardware.find(h => h.id === 'hinge_left_6');
        expect(h1?.hardwareId).toBe('BLUM_71B7550');
        expect(h6?.hardwareId).toBe('BLUM_71T3550');

        const cup1 = wasm.parts[0]?.features?.find((f: any) => f.id === 'hinge_cup_left_1');
        const cup6 = wasm.parts[0]?.features?.find((f: any) => f.id === 'hinge_cup_left_6');
        expect(cup1?.params?.hinge_id).toBe('BLUM_71B7550');
        expect(cup6?.params?.hinge_id).toBe('BLUM_71T3550');
    });
});

