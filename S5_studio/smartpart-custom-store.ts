/**
 * A5_smartparts / studio — smartpart-custom-store.ts
 * Magazyn definicji SmartPartów (czysta geometria, bez producentów).
 *
 * Jednostki: milimetry (mm), units: 'mm'.
 */

import type { SmartPartPackageDefinition } from './smartpart-studio-types.js';
import { cutsOwnedByLiveParts, ensurePackageSets, normalizeSmartPartToCadCoords } from './smartpart-studio-types.js';
import { syncParameterDefaultsFromBindings } from './smartpart-params.js';
import { IDManager, EntityType } from '../A1_core/id-manager.js';

export const SMARTPARTS_STORAGE_KEY = 'cad_smartparts_packages_v1';
export const SMARTPARTS_CUSTOM_STORAGE_KEY = SMARTPARTS_STORAGE_KEY;
export const CAD_SMARTPARTS_CHANGED = 'cad-smartparts-changed';
export const CAD_CUSTOM_SMARTPARTS_CHANGED = CAD_SMARTPARTS_CHANGED;

/**
 * Tworzy unikalne ID pakietu SmartPart przy użyciu IDManagera (np. sp:SmartPart_Nazwa).
 */
export function allocSmartPartPackageId(name?: string): string {
    const role = (name || 'SmartPart').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return IDManager.getInstance().register(EntityType.SMARTPART, '', role).fullPath;
}

/**
 * Tworzy unikalne ID dla bryły (part) wewnątrz danego SmartParta.
 */
export function allocSmartPartBodyId(parentSpId: string, role = 'part'): string {
    return IDManager.getInstance().register(EntityType.PART, parentSpId, role).fullPath;
}

/**
 * Tworzy unikalne ID dla wycięcia/nawiertu (cut) wewnątrz danego SmartParta.
 */
export function allocSmartPartCutId(parentSpId: string, cutType = 'cut'): string {
    return IDManager.getInstance().register(EntityType.CUT, parentSpId, cutType).fullPath;
}

/**
 * Tworzy unikalne ID dla zestawu (set) wewnątrz danego SmartParta.
 */
export function allocSmartPartSetId(parentSpId: string, role = 'set'): string {
    return IDManager.getInstance().register(EntityType.SET, parentSpId, role).fullPath;
}

/**
 * Tworzy czysty, pusty pakiet SmartPart (bez predefiniowanych części i cięć).
 */
export function createEmptySmartPartPackage(name = 'SmartPart Kontener 1'): SmartPartPackageDefinition {
    const pkgId = allocSmartPartPackageId(name);
    return {
        id: pkgId,
        name,
        units: 'mm',
        version: '1.0',
        type: 'CUSTOM',
        coordSystem: 'CAD',
        mainContainer: {
            widthMm: 564,
            heightMm: 600,
            depthMm: 330,
        },
        sets: [
            {
                id: 'set_1',
                name: 'Zestaw 1',
                visible: true,
            },
        ],
        parts: [],
        cuts: [],
        parameters: [],
        bindings: [],
        updatedAt: Date.now(),
    };
}

/**
 * Domyślny wzorzec startowy — Czysta geometria kontenera SmartParta.
 */
export const DEFAULT_HANGER_SMARTPART: SmartPartPackageDefinition = normalizeSmartPartToCadCoords({
    id: 'smartpart_wzorzec_1',
    name: 'SmartPart Kontener 1',
    units: 'mm',
    version: '1.0',
    type: 'CUSTOM',
    // CAD: X szer., Y głęb., Z wys.
    coordSystem: 'CAD',
    mainContainer: {
        widthMm: 564,
        heightMm: 600,
        depthMm: 330,
    },
    parts: [
        {
            id: 'part_1',
            name: 'Part 1',
            widthMm: 20,
            heightMm: 40,
            depthMm: 70,
            xMm: -272,
            yMm: -130,
            zMm: 280,
            refX: 'LEFT',
            offsetX_mm: 10,
            refY: 'BACK',
            offsetY_mm: 35,
            refZ: 'TOP',
            offsetZ_mm: 20,
            colorHex: '#38bdf8',
        },
    ],
    cuts: [
        {
            id: 'cut_walec_1',
            name: 'Otwór okrągły 1',
            type: 'HOLE',
            diameterMm: 8,
            lengthMm: 24,
            xMm: -282,
            yMm: -145,
            zMm: 285,
            refX: 'LEFT',
            offsetX_mm: 0,
            refY: 'BACK',
            offsetY_mm: 20,
            refZ: 'TOP',
            offsetZ_mm: 15,
            axis: 'X',
            direction: -1,
            partId: 'part_1',
        },
        {
            id: 'cut_walec_2',
            name: 'Otwór okrągły 2',
            type: 'HOLE',
            diameterMm: 8,
            lengthMm: 24,
            xMm: -282,
            yMm: -145,
            zMm: 253,
            refX: 'LEFT',
            offsetX_mm: 0,
            refY: 'BACK',
            offsetY_mm: 20,
            refZ: 'TOP',
            offsetZ_mm: 47,
            axis: 'X',
            direction: -1,
            partId: 'part_1',
        },
        {
            id: 'cut_szescian_1',
            name: 'Wcięcie prostokątne 1',
            type: 'POCKET',
            widthMm: 16,
            heightMm: 32,
            depthMm: 15,
            xMm: -272,
            yMm: -165,
            zMm: 270,
            refX: 'LEFT',
            offsetX_mm: 10,
            refY: 'BACK',
            offsetY_mm: 0,
            refZ: 'TOP',
            offsetZ_mm: 30,
            axis: 'X',
            direction: -1,
            partId: 'part_1',
        },
    ],
    updatedAt: 1712000000000,
});

function getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        return (globalThis as any).localStorage;
    }
    return null;
}

/**
 * Zwraca listę zapisanych pakietów SmartParts.
 */
export function listSmartPartPackages(): SmartPartPackageDefinition[] {
    const builtin = [DEFAULT_HANGER_SMARTPART];
    const storage = getStorage();
    if (!storage) return builtin;

    try {
        const raw = storage.getItem(SMARTPARTS_STORAGE_KEY);
        if (!raw) return builtin;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return builtin;

        const userItems: SmartPartPackageDefinition[] = [];
        for (const item of parsed) {
            if (item && typeof item.id === 'string' && item.units === 'mm' && item.mainContainer) {
                const parts = Array.isArray(item.parts) && item.parts.length > 0
                    ? item.parts
                    : item.partBody
                        ? [{ id: 'part_1', name: 'Part 1', ...item.partBody }]
                        : [{ id: 'part_1', name: 'Part 1', widthMm: 18, heightMm: 38, depthMm: 68, xMm: 0, yMm: 0, zMm: 0, colorHex: '#38bdf8' }];
                userItems.push(normalizeSmartPartToCadCoords({
                    ...item,
                    parts,
                    partBody: parts[0],
                } as SmartPartPackageDefinition));
            }
        }

        const builtinFiltered = builtin.filter(
            (b) => !userItems.some((u) => u.id === b.id)
        );

        return [...userItems, ...builtinFiltered];
    } catch (err) {
        console.warn('[SmartPartCustomStore] Błąd odczytu storage:', err);
        return builtin;
    }
}

/**
 * Zapisuje pakiet SmartPart w storage (tylko pozycje użytkownika — bez wzorca builtin).
 */
export function saveSmartPartPackage(def: SmartPartPackageDefinition): void {
    const storage = getStorage();
    if (!storage) return;

    try {
        const userOnly = listSmartPartPackages().filter((i) => i.id !== DEFAULT_HANGER_SMARTPART.id);
        const existingIdx = userOnly.findIndex((i) => i.id === def.id);
        // cuts = tylko te z żywym partId (to, co widać w drzewie pod Partami)
        const toSave: SmartPartPackageDefinition = normalizeSmartPartToCadCoords(
            syncParameterDefaultsFromBindings({
                ...def,
                cuts: cutsOwnedByLiveParts(def),
                units: 'mm',
                version: '1.0',
                coordSystem: 'CAD',
                updatedAt: Date.now(),
            }),
        );

        if (existingIdx >= 0) {
            userOnly[existingIdx] = toSave;
        } else {
            userOnly.unshift(toSave);
        }

        storage.setItem(SMARTPARTS_STORAGE_KEY, JSON.stringify(userOnly));
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent(CAD_SMARTPARTS_CHANGED, { detail: { id: def.id } }));
        }
    } catch (err) {
        console.error('[SmartPartCustomStore] Błąd zapisu package:', err);
    }
}

/**
 * Usuwa pakiet SmartPart po id lub nazwie (np. „SmartPart_224”).
 */
export function deleteSmartPartPackage(idOrName: string): void {
    const storage = getStorage();
    if (!storage) return;

    try {
        const key = String(idOrName || '').trim().toLowerCase();
        if (!key) return;

        const userOnly = listSmartPartPackages().filter((i) => i.id !== DEFAULT_HANGER_SMARTPART.id);
        const filtered = userOnly.filter((i) => {
            const id = String(i.id || '').toLowerCase();
            const name = String(i.name || '').toLowerCase();
            if (id === key || name === key) return false;
            // np. sp:SmartPart_224 albo SmartPart_224.json
            if (id.includes(key) || name.includes(key)) return false;
            return true;
        });

        storage.setItem(SMARTPARTS_STORAGE_KEY, JSON.stringify(filtered));
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent(CAD_SMARTPARTS_CHANGED, { detail: { id: idOrName } }));
        }
    } catch (err) {
        console.error('[SmartPartCustomStore] Błąd usuwania package:', err);
    }
}

/** Usuwa wszystkie własne SmartParty z localStorage (zostaje tylko wzorzec w pamięci). */
export function clearCustomSmartPartPackages(): void {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.setItem(SMARTPARTS_STORAGE_KEY, JSON.stringify([]));
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent(CAD_SMARTPARTS_CHANGED, { detail: { cleared: true } }));
        }
    } catch (err) {
        console.error('[SmartPartCustomStore] Błąd czyszczenia storage:', err);
    }
}

/**
 * Pobiera pakiet SmartPart jako plik JSON bezpośrednio do folderu Pobrane (Downloads).
 */
export function exportSmartPartPackageJson(def: SmartPartPackageDefinition): void {
    if (typeof window === 'undefined' || !def) return;

    try {
        const safeName = (def.name || def.id || 'smartpart').trim().replace(/[^a-zA-Z0-9_\u00C0-\u024F\u0400-\u04FF-]/g, '_');
        // 1:1 z drzewem Studio — bez orphan cuts (zły/brak partId)
        const exportDef: SmartPartPackageDefinition = normalizeSmartPartToCadCoords({
            ...def,
            cuts: cutsOwnedByLiveParts(def),
            id: def.name && (!def.id || !def.id.includes(safeName)) ? allocSmartPartPackageId(safeName) : (def.id || safeName),
            name: def.name || safeName,
        });
        const jsonStr = JSON.stringify(exportDef, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${safeName}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (document.body.contains(a)) {
                document.body.removeChild(a);
            }
            URL.revokeObjectURL(url);
        }, 300);
    } catch (err) {
        console.error('[SmartPartCustomStore] Błąd pobierania pliku JSON:', err);
    }
}

/**
 * Pobiera wygenerowaną ikonę UI jako plik PNG do folderu Pobrane.
 */
export function exportSmartPartIconPng(iconDataUrl: string, name: string): void {
    if (typeof window === 'undefined' || !iconDataUrl) return;

    try {
        const parts = iconDataUrl.split(',');
        const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'image/png';
        const byteString = atob(parts[1] || '');
        const ia = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ia], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const safeName = (name || 'smartpart').trim().replace(/[^a-zA-Z0-9_\u00C0-\u024F\u0400-\u04FF-]/g, '_');
        a.download = `${safeName}.png`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (document.body.contains(a)) {
                document.body.removeChild(a);
            }
            URL.revokeObjectURL(url);
        }, 300);
    } catch (err) {
        console.error('[SmartPartCustomStore] Błąd eksportu ikony:', err);
    }
}

/**
 * Importuje pakiet SmartPart z pliku JSON.
 */
export function importSmartPartPackageJson(jsonStr: string): SmartPartPackageDefinition {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Niepoprawny format JSON.');
    }
    if (parsed.units !== 'mm') {
        throw new Error('Wymagane jednostki milimetrowe ("units": "mm").');
    }
    if (!parsed.mainContainer || typeof parsed.mainContainer.widthMm !== 'number') {
        throw new Error('Brak wymiarów Kontenera Głównego (mainContainer).');
    }

    const imported: SmartPartPackageDefinition = {
        id: parsed.id || allocSmartPartPackageId(parsed.name),
        name: parsed.name || 'Własny SmartPart',
        units: 'mm',
        version: '1.0',
        type: parsed.type || 'CUSTOM',
        mainContainer: {
            widthMm: Number(parsed.mainContainer.widthMm) || 20,
            heightMm: Number(parsed.mainContainer.heightMm) || 40,
            depthMm: Number(parsed.mainContainer.depthMm) || 70,
        },
        sets: Array.isArray(parsed.sets) ? parsed.sets : undefined,
        parts: Array.isArray(parsed.parts) && parsed.parts.length > 0
            ? parsed.parts.map((p: any, idx: number) => ({
                id: p.id || `part_${idx + 1}`,
                setId: p.setId,
                name: p.name || `Part ${idx + 1}`,
                widthMm: Number(p.widthMm) || 18,
                heightMm: Number(p.heightMm) || 38,
                depthMm: Number(p.depthMm) || 68,
                xMm: Number(p.xMm) || 0,
                yMm: Number(p.yMm) || 0,
                zMm: Number(p.zMm) || 0,
                refX: p.refX,
                offsetX_mm: p.offsetX_mm != null ? Number(p.offsetX_mm) : undefined,
                refY: p.refY,
                offsetY_mm: p.offsetY_mm != null ? Number(p.offsetY_mm) : undefined,
                refZ: p.refZ,
                offsetZ_mm: p.offsetZ_mm != null ? Number(p.offsetZ_mm) : undefined,
                colorHex: p.colorHex || '#38bdf8',
                glbPath: p.glbPath,
            }))
            : [
                {
                    id: 'part_1',
                    name: 'Part 1',
                    widthMm: Number(parsed.partBody?.widthMm) || 18,
                    heightMm: Number(parsed.partBody?.heightMm) || 38,
                    depthMm: Number(parsed.partBody?.depthMm) || 68,
                    xMm: Number(parsed.partBody?.xMm) || 0,
                    yMm: Number(parsed.partBody?.yMm) || 0,
                    zMm: Number(parsed.partBody?.zMm) || 0,
                    refX: parsed.partBody?.refX,
                    offsetX_mm: parsed.partBody?.offsetX_mm != null ? Number(parsed.partBody.offsetX_mm) : undefined,
                    refY: parsed.partBody?.refY,
                    offsetY_mm: parsed.partBody?.offsetY_mm != null ? Number(parsed.partBody.offsetY_mm) : undefined,
                    refZ: parsed.partBody?.refZ,
                    offsetZ_mm: parsed.partBody?.offsetZ_mm != null ? Number(parsed.partBody.offsetZ_mm) : undefined,
                    colorHex: parsed.partBody?.colorHex || '#38bdf8',
                    glbPath: parsed.partBody?.glbPath,
                },
            ],
        cuts: Array.isArray(parsed.cuts)
            ? parsed.cuts.map((c: any, idx: number) => ({
                ...c,
                id: c.id || `cut_${idx + 1}`,
                name: c.name || `Cut ${idx + 1}`,
                refX: c.refX,
                offsetX_mm: c.offsetX_mm != null ? Number(c.offsetX_mm) : undefined,
                refY: c.refY,
                offsetY_mm: c.offsetY_mm != null ? Number(c.offsetY_mm) : undefined,
                refZ: c.refZ,
                offsetZ_mm: c.offsetZ_mm != null ? Number(c.offsetZ_mm) : undefined,
                partId: c.partId || undefined,
            }))
            : [],
        iconDataUrl: parsed.iconDataUrl,
        updatedAt: Date.now(),
    };
    imported.partBody = imported.parts[0];

    const normalized = ensurePackageSets(normalizeSmartPartToCadCoords(imported));
    saveSmartPartPackage(normalized);
    return normalized;
}

// ─── Aliases for compatibility ───
export const listCustomSmartParts = listSmartPartPackages;
export const saveCustomSmartPart = saveSmartPartPackage as any;
export const deleteCustomSmartPart = deleteSmartPartPackage;
export const exportCustomSmartPartJson = exportSmartPartPackageJson as any;
export const importCustomSmartPartJson = importSmartPartPackageJson as any;
