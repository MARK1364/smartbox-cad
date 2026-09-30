/**
 * drawers-engine.ts — moduł SZUFLADY (blok_drawers)
 *
 * Czysta architektura funkcyjna (Functional Core) sprzyjająca agentom AI:
 *  - Wyraźne typy DTO ze sprecyzowanymi jednostkami fizycznymi (_mm).
 *  - Czyste funkcje kalkulacji geometrii bez ukrytego stanu (pure functions).
 *  - Zgodność z .agents/AGENTS.md (role 'FRONT', 'DRAWER_BOTTOM', 'DRAWER_BACK', 'BOX', 'SPACER').
 *  - SSOT parametrów: A2_bloki/BLOKI_PARAMETERS.md
 */

import drawersRules from './drawers_3_rules_V1.json';
import { resolveRuleThicknessMm } from './bloki-rules-helper.js';
import { toDimensionsMm, type ModuleDims } from './base-engine.js';
import { rulesMToMm } from '../A1_core/cad-math/units.js';
import { getDrawerDrill, getHardware, listByType, DEFAULT_RAIL_ID, type HardwareItem } from '../B1_biblioteka/index.js';
import type {
    BlokiDimensions_mm,
    BlokiPlanResult,
    BlokiPart,
    BlokiHardware
} from './bloki-types.js';
import type { DrawersPlanParams } from './bloki-module-types.js';
import {
    assertCanonicalDrawersParams,
    readOptionalNumber
} from './bloki-module-param-guards.js';

export { assertCanonicalDrawersParams, LEGACY_DRAWERS_PARAM_ALIASES } from './bloki-module-param-guards.js';

const FRONT_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' },
    rotation: [0, 0, 0] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

const SHELF_LCS = {
    mapping: { X: 'x', Y: 'y', Z: 'z' },
    rotation: [90, 0, 0] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

const SIDE_L_LCS = {
    mapping: { X: 'y', Y: 'x', Z: 'z' },
    rotation: [0, 0, -90] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

const SIDE_R_LCS = {
    mapping: { X: 'y', Y: 'x', Z: 'z' },
    rotation: [0, 0, 90] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

// ─── Pomocnicze Funkcje do Bazy Okuć ──────────────────────────────────────────

function railsForBrand(brand?: string): HardwareItem[] {
    return listByType('RAIL').filter((r) => !brand || r.brand === brand);
}

export function listRailBrands(): string[] {
    const brands = new Set<string>();
    for (const r of listByType('RAIL')) {
        if (r.brand) brands.add(r.brand);
    }
    return Array.from(brands).sort();
}

export function listRailSeriesForBrand(brand: string): string[] {
    const seriesSet = new Set<string>();
    for (const r of railsForBrand(brand)) {
        if (r.series) seriesSet.add(r.series);
    }
    return Array.from(seriesSet).sort();
}

export function listRailSystemsForBrand(
    brand: string,
    series?: string
): { id: string; name: string; corpusHeightMm: number; series?: string }[] {
    return railsForBrand(brand)
        .filter((r) => !series || r.series === series)
        .map((r) => ({
            id: r.id,
            name: r.name || r.id,
            corpusHeightMm: rulesMToMm(r.mount?.corpus_height, 84),
            series: r.series
        }));
}

export function listRailLengthsForBrand(brand: string): string[] {
    const lengths = new Set<string>();
    for (const r of railsForBrand(brand)) {
        for (const k of Object.keys(r.lengths || {})) lengths.add(k);
    }
    return Array.from(lengths).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

// ─── Typy Domenowe Szuflad ─────────────────────────────────────────────────────

export interface DrawerSlot {
    index: number;
    frontH: number;
    zFrontBottom: number;
    zInternalBottom: number;
    zFrontCenter: number;
    railId: string;
    lengthMm: number;
    rail: {
        name: string;
        construction?: string;
        panels?: any;
        railHeight: number;
        corpusHeight: number;
        width: number;
        lengths: Record<string, any>;
        frontHoles: any;
        drill: { dia?: number; depth?: number };
    };
    /** Front (z nakładkami) wychodzi poza gabaryt Bloku. */
    frontOutOfPanel: boolean;
    /** Otwory korpusu wychodzą poza wysokość Bloku. */
    corpusHolesOutOfPanel: boolean;
}

export interface DrawerLayout {
    liczba_szuflad: number;
    width_mm: number;
    height_mm: number;
    depth_mm: number;
    grubosc_frontu_mm: number;
    nalozenie_gora_mm: number;
    nalozenie_dol_mm: number;
    nalozenie_lewe_mm: number;
    nalozenie_prawe_mm: number;
    dystans_lewy_mm: number;
    dystans_prawy_mm: number;
    swiatlo_wewnetrzne_mm: number;
    przesuniecie_x_mm: number;
    slots: DrawerSlot[];
}

export interface NormalizedDrawersParams {
    liczba_szuflad: number;
    grubosc_frontu_mm: number;
    nalozenie_gora_mm: number;
    nalozenie_dol_mm: number;
    nalozenie_lewe_mm: number;
    nalozenie_prawe_mm: number;
    dystans_lewy_mm: number;
    dystans_prawy_mm: number;
    auto_wysokosc_frontu: boolean;
    szczelina_wspolna_mm: number;
    wysokosci_frontow_mm: number[];
    szczeliny_indywidualne_mm: number[];
    domyslny_system_prowadnic_id: string;
    konfiguracje_prowadnic: Record<number, { system?: string; length?: string }>;
}

function defaultRailId(params: DrawersPlanParams): string {
    const fromParams = params.domyslny_system_prowadnic_id;
    if (typeof fromParams === 'string' && getHardware(fromParams)?.type === 'RAIL') return fromParams;
    return listByType('RAIL').find((r) => r.id === DEFAULT_RAIL_ID)?.id
        || listByType('RAIL')[0]?.id
        || DEFAULT_RAIL_ID;
}

function defaultLength(item: HardwareItem | undefined, requested?: string, depthMm?: number): string {
    const keys = Object.keys(item?.lengths || {});
    if (requested && keys.includes(String(requested))) return String(requested);
    if (keys.includes('500') && (!depthMm || depthMm >= 500)) return '500';
    if (depthMm) {
        const fitting = keys.map(Number).filter(l => l <= depthMm).sort((a, b) => b - a);
        if (fitting.length > 0) return String(fitting[0]);
    }
    const sorted = keys.map(Number).sort((a, b) => b - a);
    return sorted[0] ? String(sorted[0]) : '500';
}

export function normalizeDrawersParams(
    raw: DrawersPlanParams = {},
    dims?: BlokiDimensions_mm | ModuleDims
): NormalizedDrawersParams {
    assertCanonicalDrawersParams(raw);

    const liczba_szuflad = Math.max(0, Math.min(5, Math.round(readOptionalNumber(raw, 'liczba_szuflad') ?? 3)));
    const defFrontThick = resolveRuleThicknessMm(drawersRules, ['SZUFLADA_1_FRONT', 'SZUFLADA_FRONT', 'FRONT'], 'front_thickness', 'drawers');
    const grubosc_frontu_mm = readOptionalNumber(raw, 'grubosc_frontu_mm') ?? defFrontThick;

    const nalozenie_gora_mm = readOptionalNumber(raw, 'nalozenie_gora_mm') ?? 15;
    const nalozenie_dol_mm = readOptionalNumber(raw, 'nalozenie_dol_mm') ?? 15;
    const nalozenie_lewe_mm = readOptionalNumber(raw, 'nalozenie_lewe_mm') ?? 15;
    const nalozenie_prawe_mm = readOptionalNumber(raw, 'nalozenie_prawe_mm') ?? 15;

    const defSpacerThick = resolveRuleThicknessMm(drawersRules, ['SPACER_L', 'SPACER_R', 'SPACER'], 'spacer_thickness', 'drawers');
    const dystans_lewy_mm = readOptionalNumber(raw, 'dystans_lewy_mm') ?? 0;
    const dystans_prawy_mm = readOptionalNumber(raw, 'dystans_prawy_mm') ?? 0;

    const auto_wysokosc_frontu = raw.auto_wysokosc_frontu !== undefined
        ? Boolean(raw.auto_wysokosc_frontu)
        : true;

    const szczelina_wspolna_mm = readOptionalNumber(raw, 'szczelina_wspolna_mm') ?? 3;
    const wysokosci_frontow_mm = Array.isArray(raw.wysokosci_frontow_mm)
        ? raw.wysokosci_frontow_mm.map(Number)
        : [];
    const szczeliny_indywidualne_mm = Array.isArray(raw.szczeliny_indywidualne_mm)
        ? raw.szczeliny_indywidualne_mm.map(Number)
        : [];

    const domyslny_system_prowadnic_id = defaultRailId(raw);
    const konfiguracje_prowadnic = (raw.konfiguracje_prowadnic && typeof raw.konfiguracje_prowadnic === 'object')
        ? raw.konfiguracje_prowadnic as Record<number, { system?: string; length?: string }>
        : {};

    return {
        liczba_szuflad,
        grubosc_frontu_mm,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm,
        dystans_lewy_mm,
        dystans_prawy_mm,
        auto_wysokosc_frontu,
        szczelina_wspolna_mm,
        wysokosci_frontow_mm,
        szczeliny_indywidualne_mm,
        domyslny_system_prowadnic_id,
        konfiguracje_prowadnic
    };
}

/**
 * Wspólny układ szuflad — używany przez silnik, builder nawierceń i ostrzeżenia UI.
 * Wszystko w mm. Z=0 to spód Bloku.
 */
export function resolveDrawerLayout(
    params: DrawersPlanParams,
    dims: BlokiDimensions_mm | ModuleDims
): DrawerLayout {
    const d = toDimensionsMm(dims);
    const szerokosc_mm = d.width_mm || 600;
    const wysokosc_mm = d.height_mm || 720;
    const glebokosc_mm = d.depth_mm || 500;

    const p = normalizeDrawersParams(params, {
        width_mm: szerokosc_mm,
        height_mm: wysokosc_mm,
        depth_mm: glebokosc_mm
    });

    const innerW = Math.max(10, szerokosc_mm - p.dystans_lewy_mm - p.dystans_prawy_mm);
    const innerXOffset = (p.dystans_lewy_mm - p.dystans_prawy_mm) / 2;

    const slots: DrawerSlot[] = [];

    for (let i = 1; i <= p.liczba_szuflad; i++) {
        let frontH: number;
        let zFrontBottom: number;
        if (p.auto_wysokosc_frontu) {
            const totalH = wysokosc_mm + p.nalozenie_dol_mm + p.nalozenie_gora_mm;
            const totalGaps = p.liczba_szuflad > 1 ? (p.liczba_szuflad - 1) * p.szczelina_wspolna_mm : 0;
            frontH = p.liczba_szuflad > 0 ? Math.round(((totalH - totalGaps) / p.liczba_szuflad) * 100) / 100 : 0;
            zFrontBottom = -p.nalozenie_dol_mm + (i - 1) * (frontH + p.szczelina_wspolna_mm);
        } else {
            frontH = Number(p.wysokosci_frontow_mm[i - 1]);
            if (!Number.isFinite(frontH) || frontH <= 0) frontH = p.liczba_szuflad > 0 ? wysokosc_mm / p.liczba_szuflad : wysokosc_mm;
            const prevH = p.wysokosci_frontow_mm.slice(0, i - 1).reduce((s: number, v: number) => s + (Number(v) || 0), 0);
            const prevG = p.szczeliny_indywidualne_mm.slice(0, i - 1).reduce((s: number, v: number) => s + (Number(v) || 0), 0);
            zFrontBottom = -p.nalozenie_dol_mm + prevH + prevG;
        }

        const zInternalBottom = i === 1 ? 0 : zFrontBottom;
        const zFrontCenter = zFrontBottom + frontH / 2;

        const cfg = p.konfiguracje_prowadnic[i] || p.konfiguracje_prowadnic[String(i)] || {};
        const requestedId = cfg.system;
        const railItem = (requestedId && getHardware(requestedId)?.type === 'RAIL')
            ? getHardware(requestedId)
            : getHardware(p.domyslny_system_prowadnic_id);
        const railId = (requestedId && getHardware(requestedId)) ? requestedId : (railItem?.id || p.domyslny_system_prowadnic_id);
        const mount = railItem?.mount || {};
        const lengthMm = parseFloat(defaultLength(railItem, cfg.length, glebokosc_mm));
        const rail = {
            name: railItem?.name || railId,
            construction: (railItem as any)?.construction || ((railItem as any)?.panels ? 'SYSTEM' : 'WOODEN'),
            panels: (railItem as any)?.panels,
            railHeight: rulesMToMm(mount.rail_height, 35),
            corpusHeight: rulesMToMm(mount.corpus_height, 84),
            width: rulesMToMm(mount.width, 27),
            lengths: railItem?.lengths || {},
            frontHoles: railItem?.front_holes || {},
            drill: railItem?.drill || { dia: 0.003, depth: 0.012 }
        };

        const frontTop = zFrontBottom + frontH;
        const frontOutOfPanel = frontH <= 0 || zFrontBottom < -p.nalozenie_dol_mm - 0.5 || frontTop > wysokosc_mm + p.nalozenie_gora_mm + 0.5;

        const holeData = rail.lengths[String(Math.round(lengthMm))] || rail.lengths[String(lengthMm)] || {};
        const zOff = rulesMToMm(holeData.z_offset, 33);
        const holeR = rulesMToMm(rail.drill.dia, 3) / 2;
        const boxTop = zInternalBottom + rail.corpusHeight;
        const corpusHolesOutOfPanel =
            (zInternalBottom + zOff - holeR < -0.5) ||
            (zInternalBottom + zOff + holeR > wysokosc_mm + 0.5) ||
            (boxTop > wysokosc_mm + 0.5);

        slots.push({
            index: i,
            frontH,
            zFrontBottom,
            zInternalBottom,
            zFrontCenter,
            railId,
            lengthMm: Number.isFinite(lengthMm) ? lengthMm : 500,
            rail,
            frontOutOfPanel,
            corpusHolesOutOfPanel
        });
    }

    return {
        liczba_szuflad: p.liczba_szuflad,
        width_mm: szerokosc_mm,
        height_mm: wysokosc_mm,
        depth_mm: glebokosc_mm,
        grubosc_frontu_mm: p.grubosc_frontu_mm,
        nalozenie_gora_mm: p.nalozenie_gora_mm,
        nalozenie_dol_mm: p.nalozenie_dol_mm,
        nalozenie_lewe_mm: p.nalozenie_lewe_mm,
        nalozenie_prawe_mm: p.nalozenie_prawe_mm,
        dystans_lewy_mm: p.dystans_lewy_mm,
        dystans_prawy_mm: p.dystans_prawy_mm,
        swiatlo_wewnetrzne_mm: innerW,
        przesuniecie_x_mm: innerXOffset,
        slots
    };
}

function buildFrontHoles(slot: DrawerSlot, frontW: number, frontH: number): any[] {
    const data = slot.rail.frontHoles || {};
    const zFromBox: number[] = data.z_positions || [];
    if (!zFromBox.length) return [];
    const xOff = rulesMToMm(data.x_offset, 31);
    const drill = getDrawerDrill(slot.railId);
    const dia = rulesMToMm(drill.front_hole?.dia, 3);
    const depth = rulesMToMm(drill.front_hole?.depth, 10);
    const boxFromFrontBottom = slot.zInternalBottom - slot.zFrontBottom;
    const features: any[] = [];

    zFromBox.forEach((zRaw, zIdx) => {
        const v = boxFromFrontBottom + rulesMToMm(zRaw, 0);
        if (v < dia / 2 || v > frontH - dia / 2) return;
        for (const side of ['L', 'R'] as const) {
            const u = side === 'L' ? xOff : (frontW - xOff);
            features.push({
                id: `drawer_${slot.index}_front_${side}_${zIdx}`,
                type: 'hole',
                face: 'FACE_Z_PLUS',
                side: 'FACE_Z_PLUS',
                params: {
                    template_id: drill.id || 'STANDARD_DRAWER_DRILL',
                    u,
                    v,
                    diameter: dia,
                    depth,
                    isDrawerFrontHole: true
                }
            });
        }
    });

    return features;
}

// ─── Czysta Funkcja Kalkulacji Planu Szuflad ───────────────────────────────────

/**
 * Czysta funkcja matematyczna generująca formatki, skrzynki i prowadnice dla modułu Szuflad.
 * Zero stanu, zero zależności od sceny/DOM/Babylon.
 */
export function calculateDrawersPlan(
    dims: BlokiDimensions_mm,
    params: NormalizedDrawersParams
): BlokiPlanResult {
    const layout = resolveDrawerLayout(params, dims);
    const parts: BlokiPart[] = [];
    const hardware: BlokiHardware[] = [];

    const roleFront = (drawersRules as any).parameters?.smart_panel_integration?.role_overrides?.FRONT;
    const roleSpacer = (drawersRules as any).parameters?.smart_panel_integration?.role_overrides?.SPACER;
    const roleBottom = (drawersRules as any).parameters?.smart_panel_integration?.role_overrides?.DRAWER_BOTTOM;
    const roleBack = (drawersRules as any).parameters?.smart_panel_integration?.role_overrides?.DRAWER_BACK;

    const frontY = -(layout.depth_mm / 2 + layout.grubosc_frontu_mm / 2);
    // Nałożenie L/P liczone od wewnętrznej ściany dystansu (nie od krawędzi Bloku).
    const frontW = layout.swiatlo_wewnetrzne_mm + layout.nalozenie_lewe_mm + layout.nalozenie_prawe_mm;
    const frontX = layout.przesuniecie_x_mm + (layout.nalozenie_prawe_mm - layout.nalozenie_lewe_mm) / 2;

    for (const slot of layout.slots) {
        parts.push({
            name: `Front_${slot.index}`,
            key: `DRAWER_${slot.index}_FRONT`,
            role: 'FRONT',
            nodeType: 'PART',
            dim: { x: frontW, y: layout.grubosc_frontu_mm, z: slot.frontH },
            loc: { x: frontX, y: frontY, z: slot.zFrontCenter },
            lcs: FRONT_LCS,
            edge_banding: roleFront?.edge_banding,
            features: buildFrontHoles(slot, frontW, slot.frontH)
        });

        const railLen = Math.min(slot.lengthMm, Math.max(10, layout.depth_mm - 2));
        const isSystemDrawer = (slot.rail as any).construction === 'SYSTEM' ||
            ((slot.rail as any).construction !== 'WOODEN' && (
                Boolean((slot.rail as any).panels) ||
                /antaro|slimbox|merivo|legrabox|^m\d+|^d\d+|^kosz/i.test(slot.railId) ||
                /antaro|slimbox|merivo|legrabox/i.test(slot.rail.name)
            ));

        const panelConf = (slot.rail as any).panels;

        if (isSystemDrawer) {
            // Szuflada systemowa (np. Blum Antaro) — 2 formatki meblowe: Dno i Plecy
            const bottomThickness = panelConf?.bottom?.thickness || 16;
            const bottomW = Math.max(10, layout.swiatlo_wewnetrzne_mm + (panelConf?.bottom?.width_offset ?? -75));
            const bottomL = Math.max(10, slot.lengthMm + (panelConf?.bottom?.length_offset ?? -24));

            parts.push({
                name: `Dno_${slot.index}`,
                key: `DRAWER_${slot.index}_BOTTOM`,
                role: 'DRAWER_BOTTOM',
                nodeType: 'PART',
                material: 'W1100_ST9_16',
                materialName: 'Biały Alpejski 16mm',
                materialCode: 'W1100 ST9',
                dim: { x: bottomW, y: bottomL, z: bottomThickness },
                loc: {
                    x: layout.przesuniecie_x_mm,
                    y: -(layout.depth_mm / 2) + bottomL / 2,
                    z: slot.zInternalBottom + bottomThickness / 2
                },
                lcs: SHELF_LCS,
                edge_banding: roleBottom?.edge_banding,
                features: []
            });

            const backThickness = panelConf?.back?.thickness || 16;
            const backW = Math.max(10, layout.swiatlo_wewnetrzne_mm + (panelConf?.back?.width_offset ?? -87));
            const backH = panelConf?.back?.height ??
                (panelConf?.back?.height_offset !== undefined
                    ? Math.max(10, slot.rail.corpusHeight + panelConf.back.height_offset)
                    : slot.rail.corpusHeight || 84);

            parts.push({
                name: `Plecy_${slot.index}`,
                key: `DRAWER_${slot.index}_BACK`,
                role: 'DRAWER_BACK',
                nodeType: 'PART',
                material: 'W1100_ST9_16',
                materialName: 'Biały Alpejski 16mm',
                materialCode: 'W1100 ST9',
                dim: { x: backW, y: backThickness, z: backH },
                loc: {
                    x: layout.przesuniecie_x_mm,
                    y: -(layout.depth_mm / 2) + bottomL - backThickness / 2,
                    z: slot.zInternalBottom + backH / 2
                },
                lcs: FRONT_LCS,
                edge_banding: roleBack?.edge_banding,
                features: []
            });
        } else {
            // Szuflada drewniana (np. Tandem, rolkowa, kulkowa) — bryła skrzynki
            const boxW = Math.max(10, layout.swiatlo_wewnetrzne_mm - slot.rail.width * 2);
            parts.push({
                name: `Skrzynka_${slot.index}`,
                key: `DRAWER_${slot.index}_BOX`,
                role: 'BOX',
                nodeType: 'PART',
                dim: { x: boxW, y: railLen, z: slot.rail.corpusHeight },
                loc: {
                    x: layout.przesuniecie_x_mm,
                    y: -(layout.depth_mm / 2) + railLen / 2,
                    z: slot.zInternalBottom + slot.rail.corpusHeight / 2
                },
                lcs: SHELF_LCS,
                features: []
            });
        }

        const railZ = slot.zInternalBottom;
        const railY = -(layout.depth_mm / 2);
        const railXLeft = -layout.width_mm / 2 + layout.dystans_lewy_mm + slot.rail.width;
        const railXRight = layout.width_mm / 2 - layout.dystans_prawy_mm - slot.rail.width;

        const hwModelId = 'BLUM_ANTARO_M_L';

        hardware.push({
            id: `drawer_${slot.index}_rail_L`,
            name: `Prowadnica ${slot.index}L [${slot.rail.name}]`,
            role: 'PROWADNICA',
            hardwareType: 'RAIL',
            hardwareId: hwModelId,
            side: 'left',
            loc: { x: railXLeft, y: railY, z: railZ },
            dim: { x: slot.rail.width, y: railLen, z: slot.rail.railHeight },
            params: {
                drawerIndex: slot.index,
                railId: slot.railId,
                side: 'left',
                lengthMm: slot.lengthMm,
                corpusHeight: slot.rail.corpusHeight,
                zInternalBottom: slot.zInternalBottom,
                art_no: slot.rail.lengths[String(Math.round(slot.lengthMm))]?.art_no
            },
            customProperties: {
                library_id: slot.railId,
                art_no: slot.rail.lengths[String(Math.round(slot.lengthMm))]?.art_no,
                shape: 'RAIL'
            }
        });

        hardware.push({
            id: `drawer_${slot.index}_rail_R`,
            name: `Prowadnica ${slot.index}P [${slot.rail.name}]`,
            role: 'PROWADNICA',
            hardwareType: 'RAIL',
            hardwareId: hwModelId,
            side: 'right',
            loc: { x: railXRight, y: railY, z: railZ },
            dim: { x: slot.rail.width, y: railLen, z: slot.rail.railHeight },
            params: {
                drawerIndex: slot.index,
                railId: slot.railId,
                side: 'right',
                lengthMm: slot.lengthMm,
                corpusHeight: slot.rail.corpusHeight,
                zInternalBottom: slot.zInternalBottom,
                art_no: slot.rail.lengths[String(Math.round(slot.lengthMm))]?.art_no
            },
            customProperties: {
                library_id: slot.railId,
                art_no: slot.rail.lengths[String(Math.round(slot.lengthMm))]?.art_no,
                shape: 'RAIL'
            }
        });
    }

    if (layout.dystans_lewy_mm > 0.5) {
        parts.push({
            name: 'Dystans_L',
            key: 'DRAWER_SPACER_L',
            role: 'SPACER',
            nodeType: 'PART',
            dim: { x: layout.height_mm, y: layout.depth_mm, z: layout.dystans_lewy_mm },
            loc: { x: -layout.width_mm / 2 + layout.dystans_lewy_mm / 2, y: 0, z: layout.height_mm / 2 },
            lcs: SIDE_L_LCS,
            edge_banding: roleSpacer?.edge_banding,
            features: []
        });
    }
    if (layout.dystans_prawy_mm > 0.5) {
        parts.push({
            name: 'Dystans_P',
            key: 'DRAWER_SPACER_R',
            role: 'SPACER',
            nodeType: 'PART',
            dim: { x: layout.height_mm, y: layout.depth_mm, z: layout.dystans_prawy_mm },
            loc: { x: layout.width_mm / 2 - layout.dystans_prawy_mm / 2, y: 0, z: layout.height_mm / 2 },
            lcs: SIDE_R_LCS,
            edge_banding: roleSpacer?.edge_banding,
            features: []
        });
    }

    return { parts, hardware };
}
