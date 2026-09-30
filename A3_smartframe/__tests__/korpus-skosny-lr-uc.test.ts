import { describe, it, expect } from 'vitest';
import { planCabinet } from '../smartframe-engine.js';
import { korpusDefaultsForTypeMm } from '../korpus-defaults';
import { resolveCabinetType } from '../smartframe-adapter';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';

const beta = (innerW: number) => Math.atan2(1200, innerW);

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

    it('wieniec górny: dim.x = slopeLen (wydłużenie po skosie), nie samo innerWidth', () => {
        const plan = planSkosnyLrUc();
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;
        const innerW = 1200 - 18 - 18;
        const betaDeg = (Math.atan2(2200 - 1000, innerW) * 180) / Math.PI;
        const slopeLen = Math.hypot(innerW, 1200);

        expect(top.thickness).toBeCloseTo(18, 0);
        expect(top.dim.x).toBeCloseTo(slopeLen, 0);
        expect(top.dim.x).not.toBeCloseTo(innerW, 0);
        expect(top.dim.y).toBeCloseTo(600, 0);
        expect(top.lcs?.rotation?.[2]).toBeCloseTo(-betaDeg, 0);
        // loc z β: wieniec wpuszczany — lico górne na linii WEWNĘTRZNYch górnych
        // krawędzi boków (hL/hR − t·tanβ), środek o pół grubości prostopadle do skosu.
        const beta = (betaDeg * Math.PI) / 180;
        const bevelRise = 18 * Math.tan(beta);
        expect(top.loc.x).toBeCloseTo(9 * Math.sin(beta), 0);
        expect(top.loc.z).toBeCloseTo(1600 - bevelRise - 9 * Math.cos(beta), 0);
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
        const beta = Math.atan2(2200 - 1000, innerW);
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;
        const slopeLen = Math.hypot(innerW, 1200);

        // Lico górne = lokalne −Z (lcs.faces.OUTER = FACE_Z_MINUS)
        const right = worldCorner(top, slopeLen / 2, 0, -9);
        const left = worldCorner(top, -slopeLen / 2, 0, -9);

        expect(right.x).toBeCloseTo(innerW / 2, 0);
        expect(left.x).toBeCloseTo(-innerW / 2, 0);
        expect(right.z).toBeCloseTo(2200 - 18 * Math.tan(beta), 0);
        expect(left.z).toBeCloseTo(1000 - 18 * Math.tan(beta), 0);
    });

    it('boki i wieniec mają cutAngle dopasowany do β', () => {
        const plan = planSkosnyLrUc();
        const innerW = 1200 - 18 - 18;
        const betaDeg = (Math.atan2(2200 - 1000, innerW) * 180) / Math.PI;

        const left = plan.parts.find((p) => p.role === 'LEFT_SIDE_PANEL')!;
        const right = plan.parts.find((p) => p.role === 'RIGHT_SIDE_PANEL')!;
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;

        // Lewy bok: Z+ = lico wewnętrzne → kotwica Z_PLUS zostawia je nominalne.
        // Prawy bok: Z+ = lico zewnętrzne → kotwica Z_MINUS cofa lico wewnętrzne.
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
        const innerW = 1200 - 18 - 18;
        const b = beta(innerW);
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;
        const slopeLen = Math.hypot(innerW, 1200);
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
        const b = beta(innerW);
        const rise = t * Math.tan(b);
        const left = plan.parts.find((p) => p.role === 'LEFT_SIDE_PANEL')!;
        const right = plan.parts.find((p) => p.role === 'RIGHT_SIDE_PANEL')!;
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;

        // Lewy bok jest niższy o t·tanβ od hL (jego górna krawędź ma być
        // współbieżna z wiencem, a nie wznosić się do zewnątrz).
        expect(left.dim.x).toBeCloseTo(1000 - rise, 0);
        expect(left.loc.z).toBeCloseTo((1000 - rise) / 2, 0);
        // Prawy bok zachowuje pełną wysokość korpusu.
        expect(right.dim.x).toBeCloseTo(2200, 0);

        // Płaszczyzna: z(x) = (hR − rise) + (x − innerW/2)·tanβ
        const planeZ = (x: number) => (2200 - rise) + (x - innerW / 2) * Math.tan(b);
        const slopeLen = Math.hypot(innerW, 1200);
        const wieniecL = worldCorner(top, -slopeLen / 2, 0, -9);
        const wieniecR = worldCorner(top, slopeLen / 2, 0, -9);

        // Wewnętrzne górne naroże boków (Z+ dla lewego = wewnętrzne, Z− dla prawego)
        expect(wieniecL.z).toBeCloseTo(planeZ(wieniecL.x), 0);
        expect(wieniecR.z).toBeCloseTo(planeZ(wieniecR.x), 0);
        expect(wieniecL.z).toBeCloseTo(1000 - rise, 0);
        expect(wieniecR.z).toBeCloseTo(2200 - rise, 0);
        // Zewnętrzne końce: prawy = pełna wysokość, lewy = o t·tanβ niżej
        expect(planeZ(W / 2)).toBeCloseTo(2200, 0);
        expect(planeZ(-W / 2)).toBeCloseTo(1000 - 2 * rise, 0);
    });

    it('defaults i resolveCabinetType', () => {
        const defs = korpusDefaultsForTypeMm('korpus_skosny_lr_uc');
        expect(defs.wysokosc_lewy_mm).toBe(1000);
        expect(defs.wysokosc_prawy_mm).toBe(2200);
        expect(resolveCabinetType('korpus_skosny_lr_uc')).toBe('korpus_skosny_lr_uc');
    });
});
