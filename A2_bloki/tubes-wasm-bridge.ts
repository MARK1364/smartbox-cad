/**
 * A2_bloki/tubes-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem DRĄŻKÓW w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart, BlokiHardware } from './01_bloki-types.js';
import type { NormalizedTubesParams } from './08_tubes-engine.js';
import { CYLINDER_SHAPE } from '../A1_core/cad-node/part-shape.js';
import initWasm, { calculate_tubes_plan_wasm } from '../src/wasm/tubes/wasm_tubes.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_TUBES_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureTubesWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Tubes (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Tubes nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isTubesWasmReady(): boolean {
    return _wasmInitialized;
}

export function callTubesPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedTubesParams,
    options: {
        edgeBanding: any;
        shelfLcs: any;
        shelfRole: string;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) {
        return null;
    }
    try {
        const wasmResult: any = calculate_tubes_plan_wasm(dims, {
            odstep_gora_mm: params.odstep_gora_mm,
            pokaz_polke: params.pokaz_polke,
            przestrzen_nad_polka_mm: params.przestrzen_nad_polka_mm,
            grubosc_polki_mm: params.grubosc_polki_mm,
            srednica_drazka_mm: params.srednica_drazka_mm,
        });

        if (!wasmResult) return null;

        const parts: BlokiPart[] = (wasmResult.parts || []).map((p: any) => ({
            name: p.name,
            role: (options.shelfRole as any) || 'SHELF_PANEL',
            nodeType: 'PART',
            dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
            loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
            lcs: options.shelfLcs,
            edge_banding: options.edgeBanding,
            features: []
        }));

        const hardware: BlokiHardware[] = (wasmResult.hardware || []).map((h: any) => ({
            id: h.id,
            name: h.name,
            role: h.role,
            hardwareType: 'TUBE',
            hardwareId: h.hardware_id,
            side: h.side,
            dim: { x: h.dim.x, y: h.dim.y, z: h.dim.z },
            loc: { x: h.loc.x, y: h.loc.y, z: h.loc.z },
            params: {
                diameter_mm: h.dim.y,
                length_mm: h.dim.x
            },
            customProperties: {
                shape: CYLINDER_SHAPE,
                material: 'Aluminium_Chrome'
            }
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_TUBES_DEBUG__) {
            (window as any).__WASM_TUBES_DEBUG__.callCount++;
            (window as any).__WASM_TUBES_DEBUG__.lastResult = wasmResult;
        }
        console.log(`%c[WasmBridge] calculate_tubes_plan wykonane w WASM (Rust)! Części: ${parts.length}, Okuć: ${hardware.length}`, 'color: #3b82f6; font-weight: bold;');

        return { parts, hardware };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_tubes_plan_wasm:', e);
        return null;
    }
}

