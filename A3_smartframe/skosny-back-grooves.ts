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

    if (isSkosnyFb) {
        // Skos w głąb (przód niski/wysoki, tył wysoki/niski) — z tyłu (gdzie są plecy) oba boki mają wysokość tylną
        const hB_mm = gp.wysokosc_tyl_mm ?? (gp.height_back ? rulesMToMm(gp.height_back, 1000) : 1000);
        const hF_mm = gp.wysokosc_przod_mm ?? (gp.height_front ? rulesMToMm(gp.height_front, H_mm) : H_mm);
        h_lewy_mm = hB_mm;
        h_prawy_mm = hB_mm;
        slopeLen_mm = innerW_mm;
        fbSlopeD_mm = Math.hypot(D_mm, hB_mm - hF_mm);
        const cos_beta = fbSlopeD_mm > 0 ? D_mm / fbSlopeD_mm : 1;
        const roofThickVertical_mm = cos_beta > 1e-6 ? thick_wieniecG / cos_beta : thick_wieniecG;
        leftRoofInnerExt_mm = hB_mm - roofThickVertical_mm;
        rightRoofInnerExt_mm = hB_mm - roofThickVertical_mm;
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

        if (isLrUc) {
            rightRoofInnerExt_mm = h_prawy_mm - uskok_prawy_mm + overlap_R * tan_beta - roofThickVertical_mm;
            leftRoofInnerExt_mm = h_lewy_mm + uskok_lewy_mm - overlap_L * tan_beta - roofThickVertical_mm;
        } else {
            rightRoofInnerExt_mm = h_prawy_mm + overlap_R * tan_beta - roofThickVertical_mm;
            leftRoofInnerExt_mm = h_lewy_mm - overlap_L * tan_beta - roofThickVertical_mm;
        }
    }

    const z_bottom_mm = thick_wieniecD - overlap_D;
    const z_top_L_mm = leftRoofInnerExt_mm + overlap_G;
    const z_top_R_mm = rightRoofInnerExt_mm + overlap_G;

    const intents: GrooveIntent[] = [];

    // 1. WIENIEC DOLNY (WIENIEC_D) — rowek poziomy wzdłuż tyłu
    {
        const u_mm = 0;
        const width_mm = innerW_mm;
        const v_mm = D_mm - bOffset_mm;
        const length_mm = thick_plecy;
        const depth_mm = Math.min(overlap_D, thick_wieniecD);

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

    // 2. WIENIEC GÓRNY / SKOŚNY DACH (WIENIEC_G) — rowek wzdłuż skosu dachu
    {
        let u_mm: number;
        let width_mm: number;
        let v_mm: number;
        let length_mm: number;

        if (isSkosnyFb) {
            // Skos w głąb (korpus_skosny / korpus_skosny_dach):
            // Wieniec biegnie od frontu (v=0) do tyłu (v=fbSlopeD_mm).
            // Plecy są z tyłu (przy v=fbSlopeD_mm), rozciągają się wzdłuż X (od u=0 do u=innerW_mm).
            const k_skos = D_mm > 0 ? fbSlopeD_mm / D_mm : 1;

            u_mm = 0;
            width_mm = innerW_mm;
            v_mm = fbSlopeD_mm - bOffset_mm * k_skos;
            length_mm = thick_plecy * k_skos;
        } else {
            // Skos lewo-prawo (korpus_skosny_lr / korpus_skosny_lr_uc):
            // Wieniec biegnie od lewego boku do prawego (wzdłuż U na długości slopeLen_mm).
            // Plecy są z tyłu (w osi V, przy v=D_mm - bOffset_mm).
            u_mm = 0;
            width_mm = slopeLen_mm;
            v_mm = D_mm - bOffset_mm;
            length_mm = thick_plecy;
        }

        const depth_mm = Math.min(overlap_G, thick_wieniecG);

        intents.push({
            targetNodeId: wieniecG.id,
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

    // 3. BOK LEWY (BOK_L) — rowek pionowy do wysokości lewej krawędzi pleców
    {
        // U=0 na boku lewym to tylna krawędź formatki (+CAD Y). Wpust odsuwa się od tyłu:
        const u_mm = Math.max(0, bOffset_mm - thick_plecy);
        const width_mm = thick_plecy;
        const v_start_mm = Math.max(0, z_bottom_mm);
        const v_end_mm = z_top_L_mm;
        const length_mm = Math.max(0, v_end_mm - v_start_mm);
        const depth_mm = Math.min(overlap_L, thick_bokL);

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

    // 4. BOK PRAWY (BOK_P) — rowek pionowy do wysokości prawej krawędzi pleców
    {
        // U=0 na boku prawym to przednia krawędź formatki (-CAD Y), U=D to tylna krawędź (+CAD Y):
        const u_mm = Math.max(0, D_mm - bOffset_mm);
        const width_mm = thick_plecy;
        const v_start_mm = Math.max(0, z_bottom_mm);
        const v_end_mm = z_top_R_mm;
        const length_mm = Math.max(0, v_end_mm - v_start_mm);
        const depth_mm = Math.min(overlap_R, thick_bokP);

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

    return intents;
}
