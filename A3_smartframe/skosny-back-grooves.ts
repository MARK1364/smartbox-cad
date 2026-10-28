/**
 * skosny-back-grooves.ts
 *
 * Dedykowany generator intencji wpustów pod plecy (GrooveIntent) dla korpusów skośnych:
 * - korpus_skosny_lr_uc (ucięty ze skosem lewo-prawo)
 * - korpus_skosny_lr (ze skosem lewo-prawo)
 * - korpus_skosny / korpus_skosny_dach (skos w głąb)
 *
 * Generuje frezowanie wpustu dookoła na wszystkich 4 formatkach:
 * 1. WIENIEC_D (dół wnęki)
 * 2. WIENIEC_G (skośny dach)
 * 3. BOK_L (bok lewy o wysokości hL)
 * 4. BOK_P (bok prawy o wysokości hR)
 *
 * Wszystkie parametry wyjściowe GrooveIntent są wyrażone w nanometrach (nm) — SSOT.
 */

import { GrooveIntent } from './groove-intent.js';
import { mmToNm, nmToMm, rulesMToMm } from '../A1_core/cad-math/units.js';
import { defaultBackEdgeOverlapMm, readBackEdgeOffset } from './back-overlap.js';
import { BACK_OVERLAP_EPS_MM } from './smartframe-types.js';

export function buildSkosnyBackGrooves(cntNode: any): GrooveIntent[] {
    if (!cntNode || !Array.isArray(cntNode.children) || cntNode.children.length === 0) {
        return [];
    }

    const gp = cntNode.domainData?.generatorParams || {};
    const cabinetType = String(gp.type || '');

    // Wyszukiwanie formatek po rolach architektonicznych (z bezpiecznym fallbackiem na klucze)
    const findPart = (role: string, altKeys: string[] = []) =>
        cntNode.children.find((c: any) => {
            const d = c.domainData;
            if (!d) return false;
            if (d.role === role) return true;
            const k = String(d.key || '').toUpperCase();
            return altKeys.some((ak) => k.includes(ak.toUpperCase()));
        });

    const bokL = findPart('LEFT_SIDE_PANEL', ['BOK_L', 'SIDE_LEFT']);
    const bokP = findPart('RIGHT_SIDE_PANEL', ['BOK_P', 'SIDE_RIGHT']);
    const wieniecD = findPart('BOTTOM_PANEL', ['WIENIEC_D', 'BOTTOM']);
    const wieniecG = findPart('TOP_PANEL', ['WIENIEC_G', 'TOP']);
    const plecy = findPart('BACK_PANEL', ['PLECY', 'BACK']);

    if (!plecy || !wieniecD || !bokL || !bokP || !wieniecG) {
        return [];
    }

    // Jeśli plecy są ukryte lub zamrożone — nie nacinamy wpustów
    if (plecy.domainData?.frozen === true || plecy.domainData?.visible === false) {
        return [];
    }

    const W_mm = gp.szerokosc_mm ?? (gp.width ? nmToMm(gp.width) : 1200);
    const D_mm = gp.glebokosc_mm ?? (gp.depth ? nmToMm(gp.depth) : 600);
    const H_mm = gp.wysokosc_mm ?? (gp.height ? nmToMm(gp.height) : 2200);

    const bOffset_mm = gp.cofniecie_plecow_mm ?? gp.backOffset ?? 18;
    const offsetsMm = (gp.offsets || {}) as Record<string, number>;

    // Grubości płyt pobierane z domainData formatek
    const thick_bokL = nmToMm(bokL.domainData?.thickness ?? mmToNm(18));
    const thick_bokP = nmToMm(bokP.domainData?.thickness ?? mmToNm(18));
    const thick_wieniecD = nmToMm(wieniecD.domainData?.thickness ?? mmToNm(18));
    const thick_wieniecG = nmToMm(wieniecG.domainData?.thickness ?? mmToNm(18));
    const thick_plecy = nmToMm(plecy.domainData?.thickness ?? mmToNm(3));

    // Zakładki / wpuszczenia pleców w krawędzie
    const panelKey = plecy.domainData?.key || plecy.domainData?.role || 'B_PLECY';
    const panelName = plecy.domainData?.name || '';
    const edge = (suf: '+X' | '-X' | '+Y' | '-Y') => {
        const candidates = [
            `${panelKey}_${suf}`,
            `${panelName}_${suf}`,
            `B_PLECY_${suf}`,
            `B_Plecy_${suf}`,
            `Dol_Plecy_${suf}`,
            `Plecy_${suf}`,
            `BACK_PANEL_${suf}`
        ];
        for (const k of candidates) {
            if (offsetsMm[k] !== undefined && offsetsMm[k] !== null && !Number.isNaN(Number(offsetsMm[k]))) {
                return Number(offsetsMm[k]);
            }
        }
        const def = defaultBackEdgeOverlapMm(`${panelKey}_${suf}`, cabinetType);
        return readBackEdgeOffset(offsetsMm, panelKey, suf, def, plecy.domainData?.zonePrefix);
    };

    const overlap_L = edge('-X'); // wpuszczenie w bok lewy (np. 11 mm)
    const overlap_R = edge('+X'); // wpuszczenie w bok prawy (np. 11 mm)
    const overlap_D = edge('-Y'); // wpuszczenie w wieniec dolny (np. 11 mm)
    const overlap_G = edge('+Y'); // wpuszczenie w wieniec górny / dach (np. 11 mm)

    const innerW_mm = W_mm - thick_bokL - thick_bokP;

    const isSkosnyFb = cabinetType === 'korpus_skosny' || cabinetType === 'korpus_skosny_dach';
    const isLrUc = cabinetType === 'korpus_skosny_lr_uc';

    let h_lewy_mm: number;
    let h_prawy_mm: number;
    let slopeLen_mm: number;
    let leftRoofInnerExt_mm: number;
    let rightRoofInnerExt_mm: number;
    let fbSlopeD_mm = D_mm;

    const plecyPos = plecy.localMatrix?.decompose?.()?.translation || (plecy as any).position || { x: 0, y: 0, z: 0 };
    const plecyW_mm = nmToMm(plecy.domainData?.width || 0);
    const plecyH_mm = nmToMm(plecy.domainData?.height || plecy.domainData?.length || 0);
    const plecyTopZ_mm = nmToMm(plecyPos.z) + plecyH_mm / 2;
    const plecyBottomZ_mm = nmToMm(plecyPos.z) - plecyH_mm / 2;

    const expectedPlecyX_mm = (thick_bokL - thick_bokP) / 2 + (overlap_R - overlap_L) / 2;
    const actualShiftX = plecyW_mm > 0 ? nmToMm(plecyPos.x) - expectedPlecyX_mm : 0;
    const actualShiftY = nmToMm(plecyPos.y) - (D_mm / 2 + thick_plecy / 2 - bOffset_mm);
    const actualShiftZ = plecyH_mm > 0 ? plecyBottomZ_mm - (thick_wieniecD - overlap_D) : 0;

    const effOverlap_L = overlap_L - (Math.abs(actualShiftX) > 0.01 ? actualShiftX : 0);
    const effOverlap_R = overlap_R + (Math.abs(actualShiftX) > 0.01 ? actualShiftX : 0);
    const effOverlap_D = overlap_D - (Math.abs(actualShiftZ) > 0.01 ? actualShiftZ : 0);

    let hB_mm = 1000;
    let hF_mm = H_mm;
    let actualOverlap_G = overlap_G;
    let effOverlap_G = overlap_G;

    if (isSkosnyFb) {
        // Skos w głąb (przód niski/wysoki, tył wysoki/niski) — z tyłu (gdzie są plecy) oba boki mają wysokość tylną
        hB_mm = gp.wysokosc_tyl_mm ?? (gp.height_back ? rulesMToMm(gp.height_back, 1000) : 1000);
        hF_mm = gp.wysokosc_przod_mm ?? (gp.height_front ? rulesMToMm(gp.height_front, H_mm) : H_mm);
        h_lewy_mm = hB_mm;
        h_prawy_mm = hB_mm;
        slopeLen_mm = innerW_mm;
        fbSlopeD_mm = Math.hypot(D_mm, hB_mm - hF_mm);
        const yPlecyFront_mm = D_mm - bOffset_mm + (Math.abs(actualShiftY) > 0.01 ? actualShiftY : 0);
        const betaRad = Math.atan2(hB_mm - hF_mm, D_mm);
        const cosBeta = Math.abs(Math.cos(betaRad)) > 1e-6 ? Math.cos(betaRad) : 1;
        const tanBeta = Math.tan(betaRad);
        const zCeilAtPlecy_mm = hF_mm - thick_wieniecG / cosBeta + yPlecyFront_mm * tanBeta;
        actualOverlap_G = plecyTopZ_mm - zCeilAtPlecy_mm;
        effOverlap_G = actualOverlap_G;
        leftRoofInnerExt_mm = zCeilAtPlecy_mm;
        rightRoofInnerExt_mm = zCeilAtPlecy_mm;
    } else {
        // Skos lewo-prawo (LR / LR_UC)
        h_lewy_mm = gp.wysokosc_lewy_mm ?? (gp.height_left ? nmToMm(gp.height_left) : 1000);
        h_prawy_mm = gp.wysokosc_prawy_mm ?? (gp.height_right ? nmToMm(gp.height_right) : H_mm);

        const tan_beta = isLrUc
            ? (W_mm !== 0 ? (h_prawy_mm - h_lewy_mm) / W_mm : 0)
            : (innerW_mm !== 0 ? (h_prawy_mm - h_lewy_mm) / innerW_mm : 0);

        const kat_skosu_rad = Math.atan(tan_beta);
        const cos_beta = Math.cos(kat_skosu_rad);
        slopeLen_mm = isLrUc
            ? Math.hypot(innerW_mm, innerW_mm * tan_beta)
            : Math.hypot(innerW_mm, h_prawy_mm - h_lewy_mm);

        const uskok_lewy_mm = thick_bokL * tan_beta;
        const uskok_prawy_mm = thick_bokP * tan_beta;
        const roofThickVertical_mm = Math.abs(cos_beta) > 1e-6 ? thick_wieniecG / cos_beta : thick_wieniecG;
        effOverlap_G = overlap_G + (Math.abs(actualShiftZ) > 0.01 ? actualShiftZ * cos_beta : 0);
        const depth_G_mm = Math.min(effOverlap_G, thick_wieniecG);
        const grooveGVertical_mm = Math.abs(cos_beta) > 1e-6 ? depth_G_mm / cos_beta : depth_G_mm;

        if (isLrUc) {
            rightRoofInnerExt_mm = h_prawy_mm - uskok_prawy_mm - roofThickVertical_mm;
            leftRoofInnerExt_mm = h_lewy_mm + uskok_lewy_mm - roofThickVertical_mm;
            actualOverlap_G = grooveGVertical_mm;
        } else {
            rightRoofInnerExt_mm = h_prawy_mm + effOverlap_R * tan_beta - roofThickVertical_mm;
            leftRoofInnerExt_mm = h_lewy_mm - effOverlap_L * tan_beta - roofThickVertical_mm;
            actualOverlap_G = effOverlap_G;
        }
    }

    const effectiveRearOffset_mm = bOffset_mm - (Math.abs(actualShiftY) > 0.01 ? actualShiftY : 0);
    const z_bottom_mm = thick_wieniecD - effOverlap_D;
    const z_top_L_mm = isSkosnyFb ? plecyTopZ_mm : (leftRoofInnerExt_mm + actualOverlap_G);
    const z_top_R_mm = isSkosnyFb ? plecyTopZ_mm : (rightRoofInnerExt_mm + actualOverlap_G);

    const intents: GrooveIntent[] = [];

    // 1. WIENIEC DOLNY (WIENIEC_D) — rowek poziomy wzdłuż tyłu (pomijany, gdy plecy nie wchodzą lub wieniec docięty do pleców)
    if (effOverlap_D > BACK_OVERLAP_EPS_MM && overlap_D < thick_wieniecD - BACK_OVERLAP_EPS_MM) {
        const u_mm = 0;
        const width_mm = innerW_mm;
        const v_mm = D_mm - effectiveRearOffset_mm;
        const length_mm = thick_plecy;
        const depth_mm = Math.min(effOverlap_D, thick_wieniecD);

        intents.push({
            targetNodeId: wieniecD.id,
            feature: {
                type: 'groove',
                face: '+Z',
                params: {
                    u_nm: mmToNm(u_mm),
                    v_nm: mmToNm(v_mm),
                    width_nm: mmToNm(width_mm),
                    length_nm: mmToNm(length_mm),
                    depth_nm: mmToNm(depth_mm)
                }
            }
        });
    }

    // 2. WIENIEC GÓRNY / SKOŚNY DACH (WIENIEC_G) — schodek L asocjacyjny z plecami (pomijany, gdy docięty do pleców)
    if (overlap_G < thick_wieniecG - BACK_OVERLAP_EPS_MM) {
        if (isSkosnyFb) {
            if (actualOverlap_G > BACK_OVERLAP_EPS_MM) {
                intents.push({
                    targetNodeId: wieniecG.id,
                    feature: {
                        type: 'groove',
                        face: '+Z',
                        params: {
                            u_nm: mmToNm(0),
                            v_nm: mmToNm(0),
                            width_nm: mmToNm(innerW_mm),
                            length_nm: mmToNm(thick_plecy),
                            depth_nm: mmToNm(Math.min(actualOverlap_G, thick_wieniecG))
                        }
                    }
                });

                const custom = (wieniecG.domainData as any)?.custom_properties || (wieniecG.domainData as any)?.customProperties;
                if (custom) {
                    const shiftY_val = Math.abs(actualShiftY) > 0.01 ? actualShiftY : (custom.backGrooveTrapezoid?.shiftY ?? 0);
                    if (!custom.backGrooveTrapezoid) {
                        custom.backGrooveTrapezoid = {
                            hF: hF_mm,
                            hB: hB_mm,
                            D: D_mm,
                            thickness: thick_wieniecG,
                            backOffset: bOffset_mm,
                            shiftY: shiftY_val,
                            grubosc_plecow_mm: thick_plecy,
                            margines_gorny_plecow_mm: actualOverlap_G
                        };
                    } else {
                        custom.backGrooveTrapezoid.backOffset = bOffset_mm;
                        custom.backGrooveTrapezoid.shiftY = shiftY_val;
                        custom.backGrooveTrapezoid.margines_gorny_plecow_mm = actualOverlap_G;
                    }
                }
            } else {
                // Plecy spadły z wieńca górnego — schodek L / wpust znika!
                const custom = (wieniecG.domainData as any)?.custom_properties || (wieniecG.domainData as any)?.customProperties;
                if (custom?.backGrooveTrapezoid) {
                    delete custom.backGrooveTrapezoid;
                }
            }
        } else if (effOverlap_G > BACK_OVERLAP_EPS_MM) {
            // Skos lewo-prawo (korpus_skosny_lr / korpus_skosny_lr_uc):
            intents.push({
                targetNodeId: wieniecG.id,
                feature: {
                    type: 'groove',
                    face: '+Z',
                    params: {
                        u_nm: mmToNm(0),
                        v_nm: mmToNm(D_mm - effectiveRearOffset_mm),
                        width_nm: mmToNm(slopeLen_mm),
                        length_nm: mmToNm(thick_plecy),
                        depth_nm: mmToNm(Math.min(effOverlap_G, thick_wieniecG))
                    }
                }
            });
        }
    } else if (isSkosnyFb) {
        const custom = (wieniecG.domainData as any)?.custom_properties || (wieniecG.domainData as any)?.customProperties;
        if (custom?.backGrooveTrapezoid) {
            delete custom.backGrooveTrapezoid;
        }
    }

    // Wyznaczenie bezpiecznej maksymalnej wysokości boków (boki są u góry ścięte pod kątem i każdy jest inny!)
    let maxTop_L_mm: number;
    let maxTop_R_mm: number;

    if (isSkosnyFb) {
        // Skos w głąb (przód-tył): górna krawędź boków jest ścięta wzdłuż osi U (głębokości).
        // Obrysy w LCS boków (skosny-geometry.ts):
        // BOK_L (outlineL): U=0 na tyle (hB), U=D na froncie (hF).
        const u_L_0 = Math.max(0, effectiveRearOffset_mm - thick_plecy);
        const u_L_1 = effectiveRearOffset_mm;
        const h_L_0 = hB_mm + (D_mm !== 0 ? u_L_0 * (hF_mm - hB_mm) / D_mm : 0);
        const h_L_1 = hB_mm + (D_mm !== 0 ? u_L_1 * (hF_mm - hB_mm) / D_mm : 0);
        maxTop_L_mm = Math.min(h_L_0, h_L_1);

        // BOK_P (outlineR): U=0 na froncie (hF), U=D na tyle (hB).
        const u_R_0 = Math.max(0, D_mm - effectiveRearOffset_mm);
        const u_R_1 = Math.min(D_mm, D_mm - effectiveRearOffset_mm + thick_plecy);
        const h_R_0 = hF_mm + (D_mm !== 0 ? u_R_0 * (hB_mm - hF_mm) / D_mm : 0);
        const h_R_1 = hF_mm + (D_mm !== 0 ? u_R_1 * (hB_mm - hF_mm) / D_mm : 0);
        maxTop_R_mm = Math.min(h_R_0, h_R_1);
    } else {
        // Skos lewo-prawo (LR / LR_UC): boki są różne na górze!
        const tan_beta = isLrUc
            ? (W_mm !== 0 ? (h_prawy_mm - h_lewy_mm) / W_mm : 0)
            : (innerW_mm !== 0 ? (h_prawy_mm - h_lewy_mm) / innerW_mm : 0);
        const uskok_lewy = thick_bokL * tan_beta;
        const uskok_prawy = thick_bokP * tan_beta;

        if (isLrUc) {
            // BOK_L: lico wewnętrzne (Z+) ma wysokość hL + uskok_lewy; dno wpustu opada równolegle do dachu o depth_L * tan_beta
            maxTop_L_mm = h_lewy_mm + uskok_lewy;

            // BOK_P: lico wewnętrzne (Z+) ma wysokość hR - uskok_prawy; dno wpustu wznosi się równolegle do dachu o depth_R * tan_beta
            maxTop_R_mm = h_prawy_mm - uskok_prawy;
        } else {
            // Prosty LR bez uciosu: płaskie boki
            maxTop_L_mm = h_lewy_mm;
            maxTop_R_mm = h_prawy_mm;
        }
    }

    // 3. BOK LEWY (BOK_L) — rowek pionowy do wysokości lewej krawędzi pleców (pomijany, gdy plecy nie wchodzą w bok lub bok docięty do pleców)
    if (effOverlap_L > BACK_OVERLAP_EPS_MM && overlap_L < thick_bokL - BACK_OVERLAP_EPS_MM) {
        // U=0 na boku lewym to tylna krawędź formatki (+CAD Y). Wpust odsuwa się od tyłu:
        const u_mm = Math.max(0, effectiveRearOffset_mm - thick_plecy);
        const width_mm = thick_plecy;
        const v_start_mm = Math.max(0, z_bottom_mm);
        const v_end_mm = Math.min(z_top_L_mm, maxTop_L_mm);
        const length_mm = Math.max(0, v_end_mm - v_start_mm);
        const depth_mm = Math.min(effOverlap_L, thick_bokL);

        if (length_mm > BACK_OVERLAP_EPS_MM && depth_mm > BACK_OVERLAP_EPS_MM) {
            intents.push({
                targetNodeId: bokL.id,
                feature: {
                    type: 'groove',
                    face: '+Z',
                    params: {
                        u_nm: mmToNm(u_mm),
                        v_nm: mmToNm(v_start_mm),
                        width_nm: mmToNm(width_mm),
                        length_nm: mmToNm(length_mm),
                        depth_nm: mmToNm(depth_mm)
                    }
                }
            });
        }
    }

    // 4. BOK PRAWY (BOK_P) — rowek pionowy do wysokości prawej krawędzi pleców (pomijany, gdy plecy nie wchodzą w bok lub bok docięty do pleców)
    if (effOverlap_R > BACK_OVERLAP_EPS_MM && overlap_R < thick_bokP - BACK_OVERLAP_EPS_MM) {
        // U=0 na boku prawym to przednia krawędź formatki (-CAD Y), U=D to tylna krawędź (+CAD Y):
        const u_mm = Math.max(0, D_mm - effectiveRearOffset_mm);
        const width_mm = thick_plecy;
        const v_start_mm = Math.max(0, z_bottom_mm);
        const v_end_mm = Math.min(z_top_R_mm, maxTop_R_mm);
        const length_mm = Math.max(0, v_end_mm - v_start_mm);
        const depth_mm = Math.min(effOverlap_R, thick_bokP);

        if (length_mm > BACK_OVERLAP_EPS_MM && depth_mm > BACK_OVERLAP_EPS_MM) {
            intents.push({
                targetNodeId: bokP.id,
                feature: {
                    type: 'groove',
                    face: '+Z',
                    params: {
                        u_nm: mmToNm(u_mm),
                        v_nm: mmToNm(v_start_mm),
                        width_nm: mmToNm(width_mm),
                        length_nm: mmToNm(length_mm),
                        depth_nm: mmToNm(depth_mm)
                    }
                }
            });
        }
    }

    return intents;
}
