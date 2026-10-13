/**
 * skosne-doors-engine.ts — Bloki DRZWI SKOŚNE (blok_skosne_drzwi)
 *
 * Front trapezowy: spód prosty, góra pochylona (jak korpus_skosny_lr).
 * Skrzydło jest JEDNE i JEDNOKIERUNKOWE — zawias może być tylko na krawędzi
 * pionowej. Lewa skośna = zawias z lewej (wysoka), prawa skośna = z prawej.
 * To jest różnica względem modułu DRZWI, gdzie rodzaj_drzwi wybierał stronę
 * zawiasu niezależnie od geometrii.
 *
 * Konwencja skosu (jak A3_smartframe/geometry/skosny-geometry.ts, LR):
 *   x = −W/2 → lewa krawędź pionowa (wysoka, h = wysokosc_lewy_mm)
 *   x = +W/2 → prawa krawędź (niska, h = wysokosc_prawy_mm)
 *
 * Obrys w outline2d: v rośnie w górę, u rośnie w prawo (patrz
 * A4_smartpanel/native_core/face-lcs.ts — FACE_Z_PLUS: uAxis=+X, vAxis=+Y).
 *
 * Jednostki: mm (zgodnie z .agents/AGENTS.md — planowanie Bloki w milimetrach).
 */

import skosneDoorsRules from './skosne-doors_3_rules_V1.json';
import { resolveRuleThicknessMm } from './bloki-rules-helper.js';
import type {
    BlokiDimensions_mm,
    BlokiHardware,
    BlokiPart,
    BlokiPlanResult
} from './bloki-types.js';
import type { HingeIndex, SkosneDoorsPlanParams } from './bloki-module-types.js';
import {
    DEFAULT_HINGE_CUP_EDGE_DIST_MM,
    DEFAULT_HINGE_ID,
    hingeFrontHolesMm,
    hingeTemplateId
} from '../B1_biblioteka/index.js';
import { resolveHingeId } from './doors-engine.js';
import {
    assertCanonicalSkosneDoorsParams,
    isHingeEnabled,
    readOptionalNumber
} from './bloki-module-param-guards.js';

export { assertCanonicalSkosneDoorsParams, LEGACY_SKOSNE_DOORS_PARAM_ALIASES }
    from './bloki-module-param-guards.js';

// ─── Typy domenowe ────────────────────────────────────────────────────────────

/** Strona zawiasu = strona pionowej (wysokiej) krawędzi trapezu. */
export type SkosneDoorType = 'LEFT' | 'RIGHT';

export interface ActiveHingeConfig {
    index: number;
    pozycja_lokalna_z_mm: number;
    szablon_id?: string;
}

export interface NormalizedSkosneDoorsParams {
    rodzaj_drzwi: SkosneDoorType;
    grubosc_frontu_mm: number;
    nalozenie_gora_mm: number;
    nalozenie_dol_mm: number;
    nalozenie_lewe_mm: number;
    nalozenie_prawe_mm: number;
    dach_kat_deg: number;
    domyslny_zawias_id: string;
    szablony_zawiasow: Record<number, string>;
    aktywne_zawiasy: ActiveHingeConfig[];
}

/** Domyślne pozycje zawiasów — te same co w module DRZWI (1 dół, 6 góra). */
const DEFAULT_HINGE_POS_MM: Record<number, number> = {
    1: 120, 2: 570, 3: 910, 4: 1230, 5: 1580, 6: 120
};

/** Minimalna wysokość skrzydła przy krawędzi pionowej — mniej = brak sensu geometrycznego. */
const MIN_WYSOKOSC_SKRZYDLA_MM = 60;

// ─── Normalizacja (czysta funkcja, fail-fast) ─────────────────────────────────

/**
 * Zawias musi leżeć na krawędzi PIONOWEJ. Skrzydło z założenia ma jedną
 * stronę równoległą do Z i jedną pochyloną. `rodzaj_drzwi` deklaruje stronę
 * zawiasu, więc niespójność z kątem nachylenia dachu to błąd kontraktu.
 */
function assertHingeOnVerticalEdge(type: SkosneDoorType, dach_kat_deg: number): void {
    if (dach_kat_deg === 0) return; // kąt 0 = dach płaski, obie strony pionowe
    const verticalSide: SkosneDoorType = dach_kat_deg > 0 ? 'RIGHT' : 'LEFT';
    if (type === verticalSide) return;
    throw new Error(
        `Bloki skosne-doors: rodzaj_drzwi="${type}" wskazuje na krawędź pochyloną. `
        + `Zawias może być tylko na krawędzi pionowej (${verticalSide === 'LEFT' ? 'lewą' : 'prawą'}, `
        + `dach_kat_deg=${dach_kat_deg}°).`
    );
}

/**
 * Kanoniczne wejście modułu drzwi skośnych (generatorParams / plan).
 * Wymaga kąta nachylenia wieńca górnego (dach_kat_deg) — zero fallbacków / wartości zastępczych.
 */
export function normalizeSkosneDoorsParams(
    raw: SkosneDoorsPlanParams = {},
    dims: BlokiDimensions_mm
): NormalizedSkosneDoorsParams | null {
    assertCanonicalSkosneDoorsParams(raw);

    const dach_kat_deg = readOptionalNumber(raw, 'dach_kat_deg');
    if (dach_kat_deg === undefined) {
        console.warn(
            '[skosne-doors] Brak dach_kat_deg — drzwi skośne wymagają kąta skosu wieńca górnego. Pomijam plan.'
        );
        return null;
    }

    const rodzaj_drzwi: SkosneDoorType = String(raw.rodzaj_drzwi ?? (dach_kat_deg >= 0 ? 'RIGHT' : 'LEFT')).toUpperCase() === 'RIGHT'
        ? 'RIGHT'
        : 'LEFT';

    const grubosc_frontu_mm = readOptionalNumber(raw, 'grubosc_frontu_mm')
        ?? resolveRuleThicknessMm(skosneDoorsRules, ['DRZWI_SKOSNE', 'FRONT'], 'front_thickness', 'skosne_doors');

    const nalozenie_gora_mm = readOptionalNumber(raw, 'nalozenie_gora_mm') ?? 14;
    const nalozenie_dol_mm = readOptionalNumber(raw, 'nalozenie_dol_mm') ?? 15;
    const nalozenie_lewe_mm = readOptionalNumber(raw, 'nalozenie_lewe_mm') ?? 16;
    const nalozenie_prawe_mm = readOptionalNumber(raw, 'nalozenie_prawe_mm') ?? 16;

    const betaRad = (dach_kat_deg * Math.PI) / 180;
    const tanBeta = Math.tan(betaRad);
    const cosBeta = Math.cos(betaRad);

    const xL = -dims.width_mm / 2 - nalozenie_lewe_mm;
    const xP = +dims.width_mm / 2 + nalozenie_prawe_mm;
    const hLeafL = dims.height_mm + xL * tanBeta + nalozenie_dol_mm + nalozenie_gora_mm * cosBeta;
    const hLeafR = dims.height_mm + xP * tanBeta + nalozenie_dol_mm + nalozenie_gora_mm * cosBeta;
    const minLeafH = Math.min(hLeafL, hLeafR);

    if (minLeafH < MIN_WYSOKOSC_SKRZYDLA_MM) {
        console.warn(
            `[skosne-doors] Najniższy punkt skrzydła ${minLeafH.toFixed(1)} mm `
            + `< ${MIN_WYSOKOSC_SKRZYDLA_MM} mm przy dach_kat_deg=${dach_kat_deg}° — pomijam plan.`
        );
        return null;
    }

    assertHingeOnVerticalEdge(rodzaj_drzwi, dach_kat_deg);

    const domyslny_zawias_id = String(raw.domyslny_zawias_id ?? DEFAULT_HINGE_ID);
    const szablony_zawiasow: Record<number, string> = {};
    for (let i = 1; i <= 6; i++) {
        const tpl = raw[`zawias_${i}_szablon` as `zawias_${HingeIndex}_szablon`];
        if (typeof tpl === 'string' && tpl) szablony_zawiasow[i] = tpl;
    }

    // Światło wnęki przy krawędzi pionowej dla zawiasu 6
    const wnetka_pionowa_mm = rodzaj_drzwi === 'RIGHT'
        ? dims.height_mm + (dims.width_mm / 2) * tanBeta
        : dims.height_mm - (dims.width_mm / 2) * tanBeta;

    const aktywne_zawiasy: ActiveHingeConfig[] = [];
    for (let i = 1; i <= 6; i++) {
        const defaultEnabled = i === 1 || i === 6;
        if (!isHingeEnabled(raw, i, defaultEnabled)) continue;
        const pos = readOptionalNumber(raw, `pozycja_zawias_${i}_mm`) ?? DEFAULT_HINGE_POS_MM[i];
        aktywne_zawiasy.push({
            index: i,
            pozycja_lokalna_z_mm: i === 6 ? Math.max(0, wnetka_pionowa_mm - pos) : pos
        });
    }

    return {
        rodzaj_drzwi,
        grubosc_frontu_mm,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm,
        dach_kat_deg,
        domyslny_zawias_id,
        szablony_zawiasow,
        aktywne_zawiasy
    };
}

// ─── Kalkulacja planu (czysta funkcja) ────────────────────────────────────────

/**
 * Wysokość skrzydła (wraz z nałożeniami) przy krawędzi u.
 *
 * WEJŚCIE `wysokosc_lewy_mm` / `wysokosc_prawy_mm` to WYMIAR ZEWNĘTRZNY BOKU
 * (PanelModel.height boku korpusu), a NIE światło wnęki. Przed obliczeniem
 * skrzydła odejmujemy oba wieńce:
 *   - dół: grubosc_wience_dolnego (wieniec dolny jest prosty)
 *   - góra: grubosc_wience_gornego / cos β (wieniec skośny ma grubość
 *     zmierzoną PROSTOPADLE do skosu, więc w pionie daje t / cos β)
 *
 * NAŁOŻENIA NIE SĄ SYMETRYCZNE — to różnica względem modułu DRZWI:
 *  - `nalozenie_gora_mm` mierzone jest PROSTOPADLE do skosu (pokrywa wieniec
 *    o zadaną szerokość od jego lica), więc jego składowa pionowa to
 *    nalozenie · cos β. Przy skosie zbieżnym do pionu cos β → 0, czyli
 *    pokrycie w przestrzenii zanika — to poprawne zachowanie.
 *  - `nalozenie_dol_mm` jest ZAWSZE pionowe: dół skrzydła jest prosty.
/**
 * Wysokość skrzydła (wraz z nałożeniami) przy krawędzi u.
 *
 * Środek wnęki to x = 0 o wysokości wnęki `wysokosc_strefy_mm` (od górnego lica wieńca
 * dolnego do dolnego lica wieńca górnego).
 * Kąt skosu dachu wynosi `dach_kat_deg`.
 *
 * Krawędzie skrzydła w układzie wnęki:
 *   xL = -szerokosc_strefy_mm / 2 - nalozenie_lewe_mm
 *   xP = +szerokosc_strefy_mm / 2 + nalozenie_prawe_mm
 *   x(t) = xL + t * (xP - xL) dla t ∈ [0, 1] (gdzie u = t)
 *
 * Linia dolnego lica wieńca górnego w punkcie x:
 *   Z_wieniec_dol(x) = wysokosc_strefy_mm + x * tan(beta)
 *
 * Nałożenie górne `nalozenie_gora_mm` mierzone jest prostopadle do skosu,
 * więc jego pionowy wznios wynosi: nalozenie_gora_mm * cos(beta).
 * Nałożenie dolne opuszcza dół skrzydła o `nalozenie_dol_mm` poniżej Z = 0.
 *
 * Zatem całkowita wysokość skrzydła w punkcie u:
 *   H(u) = wysokosc_strefy_mm + x * tan(beta) + nalozenie_dol_mm + nalozenie_gora_mm * cos(beta).
 *
 * Przy nalozenie_gora_mm = 0 góra skrzydła idealnie licuje się ze spodem wieńca górnego
 * na całej szerokości (odchylenie 0.00 mm), niezależnie od wartości nałożeń bocznych.
 *
 * @param u 0 = lewa krawędź skrzydła, 1 = prawa krawędź skrzydła.
 */
export function skosneDoorHeightAt(
    u: number,
    wysokosc_strefy_mm: number,
    szerokosc_strefy_mm: number,
    dach_kat_deg: number,
    nalozenie_gora_mm: number,
    nalozenie_dol_mm: number,
    nalozenie_lewe_mm: number = 0,
    nalozenie_prawe_mm: number = 0
): number {
    const t = Math.min(1, Math.max(0, u));
    const betaRad = (dach_kat_deg * Math.PI) / 180;
    const tanBeta = Math.tan(betaRad);
    const cosBeta = Math.cos(betaRad);

    const xL = -szerokosc_strefy_mm / 2 - nalozenie_lewe_mm;
    const xP = +szerokosc_strefy_mm / 2 + nalozenie_prawe_mm;
    const x = xL + t * (xP - xL);

    return wysokosc_strefy_mm
        + x * tanBeta
        + nalozenie_dol_mm
        + nalozenie_gora_mm * cosBeta;
}

/**
 * Kąt skosu dachu względem poziomu [rad].
 */
export function skosBetaRad(dach_kat_deg: number): number {
    return (dach_kat_deg * Math.PI) / 180;
}

/**
 * Pionowa rozpiętość skośnego wieńca: t / cos β.
 */
export function skosRailVerticalSpanMm(
    grubosc_wience_mm: number,
    dach_kat_deg: number
): number {
    if (grubosc_wience_mm === 0) return 0;
    const cos = Math.cos((dach_kat_deg * Math.PI) / 180);
    if (Math.abs(cos) < 1e-6) return grubosc_wience_mm;
    return grubosc_wience_mm / cos;
}

/**
 * Składowa pionowa nałożenia górnego mierzonego prostopadle do skosu:
 * nalozenie · cos(β).
 */
export function skosTopOverlapRiseMm(
    nalozenie_gora_mm: number,
    dach_kat_deg: number
): number {
    if (nalozenie_gora_mm === 0) return 0;
    return nalozenie_gora_mm * Math.cos((dach_kat_deg * Math.PI) / 180);
}

/**
 * Składowa wzdłuż skosu przy prostopadłym nałożeniu: nalozenie · tan(β).
 */
export function skosTopOverlapRunMm(
    nalozenie_gora_mm: number,
    dach_kat_deg: number
): number {
    if (nalozenie_gora_mm === 0) return 0;
    return Math.tan((dach_kat_deg * Math.PI) / 180) * nalozenie_gora_mm;
}

const DEFAULT_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' },
    rotation: [0, 0, 0] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

/** Obrzeża: 3 krawędzie proste okleinowane, pochylona górna = NOTCH (bez auto-okleiny). */
function buildEdgeBanding(): Record<string, any> {
    const band = { active: true, type_id: '0.008x0.022' };
    return {
        '+X': { ...band },
        '-X': { ...band },
        '-Y': { ...band },
        '+Y': { active: false, type_id: 'none' },
        NOTCH: { active: false, type_id: 'none' }
    };
}

export function calculateSkosneDoorsPlan(
    dims_mm: BlokiDimensions_mm,
    params: NormalizedSkosneDoorsParams
): BlokiPlanResult {
    if (!params) return { parts: [], hardware: [] };

    const parts: BlokiPart[] = [];
    const hardware: BlokiHardware[] = [];

    const { width_mm: szerokosc_strefy_mm, depth_mm: glebokosc_strefy_mm, height_mm: wysokosc_strefy_mm } = dims_mm;
    const {
        rodzaj_drzwi,
        grubosc_frontu_mm,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm,
        dach_kat_deg,
        domyslny_zawias_id,
        szablony_zawiasow,
        aktywne_zawiasy
    } = params;

    const rootSubs = (skosneDoorsRules as any).model_tree?.root_assembly?.subcomponents || {};
    const doorRule = rootSubs.DOOR_SKOSNY;

    const szerokosc_drzwi_mm = szerokosc_strefy_mm + nalozenie_lewe_mm + nalozenie_prawe_mm;
    const pozycja_x_mm = (nalozenie_prawe_mm - nalozenie_lewe_mm) / 2;
    const pozycja_y_mm = -(glebokosc_strefy_mm / 2 + grubosc_frontu_mm / 2);

    // Kąt nachylenia dachu pochodzi bezpośrednio z korpusu (dach_kat_deg).
    // Wysokość na środku wnęki to wysokosc_strefy_mm (dims_mm.height_mm).
    // Ekstrapolacja na krawędzie skrzydła uwzględnia nałożenia lewe i prawe.
    const wysokosc_lewa_drzwi_mm = skosneDoorHeightAt(
        0,
        wysokosc_strefy_mm,
        szerokosc_strefy_mm,
        dach_kat_deg,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm
    );
    const wysokosc_prawa_drzwi_mm = skosneDoorHeightAt(
        1,
        wysokosc_strefy_mm,
        szerokosc_strefy_mm,
        dach_kat_deg,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm
    );
    const wysokosc_drzwi_mm = Math.max(wysokosc_lewa_drzwi_mm, wysokosc_prawa_drzwi_mm);

    // Blokowy układ współrzędnych: Z=0 na spodzie strefy.
    // Skrzydło sięga od −nalozenie_dol_mm do wysokosc_drzwi_mm.
    const spod_drzwi_mm = -nalozenie_dol_mm;
    const pozycja_z_mm = spod_drzwi_mm + wysokosc_drzwi_mm / 2;

    // Obrys w ramce bbox (plateW × plateD): dół płaski, góra pochylona.
    const outline2d = [
        [0, 0],
        [szerokosc_drzwi_mm, 0],
        [szerokosc_drzwi_mm, wysokosc_prawa_drzwi_mm],
        [0, wysokosc_lewa_drzwi_mm]
    ];

    const hingeSide: 'left' | 'right' = rodzaj_drzwi === 'LEFT' ? 'left' : 'right';

    const buildHingeFeatures = (): any[] => {
        const features: any[] = [];
        for (const hinge of aktywne_zawiasy) {
            const hingeId = resolveHingeId(hinge.index, domyslny_zawias_id, szablony_zawiasow);
            const frontHoles = hingeFrontHolesMm(hingeId);
            const templateId = hingeTemplateId(hingeId);
            const vCenter = hinge.pozycja_lokalna_z_mm + nalozenie_dol_mm;

            for (const hole of frontHoles) {
                const u = hingeSide === 'left' ? hole.edgeDist : (szerokosc_drzwi_mm - hole.edgeDist);
                const kind = hole.isCup ? 'cup' : 'screw';
                const suffix = hole.isCup ? '' : `_${hole.name || 's'}`;
                features.push({
                    id: `hinge_${kind}_${hingeSide}_${hinge.index}${suffix}`,
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
                        side: hingeSide,
                        hardwareId: `hinge_${hingeSide}_${hinge.index}`
                    }
                });
            }
        }
        return features;
    };

    parts.push({
        name: rodzaj_drzwi === 'LEFT' ? 'Drzwi_Skosne_Lewe' : 'Drzwi_Skosne_Prawe',
        role: 'FRONT',
        nodeType: 'PART',
        dim: { x: szerokosc_drzwi_mm, y: grubosc_frontu_mm, z: wysokosc_drzwi_mm },
        loc: { x: pozycja_x_mm, y: pozycja_y_mm, z: pozycja_z_mm },
        lcs: doorRule?.lcs || DEFAULT_LCS,
        edge_banding: buildEdgeBanding(),
        features: buildHingeFeatures(),
        customProperties: { outline2d, shape: 'skos_front' },
        meta: {
            skosFront: rodzaj_drzwi,
            hingeSide,
            verticalEdge: rodzaj_drzwi === 'LEFT' ? '-X' : '+X',
            slantedEdge: rodzaj_drzwi === 'LEFT' ? '+Y' : '-Y',
            dach_kat_deg
        }
    });

    for (const hinge of aktywne_zawiasy) {
        const hingeId = resolveHingeId(hinge.index, domyslny_zawias_id, szablony_zawiasow);
        const vCenter = hinge.pozycja_lokalna_z_mm + nalozenie_dol_mm;
        const cupHole = hingeFrontHolesMm(hingeId).find(h => h.isCup);
        const cupEdgeDist = cupHole?.edgeDist ?? DEFAULT_HINGE_CUP_EDGE_DIST_MM;
        const u = hingeSide === 'left' ? cupEdgeDist : (szerokosc_drzwi_mm - cupEdgeDist);

        hardware.push({
            id: `hinge_${hingeSide}_${hinge.index}`,
            name: `Zawias ${hinge.index} (${hingeSide === 'left' ? 'Lewy' : 'Prawy'}) [${hingeId}]`,
            hardwareType: 'HINGE',
            hardwareId: hingeId,
            side: hingeSide,
            loc: {
                x: pozycja_x_mm - szerokosc_drzwi_mm / 2 + u,
                y: pozycja_y_mm,
                z: spod_drzwi_mm + vCenter
            },
            params: { hingeIndex: hinge.index, localZ: hinge.pozycja_lokalna_z_mm, side: hingeSide }
        });
    }

    return { parts, hardware };
}