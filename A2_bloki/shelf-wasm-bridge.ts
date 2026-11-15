/**
 * A2_bloki/shelf-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem WIŃCA (pojedynczej półki) w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart } from './01_bloki-types.js';
import type { NormalizedShelfParams } from './03_shelf-engine.js';
import initWasm, { calculate_shelf_plan_wasm } from '../src/wasm/shelf/wasm_shelf.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_SHELF_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureShelfWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Shelf (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Shelf nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isShelfWasmReady(): boolean {
    return _wasmInitialized;
}

export function callShelfPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedShelfParams,
    options: {
        shelfName?: string;
        shelfRole?: string;
        shelfLcs?: any;
        edgeBanding?: any;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) {
        return null;
    }
    try {
        const wasmResult: any = calculate_shelf_plan_wasm(dims, {
            grubosc_wienca_mm: params.grubosc_wienca_mm,
            odsuniecie_przod_mm: params.odsuniecie_przod_mm,
            odsuniecie_tyl_mm: params.odsuniecie_tyl_mm,
            luz_boczny_mm: params.luz_boczny_mm,
            baza_odniesienia: params.baza_odniesienia,
            odstep_gora_mm: params.odstep_gora_mm,
            odstep_dol_mm: params.odstep_dol_mm,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const parts: BlokiPart[] = wasmResult.parts.map((p: any) => ({
            name: options.shelfName || p.name,
            role: (options.shelfRole as any) || p.role,
            nodeType: 'PART',
            dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
            loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
            lcs: options.shelfLcs || {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [90, 0, 0],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            },
            edge_banding: options.edgeBanding || {
                '+Y': { active: true, type_id: '0.008x0.022' },
                '-Y': { active: false, type_id: 'none' },
                '+X': { active: false, type_id: 'none' },
                '-X': { active: false, type_id: 'none' }
            },
            features: []
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_SHELF_DEBUG__) {
            (window as any).__WASM_SHELF_DEBUG__.callCount++;
            (window as any).__WASM_SHELF_DEBUG__.lastResult = wasmResult;
        }

        return { parts };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_shelf_plan_wasm:', e);
        return null;
    }
}

