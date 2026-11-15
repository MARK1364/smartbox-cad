/**
 * A3_smartframe/smartframe-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem KORPUSÓW (SmartFrame) w WASM (Rust).
 */

import type {
    CabinetDimensions_mm,
    CabinetPlanResult,
    CabinetGeometryPart,
    CabinetLcsDefinition,
    NormalizedCabinetParams,
    ZoneLayout
} from './smartframe-types.js';
import initWasm, { calculate_cabinet_plan_wasm } from '../src/wasm/smartframe/wasm_smartframe.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_SMARTFRAME_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureSmartFrameWasmInitialized(moduleOrBuffer?: any): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm(moduleOrBuffer);
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM SmartFrame (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM SmartFrame nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isSmartFrameWasmReady(): boolean {
    return _wasmInitialized;
}

function resolveCabinetPartLcs(
    part: { role: string; key: string; name: string; lcs_rotation?: [number, number, number] },
    typKorpusu?: string,
    trybWienca?: string
): CabinetLcsDefinition {
    if (Array.isArray(part.lcs_rotation) && part.lcs_rotation.length === 3) {
        return {
            mapping: { X: 'x', Y: 'y', Z: 'z' },
            rotation: [part.lcs_rotation[0], part.lcs_rotation[1], part.lcs_rotation[2]],
            faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
        };
    }
    const isRogowy90 = typKorpusu?.includes('rogowy90') || typKorpusu?.includes('rogowy_90');
    switch (part.role) {
        case 'LEFT_SIDE_PANEL':
            if (isRogowy90 && part.key === 'BOK_L') {
                return {
                    mapping: { X: 'x', Y: 'z', Z: 'y' },
                    rotation: [0, 0, 0],
                    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
                };
            }
            return {
                mapping: { X: 'y', Y: 'x', Z: 'z' },
                rotation: [0, 0, -90],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            };
        case 'RIGHT_SIDE_PANEL':
            return {
                mapping: { X: 'y', Y: 'x', Z: 'z' },
                rotation: [0, 0, 90],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            };
        case 'BOTTOM_PANEL':
            return {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [90, 180, 0],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            };
        case 'TOP_PANEL':
            return {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [-90, 0, 0],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            };
        case 'TOP_TRAVERSE_FRONT':
        case 'TOP_TRAVERSE_BACK':
            if (trybWienca === 'TRAVERSE_V') {
                return {
                    mapping: { X: 'x', Y: 'z', Z: 'y' },
                    rotation: [180, 0, 0],
                    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
                };
            }
            return {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [-90, 0, 0],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            };
        case 'BACK_PANEL':
            if (part.key === 'PLECY_X') {
                return {
                    mapping: { X: 'y', Y: 'x', Z: 'z' },
                    rotation: [0, 0, -90],
                    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
                };
            }
            return {
                mapping: { X: 'x', Y: 'z', Z: 'y' },
                rotation: [180, 0, 0],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            };
        case 'BLIND_PANEL':
            return {
                mapping: { X: 'x', Y: 'z', Z: 'y' },
                rotation: [0, 0, 0],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            };
        case 'CORNER_NAILER':
            return {
                mapping: { X: 'y', Y: 'x', Z: 'z' },
                rotation: [0, 0, -90]
            };
        case 'CORNER_NAILER_2':
            return {
                mapping: { X: 'x', Y: 'z', Z: 'y' },
                rotation: [0, 0, 0]
            };
        default:
            return {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [0, 0, 0],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            };
    }
}

function resolveCabinetPartEdgeBanding(role: string): Record<string, { active: boolean; type_id: string }> {
    switch (role) {
        case 'LEFT_SIDE_PANEL':
            return {
                '+X': { active: true, type_id: '0.008x0.022' },
                '-X': { active: false, type_id: 'none' },
                '+Y': { active: true, type_id: '0.008x0.022' },
                '-Y': { active: true, type_id: '0.008x0.022' }
            };
        case 'RIGHT_SIDE_PANEL':
            return {
                '+X': { active: false, type_id: 'none' },
                '-X': { active: true, type_id: '0.008x0.022' },
                '+Y': { active: true, type_id: '0.008x0.022' },
                '-Y': { active: true, type_id: '0.008x0.022' }
            };
        case 'BOTTOM_PANEL':
        case 'TOP_PANEL':
        case 'TOP_TRAVERSE_FRONT':
        case 'TOP_TRAVERSE_BACK':
            return {
                '+X': { active: false, type_id: 'none' },
                '-X': { active: false, type_id: 'none' },
                '+Y': { active: false, type_id: 'none' },
                '-Y': { active: true, type_id: '0.008x0.022' }
            };
        default:
            return {
                '+X': { active: false, type_id: 'none' },
                '-X': { active: false, type_id: 'none' },
                '+Y': { active: false, type_id: 'none' },
                '-Y': { active: false, type_id: 'none' }
            };
    }
}

function normalizeWasmEdgeBanding(raw: any): Record<string, any> | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const obj = raw instanceof Map ? Object.fromEntries(raw.entries()) : raw;
    if (Object.keys(obj).length === 0) return undefined;
    return obj;
}

export function callCabinetPlanWasm(
    dims: CabinetDimensions_mm,
    params: NormalizedCabinetParams,
    options?: {
        gruboscPlytyMm?: number;
    }
): CabinetPlanResult | null {
    if (!_wasmInitialized) return null;
    try {
        let trybWienca = params.tryb_wienca_gornego;
        if (!trybWienca) {
            const legacy = (params as any).konstrukcja_wienca_gornego;
            if (legacy === 'TRAWERS_POZIOMO') trybWienca = 'TRAVERSE_H';
            else if (legacy === 'TRAWERS_PIONOWO') trybWienca = 'TRAVERSE_V';
            else trybWienca = 'FULL';
        }

        const wasmResult: any = calculate_cabinet_plan_wasm(dims, {
            typ_korpusu: params.typ_korpusu,
            liczba_stref: params.liczba_stref,
            wysokosc_strefy_dolnej_mm: params.wysokosc_strefy_dolnej_mm,
            wysokosc_strefy_srodkowej_mm: params.wysokosc_strefy_srodkowej_mm,
            cofniecie_plecow_mm: params.cofniecie_plecow_mm,
            grubosc_plecow_mm: params.grubosc_plecow_mm ?? (params as any).grubosc_materialu_mm,
            wpuszczenie_plecow_mm: params.wpuszczenie_plecow_mm,
            tryb_wienca_gornego: trybWienca,
            szerokosc_trawersu_mm: params.szerokosc_trawersu_mm,
            szerokosc_blendy_mm: params.szerokosc_blendy_mm,
            strona_blendy: params.strona_blendy,
            glebokosc_boku_lewego_mm: params.glebokosc_boku_lewego_mm,
            glebokosc_boku_prawego_mm: params.glebokosc_boku_prawego_mm,
            szerokosc_listwy_naroznej_mm: params.szerokosc_listwy_naroznej_mm,
            typ_listwy_naroznej: params.typ_listwy_naroznej,
            wysokosc_przod_mm: params.wysokosc_przod_mm,
            wysokosc_tyl_mm: params.wysokosc_tyl_mm,
            wysokosc_lewy_mm: params.wysokosc_lewy_mm,
            wysokosc_prawy_mm: params.wysokosc_prawy_mm,
            grubosc_plyty_mm: options?.gruboscPlytyMm ?? (params as any).grubosc_materialu_mm ?? 18,
            offsets: params.offsets && Object.keys(params.offsets).length > 0 ? params.offsets : undefined,
        });

        if (!wasmResult || !wasmResult.parts || !wasmResult.zones) return null;

        const parts: CabinetGeometryPart[] = wasmResult.parts.map((p: any) => {
            const customProperties: Record<string, any> = {};
            if (p.shape) {
                customProperties.shape = p.shape;
            } else if (p.outline2d && (params.typ_korpusu?.includes('rogowy90') || params.typ_korpusu?.includes('rogowy_90'))) {
                customProperties.shape = 'L_NOTCH';
            }
            if (p.outline2d) {
                customProperties.outline2d = p.outline2d;
            }
            if (p.back_groove_trapezoid) {
                customProperties.backGrooveTrapezoid = p.back_groove_trapezoid;
            }

            return {
                key: p.key,
                name: p.name,
                role: p.role,
                material: p.material,
                materialName: p.material_name,
                materialCode: p.material_code,
                thickness: p.thickness,
                dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
                loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
                zonePrefix: p.zone_prefix,
                zoneId: p.zone_id,
                customProperties,
                lcs: resolveCabinetPartLcs(p, params.typ_korpusu, trybWienca),
                edge_banding: normalizeWasmEdgeBanding(p.edge_banding) ?? resolveCabinetPartEdgeBanding(p.role)
            };
        });

        const zones: ZoneLayout[] = wasmResult.zones.map((z: any) => ({
            zoneKey: z.zone_key,
            size: z.size,
            baseOffset: z.base_offset
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_SMARTFRAME_DEBUG__) {
            (window as any).__WASM_SMARTFRAME_DEBUG__.callCount++;
            (window as any).__WASM_SMARTFRAME_DEBUG__.lastResult = wasmResult;
        }

        return { parts, zones };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_cabinet_plan_wasm:', e);
        return null;
    }
}