import { ContextManager } from '../../A1_core/context-manager.js';
import { DrawingProjectExtractor } from '../../R2_rys/drawing-project-extractor.js';
import { E3LibraryExtractor } from '../../R2_rys';
import { syncGeometrySnapshots } from '../../R2_rys/e3-geometry-snapshot.js';
import {
    writeModuleSession,
    openModulePage,
    persistProjectSnapshot,
    readProjectSnapshot,
    readModuleSession,
    CAD_BRIDGE_CHANNEL,
    MODULE_REFRESH_MSG,
    MODULE_SYNC_MSG,
    MODULE_SESSION_UPDATED_MSG,
} from './session';
import {
    extractReportPayload,
    extractNestingPayload,
    extractCncPayload,
    extractDrawPayload,
    extractDagPayload,
    extractInstrukcjaPayload,
} from './cad-extract';
import type { ModuleId, ModuleScope, SmartPartsModulePayload } from './types';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

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
        } else if (module === 'dag') {
            writeModuleSession('dag', extractDagPayload(scope, doc));
        } else if (module === 'instrukcja') {
            writeModuleSession('instrukcja', extractInstrukcjaPayload(scope, doc));
        } else if (module === 'smartparts') {
            // Studio nie ekstrahuje geometrii projektu — sesja to tylko meta + opcjonalne packageId
            const prev = readModuleSession<any>('smartparts');
            writeModuleSession('smartparts', {
                meta: {
                    module: 'smartparts',
                    sourceId: 'cad',
                    loadedAt: new Date().toISOString(),
                    originLabel: scope.name || 'SmartParts Studio',
                },
                scope,
                packageId: prev?.packageId,
            });
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
 * CAD: nasłuchuje próśb o odświeżenie danych z podstron (raport / nesting / …)
 * oraz synchronizacji projektu z podstrony Instrukcja (PMI/kamera).
 */
export function installModuleRefreshBridge(): () => void {
    const syncProjectFromSnapshot = (data: any): void => {
        if (!data || data.type !== MODULE_SYNC_MSG || data.module !== 'instrukcja') return;
        const snap = readProjectSnapshot();
        const doc = ContextManager.instance?.document;
        if (!snap || !doc) return;
        try {
            doc.load(snap);
            (window as any).__rebuildGeometry?.('Projekt zsynchronizowany z Instrukcją montażu');
        } catch (e) {
            console.warn('[module] Sync projektu z instrukcji nieudany:', e);
        }
    };
    const onMessage = (ev: MessageEvent) => {
        const data = ev.data;
        syncProjectFromSnapshot(data);
        if (!data || data.type !== MODULE_REFRESH_MSG || !data.module || !data.scope) return;
        refreshModuleSessionFromCad(data.module as ModuleId, data.scope as ModuleScope);
    };
    window.addEventListener('message', onMessage);

    let channel: BroadcastChannel | null = null;
    try {
        channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
        channel.onmessage = (ev) => {
            const data = ev.data;
            syncProjectFromSnapshot(data);
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
        alert(e?.message || tx(srcTekst, 'moddata.cnc_no_panel', TX_NS));
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

export function openDagFromCad(scope: ModuleScope): void {
    const doc = getDoc();
    persistProjectSnapshot(doc);
    const payload = extractDagPayload(scope, doc);
    writeModuleSession('dag', payload);
    openModulePage('dag');
}

/** Instrukcja montażu (I1) — podstrona jak CNC, plan liczony z żywego dokumentu. */
export function openInstrukcjaFromCad(scope: ModuleScope): void {
    try {
        const doc = getDoc();
        persistProjectSnapshot(doc);
        const payload = extractInstrukcjaPayload(scope, doc);
        writeModuleSession('instrukcja', payload);
        openModulePage('instrukcja');
    } catch (e: any) {
        alert(e?.message || tx(srcTekst, 'moddata.instrukcja_origin', TX_NS));
    }
}

/**
 * Otwiera SmartParts Studio w osobnym oknie (jak CNC / nesting).
 * Definicje żyją w katalogu A5 (localStorage) — sesja niesie tylko opcjonalne packageId.
 */
export function openSmartPartsStudioFromCad(opts?: {
    scope?: ModuleScope;
    packageId?: string;
}): void {
    const scope: ModuleScope = opts?.scope || {
        type: 'PROJECT',
        id: 'project',
        name: 'Projekt',
    };
    const payload: SmartPartsModulePayload = {
        meta: {
            module: 'smartparts',
            sourceId: 'cad',
            loadedAt: new Date().toISOString(),
            originLabel: scope.name || 'SmartParts Studio',
        },
        scope,
        packageId: opts?.packageId,
    };
    writeModuleSession('smartparts', payload);
    openModulePage('smartparts');
}
