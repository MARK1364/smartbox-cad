/**
 * Sekcja `extensions.drawings` — arkusze E1/E3 i układ E2.
 *
 * Warstwa aplikacyjna: składa E1_export + R2_rys. A1_core nie importuje tych silników.
 * Live sync drawing.html (localStorage + BroadcastChannel) zostaje poza plikiem.
 * Miniatury base64 nie są zapisywane — regenerują się przy otwarciu arkusza.
 */

import type { DocumentExtension, ProjectDocument } from '../../A1_core/project-document.js';
import { clearLegacyExportStorage } from '../../A1_core/export-session-storage.js';
import { ExportEngine } from '../../E1_export/export-engine.js';
import type { SavedExportView } from '../../E1_export/export-types.js';
import { pruneAssemblyViews } from '../../I1_instrukcja/assembly-scene-adapter.js';
import { ExportEngineV3 } from '../../R2_rys/export-engine.js';

export const DRAWINGS_DOCUMENT_SECTION = 'drawings';
export const DRAWINGS_EXTENSION_VERSION = 1;

export interface DrawingsExtensionJSON {
    version: number;
    e1?: { sheets: SavedExportView[] };
    e3?: { sheets: SavedExportView[] };
}

function cloneSheets(views: SavedExportView[] | undefined | null): SavedExportView[] {
    if (!Array.isArray(views)) return [];
    return views.map((view) => {
        const { thumbnail, ...rest } = view;
        return {
            ...rest,
            titleBlock: { ...(view.titleBlock || {}) },
            cameraTarget: view.cameraTarget ? [...view.cameraTarget] as [number, number, number] : [0, 0, 0],
            nodePoses: Array.isArray(view.nodePoses)
                ? view.nodePoses.map((pose) => ({
                    nodeId: pose.nodeId,
                    translationNm: [...(pose.translationNm || [0, 0, 0])] as [number, number, number],
                    rotationQuat: [...(pose.rotationQuat || [0, 0, 0, 1])] as [number, number, number, number],
                    scale: pose.scale ? [...pose.scale] as [number, number, number] : undefined,
                }))
                : undefined,
            nodeVisibility: Array.isArray(view.nodeVisibility)
                ? view.nodeVisibility.map((item) => ({
                    nodeId: item.nodeId,
                    visible: item.visible !== false,
                }))
                : undefined,
        };
    });
}

function serializeDrawings(): DrawingsExtensionJSON {
    const e1 = ExportEngine.instance;
    const e3 = ExportEngineV3.instance;

    return {
        version: DRAWINGS_EXTENSION_VERSION,
        e1: { sheets: cloneSheets(e1.savedViews) },
        e3: { sheets: cloneSheets(e3.savedViews) },
    };
}

function loadDrawings(
    data: DrawingsExtensionJSON | null | undefined,
    document: ProjectDocument | null,
): void {
    const e1 = ExportEngine.instance;
    const e3 = ExportEngineV3.instance;

    if (!data) {
        e1.replaceSavedViews([]);
        e3.replaceSavedViews([]);
        return;
    }

    // Kadry instrukcji montażu (asm_*) są przypięte do szafek + fingerprintu projektu:
    // usunięty/zmodyfikowany korpus martwe asm_* kadry wypada już przy otwarciu.
    e1.replaceSavedViews(pruneAssemblyViews(data.e1?.sheets ?? [], document));
    e3.replaceSavedViews(data.e3?.sheets ?? []);
}

export function attachDrawingsExtension(document: ProjectDocument): () => void {
    clearLegacyExportStorage();
    const extension: DocumentExtension = {
        serialize: () => serializeDrawings(),
        load: (data) => loadDrawings(data, document),
        includeInSnapshots: false,
    };
    return document.registerExtension(DRAWINGS_DOCUMENT_SECTION, extension);
}
