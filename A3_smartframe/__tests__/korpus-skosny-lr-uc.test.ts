import { describe, it, expect } from 'vitest';
import { planCabinet } from '../smartframe-engine.js';
import { korpusDefaultsForTypeMm } from '../korpus-defaults';
import { resolveCabinetType } from '../smartframe-adapter';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';

const beta = (W: number) => Math.atan2(1200, W);

function planSkosnyLrUc() {
    return planCabinet({
        szerokosc_mm: 1200,
        wysokosc_mm: 2200,
        glebokosc_mm: 600,
        liczba_stref: 1,
        typ_korpusu: 'korpus_skosny_lr_uc',
        wysokosc_lewy_mm: 1000,
        wysokosc_prawy_mm: 2200,
        cofniecie_plecow_mm: 3
    });
}

describe('KORPUS_SKOSNY_LR_UC (ucięty)', () => {
    it('1 strefa, 5 części jak prototyp LR', () => {
        const plan = planSkosnyLrUc();
        expect(plan.zones).toHaveLength(1);
        expect(plan.parts).toHaveLength(5);
    });

    it('plecy HDF 3 mm dopasowują się do skosu i respektują marginesy oraz przesunięcia gizma', () => {
        const plan = planCabinet({
            szerokosc_mm: 1200,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1,
            typ_korpusu: 'korpus_skosny_lr_uc',
            wysokosc_lewy_mm: 1000,
            wysokosc_prawy_mm: 2200,
            cofniecie_plecow_mm: 3,
            offsets: {
                'B_PLECY_-X': 7,
                'B_PLECY_+X': 13,
                'B_PLECY_-Y': 5,
                'B_PLECY_+Y': 9,
                'B_PLECY_shiftX': 4,
                'B_PLECY_shiftY': 6,
                'B_PLECY_shiftZ': 8
            }
        });
        const back = plan.parts.find((part) => part.role === 'BACK_PANEL')!;
        const innerW = 1200 - 18 - 18;
        const tanBeta = (2200 - 1000) / 1200;   // LR_UC: po pełnej szerokości W
        const uskok_lewy  = 18 * tanBeta;         // grubosc_lewy  * tanBeta
        const uskok_prawy = 18 * tanBeta;         // grubosc_prawy * tanBeta
        const overlap_lewy  = 7;    // -X offset
        const overlap_prawy = 13;   // +X offset
        const overlap_dol   = 5;    // -Y offset
        const overlap_gora  = 9;    // +Y offset
        const backW = innerW + overlap_lewy + overlap_prawy;

        // z_bottom = grubosc_dolny - overlap_dol (identycznie jak korpus3)
        const z_bottom = 18 - overlap_dol;  // 13

        const betaRad = Math.atan(tanBeta);
        const roofThickVert = 18 / Math.cos(betaRad);

        // Absolutna wysokość dachu i sufitu wnęki na rozszerzonych krawędziach (LR_UC z uciosem):
        const rightRoofAbsExt = 2200 - uskok_prawy + overlap_prawy * tanBeta;
        const leftRoofAbsExt  = 1000 + uskok_lewy  - overlap_lewy  * tanBeta;
        const rightRoofInnerExt = rightRoofAbsExt - roofThickVert;
        const leftRoofInnerExt  = leftRoofAbsExt  - roofThickVert;
        const rightRoofRel = rightRoofInnerExt - z_bottom;  // prawy (wysoki)
        const leftRoofRel  = leftRoofInnerExt  - z_bottom;  // lewy (niski)
        const maxRoofRel = Math.max(rightRoofRel, leftRoofRel);
        const backH = maxRoofRel + overlap_gora;

        // v_dach: szczyt dachu leży na v=0
        const v_right_roof = maxRoofRel - rightRoofRel;
        const v_left_roof  = maxRoofRel - leftRoofRel;

        expect(back.thickness).toBeCloseTo(3, 0);
        expect(back.material).toBe('HDF_BIALY_3');
        expect(back.dim.x).toBeCloseTo(backW, 0);
        expect(back.loc.x).toBeCloseTo((overlap_prawy - overlap_lewy) / 2 + 4, 0);
        expect(back.loc.y).toBeCloseTo(600 / 2 + 3 / 2 - 3 + 6, 0);
        expect(back.loc.z).toBeCloseTo(z_bottom + backH / 2 + 8, 0);
        // obrys: v=backH=podłoga, v=małe=dach (wynika z LCS [180,0,0] pleców)
        expect((back.customProperties as any).outline2d).toEqual([
            [0,     backH],
            [backW, backH],
            [backW, v_right_roof],
            [0,     v_left_roof]
        ]);

        const outline = (back.customProperties as any).outline2d as number[][];
        const v_left_top  = outline[3][1];
        const v_right_top = outline[2][1];
        // nachylenie górnej krawędzi = tanBeta (lewy wyższy v = niższy w CAD)
        expect((v_left_top - v_right_top) / backW).toBeCloseTo(tanBeta, 6);
    });

    it('wieniec górny: dim.x = slopeLen (wydłużenie po skosie), nie samo innerWidth', () => {
        const plan = planSkosnyLrUc();
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;
        const innerW = 1200 - 18 - 18;
        const betaDeg = (Math.atan2(2200 - 1000, 1200) * 180) / Math.PI;
        const b = (betaDeg * Math.PI) / 180;
        const slopeLen = Math.hypot(innerW, innerW * Math.tan(b));

        expect(top.thickness).toBeCloseTo(18, 0);
        expect(top.dim.x).toBeCloseTo(slopeLen, 0);
        expect(top.dim.x).not.toBeCloseTo(innerW, 0);
        expect(top.dim.y).toBeCloseTo(600, 0);
        expect(top.lcs?.rotation?.[2]).toBeCloseTo(-betaDeg, 0);
        // loc z β: wieniec wpuszczany — lico górne na linii WEWNĘTRZNYCH
        // krawędzi boków (hL + t·tanβ do hR − t·tanβ), środek w punkcie (hL+hR)/2,
        // środek płyty o pół grubości prostopadle do skosu.
        expect(top.loc.x).toBeCloseTo(9 * Math.sin(b), 0);
        expect(top.loc.z).toBeCloseTo(1600 - 9 * Math.cos(b), 0);
    });

    /** Świat CAD z lokalnego wierzchołka: P (zamiana Y<->Z) → R → +loc. */
    function worldCorner(part: any, u: number, v: number, w: number) {
        const m = part.lcs.rotation;
        const rad = (d: number) => (d * Math.PI) / 180;
        const q = Quat.fromEulerXYZ(rad(m[0]), rad(m[1]), rad(m[2]));
        const local = new Vec3(u, w, v);
        const p = Mat4.fromQuaternion(q).transformPoint(local);
        return new Vec3(p.x + part.loc.x, p.y + part.loc.y, p.z + part.loc.z);
    }

    it('lico górne wieńca dochodzi dokładnie do wewnętrznych górnych krawędzi boków', () => {
        const plan = planSkosnyLrUc();
        const innerW = 1200 - 18 - 18;
        const b = Math.atan2(2200 - 1000, 1200);
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;
        const slopeLen = Math.hypot(innerW, innerW * Math.tan(b));

        // Lico górne = lokalne −Z (lcs.faces.OUTER = FACE_Z_MINUS)
        const right = worldCorner(top, slopeLen / 2, 0, -9);
        const left = worldCorner(top, -slopeLen / 2, 0, -9);

        expect(right.x).toBeCloseTo(innerW / 2, 0);
        expect(left.x).toBeCloseTo(-innerW / 2, 0);
        expect(right.z).toBeCloseTo(2200 - 18 * Math.tan(b), 0);
        expect(left.z).toBeCloseTo(1000 + 18 * Math.tan(b), 0);
    });

    it('boki i wieniec mają cutAngle dopasowany do β', () => {
        const plan = planSkosnyLrUc();
        const betaDeg = (Math.atan2(2200 - 1000, 1200) * 180) / Math.PI;

        const left = plan.parts.find((p) => p.role === 'LEFT_SIDE_PANEL')!;
        const right = plan.parts.find((p) => p.role === 'RIGHT_SIDE_PANEL')!;
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;

        // Lewy bok: Z+ = lico wewnętrzne → kotwica Z_PLUS zostawia je nominalne (1018 mm).
        // Prawy bok: Z+ = lico zewnętrzne → kotwica Z_MINUS cofa lico wewnętrzne (2182 mm).
        // Obie kotwice są RÓŻNE, bo lcs boków są lustrzane.
        expect(left.edge_banding?.['+Y']?.cutAngle).toBeCloseTo(betaDeg, 0);
        expect(left.edge_banding?.['+Y']?.cutAnchor).toBe('Z_PLUS');
        expect(right.edge_banding?.['+Y']?.cutAngle).toBeCloseTo(betaDeg, 0);
        expect(right.edge_banding?.['+Y']?.cutAnchor).toBe('Z_MINUS');
        expect(right.edge_banding?.['+X']?.cutAngle).toBeUndefined();
        expect(right.edge_banding?.['-Y']?.cutAngle).toBeUndefined();
        // Wieniec: końce pod kątem β z PRZECIWNYMI znakami i kotwicą Z_MINUS —
        // lica górne i dolne lądują w tej samej płaszczyźnie x = ∓innerW/2.
        expect(top.edge_banding?.['+X']?.cutAngle).toBeCloseTo(betaDeg, 1);
        expect(top.edge_banding?.['-X']?.cutAngle).toBeCloseTo(-betaDeg, 1);
        expect(top.edge_banding?.['+X']?.cutAnchor).toBe('Z_MINUS');
        expect(top.edge_banding?.['-X']?.cutAnchor).toBe('Z_MINUS');
    });

    it('oba lica wienca trafiają w lica wewnętrzne boków (końce pionowe, bez klina)', () => {
        const plan = planSkosnyLrUc();
        const W = 1200;
        const innerW = W - 18 - 18;
        const b = beta(W);
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;
        const slopeLen = Math.hypot(innerW, innerW * Math.tan(b));
        const inset = 18 * Math.tan(b);

        for (const sx of [1, -1]) {
            // lico górne = lokalne −Z (nominalne), lico dolne = lokalne +Z (ucięte).
            // Ucięcie cofa lico dolne w obu końcach w kierunku −X (tak działa
            // applyXEdge z kotwicą Z_MINUS), o inset = t·tanβ.
            const dol = worldCorner(top, sx * (slopeLen / 2) - inset, 0, 9);
            const gora = worldCorner(top, (sx * slopeLen) / 2, 0, -9);
            expect(gora.x).toBeCloseTo((sx * innerW) / 2, 0);
            expect(dol.x).toBeCloseTo((sx * innerW) / 2, 0);
        }
    });

    it('wszystkie górne krawędzie (oba boki + wieniec) leżą w jednej płaszczyźnie', () => {
        const plan = planSkosnyLrUc();
        const W = 1200;
        const t = 18;
        const innerW = W - 2 * t;
        const b = beta(W);
        const rise = t * Math.tan(b);
        const left = plan.parts.find((p) => p.role === 'LEFT_SIDE_PANEL')!;
        const right = plan.parts.find((p) => p.role === 'RIGHT_SIDE_PANEL')!;
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;

        // Lewy bok: formatka ma hL + rise (1018 mm), krawędź zewnętrzna ucięta do hL (1000 mm).
        expect(left.dim.x).toBeCloseTo(1000 + rise, 0);
        expect(left.loc.z).toBeCloseTo((1000 + rise) / 2, 0);
        // Prawy bok: pełna wysokość hR (2200 mm), krawędź zewnętrzna na hR.
        expect(right.dim.x).toBeCloseTo(2200, 0);
        expect(right.loc.z).toBeCloseTo(1100, 0);

        // Płaszczyzna dachu: z(x) = 1600 + x · tanβ
        const planeZ = (x: number) => 1600 + x * Math.tan(b);
        const slopeLen = Math.hypot(innerW, innerW * Math.tan(b));
        const wieniecL = worldCorner(top, -slopeLen / 2, 0, -9);
        const wieniecR = worldCorner(top, slopeLen / 2, 0, -9);

        // Wewnętrzne górne naroże boków (Z+ dla lewego = wewnętrzne, Z− dla prawego)
        expect(wieniecL.z).toBeCloseTo(planeZ(wieniecL.x), 0);
        expect(wieniecR.z).toBeCloseTo(planeZ(wieniecR.x), 0);
        expect(wieniecL.z).toBeCloseTo(1000 + rise, 0);
        expect(wieniecR.z).toBeCloseTo(2200 - rise, 0);
        // Zewnętrzne końce: prawy = 2200 mm, lewy = 1000 mm (zgodnie z UI i pomiarem!)
        expect(planeZ(W / 2)).toBeCloseTo(2200, 0);
        expect(planeZ(-W / 2)).toBeCloseTo(1000, 0);
    });

    it('defaults i resolveCabinetType', () => {
        const defs = korpusDefaultsForTypeMm('korpus_skosny_lr_uc');
        expect(defs.wysokosc_lewy_mm).toBe(1000);
        expect(defs.wysokosc_prawy_mm).toBe(2200);
        expect(resolveCabinetType('korpus_skosny_lr_uc')).toBe('korpus_skosny_lr_uc');
    });
});

describe('KORPUS_SKOSNY_LR', () => {
    it('plecy HDF 3 mm podążają za docinanym wieńcem i domyślnymi marginesami', () => {
        const plan = planCabinet({
            szerokosc_mm: 1200,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1,
            typ_korpusu: 'korpus_skosny_lr',
            wysokosc_lewy_mm: 1000,
            wysokosc_prawy_mm: 2200,
            cofniecie_plecow_mm: 3
        });
        const back = plan.parts.find((part) => part.role === 'BACK_PANEL')!;
        const innerW = 1200 - 18 - 18;
        const overlap = 11;  // domyślna zakładka na każdej krawędzi
        const backW = innerW + overlap + overlap;
        const betaLR = Math.atan2(2200 - 1000, innerW);
        const tanBetaLR = Math.tan(betaLR);
        const cosBetaLR = Math.cos(betaLR);
        const roofThickVert = 18 / cosBetaLR;

        // z_bottom = grubosc_dolny - overlap_dol = 18 - 11 = 7
        const z_bottom = 18 - overlap;

        // absolutna wysokość dachu zewnętrznego i sufitu wnęki na krawędziach pleców
        const rightRoofAbsExt = 2200 + overlap * tanBetaLR;
        const leftRoofAbsExt  = 1000 - overlap * tanBetaLR;
        const rightRoofInnerExt = rightRoofAbsExt - roofThickVert;
        const leftRoofInnerExt  = leftRoofAbsExt  - roofThickVert;

        const rightRoofRel = rightRoofInnerExt - z_bottom;
        const leftRoofRel  = leftRoofInnerExt  - z_bottom;
        const maxRoofRel = Math.max(rightRoofRel, leftRoofRel);
        // backH: sufit wnęki (środek wnęki) + overlap (wpuszczenie 11 mm w wieniec)
        const backH = maxRoofRel + overlap;

        const v_right_roof = maxRoofRel - rightRoofRel;
        const v_left_roof  = maxRoofRel - leftRoofRel;

        expect(back.thickness).toBeCloseTo(3, 0);
        expect(back.material).toBe('HDF_BIALY_3');
        expect(back.dim.x).toBeCloseTo(backW, 0);
        // obrys: v=backH=podłoga, v=małe=dach (wynika z LCS [180,0,0])
        expect((back.customProperties as any).outline2d).toEqual([
            [0,     backH],
            [backW, backH],
            [backW, v_right_roof],
            [0,     v_left_roof]
        ]);

        // CAD Z szczytów pleców (CAD_Z = loc.z + backH/2 - v_roof)
        const cadZRight = back.loc!.z + back.dim!.z / 2 - v_right_roof;
        const cadZLeft  = back.loc!.z + back.dim!.z / 2 - v_left_roof;

        // Plecy NIE wystają ponad zewnętrzny dach szafki — margines 11 mm liczy się od środka wnęki
        expect(cadZRight).toBeLessThan(rightRoofAbsExt);
        expect(cadZLeft).toBeLessThan(leftRoofAbsExt);
        expect(cadZRight).toBeCloseTo(rightRoofInnerExt + overlap, 1);
        expect(cadZLeft).toBeCloseTo(leftRoofInnerExt + overlap, 1);
    });

    it('plecy w korpus_skosny_lr_uc z uciosem: margines 11 liczony od środka wnęki, plecy nie wystają', () => {
        const plan = planCabinet({
            szerokosc_mm: 1200,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1,
            typ_korpusu: 'korpus_skosny_lr_uc',
            wysokosc_lewy_mm: 1000,
            wysokosc_prawy_mm: 2200,
            cofniecie_plecow_mm: 3
        });
        const back = plan.parts.find((part) => part.role === 'BACK_PANEL')!;
        const innerW = 1200 - 18 - 18;
        const overlap = 11;
        const backW = innerW + overlap + overlap;
        const tanBeta = (2200 - 1000) / 1200;
        const betaRad = Math.atan(tanBeta);
        const roofThickVert = 18 / Math.cos(betaRad);

        const z_bottom = 18 - overlap;
        const uskokPrawy = 18 * tanBeta;
        const uskokLewy  = 18 * tanBeta;

        const rightRoofAbsExt = 2200 - uskokPrawy + overlap * tanBeta;
        const leftRoofAbsExt  = 1000 + uskokLewy  - overlap * tanBeta;
        const rightRoofInnerExt = rightRoofAbsExt - roofThickVert;
        const leftRoofInnerExt  = leftRoofAbsExt  - roofThickVert;

        const rightRoofRel = rightRoofInnerExt - z_bottom;
        const leftRoofRel  = leftRoofInnerExt  - z_bottom;
        const maxRoofRel = Math.max(rightRoofRel, leftRoofRel);
        const backH = maxRoofRel + overlap;

        const v_right_roof = maxRoofRel - rightRoofRel;
        const v_left_roof  = maxRoofRel - leftRoofRel;

        expect(back.dim.x).toBeCloseTo(backW, 0);
        expect((back.customProperties as any).outline2d).toEqual([
            [0,     backH],
            [backW, backH],
            [backW, v_right_roof],
            [0,     v_left_roof]
        ]);

        const cadZRight = back.loc!.z + back.dim!.z / 2 - v_right_roof;
        const cadZLeft  = back.loc!.z + back.dim!.z / 2 - v_left_roof;

        // Szczyty pleców nie przekraczają zewnętrznej linii dachu szafki
        expect(cadZRight).toBeLessThan(rightRoofAbsExt);
        expect(cadZLeft).toBeLessThan(leftRoofAbsExt);
        expect(cadZRight).toBeCloseTo(rightRoofInnerExt + overlap, 1);
        expect(cadZLeft).toBeCloseTo(leftRoofInnerExt + overlap, 1);
    });

    it('obsługuje minimalną wysokość lewą 1 mm oraz domyślną prawą wysokość równą wysokości szafki', () => {
        const plan = planCabinet({
            szerokosc_mm: 1200,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1,
            typ_korpusu: 'korpus_skosny_lr_uc',
            wysokosc_lewy_mm: 1,
            cofniecie_plecow_mm: 3
        });
        const leftSide = plan.parts.find((part) => part.role === 'LEFT_SIDE_PANEL')!;
        const rightSide = plan.parts.find((part) => part.role === 'RIGHT_SIDE_PANEL')!;

        // Bok lewy ma wysokość 1 mm + uskok (bez obcinania hL do min 100 mm)
        const tanBeta = (2200 - 1) / 1200;
        const rise = 18 * tanBeta;
        expect(leftSide.dim.x).toBeCloseTo(1 + rise, 1);
        // Bok prawy domyślnie przyjmuje wysokość szafki = 2200 mm
        expect(rightSide.dim.x).toBeCloseTo(2200, 0);
    });
});
