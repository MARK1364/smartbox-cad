/**
 * skosny-geometry.ts
 *
 * Czyste funkcje kalkulacji geometrii korpusów skośnych:
 *  - resolveSkosnyGeometry: prototyp (skos w głąb przód-tył, trapezy boków w outline2d, wieniec górny pochylony)
 *  - resolveSkosnyDachGeometry: pod skośny dach (skos w głąb, boki symetryczne)
 *  - resolveSkosnyLrGeometry: skos w poprzek szerokości lewy/prawy (prostokąty boków o różnych wys., wieniec Rz(-beta), plecy trapez)
 *  - resolveSkosnyLrUcGeometry: skos LR z uciosem (cutAngle i kotwice Z_PLUS / Z_MINUS na styku z wieńcem)
 */

import { CabinetGeometryPart } from '../smartframe-types.js';

export interface SkosnyFbGeometryContext {
    W: number;
    D: number;
    hF: number;
    hB: number;
    maxH: number;
    thickness: number;
    backOffset: number;
    shiftX: number;
    shiftY: number;
    shiftZ: number;
    pXPlus: number;
    pXMinus: number;
    pYPlus: number;
    pYMinus: number;
    leftThick: number;
    rightThick: number;
    innerWidth: number;
    midShift: number;
}

export interface SkosnyLrGeometryContext {
    W_mm?: number;
    D_mm?: number;
    wysokosc_lewy_mm?: number;
    wysokosc_prawy_mm?: number;
    max_wysokosc_mm?: number;
    grubosc_mm?: number;
    /** Grubość wieńca dolnego (WIENIEC_D) — do wyznaczania dolnego brzegu pleców identycznie jak korpus3 */
    grubosc_dolny_mm?: number;
    /** Grubość wieńca górnego (WIENIEC_G) — do wyznaczania górnego brzegu pleców */
    grubosc_gorny_mm?: number;
    odsuniecie_plecow_mm?: number;
    przesuniecie_x_mm?: number;
    przesuniecie_y_mm?: number;
    przesuniecie_z_mm?: number;
    wpuszczenie_prawe_mm?: number;
    wpuszczenie_lewe_mm?: number;
    margines_gorny_mm?: number;
    margines_dolny_mm?: number;
    grubosc_lewy_mm?: number;
    grubosc_prawy_mm?: number;
    szerokosc_wewnetrzna_mm?: number;
    przesuniecie_srodka_mm?: number;
}

/**
 * Geometria korpusu skośnego (prototyp, skos w głąb: przód niski / tył wysoki).
 * Boki-trapezoidy z osobnym obrysem L/P przez lustro osi U.
 */
export function resolveSkosnyGeometry(
    matchedKey: string,
    role: string,
    o: SkosnyFbGeometryContext
): Partial<CabinetGeometryPart> | null {
    const { W, D, hF, hB, maxH, thickness, backOffset } = o;
    // Prawy bok: u=0 na froncie (niski), u=D na tyle (wysoki).
    const outlineR: [number, number][] = [
        [0, 0],
        [D, 0],
        [D, hB],
        [0, hF]
    ];
    // Lewy bok: u=0 na tyle (wysoki), u=D na froncie (niski) — lustro.
    const outlineL: [number, number][] = [
        [0, 0],
        [D, 0],
        [D, hF],
        [0, hB]
    ];

    if (matchedKey === 'BOK_L' || matchedKey === 'SIDE_LEFT' || role === 'LEFT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: maxH, y: D, z: thickness },
            loc: { x: -W / 2 + thickness / 2, y: 0, z: maxH / 2 },
            customProperties: { outline2d: outlineL, shape: 'skos_side' }
        };
    }
    if (matchedKey === 'BOK_P' || matchedKey === 'SIDE_RIGHT' || role === 'RIGHT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: maxH, y: D, z: thickness },
            loc: { x: W / 2 - thickness / 2, y: 0, z: maxH / 2 },
            customProperties: { outline2d: outlineR, shape: 'skos_side' }
        };
    }
    if (matchedKey === 'WIENIEC_D' || matchedKey === 'BOTTOM' || role === 'BOTTOM_PANEL') {
        return {
            thickness,
            dim: { x: o.innerWidth, y: D, z: thickness },
            loc: { x: o.midShift, y: 0, z: thickness / 2 }
        };
    }
    if (matchedKey === 'WIENIEC_G' || matchedKey === 'TOP' || role === 'TOP_PANEL') {
        const betaDeg = Math.atan2(hB - hF, D) * 180 / Math.PI;
        const beta = betaDeg * Math.PI / 180;
        const slopeLen_mm = Math.hypot(D, hB - hF);
        const cut_angle_deg = Math.abs(Math.atan2(hF - hB, D) * 180 / Math.PI);
        const topEndCut = Math.abs(cut_angle_deg) < 0.05 ? 0 : cut_angle_deg;

        const topEndBandFront = topEndCut
            ? { active: false, type_id: 'none', cutAngle: topEndCut, cutAnchor: 'Z_MINUS' as const }
            : { active: false, type_id: 'none' };
        const topEndBandBack = topEndCut
            ? { active: false, type_id: 'none', cutAngle: -topEndCut, cutAnchor: 'Z_MINUS' as const }
            : { active: false, type_id: 'none' };

        return {
            thickness,
            dim: { x: o.innerWidth, y: slopeLen_mm, z: thickness },
            loc: {
                x: o.midShift,
                y: Math.sin(beta) * thickness / 2,
                z: (hF + hB) / 2 - Math.cos(beta) * thickness / 2
            },
            lcs: {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [betaDeg - 90, 0, 0]
            },
            edge_banding: {
                '+X': { active: false, type_id: 'none' },
                '-X': { active: false, type_id: 'none' },
                '-Y': topEndBandFront,
                '+Y': topEndBandBack
            }
        };
    }
    if (matchedKey === 'PLECY' || matchedKey === 'BACK' || role === 'BACK_PANEL') {
        const bottomThick = o.leftThick;
        const topThick = o.leftThick;
        const roofAngle = Math.atan2(hB - hF, D);
        const bottom = o.pYMinus;
        const top = o.pYPlus;
        const left = o.pXMinus;
        const right = o.pXPlus;
        const backH = hB - topThick * Math.cos(roofAngle) - bottomThick + bottom + top;
        const backW = o.innerWidth + left + right;
        return {
            thickness,
            dim: { x: backW, y: thickness, z: backH },
            loc: {
                x: o.midShift + (right - left) / 2 + o.shiftX,
                y: D / 2 + thickness / 2 - backOffset + o.shiftY,
                z: (bottomThick - bottom + hB - topThick * Math.cos(roofAngle) + top) / 2 + o.shiftZ
            }
        };
    }

    console.warn(`[resolveSkosnyGeometry] Skosny: nieznany węzeł "${matchedKey}" (role: "${role}")`);
    return null;
}

/**
 * Korpus pod skośny dach — skos w głąb (przód niski / tył wysoki), boki L=P symetryczne.
 */
export function resolveSkosnyDachGeometry(
    matchedKey: string,
    role: string,
    o: SkosnyFbGeometryContext
): Partial<CabinetGeometryPart> | null {
    const { W, D, hF, hB, maxH, thickness, backOffset } = o;
    const outlineR: [number, number][] = [
        [0, 0],
        [D, 0],
        [D, hB],
        [0, hF]
    ];
    const outlineL: [number, number][] = [
        [0, 0],
        [D, 0],
        [D, hF],
        [0, hB]
    ];

    if (matchedKey === 'BOK_L' || matchedKey === 'SIDE_LEFT' || role === 'LEFT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: maxH, y: D, z: thickness },
            loc: { x: -W / 2 + thickness / 2, y: 0, z: maxH / 2 },
            customProperties: { outline2d: outlineL, shape: 'skos_dach_side' }
        };
    }
    if (matchedKey === 'BOK_P' || matchedKey === 'SIDE_RIGHT' || role === 'RIGHT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: maxH, y: D, z: thickness },
            loc: { x: W / 2 - thickness / 2, y: 0, z: maxH / 2 },
            customProperties: { outline2d: outlineR, shape: 'skos_dach_side' }
        };
    }
    if (matchedKey === 'WIENIEC_D' || matchedKey === 'BOTTOM' || role === 'BOTTOM_PANEL') {
        return {
            thickness,
            dim: { x: o.innerWidth, y: D, z: thickness },
            loc: { x: o.midShift, y: 0, z: thickness / 2 }
        };
    }
    if (matchedKey === 'WIENIEC_G' || matchedKey === 'TOP' || role === 'TOP_PANEL') {
        const betaDeg = Math.atan2(hB - hF, D) * 180 / Math.PI;
        const beta = betaDeg * Math.PI / 180;
        const slopeLen_mm = Math.hypot(D, hB - hF);
        const cut_angle_deg = Math.abs(Math.atan2(hF - hB, D) * 180 / Math.PI);
        const topEndCut = Math.abs(cut_angle_deg) < 0.05 ? 0 : cut_angle_deg;

        const topEndBandFront = topEndCut
            ? { active: false, type_id: 'none', cutAngle: topEndCut, cutAnchor: 'Z_MINUS' as const }
            : { active: false, type_id: 'none' };
        const topEndBandBack = topEndCut
            ? { active: false, type_id: 'none', cutAngle: -topEndCut, cutAnchor: 'Z_MINUS' as const }
            : { active: false, type_id: 'none' };

        return {
            thickness,
            dim: { x: o.innerWidth, y: slopeLen_mm, z: thickness },
            loc: {
                x: o.midShift,
                y: Math.sin(beta) * thickness / 2,
                z: (hF + hB) / 2 - Math.cos(beta) * thickness / 2
            },
            lcs: {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [betaDeg - 90, 0, 0]
            },
            edge_banding: {
                '+X': { active: false, type_id: 'none' },
                '-X': { active: false, type_id: 'none' },
                '-Y': topEndBandFront,
                '+Y': topEndBandBack
            }
        };
    }
    if (matchedKey === 'PLECY' || matchedKey === 'BACK' || role === 'BACK_PANEL') {
        const bottomThick = o.leftThick;
        const topThick = o.leftThick;
        const roofAngle = Math.atan2(hB - hF, D);
        const bottom = o.pYMinus;
        const top = o.pYPlus;
        const left = o.pXMinus;
        const right = o.pXPlus;
        const backH = hB - topThick * Math.cos(roofAngle) - bottomThick + bottom + top;
        const backW = o.innerWidth + left + right;
        return {
            thickness,
            dim: { x: backW, y: thickness, z: backH },
            loc: {
                x: o.midShift + (right - left) / 2 + o.shiftX,
                y: D / 2 + thickness / 2 - backOffset + o.shiftY,
                z: (bottomThick - bottom + hB - topThick * Math.cos(roofAngle) + top) / 2 + o.shiftZ
            }
        };
    }

    console.warn(`[resolveSkosnyDachGeometry] SkosnyDach: nieznany węzeł "${matchedKey}" (role: "${role}")`);
    return null;
}

/**
 * Geometria korpusu skośnego LR (skos w poprzek szerokości: lewy niski / prawy wysoki).
 * Identyczna matematyka z korpus3 — różni się tylko skośną górną krawędzią pleców i lcs wieńca górnego.
 */
export function resolveSkosnyLrGeometry(
    matchedKey: string,
    role: string,
    o: SkosnyLrGeometryContext
): Partial<CabinetGeometryPart> | null {
    const W_mm = o.W_mm ?? 1200;
    const D_mm = o.D_mm ?? 600;
    const h_lewy_mm  = o.wysokosc_lewy_mm ?? 1000;
    const h_prawy_mm = o.wysokosc_prawy_mm ?? 2200;
    const max_wysokosc_mm      = o.max_wysokosc_mm ?? Math.max(h_lewy_mm, h_prawy_mm);
    const grubosc_mm           = o.grubosc_mm ?? 18;
    const grubosc_dolny_mm     = o.grubosc_dolny_mm ?? grubosc_mm;
    const grubosc_gorny_mm     = o.grubosc_gorny_mm ?? grubosc_mm;
    const odsuniecie_plecow_mm = o.odsuniecie_plecow_mm ?? 0;
    const przesuniecie_x_mm    = o.przesuniecie_x_mm ?? 0;
    const przesuniecie_y_mm    = o.przesuniecie_y_mm ?? 0;
    const przesuniecie_z_mm    = o.przesuniecie_z_mm ?? 0;
    const wpuszczenie_prawe_mm = o.wpuszczenie_prawe_mm ?? 0;
    const wpuszczenie_lewe_mm  = o.wpuszczenie_lewe_mm ?? 0;
    const margines_gorny_mm    = o.margines_gorny_mm ?? 0;
    const margines_dolny_mm    = o.margines_dolny_mm ?? 0;
    const grubosc_lewy_mm      = o.grubosc_lewy_mm ?? grubosc_mm;
    const grubosc_prawy_mm     = o.grubosc_prawy_mm ?? grubosc_mm;
    const szerokosc_wewnetrzna_mm = o.szerokosc_wewnetrzna_mm
        ?? (W_mm - grubosc_lewy_mm - grubosc_prawy_mm);
    const przesuniecie_srodka_mm  = o.przesuniecie_srodka_mm
        ?? ((grubosc_lewy_mm - grubosc_prawy_mm) / 2);

    const beta_rad = Math.atan2(h_prawy_mm - h_lewy_mm, szerokosc_wewnetrzna_mm);
    const beta_deg = beta_rad * 180 / Math.PI;

    // ── BOKI ─────────────────────────────────────────────────────────────────
    // identycznie jak korpus3: dim i loc z offsetami krawędzi i przesunięciami
    if (matchedKey === 'BOK_L' || matchedKey === 'SIDE_LEFT' || role === 'LEFT_SIDE_PANEL') {
        const pY = margines_gorny_mm + margines_dolny_mm;
        const pX = wpuszczenie_lewe_mm + wpuszczenie_prawe_mm;
        return {
            thickness: grubosc_lewy_mm,
            dim: { x: h_lewy_mm + pY, y: D_mm + pX, z: grubosc_lewy_mm },
            loc: { x: -W_mm / 2 + grubosc_lewy_mm / 2 + przesuniecie_x_mm,
                   y: (wpuszczenie_prawe_mm - wpuszczenie_lewe_mm) / 2 + przesuniecie_y_mm,
                   z: h_lewy_mm / 2 + (margines_gorny_mm - margines_dolny_mm) / 2 + przesuniecie_z_mm }
        };
    }
    if (matchedKey === 'BOK_P' || matchedKey === 'SIDE_RIGHT' || role === 'RIGHT_SIDE_PANEL') {
        const pY = margines_gorny_mm + margines_dolny_mm;
        const pX = wpuszczenie_lewe_mm + wpuszczenie_prawe_mm;
        return {
            thickness: grubosc_prawy_mm,
            dim: { x: h_prawy_mm + pY, y: D_mm + pX, z: grubosc_prawy_mm },
            loc: { x: W_mm / 2 - grubosc_prawy_mm / 2 + przesuniecie_x_mm,
                   y: (wpuszczenie_prawe_mm - wpuszczenie_lewe_mm) / 2 + przesuniecie_y_mm,
                   z: h_prawy_mm / 2 + (margines_gorny_mm - margines_dolny_mm) / 2 + przesuniecie_z_mm }
        };
    }

    // ── WIENIEC DOLNY ────────────────────────────────────────────────────────
    // identycznie jak korpus3 (dim, loc — z offsetami)
    if (matchedKey === 'WIENIEC_D' || matchedKey === 'BOTTOM' || role === 'BOTTOM_PANEL') {
        const pY = margines_dolny_mm + margines_gorny_mm;
        const pX = wpuszczenie_lewe_mm + wpuszczenie_prawe_mm;
        return {
            thickness: grubosc_mm,
            dim: { x: szerokosc_wewnetrzna_mm + pY, y: D_mm + pX, z: grubosc_mm },
            loc: { x: przesuniecie_srodka_mm + (margines_gorny_mm - margines_dolny_mm) / 2,
                   y: (wpuszczenie_prawe_mm - wpuszczenie_lewe_mm) / 2,
                   z: grubosc_mm / 2 - przesuniecie_z_mm }
        };
    }

    // ── WIENIEC GÓRNY (skośny) ───────────────────────────────────────────────
    // wyjątek: geometria pochylona (lcs rotation) — reszta identyczna z korpus3
    if (matchedKey === 'WIENIEC_G' || matchedKey === 'TOP' || role === 'TOP_PANEL') {
        const slopeLen_mm = Math.hypot(szerokosc_wewnetrzna_mm, h_prawy_mm - h_lewy_mm);
        return {
            thickness: grubosc_mm,
            dim: { x: slopeLen_mm, y: D_mm, z: grubosc_mm },
            loc: {
                x: przesuniecie_srodka_mm + (grubosc_mm / 2) * Math.sin(beta_rad),
                y: 0,
                z: (h_lewy_mm + h_prawy_mm) / 2 - (grubosc_mm / 2) * Math.cos(beta_rad)
            },
            lcs: {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [-90, 0, -beta_deg]
            }
        };
    }

    // ── PLECY ────────────────────────────────────────────────────────────────
    // z_bottom: identycznie jak korpus3 — dolna krawędź we wpuście wieńca dolnego
    // Górna krawędź: skośna linia dachu (jedyny wyjątek od korpus3).
    // WAŻNE: LCS pleców ma rotację [180,0,0] → v=0 to GÓRA w CAD (duże Z),
    //        a v=backH to DÓŁ (małe Z = z_bottom). Obrys: podłoga przy v=backH.
    if (matchedKey === 'PLECY' || matchedKey === 'BACK' || role === 'BACK_PANEL') {
        const overlap_lewy_mm  = wpuszczenie_lewe_mm;
        const overlap_prawy_mm = wpuszczenie_prawe_mm;
        const overlap_dol_mm   = margines_dolny_mm;
        const backW_mm = szerokosc_wewnetrzna_mm + overlap_lewy_mm + overlap_prawy_mm;

        // z_bottom: identycznie jak korpus3
        const z_bottom_mm = grubosc_dolny_mm - overlap_dol_mm;

        // tan_beta_LR: nachylenie po szerokości wewnętrznej (LR używa innerWidth, nie W)
        const tan_beta_LR = (h_prawy_mm - h_lewy_mm) / szerokosc_wewnetrzna_mm;

        // Absolutna wysokość dachu na rozszerzonych krawędziach pleców:
        // − prawa (wyższa): h_prawy + overlap_prawy rozciąga się w głąb boku prawego
        // − lewa (niższa): h_lewy − overlap_lewy rozciąga się w głąb boku lewego
        const rightRoofAbsExt_mm = h_prawy_mm + overlap_prawy_mm * tan_beta_LR;
        const leftRoofAbsExt_mm  = h_lewy_mm  - overlap_lewy_mm  * tan_beta_LR;

        // Pionowa grubość wieńca górnego t / cos(beta): sufit wnęki (środek wnęki)
        // leży o tę wartość poniżej zewnętrznej linii dachu.
        const cos_beta_LR = Math.cos(beta_rad);
        const roofThickVertical_mm = Math.abs(cos_beta_LR) > 1e-6 ? grubosc_gorny_mm / cos_beta_LR : grubosc_gorny_mm;

        const rightRoofInnerExt_mm = rightRoofAbsExt_mm - roofThickVertical_mm;
        const leftRoofInnerExt_mm  = leftRoofAbsExt_mm  - roofThickVertical_mm;

        const rightRoofRel_mm = rightRoofInnerExt_mm - z_bottom_mm;  // prawy (wysoki)
        const leftRoofRel_mm  = leftRoofInnerExt_mm  - z_bottom_mm;  // lewy (niski)

        const maxRoofRel_mm = Math.max(rightRoofRel_mm, leftRoofRel_mm);
        // backH: sufit wnęki (wyższy szczyt) + margines_gorny (wpuszczenie w wieniec górny od środka wnęki)
        const backH_mm = maxRoofRel_mm + margines_gorny_mm;

        // Obrys w LCS: v=backH = podłoga CAD (z_bottom), v=małe = dach CAD
        // Szczyt dachu leży na v=0, niższy szczyt na v = maxRoofRel_mm - roofRel_mm.
        // Powiększenie margines_gorny_mm (i backH_mm) unosi skośną krawędź dachu w CAD Z,
        // a podłoga na v=backH_mm pozostaje na z_bottom_mm.
        const v_right_roof = maxRoofRel_mm - rightRoofRel_mm;
        const v_left_roof  = maxRoofRel_mm - leftRoofRel_mm;
        const outlineBack: [number, number][] = [
            [0,        backH_mm],      // podłoga-lewo
            [backW_mm, backH_mm],      // podłoga-prawo
            [backW_mm, v_right_roof],  // dach-prawo (wyżej w CAD)
            [0,        v_left_roof]    // dach-lewo  (niżej w CAD)
        ];

        return {
            thickness: grubosc_mm,
            dim: { x: backW_mm, y: grubosc_mm, z: backH_mm },
            loc: {
                x: przesuniecie_srodka_mm + (overlap_prawy_mm - overlap_lewy_mm) / 2 + przesuniecie_x_mm,
                y: D_mm / 2 + grubosc_mm / 2 - odsuniecie_plecow_mm + przesuniecie_y_mm,
                z: z_bottom_mm + backH_mm / 2 + przesuniecie_z_mm
            },
            customProperties: {
                outline2d: outlineBack,
                shape: 'skos_back'
            }
        };
    }

    console.warn(`[resolveSkosnyLrGeometry] SkosnyLR: nieznany węzeł "${matchedKey}" (role: "${role}")`);
    return null;
}

/**
 * Korpus skośny LR z uciosem (cutAngle na wieńcu i bokach).
 * Dach opada jednostajnie od x = +W/2 (h_prawy_mm) do x = -W/2 (h_lewy_mm).
 */
export function resolveSkosnyLrUcGeometry(
    matchedKey: string,
    role: string,
    o: SkosnyLrGeometryContext
): Partial<CabinetGeometryPart> | null {
    const W_mm = o.W_mm ?? 1200;
    const D_mm = o.D_mm ?? 600;
    const h_lewy_mm  = o.wysokosc_lewy_mm ?? 1000;
    const h_prawy_mm = o.wysokosc_prawy_mm ?? 2200;
    const max_wysokosc_mm      = o.max_wysokosc_mm ?? Math.max(h_lewy_mm, h_prawy_mm);
    const grubosc_mm           = o.grubosc_mm ?? 18;
    const grubosc_dolny_mm     = o.grubosc_dolny_mm ?? grubosc_mm;
    const grubosc_gorny_mm     = o.grubosc_gorny_mm ?? grubosc_mm;
    const odsuniecie_plecow_mm = o.odsuniecie_plecow_mm ?? 0;
    const przesuniecie_x_mm    = o.przesuniecie_x_mm ?? 0;
    const przesuniecie_y_mm    = o.przesuniecie_y_mm ?? 0;
    const przesuniecie_z_mm    = o.przesuniecie_z_mm ?? 0;
    const wpuszczenie_prawe_mm = o.wpuszczenie_prawe_mm ?? 0;
    const wpuszczenie_lewe_mm  = o.wpuszczenie_lewe_mm ?? 0;
    const margines_gorny_mm    = o.margines_gorny_mm ?? 0;
    const margines_dolny_mm    = o.margines_dolny_mm ?? 0;
    const grubosc_lewy_mm      = o.grubosc_lewy_mm ?? grubosc_mm;
    const grubosc_prawy_mm     = o.grubosc_prawy_mm ?? grubosc_mm;
    const szerokosc_wewnetrzna_mm = o.szerokosc_wewnetrzna_mm
        ?? (W_mm - grubosc_lewy_mm - grubosc_prawy_mm);
    const przesuniecie_srodka_mm  = o.przesuniecie_srodka_mm
        ?? ((grubosc_lewy_mm - grubosc_prawy_mm) / 2);

    // Kąt dachu po pełnej szerokości szafki W_mm (od krawędzi zewnętrznej lewej do prawej)
    const tan_beta     = W_mm !== 0 ? (h_prawy_mm - h_lewy_mm) / W_mm : 0;
    const kat_skosu_rad = Math.atan(tan_beta);
    const kat_skosu_deg = kat_skosu_rad * 180 / Math.PI;
    const cut_angle_deg = Math.abs(kat_skosu_deg) < 0.05 ? 0 : kat_skosu_deg;

    // Pionowy uskok na grubości boku o kąt β: t · tanβ
    const uskok_lewy_mm  = grubosc_lewy_mm  * tan_beta;
    const uskok_prawy_mm = grubosc_prawy_mm * tan_beta;

    const wysokosc_formatki_lewej_mm  = h_lewy_mm  + uskok_lewy_mm;
    const wysokosc_formatki_prawej_mm = h_prawy_mm;

    const z_top_center_mm = (h_lewy_mm + h_prawy_mm) / 2 + przesuniecie_srodka_mm * tan_beta;
    const dlugosc_skosu_mm = Math.hypot(szerokosc_wewnetrzna_mm, szerokosc_wewnetrzna_mm * tan_beta);

    const topEndCut = Math.abs(kat_skosu_deg) < 0.05 ? 0 : kat_skosu_deg;
    const topEndBandRight = topEndCut
        ? { active: false, type_id: 'none', cutAngle: topEndCut,  cutAnchor: 'Z_MINUS' as const }
        : { active: false, type_id: 'none' };
    const topEndBandLeft = topEndCut
        ? { active: false, type_id: 'none', cutAngle: -topEndCut, cutAnchor: 'Z_MINUS' as const }
        : { active: false, type_id: 'none' };

    const sideTopBevelLeft = {
        active: true,
        type_id: '0.008x0.022',
        ...(cut_angle_deg ? { cutAngle: cut_angle_deg,  cutAnchor: 'Z_PLUS'  as const } : {})
    };
    const sideTopBevelRight = {
        active: true,
        type_id: '0.008x0.022',
        ...(cut_angle_deg ? { cutAngle: cut_angle_deg,  cutAnchor: 'Z_MINUS' as const } : {})
    };

    // ── BOKI — identycznie jak korpus3: dim i loc z offsetami krawędzi ───────
    if (matchedKey === 'BOK_L' || matchedKey === 'SIDE_LEFT' || role === 'LEFT_SIDE_PANEL') {
        const pY = margines_gorny_mm + margines_dolny_mm;
        const pX = wpuszczenie_lewe_mm + wpuszczenie_prawe_mm;
        return {
            thickness: grubosc_lewy_mm,
            dim: { x: wysokosc_formatki_lewej_mm + pY, y: D_mm + pX, z: grubosc_lewy_mm },
            loc: { x: -W_mm / 2 + grubosc_lewy_mm / 2 + przesuniecie_x_mm,
                   y: (wpuszczenie_prawe_mm - wpuszczenie_lewe_mm) / 2 + przesuniecie_y_mm,
                   z: wysokosc_formatki_lewej_mm / 2 + (margines_gorny_mm - margines_dolny_mm) / 2 + przesuniecie_z_mm },
            edge_banding: {
                '+X': { active: true, type_id: '0.008x0.022' },
                '-X': { active: false, type_id: 'none' },
                '+Y': sideTopBevelLeft,
                '-Y': { active: true, type_id: '0.008x0.022' }
            }
        };
    }
    if (matchedKey === 'BOK_P' || matchedKey === 'SIDE_RIGHT' || role === 'RIGHT_SIDE_PANEL') {
        const pY = margines_gorny_mm + margines_dolny_mm;
        const pX = wpuszczenie_lewe_mm + wpuszczenie_prawe_mm;
        return {
            thickness: grubosc_prawy_mm,
            dim: { x: wysokosc_formatki_prawej_mm + pY, y: D_mm + pX, z: grubosc_prawy_mm },
            loc: { x: W_mm / 2 - grubosc_prawy_mm / 2 + przesuniecie_x_mm,
                   y: (wpuszczenie_prawe_mm - wpuszczenie_lewe_mm) / 2 + przesuniecie_y_mm,
                   z: wysokosc_formatki_prawej_mm / 2 + (margines_gorny_mm - margines_dolny_mm) / 2 + przesuniecie_z_mm },
            edge_banding: {
                '+X': { active: false, type_id: 'none' },
                '-X': { active: true, type_id: '0.008x0.022' },
                '+Y': sideTopBevelRight,
                '-Y': { active: true, type_id: '0.008x0.022' }
            }
        };
    }

    // ── WIENIEC DOLNY — identycznie jak korpus3 ──────────────────────────────
    if (matchedKey === 'WIENIEC_D' || matchedKey === 'BOTTOM' || role === 'BOTTOM_PANEL') {
        const pY = margines_dolny_mm + margines_gorny_mm;
        const pX = wpuszczenie_lewe_mm + wpuszczenie_prawe_mm;
        return {
            thickness: grubosc_mm,
            dim: { x: szerokosc_wewnetrzna_mm + pY, y: D_mm + pX, z: grubosc_mm },
            loc: { x: przesuniecie_srodka_mm + (margines_gorny_mm - margines_dolny_mm) / 2,
                   y: (wpuszczenie_prawe_mm - wpuszczenie_lewe_mm) / 2,
                   z: grubosc_mm / 2 - przesuniecie_z_mm }
        };
    }

    // ── WIENIEC GÓRNY (skośny) — wyjątek: lcs rotation ──────────────────────
    if (matchedKey === 'WIENIEC_G' || matchedKey === 'TOP' || role === 'TOP_PANEL') {
        return {
            thickness: grubosc_mm,
            dim: { x: dlugosc_skosu_mm, y: D_mm, z: grubosc_mm },
            loc: {
                x: przesuniecie_srodka_mm + (grubosc_mm / 2) * Math.sin(kat_skosu_rad),
                y: 0,
                z: z_top_center_mm - (grubosc_mm / 2) * Math.cos(kat_skosu_rad)
            },
            lcs: {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [-90, 0, -kat_skosu_deg],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            },
            edge_banding: {
                '+X': topEndBandRight,
                '-X': topEndBandLeft,
                '+Y': { active: false, type_id: 'none' },
                '-Y': { active: true, type_id: '0.008x0.022' }
            },
            customProperties: {
                outline2d: undefined,
                shape: undefined,
                boardThickness: undefined
            }
        };
    }

    // ── PLECY ────────────────────────────────────────────────────────────────
    // z_bottom: identycznie jak korpus3.
    // WAŻNE: LCS pleców [180,0,0] → v=0 to GÓRA w CAD, v=backH to DÓŁ (z_bottom).
    // Podłoga w outline: v=backH. Dach (skośny): v=małe wartości.
    if (matchedKey === 'PLECY' || matchedKey === 'BACK' || role === 'BACK_PANEL') {
        const overlap_lewy_mm  = wpuszczenie_lewe_mm;
        const overlap_prawy_mm = wpuszczenie_prawe_mm;
        const overlap_dol_mm   = margines_dolny_mm;
        const backW_mm = szerokosc_wewnetrzna_mm + overlap_lewy_mm + overlap_prawy_mm;

        // z_bottom: identycznie jak korpus3
        const z_bottom_mm = grubosc_dolny_mm - overlap_dol_mm;

        // Absolutna wysokość dachu na rozszerzonych krawędziach pleców (LR_UC, z uciosem):
        // tan_beta = (h_prawy - h_lewy) / W — nachylenie po pełnej szerokości szafki.
        // Prawy dach wyższy: lico wewnętrzne BOK_P = h_prawy − uskok_prawy;
        //   rozszerzając o overlap_prawy w prawo wzdłuż skosu: + overlap_prawy * tan_beta.
        // Lewy dach niższy: lico wewnętrzne BOK_L = h_lewy + uskok_lewy;
        //   rozszerzając o overlap_lewy w lewo wzdłuż skosu: − overlap_lewy * tan_beta.
        const rightRoofAbsExt_mm = h_prawy_mm - uskok_prawy_mm + overlap_prawy_mm * tan_beta;
        const leftRoofAbsExt_mm  = h_lewy_mm  + uskok_lewy_mm  - overlap_lewy_mm  * tan_beta;

        // Pionowa grubość wieńca górnego t / cos(beta): sufit wnęki (środek wnęki)
        // leży o tę wartość poniżej zewnętrznej linii dachu.
        const cos_beta = Math.cos(kat_skosu_rad);
        const roofThickVertical_mm = Math.abs(cos_beta) > 1e-6 ? grubosc_gorny_mm / cos_beta : grubosc_gorny_mm;

        const rightRoofInnerExt_mm = rightRoofAbsExt_mm - roofThickVertical_mm;
        const leftRoofInnerExt_mm  = leftRoofAbsExt_mm  - roofThickVertical_mm;

        const rightRoofRel_mm = rightRoofInnerExt_mm - z_bottom_mm;  // prawy (wysoki)
        const leftRoofRel_mm  = leftRoofInnerExt_mm  - z_bottom_mm;  // lewy (niski)

        const maxRoofRel_mm = Math.max(rightRoofRel_mm, leftRoofRel_mm);
        // backH: sufit wnęki (wyższy szczyt) + margines_gorny (wpuszczenie w wieniec górny od środka wnęki)
        const backH_mm = maxRoofRel_mm + margines_gorny_mm;

        // Obrys w LCS: v=backH = podłoga CAD (z_bottom), v=małe = dach CAD
        // Szczyt dachu leży na v=0, niższy szczyt na v = maxRoofRel_mm - roofRel_mm.
        // Powiększenie margines_gorny_mm (i backH_mm) unosi skośną krawędź dachu w CAD Z.
        const v_right_roof = maxRoofRel_mm - rightRoofRel_mm;
        const v_left_roof  = maxRoofRel_mm - leftRoofRel_mm;
        const outlineBack: [number, number][] = [
            [0,        backH_mm],      // podłoga-lewo
            [backW_mm, backH_mm],      // podłoga-prawo
            [backW_mm, v_right_roof],  // dach-prawo (wyżej w CAD)
            [0,        v_left_roof]    // dach-lewo  (niżej w CAD)
        ];

        return {
            thickness: grubosc_mm,
            dim: { x: backW_mm, y: grubosc_mm, z: backH_mm },
            loc: {
                x: przesuniecie_srodka_mm + (overlap_prawy_mm - overlap_lewy_mm) / 2 + przesuniecie_x_mm,
                y: D_mm / 2 + grubosc_mm / 2 - odsuniecie_plecow_mm + przesuniecie_y_mm,
                z: z_bottom_mm + backH_mm / 2 + przesuniecie_z_mm
            },
            customProperties: {
                outline2d: outlineBack,
                shape: 'skos_back'
            }
        };
    }

    console.warn(`[resolveSkosnyLrUcGeometry] SkosnyLR_UC: nieznany węzeł "${matchedKey}" (role: "${role}")`);
    return null;
}
