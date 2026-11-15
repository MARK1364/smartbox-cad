import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDrawersWasmInitialized, callDrawersPlanWasm } from '../drawers-wasm-bridge.js';
import { calculateDrawersPlan, normalizeDrawersParams } from '../09_drawers-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';
import initWasm from '../../src/wasm/drawers/wasm_drawers.js';

describe('Drawers Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../src/wasm/drawers/wasm_drawers_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await initWasm(wasmBytes);
        await ensureDrawersWasmInitialized();
    });

    it('matches 3 equal drawers layout between TS and Rust', () => {
        const dims: BlokiDimensions_mm = { width_mm: 600, height_mm: 720, depth_mm: 500 };
        const rawParams = {
            liczba_szuflad: 3,
            grubosc_frontu_mm: 18,
            nalozenie_gora_mm: 15,
            nalozenie_dol_mm: 15,
            nalozenie_lewe_mm: 15,
            nalozenie_prawe_mm: 15,
            dystans_lewy_mm: 0,
            dystans_prawy_mm: 0,
            szczelina_wspolna_mm: 3,
            domyslny_system_prowadnic_id: 'BLUM_ANTARO_M'
        };

        const norm = normalizeDrawersParams(rawParams, dims);
        const ts = calculateDrawersPlan(dims, norm);
        const wasm = callDrawersPlanWasm(dims, norm);

        expect(wasm).not.toBeNull();
        if (!wasm) return;

        console.log('TS PARTS:', ts.parts.map(p => ({ name: p.name, role: p.role })));
        console.log('WASM PARTS:', wasm.parts.map(p => ({ name: p.name, role: p.role })));
        expect(wasm.parts).toHaveLength(ts.parts.length);
        for (let i = 0; i < ts.parts.length; i++) {
            const pTs = ts.parts[i];
            const pWasm = wasm.parts[i];
            console.log(`COMPARING ${pTs.name}:`, {
                dimTs: pTs.dim,
                dimWasm: pWasm.dim,
                locTs: pTs.loc,
                locWasm: pWasm.loc
            });
            expect(pWasm.role).toBe(pTs.role);
            expect(pWasm.dim.x).toBeCloseTo(pTs.dim.x, 2);
            expect(pWasm.dim.y).toBeCloseTo(pTs.dim.y, 2);
            expect(pWasm.dim.z).toBeCloseTo(pTs.dim.z, 2);
            expect(pWasm.loc.x).toBeCloseTo(pTs.loc.x, 2);
            expect(pWasm.loc.y).toBeCloseTo(pTs.loc.y, 2);
            expect(pWasm.loc.z).toBeCloseTo(pTs.loc.z, 2);
        }
    });
});
