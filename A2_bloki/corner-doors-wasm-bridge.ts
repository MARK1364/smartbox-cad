/**
 * A2_bloki/corner-doors-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem DRZWI NAROŻNYCH w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart, BlokiHardware } from './01_bloki-types.js';
import type { NormalizedCornerDoorsParams } from './07_corner-doors-engine.js';
import initWasm, { calculate_corner_doors_plan_wasm } from '../src/wasm/corner_doors/wasm_corner_doors.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_CORNER_DOORS_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureCornerDoorsWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Corner Doors (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Corner Doors nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isCornerDoorsWasmReady(): boolean {
    return _wasmInitialized;
}

export function callCornerDoorsPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedCornerDoorsParams,
    options: {
        lcsPrawe: any;
        lcsLewe: any;
        edgeBanding: any;
        buildHingeFeatures: (side: 'left' | 'right', doorWidth_mm: number) => any[];
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) {
        return null;
    }
    try {
        const wasmResult: any = calculate_corner_doors_plan_wasm(dims, {
            grubosc_frontu_mm: params.grubosc_frontu_mm,
            szczelina_srodkowa_mm: params.szczelina_srodkowa_mm,
            nalozenie_gora_mm: params.nalozenie_gora_mm,
            nalozenie_dol_mm: params.nalozenie_dol_mm,
            nalozenie_prawe_mm: params.nalozenie_prawe_mm,
            nalozenie_lewe_mm: params.nalozenie_lewe_mm,
            otwieranie: params.otwieranie,
            szablon_zawiasu_domyslny: params.szablon_zawiasu_domyslny,
            zawiasy: params.zawiasy.map(z => ({ index: z.index, local_z: z.localZ })),
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const parts: BlokiPart[] = wasmResult.parts.map((p: any) => ({
            name: p.name,
            role: 'FRONT',
            nodeType: 'PART',
            dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
            loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
            lcs: p.corner_leaf === 'PRAWE' ? options.lcsPrawe : options.lcsLewe,
            edge_banding: options.edgeBanding,
            features: options.buildHingeFeatures(p.hinge_side, p.dim.x),
            meta: { cornerLeaf: p.corner_leaf, hingeInGap: true, cornerAt: 'innerL_wieniec' }
        }));

        const hardware: BlokiHardware[] = (wasmResult.hardware || []).map((h: any) => ({
            id: h.id,
            name: h.name,
            hardwareType: 'HINGE',
            hardwareId: h.hardware_id,
            side: h.side,
            loc: { x: h.loc.x, y: h.loc.y, z: h.loc.z },
            params: {
                hingeIndex: h.hinge_index,
                localZ: h.local_z,
                side: h.side,
                cornerLeaf: h.corner_leaf,
                cornerAt: 'innerL_wieniec'
            }
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_CORNER_DOORS_DEBUG__) {
            (window as any).__WASM_CORNER_DOORS_DEBUG__.callCount++;
            (window as any).__WASM_CORNER_DOORS_DEBUG__.lastResult = wasmResult;
        }

        return { parts, hardware };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_corner_doors_plan_wasm:', e);
        return null;
    }
}

