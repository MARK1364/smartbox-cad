import { buildMeshFromPanel } from './native_core/mesh_builder.js';
import { USE_WASM_BREP, callPanelBrepWasm, checkPanelBrepSupport, isPanelBrepWasmReady } from './panel-brep-wasm-bridge.js';

/**
 * Natywny budowniczy geometrii płyty:
 * - Główny silnik produkcyjny: Rust WebAssembly B-Rep (panel_brep).
 * - Cichy fallback jest całkowicie wyłączony: jeśli formatka kwalifikuje się do Rust B-Rep,
 *   a silnik WASM zawiedzie, rzucany jest natychmiastowy błąd (fail-fast).
 * - Stary silnik TS (mesh_builder.js) pozostaje w repozytorium do wglądu i obsługi
 *   konstrukcji jeszcze niezaimplementowanych w Rust (np. ramki aluminiowe ze szkłem, wałki).
 */
export class NativePanelBuilder {
    build(model: any) {
        let resultData: any = null;

        if (USE_WASM_BREP && isPanelBrepWasmReady()) {
            const support = checkPanelBrepSupport(model);
            if (support.supported) {
                resultData = callPanelBrepWasm(model);
                if (!resultData) {
                    const panelName = model.name || model.role || model.id || 'formatka';
                    throw new Error(`[Rust B-Rep Error] Silnik WASM panel_brep zwrócił błąd dla formatki "${panelName}" (${model.id}). Fallback do TS jest wyłączony!`);
                }
            } else {
                // Jawny log: dlaczego ten element idzie przez TS
                const panelName = model.name || model.role || model.id || 'formatka';
                console.info(`[B-Rep Engine] Formatka "${panelName}" obsługiwana przez moduł specjalny TS (powód: ${support.reason})`);
                resultData = buildMeshFromPanel(model);
            }
        } else {
            resultData = buildMeshFromPanel(model);
        }

        if (!resultData) {
            throw new Error(`[NativePanelBuilder] Brak wygenerowanej siatki dla formatki ${model.id}`);
        }

        const typedResult: Record<string, any> = {};
        for (const [name, dataRaw] of Object.entries(resultData)) {
            const data = dataRaw as { positions?: number[]; indices?: number[] };
            if (name === 'edges' || name === 'vertices') {
                typedResult[name] = dataRaw;
                continue;
            }
            if (data && data.positions && data.positions.length > 0) {
                const face: Record<string, unknown> = {
                    positions: new Float32Array(data.positions),
                    brepPositions: data.positions,
                    indices: new Uint32Array(data.indices || []),
                    normals: null
                };
                if ((data as { edgeKey?: string }).edgeKey) {
                    face.edgeKey = (data as { edgeKey?: string }).edgeKey;
                }
                typedResult[name] = face;
            }
        }
        return typedResult;
    }
}
