/**
 * A2_bloki/flaps-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem KLAP w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart, BlokiHardware } from './01_bloki-types.js';
import type { NormalizedFlapsParams } from './12_flaps-engine.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import initWasm, { calculate_flaps_plan_wasm } from '../src/wasm/flaps/wasm_flaps.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_FLAPS_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureFlapsWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Flaps (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #f59e0b; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Flaps nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isFlapsWasmReady(): boolean {
    return _wasmInitialized;
}

export function callFlapsPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedFlapsParams,
    options: {
        edgeBanding: any;
        lcs: any;
        role: string;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) {
        return null;
    }
    try {
        const wasmResult: any = calculate_flaps_plan_wasm(dims, {
            kierunek_klapy: params.kierunek_klapy,
            grubosc_frontu_mm: params.grubosc_frontu_mm,
            nalozenie_gora_mm: params.nalozenie_gora_mm,
            nalozenie_dol_mm: params.nalozenie_dol_mm,
            nalozenie_lewe_mm: params.nalozenie_lewe_mm,
            nalozenie_prawe_mm: params.nalozenie_prawe_mm,
            odsuniecie_zawiasu_lewe_mm: params.odsuniecie_zawiasu_lewe_mm,
            odsuniecie_zawiasu_prawe_mm: params.odsuniecie_zawiasu_prawe_mm,
            zawias_srodkowy: params.zawias_srodkowy,
            szablon_zawiasu_domyslny: params.szablon_zawiasu_domyslny,
            szablon_zawiasu_lewy: params.szablon_zawiasu_lewy,
            szablon_zawiasu_prawy: params.szablon_zawiasu_prawy,
            szablon_zawiasu_srodkowy: params.szablon_zawiasu_srodkowy,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const isTop = params.kierunek_klapy !== 'BOTTOM';

        const features = (wasmResult.features || []).map((f: any) => {
            const isCup = f.is_cup;
            const intent = buildHoleMachiningIntent({
                targetNodeId: 'Klapa',
                id: f.id,
                face: 'FACE_Z_PLUS',
                side: 'FACE_Z_PLUS',
                template_id: undefined,
                drivenBy: {
                    nodeId: `hinge_${f.hinge_key.toLowerCase()}`,
                    role: 'HARDWARE',
                    hardwareType: 'HINGE',
                    partKey: f.hinge_key,
                },
                rule: isCup ? 'cup' : 'screw',
                generatedBy: 'blok_flaps',
                u: f.u,
                v: f.v,
                diameter: f.diameter,
                depth: f.depth,
                sourcePartId: f.hinge_key,
                extraParams: {
                    hinge_id: f.hinge_id,
                    isFlapCup: isCup,
                    isFlapScrew: !isCup,
                    hingeKey: f.hinge_key,
                    hingeSide: f.side,
                    side: f.side,
                    orientation: isTop ? 'top' : 'bottom',
                    hardwareId: `hinge_${f.hinge_key.toLowerCase()}`,
                },
            });
            return intent.feature;
        });

        const p = wasmResult.parts[0];
        const parts: BlokiPart[] = [{
            name: 'Klapa',
            role: (options.role as any) || 'FLAP',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
            loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
            lcs: options.lcs,
            edge_banding: options.edgeBanding,
            features
        }];

        const hardware: BlokiHardware[] = (wasmResult.hardware || []).map((h: any) => ({
            id: h.id,
            name: h.name,
            hardwareType: 'HINGE',
            hardwareId: h.hardware_id,
            side: h.side,
            loc: { x: h.loc.x, y: h.loc.y, z: h.loc.z },
            params: {
                hingeKey: h.hinge_key,
                side: h.side,
                isTop: h.is_top
            }
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_FLAPS_DEBUG__) {
            (window as any).__WASM_FLAPS_DEBUG__.callCount++;
            (window as any).__WASM_FLAPS_DEBUG__.lastResult = wasmResult;
        }
        console.log(`%c[WasmBridge] calculate_flaps_plan wykonane w WASM (Rust)! Otworów: ${features.length}, Okuć: ${hardware.length}`, 'color: #f59e0b; font-weight: bold;');

        return { parts, hardware };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_flaps_plan_wasm:', e);
        return null;
    }
}

