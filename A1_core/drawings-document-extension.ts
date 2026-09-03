/**
 * Sekcja `extensions.drawings` — arkusze E1/E3 i układ E2.
 *
 * Live sync drawing.html (localStorage + BroadcastChannel) zostaje poza plikiem.
 * Miniatury base64 nie są zapisywane — regenerują się przy otwarciu arkusza.
 */

import type { DocumentExtension, ProjectDocument } from './project-document.js';
import { ExportEngine } from '../E1_export/export-engine.js';
import type { SavedExportView } from '../E1_export/export-types.js';
import { ExportEngineV3 } from '../E3_export/export-engine.js';

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
    document: ProjectDocument,
): void {
    const e1 = ExportEngine.instance;
    const e3 = ExportEngineV3.instance;

    if (!data) {
        e1.replaceSavedViews([]);
        e3.replaceSavedViews([]);
        return;
    }

    e1.replaceSavedViews(data.e1?.sheets ?? []);
    e3.replaceSavedViews(data.e3?.sheets ?? []);
}

export function attachDrawingsExtension(document: ProjectDocument): () => void {
    const extension: DocumentExtension = {
        serialize: () => serializeDrawings(),
        load: (data) => loadDrawings(data, document),
        includeInSnapshots: false,
    };
    return document.registerExtension(DRAWINGS_DOCUMENT_SECTION, extension);
}
