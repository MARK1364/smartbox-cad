/**
 * Sekcja `extensions.materials` — overlay katalogu użytego w projekcie.
 *
 * Pełna baza zostaje w smart_panel_V1.json. Do pliku trafiają tylko materiały
 * i okleiny, do których odwołują się formatki w drzewie.
 */

import type { DocumentExtension, ProjectDocument } from '../A1_core/project-document.js';
import { isPanelModel } from '../A1_core/domain-data.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import type { EdgeBandingType, MaterialItem } from './material-types.js';
import { materialDatabase } from './material-database.js';

export const MATERIALS_DOCUMENT_SECTION = 'materials';
export const MATERIALS_EXTENSION_VERSION = 1;

export interface MaterialsExtensionJSON {
    version: number;
    materials: MaterialItem[];
    edgeBandings: EdgeBandingType[];
}

function stubFromPanelData(data: { materialId: string; materialName?: string; materialCode?: string; thickness: number; color?: MaterialItem['color'] }): MaterialItem {
    return {
        id: data.materialId,
        name: data.materialName || data.materialId,
        code: data.materialCode || '',
        category: 'Projekt',
        thickness_mm: nmToMm(data.thickness) || 18,
        density_kg_m3: 680,
        color: data.color || { r: 0.95, g: 0.95, b: 0.95 },
    };
}

function rememberMaterial(
    materialsById: Map<string, MaterialItem>,
    id: string,
    database: typeof materialDatabase,
    stub?: MaterialItem | null,
): void {
    if (!id || materialsById.has(id)) return;
    const fromDb = database.getMaterialById(id);
    if (fromDb) {
        materialsById.set(id, { ...fromDb, color: { ...fromDb.color } });
        return;
    }
    if (stub) materialsById.set(id, stub);
}

export function collectUsedMaterials(
    document: ProjectDocument,
    database = materialDatabase,
): MaterialsExtensionJSON {
    const materialsById = new Map<string, MaterialItem>();
    const edgeById = new Map<string, EdgeBandingType>();

    for (const node of document.getPanels()) {
        const data = node.domainData;
        if (!data || !isPanelModel(data)) continue;

        if (data.materialId) {
            rememberMaterial(
                materialsById,
                data.materialId,
                database,
                stubFromPanelData(data),
            );
        }

        const banding = data.edgeBanding || {};
        for (const edge of Object.values(banding) as any[]) {
            if (!edge || typeof edge !== 'object') continue;
            if (edge.material_id) {
                rememberMaterial(materialsById, edge.material_id, database);
            }
            const edgeId = edge.type_id;
            if (!edgeId || edgeId === 'none' || edgeById.has(edgeId)) continue;
            const fromDb = database.getEdgeBandingById(edgeId);
            edgeById.set(edgeId, fromDb
                ? { ...fromDb }
                : { id: edgeId, name: edge.name || edgeId, thickness_mm: 0.8, width_mm: 22 });
        }
    }

    const materials = [...materialsById.values()].sort((a, b) => a.id.localeCompare(b.id));
    const edgeBandings = [...edgeById.values()].sort((a, b) => a.id.localeCompare(b.id));

    return {
        version: MATERIALS_EXTENSION_VERSION,
        materials,
        edgeBandings,
    };
}

export function attachMaterialsExtension(document: ProjectDocument): () => void {
    const extension: DocumentExtension = {
        serialize: () => collectUsedMaterials(document),
        load: (data: MaterialsExtensionJSON | null) => {
            if (!data) return;
            materialDatabase.mergeOverlay(data);
        },
        includeInSnapshots: false,
    };
    return document.registerExtension(MATERIALS_DOCUMENT_SECTION, extension);
}
