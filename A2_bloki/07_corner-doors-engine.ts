/**
 * corner-doors-engine.ts — Bloki DRZWI NAROŻNE (blok_corner_doors)
 *
 * Dwa fronty prostopadłe w narożniku L.
 * Geometria wyłącznie z gabarytu Bloku (width×depth) + szczelina / nałożenia / grubość frontu.
 * Referencje (wcięcie L wieńca, boki, …) ustawia użytkownik — silnik ich nie zgaduje
 * i nie czyta bok_lewy / pleców / głębokości korpusu.
 *
 * Konwencja SB (cornerAt = innerL_wieniec):
 *   ścianka pionowa wcięcia  → x = −width/2
 *   ścianka pozioma wcięcia  → y = +depth/2
 *   front wnęki              → y = −depth/2
 */
import { DEFAULT_HINGE_CUP_EDGE_DIST_MM, DEFAULT_HINGE_ID, hingeFrontHolesMm, hingeTemplateId } from '../B1_biblioteka/index.js';
import type { CornerDoorsPlanParams } from './01_bloki-module-types.js';

const EDGE_BANDING = {
    '+X': { active: true, type_id: '0.008x0.022' },
    '-X': { active: true, type_id: '0.008x0.022' },
    '+Y': { active: true, type_id: '0.008x0.022' },
    '-Y': { active: true, type_id: '0.008x0.022' }
};

/** Drzwi_Prawe — na ściance poziomej wcięcia (y = +depth/2). */
const LCS_DRZWI_PRAWE = {
    mapping: { X: 'x', Y: 'z', Z: 'y' },
    rotation: [0, 0, 0] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

/** Drzwi_Lewe — na ściance pionowej wcięcia (x = −width/2). */
const LCS_DRZWI_LEWE = {
    mapping: { X: 'x', Y: 'z', Z: 'y' },
    rotation: [0, 0, 90] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

/** Odsunięcie płaszczyzny drzwi od ścianki wieńca L (mm). */
const ODS_WIENIEC_MM = 1;

/** Wejście generatorParams drzwi narożnych — wyłącznie kanoniczne klucze *_mm / uzyj_zawias_* / pozycja_zawias_*_mm. */
export type CornerDoorsParams = CornerDoorsPlanParams;

/** Wycofane nazwy → kanoniczne (SSOT strażnika i audytu). */
export const LEGACY_CORNER_DOORS_PARAM_ALIASES: Readonly<Record<string, string>> = {
    thickness: 'grubosc_frontu_mm',
    front_thickness: 'grubosc_frontu_mm',
    szcz_srodkowa: 'szczelina_srodkowa_mm',
    ov_top: 'nalozenie_gora_mm',
    ov_bottom: 'nalozenie_dol_mm',
    nalozenie_lewe: 'nalozenie_lewe_mm',
    nalozenie_prawe: 'nalozenie_prawe_mm',
    use_hinge_1: 'uzyj_zawias_1',
    use_hinge_2: 'uzyj_zawias_2',
    use_hinge_3: 'uzyj_zawias_3',
    use_hinge_4: 'uzyj_zawias_4',
    use_hinge_5: 'uzyj_zawias_5',
    use_hinge_6: 'uzyj_zawias_6',
    hinge_1_pos: 'pozycja_zawias_1_mm',
    hinge_2_pos: 'pozycja_zawias_2_mm',
    hinge_3_pos: 'pozycja_zawias_3_mm',
    hinge_4_pos: 'pozycja_zawias_4_mm',
    hinge_5_pos: 'pozycja_zawias_5_mm',
    hinge_6_pos: 'pozycja_zawias_6_mm',
    hinge_1_template: 'zawias_1_szablon',
    hinge_2_template: 'zawias_2_szablon',
    hinge_3_template: 'zawias_3_szablon',
    hinge_4_template: 'zawias_4_szablon',
    hinge_5_template: 'zawias_5_szablon',
    hinge_6_template: 'zawias_6_szablon',
    hinge_template: 'szablon_zawiasu_domyslny',
    hingeTemplate: 'szablon_zawiasu_domyslny',
    nalozenie_zawias_1_mm: 'pozycja_zawias_1_mm',
    nalozenie_zawias_2_mm: 'pozycja_zawias_2_mm',
    nalozenie_zawias_3_mm: 'pozycja_zawias_3_mm',
    nalozenie_zawias_4_mm: 'pozycja_zawias_4_mm',
    nalozenie_zawias_5_mm: 'pozycja_zawias_5_mm',
    nalozenie_zawias_6_mm: 'pozycja_zawias_6_mm',
};

export function assertCanonicalCornerDoorsParams(raw: object | null | undefined): void {
    if (!raw) return;
    const found: string[] = [];
    for (const key of Object.keys(raw)) {
        if ((raw as Record<string, unknown>)[key] === undefined) continue;
        const canonical = LEGACY_CORNER_DOORS_PARAM_ALIASES[key];
        if (canonical && canonical !== key) found.push(`${key} → ${canonical}`);
    }
    if (found.length === 0) return;
    throw new Error(
        `Bloki corner-doors: wycofane nazwy parametrów (${found.join(', ')}). ` +
        `Użyj wyłącznie kanonicznych kluczy *_mm / uzyj_zawias_* / pozycja_zawias_*_mm.`
    );
}

function readOptionalMm(raw: object, key: string): number | undefined {
    const v = (raw as Record<string, unknown>)[key];
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

function requireParamMm(raw: object, key: string, label: string): number | null {
    const n = readOptionalMm(raw, key);
    if (n !== undefined) return n;
    console.warn(
        `[corner-doors] Brak wymaganego parametru "${label}" (${key}) — nie podstawiam wartości, pomijam plan.`
    );
    return null;
}

function isHingeEnabled(raw: object, index: number, defaultEnabled: boolean): boolean {
    const key = `uzyj_zawias_${index}`;
    const value = (raw as Record<string, unknown>)[key];
    if (value === undefined) return defaultEnabled;
    return value !== false;
}

type CornerPlacement = {
    drzwiPraweSzerokosc: number;
    drzwiLeweSzerokosc: number;
    drzwiPrawePosX: number;
    drzwiPrawePosY: number;
    drzwiLewePosX: number;
    drzwiLewePosY: number;
    drzwiPraweLcs: typeof LCS_DRZWI_PRAWE;
    drzwiLeweLcs: typeof LCS_DRZWI_LEWE;
    drzwiPraweHingeSide: 'left' | 'right';
    drzwiLeweHingeSide: 'left' | 'right';
    drzwiPraweGapSign: 1 | -1;
    drzwiLeweGapSign: 1 | -1;
};

/**
 * Układ L w lokalnym SB: narożnik wcięcia = (−W/2, +D/2).
 *
 *   drzwi_prawe ≈ width  − szcz/2 + nalozenie_prawe − grubość
 *   drzwi_lewe  ≈ depth  − szcz/2 + nalozenie_lewe  − grubość
 *
 * Przy width = depth i równych nałożeniach drzwi są równe.
 * Standard: SB 352×352, szcz 8, nalozenie 16, t 18 → obie 346 mm.
 */
function computeInnerLFromBloki(
    width_mm: number,
    depth_mm: number,
    grubosc_frontu_mm: number,
    polowa_szczeliny_srodkowej_mm: number,
    nalozenie_prawe_mm: number,
    nalozenie_lewe_mm: number
): CornerPlacement {
    const xNotch = -width_mm / 2;
    const yNotch = depth_mm / 2;
    const frontY = -depth_mm / 2;

    const drzwiPraweSzerokosc0 = Math.max(1, width_mm - polowa_szczeliny_srodkowej_mm + nalozenie_prawe_mm);
    const drzwiLeweSzerokosc0 = Math.max(1, depth_mm - polowa_szczeliny_srodkowej_mm + nalozenie_lewe_mm);

    const drzwiPraweSzerokosc = Math.max(1, drzwiPraweSzerokosc0 - grubosc_frontu_mm);
    const drzwiLeweSzerokosc = Math.max(1, drzwiLeweSzerokosc0 - grubosc_frontu_mm);

    const drzwiPraweKrawedzZew = xNotch + polowa_szczeliny_srodkowej_mm + drzwiPraweSzerokosc0;
    const drzwiLeweKrawedzFront = frontY - nalozenie_lewe_mm;

    return {
        drzwiPraweSzerokosc,
        drzwiLeweSzerokosc,

        drzwiPrawePosX: drzwiPraweKrawedzZew - drzwiPraweSzerokosc / 2,
        drzwiPrawePosY: yNotch - grubosc_frontu_mm / 2 - ODS_WIENIEC_MM,

        drzwiLewePosX: xNotch + grubosc_frontu_mm / 2 - ODS_WIENIEC_MM,
        drzwiLewePosY: drzwiLeweKrawedzFront + drzwiLeweSzerokosc / 2,

        drzwiPraweLcs: LCS_DRZWI_PRAWE,
        drzwiLeweLcs: LCS_DRZWI_LEWE,
        drzwiPraweHingeSide: 'right',
        drzwiLeweHingeSide: 'left',
        drzwiPraweGapSign: 1,
        drzwiLeweGapSign: -1 };
}

import type {
    BlokiDimensions_mm,
    BlokiPart,
    BlokiHardware,
    BlokiPlanResult
} from './01_bloki-types.js';

export interface CornerHingeConfig {
    index: number;
    localZ: number;
}

export interface NormalizedCornerDoorsParams {
    grubosc_frontu_mm: number;
    szczelina_srodkowa_mm: number;
    nalozenie_gora_mm: number;
    nalozenie_dol_mm: number;
    nalozenie_prawe_mm: number;
    nalozenie_lewe_mm: number;
    otwieranie: string;
    szablon_zawiasu_domyslny: string;
    zawiasy: CornerHingeConfig[];
    szablony_zawiasow_indywidualne: Record<number, string>;
}

export function normalizeCornerDoorsParams(
    raw: CornerDoorsPlanParams = {},
    dims: BlokiDimensions_mm
): NormalizedCornerDoorsParams | null {
    assertCanonicalCornerDoorsParams(raw);

    const height = dims.height_mm;

    const thickness = requireParamMm(raw, 'grubosc_frontu_mm', 'grubość frontu');
    const szcz_srodkowa = requireParamMm(raw, 'szczelina_srodkowa_mm', 'szczelina środkowa');
    const ovTop = requireParamMm(raw, 'nalozenie_gora_mm', 'nałożenie góra');
    const ovBottom = requireParamMm(raw, 'nalozenie_dol_mm', 'nałożenie dół');
    const nalozenie_prawe = requireParamMm(raw, 'nalozenie_prawe_mm', 'nałożenie prawe');
    const nalozenie_lewe = requireParamMm(raw, 'nalozenie_lewe_mm', 'nałożenie lewe');

    if (
        thickness === null ||
        szcz_srodkowa === null ||
        ovTop === null ||
        ovBottom === null ||
        nalozenie_prawe === null ||
        nalozenie_lewe === null
    ) {
        return null;
    }

    const zawiasy: CornerHingeConfig[] = [];
    for (let i = 1; i <= 6; i++) {
        const defaultEnabled = i === 1 || i === 6;
        if (!isHingeEnabled(raw, i, defaultEnabled)) continue;
        const posKey = `pozycja_zawias_${i}_mm`;
        const z = readOptionalMm(raw, posKey);
        if (z === undefined) {
            console.warn(`[corner-doors] Brak ${posKey} przy włączonym zawiasie ${i} — pomijam zawias.`);
            continue;
        }
        zawiasy.push({ index: i, localZ: i === 6 ? Math.max(0, height - z) : z });
    }

    const szablon_zawiasu_domyslny = raw.szablon_zawiasu_domyslny || DEFAULT_HINGE_ID;
    const szablony_zawiasow_indywidualne: Record<number, string> = {};
    for (let i = 1; i <= 6; i++) {
        const tpl = raw[`zawias_${i}_szablon` as `zawias_${1 | 2 | 3 | 4 | 5 | 6}_szablon`];
        if (typeof tpl === 'string' && tpl) {
            szablony_zawiasow_indywidualne[i] = tpl;
        }
    }

    return {
        grubosc_frontu_mm: thickness,
        szczelina_srodkowa_mm: szcz_srodkowa,
        nalozenie_gora_mm: ovTop,
        nalozenie_dol_mm: ovBottom,
        nalozenie_prawe_mm: nalozenie_prawe,
        nalozenie_lewe_mm: nalozenie_lewe,
        otwieranie: raw.otwieranie || 'jednostronna',
        szablon_zawiasu_domyslny,
        zawiasy,
        szablony_zawiasow_indywidualne
    };
}

export function calculateCornerDoorsPlan(
    dims_mm: BlokiDimensions_mm,
    params: NormalizedCornerDoorsParams
): BlokiPlanResult {
    const parts: any[] = [];
    const hardware: any[] = [];

    const width_mm = dims_mm.width_mm;
    const height_mm = dims_mm.height_mm;
    const depth_mm = dims_mm.depth_mm;
    const grubosc_frontu_mm = params.grubosc_frontu_mm;
    const nalozenie_gora_mm = params.nalozenie_gora_mm;
    const nalozenie_dol_mm = params.nalozenie_dol_mm;
    const szczelina_srodkowa_mm = params.szczelina_srodkowa_mm;
    const nalozenie_prawe_mm = params.nalozenie_prawe_mm;
    const nalozenie_lewe_mm = params.nalozenie_lewe_mm;

    const baseHingeId = params.szablon_zawiasu_domyslny;
    const resolveHingeId = (index: number): string => {
        if (params.szablony_zawiasow_indywidualne[index]) return params.szablony_zawiasow_indywidualne[index];
        if (baseHingeId === 'BLUM_71B3550' || baseHingeId === 'BLUM_71T3550') {
            return index % 2 === 1 ? 'BLUM_71B3550' : 'BLUM_71T3550';
        }
        return baseHingeId;
    };

    const totalDoorHeight_mm = height_mm + nalozenie_gora_mm + nalozenie_dol_mm;
    const posZ = height_mm / 2 + (nalozenie_gora_mm - nalozenie_dol_mm) / 2;
    const polowa_szczeliny_srodkowej_mm = szczelina_srodkowa_mm / 2;
    const uklad = computeInnerLFromBloki(
        width_mm,
        depth_mm,
        grubosc_frontu_mm,
        polowa_szczeliny_srodkowej_mm,
        nalozenie_prawe_mm,
        nalozenie_lewe_mm
    );

    const buildHingeFeatures = (side: 'left' | 'right', doorWidth_mm: number) => {
        const features: any[] = [];
        for (const hinge of params.zawiasy) {
            const hingeId = resolveHingeId(hinge.index);
            const frontHoles = hingeFrontHolesMm(hingeId);
            const templateId = hingeTemplateId(hingeId);
            const vCenter = hinge.localZ + nalozenie_dol_mm;
            for (const hole of frontHoles) {
                const u = side === 'left' ? hole.edgeDist : doorWidth_mm - hole.edgeDist;
                features.push({
                    id: `hinge_${hole.isCup ? 'cup' : 'screw'}_${side}_${hinge.index}${hole.isCup ? '' : `_${hole.name || 's'}`}`,
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
                        side,
                        hingeInGap: true,
                        hardwareId: `hinge_gap_${side}_${hinge.index}`
                    }
                });
            }
        }
        return features;
    };

    parts.push({
        name: 'Drzwi_Prawe',
        role: 'FRONT',
        dim: { x: uklad.drzwiPraweSzerokosc, y: grubosc_frontu_mm, z: totalDoorHeight_mm },
        loc: { x: uklad.drzwiPrawePosX, y: uklad.drzwiPrawePosY, z: posZ },
        lcs: { ...uklad.drzwiPraweLcs },
        edge_banding: EDGE_BANDING,
        features: buildHingeFeatures(uklad.drzwiPraweHingeSide, uklad.drzwiPraweSzerokosc),
        meta: { cornerLeaf: 'PRAWE', hingeInGap: true, cornerAt: 'innerL_wieniec' }
    });

    parts.push({
        name: 'Drzwi_Lewe',
        role: 'FRONT',
        dim: { x: uklad.drzwiLeweSzerokosc, y: grubosc_frontu_mm, z: totalDoorHeight_mm },
        loc: { x: uklad.drzwiLewePosX, y: uklad.drzwiLewePosY, z: posZ },
        lcs: { ...uklad.drzwiLeweLcs },
        edge_banding: EDGE_BANDING,
        features: buildHingeFeatures(uklad.drzwiLeweHingeSide, uklad.drzwiLeweSzerokosc),
        meta: { cornerLeaf: 'LEWE', hingeInGap: true, cornerAt: 'innerL_wieniec' }
    });

    for (const hinge of params.zawiasy) {
        const hingeId = resolveHingeId(hinge.index);
        const vCenter = hinge.localZ + nalozenie_dol_mm;
        const cupEdgeDist = hingeFrontHolesMm(hingeId).find(h => h.isCup)?.edgeDist ?? DEFAULT_HINGE_CUP_EDGE_DIST_MM;

        hardware.push({
            id: `hinge_gap_prawe_${hinge.index}`,
            name: `Zawias ${hinge.index} (fuga Drzwi_Prawe) [${hingeId}]`,
            hardwareType: 'HINGE',
            hardwareId: hingeId,
            side: 'gap',
            loc: {
                x: uklad.drzwiPrawePosX + uklad.drzwiPraweGapSign * (uklad.drzwiPraweSzerokosc / 2 - cupEdgeDist),
                y: uklad.drzwiPrawePosY,
                z: posZ - totalDoorHeight_mm / 2 + vCenter
            },
            params: { hingeIndex: hinge.index, localZ: hinge.localZ, side: 'gap', cornerLeaf: 'PRAWE', cornerAt: 'innerL_wieniec' }
        });

        hardware.push({
            id: `hinge_gap_lewe_${hinge.index}`,
            name: `Zawias ${hinge.index} (fuga Drzwi_Lewe) [${hingeId}]`,
            hardwareType: 'HINGE',
            hardwareId: hingeId,
            side: 'gap',
            loc: {
                x: uklad.drzwiLewePosX,
                y: uklad.drzwiLewePosY + uklad.drzwiLeweGapSign * (uklad.drzwiLeweSzerokosc / 2 - cupEdgeDist),
                z: posZ - totalDoorHeight_mm / 2 + vCenter
            },
            params: { hingeIndex: hinge.index, localZ: hinge.localZ, side: 'gap', cornerLeaf: 'LEWE', cornerAt: 'innerL_wieniec' }
        });
    }

    return { parts, hardware };
}


