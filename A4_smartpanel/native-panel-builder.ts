import { buildMeshFromPanel } from './native_core/mesh_builder.js';

/**
 * Natywny budowniczy geometrii płyty (TypeScript + earcut).
 * Zwraca siatkę ścian, krawędzi i wierzchołków do PanelView.
 */
export class NativePanelBuilder {
    build(model: any) {
        const resultData = buildMeshFromPanel(model);
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
