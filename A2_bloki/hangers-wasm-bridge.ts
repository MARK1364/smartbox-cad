/**
 * A2_bloki/hangers-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem ZAWIESZEK (HANGERS) w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiHardware } from './01_bloki-types.js';
import type { HangersPlanParams, HangerSetDefinition } from './17_hangers-types.js';
import initWasm, { calculate_hangers_plan_wasm } from '../src/wasm/hangers/wasm_hangers.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
    (window as any).__WASM_HANGERS_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureHangersWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Hangers (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Hangers nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isHangersWasmReady(): boolean {
    return _wasmInitialized;
}

export function callHangersPlanWasm(
    dims: BlokiDimensions_mm,
    params: Required<HangersPlanParams>,
    setDef: HangerSetDefinition
): BlokiPlanResult | null {
    if (!_wasmInitialized) return null;
    try {
        const partsPayload = (setDef.parts || []).map((part: any, i: number) => ({
            id: part.id || `part_${i + 1}`,
            name: part.name || `Zawieszka_${i + 1}`,
            width_mm: Number(part.widthMm) || 20,
            height_mm: Number(part.heightMm) || 40,
            depth_mm: Number(part.depthMm) || 70,
            ref_x: String(part.refX || 'CENTER'),
            ref_y: String(part.refY || 'CENTER'),
            ref_z: String(part.refZ || 'CENTER'),
            offset_x_mm: Number(part.offsetX_mm) || 0,
            offset_y_mm: Number(part.offsetY_mm) || 0,
            offset_z_mm: Number(part.offsetZ_mm) || 0,
            frozen: Boolean(part.frozen),
        }));

        const wasmResult: any = calculate_hangers_plan_wasm(dims, {
            szablon_id: params.szablon_id,
            zestaw_id: setDef.id || params.zestaw_id,
            odsuniecie_bok_mm: params.odsuniecie_bok_mm,
            odsuniecie_tyl_mm: params.odsuniecie_tyl_mm,
            odsuniecie_gora_mm: params.odsuniecie_gora_mm,
            parts: partsPayload,
        });

        if (!wasmResult || !wasmResult.hardware) return null;

        const hardware: BlokiHardware[] = wasmResult.hardware.map((h: any, i: number) => {
            const originalPart = (setDef.parts || []).find((p: any) => p.id === h.part_id) || (setDef.parts || [])[i];
            const glbModel = originalPart?.glbPath || setDef.visual?.glb || '';

            return {
                id: h.id,
                name: h.name,
                role: 'HARDWARE',
                hardwareType: 'OTHER',
                hardwareId: setDef.id,
                loc: { x: h.loc.x, y: h.loc.y, z: h.loc.z },
                dim: { x: h.dim.x, y: h.dim.y, z: h.dim.z },
                params: {
                    glbModelPath: glbModel || undefined,
                    colorHex: originalPart?.colorHex || '#38bdf8',
                    partId: h.part_id,
                    setId: setDef.id,
                    templateId: params.szablon_id,
                },
                customProperties: {
                    part: originalPart,
                    setDefinition: setDef,
                },
            };
        });

        if (typeof window !== 'undefined' && (window as any).__WASM_HANGERS_DEBUG__) {
            (window as any).__WASM_HANGERS_DEBUG__.callCount++;
            (window as any).__WASM_HANGERS_DEBUG__.lastResult = wasmResult;
        }

        return { parts: [], hardware };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_hangers_plan_wasm:', e);
        return null;
    }
}

