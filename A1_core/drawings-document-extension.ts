/**
 * Sekcja `extensions.drawings` — arkusze E1/E3 i układ E2.
 *
 * Live sync drawing.html (localStorage + BroadcastChannel) zostaje poza plikiem.
 * Miniatury base64 nie są zapisywane — regenerują się przy otwarciu arkusza.
 */

import type { DocumentExtension, ProjectDocument } from './project-document.js';
import { ExportEngine } from '../E1_export/export-engine.js';
import type { SavedExportView } from '../E1_export/export-types.js';
import { ExportEngineV2 } from '../E2_export/export-engine-v2.js';
import { ExportEngineV3 } from '../E3_export/export-engine.js';

export const DRAWINGS_DOCUMENT_SECTION = 'drawings';
export const DRAWINGS_EXTENSION_VERSION = 1;

export interface DrawingsExtensionJSON {
    version: number;
    e1?: { sheets: SavedExportView[] };
    e2?: {
        paperFormat?: string;
        includePMI?: boolean;
        notes?: string;
        titleBlock?: Record<string, any>;
        placedModels?: Array<Record<string, any>>;
    };
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
    const e2 = ExportEngineV2.instance;
    const e3 = ExportEngineV3.instance;

    return {
        version: DRAWINGS_EXTENSION_VERSION,
        e1: { sheets: cloneSheets(e1.savedViews) },
        e3: { sheets: cloneSheets(e3.savedViews) },
        e2: {
            paperFormat: e2.paperFormat,
            includePMI: e2.includePMI,
            notes: e2.notes,
            titleBlock: { ...e2.titleBlock },
            placedModels: e2.serializePlacedModels(),
        },
    };
}

function loadDrawings(
    data: DrawingsExtensionJSON | null | undefined,
    document: ProjectDocument,
): void {
    const e1 = ExportEngine.instance;
    const e2 = ExportEngineV2.instance;
    const e3 = ExportEngineV3.instance;

    if (!data) {
        e1.replaceSavedViews([]);
        e3.replaceSavedViews([]);
        e2.restoreLayout(null, document);
        return;
    }

    e1.replaceSavedViews(data.e1?.sheets ?? []);
    e3.replaceSavedViews(data.e3?.sheets ?? []);
    e2.restoreLayout((data.e2 as any) ?? null, document);
}

export function attachDrawingsExtension(document: ProjectDocument): () => void {
    const extension: DocumentExtension = {
        serialize: () => serializeDrawings(),
        load: (data) => loadDrawings(data, document),
        includeInSnapshots: false,
    };
    return document.registerExtension(DRAWINGS_DOCUMENT_SECTION, extension);
}
