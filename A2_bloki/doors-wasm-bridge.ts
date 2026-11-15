/**
 * A2_bloki/doors-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym modułem WASM (Rust).
 *
 * Zapewnia:
 * 1. Asynchroniczną lub natychmiastową inicjalizację modułu WASM w przeglądarce.
 * 2. Bezpieczną obsługę awaryjną (graceful fallback do TS, jeśli WASM nie został załadowany).
 * 3. Transparentne wywołanie calculateDoorsPlanWasm.
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart, BlokiHardware } from './01_bloki-types.js';
import { resolveHingeId, type NormalizedDoorsParams } from './05_doors-engine.js';
import { hingeFrontHolesMm } from '../B1_biblioteka/index.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import initWasm, { calculate_doors_plan_wasm } from '../src/wasm/doors/wasm_doors.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

// Eksponujemy flagę do window dla łatwego sprawdzenia w konsoli DevTools (F12)
if (typeof window !== 'undefined') {
    (window as any).__WASM_DOORS_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureDoorsWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                console.log('[WasmBridge] Inicjalizacja modułu WASM Doors...');
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: lime; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.error('[WasmBridge] BŁĄD inicjalizacji WASM:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isDoorsWasmReady(): boolean {
    return _wasmInitialized;
}

/**
 * Konwertuje wynik obliczeń z Rust/WASM do standardowego BlokiPlanResult
 */
export function callDoorsPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedDoorsParams,
    options?: {
        edgeBanding?: any;
        defaultLcs?: any;
        doorLRuleLcs?: any;
        doorRRuleLcs?: any;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) {
        return null;
    }
    const defaultLcs = options?.defaultLcs || {
        mapping: { X: 'x', Y: 'y', Z: 'z' },
        rotation: [0, 0, 0],
        faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
    };
    const edgeBanding = options?.edgeBanding || {
        '+X': { active: true, type_id: '0.008x0.022' },
        '-X': { active: true, type_id: '0.008x0.022' },
        '+Y': { active: true, type_id: '0.008x0.022' },
        '-Y': { active: true, type_id: '0.008x0.022' }
    };
    try {
        const wasmResult: any = calculate_doors_plan_wasm(dims, {
            rodzaj_drzwi: params.rodzaj_drzwi,
            grubosc_frontu_mm: params.grubosc_frontu_mm,
            szczelina_mm: params.szczelina_mm,
            nalozenie_gora_mm: params.nalozenie_gora_mm,
            nalozenie_dol_mm: params.nalozenie_dol_mm,
            nalozenie_lewe_mm: params.nalozenie_lewe_mm,
            nalozenie_prawe_mm: params.nalozenie_prawe_mm,
            domyslny_zawias_id: params.domyslny_zawias_id,
            aktywne_zawiasy: params.aktywne_zawiasy.map(h => {
                const hingeId = resolveHingeId(h.index, params.domyslny_zawias_id, params.szablony_zawiasow);
                return {
                    index: h.index,
                    pozycja_lokalna_z_mm: h.pozycja_lokalna_z_mm,
                    hinge_id: hingeId,
                    front_holes: hingeFrontHolesMm(hingeId).map(fh => ({
                        name: fh.name,
                        edge_dist: fh.edgeDist,
                        y_offset: fh.yOffset,
                        dia: fh.dia,
                        depth: fh.depth,
                        is_cup: fh.isCup
                    }))
                };
            })
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const parts: BlokiPart[] = wasmResult.parts.map((p: any) => {
            const side = p.side === 'left' ? 'left' : 'right';
            const nodeName = side === 'left' ? 'Drzwi_Lewe' : 'Drzwi_Prawe';
            const lcs = side === 'left' ? (options?.doorLRuleLcs || defaultLcs) : (options?.doorRRuleLcs || defaultLcs);

            // Filtrujemy cechy nawierceń dla tej konkretnej formatki
            const panelFeatures = (wasmResult.features || [])
                .filter((f: any) => f.side === side)
                .map((f: any) => {
                    const intent = buildHoleMachiningIntent({
                        targetNodeId: nodeName,
                        id: f.id,
                        face: 'FACE_Z_PLUS',
                        side: 'FACE_Z_PLUS',
                        template_id: undefined,
                        drivenBy: {
                            nodeId: `hinge_${f.side}_${f.hinge_index}`,
                            role: 'HARDWARE',
                            hardwareType: 'HINGE',
                            partKey: `Hinge_${f.side === 'left' ? 'L' : 'R'}${f.hinge_index}`,
                        },
                        rule: f.rule as any,
                        generatedBy: 'blok_doors',
                        u: f.u,
                        v: f.v,
                        diameter: f.diameter,
                        depth: f.depth,
                        sourcePartId: `Hinge_${f.side === 'left' ? 'L' : 'R'}${f.hinge_index}`,
                        extraParams: {
                            hinge_id: f.hinge_id,
                            isDoorCup: f.rule === 'cup',
                            isDoorScrew: f.rule === 'screw',
                            hingeIndex: f.hinge_index,
                            side: f.side,
                            hardwareId: `hinge_${f.side}_${f.hinge_index}`,
                            plate_id: params.typ_prowadnika,
                            plate_height_mm: params.typ_prowadnika === '173L6130' ? 3 : 0,
                        },
                    });
                    return intent.feature;
                });

            return {
                name: nodeName,
                role: 'FRONT',
                nodeType: 'PART',
                material: 'W1100_ST9_18',
                materialName: 'Biały Alpejski',
                materialCode: 'W1100 ST9',
                dim: { x: p.width, y: p.depth, z: p.height },
                loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
                lcs,
                edge_banding: options?.edgeBanding || edgeBanding,
                features: panelFeatures
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
                side: h.side,
                plateId: params.typ_prowadnika,
                plateHeightMm: params.typ_prowadnika === '173L6130' ? 3 : 0
            }
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_DOORS_DEBUG__) {
            (window as any).__WASM_DOORS_DEBUG__.callCount++;
            (window as any).__WASM_DOORS_DEBUG__.lastResult = wasmResult;
        }
        console.log(`%c[WasmBridge] calculate_doors_plan wykonane w WASM (Rust)! Frontów: ${parts.length}, Okuć: ${hardware.length}, Otworów: ${wasmResult.features?.length}`, 'color: #00e5ff; font-weight: bold;');

        return { parts, hardware };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_doors_plan_wasm:', e);
        return null;
    }
}

