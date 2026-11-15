import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ensureHandlesWasmInitialized, callHandleLayoutWasm } from '../handles-wasm-bridge.js';
import { computeHandleLayout } from '../handle-layout.js';
import type { HandleParamsMm } from '../handle-types.js';

describe('Handles Layout Engine Parity: TypeScript vs Rust WASM', () => {
    beforeAll(async () => {
        const wasmPath = path.resolve(__dirname, '../../../src/wasm/handles/wasm_handles_bg.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        await ensureHandlesWasmInitialized(wasmBytes);
    });

    it('matches 2-hole horizontal handle layout between TS and Rust', () => {
        const panelW = 600;
        const panelH = 720;
        const params: HandleParamsMm = {
            placementPreset: 'TOP_CENTER',
            color: { r: 0.1, g: 0.1, b: 0.1 },
            orientation: 'HORIZONTAL',
            totalLengthMm: 200,
            holeDistanceMm: 160,
            thicknessMm: 12,
            depthMm: 28,
            offsetEdgeXMm: 0,
            offsetEdgeYMm: 40,
            footDiameterMm: 10,
            drillingEnabled: true,
            drillDiameterMm: 4
        };

        const tsResult = computeHandleLayout(params, panelW, panelH);
        const wasmBridgeRes = callHandleLayoutWasm(params, panelW, panelH);

        expect(wasmBridgeRes).not.toBeNull();
        if (!wasmBridgeRes) return;

        const wasmResult = wasmBridgeRes.layout;

        expect(wasmResult.center.x).toBeCloseTo(tsResult.center.x, 2);
        expect(wasmResult.center.y).toBeCloseTo(tsResult.center.y, 2);
        expect(wasmResult.overhangMm).toBeCloseTo(tsResult.overhangMm, 2);

        expect(wasmResult.holes.length).toBe(tsResult.holes.length);
        expect(wasmResult.holes.length).toBe(2);

        for (let i = 0; i < tsResult.holes.length; i++) {
            expect(wasmResult.holes[i].x).toBeCloseTo(tsResult.holes[i].x, 2);
            expect(wasmResult.holes[i].y).toBeCloseTo(tsResult.holes[i].y, 2);
        }

        expect(wasmResult.bbox.minX).toBeCloseTo(tsResult.bbox.minX, 2);
        expect(wasmResult.bbox.maxX).toBeCloseTo(tsResult.bbox.maxX, 2);
        expect(wasmResult.bbox.minY).toBeCloseTo(tsResult.bbox.minY, 2);
        expect(wasmResult.bbox.maxY).toBeCloseTo(tsResult.bbox.maxY, 2);
    });

    it('matches single knob (1-hole) vertical handle layout between TS and Rust', () => {
        const panelW = 450;
        const panelH = 800;
        const params: HandleParamsMm = {
            placementPreset: 'TOP_RIGHT',
            color: { r: 0.1, g: 0.1, b: 0.1 },
            orientation: 'VERTICAL',
            totalLengthMm: 30,
            holeDistanceMm: 0,
            thicknessMm: 30,
            depthMm: 25,
            offsetEdgeXMm: 50,
            offsetEdgeYMm: 60,
            footDiameterMm: 10,
            drillingEnabled: true,
            drillDiameterMm: 4
        };

        const tsResult = computeHandleLayout(params, panelW, panelH);
        const wasmBridgeRes = callHandleLayoutWasm(params, panelW, panelH);

        expect(wasmBridgeRes).not.toBeNull();
        if (!wasmBridgeRes) return;

        const wasmResult = wasmBridgeRes.layout;

        expect(wasmResult.center.x).toBeCloseTo(tsResult.center.x, 2);
        expect(wasmResult.center.y).toBeCloseTo(tsResult.center.y, 2);
        expect(wasmResult.holes.length).toBe(1);
        expect(wasmResult.holes[0].x).toBeCloseTo(tsResult.holes[0].x, 2);
        expect(wasmResult.holes[0].y).toBeCloseTo(tsResult.holes[0].y, 2);
    });
});
