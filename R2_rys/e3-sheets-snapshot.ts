/**
 * Arkusze E3 Multi w snapshocie projektu (`smartpanel_project_current_v3`).
 * Most CAD ↔ karta e3_drawing.html. Nie jest to globalny magazyn między projektami.
 */

import { PROJECT_SNAPSHOT_KEY } from '../src/module-data/session.js';
import { storageAdapter } from '../src/storage/storage-adapter.js';
import type { E3SavedSheet } from './e3-library-types';

export const E3_SHEETS_UPDATED_MSG = 'SHEETS_UPDATED';

export interface E3MultiSheetsPayload {
    present: boolean;
    sheets: E3SavedSheet[];
    currentSheetId: string | null;
}

function cloneSheets(sheets: E3SavedSheet[] | undefined | null): E3SavedSheet[] {
    if (!Array.isArray(sheets)) return [];
    try {
        return JSON.parse(JSON.stringify(sheets));
    } catch {
        return [];
    }
}

function readSnapshotJson(): any | null {
    try {
        const raw = storageAdapter.getItem(PROJECT_SNAPSHOT_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function readE3MultiFromSnapshot(projectId?: string | null): E3MultiSheetsPayload | null {
    const json = readSnapshotJson();
    if (!json) return null;
    if (projectId && json.id !== projectId) return null;

    const e3 = json.extensions?.drawings?.e3;
    if (!e3 || !('multiSheets' in e3)) return null;

    return {
        present: true,
        sheets: cloneSheets(e3.multiSheets),
        currentSheetId: e3.currentSheetId ?? null,
    };
}

export function writeE3MultiToSnapshot(
    sheets: E3SavedSheet[],
    currentSheetId: string | null,
    projectId?: string | null,
): void {
    const json = readSnapshotJson();
    if (!json) return;
    if (projectId && json.id !== projectId) return;

    json.extensions = json.extensions && typeof json.extensions === 'object' ? json.extensions : {};
    const drawings = json.extensions.drawings && typeof json.extensions.drawings === 'object'
        ? json.extensions.drawings
        : { version: 1 };
    drawings.version = drawings.version || 1;
    drawings.e3 = {
        ...(drawings.e3 || {}),
        multiSheets: cloneSheets(sheets),
        currentSheetId: currentSheetId ?? null,
    };
    json.extensions.drawings = drawings;

    try {
        storageAdapter.setItem(PROJECT_SNAPSHOT_KEY, JSON.stringify(json));
    } catch (err) {
        console.warn('Nie udało się zapisać arkuszy E3 w snapshocie projektu:', err);
    }
}

export function broadcastE3SheetsUpdated(sheets: E3SavedSheet[], currentSheetId: string | null): void {
    try {
        const channel = new BroadcastChannel('bloki_cad_e3_sync');
        channel.postMessage({
            type: E3_SHEETS_UPDATED_MSG,
            sheets: cloneSheets(sheets),
            currentSheetId,
        });
        channel.close();
    } catch {
        /* BroadcastChannel niedostępny */
    }
}
