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

import skosneDoorsRules from './06_skosne-doors_3_rules_V1.json';
import { resolveRuleThicknessMm } from './01_bloki-rules-helper.js';
import type {
    BlokiDimensions_mm,
    BlokiHardware,
    BlokiPart,
    BlokiPlanResult
} from './01_bloki-types.js';
import type { HingeIndex, SkosneDoorsPlanParams } from './01_bloki-module-types.js';
import {
    DEFAULT_HINGE_CUP_EDGE_DIST_MM,
    DEFAULT_HINGE_ID,
    hingeFrontHolesMm,
    hingeTemplateId
} from '../B1_biblioteka/index.js';
import { resolveHingeId } from './05_doors-engine.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import {
    assertCanonicalSkosneDoorsParams,
    isHingeEnabled,
    readOptionalNumber
} from './01_bloki-module-param-guards.js';

export { assertCanonicalSkosneDoorsParams, LEGACY_SKOSNE_DOORS_PARAM_ALIASES }
    from './01_bloki-module-param-guards.js';

// ─── Typy domenowe ────────────────────────────────────────────────────────────

/** Strona zawiasu = strona pionowej (wysokiej) krawędzi trapezu, lub obie ('DOUBLE'). */
export type SkosneDoorType = 'LEFT' | 'RIGHT' | 'DOUBLE';

export interface ActiveHingeConfig {
    index: number;
    pozycja_lokalna_z_mm: number;
    szablon_id?: string;
}

export interface NormalizedSkosneDoorsParams {
    rodzaj_drzwi: SkosneDoorType;
    grubosc_frontu_mm: number;
    szczelina_mm: number;
    nalozenie_gora_mm: number;
    nalozenie_dol_mm: number;
    nalozenie_lewe_mm: number;
    nalozenie_prawe_mm: number;
    dach_kat_deg: number;
    domyslny_zawias_id: string;
    szablony_zawiasow: Record<number, string>;
    aktywne_zawiasy: ActiveHingeConfig[];
    aktywne_zawiasy_lewe: ActiveHingeConfig[];
    aktywne_zawiasy_prawe: ActiveHingeConfig[];
    szablony_zawiasow_lewe: Record<number, string>;
    szablony_zawiasow_prawe: Record<number, string>;
    pozycja_zawias_6_mm?: number;
}

/** Domyślne pozycje zawiasów — te same co w module DRZWI (1 dół, 6 góra). */
export const DEFAULT_HINGE_POS_MM: Record<number, number> = {
    1: 120, 2: 570, 3: 910, 4: 1230, 5: 1580, 6: 120
};

/** Minimalna wysokość skrzydła przy krawędzi pionowej — mniej = brak sensu geometrycznego. */
const MIN_WYSOKOSC_SKRZYDLA_MM = 60;

// ─── Normalizacja (czysta funkcja, fail-fast) ─────────────────────────────────

/**
 * Dla pojedynczego skrzydła zawias musi leżeć na krawędzi PIONOWEJ.
 * Dla 'DOUBLE' oba skrzydła montowane są na zewnętrznych krawędziach pionowych (lewy i prawy bok).
 */
function assertHingeOnVerticalEdge(type: SkosneDoorType, dach_kat_deg: number): void {
    if (type === 'DOUBLE' || dach_kat_deg === 0) return; // 'DOUBLE' ma krawędzie z zawiasami po lewej i prawej (obie pionowe)
    const verticalSide: SkosneDoorType = dach_kat_deg > 0 ? 'RIGHT' : 'LEFT';
    if (type === verticalSide) return;
    throw new Error(
        `Bloki skosne-doors: rodzaj_drzwi="${type}" wskazuje na krawędź pochyloną. `
        + `Zawias może być tylko na krawędzi pionowej (${verticalSide === 'LEFT' ? 'lewą' : 'prawą'}, `
        + `dach_kat_deg=${dach_kat_deg}°).`
    );
}

/**
 * Sprawdza, czy oba skrzydła drzwi skośnych podwójnych są geometrycznie równe
 * (różnica wysokości na całej szerokości wnęki mniejsza niż 1.0 mm).
 */
export function areSkosneDoorLeavesEqual(
    roofAngleDeg: number | undefined,
    width_mm: number
): boolean {
    if (roofAngleDeg === undefined || width_mm <= 0) return true;
    const betaRad = (roofAngleDeg * Math.PI) / 180;
    const diff_mm = Math.abs(width_mm * Math.tan(betaRad));
    return diff_mm < 1.0;
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

    let rawDoorType = String(raw.rodzaj_drzwi ?? (dach_kat_deg >= 0 ? 'RIGHT' : 'LEFT')).toUpperCase();
    if (rawDoorType === 'SINGLE_LEFT') rawDoorType = 'LEFT';
    if (rawDoorType === 'SINGLE_RIGHT') rawDoorType = 'RIGHT';
    const rodzaj_drzwi: SkosneDoorType = (rawDoorType === 'RIGHT' || rawDoorType === 'DOUBLE')
        ? rawDoorType
        : 'LEFT';

    const grubosc_frontu_mm = readOptionalNumber(raw, 'grubosc_frontu_mm')
        ?? resolveRuleThicknessMm(skosneDoorsRules, ['DRZWI_SKOSNE', 'FRONT'], 'front_thickness', 'skosne_doors');

    const szczelina_mm = readOptionalNumber(raw, 'szczelina_mm') ?? 4;
    const nalozenie_gora_mm = readOptionalNumber(raw, 'nalozenie_gora_mm') ?? 14;
    const nalozenie_dol_mm = readOptionalNumber(raw, 'nalozenie_dol_mm') ?? 15;
    const nalozenie_lewe_mm = readOptionalNumber(raw, 'nalozenie_lewe_mm') ?? 16;
    const nalozenie_prawe_mm = readOptionalNumber(raw, 'nalozenie_prawe_mm') ?? 16;

    const betaRad = (dach_kat_deg * Math.PI) / 180;
    const tanBeta = Math.tan(betaRad);
    const cosBeta = Math.cos(betaRad);
    // Nałożenie górne mierzone PROSTOPADLE do skosu (szerokość krycia wieńca):
    // wznios pionowy = n / cos(beta), żeby n == t dało zlicowanie z górą wieńca
    // (wieniec ma w pionie t / cos(beta)). Guard na cos≈0 (skos ~90°).
    const topRise = Math.abs(cosBeta) < 1e-6 ? nalozenie_gora_mm : nalozenie_gora_mm / cosBeta;

    const xL = -dims.width_mm / 2 - nalozenie_lewe_mm;
    const xP = +dims.width_mm / 2 + nalozenie_prawe_mm;
    const hLeafL = dims.height_mm + xL * tanBeta + nalozenie_dol_mm + topRise;
    const hLeafR = dims.height_mm + xP * tanBeta + nalozenie_dol_mm + topRise;
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
    const szablony_zawiasow_lewe: Record<number, string> = {};
    const szablony_zawiasow_prawe: Record<number, string> = {};
    for (let i = 1; i <= 6; i++) {
        const baseTpl = raw[`zawias_${i}_szablon` as `zawias_${HingeIndex}_szablon`];
        if (typeof baseTpl === 'string' && baseTpl) szablony_zawiasow[i] = baseTpl;

        const leftTpl = (raw as any)[`zawias_lewy_${i}_szablon`] ?? baseTpl;
        if (typeof leftTpl === 'string' && leftTpl) szablony_zawiasow_lewe[i] = leftTpl;

        const rightTpl = (raw as any)[`zawias_prawy_${i}_szablon`] ?? baseTpl;
        if (typeof rightTpl === 'string' && rightTpl) szablony_zawiasow_prawe[i] = rightTpl;
    }

    // Światło wnęki przy krawędzi pionowej dla zawiasu 6
    const wnetka_lewa_mm = dims.height_mm - (dims.width_mm / 2) * tanBeta;
    const wnetka_prawa_mm = dims.height_mm + (dims.width_mm / 2) * tanBeta;
    const wnetka_pionowa_mm = rodzaj_drzwi === 'RIGHT' ? wnetka_prawa_mm : wnetka_lewa_mm;
    const pozycja_zawias_6_mm = readOptionalNumber(raw, 'pozycja_zawias_6_mm') ?? DEFAULT_HINGE_POS_MM[6];

    // Helper do budowania listy aktywnych zawiasów dla zadanej strony
    const resolveHingesForSide = (
        prefix: '' | 'lewy_' | 'prawy_',
        wnetkaSide_mm: number
    ): ActiveHingeConfig[] => {
        const list: ActiveHingeConfig[] = [];
        for (let i = 1; i <= 6; i++) {
            const defaultEnabled = i === 1 || i === 6;
            const sideEnabled = prefix ? (raw as any)[`uzyj_zawias_${prefix}${i}`] : undefined;
            const enabled = typeof sideEnabled === 'boolean' ? sideEnabled : isHingeEnabled(raw, i, defaultEnabled);
            if (!enabled) continue;

            const basePos = i === 6 ? pozycja_zawias_6_mm : (readOptionalNumber(raw, `pozycja_zawias_${i}_mm`) ?? DEFAULT_HINGE_POS_MM[i]);
            const sidePos = prefix ? readOptionalNumber(raw, `pozycja_zawias_${prefix}${i}_mm`) : undefined;
            const pos = sidePos !== undefined ? sidePos : basePos;

            list.push({
                index: i,
                pozycja_lokalna_z_mm: i === 6 ? Math.max(0, wnetkaSide_mm - pos) : pos
            });
        }
        return list;
    };

    const aktywne_zawiasy = resolveHingesForSide('', wnetka_pionowa_mm);
    const leavesEqual = areSkosneDoorLeavesEqual(dach_kat_deg, dims.width_mm);
    const aktywne_zawiasy_lewe = leavesEqual ? aktywne_zawiasy : resolveHingesForSide('lewy_', wnetka_lewa_mm);
    const aktywne_zawiasy_prawe = leavesEqual ? aktywne_zawiasy : resolveHingesForSide('prawy_', wnetka_prawa_mm);
    const szablony_lewe = leavesEqual ? szablony_zawiasow : szablony_zawiasow_lewe;
    const szablony_prawe = leavesEqual ? szablony_zawiasow : szablony_zawiasow_prawe;

    return {
        rodzaj_drzwi,
        grubosc_frontu_mm,
        szczelina_mm,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm,
        dach_kat_deg,
        domyslny_zawias_id,
        szablony_zawiasow,
        aktywne_zawiasy,
        aktywne_zawiasy_lewe,
        aktywne_zawiasy_prawe,
        szablony_zawiasow_lewe: szablony_lewe,
        szablony_zawiasow_prawe: szablony_prawe,
        pozycja_zawias_6_mm
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
 *  - `nalozenie_gora_mm` mierzone jest PROSTOPADLE do skosu (szerokość krycia
 *    wieńca od jego dolnego lica), więc jego składowa pionowa to
 *    nalozenie / cos β. Dzięki temu nalozenie == grubość wieńca (np. 18)
 *    zlicowuje górę skrzydła z górą wieńca — bez uskoku.
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
 * Nałożenie górne `nalozenie_gora_mm` mierzone jest prostopadle do skosu
 * (szerokość krycia wieńca), więc jego pionowy wznios wynosi: nalozenie_gora_mm / cos(beta).
 * Nałożenie dolne opuszcza dół skrzydła o `nalozenie_dol_mm` poniżej Z = 0.
 *
 * Zatem całkowita wysokość skrzydła w punkcie u:
 *   H(u) = wysokosc_strefy_mm + x * tan(beta) + nalozenie_dol_mm + nalozenie_gora_mm / cos(beta).
 *
 * Przy nalozenie_gora_mm = 0 góra skrzydła idealnie licuje się ze spodem wieńca górnego
 * na całej szerokości (odchylenie 0.00 mm), niezależnie od wartości nałożeń bocznych.
 * Przy nalozenie_gora_mm == grubość wieńca (np. 18) góra skrzydła zlicowuje się
 * z górą wieńca (wieniec ma w pionie t / cos(beta)).
 *
 * @param u 0 = lewa krawędź skrzydła, 1 = prawa krawędź skrzydła.
 */
/**
 * Oblicza wysokość skrzydła w punkcie X (układ wnęki: x=0 to środek).
 */
export function skosneHeightAtX(
    x_mm: number,
    wysokosc_strefy_mm: number,
    dach_kat_deg: number,
    nalozenie_gora_mm: number,
    nalozenie_dol_mm: number
): number {
    const betaRad = (dach_kat_deg * Math.PI) / 180;
    const tanBeta = Math.tan(betaRad);
    const cosBeta = Math.cos(betaRad);
    const topRise = Math.abs(cosBeta) < 1e-6 ? nalozenie_gora_mm : nalozenie_gora_mm / cosBeta;
    return wysokosc_strefy_mm + x_mm * tanBeta + nalozenie_dol_mm + topRise;
}

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
    const xL = -szerokosc_strefy_mm / 2 - nalozenie_lewe_mm;
    const xP = +szerokosc_strefy_mm / 2 + nalozenie_prawe_mm;
    const x = xL + t * (xP - xL);
    return skosneHeightAtX(x, wysokosc_strefy_mm, dach_kat_deg, nalozenie_gora_mm, nalozenie_dol_mm);
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
 * Składowa pionowa nałożenia górnego mierzonego prostopadle do skosu
 * (szerokość krycia wieńca): nalozenie / cos(β).
 * n == grubość wieńca → zlicowanie z górą wieńca (t / cos β), bez uskoku.
 */
export function skosTopOverlapRiseMm(
    nalozenie_gora_mm: number,
    dach_kat_deg: number
): number {
    if (nalozenie_gora_mm === 0) return 0;
    const cos = Math.cos((dach_kat_deg * Math.PI) / 180);
    if (Math.abs(cos) < 1e-6) return nalozenie_gora_mm;
    return nalozenie_gora_mm / cos;
}

/**
 * Składowa pozioma wzniosu n/cos: (n/cos)·sin(β) = n·tan(β).
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
        szczelina_mm = 4,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm,
        dach_kat_deg,
        domyslny_zawias_id,
        szablony_zawiasow,
        aktywne_zawiasy,
        aktywne_zawiasy_lewe,
        aktywne_zawiasy_prawe,
        szablony_zawiasow_lewe,
        szablony_zawiasow_prawe,
        pozycja_zawias_6_mm = DEFAULT_HINGE_POS_MM[6]
    } = params;

    const rootSubs = (skosneDoorsRules as any).model_tree?.root_assembly?.subcomponents || {};
    const doorRule = rootSubs.DOOR_SKOSNY;

    const betaRad = (dach_kat_deg * Math.PI) / 180;
    const tanBeta = Math.tan(betaRad);
    const wnetka_lewa_mm = wysokosc_strefy_mm - (szerokosc_strefy_mm / 2) * tanBeta;
    const wnetka_prawa_mm = wysokosc_strefy_mm + (szerokosc_strefy_mm / 2) * tanBeta;

    const spod_drzwi_mm = -nalozenie_dol_mm;
    const pozycja_y_mm = -(glebokosc_strefy_mm / 2 + grubosc_frontu_mm / 2);

    const getHingesForSide = (side: 'left' | 'right') => {
        if (rodzaj_drzwi === 'DOUBLE') {
            return side === 'left'
                ? (aktywne_zawiasy_lewe ?? aktywne_zawiasy)
                : (aktywne_zawiasy_prawe ?? aktywne_zawiasy);
        }
        return aktywne_zawiasy;
    };

    const getSzablonyForSide = (side: 'left' | 'right') => {
        if (rodzaj_drzwi === 'DOUBLE') {
            return side === 'left'
                ? (szablony_zawiasow_lewe ?? szablony_zawiasow)
                : (szablony_zawiasow_prawe ?? szablony_zawiasow);
        }
        return szablony_zawiasow;
    };

    const buildHingeFeaturesForSide = (
        side: 'left' | 'right',
        doorWidth_mm: number,
        wnetkaSide_mm: number
    ): any[] => {
        const features: any[] = [];
        const hingeList = getHingesForSide(side);
        const tplMap = getSzablonyForSide(side);
        for (const hinge of hingeList) {
            const hingeId = resolveHingeId(hinge.index, domyslny_zawias_id, tplMap);
            const frontHoles = hingeFrontHolesMm(hingeId);
            const templateId = hingeTemplateId(hingeId);
            const localZ = hinge.pozycja_lokalna_z_mm;
            const vCenter = localZ + nalozenie_dol_mm;

            for (const hole of frontHoles) {
                const u = side === 'left' ? hole.edgeDist : (doorWidth_mm - hole.edgeDist);
                const kind = hole.isCup ? 'cup' : 'screw';
                const suffix = hole.isCup ? '' : `_${hole.name || 's'}`;
                const intent = buildHoleMachiningIntent({
                    targetNodeId: side === 'left' ? 'Drzwi_Lewe' : 'Drzwi_Prawe',
                    id: `hinge_${kind}_${side}_${hinge.index}${suffix}`,
                    face: 'FACE_Z_PLUS',
                    side: 'FACE_Z_PLUS',
                    template_id: templateId,
                    drivenBy: {
                        nodeId: `hinge_${side}_${hinge.index}`,
                        role: 'HARDWARE',
                        hardwareType: 'HINGE',
                        partKey: `Hinge_${side === 'left' ? 'L' : 'R'}${hinge.index}`,
                    },
                    rule: hole.isCup ? 'cup' : 'screw',
                    generatedBy: 'blok_doors',
                    u,
                    v: vCenter + hole.yOffset,
                    diameter: hole.dia,
                    depth: hole.depth,
                    sourcePartId: `Hinge_${side === 'left' ? 'L' : 'R'}${hinge.index}`,
                    extraParams: {
                        hinge_id: hingeId,
                        isDoorCup: hole.isCup,
                        isDoorScrew: !hole.isCup,
                        hingeIndex: hinge.index,
                        side,
                        hardwareId: `hinge_${side}_${hinge.index}`,
                    },
                });
                features.push(intent.feature);
            }
        }
        return features;
    };

    const generateHardwareForSide = (
        side: 'left' | 'right',
        doorWidth_mm: number,
        doorPosX_mm: number,
        wnetkaSide_mm: number
    ) => {
        const hingeList = getHingesForSide(side);
        const tplMap = getSzablonyForSide(side);
        for (const hinge of hingeList) {
            const hingeId = resolveHingeId(hinge.index, domyslny_zawias_id, tplMap);
            const localZ = hinge.pozycja_lokalna_z_mm;
            const vCenter = localZ + nalozenie_dol_mm;
            const cupHole = hingeFrontHolesMm(hingeId).find(h => h.isCup);
            const cupEdgeDist = cupHole?.edgeDist ?? DEFAULT_HINGE_CUP_EDGE_DIST_MM;
            const u = side === 'left' ? cupEdgeDist : (doorWidth_mm - cupEdgeDist);

            hardware.push({
                id: `hinge_${side}_${hinge.index}`,
                name: `Zawias ${hinge.index} (${side === 'left' ? 'Lewy' : 'Prawy'}) [${hingeId}]`,
                hardwareType: 'HINGE',
                hardwareId: hingeId,
                side,
                loc: {
                    x: doorPosX_mm - doorWidth_mm / 2 + u,
                    y: pozycja_y_mm,
                    z: spod_drzwi_mm + vCenter
                },
                params: { hingeIndex: hinge.index, localZ, side }
            });
        }
    };

    if (rodzaj_drzwi === 'DOUBLE') {
        const baza_szerokosc_mm = (szerokosc_strefy_mm - szczelina_mm) / 2;
        const szerokosc_lewe_mm = baza_szerokosc_mm + nalozenie_lewe_mm;
        const szerokosc_prawe_mm = baza_szerokosc_mm + nalozenie_prawe_mm;

        const pozycja_lewe_x_mm = -szerokosc_strefy_mm / 2 - nalozenie_lewe_mm + szerokosc_lewe_mm / 2;
        const pozycja_prawe_x_mm = szerokosc_strefy_mm / 2 + nalozenie_prawe_mm - szerokosc_prawe_mm / 2;

        const x_lewe_L = -szerokosc_strefy_mm / 2 - nalozenie_lewe_mm;
        const x_lewe_P = -szczelina_mm / 2;
        const h_lewe_L = skosneHeightAtX(x_lewe_L, wysokosc_strefy_mm, dach_kat_deg, nalozenie_gora_mm, nalozenie_dol_mm);
        const h_lewe_P = skosneHeightAtX(x_lewe_P, wysokosc_strefy_mm, dach_kat_deg, nalozenie_gora_mm, nalozenie_dol_mm);
        const wysokosc_drzwi_lewe_mm = Math.max(h_lewe_L, h_lewe_P);
        const outline2d_lewe = [
            [0, 0],
            [szerokosc_lewe_mm, 0],
            [szerokosc_lewe_mm, h_lewe_P],
            [0, h_lewe_L]
        ];
        const pozycja_lewe_z_mm = spod_drzwi_mm + wysokosc_drzwi_lewe_mm / 2;

        const x_prawe_L = +szczelina_mm / 2;
        const x_prawe_P = +szerokosc_strefy_mm / 2 + nalozenie_prawe_mm;
        const h_prawe_L = skosneHeightAtX(x_prawe_L, wysokosc_strefy_mm, dach_kat_deg, nalozenie_gora_mm, nalozenie_dol_mm);
        const h_prawe_P = skosneHeightAtX(x_prawe_P, wysokosc_strefy_mm, dach_kat_deg, nalozenie_gora_mm, nalozenie_dol_mm);
        const wysokosc_drzwi_prawe_mm = Math.max(h_prawe_L, h_prawe_P);
        const outline2d_prawe = [
            [0, 0],
            [szerokosc_prawe_mm, 0],
            [szerokosc_prawe_mm, h_prawe_P],
            [0, h_prawe_L]
        ];
        const pozycja_prawe_z_mm = spod_drzwi_mm + wysokosc_drzwi_prawe_mm / 2;

        parts.push({
            name: 'Drzwi_Skosne_Lewe',
            role: 'FRONT',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: szerokosc_lewe_mm, y: grubosc_frontu_mm, z: wysokosc_drzwi_lewe_mm },
            loc: { x: pozycja_lewe_x_mm, y: pozycja_y_mm, z: pozycja_lewe_z_mm },
            lcs: doorRule?.lcs || DEFAULT_LCS,
            edge_banding: buildEdgeBanding(),
            features: buildHingeFeaturesForSide('left', szerokosc_lewe_mm, wnetka_lewa_mm),
            customProperties: { outline2d: outline2d_lewe, shape: 'skos_front' },
            meta: {
                skosFront: 'DOUBLE',
                hingeSide: 'left',
                verticalEdge: '-X',
                slantedEdge: '+Y',
                dach_kat_deg
            }
        });

        parts.push({
            name: 'Drzwi_Skosne_Prawe',
            role: 'FRONT',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: szerokosc_prawe_mm, y: grubosc_frontu_mm, z: wysokosc_drzwi_prawe_mm },
            loc: { x: pozycja_prawe_x_mm, y: pozycja_y_mm, z: pozycja_prawe_z_mm },
            lcs: doorRule?.lcs || DEFAULT_LCS,
            edge_banding: buildEdgeBanding(),
            features: buildHingeFeaturesForSide('right', szerokosc_prawe_mm, wnetka_prawa_mm),
            customProperties: { outline2d: outline2d_prawe, shape: 'skos_front' },
            meta: {
                skosFront: 'DOUBLE',
                hingeSide: 'right',
                verticalEdge: '+X',
                slantedEdge: '+Y',
                dach_kat_deg
            }
        });

        generateHardwareForSide('left', szerokosc_lewe_mm, pozycja_lewe_x_mm, wnetka_lewa_mm);
        generateHardwareForSide('right', szerokosc_prawe_mm, pozycja_prawe_x_mm, wnetka_prawa_mm);
    } else {
        const szerokosc_drzwi_mm = szerokosc_strefy_mm + nalozenie_lewe_mm + nalozenie_prawe_mm;
        const pozycja_x_mm = (nalozenie_prawe_mm - nalozenie_lewe_mm) / 2;

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
        const pozycja_z_mm = spod_drzwi_mm + wysokosc_drzwi_mm / 2;

        const outline2d = [
            [0, 0],
            [szerokosc_drzwi_mm, 0],
            [szerokosc_drzwi_mm, wysokosc_prawa_drzwi_mm],
            [0, wysokosc_lewa_drzwi_mm]
        ];

        const hingeSide: 'left' | 'right' = rodzaj_drzwi === 'LEFT' ? 'left' : 'right';
        const wnetkaSide_mm = hingeSide === 'left' ? wnetka_lewa_mm : wnetka_prawa_mm;

        parts.push({
            name: rodzaj_drzwi === 'LEFT' ? 'Drzwi_Skosne_Lewe' : 'Drzwi_Skosne_Prawe',
            role: 'FRONT',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: szerokosc_drzwi_mm, y: grubosc_frontu_mm, z: wysokosc_drzwi_mm },
            loc: { x: pozycja_x_mm, y: pozycja_y_mm, z: pozycja_z_mm },
            lcs: doorRule?.lcs || DEFAULT_LCS,
            edge_banding: buildEdgeBanding(),
            features: buildHingeFeaturesForSide(hingeSide, szerokosc_drzwi_mm, wnetkaSide_mm),
            customProperties: { outline2d, shape: 'skos_front' },
            meta: {
                skosFront: rodzaj_drzwi,
                hingeSide,
                verticalEdge: rodzaj_drzwi === 'LEFT' ? '-X' : '+X',
                slantedEdge: rodzaj_drzwi === 'LEFT' ? '+Y' : '-Y',
                dach_kat_deg
            }
        });

        generateHardwareForSide(hingeSide, szerokosc_drzwi_mm, pozycja_x_mm, wnetkaSide_mm);
    }

    return { parts, hardware };
}