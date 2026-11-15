/**
 * A2_bloki/corner-shelves-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem PÓŁEK NAROŻNYCH w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart, BlokiHardware } from './01_bloki-types.js';
import type { NormalizedCornerShelvesParams } from './18_corner-shelves-engine.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import initWasm, { calculate_corner_shelves_plan_wasm } from '../src/wasm/corner_shelves/wasm_corner_shelves.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_CORNER_SHELVES_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureCornerShelvesWasmInitialized(wasmBytes?: BufferSource): Promise<boolean> {
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
                console.log('%c[WasmBridge] Binarne silniki WASM Corner Shelves (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Corner Shelves nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isCornerShelvesWasmReady(): boolean {
    return _wasmInitialized;
}

export function callCornerShelvesPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedCornerShelvesParams,
    options?: {
        edgeBanding?: any;
        lcs?: any;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) return null;
    try {
        const wasmResult: any = calculate_corner_shelves_plan_wasm(dims, {
            liczba_polek: params.liczba_polek,
            grubosc_polki_mm: params.grubosc_polki_mm,
            odsuniecie_przod_mm: params.odsuniecie_przod_mm,
            luz_boczny_mm: params.luz_boczny_mm,
            bok_lewy_mm: params.bok_lewy_mm,
            bok_prawy_mm: params.bok_prawy_mm,
            wzor_nawiercen: params.wzor_nawiercen,
            rozstaw_potrojny_z_mm: params.rozstaw_potrojny_z_mm ?? 32,
            odstep_otworow_przod_mm: params.odstep_otworow_przod_mm ?? 40,
            odstep_otworow_tyl_mm: params.odstep_otworow_tyl_mm ?? 40,
            plecy_odsuniecie_x_mm: params.plecy_odsuniecie_x_mm ?? 0,
            plecy_odsuniecie_y_mm: params.plecy_odsuniecie_y_mm ?? 0,
            wyciecie_listwa_narozna: params.wyciecie_listwa_narozna ?? false,
            listwa_narozna_szerokosc_mm: params.listwa_narozna_szerokosc_mm ?? 0,
            listwa_narozna_grubosc_mm: params.listwa_narozna_grubosc_mm ?? 0,
            listwa_narozna_luz_mm: params.listwa_narozna_luz_mm ?? 0,
            podporka_id: params.podporka_id,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const defaultLcs = options?.lcs || {
            mapping: { X: 'x', Y: 'y', Z: 'z' },
            rotation: [90, 180, 0],
            faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
        };

        const defaultEdge = options?.edgeBanding || {
            "+X": { active: false, type_id: "none" },
            "-X": { active: false, type_id: "none" },
            "+Y": { active: false, type_id: "none" },
            "-Y": { active: true, type_id: "0.008x0.022" },
            "NOTCH": { active: true, type_id: "0.008x0.022" }
        };

        const parts: BlokiPart[] = wasmResult.parts.map((p: any, idx: number) => ({
            name: p.name,
            key: p.key ? String(p.key).toLowerCase() : `corner_shelf_${p.shelf_index || (idx + 1)}`,
            role: 'SHELF',
            report_type: 'SHELF',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
            loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
            lcs: defaultLcs,
            edge_banding: defaultEdge,
            customProperties: {
                shape: 'L_NOTCH',
                outline2d: p.outline2d,
                is_corner_shelf: true
            },
            features: []
        }));

        const hardware: BlokiHardware[] = (wasmResult.hardware || []).map((h: any) => ({
            id: h.id,
            name: h.name,
            hardwareType: h.hardware_type,
            hardwareId: h.hardware_id,
            side: h.side,
            loc: { x: h.loc.x, y: h.loc.y, z: h.loc.z },
            rotation: h.side === 'left' ? { x: -Math.PI / 2, y: 0, z: 0 } : { x: 0, y: 0, z: Math.PI / 2 },
            params: { shelfIndex: h.shelf_index, shelfKey: `corner_shelf_${h.shelf_index}`, side: h.side }
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_CORNER_SHELVES_DEBUG__) {
            (window as any).__WASM_CORNER_SHELVES_DEBUG__.callCount++;
            (window as any).__WASM_CORNER_SHELVES_DEBUG__.lastResult = wasmResult;
        }

        return { parts, hardware };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_corner_shelves_plan_wasm:', e);
        return null;
    }
}

