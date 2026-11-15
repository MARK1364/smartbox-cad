/**
 * A2_bloki/skosne-doors-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem DRZWI SKOŚNYCH w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart, BlokiHardware } from './01_bloki-types.js';
import type { NormalizedSkosneDoorsParams } from './06_skosne-doors-engine.ts';
import initWasm, { calculate_skosne_doors_plan_wasm } from '../src/wasm/skosne_doors/wasm_skosne_doors.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_SKOSNE_DOORS_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureSkosneDoorsWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Skosne Doors (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Skosne Doors nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isSkosneDoorsWasmReady(): boolean {
    return _wasmInitialized;
}

export function callSkosneDoorsPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedSkosneDoorsParams,
    options: {
        doorRuleLcs: any;
        edgeBanding: any;
        buildHingeFeatures: (side: 'left' | 'right', width_mm: number, wnetkaSide_mm: number) => any[];
        wnetkaLewaMm: number;
        wnetkaPrawaMm: number;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) {
        return null;
    }
    try {
        const wasmResult: any = calculate_skosne_doors_plan_wasm(dims, {
            rodzaj_drzwi: params.rodzaj_drzwi,
            grubosc_frontu_mm: params.grubosc_frontu_mm,
            szczelina_mm: params.szczelina_mm,
            nalozenie_gora_mm: params.nalozenie_gora_mm,
            nalozenie_dol_mm: params.nalozenie_dol_mm,
            nalozenie_lewe_mm: params.nalozenie_lewe_mm,
            nalozenie_prawe_mm: params.nalozenie_prawe_mm,
            dach_kat_deg: params.dach_kat_deg,
            domyslny_zawias_id: params.domyslny_zawias_id,
            aktywne_zawiasy: params.aktywne_zawiasy,
            aktywne_zawiasy_lewe: params.aktywne_zawiasy_lewe,
            aktywne_zawiasy_prawe: params.aktywne_zawiasy_prawe,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const parts: BlokiPart[] = wasmResult.parts.map((p: any) => {
            const side = p.hinge_side as 'left' | 'right';
            const wnetkaSide_mm = side === 'left' ? options.wnetkaLewaMm : options.wnetkaPrawaMm;
            return {
                name: p.name,
                role: 'FRONT',
                nodeType: 'PART',
                material: 'W1100_ST9_18',
                materialName: 'Biały Alpejski',
                materialCode: 'W1100 ST9',
                dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
                loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
                lcs: options.doorRuleLcs,
                edge_banding: options.edgeBanding,
                features: options.buildHingeFeatures(side, p.dim.x, wnetkaSide_mm),
                customProperties: {
                    outline2d: p.outline2d,
                    shape: 'skos_front'
                },
                meta: {
                    skosFront: p.skos_front,
                    hingeSide: p.hinge_side,
                    verticalEdge: p.vertical_edge,
                    slantedEdge: p.slanted_edge,
                    dach_kat_deg: params.dach_kat_deg
                }
            };
        });

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
                side: h.side
            }
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_SKOSNE_DOORS_DEBUG__) {
            (window as any).__WASM_SKOSNE_DOORS_DEBUG__.callCount++;
            (window as any).__WASM_SKOSNE_DOORS_DEBUG__.lastResult = wasmResult;
        }

        return { parts, hardware };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_skosne_doors_plan_wasm:', e);
        return null;
    }
}

