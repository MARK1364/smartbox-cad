/**
 * A2_bloki/handles/handles-wasm-bridge.ts
 *
 * Mostek między światem JS/TS a binarnym silnikiem UCHWYTÓW w WASM (Rust).
 */

import type { HandleParamsMm } from './handle-types.js';
import type { HandleComputedLayoutMm } from './handle-layout.js';
import initWasm, { calculate_handle_layout_wasm } from '../../src/wasm/handles/wasm_handles.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_HANDLES_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureHandlesWasmInitialized(wasmBytes?: BufferSource): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                if (wasmBytes) {
                    await initWasm(wasmBytes);
                } else {
                    await initWasm();
                }
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Handles (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Handles nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isHandlesWasmReady(): boolean {
    return _wasmInitialized;
}

export function callHandleLayoutWasm(
    params: HandleParamsMm,
    panelWMm: number,
    panelHMm: number
): { layout: HandleComputedLayoutMm; uMm: number; vMm: number; uEdge: any; vEdge: any } | null {
    if (!_wasmInitialized) return null;
    try {
        const wasmRes: any = calculate_handle_layout_wasm(
            {
                placement_preset: params.placementPreset,
                orientation: params.orientation,
                total_length_mm: params.totalLengthMm,
                hole_distance_mm: params.holeDistanceMm,
                thickness_mm: params.thicknessMm,
                depth_mm: params.depthMm,
                offset_edge_x_mm: params.offsetEdgeXMm,
                offset_edge_y_mm: params.offsetEdgeYMm,
                u_mm: params.uMm,
                v_mm: params.vMm,
                u_edge: params.uEdge,
                v_edge: params.vEdge,
            },
            {
                panel_w_mm: panelWMm,
                panel_h_mm: panelHMm,
            }
        );

        if (!wasmRes || !wasmRes.center) return null;

        const layout: HandleComputedLayoutMm = {
            center: { x: wasmRes.center.x, y: wasmRes.center.y },
            holes: (wasmRes.holes || []).map((h: any) => ({ x: h.x, y: h.y })),
            overhangMm: wasmRes.overhang_mm,
            bbox: {
                minX: wasmRes.bbox.min_x,
                maxX: wasmRes.bbox.max_x,
                minY: wasmRes.bbox.min_y,
                maxY: wasmRes.bbox.max_y,
            },
            depthMm: wasmRes.depth_mm,
            thicknessMm: wasmRes.thickness_mm,
            orientation: wasmRes.orientation,
        };

        if (typeof window !== 'undefined' && (window as any).__WASM_HANDLES_DEBUG__) {
            (window as any).__WASM_HANDLES_DEBUG__.callCount++;
            (window as any).__WASM_HANDLES_DEBUG__.lastResult = wasmRes;
        }

        return {
            layout,
            uMm: wasmRes.u_mm,
            vMm: wasmRes.v_mm,
            uEdge: wasmRes.u_edge,
            vEdge: wasmRes.v_edge,
        };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_handle_layout_wasm:', e);
        return null;
    }
}
