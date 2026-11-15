/**
 * A2_bloki/shelves-wasm-bridge.ts
 *
 * Mostek (Bridge) między światem JS/TS a binarnym silnikiem PÓŁEK w WASM (Rust).
 */

import type { BlokiDimensions_mm, BlokiPlanResult, BlokiPart, BlokiHardware } from './01_bloki-types.js';
import type { NormalizedShelvesParams } from './04_shelves-engine.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import initWasm, { calculate_shelves_plan_wasm } from '../src/wasm/shelves/wasm_shelves.js';

let _wasmInitialized = false;
let _wasmInitPromise: Promise<void> | null = null;

// Eksponujemy flagę do window dla łatwego sprawdzenia w konsoli DevTools (F12)
if (typeof window !== 'undefined') {
    (window as any).__WASM_SHELVES_DEBUG__ = {
        isReady: () => _wasmInitialized,
        callCount: 0,
        lastResult: null,
    };
}

export async function ensureShelvesWasmInitialized(): Promise<boolean> {
    if (_wasmInitialized) return true;
    if (!_wasmInitPromise) {
        _wasmInitPromise = (async () => {
            try {
                await initWasm();
                _wasmInitialized = true;
                console.log('%c[WasmBridge] Binarne silniki WASM Shelves (Rust) pomyślnie zainicjalizowane i aktywne!', 'color: #10b981; font-weight: bold; font-size: 14px;');
            } catch (err) {
                console.warn('[WasmBridge] Inicjalizacja WASM Shelves nie powiodła się, fallback do TS:', err);
                _wasmInitialized = false;
            }
        })();
    }
    await _wasmInitPromise;
    return _wasmInitialized;
}

export function isShelvesWasmReady(): boolean {
    return _wasmInitialized;
}

export function callShelvesPlanWasm(
    dims: BlokiDimensions_mm,
    params: NormalizedShelvesParams,
    options: {
        edgeBanding: any;
        lcs: any;
    }
): BlokiPlanResult | null {
    if (!_wasmInitialized || (params.pozycje_polek_z_mm && params.pozycje_polek_z_mm.length > 0)) {
        return null;
    }
    try {
        const wasmResult: any = calculate_shelves_plan_wasm(dims, {
            liczba_polek: params.liczba_polek,
            grubosc_polki_mm: params.grubosc_polki_mm,
            odsuniecie_przod_mm: params.odsuniecie_przod_mm,
            luz_boczny_mm: params.luz_boczny_mm,
            wzor_nawiercen: params.wzor_nawiercen,
            odstep_otworow_przod_mm: params.odstep_otworow_przod_mm,
            odstep_otworow_tyl_mm: params.odstep_otworow_tyl_mm,
            otwory_przod_aktywne: params.otwory_przod_aktywne,
            przesuniecie_otworow_przod_x_mm: params.przesuniecie_otworow_przod_x_mm,
            otwory_tyl_aktywne: params.otwory_tyl_aktywne,
            przesuniecie_otworow_tyl_x_mm: params.przesuniecie_otworow_tyl_x_mm,
            rozstaw_potrojny_z_mm: params.rozstaw_potrojny_z_mm,
            rozstaw_system32_mm: params.rozstaw_system32_mm,
            start_system32_z_mm: params.start_system32_z_mm,
            liczba_otworow_system32: params.liczba_otworow_system32,
            podporka_id: params.podporka_id,
        });

        if (!wasmResult || !wasmResult.parts) return null;

        const parts: BlokiPart[] = wasmResult.parts.map((p: any) => {
            const panelFeatures = (wasmResult.features || [])
                .filter((f: any) => f.shelf_index === p.shelf_index)
                .map((f: any) => {
                    const hwId = f.hw_suffix ? `shelf_${p.shelf_index}_pin_${f.hw_suffix}` : undefined;
                    const intent = buildHoleMachiningIntent({
                        id: f.id,
                        name: f.name,
                        face: f.face as any,
                        u_mm: f.u_mm,
                        v_mm: f.v_mm,
                        diameter_mm: f.diameter_mm,
                        depth_mm: f.depth_mm,
                        rule: 'shelf_pin',
                        ownerTag: 'isShelfDrilling',
                        drivenBy: hwId ? { nodeId: hwId, role: 'HARDWARE', hardwareType: 'SHELF_PIN' } : undefined,
                        sourcePartId: hwId,
                        generatedBy: 'blok_shelves',
                        extraParams: {
                            template_id: params.wzor_nawiercen,
                            shelfZ: p.loc.z,
                            is_assembly_drilling: true
                        }
                    });
                    const feat = intent.feature as any;
                    feat.is_assembly_drilling = true;
                    feat.visible = false;
                    return feat;
                });

            return {
                name: p.name,
                key: p.key ? String(p.key).toLowerCase() : `shelf_${p.shelf_index}`,
                role: 'SHELF_PANEL',
                nodeType: 'PART',
                material: 'W1100_ST9_18',
                materialName: 'Biały Alpejski',
                materialCode: 'W1100 ST9',
                dim: p.dim,
                loc: p.loc,
                lcs: options.lcs,
                edge_banding: options.edgeBanding,
                features: panelFeatures
            };
        });

        const hardware: BlokiHardware[] = (wasmResult.hardware || []).map((h: any) => ({
            id: h.id,
            name: h.name,
            hardwareType: 'SHELF_PIN',
            hardwareId: h.hardware_id,
            loc: h.loc,
            params: {
                shelfIndex: h.shelf_index,
                shelfKey: `shelf_${h.shelf_index}`,
                pinType: params.podporka_id
            }
        }));

        if (typeof window !== 'undefined' && (window as any).__WASM_SHELVES_DEBUG__) {
            (window as any).__WASM_SHELVES_DEBUG__.callCount++;
            (window as any).__WASM_SHELVES_DEBUG__.lastResult = wasmResult;
        }
        console.log(`%c[WasmBridge] calculate_shelves_plan wykonane w WASM (Rust)! Półek: ${parts.length}, Okuć podpórek: ${hardware.length}`, 'color: #10b981; font-weight: bold;');

        return { parts, hardware };
    } catch (e) {
        console.error('[WasmBridge] Błąd wykonania calculate_shelves_plan_wasm:', e);
        return null;
    }
}

