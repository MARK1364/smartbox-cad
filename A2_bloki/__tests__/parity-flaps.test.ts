import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureFlapsWasmInitialized, callFlapsPlanWasm } from '../flaps-wasm-bridge.js';
import { calculateFlapsPlan, normalizeFlapsParams, FLAP_FRONT_LCS } from '../12_flaps-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initFlapsWasm from '../../src/wasm/flaps/wasm_flaps.js';

describe('Flaps Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/flaps/wasm_flaps_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initFlapsWasm(wasmBytes);
        await ensureFlapsWasmInitialized();
    });

    it('matches top flap layout between TS and Rust', () => {
        const dims: BlokiDimensions_mm = {
            width_mm: 800,
            height_mm: 400,
            depth_mm: 350
        };
        const rawParams = {
            kierunek_klapy: 'TOP' as const,
            grubosc_frontu_mm: 18,
            nalozenie_gora_mm: 14,
            nalozenie_dol_mm: 14,
            nalozenie_lewe_mm: 14,
            nalozenie_prawe_mm: 14,
            odsuniecie_zawiasu_lewe_mm: 90,
            odsuniecie_zawiasu_prawe_mm: 90,
            zawias_srodkowy: false,
            szablon_zawiasu_domyslny: 'BLUM_AVENTOS_HK_S'
        };
        const norm = normalizeFlapsParams(rawParams, dims);

        const tsResult = calculateFlapsPlan(dims, norm);
        const wasmResult = callFlapsPlanWasm(dims, norm, {
            edgeBanding: {},
            lcs: FLAP_FRONT_LCS,
            role: 'FLAP'
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
        expect(wasmResult.hardware.length).toBe(2); // left + right hinges

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
