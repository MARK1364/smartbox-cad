import { ContextManager } from '../../A1_core/context-manager.js';
import { DrawingProjectExtractor } from '../../E3_export/drawing-project-extractor.js';
import { E3LibraryExtractor } from '../../E3_export';
import { syncGeometrySnapshots } from '../../E3_export/e3-geometry-snapshot.js';
import {
    writeModuleSession,
    openModulePage,
    persistProjectSnapshot,
    CAD_BRIDGE_CHANNEL,
    MODULE_REFRESH_MSG,
    MODULE_SESSION_UPDATED_MSG,
} from './session';
import {
    extractReportPayload,
    extractNestingPayload,
    extractCncPayload,
    extractDrawPayload,
} from './cad-extract';
import type { ModuleId, ModuleScope } from './types';

function getDoc(): any {
    return ContextManager.instance?.document;
}

function notifyModuleSessionUpdated(module: ModuleId): void {
    const msg = { type: MODULE_SESSION_UPDATED_MSG, module };
    try {
        const channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
        channel.postMessage(msg);
        channel.close();
    } catch { /* ignore */ }
}

/** Ponowna ekstrakcja z żywego ProjectDocument → localStorage sesji modułu. */
export function refreshModuleSessionFromCad(module: ModuleId, scope: ModuleScope): boolean {
    const doc = getDoc();
    if (!doc) return false;
    persistProjectSnapshot(doc);
    try {
        if (module === 'report') {
            writeModuleSession('report', extractReportPayload(scope, doc));
        } else if (module === 'nesting') {
            writeModuleSession('nesting', extractNestingPayload(scope, doc));
        } else if (module === 'cnc') {
            writeModuleSession('cnc', extractCncPayload(scope, doc));
        } else if (module === 'draw') {
            try {
                DrawingProjectExtractor.instance.syncLiveSceneTree();
                E3LibraryExtractor.instance.syncLibrary();
                syncGeometrySnapshots();
            } catch { /* ignore */ }
            writeModuleSession('draw', extractDrawPayload(scope, doc));
        } else {
            return false;
        }
        notifyModuleSessionUpdated(module);
        return true;
    } catch (e) {
        console.warn('Odświeżenie sesji modułu nieudane:', e);
        return false;
    }
}

/**
 * CAD: nasłuchuje próśb o odświeżenie danych z podstron (raport / nesting / …).
 */
export function installModuleRefreshBridge(): () => void {
    const onMessage = (ev: MessageEvent) => {
        const data = ev.data;
        if (!data || data.type !== MODULE_REFRESH_MSG || !data.module || !data.scope) return;
        refreshModuleSessionFromCad(data.module as ModuleId, data.scope as ModuleScope);
    };
    window.addEventListener('message', onMessage);

    let channel: BroadcastChannel | null = null;
    try {
        channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
        channel.onmessage = (ev) => {
            const data = ev.data;
            if (!data || data.type !== MODULE_REFRESH_MSG || !data.module || !data.scope) return;
            refreshModuleSessionFromCad(data.module as ModuleId, data.scope as ModuleScope);
        };
    } catch { /* ignore */ }

    return () => {
        window.removeEventListener('message', onMessage);
        try {
            channel?.close();
        } catch { /* ignore */ }
    };
}

export function openReportFromCad(scope: ModuleScope): void {
    persistProjectSnapshot(getDoc());
    const payload = extractReportPayload(scope, getDoc());
    writeModuleSession('report', payload);
    openModulePage('report');
}

export function openNestingFromCad(scope: ModuleScope): void {
    persistProjectSnapshot(getDoc());
    const payload = extractNestingPayload(scope, getDoc());
    writeModuleSession('nesting', payload);
    openModulePage('nesting');
}

export function openCncFromCad(scope: ModuleScope): void {
    try {
        const doc = getDoc();
        persistProjectSnapshot(doc);
        const payload = extractCncPayload(scope, doc);
        writeModuleSession('cnc', payload);
        openModulePage('cnc');
    } catch (e: any) {
        alert(e?.message || 'Nie udało się otworzyć CNC. Zaznacz formatkę.');
    }
}

export function openDrawFromCad(scope: ModuleScope): void {
    const doc = getDoc();
    persistProjectSnapshot(doc);
    try {
        DrawingProjectExtractor.instance.syncLiveSceneTree();
        E3LibraryExtractor.instance.syncLibrary();
        syncGeometrySnapshots();
    } catch (e) {
        console.warn('Draw sync:', e);
    }
    const payload = extractDrawPayload(scope, doc);
    writeModuleSession('draw', payload);
    openModulePage('draw');
}
