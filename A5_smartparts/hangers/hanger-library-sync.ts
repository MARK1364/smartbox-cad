/**
 * Dwukierunkowy sync listy zawieszek SmartPart:
 * - dysk B1_biblioteka/zawieszki (Vite API na żywo)
 * - localStorage Studio
 *
 * Eager glob Vite nie widzi skasowanych plików — lista custom idzie z /api/b1-zawieszki.
 */

import {
    CAD_SMARTPARTS_CHANGED,
    deleteSmartPartPackage,
    listSmartPartPackages,
    SMARTPARTS_STORAGE_KEY,
} from '../../S5_studio/index.js';
import { listHangers } from '../../B1_biblioteka/index.js';

/** Ten sam klucz co smartparts-catalog (bez importu cyklicznego). */
function dedupKey(id: string, name?: string): string {
    return `${id || ''} ${name || ''}`
        .toLowerCase()
        .replace(/^sp:/, '')
        .replace(/\.json$/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function looksLikeFolderSmartPart(hw: any): boolean {
    return Boolean(
        hw?.definition?.mainContainer
        || hw?.seriesId === 'smartpart_custom'
        || hw?.brand === 'SmartPart'
        || hw?.type === 'CUSTOM'
        || /^smartpart[_:]/i.test(String(hw?.id || ''))
        || /sp:SmartPart/i.test(String(hw?.id || ''))
        || /^SmartPart[_ ]/i.test(String(hw?.name || hw?.id || ''))
        || /^zaw\d+/i.test(String(hw?.name || hw?.id || '')),
    );
}

export type LiveZawieszkaFile = {
    baseName: string;
    relPath: string;
    id: string;
    name: string;
    isCustom: boolean;
};

export type LiveZawieszkiSnapshot = {
    ok: boolean;
    files: LiveZawieszkaFile[];
    /** dedup keys obecnych na dysku */
    diskKeys: Set<string>;
    /** id/baseName na dysku */
    diskIds: Set<string>;
    error?: string;
};

let lastSnapshot: LiveZawieszkiSnapshot | null = null;
let lastDiskKeys = new Set<string>();

export function getLastLiveZawieszkiSnapshot(): LiveZawieszkiSnapshot | null {
    return lastSnapshot;
}

function keysForFile(f: LiveZawieszkaFile): string[] {
    return [
        dedupKey(f.id, f.name),
        dedupKey(f.baseName, f.name),
        dedupKey(f.id, ''),
        dedupKey(f.baseName, ''),
    ].filter(Boolean);
}

/** Pobiera aktualną listę plików z dysku (dev server). */
export async function fetchLiveZawieszki(): Promise<LiveZawieszkiSnapshot> {
    try {
        const res = await fetch('/api/b1-zawieszki', { cache: 'no-store' });
        if (!res.ok) {
            const snap: LiveZawieszkiSnapshot = {
                ok: false,
                files: [],
                diskKeys: new Set(),
                diskIds: new Set(),
                error: `HTTP ${res.status}`,
            };
            lastSnapshot = snap;
            return snap;
        }
        const data = await res.json();
        const files: LiveZawieszkaFile[] = Array.isArray(data?.files) ? data.files : [];
        const diskKeys = new Set<string>();
        const diskIds = new Set<string>();
        for (const f of files) {
            diskIds.add(String(f.id || '').toLowerCase());
            diskIds.add(String(f.baseName || '').toLowerCase());
            for (const k of keysForFile(f)) diskKeys.add(k);
        }

        // localStorage nie jest listą UI. Zostaje tylko pakiet, który ma plik w B1_biblioteka/zawieszki.
        for (const pkg of listSmartPartPackages()) {
            const pkgKeys = [
                dedupKey(pkg.id, pkg.name),
                dedupKey(pkg.id, ''),
                dedupKey(pkg.name || '', ''),
            ].filter(Boolean);
            const onDisk = pkgKeys.some((k) => diskKeys.has(k));
            if (!onDisk) deleteSmartPartPackage(pkg.id);
        }
        // 2) Eager Vite nadal ma custom JSON, którego już nie ma na dysku →
        //    skasuj też kopię w localStorage (pierwsze odświeżenie po ręcznym delete z folderu)
        try {
            for (const hw of listHangers()) {
                if (!looksLikeFolderSmartPart(hw)) continue;
                const keys = [
                    dedupKey(hw.id, hw.name),
                    dedupKey(hw.id, ''),
                    dedupKey(hw.name || '', ''),
                ].filter(Boolean);
                const onDisk = keys.some((k) => diskKeys.has(k));
                if (!onDisk) {
                    deleteSmartPartPackage(hw.id);
                    if (hw.name) deleteSmartPartPackage(hw.name);
                }
            }
        } catch { /* B1 niedostępne w teście */ }
        lastDiskKeys = diskKeys;

        const snap: LiveZawieszkiSnapshot = { ok: true, files, diskKeys, diskIds };
        lastSnapshot = snap;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(CAD_SMARTPARTS_CHANGED, { detail: { live: true } }));
        }
        return snap;
    } catch (err: any) {
        const snap: LiveZawieszkiSnapshot = {
            ok: false,
            files: [],
            diskKeys: new Set(),
            diskIds: new Set(),
            error: String(err?.message || err),
        };
        lastSnapshot = snap;
        return snap;
    }
}

/** Kasuje custom SmartPart: localStorage + plik(i) na dysku. */
export async function deleteHangerFromLibrary(idOrName: string): Promise<{ ok: boolean; error?: string }> {
    const key = String(idOrName || '').trim();
    if (!key) return { ok: false, error: 'Brak id' };

    // 1) Studio / localStorage (zawsze)
    deleteSmartPartPackage(key);

    // 2) Dysk B1 (dev API)
    try {
        const res = await fetch('/api/b1-zawieszki/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: key }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && res.status !== 404) {
            // 404 = nie było pliku (tylko Studio) — OK
            return { ok: false, error: data?.error || `HTTP ${res.status}` };
        }
    } catch (err: any) {
        // Brak API (produkcja bez middleware) — localStorage już wyczyszczony
        console.warn('[HangerLibrary] delete disk:', err);
    }

    await fetchLiveZawieszki();
    return { ok: true };
}

/** Czy wpis custom z bundla Vite nadal istnieje na dysku (gdy mamy snapshot). */
export function isLiveDiskPresent(id: string, name?: string): boolean | null {
    const snap = lastSnapshot;
    if (!snap?.ok) return null; // nie wiadomo — nie filtruj
    const keys = [
        dedupKey(id, name),
        dedupKey(id, ''),
        dedupKey(name || '', ''),
    ].filter(Boolean);
    return keys.some((k) => snap.diskKeys.has(k));
}

export function subscribeHangerLibrarySync(onChange: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const onEvt = () => onChange();
    const onStorage = (e: StorageEvent) => {
        if (e.key === SMARTPARTS_STORAGE_KEY) onChange();
    };
    const onFocus = () => {
        void fetchLiveZawieszki().then(() => onChange());
    };
    window.addEventListener(CAD_SMARTPARTS_CHANGED, onEvt);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    // pierwsze odświeżenie z dysku
    void fetchLiveZawieszki().then(() => onChange());
    return () => {
        window.removeEventListener(CAD_SMARTPARTS_CHANGED, onEvt);
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('focus', onFocus);
    };
}
