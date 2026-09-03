import { buildMeshFromPanel } from './native_core/mesh_builder.js';

/**
 * SmartPanel Web — Native Panel Builder
 * 
 * Alternatywny (lekki) budowniczy geometrii, który operuje wyłącznie w czystym JavaScript/TypeScript.
 * Nie importuje jądra C++ (OCCT), przez co ładuje się natychmiast.
 * Tnie płaskie ściany z wykorzystaniem biblioteki "earcut" i nadaje im grubość (ekstruzja).
 */
export class NativePanelBuilder {
    faceMap: Map<any, any> = new Map();
    featureMap: Map<any, any> = new Map();

    constructor() {
        this.faceMap = new Map();
        this.featureMap = new Map();
    }

    /**
     * Buduje geometrię płyty na podstawie modelu domenowego.
     * @param {import('./panel-model.js').PanelModel} model
     * @returns {Object} Słownik z tablicami positions i indices dla każdej ściany
     */
    build(model: any) {
        // buildMeshFromPanel zwraca dokładnie ten sam format danych co _tessellateAndExtract w OCCT
        const resultData = buildMeshFromPanel(model);

        // Konwersja na Typed Arrays dla zgodności w 100% z OCCT (które zwraca Float32Array)
        const typedResult: Record<string, any> = {};
        for (const [name, dataRaw] of Object.entries(resultData)) {
            const data = dataRaw as { positions?: number[]; indices?: number[] };
            if (name === 'edges' || name === 'vertices') {
                typedResult[name] = dataRaw;
                continue;
            }
            if (data && data.positions && data.positions.length > 0) {
                typedResult[name] = {
                    positions: new Float32Array(data.positions),
                    indices: new Uint32Array(data.indices || []),
                    normals: null // normalne przeliczy BABYLON.VertexData.ComputeNormals w widoku
                };
            }
        }

        return typedResult;
    }
}
