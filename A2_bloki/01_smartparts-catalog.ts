/**
 * A5_smartparts — katalog jak Materiały: zakładka → filtry → lista miniaturek.
 */

import {
    DEFAULT_HANDLE_TEMPLATES,
    REJS_BAR_SERIES,
    HANDLE_TYPE_OPTIONS,
    HANDLE_PRODUCER_OPTIONS,
    resolveHandleGlbFile,
    type HandleType,
    type HandleProducerId,
    type HandleOrientation,
    type HandlePlacementPreset,
    type HandleColorId,
    type HandleTemplateItem,
} from '../A2_bloki/handles/handle-types.js';
import { listHandles, listHangers } from '../B1_biblioteka/index.js';
import { isLiveDiskPresent } from './hangers/hanger-library-sync.js';
import type { HangerTemplateItem } from './hangers/hanger-types.js';
import { normalizeSmartPartToCadCoords } from '../S5_studio/smartpart-studio-types.js';

export type SmartPartSection = 'HANDLES' | 'HANGERS' | 'HOOKS' | 'LIGHTS' | 'SWITCHES';

export const SMARTPART_SECTIONS: { id: SmartPartSection; label: string }[] = [
    { id: 'HANDLES', label: 'Uchwyty' },
    { id: 'HANGERS', label: 'Zawieszki' },
    { id: 'HOOKS', label: 'Wieszaki' },
    { id: 'LIGHTS', label: 'Lampki' },
    { id: 'SWITCHES', label: 'Włączniki' },
];

export const HANDLE_FILTER_NONE = 'NONE' as const;
export type HandleFilterNone = typeof HANDLE_FILTER_NONE;

export type HandleTypeFilter = HandleType | HandleFilterNone;
export type HandleProducerFilter = HandleProducerId | HandleFilterNone;
export type HandleModelFilter = string | HandleFilterNone;
export type HandleSizeFilter = number | HandleFilterNone;

/** Pozycja listy uchwytów (jedna miniatura = jeden wariant do przeciągnięcia). */
export interface HandleCatalogItem {
    id: string;
    name: string;
    subtitle: string;
    badge: string;
    type: HandleType;
    producerId: HandleProducerId;
    seriesId?: string;
    holeDistanceMm: number;
    totalLengthMm: number;
    depthMm: number;
    thicknessMm: number;
    defaultOrientation: HandleOrientation;
    defaultPreset: HandlePlacementPreset;
    defaultOffsetYMm: number;
    glbModelPath?: string;
}

export interface HookCatalogItem {
    id: string;
    name: string;
    subtitle: string;
    badge: string;
    hookKind: 'SINGLE' | 'DOUBLE' | 'RAIL';
    producerId: string;
    modelId: string;
    dragEnabled: false;
}

export interface LightCatalogItem {
    id: string;
    name: string;
    subtitle: string;
    badge: string;
    lightKind: 'SPOT' | 'STRIP' | 'SENSOR';
    producerId: string;
    dragEnabled: false;
}

export interface SwitchCatalogItem {
    id: string;
    name: string;
    subtitle: string;
    badge: string;
    switchKind: 'BUTTON' | 'TOUCH' | 'PROXIMITY';
    producerId: string;
    modelId: string;
    dragEnabled: false;
}

function barBaseTemplate(): HandleTemplateItem {
    return DEFAULT_HANDLE_TEMPLATES.find((t) => t.type === 'BAR') || DEFAULT_HANDLE_TEMPLATES[0];
}

/** Pełna lista uchwytów — preferuj B1_biblioteka/uchwyty, inaczej serie wbudowane. */
export function buildHandleCatalog(): HandleCatalogItem[] {
    const fromB1 = buildHandleCatalogFromB1();
    if (fromB1.length > 0) {
        // Dopisz krawędziowy (brak GLB w bibliotece)
        const edge = DEFAULT_HANDLE_TEMPLATES.find((t) => t.type === 'EDGE');
        if (edge) {
            fromB1.push({
                id: edge.id,
                name: edge.name,
                subtitle: 'REJS · Krawędziowy',
                badge: `${edge.totalLengthMm}`,
                type: 'EDGE',
                producerId: 'rejs',
                seriesId: edge.defaultSeriesId,
                holeDistanceMm: edge.holeDistanceMm,
                totalLengthMm: edge.totalLengthMm,
                depthMm: edge.depthMm,
                thicknessMm: edge.thicknessMm,
                defaultOrientation: edge.defaultOrientation,
                defaultPreset: edge.defaultPreset,
                defaultOffsetYMm: edge.defaultOffsetYMm,
            });
        }
        return fromB1;
    }

    const items: HandleCatalogItem[] = [];
    const bar = barBaseTemplate();

    for (const series of REJS_BAR_SERIES) {
        for (const size of series.sizes) {
            items.push({
                id: `rejs_bar_${series.id}_${size.holeDistanceMm}`,
                name: `${series.name} ${size.holeDistanceMm}`,
                subtitle: `REJS · ${series.name} · ${size.holeDistanceMm}/${size.totalLengthMm} mm`,
                badge: `${size.holeDistanceMm}`,
                type: 'BAR',
                producerId: 'rejs',
                seriesId: series.id,
                holeDistanceMm: size.holeDistanceMm,
                totalLengthMm: size.totalLengthMm,
                depthMm: bar.depthMm,
                thicknessMm: bar.thicknessMm,
                defaultOrientation: bar.defaultOrientation,
                defaultPreset: bar.defaultPreset,
                defaultOffsetYMm: bar.defaultOffsetYMm,
                glbModelPath: resolveHandleGlbFile(series.id, size.holeDistanceMm, 'BAR'),
            });
        }
    }

    for (const tpl of DEFAULT_HANDLE_TEMPLATES) {
        if (tpl.type === 'BAR') continue;
        const typeLabel = HANDLE_TYPE_OPTIONS.find((t) => t.id === tpl.type)?.label || tpl.name;
        const producerLabel = HANDLE_PRODUCER_OPTIONS.find((p) => p.id === tpl.producerId)?.label || tpl.producerId;
        items.push({
            id: tpl.id,
            name: tpl.name,
            subtitle: `${producerLabel} · ${typeLabel}`,
            badge: tpl.holeDistanceMm > 0 ? `${tpl.holeDistanceMm}` : `${tpl.totalLengthMm}`,
            type: tpl.type,
            producerId: tpl.producerId,
            seriesId: tpl.defaultSeriesId,
            holeDistanceMm: tpl.holeDistanceMm,
            totalLengthMm: tpl.totalLengthMm,
            depthMm: tpl.depthMm,
            thicknessMm: tpl.thicknessMm,
            defaultOrientation: tpl.defaultOrientation,
            defaultPreset: tpl.defaultPreset,
            defaultOffsetYMm: tpl.defaultOffsetYMm,
            glbModelPath: tpl.glbModelPath,
        });
    }

    return items;
}

function buildHandleCatalogFromB1(): HandleCatalogItem[] {
    let handles: ReturnType<typeof listHandles> = [];
    try {
        handles = listHandles();
    } catch {
        return [];
    }
    if (!handles.length) return [];

    const bar = barBaseTemplate();
    return handles.map((hw) => {
        const cc = hw.mount?.hole_distance ?? 0;
        const total = hw.mount?.total_length ?? (cc > 0 ? cc + 34 : 30);
        const handleType = ((hw.handleType as HandleType) || (cc > 0 ? 'BAR' : 'KNOB'));
        return {
            id: hw.id,
            name: hw.name || hw.id,
            subtitle: `REJS · ${hw.series || hw.seriesId || ''} · ${cc > 0 ? `${cc}/${total} mm` : 'gałka'}`.replace(/\s·\s·/g, ' · '),
            badge: cc > 0 ? `${cc}` : 'K',
            type: handleType,
            producerId: 'rejs' as HandleProducerId,
            seriesId: hw.seriesId || hw.series?.toLowerCase(),
            holeDistanceMm: cc,
            totalLengthMm: total,
            depthMm: hw.mount?.depth ?? bar.depthMm,
            thicknessMm: hw.mount?.thickness ?? bar.thicknessMm,
            defaultOrientation: bar.defaultOrientation,
            defaultPreset: handleType === 'KNOB' ? 'TOP_RIGHT' : bar.defaultPreset,
            defaultOffsetYMm: handleType === 'KNOB' ? 40 : bar.defaultOffsetYMm,
            glbModelPath: hw.visual?.glb,
        };
    });
}

const HANDLE_CATALOG = buildHandleCatalog();

export function handleCatalogSizeKey(item: HandleCatalogItem): number {
    return item.holeDistanceMm > 0 ? item.holeDistanceMm : item.totalLengthMm;
}

export interface HandleCatalogFilters {
    type: HandleTypeFilter;
    producer: HandleProducerFilter;
    model: HandleModelFilter;
    sizeMm: HandleSizeFilter;
}

function matchesHandleFilters(
    item: HandleCatalogItem,
    opts: Partial<HandleCatalogFilters>,
    skip?: keyof HandleCatalogFilters,
): boolean {
    if (skip !== 'type' && opts.type && opts.type !== HANDLE_FILTER_NONE && item.type !== opts.type) return false;
    if (skip !== 'producer' && opts.producer && opts.producer !== HANDLE_FILTER_NONE && item.producerId !== opts.producer) return false;
    if (skip !== 'model' && opts.model && opts.model !== HANDLE_FILTER_NONE) {
        if ((item.seriesId || '') !== opts.model) return false;
    }
    if (skip !== 'sizeMm' && opts.sizeMm != null && opts.sizeMm !== HANDLE_FILTER_NONE) {
        if (handleCatalogSizeKey(item) !== opts.sizeMm) return false;
    }
    return true;
}

function ensureNoneOption<T extends { id: string; label: string }>(options: T[]): T[] {
    if (options.some((o) => o.id === HANDLE_FILTER_NONE)) return options;
    return [{ id: HANDLE_FILTER_NONE, label: 'None' } as T, ...options];
}

/** Zawsze zostaw aktualny wybór na liście, żeby select się nie wysypywał. */
function ensureCurrentOption(
    options: { id: string; label: string }[],
    current: string | undefined,
    labelOf?: (id: string) => string,
): { id: string; label: string }[] {
    if (!current || current === HANDLE_FILTER_NONE) return options;
    if (options.some((o) => o.id === current)) return options;
    return [...options, { id: current, label: labelOf?.(current) || current }];
}

export function listHandleTypeFilterOptions(
    opts: Omit<HandleCatalogFilters, 'type'>,
    current?: HandleTypeFilter,
): { id: string; label: string }[] {
    const ids = new Set(HANDLE_CATALOG.filter((i) => matchesHandleFilters(i, opts, 'type')).map((i) => i.type));
    const optsList = [
        { id: HANDLE_FILTER_NONE, label: 'None' },
        ...HANDLE_TYPE_OPTIONS.filter((o) => ids.has(o.id)),
    ];
    return ensureCurrentOption(optsList, current, (id) => HANDLE_TYPE_OPTIONS.find((o) => o.id === id)?.label || id);
}

export function listHandleProducerFilterOptions(
    opts: Omit<HandleCatalogFilters, 'producer'>,
    current?: HandleProducerFilter,
): { id: string; label: string }[] {
    const ids = new Set(HANDLE_CATALOG.filter((i) => matchesHandleFilters(i, opts, 'producer')).map((i) => i.producerId));
    const optsList = [
        { id: HANDLE_FILTER_NONE, label: 'None' },
        ...HANDLE_PRODUCER_OPTIONS.filter((o) => ids.has(o.id)),
    ];
    return ensureCurrentOption(optsList, current, (id) => HANDLE_PRODUCER_OPTIONS.find((o) => o.id === id)?.label || id);
}

export function listHandleModelFilterOptions(
    opts: Omit<HandleCatalogFilters, 'model'>,
    current?: HandleModelFilter,
): { id: string; label: string }[] {
    const ids = new Set<string>();
    for (const item of HANDLE_CATALOG) {
        if (!matchesHandleFilters(item, opts, 'model')) continue;
        if (item.seriesId) ids.add(item.seriesId);
    }
    const named = REJS_BAR_SERIES
        .filter((s) => ids.has(s.id))
        .map((s) => ({ id: s.id, label: s.name }));
    for (const id of ids) {
        if (!named.some((n) => n.id === id)) named.push({ id, label: id });
    }
    return ensureCurrentOption(
        ensureNoneOption(named),
        current,
        (id) => REJS_BAR_SERIES.find((s) => s.id === id)?.name || id,
    );
}

export function listHandleSizeFilterOptions(
    opts: Omit<HandleCatalogFilters, 'sizeMm'>,
    current?: HandleSizeFilter,
): { id: string; label: string }[] {
    const sizes = new Set<number>();
    for (const item of HANDLE_CATALOG) {
        if (!matchesHandleFilters(item, opts, 'sizeMm')) continue;
        sizes.add(handleCatalogSizeKey(item));
    }
    const sizeOpts = [...sizes].sort((a, b) => a - b).map((mm) => ({
        id: String(mm),
        label: `${mm} mm`,
    }));
    const withNone = ensureNoneOption(sizeOpts);
    if (current != null && current !== HANDLE_FILTER_NONE) {
        const key = String(current);
        if (!withNone.some((o) => o.id === key)) {
            withNone.push({ id: key, label: `${current} mm` });
        }
    }
    return withNone;
}

export function filterHandleCatalog(opts: HandleCatalogFilters & { searchQuery: string }): HandleCatalogItem[] {
    const q = opts.searchQuery.trim().toLowerCase();
    return HANDLE_CATALOG.filter((item) => {
        if (!matchesHandleFilters(item, opts)) return false;
        if (!q) return true;
        return (
            item.name.toLowerCase().includes(q)
            || item.subtitle.toLowerCase().includes(q)
            || item.badge.includes(q)
            || item.seriesId?.toLowerCase().includes(q)
        );
    });
}

export function handleItemToTemplate(
    item: HandleCatalogItem,
    colorPick?: { colorId?: HandleColorId; color?: { r: number; g: number; b: number } },
): HandleTemplateItem {
    return {
        id: item.id,
        name: item.name,
        type: item.type,
        producerId: item.producerId,
        totalLengthMm: item.totalLengthMm,
        holeDistanceMm: item.holeDistanceMm,
        depthMm: item.depthMm,
        thicknessMm: item.thicknessMm,
        defaultOrientation: item.defaultOrientation,
        defaultPreset: item.defaultPreset,
        defaultOffsetYMm: item.defaultOffsetYMm,
        glbModelPath: item.glbModelPath,
        defaultSeriesId: item.seriesId,
        colorId: colorPick?.colorId,
        color: colorPick?.color,
    };
}

// ─── Zawieszki (Camaro — wieszanie szafek, para L/R w górnych rogach) ───

export interface HangerCatalogItem {
    id: string;
    name: string;
    subtitle: string;
    badge: string;
    brand: string;
    seriesId: string;
    glbModelPath: string;
    fromTopMm: number;
    fromBackMm: number;
    fromSideMm: number;
    widthMm: number;
    heightMm: number;
    depthMm: number;
    pair: boolean;
    dragEnabled: true;
    thumbnailUrl?: string;
    definition?: any;
    /** Własny SmartPart z pliku w B1_biblioteka/zawieszki lub Studio */
    isCustom?: boolean;
    /** Skąd pochodzi wpis — Studio da się usunąć z UI */
    source?: 'studio' | 'b1' | 'library';
}

/** Klucz deduplikacji: sp:SmartPart_200 ≈ SmartPart_Kontener200.json ≈ SmartPart Kontener200 */
export function hangerCatalogDedupKey(id: string, name?: string): string {
    const raw = `${id || ''} ${name || ''}`;
    return raw
        .toLowerCase()
        .replace(/^sp:/, '')
        .replace(/\.json$/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

/**
 * Lista zawieszek w UI = pliki SmartPart w B1_biblioteka/zawieszki.
 * localStorage Studio nie dokłada pozycji — folder jest jedynym źródłem.
 * Żywy skan dysku wyrzuca wpis, którego plik już zniknął (stary bundel Vite).
 */
export function buildHangerCatalog(): HangerCatalogItem[] {
    let items: ReturnType<typeof listHangers> = [];
    try {
        items = listHangers();
    } catch {
        items = [];
    }

    const seenKeys = new Set<string>();
    const catalog: HangerCatalogItem[] = [];

    for (const hw of items) {
        if (!hw?.id || !(hw as any).definition?.mainContainer) continue;
        const onDisk = isLiveDiskPresent(hw.id, hw.name);
        if (onDisk === false) continue;
        const key = hangerCatalogDedupKey(hw.id, hw.name);
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);
        const parts = (hw as any).definition?.parts
            || ((hw as any).definition?.partBody ? [(hw as any).definition.partBody] : []);
        const first = parts[0] || {};
        catalog.push({
            id: hw.id,
            name: hw.name || hw.id,
            subtitle: `SmartPart · plik · ${first.widthMm || hw.mount?.width || 20}x${first.heightMm || hw.mount?.height || 38}x${first.depthMm || hw.mount?.depth || 70} mm`,
            badge: 'SP',
            brand: hw.brand || 'SmartParts',
            seriesId: hw.seriesId || hw.series || '',
            glbModelPath: hw.visual?.glb || '',
            fromTopMm: hw.mount?.from_top ?? 0,
            fromBackMm: hw.mount?.from_back ?? 0,
            fromSideMm: hw.mount?.from_side ?? 0,
            widthMm: Number(first.widthMm) || hw.mount?.width || 20,
            heightMm: Number(first.heightMm) || hw.mount?.height || 38,
            depthMm: Number(first.depthMm) || hw.mount?.depth || 70,
            pair: parts.length > 1 || (hw.mount?.pair ?? 0) !== 0,
            dragEnabled: true as const,
            thumbnailUrl: (hw.visual as any)?.png || (hw as any).thumbnailUrl || (hw as any).definition?.iconDataUrl || '',
            definition: normalizeSmartPartToCadCoords((hw as any).definition),
            isCustom: true,
            source: 'b1',
        });
    }

    return catalog;
}

export function filterHangerCatalog(opts: { searchQuery: string }): HangerCatalogItem[] {
    const list = buildHangerCatalog();
    const q = opts.searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) =>
        item.name.toLowerCase().includes(q)
        || item.subtitle.toLowerCase().includes(q)
        || item.brand.toLowerCase().includes(q),
    );
}

export function hangerItemToTemplate(item: HangerCatalogItem): HangerTemplateItem {
    return {
        id: item.id,
        name: item.name,
        brand: item.brand,
        seriesId: item.seriesId,
        glbModelPath: item.glbModelPath,
        fromTopMm: item.fromTopMm,
        fromBackMm: item.fromBackMm,
        fromSideMm: item.fromSideMm,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        depthMm: item.depthMm,
        pair: item.pair,
        thumbnailUrl: item.thumbnailUrl,
        definition: item.definition
            ? normalizeSmartPartToCadCoords(item.definition)
            : undefined,
    };
}

// ─── Wieszaki (REJS: SINGO, ARGO, ORIS, SORIA, WAL 01) ───

export const HOOK_TYPE_FILTERS = [
    { id: HANDLE_FILTER_NONE, label: 'None' },
    { id: 'SINGLE', label: 'Pojedynczy' },
    { id: 'DOUBLE', label: 'Podwójny' },
    { id: 'RAIL', label: 'Reling' },
];

export const HOOK_PRODUCER_FILTERS = [
    { id: HANDLE_FILTER_NONE, label: 'None' },
    { id: 'rejs', label: 'REJS' },
];

export const HOOK_MODEL_FILTERS = [
    { id: HANDLE_FILTER_NONE, label: 'None' },
    { id: 'singo', label: 'SINGO' },
    { id: 'argo', label: 'ARGO' },
    { id: 'oris', label: 'ORIS' },
    { id: 'soria', label: 'SORIA' },
    { id: 'wal01', label: 'WAL 01' },
];

const HOOK_CATALOG: HookCatalogItem[] = [
    { id: 'rejs_singo', name: 'SINGO', subtitle: 'REJS · wieszak pojedynczy', badge: '1', hookKind: 'SINGLE', producerId: 'rejs', modelId: 'singo', dragEnabled: false },
    { id: 'rejs_argo', name: 'ARGO', subtitle: 'REJS · wieszak podwójny', badge: '2', hookKind: 'DOUBLE', producerId: 'rejs', modelId: 'argo', dragEnabled: false },
    { id: 'rejs_oris', name: 'ORIS', subtitle: 'REJS · wieszak pojedynczy', badge: '1', hookKind: 'SINGLE', producerId: 'rejs', modelId: 'oris', dragEnabled: false },
    { id: 'rejs_soria_l', name: 'SORIA L', subtitle: 'REJS · wieszak', badge: 'L', hookKind: 'SINGLE', producerId: 'rejs', modelId: 'soria', dragEnabled: false },
    { id: 'rejs_soria_m', name: 'SORIA M', subtitle: 'REJS · wieszak', badge: 'M', hookKind: 'SINGLE', producerId: 'rejs', modelId: 'soria', dragEnabled: false },
    { id: 'rejs_soria_s', name: 'SORIA S', subtitle: 'REJS · wieszak', badge: 'S', hookKind: 'SINGLE', producerId: 'rejs', modelId: 'soria', dragEnabled: false },
    { id: 'rejs_wal01', name: 'WAL 01', subtitle: 'REJS · wieszak ścienny', badge: 'W', hookKind: 'RAIL', producerId: 'rejs', modelId: 'wal01', dragEnabled: false },
];

export function filterHookCatalog(opts: {
    hookKind: string;
    producer: string;
    model: string;
    searchQuery: string;
}): HookCatalogItem[] {
    const q = opts.searchQuery.trim().toLowerCase();
    return HOOK_CATALOG.filter((item) => {
        if (opts.hookKind !== HANDLE_FILTER_NONE && item.hookKind !== opts.hookKind) return false;
        if (opts.producer !== HANDLE_FILTER_NONE && item.producerId !== opts.producer) return false;
        if (opts.model !== HANDLE_FILTER_NONE && item.modelId !== opts.model) return false;
        if (!q) return true;
        return item.name.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q);
    });
}

// ─── Lampki ───

export const LIGHT_TYPE_FILTERS = [
    { id: HANDLE_FILTER_NONE, label: 'None' },
    { id: 'SPOT', label: 'Punktowa' },
    { id: 'STRIP', label: 'Listwa' },
    { id: 'SENSOR', label: 'Czujnik' },
];

export const LIGHT_PRODUCER_FILTERS = [
    { id: HANDLE_FILTER_NONE, label: 'None' },
    { id: 'rejs', label: 'REJS' },
    { id: 'ledberg', label: 'Ledberg' },
    { id: 'generic', label: 'Uniwersalna' },
];

const LIGHT_CATALOG: LightCatalogItem[] = [
    { id: 'rejs_spot', name: 'Spot meblowy', subtitle: 'REJS · punktowa', badge: 'SPOT', lightKind: 'SPOT', producerId: 'rejs', dragEnabled: false },
    { id: 'ledberg_strip', name: 'Listwa LED', subtitle: 'Ledberg · listwa', badge: 'LED', lightKind: 'STRIP', producerId: 'ledberg', dragEnabled: false },
    { id: 'generic_sensor', name: 'Z czujnikiem', subtitle: 'Uniwersalna · czujnik', badge: 'PIR', lightKind: 'SENSOR', producerId: 'generic', dragEnabled: false },
];

export function filterLightCatalog(opts: {
    lightKind: string;
    producer: string;
    searchQuery: string;
}): LightCatalogItem[] {
    const q = opts.searchQuery.trim().toLowerCase();
    return LIGHT_CATALOG.filter((item) => {
        if (opts.lightKind !== HANDLE_FILTER_NONE && item.lightKind !== opts.lightKind) return false;
        if (opts.producer !== HANDLE_FILTER_NONE && item.producerId !== opts.producer) return false;
        if (!q) return true;
        return item.name.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q);
    });
}

// ─── Włączniki (REJS LED: W01…W09) ───

export const SWITCH_TYPE_FILTERS = [
    { id: HANDLE_FILTER_NONE, label: 'None' },
    { id: 'BUTTON', label: 'Przyciskowy' },
    { id: 'TOUCH', label: 'Dotykowy' },
    { id: 'PROXIMITY', label: 'Bezdotykowy' },
];

export const SWITCH_PRODUCER_FILTERS = [
    { id: HANDLE_FILTER_NONE, label: 'None' },
    { id: 'rejs', label: 'REJS' },
];

export const SWITCH_MODEL_FILTERS = [
    { id: HANDLE_FILTER_NONE, label: 'None' },
    { id: 'w01', label: 'W01' },
    { id: 'w02', label: 'W02' },
    { id: 'w05', label: 'W05' },
    { id: 'w07', label: 'W07' },
    { id: 'w09', label: 'W09' },
];

const SWITCH_CATALOG: SwitchCatalogItem[] = [
    { id: 'rejs_w01', name: 'W01 przyciskowy', subtitle: 'REJS · ściemnialny 36 W', badge: 'W01', switchKind: 'BUTTON', producerId: 'rejs', modelId: 'w01', dragEnabled: false },
    { id: 'rejs_w02', name: 'W02 dotykowy', subtitle: 'REJS · ściemnialny', badge: 'W02', switchKind: 'TOUCH', producerId: 'rejs', modelId: 'w02', dragEnabled: false },
    { id: 'rejs_w05', name: 'W05 bezdotykowy', subtitle: 'REJS · drzwi / oświetlenie', badge: 'W05', switchKind: 'PROXIMITY', producerId: 'rejs', modelId: 'w05', dragEnabled: false },
    { id: 'rejs_w07', name: 'W07 uniwersalny', subtitle: 'REJS · bezdotykowy ściemnialny', badge: 'W07', switchKind: 'PROXIMITY', producerId: 'rejs', modelId: 'w07', dragEnabled: false },
    { id: 'rejs_w09', name: 'W09 do profilu LED', subtitle: 'REJS · bezdotykowy do profili', badge: 'W09', switchKind: 'PROXIMITY', producerId: 'rejs', modelId: 'w09', dragEnabled: false },
];

export function filterSwitchCatalog(opts: {
    switchKind: string;
    producer: string;
    model: string;
    searchQuery: string;
}): SwitchCatalogItem[] {
    const q = opts.searchQuery.trim().toLowerCase();
    return SWITCH_CATALOG.filter((item) => {
        if (opts.switchKind !== HANDLE_FILTER_NONE && item.switchKind !== opts.switchKind) return false;
        if (opts.producer !== HANDLE_FILTER_NONE && item.producerId !== opts.producer) return false;
        if (opts.model !== HANDLE_FILTER_NONE && item.modelId !== opts.model) return false;
        if (!q) return true;
        return item.name.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q);
    });
}
