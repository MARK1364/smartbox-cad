/**
 * A2_bloki/led-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem PROFILI LED w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart } from './01_bloki-types.js';
import type { NormalizedLedInternalParams } from './13_led-internal-engine.js';
import type { NormalizedLedExternalParams } from './14_led-external-engine.js';
import initWasm, {
    calculate_led_internal_plan_wasm,
    calculate_led_external_plan_wasm
} from '../src/wasm/led/wasm_led.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_LED_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureLedWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM LED (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM LED nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isLedWasmReady(): boolean {
    return _wasmInitialized;
}

export function callLedInternalPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedLedInternalParams,
    options?: {
        libraryId?: string;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) return null;
    try {
        const wasmResult: any = calculate_led_internal_plan_wasm(dims, {
            wariant_led: params.wariant_led,
            profil_lewy: params.profil_lewy,
            profil_prawy: params.profil_prawy,
            profil_tyl: params.profil_tyl,
            odsuniecie_od_przodu_lewe_mm: params.odsuniecie_od_przodu_lewe_mm,
            odsuniecie_od_przodu_prawe_mm: params.odsuniecie_od_przodu_prawe_mm,
            odsuniecie_tyl_od_srodka_mm: params.odsuniecie_tyl_od_srodka_mm,
            odsuniecie_od_przodu_mm: params.odsuniecie_od_przodu_mm,
            szerokosc_wpustu_mm: params.szerokosc_wpustu_mm,
            glebokosc_wpustu_mm: params.glebokosc_wpustu_mm,
            odstep_gora_mm: params.odstep_gora_mm,
            odstep_dol_mm: params.odstep_dol_mm,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const parts: any[] = wasmResult.parts.map((p: any) => ({
            name: p.name,
            role: p.role,
            report_type: p.report_type,
            library_id: options?.libraryId || p.library_id,
            dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
            loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
            custom_properties: {
                material: p.material,
                shape: p.shape,
                is_bloki_child: true,
                glow_color: p.glow_color
            },
            features: []
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_LED_DEBUG__) {
            (window as any).__WASM_LED_DEBUG__.callCount++;
            (window as any).__WASM_LED_DEBUG__.lastResult = wasmResult;
        }

        return { parts };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_led_internal_plan_wasm:', e);
        return null;
    }
}

export function callLedExternalPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedLedExternalParams,
    options?: {
        name?: string;
        libraryId?: string;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) return null;
    try {
        const wasmResult: any = calculate_led_external_plan_wasm(dims, {
            odsuniecie_od_przodu_mm: params.odsuniecie_od_przodu_mm,
            szerokosc_wpustu_mm: params.szerokosc_wpustu_mm,
            glebokosc_wpustu_mm: params.glebokosc_wpustu_mm,
            frezuj_boki: params.frezuj_boki,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const parts: any[] = wasmResult.parts.map((p: any) => ({
            name: options?.name || p.name,
            role: p.role,
            report_type: p.report_type,
            library_id: options?.libraryId || p.library_id,
            dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
            loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
            custom_properties: {
                material: p.material,
                shape: p.shape,
                is_bloki_child: true,
                glow_color: p.glow_color
            },
            features: []
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_LED_DEBUG__) {
            (window as any).__WASM_LED_DEBUG__.callCount++;
            (window as any).__WASM_LED_DEBUG__.lastResult = wasmResult;
        }

        return { parts };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_led_external_plan_wasm:', e);
        return null;
    }
}

