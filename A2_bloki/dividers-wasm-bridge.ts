/**
 * A2_bloki/dividers-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem PRZEGRÓD w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart } from './01_bloki-types.js';
import { dividerSlopedHeightAtX, type NormalizedDividersParams } from './10_dividers-engine.js';
import initWasm, { calculate_dividers_plan_wasm } from '../src/wasm/dividers/wasm_dividers.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_DIVIDERS_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureDividersWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Dividers (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #06b6d4; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Dividers nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isDividersWasmReady(): boolean {
    return _wasmInitialized;
}

export function callDividersPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedDividersParams,
    options: {
        edgeBanding: any;
        lcs: any;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) {
        return null;
    }
    try {
        const wasmResult: any = calculate_dividers_plan_wasm(dims, {
            liczba_przegrod: params.liczba_przegrod,
            grubosc_przegrody_mm: params.grubosc_przegrody_mm,
            tryb_rozstawu: params.tryb_rozstawu,
            szerokosci_wnek_mm: params.szerokosci_wnek_mm,
            dach_kat_deg: params.dach_kat_deg,
            przesuniecie_strefy_x_mm: params.przesuniecie_strefy_x_mm,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const isSloped = Number.isFinite(params.dach_kat_deg) && Math.abs(params.dach_kat_deg) >= 0.05;

        const parts: BlokiPart[] = wasmResult.parts.map((p: any) => {
            const h_mm = isSloped
                ? dividerSlopedHeightAtX(
                    p.loc.x,
                    dims.height_mm,
                    params.grubosc_przegrody_mm,
                    params.dach_kat_deg,
                    params.przesuniecie_strefy_x_mm
                )
                : p.dim.x;
            const z_mm = isSloped ? h_mm / 2 : p.loc.z;
            return {
                name: p.name,
                key: p.key,
                role: 'DIVIDER_PLATE',
                nodeType: 'PART',
                material: 'W1100_ST9_18',
                materialName: 'Biały Alpejski',
                materialCode: 'W1100 ST9',
                dim: { x: h_mm, y: p.dim.y, z: p.dim.z },
                loc: { x: p.loc.x, y: p.loc.y, z: z_mm },
                lcs: options.lcs,
                edge_banding: options.edgeBanding,
                features: []
            };
        });

        if (typeof window !== 'undefined' && (window as any).__WASM_DIVIDERS_DEBUG__) {
            (window as any).__WASM_DIVIDERS_DEBUG__.callCount++;
            (window as any).__WASM_DIVIDERS_DEBUG__.lastResult = wasmResult;
        }
        console.log(`%c[WasmBridge] calculate_dividers_plan wykonane w WASM (Rust)! Przegród: ${parts.length}`, 'color: #06b6d4; font-weight: bold;');

        return { parts };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_dividers_plan_wasm:', e);
        return null;
    }
}

