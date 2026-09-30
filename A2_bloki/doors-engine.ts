/**
 * doors-engine.ts — moduł DRZWI (blok_doors)
 *
 * Czysta architektura funkcyjna (Functional Core) sprzyjająca agentom AI:
 *  - Wyraźne typy DTO ze sprecyzowanymi jednostkami fizycznymi (_mm).
 *  - Czyste funkcje kalkulacji geometrii bez ukrytego stanu (pure functions).
 *  - Zgodność z .agents/AGENTS.md (role 'FRONT', nodeType 'PART', jednostki mm w planowaniu).
 */

import doorsRules from './doors_3_rules_V1.json';
import { resolveRuleThicknessMm } from './bloki-rules-helper.js';
import { type ModuleDims } from './base-engine.js';
import { DEFAULT_HINGE_ID, hingeFrontHolesMm, hingeTemplateId } from '../B1_biblioteka/index.js';
import type {
    BlokiDimensions_mm,
    BlokiPlanResult,
    BlokiPart,
    BlokiHardware
} from './bloki-types.js';
import type { DoorsPlanParams, HingeIndex } from './bloki-module-types.js';
import {
    assertCanonicalDoorsParams,
    isHingeEnabled,
    readOptionalNumber
} from './bloki-module-param-guards.js';

export { assertCanonicalDoorsParams, LEGACY_DOORS_PARAM_ALIASES } from './bloki-module-param-guards.js';

// ─── Typy Domenowe Drzwi ───────────────────────────────────────────────────────

export type DoorType = 'LEFT' | 'RIGHT' | 'DOUBLE';

export interface ActiveHingeConfig {
    index: number;
    pozycja_lokalna_z_mm: number;
    szablon_id?: string;
}

export interface NormalizedDoorsParams {
    rodzaj_drzwi: DoorType;
    grubosc_frontu_mm: number;
    szczelina_mm: number;
    nalozenie_gora_mm: number;
    nalozenie_dol_mm: number;
    nalozenie_lewe_mm: number;
    nalozenie_prawe_mm: number;
    domyslny_zawias_id: string;
    szablony_zawiasow: Record<number, string>;
    aktywne_zawiasy: ActiveHingeConfig[];
}

// ─── Funkcje Pomocnicze (Czyste) ──────────────────────────────────────────────

/**
 * Wylicza listę aktywnych zawiasów dla zadanej wysokości strefy.
 * Domyślnie aktywny jest zawias 1 (dół, 120 mm) oraz zawias 6 (góra, 120 mm od sufitu).
 */
const DEFAULT_HINGE_POS_MM: Record<number, number> = {
    1: 120,
    2: 570,
    3: 910,
    4: 1230,
    5: 1580,
    6: 120,
};

export function resolveActiveHinges(raw: DoorsPlanParams = {}, wysokosc_strefy_mm: number): ActiveHingeConfig[] {
    const hinges: ActiveHingeConfig[] = [];
    for (let i = 1; i <= 6; i++) {
        const defaultEnabled = i === 1 || i === 6;
        if (!isHingeEnabled(raw, i, defaultEnabled)) continue;
        const pos = readOptionalNumber(raw, `pozycja_zawias_${i}_mm`) ?? DEFAULT_HINGE_POS_MM[i];
        hinges.push({
            index: i,
            pozycja_lokalna_z_mm: i === 6 ? Math.max(0, wysokosc_strefy_mm - pos) : pos
        });
    }
    return hinges;
}

/** Kanoniczne wejście modułu drzwi (generatorParams / plan). */
export function normalizeDoorsParams(
    raw: DoorsPlanParams = {},
    dims: BlokiDimensions_mm
): NormalizedDoorsParams {
    assertCanonicalDoorsParams(raw);

    let rawDoorType = String(raw.rodzaj_drzwi ?? 'LEFT').toUpperCase();
    if (rawDoorType === 'SINGLE_LEFT') rawDoorType = 'LEFT';
    if (rawDoorType === 'SINGLE_RIGHT') rawDoorType = 'RIGHT';
    const rodzaj_drzwi: DoorType = (rawDoorType === 'RIGHT' || rawDoorType === 'DOUBLE') ? rawDoorType : 'LEFT';

    const defThick = resolveRuleThicknessMm(doorsRules, ['DRZWI_L', 'DRZWI_P', 'FRONT'], 'front_thickness', 'doors');
    const grubosc_frontu_mm = readOptionalNumber(raw, 'grubosc_frontu_mm') ?? defThick;
    const szczelina_mm = readOptionalNumber(raw, 'szczelina_mm') ?? 4;

    const nalozenie_gora_mm = readOptionalNumber(raw, 'nalozenie_gora_mm') ?? 14;
    const nalozenie_dol_mm = readOptionalNumber(raw, 'nalozenie_dol_mm') ?? 15;
    const nalozenie_lewe_mm = readOptionalNumber(raw, 'nalozenie_lewe_mm') ?? 16;
    const nalozenie_prawe_mm = readOptionalNumber(raw, 'nalozenie_prawe_mm') ?? 16;

    const domyslny_zawias_id = String(raw.domyslny_zawias_id ?? DEFAULT_HINGE_ID);

    const szablony_zawiasow: Record<number, string> = {};
    for (let i = 1; i <= 6; i++) {
        const t = raw[`zawias_${i}_szablon` as `zawias_${HingeIndex}_szablon`];
        if (typeof t === 'string' && t) szablony_zawiasow[i] = t;
    }

    const aktywne_zawiasy = resolveActiveHinges(raw, dims.height_mm);

    return {
        rodzaj_drzwi,
        grubosc_frontu_mm,
        szczelina_mm,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm,
        domyslny_zawias_id,
        szablony_zawiasow,
        aktywne_zawiasy
    };
}

/**
 * Dobiera ID okucia zawiasu dla danego indeksu.
 */
function resolveHingeId(
    index: number,
    baseHingeId: string,
    customTemplates: Record<number, string>
): string {
    if (customTemplates[index]) {
        return customTemplates[index];
    }
    if (baseHingeId === 'BLUM_71B3550' || baseHingeId === 'BLUM_71T3550') {
        return (index % 2 === 1) ? 'BLUM_71B3550' : 'BLUM_71T3550';
    }
    if (baseHingeId === 'BLUM_79B9550' || baseHingeId === 'BLUM_79T9550') {
        return (index % 2 === 1) ? 'BLUM_79B9550' : 'BLUM_79T9550';
    }
    return baseHingeId;
}

// ─── Czysta Funkcja Kalkulacji Planu Drzwi ─────────────────────────────────────

/**
 * Czysta funkcja matematyczna generująca formatki i okucia dla modułu Drzwi.
 * Zero stanu, zero zależności od sceny/DOM/Babylon.
 */
export function calculateDoorsPlan(
    dims: BlokiDimensions_mm,
    params: NormalizedDoorsParams
): BlokiPlanResult {
    const parts: BlokiPart[] = [];
    const hardware: BlokiHardware[] = [];

    const {
        width_mm: szerokosc_strefy_mm,
        height_mm: wysokosc_strefy_mm,
        depth_mm: glebokosc_strefy_mm
    } = dims;

    const {
        rodzaj_drzwi,
        grubosc_frontu_mm,
        szczelina_mm,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm,
        domyslny_zawias_id,
        szablony_zawiasow,
        aktywne_zawiasy
    } = params;

    // Całkowita wysokość frontu i jego położenie w Z oraz Y
    const calkowita_wysokosc_drzwi_mm = wysokosc_strefy_mm + nalozenie_gora_mm + nalozenie_dol_mm;
    const pozycja_z_mm = wysokosc_strefy_mm / 2 + (nalozenie_gora_mm - nalozenie_dol_mm) / 2;
    // W układzie CADNode przód korpusu to -depth/2 (współrzędna Y)
    const pozycja_y_mm = -(glebokosc_strefy_mm / 2 + grubosc_frontu_mm / 2);

    // Reguły LCS i obrzeża z JSON reguł
    const rootSubs = (doorsRules as any).model_tree?.root_assembly?.subcomponents || {};
    const doorLRule = rootSubs.DOOR_L;
    const doorRRule = rootSubs.DOOR_R;

    const defaultLcs = {
        mapping: { X: 'x', Y: 'z', Z: 'y' },
        rotation: [0, 0, 0] as [number, number, number],
        faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
    };

    const frontOverride = (doorsRules as any).parameters?.smart_panel_integration?.role_overrides?.FRONT ||
                          (doorsRules as any).smart_panel_integration?.role_overrides?.FRONT;
    const edgeBanding = frontOverride?.edge_banding || {
        "+X": { active: true, type_id: "0.008x0.022" },
        "-X": { active: true, type_id: "0.008x0.022" },
        "+Y": { active: true, type_id: "0.008x0.022" },
        "-Y": { active: true, type_id: "0.008x0.022" }
    };

    // Budowanie nawierceń pod puszkę i wkręty zawiasu na froncie
    const buildHingeFeatures = (side: 'left' | 'right', szerokosc_drzwi_mm: number): any[] => {
        const features: any[] = [];

        for (const hinge of aktywne_zawiasy) {
            const hingeId = resolveHingeId(hinge.index, domyslny_zawias_id, szablony_zawiasow);
            const frontHoles = hingeFrontHolesMm(hingeId);
            const templateId = hingeTemplateId(hingeId);
            const vCenter = hinge.pozycja_lokalna_z_mm + nalozenie_dol_mm;

            for (const hole of frontHoles) {
                const u = side === 'left' ? hole.edgeDist : (szerokosc_drzwi_mm - hole.edgeDist);
                const kind = hole.isCup ? 'cup' : 'screw';
                const suffix = hole.isCup ? '' : `_${hole.name || 's'}`;
                features.push({
                    id: `hinge_${kind}_${side}_${hinge.index}${suffix}`,
                    type: 'hole',
                    side: 'FACE_Z_PLUS',
                    face: 'FACE_Z_PLUS',
                    params: {
                        template_id: templateId,
                        hinge_id: hingeId,
                        u,
                        v: vCenter + hole.yOffset,
                        diameter: hole.dia,
                        depth: hole.depth,
                        u_mm: u,
                        v_mm: vCenter + hole.yOffset,
                        diameter_mm: hole.dia,
                        depth_mm: hole.depth,
                        isDoorCup: hole.isCup,
                        isDoorScrew: !hole.isCup,
                        hingeIndex: hinge.index,
                        side: side,
                        hardwareId: `hinge_${side}_${hinge.index}`
                    }
                });
            }
        }

        return features;
    };

    // Tworzenie elementów okuć zawiasów (wizualizacja i raport materiałowy)
    const generateHardwareItems = (
        side: 'left' | 'right',
        szerokosc_drzwi_mm: number,
        pozycja_drzwi_x_mm: number
    ) => {
        for (const hinge of aktywne_zawiasy) {
            const hingeId = resolveHingeId(hinge.index, domyslny_zawias_id, szablony_zawiasow);
            const vCenter = hinge.pozycja_lokalna_z_mm + nalozenie_dol_mm;
            const frontHoles = hingeFrontHolesMm(hingeId);
            const cupHole = frontHoles.find(h => h.isCup);
            const cupEdgeDist = cupHole?.edgeDist ?? 21.5;
            const u = side === 'left' ? cupEdgeDist : (szerokosc_drzwi_mm - cupEdgeDist);

            const hwX = pozycja_drzwi_x_mm - szerokosc_drzwi_mm / 2 + u;
            const hwZ = pozycja_z_mm - calkowita_wysokosc_drzwi_mm / 2 + vCenter;

            hardware.push({
                id: `hinge_${side}_${hinge.index}`,
                name: `Zawias ${hinge.index} (${side === 'left' ? 'Lewy' : 'Prawy'}) [${hingeId}]`,
                hardwareType: 'HINGE',
                hardwareId: hingeId,
                side: side,
                loc: { x: hwX, y: pozycja_y_mm, z: hwZ },
                params: {
                    hingeIndex: hinge.index,
                    localZ: hinge.pozycja_lokalna_z_mm,
                    side
                }
            });
        }
    };

    if (rodzaj_drzwi === 'LEFT' || rodzaj_drzwi === 'RIGHT') {
        // Pojedyncze drzwi
        const szerokosc_drzwi_mm = szerokosc_strefy_mm + nalozenie_lewe_mm + nalozenie_prawe_mm;
        const pozycja_x_mm = (nalozenie_prawe_mm - nalozenie_lewe_mm) / 2;
        const hingeSide = rodzaj_drzwi === 'LEFT' ? 'left' : 'right';
        const doorRule = rodzaj_drzwi === 'LEFT' ? doorLRule : doorRRule;

        parts.push({
            name: rodzaj_drzwi === 'LEFT' ? 'Drzwi_Lewe' : 'Drzwi_Prawe',
            role: 'FRONT',
            nodeType: 'PART',
            dim: { x: szerokosc_drzwi_mm, y: grubosc_frontu_mm, z: calkowita_wysokosc_drzwi_mm },
            loc: { x: pozycja_x_mm, y: pozycja_y_mm, z: pozycja_z_mm },
            lcs: doorRule?.lcs || defaultLcs,
            edge_banding: edgeBanding,
            features: buildHingeFeatures(hingeSide, szerokosc_drzwi_mm)
        });

        generateHardwareItems(hingeSide, szerokosc_drzwi_mm, pozycja_x_mm);
    } else {
        // Podwójne drzwi (DOUBLE)
        const baza_szerokosc_mm = (szerokosc_strefy_mm - szczelina_mm) / 2;
        const szerokosc_lewe_mm = baza_szerokosc_mm + nalozenie_lewe_mm;
        const szerokosc_prawe_mm = baza_szerokosc_mm + nalozenie_prawe_mm;

        // Pozycja X dla lewego i prawego skrzydła
        const pozycja_lewe_x_mm = -szerokosc_strefy_mm / 2 - nalozenie_lewe_mm + szerokosc_lewe_mm / 2;
        const pozycja_prawe_x_mm = szerokosc_strefy_mm / 2 + nalozenie_prawe_mm - szerokosc_prawe_mm / 2;

        parts.push({
            name: 'Drzwi_Lewe',
            role: 'FRONT',
            nodeType: 'PART',
            dim: { x: szerokosc_lewe_mm, y: grubosc_frontu_mm, z: calkowita_wysokosc_drzwi_mm },
            loc: { x: pozycja_lewe_x_mm, y: pozycja_y_mm, z: pozycja_z_mm },
            lcs: doorLRule?.lcs || defaultLcs,
            edge_banding: edgeBanding,
            features: buildHingeFeatures('left', szerokosc_lewe_mm)
        });

        parts.push({
            name: 'Drzwi_Prawe',
            role: 'FRONT',
            nodeType: 'PART',
            dim: { x: szerokosc_prawe_mm, y: grubosc_frontu_mm, z: calkowita_wysokosc_drzwi_mm },
            loc: { x: pozycja_prawe_x_mm, y: pozycja_y_mm, z: pozycja_z_mm },
            lcs: doorRRule?.lcs || defaultLcs,
            edge_banding: edgeBanding,
            features: buildHingeFeatures('right', szerokosc_prawe_mm)
        });

        generateHardwareItems('left', szerokosc_lewe_mm, pozycja_lewe_x_mm);
        generateHardwareItems('right', szerokosc_prawe_mm, pozycja_prawe_x_mm);
    }

    return { parts, hardware };
}
