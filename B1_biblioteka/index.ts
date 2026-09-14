/**
 * B1_biblioteka — Pojedyncze źródło prawdy (SSOT) biblioteki okuć.
 * Wszystkie katalogi JSON w B1_biblioteka definiowane są w milimetrach ("units": "mm").
 * Każde okucie posiada swój pojedynczy plik JSON (np. BLUM_71B3550.json) w katalogu B1_biblioteka/zawiasy/.
 * Konwersja do jednostek domenowych (nm) następuje wyłącznie na brzegu przez mmToNm.
 */
import szufladyKonfig from './szuflady/szuflady.json';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { DEFAULT_RAIL_ID, railsFromKonfig } from './szuflady/szuflady-from-konfig.js';

export type HardwareType = 'HINGE' | 'RAIL';

export interface MachiningHole {
    name?: string;
    dia?: number;
    depth?: number;
    edge_dist?: number;
    y_offset?: number;
    front_dist?: number;
    z_offset?: number;
    object?: string;
}

export interface HardwareVisual {
    glb?: string;
    origin?: string;
    units?: string;
}

export interface HardwareItem {
    id: string;
    type: HardwareType;
    name?: string;
    brand?: string;
    series?: string;
    art_no?: string;
    price_id?: string;
    machining_template_id?: string;
    usable_in?: string[];
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
    const hasGlb = existingGlbIds.has(item.id);
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

const ALL_ITEMS: HardwareItem[] = [
    ...HINGE_ITEMS,
    ...railsFromKonfig(szufladyKonfig as { szuflady?: any[] }),
    ...DRAWER_ITEMS
];

const BY_ID = new Map<string, HardwareItem>();
for (const item of ALL_ITEMS) {
    if (item && item.id) {
        BY_ID.set(item.id, item);
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

export function getDrawerDrill(id?: string | null): DrawerDrill {
    const hw = getHardware(id) || getHardware(DEFAULT_RAIL_ID);
    return {
        id: 'STANDARD_DRAWER_DRILL',
        corpus_hole: {
            dia: hw?.drill?.dia ?? 0.003,
            depth: hw?.drill?.depth ?? 0.012
        },
        front_hole: {
            dia: hw?.drill?.dia ?? 0.003,
            depth: hw?.front_holes && typeof (hw.front_holes as any).depth === 'number'
                ? (hw.front_holes as any).depth
                : 0.01
        }
    };
}

export function getHingeOrDefault(id?: string | null): HardwareItem {
    return getHardware(id) || getHardware(DEFAULT_HINGE_ID)!;
}

export function hingeTemplateId(id?: string | null): string {
    return getHingeOrDefault(id).machining_template_id || 'BLUM_110_STANDARD';
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
            { name: 'Puszka_35', dia: mmToNm(35), depth: mmToNm(15), edgeDist: mmToNm(21.5), yOffset: 0, isCup: true },
            { name: 'Wkret_1', dia: mmToNm(3), depth: mmToNm(10), edgeDist: mmToNm(31), yOffset: mmToNm(22.5), isCup: false },
            { name: 'Wkret_2', dia: mmToNm(3), depth: mmToNm(10), edgeDist: mmToNm(31), yOffset: mmToNm(-22.5), isCup: false }
        ];
    }
    return holes.map((h) => {
        const isCup = /puszka/i.test(h.name || '') || (h.dia ?? 0) >= 30;
        const cupEdgeMm = hw.mount?.cup_x_from_inner_side ?? 21.5;
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
