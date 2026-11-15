/**
 * A2_bloki/sliding-doors-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem DRZWI PRZESUWNYCH w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart } from './01_bloki-types.js';
import type { NormalizedSlidingDoorsParams } from './19_sliding-doors-engine.js';
import initWasm, { calculate_sliding_doors_plan_wasm } from '../src/wasm/sliding_doors/wasm_sliding_doors.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_SLIDING_DOORS_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureSlidingDoorsWasmInitialized(wasmBytes?: BufferSource): Promise<boolean> {
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
                console.log('%c[WasmBridge] Binarne silniki WASM Sliding Doors (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Sliding Doors nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isSlidingDoorsWasmReady(): boolean {
    return _wasmInitialized;
}

const FRONT_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' },
    rotation: [0, 0, 0] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

const FRONT_EDGE_BANDING = {
    '+X': { active: true, type_id: '0.008x0.022' },
    '-X': { active: true, type_id: '0.008x0.022' },
    '+Y': { active: true, type_id: '0.008x0.022' },
    '-Y': { active: true, type_id: '0.008x0.022' }
};

export function callSlidingDoorsPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedSlidingDoorsParams
): BlokiPlanResult | null {
    if (!_wasmInitialized) return null;
    try {
        const wasmResult: any = calculate_sliding_doors_plan_wasm(dims, {
            liczba_skrzydel: params.liczba_skrzydel,
            grubosc_frontu_mm: params.grubosc_frontu_mm,
            szczelina_mm: params.szczelina_mm,
            zaklad: params.zaklad,
            zakladka_mm: params.zakladka_mm,
            nalozenie_gora_mm: params.nalozenie_gora_mm,
            nalozenie_dol_mm: params.nalozenie_dol_mm,
            nalozenie_lewe_mm: params.nalozenie_lewe_mm,
            nalozenie_prawe_mm: params.nalozenie_prawe_mm,
            typ_rolki: params.typ_rolki,
            producent_rolek: params.producent_rolek,
            roller_id: params.roller_id,
            handle_id: params.handle_id,
            tor_gorny_wysokosc_mm: params.tor_gorny_wysokosc_mm,
            tor_gorny_glebokosc_mm: params.tor_gorny_glebokosc_mm,
            tor_gorny_cofniecie_mm: params.tor_gorny_cofniecie_mm,
            tor_dolny_wysokosc_mm: params.tor_dolny_wysokosc_mm,
            tor_dolny_glebokosc_mm: params.tor_dolny_glebokosc_mm,
            tor_dolny_cofniecie_mm: params.tor_dolny_cofniecie_mm,
            rozstaw_torow_mm: params.rozstaw_torow_mm,
            szerokosc_raczki_mm: params.szerokosc_raczki_mm,
            grubosc_raczki_mm: params.grubosc_raczki_mm,
            pokaz_rolki: params.pokaz_rolki,
            pokaz_raczki: params.pokaz_raczki,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const parts: BlokiPart[] = wasmResult.parts.map((p: any) => ({
            name: p.name,
            role: p.role,
            nodeType: 'PART',
            material: p.role === 'SLIDING_DOOR' ? 'W1100_ST9_18' : 'ALU_NATURAL',
            materialName: p.role === 'SLIDING_DOOR' ? 'Biały Alpejski' : 'Aluminium',
            materialCode: p.role === 'SLIDING_DOOR' ? 'W1100 ST9' : 'ALU',
            dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
            loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
            lcs: FRONT_LCS,
            edge_banding: p.role === 'SLIDING_DOOR' ? FRONT_EDGE_BANDING : undefined,
            meta: {
                sliding: true,
                track: p.track,
                leafIndex: p.leaf_index,
                phase: 1
            }
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_SLIDING_DOORS_DEBUG__) {
            (window as any).__WASM_SLIDING_DOORS_DEBUG__.callCount++;
            (window as any).__WASM_SLIDING_DOORS_DEBUG__.lastResult = wasmResult;
        }

        return { parts };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_sliding_doors_plan_wasm:', e);
        return null;
    }
}

