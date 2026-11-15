/**
 * A2_bloki/panels-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem BLEND / PANELI w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart } from './01_bloki-types.js';
import type { NormalizedPanelsParams } from './11_panels-engine.js';
import {
    PANEL_FRONT_LCS,
    PANEL_SHELF_LCS,
    PANEL_SIDE_L_LCS,
    PANEL_SIDE_R_LCS
} from './11_panels-engine.js';
import initWasm, { calculate_panels_plan_wasm } from '../src/wasm/panels/wasm_panels.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_PANELS_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensurePanelsWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Panels (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Panels nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isPanelsWasmReady(): boolean {
    return _wasmInitialized;
}

function resolveLcsForRole(role: string): any {
    switch (role) {
        case 'LEFT_SIDE_PANEL': return PANEL_SIDE_L_LCS;
        case 'RIGHT_SIDE_PANEL': return PANEL_SIDE_R_LCS;
        case 'TOP_PANEL': return PANEL_SHELF_LCS;
        case 'BOTTOM_PANEL': return PANEL_FRONT_LCS;
        default: return PANEL_FRONT_LCS;
    }
}

export function callPanelsPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedPanelsParams,
    options?: {
        edgeBanding?: any;
        edgeForRole?: (role: string) => any;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized) {
        return null;
    }
    const defEdge = options?.edgeBanding || {
        '+X': { active: true, type_id: '0.008x0.022' },
        '-X': { active: true, type_id: '0.008x0.022' },
        '+Y': { active: true, type_id: '0.008x0.022' },
        '-Y': { active: true, type_id: '0.008x0.022' }
    };
    const getEdge = (role: string) => options?.edgeForRole ? options.edgeForRole(role) : defEdge;
    try {
        const wasmResult: any = calculate_panels_plan_wasm(dims, {
            grubosc_blendy_mm: params.grubosc_blendy_mm,
            tryb_paneli_bocznych: params.tryb_paneli_bocznych,
            wlacz_lewy: params.wlacz_lewy,
            wlacz_prawy: params.wlacz_prawy,
            wlacz_gorny: params.wlacz_gorny,
            wlacz_dolny: params.wlacz_dolny,
            auto_glebokosc_lewy: params.auto_glebokosc_lewy,
            auto_glebokosc_prawy: params.auto_glebokosc_prawy,
            auto_glebokosc_gorny: params.auto_glebokosc_gorny,
            glebokosc_blendy_lewa_mm: params.glebokosc_blendy_lewa_mm,
            glebokosc_blendy_prawa_mm: params.glebokosc_blendy_prawa_mm,
            glebokosc_blendy_gora_mm: params.glebokosc_blendy_gora_mm,
            wysokosc_cokolu_mm: params.wysokosc_cokolu_mm,
            szczelina_cokolu_mm: params.szczelina_cokolu_mm,
            cofniecie_cokolu_mm: params.cofniecie_cokolu_mm,
            luz_lewy_mm: params.luz_lewy_mm,
            luz_prawy_mm: params.luz_prawy_mm,
            luz_gorny_mm: params.luz_gorny_mm,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const parts: BlokiPart[] = wasmResult.parts.map((p: any) => ({
            name: p.name,
            key: p.key,
            role: p.role,
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: p.dim.x, y: p.dim.y, z: p.dim.z },
            loc: { x: p.loc.x, y: p.loc.y, z: p.loc.z },
            lcs: resolveLcsForRole(p.role),
            edge_banding: getEdge(p.role),
            features: []
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_PANELS_DEBUG__) {
            (window as any).__WASM_PANELS_DEBUG__.callCount++;
            (window as any).__WASM_PANELS_DEBUG__.lastResult = wasmResult;
        }

        return { parts };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_panels_plan_wasm:', e);
        return null;
    }
}

