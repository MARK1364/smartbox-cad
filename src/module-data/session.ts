import type { ModuleId, AnyModulePayload } from './types';

export const MODULE_SESSION_KEYS: Record<ModuleId, string> = {
    report: 'CAD_MODULE_REPORT',
    nesting: 'CAD_MODULE_NESTING',
    cnc: 'CAD_MODULE_CNC',
    draw: 'CAD_MODULE_DRAW',
};

export const MODULE_PAGES: Record<ModuleId, string> = {
    report: './report.html',
    nesting: './nesting.html',
    cnc: './cnc.html',
    draw: './draw.html',
};

/** Nazwa okna CAD — powrót z CAM/modułów fokusuje tę kartę, bez nowego pustego projektu. */
export const CAD_WINDOW_NAME = 'SmartPanelCAD';

export const MODULE_WINDOW_NAMES: Record<ModuleId, string> = {
    report: 'SmartPanelReport',
    nesting: 'SmartPanelNesting',
    cnc: 'SmartPanelCNC',
    draw: 'SmartPanelDraw',
};

export const PROJECT_SNAPSHOT_KEY = 'smartpanel_project_current_v3';
export const CAD_RESTORE_FLAG = 'CAD_RESTORE_ON_LOAD';

/** postMessage / BroadcastChannel — CAD zamyka kartę modułu (self-close bywa blokowane). */
export const CAD_RETURN_MSG = 'smartpanel:return-to-cad';
export const CAD_BRIDGE_CHANNEL = 'smartpanel-cad-bridge';

/** Moduł prosi CAD o ponowną ekstrakcję z żywego ProjectDocument (SSOT). */
export const MODULE_REFRESH_MSG = 'smartpanel:refresh-module';
/** CAD zapisał świeżą sesję modułu — podstrona ma przeładować payload. */
export const MODULE_SESSION_UPDATED_MSG = 'smartpanel:module-session-updated';
/** CAD się odświeża / zamyka — wszystkie podstrony mają się zamknąć. */
export const CAD_SHUTDOWN_MSG = 'smartpanel:cad-shutdown';

const ALL_MODULES: ModuleId[] = ['report', 'nesting', 'cnc', 'draw'];

const LEGACY_NESTING_KEY = 'NESTING_SESSION_DATA';

type ModuleWindowMap = Partial<Record<ModuleId, Window | null>>;

function getModuleWindowStore(): ModuleWindowMap {
    const w = window as any;
    if (!w.__smartpanelModuleWindows) w.__smartpanelModuleWindows = {};
    return w.__smartpanelModuleWindows as ModuleWindowMap;
}

export function writeModuleSession<T extends AnyModulePayload>(module: ModuleId, payload: T): void {
    const key = MODULE_SESSION_KEYS[module];
    const raw = JSON.stringify(payload);
    localStorage.setItem(key, raw);
    if (module === 'nesting') {
        const nest = payload as any;
        localStorage.setItem(LEGACY_NESTING_KEY, JSON.stringify({
            parts: nest.parts,
            config: nest.config,
            selectedMaterial: nest.selectedMaterial || 'ALL',
            scope: nest.scope?.type,
            machineType: nest.config?.machineType || 'saw',
        }));
    }
}

export function readModuleSession<T>(module: ModuleId): T | null {
    const key = MODULE_SESSION_KEYS[module];
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch (e) {
        console.error(`Błąd odczytu sesji ${module}:`, e);
        return null;
    }
}

export function openModulePage(module: ModuleId): Window | null {
    const pageUrl = new URL(MODULE_PAGES[module], window.location.href).href;
    const opened = window.open(pageUrl, MODULE_WINDOW_NAMES[module]);
    getModuleWindowStore()[module] = opened;
    return opened;
}

/** CAD zamyka okno modułu — działa pewniej niż window.close() wewnątrz CNC. */
export function closeModuleWindow(module: ModuleId, opts?: { namedLookup?: boolean }): void {
    const store = getModuleWindowStore();
    const ref = store[module];
    if (ref && !ref.closed) {
        try {
            ref.close();
        } catch { /* ignore */ }
    }
    store[module] = null;

    if (opts?.namedLookup === false) return;

    try {
        const named = window.open('', MODULE_WINDOW_NAMES[module]);
        if (!named || named === window || named.closed) return;
        // Nie zamykaj świeżo utworzonego about:blank — tylko istniejące podstrony modułu
        let shouldClose = false;
        try {
            const path = named.location?.pathname || '';
            const page = MODULE_PAGES[module];
            shouldClose = path === page || path.endsWith(page) || path.includes(page.replace(/^\//, ''));
        } catch {
            shouldClose = false;
        }
        if (shouldClose) {
            try {
                named.close();
            } catch { /* ignore */ }
        } else {
            // Jeśli właśnie otworzyliśmy pustą kartę — zamknij ją
            try {
                if (named.location?.href === 'about:blank') named.close();
            } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
}

export function closeAllModuleWindows(opts?: { namedLookup?: boolean }): void {
    for (const module of ALL_MODULES) {
        closeModuleWindow(module, opts);
    }
}

export function persistProjectSnapshot(document: any): void {
    if (!document || typeof document.serialize !== 'function') return;
    try {
        const json = document.serialize();
        localStorage.setItem(PROJECT_SNAPSHOT_KEY, JSON.stringify(json));
    } catch (e) {
        console.warn('Nie udało się zapisać snapshotu projektu:', e);
    }
}

function broadcastCadShutdown(): void {
    const msg = { type: CAD_SHUTDOWN_MSG };
    try {
        const channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
        channel.postMessage(msg);
        channel.close();
    } catch { /* ignore */ }
}

/**
 * Instaluj w oknie CAD: powrót z modułów + zamknięcie podstron przy odświeżeniu CAD.
 */
export function installCadModuleBridge(): () => void {
    const onReturn = (data: any) => {
        if (!data || data.type !== CAD_RETURN_MSG) return;
        try {
            window.focus();
        } catch { /* ignore */ }
        if (data.module) closeModuleWindow(data.module as ModuleId);
    };

    const onMessage = (ev: MessageEvent) => onReturn(ev.data);
    window.addEventListener('message', onMessage);

    let channel: BroadcastChannel | null = null;
    try {
        channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
        channel.onmessage = (ev) => onReturn(ev.data);
    } catch { /* BroadcastChannel niedostępny */ }

    const onCadUnload = () => {
        broadcastCadShutdown();
        // Tylko znane referencje — bez window.open (nie twórz pustych kart przy F5)
        closeAllModuleWindows({ namedLookup: false });
    };
    window.addEventListener('pagehide', onCadUnload);
    window.addEventListener('beforeunload', onCadUnload);

    return () => {
        window.removeEventListener('message', onMessage);
        window.removeEventListener('pagehide', onCadUnload);
        window.removeEventListener('beforeunload', onCadUnload);
        try {
            channel?.close();
        } catch { /* ignore */ }
    };
}

/**
 * Podstrona modułu: nazwa okna + zamknięcie gdy CAD się odświeży / zamknie.
 */
export function installModulePageLifecycle(module: ModuleId): () => void {
    try {
        window.name = MODULE_WINDOW_NAMES[module];
    } catch { /* ignore */ }

    const closeSelf = () => {
        try {
            window.close();
        } catch { /* ignore */ }
        window.setTimeout(() => {
            if (window.closed) return;
            try {
                document.title = 'Zamknięto';
                document.body.innerHTML =
                    '<div style="font:600 14px Segoe UI,sans-serif;color:#94a3b8;display:flex;height:100vh;align-items:center;justify-content:center;background:#111;margin:0">'
                    + 'CAD zostało odświeżone — możesz zamknąć tę kartę.'
                    + '</div>';
            } catch { /* ignore */ }
        }, 80);
    };

    const onMessage = (ev: MessageEvent) => {
        if (ev.data?.type === CAD_SHUTDOWN_MSG) closeSelf();
    };
    window.addEventListener('message', onMessage);

    let channel: BroadcastChannel | null = null;
    try {
        channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
        channel.onmessage = (ev) => {
            if (ev.data?.type === CAD_SHUTDOWN_MSG) closeSelf();
        };
    } catch { /* ignore */ }

    // opener zniknął (CAD zamknięty / F5) — zamknij podstronę
    const openerWatch = window.setInterval(() => {
        try {
            if (window.opener && window.opener.closed) {
                closeSelf();
            }
        } catch { /* ignore */ }
    }, 1000);

    return () => {
        window.clearInterval(openerWatch);
        window.removeEventListener('message', onMessage);
        try {
            channel?.close();
        } catch { /* ignore */ }
    };
}

/**
 * Powrót z podstrony modułu do CAD:
 * prosi CAD o zamknięcie tej karty, fokusuje CAD, awaryjnie blankuje CNC.
 */
export function returnToCad(module: ModuleId = 'cnc'): void {
    const payload = { type: CAD_RETURN_MSG, module };

    try {
        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage(payload, '*');
            } catch { /* ignore */ }
            try {
                window.opener.focus();
            } catch { /* ignore */ }
        }
    } catch { /* ignore */ }

    try {
        const channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
        channel.postMessage(payload);
        channel.close();
    } catch { /* ignore */ }

    try {
        const existing = window.open('', CAD_WINDOW_NAME);
        if (existing && existing !== window) {
            try {
                existing.focus();
            } catch { /* ignore */ }
            try {
                existing.postMessage(payload, '*');
            } catch { /* ignore */ }
        }
    } catch { /* ignore */ }

    // Self-close (może być zablokowane) — CAD też zamyka przez referencję
    try {
        window.close();
    } catch { /* ignore */ }

    setTimeout(() => {
        if (window.closed) return;
        // Przeglądarka nie pozwoliła zamknąć — wyczyść zakładkę, żeby nie zostać w CNC
        try {
            document.title = 'Zamknięto — SmartPanel CNC';
            document.body.innerHTML =
                '<div style="font:600 14px Segoe UI,sans-serif;color:#94a3b8;display:flex;height:100vh;align-items:center;justify-content:center;background:#212121;margin:0">'
                + 'Wrócono do CAD. Możesz zamknąć tę kartę.'
                + '</div>';
            history.replaceState(null, '', '/');
        } catch {
            try {
                window.location.replace('about:blank');
            } catch { /* ignore */ }
        }
    }, 120);
}

/**
 * Podstrona prosi CAD o odświeżenie sesji z żywego SSOT (ProjectDocument).
 * CAD odpowiada zapisem localStorage + MODULE_SESSION_UPDATED_MSG.
 */
export function requestModuleRefresh(module: ModuleId, scope: { type: string; id: string; name: string }): void {
    const payload = { type: MODULE_REFRESH_MSG, module, scope };

    try {
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, '*');
        }
    } catch { /* ignore */ }

    try {
        const channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
        channel.postMessage(payload);
        channel.close();
    } catch { /* ignore */ }

    try {
        const cad = window.open('', CAD_WINDOW_NAME);
        if (cad && cad !== window && !cad.closed) {
            cad.postMessage(payload, '*');
        }
    } catch { /* ignore */ }
}

/** Po starcie CAD: jeśli wróciliśmy bez openersa — wczytaj ostatni snapshot. */
export function consumeCadRestoreFlag(): boolean {
    if (sessionStorage.getItem(CAD_RESTORE_FLAG) !== '1') return false;
    sessionStorage.removeItem(CAD_RESTORE_FLAG);
    return true;
}

export function readProjectSnapshot(): any | null {
    const raw = localStorage.getItem(PROJECT_SNAPSHOT_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}
