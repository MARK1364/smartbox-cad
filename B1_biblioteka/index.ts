/**
 * B1_biblioteka — Pojedyncze źródło prawdy (SSOT) biblioteki okuć.
 * Wszystkie katalogi JSON w B1_biblioteka definiowane są w milimetrach ("units": "mm").
 * Każde okucie posiada swój pojedynczy plik JSON (np. BLUM_71B3550.json) w katalogu B1_biblioteka/zawiasy/.
 * Konwersja do jednostek domenowych (nm) następuje wyłącznie na brzegu przez mmToNm.
 */
import szufladyKonfig from './szuflady/szuflady.json';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { DEFAULT_RAIL_ID, railsFromKonfig } from './szuflady/szuflady-from-konfig.js';
import {
    handlesFromCatalog,
    handleGlbTemplateId,
    type HandleHardwareItem,
} from './uchwyty/handles-from-catalog.js';
import {
    hangersFromCatalog,
    hangerGlbTemplateId,
    type HangerHardwareItem,
} from './zawieszki/hangers-from-catalog.js';

export type HardwareType = 'HINGE' | 'RAIL' | 'HANDLE' | 'HANGER' | 'SHELF_PIN' | 'TUBE_SOCKET';
export type { HandleHardwareItem, HangerHardwareItem };
export { handleGlbTemplateId, hangerGlbTemplateId };

export interface MachiningHole {
    name?: string;
    dia?: number;
    depth?: number;
    edge_dist?: number;
    y_offset?: number;
    front_dist?: number;
    z_offset?: number;
    z_from_bottom?: number;
    object?: string;
}

export interface HardwareVisual {
    glb?: string;
    origin?: string;
    units?: string;
    png?: string;
}

export interface HardwareItem {
    id: string;
    type: HardwareType;
    definition?: any;
    name?: string;
    brand?: string;
    series?: string;
    /** Id serii uchwytu (np. easy) — tylko HANDLE */
    seriesId?: string;
    /** BAR / KNOB / … — tylko HANDLE */
    handleType?: string;
    art_no?: string;
    price_id?: string;
    machining_template_id?: string;
    usable_in?: string[];
    mount_type?: 'SIDE' | 'PARALLEL_FACE' | string;
    mount?: Record<string, number>;
    machining?: {
        front_holes?: MachiningHole[];
        corpus_holes?: MachiningHole[];
    };
    lengths?: Record<string, {
        z_offset?: number;
        x_positions?: number[];
        price_id?: string;
        art_no?: string;
    }>;
    front_holes?: Record<string, unknown>;
    drill?: { dia?: number; depth?: number };
    visual?: HardwareVisual;
    construction?: 'SYSTEM' | 'WOODEN' | 'INTERNAL';
    panels?: {
        bottom?: { width_offset?: number; length_offset?: number; thickness?: number };
        back?: { width_offset?: number; height?: number; height_offset?: number; thickness?: number };
    };
}

export interface DrawerDrill {
    id: string;
    corpus_hole: { dia?: number; depth?: number };
    front_hole: { dia?: number; depth?: number };
}

export const DEFAULT_HINGE_ID = 'BLUM_71B3550';
/** Odległość środka puszki Ø35 od krawędzi zawiasowej frontu [mm] — SSOT katalogu zawiasów. */
export const DEFAULT_HINGE_CUP_EDGE_DIST_MM = 22.5;
export { DEFAULT_RAIL_ID };

// Wykrycie wszystkich fizycznych modeli .glb w katalogu zawiasy/
const glbModules = (import.meta as any).glob('./zawiasy/*.glb', { query: '?url', eager: true });
const existingGlbIds = new Set<string>(
    Object.keys(glbModules).map((filePath) => filePath.replace(/^.*[\\/]/, '').replace(/\.glb.*$/i, ''))
);

// Ładowanie definicji zawiasów z twardym wymogiem pary: {ID}.json + {ID}.glb
const hingeModules = (import.meta as any).glob('./zawiasy/*.json', { eager: true, import: 'default' }) as Record<string, HardwareItem>;
const HINGE_ITEMS: HardwareItem[] = Object.values(hingeModules).filter((item) => {
    if (!item || !item.id) return false;
    const glbRef = item.visual?.glb ? item.visual.glb.replace(/^.*[\\/]/, '').replace(/\.glb.*$/i, '') : item.id;
    const hasGlb = existingGlbIds.has(item.id) || existingGlbIds.has(glbRef);
    if (!hasGlb) {
        console.warn(`[B1_biblioteka] Pomięto zawias "${item.id}" — brak wymaganego pliku ${item.id}.glb (wymóg pary JSON+GLB).`);
        return false;
    }
    return true;
});

// Ładowanie definicji szuflad z katalogu szuflady/** (struktura Producent / Marka)
const drawerFileModules = (import.meta as any).glob(
    ['./szuflady/**/*.json', '!./szuflady/szuflady.json', '!./szuflady/**/catalog.json'],
    { eager: true, import: 'default' }
) as Record<string, any>;

const DRAWER_ITEMS: HardwareItem[] = [];
const DRAWER_ALIASES = new Map<string, HardwareItem>();

for (const raw of Object.values(drawerFileModules)) {
    if (!raw) continue;
    if (Array.isArray(raw.variants)) {
        for (const v of raw.variants) {
            const frontHolesArr: MachiningHole[] = Array.isArray(v.machining?.front_holes)
                ? v.machining.front_holes
                : [];
            const frontHoles = frontHolesArr.length
                ? {
                    x_offset: Number(frontHolesArr[0]?.edge_dist ?? 31),
                    z_positions: frontHolesArr
                        .map((h) => Number(h.z_from_bottom))
                        .filter((z) => Number.isFinite(z)),
                    depth: Number(frontHolesArr[0]?.depth ?? 10)
                }
                : undefined;
            const item: HardwareItem = {
                id: v.id,
                type: 'RAIL',
                name: v.name || v.id,
                brand: raw.brand || 'Blum',
                series: raw.series || raw.id,
                usable_in: ['DRAWERS'],
                construction: v.construction || raw.construction || 'SYSTEM',
                panels: v.panels || raw.panels,
                mount: {
                    rail_height: v.rail_height ?? 35.0,
                    corpus_height: v.corpus_height ?? 94.0,
                    width: v.width ?? 27.0
                },
                machining: v.machining,
                ...(frontHoles ? { front_holes: frontHoles } : {}),
                lengths: v.lengths
            };
            DRAWER_ITEMS.push(item);
            if (v.legacy_id) {
                DRAWER_ALIASES.set(v.legacy_id, item);
            }
        }
    } else if (raw.id && raw.type === 'RAIL') {
        DRAWER_ITEMS.push(raw as HardwareItem);
    }
}

// Uchwyty: pliki producenta (Rejs/Rejs.json). catalog.json pomijamy (duplikat indeksu).
const handleFileModules = (import.meta as any).glob(
    ['./uchwyty/**/*.json', '!./uchwyty/catalog.json', '!./uchwyty/**/catalog.json'],
    { eager: true, import: 'default' }
) as Record<string, any>;

const HANDLE_ITEMS: HardwareItem[] = [];
for (const raw of Object.values(handleFileModules)) {
    for (const h of handlesFromCatalog(raw)) {
        HANDLE_ITEMS.push({
            id: h.id,
            type: 'HANDLE',
            name: h.name,
            brand: h.brand,
            series: h.series,
            seriesId: h.seriesId,
            handleType: h.handleType,
            price_id: h.price_id,
            usable_in: ['DOORS', 'DRAWERS', 'FLAPS'],
            mount: h.mount,
            visual: h.visual,
        });
    }
}

// Zawieszki: Camaro/*.json + własne SmartParts (catalog.json pomijamy — duplikat indeksu).
const hangerFileModules = (import.meta as any).glob(
    ['./zawieszki/**/*.json', '!./zawieszki/catalog.json', '!./zawieszki/**/catalog.json'],
    { eager: true, import: 'default' }
) as Record<string, any>;

const hangerImageModules = (import.meta as any).glob(
    ['./zawieszki/**/*.png', './zawieszki/**/*.jpg', './zawieszki/**/*.webp'],
    { eager: true, import: 'default' }
) as Record<string, string>;

const hangerGlbModules = (import.meta as any).glob(
    ['./zawieszki/**/*.glb'],
    { query: '?url', eager: true, import: 'default' }
) as Record<string, string>;

const HANGER_ITEMS: HardwareItem[] = [];
for (const [filePath, raw] of Object.entries(hangerFileModules)) {
    const pngPath = filePath.replace(/\.json$/i, '.png');
    const jpgPath = filePath.replace(/\.json$/i, '.jpg');
    const webpPath = filePath.replace(/\.json$/i, '.webp');
    const glbPath = filePath.replace(/\.json$/i, '.glb');

    const imageAssetUrl = hangerImageModules[pngPath] || hangerImageModules[jpgPath] || hangerImageModules[webpPath] || '';
    const hasGlb = Boolean(hangerGlbModules[glbPath]);
    const baseName = filePath.replace(/^.*[\\/]/, '').replace(/\.json$/i, '');
    const baseGlbName = filePath.replace(/^.*[\\/]/, '').replace(/\.json$/i, '.glb');

    for (const h of hangersFromCatalog(raw, 'Camaro', baseName)) {
        const visualPng = imageAssetUrl || (h.visual as any)?.png || raw?.iconDataUrl || '';
        const visualGlb = hasGlb ? baseGlbName : (h.visual?.glb || '');
        HANGER_ITEMS.push({
            id: h.id,
            type: 'HANGER',
            name: h.name,
            brand: h.brand,
            series: h.series,
            seriesId: h.seriesId,
            art_no: h.art_no,
            price_id: h.price_id,
            usable_in: ['CABINET'],
            mount: {
                from_top: h.mount.from_top,
                from_back: h.mount.from_back,
                from_side: h.mount.from_side,
                width: h.mount.width,
                height: h.mount.height,
                depth: h.mount.depth,
                pair: h.mount.pair ? 1 : 0,
            },
            machining: h.machining as any,
            visual: {
                ...h.visual,
                glb: visualGlb,
                ...(visualPng ? { png: visualPng } : {}),
            },
            definition: (h as any).definition || raw,
        });
    }
}

// Podpórki i złącza półek: polki_akcesoria/**/*.json (catalog.json pomijamy)
const shelfPinFileModules = (import.meta as any).glob(
    ['./polki_akcesoria/**/*.json', '!./polki_akcesoria/catalog.json', '!./polki_akcesoria/**/catalog.json'],
    { eager: true, import: 'default' }
) as Record<string, any>;

const SHELF_PIN_ITEMS: HardwareItem[] = [];
for (const raw of Object.values(shelfPinFileModules)) {
    if (!raw || !raw.id) continue;
    SHELF_PIN_ITEMS.push({
        id: raw.id,
        type: 'SHELF_PIN',
        name: raw.name || raw.id,
        brand: raw.brand || 'Standard',
        art_no: raw.art_no,
        price_id: raw.price_id,
        usable_in: raw.usable_in || ['SHELVES', 'SHELF'],
        mount: raw.mount,
        machining: raw.machining,
        visual: raw.visual,
        definition: raw,
    });
}

// Rozetki i akcesoria drążków: drazki/**/*.json (catalog.json pomijamy)
const tubeSocketFileModules = (import.meta as any).glob(
    ['./drazki/**/*.json', '!./drazki/catalog.json', '!./drazki/**/catalog.json'],
    { eager: true, import: 'default' }
) as Record<string, any>;

const TUBE_SOCKET_ITEMS: HardwareItem[] = [];
for (const raw of Object.values(tubeSocketFileModules)) {
    if (!raw || !raw.id) continue;
    TUBE_SOCKET_ITEMS.push({
        id: raw.id,
        type: 'TUBE_SOCKET',
        name: raw.name || raw.id,
        brand: raw.brand || 'Standard',
        art_no: raw.art_no,
        price_id: raw.price_id,
        usable_in: raw.usable_in || ['TUBES'],
        mount: raw.dimensions || raw.mount,
        machining: raw.machining,
        visual: raw.visual,
        definition: raw,
    });
}

const ALL_ITEMS: HardwareItem[] = [
    ...HINGE_ITEMS,
    ...railsFromKonfig(szufladyKonfig as { szuflady?: any[] }),
    ...DRAWER_ITEMS,
    ...HANDLE_ITEMS,
    ...HANGER_ITEMS,
    ...SHELF_PIN_ITEMS,
    ...TUBE_SOCKET_ITEMS,
];

const BY_ID = new Map<string, HardwareItem>();
for (const item of ALL_ITEMS) {
    if (item && item.id) {
        BY_ID.set(item.id, item);
        const defId = (item as any).definition?.id;
        if (defId && !BY_ID.has(defId)) {
            BY_ID.set(defId, item);
        }
    }
}
for (const [alias, item] of DRAWER_ALIASES) {
    if (!BY_ID.has(alias)) {
        BY_ID.set(alias, item);
    }
}

export function getHardware(id: string | undefined | null): HardwareItem | undefined {
    if (!id) return undefined;
    return BY_ID.get(id);
}

export function listByType(type: HardwareType): HardwareItem[] {
    return ALL_ITEMS.filter((item) => item.type === type);
}

/** Producenci zawiasów w UI — na dziś aktywny tylko Blum, reszta wyszarzona. */
export const HINGE_BRAND_OPTIONS: ReadonlyArray<{ id: string; enabled: boolean }> = [
    { id: 'Blum', enabled: true },
    { id: 'Rejs', enabled: false },
    { id: 'Hettich', enabled: false },
    { id: 'Sevroll', enabled: false },
    { id: 'GTV', enabled: false },
];

export const DEFAULT_HINGE_BRAND = 'Blum';

export type HingeCatalogScope = 'DOORS' | 'FLAPS';

/** Zawiasy jednego producenta (opcjonalnie ograniczone do DOORS/FLAPS). */
export function listHingesByBrand(brand: string, scope?: HingeCatalogScope): HardwareItem[] {
    return listByType('HINGE').filter((h) => {
        if ((h.brand || '') !== brand) return false;
        if (scope && Array.isArray(h.usable_in) && h.usable_in.length > 0 && !h.usable_in.includes(scope)) {
            return false;
        }
        return true;
    });
}

/** Nazwa na liście bez prefiksu producenta. */
export function hingeListLabel(hw: HardwareItem): string {
    return String(hw.name || hw.id || '').trim();
}

export function resolveHingeBrand(raw?: string | null): string {
    const match = HINGE_BRAND_OPTIONS.find((b) => b.id.toLowerCase() === String(raw || '').toLowerCase());
    if (match?.enabled) return match.id;
    return DEFAULT_HINGE_BRAND;
}

/** Lista uchwytów z B1 (mm w mount / visual.glb). */
export function listHandles(): HardwareItem[] {
    return listByType('HANDLE');
}

export function getHandleOrUndefined(id?: string | null): HardwareItem | undefined {
    const hw = getHardware(id);
    return hw?.type === 'HANDLE' ? hw : undefined;
}

/** Lista zawieszek z B1. */
export function listHangers(): HardwareItem[] {
    return listByType('HANGER');
}

export function getHangerOrUndefined(id?: string | null): HardwareItem | undefined {
    const hw = getHardware(id);
    return hw?.type === 'HANGER' ? hw : undefined;
}

export const DEFAULT_SHELF_PIN_ID = 'PODPORKA_FI5';

/** Lista podpórek i złączy półek z B1. */
export function listShelfPins(): HardwareItem[] {
    return listByType('SHELF_PIN');
}

export function getShelfPinOrDefault(id?: string | null): HardwareItem {
    const hw = getHardware(id) || getHardware(DEFAULT_SHELF_PIN_ID);
    if (hw && hw.type === 'SHELF_PIN') return hw;
    return {
        id: DEFAULT_SHELF_PIN_ID,
        type: 'SHELF_PIN',
        name: 'Podpórka półki Ø5 mm',
        brand: 'Standard',
        machining: {
            corpus_holes: [{ name: 'Podporka_otw', dia: 5, depth: 12 }]
        }
    };
}

export const DEFAULT_TUBE_SOCKET_ID = 'ROZETA_FI25';

/** Lista rozetek drążków z B1. */
export function listTubeSockets(): HardwareItem[] {
    return listByType('TUBE_SOCKET');
}

export function getTubeSocketOrDefault(id?: string | null): HardwareItem {
    const hw = getHardware(id) || getHardware(DEFAULT_TUBE_SOCKET_ID);
    if (hw && hw.type === 'TUBE_SOCKET') return hw;
    return {
        id: DEFAULT_TUBE_SOCKET_ID,
        type: 'TUBE_SOCKET',
        name: 'Rozeta drążka Ø25 mm',
        brand: 'Standard',
        machining: {
            corpus_holes: [
                { name: 'Rozeta_Otwor_1', dia: 3.5, depth: 12, y_offset: -16 },
                { name: 'Rozeta_Otwor_2', dia: 3.5, depth: 12, y_offset: 16 }
            ]
        }
    };
}

export function getDrawerDrill(id?: string | null): DrawerDrill {
    const hw = getHardware(id) || getHardware(DEFAULT_RAIL_ID);
    return {
        id: 'STANDARD_DRAWER_DRILL',
        corpus_hole: {
            dia: hw?.drill?.dia ?? 3,
            depth: hw?.drill?.depth ?? 12
        },
        front_hole: {
            dia: hw?.drill?.dia ?? 3,
            depth: hw?.front_holes && typeof (hw.front_holes as any).depth === 'number'
                ? (hw.front_holes as any).depth
                : 10
        }
    };
}

export function getHingeOrDefault(id?: string | null): HardwareItem {
    return getHardware(id) || getHardware(DEFAULT_HINGE_ID)!;
}

export function hingeTemplateId(id?: string | null): string {
    return getHingeOrDefault(id).machining_template_id || 'BLUM_110_STANDARD';
}

export function isParallelHinge(id?: string | null): boolean {
    const hw = getHingeOrDefault(id);
    return hw.mount_type === 'PARALLEL_FACE' ||
        hw.machining_template_id === 'BLUM_PARALLEL_BLIND' ||
        (id ? (id.includes('79B') || id.includes('79T')) : false);
}

export interface HingeFrontHoleNm {
    name: string;
    dia: number;
    depth: number;
    edgeDist: number;
    yOffset: number;
    isCup: boolean;
}

export type HingeFrontHoleMm = HingeFrontHoleNm;

export interface HingeCorpusHoleNm {
    name: string;
    dia: number;
    depth: number;
    frontDist: number;
    zOffset: number;
}

export type HingeCorpusHoleMm = HingeCorpusHoleNm;

/** Otwory frontu zawiasu w nm — jednostka domeny silnika. */
export function hingeFrontHolesNm(id?: string | null): HingeFrontHoleNm[] {
    const hw = getHingeOrDefault(id);
    const holes = hw.machining?.front_holes || [];
    if (!holes.length) {
        return [
            { name: 'Puszka_35', dia: mmToNm(35), depth: mmToNm(15), edgeDist: mmToNm(DEFAULT_HINGE_CUP_EDGE_DIST_MM), yOffset: 0, isCup: true },
            { name: 'Wkret_1', dia: mmToNm(3), depth: mmToNm(10), edgeDist: mmToNm(31), yOffset: mmToNm(22.5), isCup: false },
            { name: 'Wkret_2', dia: mmToNm(3), depth: mmToNm(10), edgeDist: mmToNm(31), yOffset: mmToNm(-22.5), isCup: false }
        ];
    }
    return holes.map((h) => {
        const isCup = /puszka/i.test(h.name || '') || (h.dia ?? 0) >= 30;
        const cupEdgeMm = hw.mount?.cup_x_from_inner_side ?? DEFAULT_HINGE_CUP_EDGE_DIST_MM;
        const diaMm = h.dia ?? (isCup ? 35 : 3);
        const depthMm = h.depth ?? (isCup ? 15 : 10);
        const edgeDistMm = h.edge_dist ?? (isCup ? cupEdgeMm : 31);
        const yOffsetMm = h.y_offset ?? 0;

        return {
            name: h.name || '',
            dia: mmToNm(diaMm),
            depth: mmToNm(depthMm),
            edgeDist: mmToNm(edgeDistMm),
            yOffset: mmToNm(yOffsetMm),
            isCup
        };
    });
}

/** Otwory korpusu zawiasu w nm — jednostka domeny silnika. */
export function hingeCorpusHolesNm(id?: string | null): HingeCorpusHoleNm[] {
    const hw = getHingeOrDefault(id);
    const holes = hw.machining?.corpus_holes || [];
    const fallbackFrontMm = hw.mount?.corpus_y_from_front ?? 37;
    if (!holes.length) {
        return [
            { name: 'Prowadnik_otw_G', dia: mmToNm(5), depth: mmToNm(12), frontDist: mmToNm(37), zOffset: mmToNm(16) },
            { name: 'Prowadnik_otw_D', dia: mmToNm(5), depth: mmToNm(12), frontDist: mmToNm(37), zOffset: mmToNm(-16) }
        ];
    }
    return holes.map((h) => {
        const diaMm = h.dia ?? 5;
        const depthMm = h.depth ?? 12;
        const frontDistMm = h.front_dist ?? fallbackFrontMm;
        const zOffsetMm = h.z_offset ?? 0;

        return {
            name: h.name || '',
            dia: mmToNm(diaMm),
            depth: mmToNm(depthMm),
            frontDist: mmToNm(frontDistMm),
            zOffset: mmToNm(zOffsetMm)
        };
    });
}

/** Tylko UI — otwory w mm. */
export function hingeFrontHolesMm(id?: string | null): HingeFrontHoleMm[] {
    return hingeFrontHolesNm(id).map((h) => ({
        ...h,
        dia: nmToMm(h.dia),
        depth: nmToMm(h.depth),
        edgeDist: nmToMm(h.edgeDist),
        yOffset: nmToMm(h.yOffset)
    }));
}

export function hingeCorpusHolesMm(id?: string | null): HingeCorpusHoleMm[] {
    return hingeCorpusHolesNm(id).map((h) => ({
        ...h,
        dia: nmToMm(h.dia),
        depth: nmToMm(h.depth),
        frontDist: nmToMm(h.frontDist),
        zOffset: nmToMm(h.zOffset)
    }));
}
