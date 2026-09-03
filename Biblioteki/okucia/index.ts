/**
 * Biblioteka okuć (tylko web).
 * Źródło prawdy: JSON (wiercenie + gabaryty). GLB jest opcjonalną wizualizacją.
 */
import zawiasyCatalog from './zawiasy.json';
import szufladyKonfig from '../szuflady.json';
import { mmToNm, nmToMm, rulesMToNm } from '../../A1_core/cad-math/units.js';
import { DEFAULT_RAIL_ID, railsFromKonfig } from './szuflady-from-konfig.js';

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
}

export interface DrawerDrill {
    id: string;
    corpus_hole: { dia?: number; depth?: number };
    front_hole: { dia?: number; depth?: number };
}

export const DEFAULT_HINGE_ID = 'BLUM_71B3550';
export { DEFAULT_RAIL_ID };

function itemsFrom(catalog: { items?: Record<string, HardwareItem> }): HardwareItem[] {
    const items = catalog?.items || {};
    return Object.entries(items).map(([id, raw]) => ({
        ...raw,
        id: raw?.id || id,
        type: raw?.type
    }));
}

const ALL_ITEMS: HardwareItem[] = [
    ...itemsFrom(zawiasyCatalog as { items?: Record<string, HardwareItem> }),
    ...railsFromKonfig(szufladyKonfig as { szuflady?: any[] })
];

const BY_ID = new Map<string, HardwareItem>();
for (const item of ALL_ITEMS) {
    BY_ID.set(item.id, item);
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

/** Otwory frontu zawiasu w nm — jednostka silnika. */
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
        const isCup = /puszka/i.test(h.name || '') || (h.dia ?? 0) >= 0.03;
        const cupEdgeM = hw.mount?.cup_x_from_inner_side ?? 0.0215;
        return {
            name: h.name || '',
            dia: rulesMToNm(h.dia, mmToNm(isCup ? 35 : 3)),
            depth: rulesMToNm(h.depth, mmToNm(isCup ? 15 : 10)),
            edgeDist: rulesMToNm(h.edge_dist, rulesMToNm(isCup ? cupEdgeM : 0.031, mmToNm(isCup ? 21.5 : 31))),
            yOffset: rulesMToNm(h.y_offset, 0),
            isCup
        };
    });
}

/** Otwory korpusu zawiasu w nm — jednostka silnika. */
export function hingeCorpusHolesNm(id?: string | null): HingeCorpusHoleNm[] {
    const hw = getHingeOrDefault(id);
    const holes = hw.machining?.corpus_holes || [];
    const fallbackFront = hw.mount?.corpus_y_from_front ?? 0.037;
    if (!holes.length) {
        return [
            { name: 'Prowadnik_otw_G', dia: mmToNm(5), depth: mmToNm(12), frontDist: mmToNm(37), zOffset: mmToNm(16) },
            { name: 'Prowadnik_otw_D', dia: mmToNm(5), depth: mmToNm(12), frontDist: mmToNm(37), zOffset: mmToNm(-16) }
        ];
    }
    return holes.map((h) => ({
        name: h.name || '',
        dia: rulesMToNm(h.dia, mmToNm(5)),
        depth: rulesMToNm(h.depth, mmToNm(12)),
        frontDist: rulesMToNm(h.front_dist, rulesMToNm(fallbackFront, mmToNm(37))),
        zOffset: rulesMToNm(h.z_offset, 0)
    }));
}

/** Tylko UI — te same otwory w mm. */
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
