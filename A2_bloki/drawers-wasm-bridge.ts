/**
 * A2_bloki/drawers-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem SZUFLAD w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPart, BlokiHardware } from './01_bloki-types.js';
import type { NormalizedDrawersParams } from './09_drawers-engine.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import initWasm, { calculate_drawers_plan_wasm } from '../src/wasm/drawers/wasm_drawers.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

// Eksponujemy flagę do window dla łatwego sprawdzenia w konsoli DevTools (F12)
if (typeof window !== 'undefined') {
    (window as any).__WASM_DRAWERS_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureDrawersWasmInitialized(wasmBuffer?: BufferSource): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm(wasmBuffer);
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Drawers (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #a855f7; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Drawers nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isDrawersWasmReady(): boolean {
    return _wasmInitialized;
}

export function callDrawersPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedDrawersParams,
    options?: {
        edgeBanding?: any;
        edgeBandingByRole?: Record<string, any>;
        frontLcs?: any;
        shelfLcs?: any;
        sideLLcs?: any;
        sideRLcs?: any;
        slotSpecs?: any[];
        sideProfilesBySlot?: Record<number, any>;
    }
): any | null {
    if (!_wasmInitialized) {
        return null;
    }
    try {
        const wasmResult: any = calculate_drawers_plan_wasm(dims, {
            liczba_szuflad: params.liczba_szuflad,
            grubosc_frontu_mm: params.grubosc_frontu_mm,
            nalozenie_gora_mm: params.nalozenie_gora_mm,
            nalozenie_dol_mm: params.nalozenie_dol_mm,
            nalozenie_lewe_mm: params.nalozenie_lewe_mm,
            nalozenie_prawe_mm: params.nalozenie_prawe_mm,
            dystans_lewy_mm: params.dystans_lewy_mm,
            dystans_prawy_mm: params.dystans_prawy_mm,
            auto_wysokosc_frontu: params.auto_wysokosc_frontu,
            szczelina_wspolna_mm: params.szczelina_wspolna_mm,
            domyslny_system_prowadnic_id: params.domyslny_system_prowadnic_id,
            wysokosci_frontow_mm: params.wysokosci_frontow_mm,
            szczeliny_indywidualne_mm: params.szczeliny_indywidualne_mm,
            slot_specs: options?.slotSpecs,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const parts: BlokiPart[] = wasmResult.parts.map((p: any) => {
            let lcs = options?.frontLcs;
            if (p.role === 'DRAWER_BOTTOM' || p.role === 'BOX') {
                lcs = options?.shelfLcs || {
                    mapping: { X: 'x', Y: 'y', Z: 'z' },
                    rotation: [90, 0, 0] as [number, number, number],
                    faces: { INNER: 'FACE_Y_PLUS', OUTER: 'FACE_Y_MINUS' }
                };
            } else if (p.role === 'DRAWER_BACK' || p.role === 'FRONT') {
                lcs = options?.frontLcs || {
                    mapping: { X: 'x', Y: 'z', Z: 'y' },
                    rotation: [0, 0, 0] as [number, number, number],
                    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
                };
            } else if (p.role === 'SPACER') {
                const isLeft = p.id?.includes('_L') || p.id?.includes('Lewy');
                lcs = isLeft
                    ? (options?.sideLLcs || {
                        mapping: { X: 'z', Y: 'y', Z: 'x' },
                        rotation: [0, 0, -90] as [number, number, number],
                        faces: { INNER: 'FACE_X_MINUS', OUTER: 'FACE_X_PLUS' }
                    })
                    : (options?.sideRLcs || {
                        mapping: { X: 'z', Y: 'y', Z: 'x' },
                        rotation: [0, 0, 90] as [number, number, number],
                        faces: { INNER: 'FACE_X_PLUS', OUTER: 'FACE_X_MINUS' }
                    });
            }

            const features = Array.isArray(p.front_holes)
                ? p.front_holes.map((h: any) => buildHoleMachiningIntent({
                    id: h.id,
                    name: h.name,
                    face: 'FACE_Z_PLUS',
                    u_mm: h.u_mm,
                    v_mm: h.v_mm,
                    diameter_mm: h.diameter_mm,
                    depth_mm: h.depth_mm,
                    rule: 'screw',
                    drivenBy: { nodeId: h.rail_node_id, role: 'HARDWARE', hardwareType: 'RAIL' },
                    sourcePartId: h.rail_node_id,
                    generatedBy: 'blok_drawers',
                    extraParams: {
                        template_id: h.template_id || 'STANDARD_DRAWER_DRILL',
                        isDrawerFrontHole: true,
                    },
                }).feature)
                : [];

            return {
                name: p.name,
                key: p.role === 'SPACER' ? p.id : `DRAWER_${p.drawer_index}_${p.role === 'DRAWER_BOTTOM' ? 'BOTTOM' : p.role === 'DRAWER_BACK' ? 'BACK' : p.role}`,
                role: p.role,
                nodeType: p.node_type || 'PART',
                groupKey: p.role !== 'SPACER' && p.drawer_index > 0 ? `drawer_${p.drawer_index}` : undefined,
                material: p.role === 'FRONT' ? 'W1100_ST9_18' : 'W1100_ST9_16',
                materialName: p.role === 'FRONT' ? 'Biały Alpejski' : 'Biały Alpejski 16mm',
                materialCode: 'W1100 ST9',
                dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
                loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
                lcs,
                edge_banding: options?.edgeBandingByRole?.[p.role] ?? options?.edgeBanding,
                features
            };
        });

        const hardware: BlokiHardware[] = Array.isArray(wasmResult.hardware)
            ? wasmResult.hardware.map((hw: any) => ({
                id: hw.id,
                name: hw.name,
                role: hw.role,
                hardwareType: hw.hardware_type,
                hardwareId: hw.hardware_id,
                side: hw.side,
                groupKey: hw.drawer_index > 0 ? `drawer_${hw.drawer_index}` : undefined,
                loc: { x: hw.loc.x, y: hw.loc.y, z: hw.loc.z },
                dim: { x: hw.dim.x, y: hw.dim.y, z: hw.dim.z },
                params: {
                    drawerIndex: hw.drawer_index,
                    railId: hw.rail_id,
                    side: hw.side,
                    lengthMm: hw.length_mm,
                    corpusHeight: hw.corpus_height,
                    zInternalBottom: hw.z_internal_bottom,
                    internal: Boolean(hw.internal),
                    profile: options?.sideProfilesBySlot?.[hw.drawer_index],
                    art_no: hw.art_no ?? undefined
                },
                customProperties: {
                    library_id: hw.rail_id,
                    art_no: hw.art_no ?? undefined,
                    shape: 'RAIL'
                }
            }))
            : [];

        const groups = Array.isArray(wasmResult.slots)
            ? wasmResult.slots.map((s: any, idx: number) => {
                const slotIdx = Number(s.index ?? idx + 1);
                return {
                    key: `drawer_${slotIdx}`,
                    name: `Szuflada ${slotIdx}`,
                    role: 'DRAWER_GROUP'
                };
            })
            : [];

        const result: any = {
            groups,
            parts,
            slots: wasmResult.slots,
            hardware
        };

        if (typeof window !== 'undefined' && (window as any).__WASM_DRAWERS_DEBUG__) {
            (window as any).__WASM_DRAWERS_DEBUG__.callCount++;
            (window as any).__WASM_DRAWERS_DEBUG__.lastResult = result;
        }
        console.log(`%c[WasmBridge] calculate_drawers_plan wykonane w WASM (Rust)! Szuflad: ${wasmResult.slots?.length}, Części: ${parts.length}`, 'color: #d946ef; font-weight: bold;');

        return result;
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_drawers_plan_wasm:', e);
        return null;
    }
}

