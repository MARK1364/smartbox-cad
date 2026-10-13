import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildSkosneDoorsPlan } from '../module-plans.js';
import {
    assertCanonicalSkosneDoorsParams,
    normalizeSkosneDoorsParams,
    skosBetaRad,
    skosneDoorHeightAt,
    skosRailVerticalSpanMm,
    skosTopOverlapRiseMm,
    skosTopOverlapRunMm
} from '../skosne-doors-engine.js';
import { classifyOutlineSegmentEdge } from '../../A4_smartpanel/native_core/polygon-extrusion.js';

/**
 * blok_skosne_drzwi — front trapezowy: dół prosty, góra pochylona.
 * Skrzydło jest jednokierunkowe: zawias TYLKO na krawędzi pionowej.
 *
 * Kąt nachylenia skosu dachu (`dach_kat_deg`) odczytywany jest z wieńca górnego korpusu.
 * Wysokość wnęki w środku korpusu to `dims.height_mm`.
 */
describe('blok_skosne_drzwi', () => {
    const dims = { width_mm: 600, height_mm: 1500, depth_mm: 600 };
    const tanSlope = (1000 - 2000) / 600; // -5/3 (hL=2000, hR=1000 przy środku 1500)
    const baseSlopeDeg = Math.atan(tanSlope) * 180 / Math.PI;

    const baseParams = {
        rodzaj_drzwi: 'LEFT' as const,
        grubosc_frontu_mm: 18,
        dach_kat_deg: baseSlopeDeg,
        nalozenie_gora_mm: 0,
        nalozenie_dol_mm: 0,
        nalozenie_lewe_mm: 0,
        nalozenie_prawe_mm: 0,
        uzyj_zawias_1: false,
        uzyj_zawias_6: false
    };

    function planFrom(over: Record<string, unknown> = {}) {
        return buildSkosneDoorsPlan({ ...baseParams, ...over }, dims);
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ─── Trapez ──────────────────────────────────────────────────────────────

    it('liść jest trapezem: dół prosty na pełnej szerokości, góra pochylona', () => {
        const plan = planFrom();
        const leaf = plan.parts.find(p => p.role === 'FRONT')!;
        const outline = (leaf.customProperties as any).outline2d as number[][];

        expect(outline[0]).toEqual([0, 0]);
        expect(outline[1]).toEqual([600, 0]);
        expect(outline[2][0]).toBe(600);
        expect(outline[2][1]).toBeCloseTo(1000, 6);
        expect(outline[3][0]).toBe(0);
        expect(outline[3][1]).toBeCloseTo(2000, 6);

        expect((leaf.customProperties as any).shape).toBe('skos_front');
        // bbox = najwyższy punkt skrzydła
        expect(leaf.dim.z).toBeCloseTo(2000, 6);
        expect(leaf.dim.x).toBe(600);
        expect(leaf.dim.y).toBe(18);
    });

    it('obrys jest w ramce bbox i v rośnie w górę (konwencja FACE_Z_PLUS)', () => {
        const outline = (planFrom().parts[0].customProperties as any).outline2d as number[][];
        for (const [u, v] of outline) {
            expect(u).toBeGreaterThanOrEqual(0);
            expect(u).toBeLessThanOrEqual(600);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(2000.01);
        }
        // dół płaski = oba narożniki dolne na v = 0
        expect(outline[0][1]).toBe(0);
        expect(outline[1][1]).toBe(0);
    });

    it('odwrócenie skosu przewraca trapez (hMirror), nie zmienia wysokości', () => {
        const mirrorAngleDeg = Math.atan((2000 - 1000) / 600) * 180 / Math.PI;
        const mirror = planFrom({ dach_kat_deg: mirrorAngleDeg, rodzaj_drzwi: 'RIGHT' });
        const outline = (mirror.parts[0].customProperties as any).outline2d as number[][];

        expect(outline[0]).toEqual([0, 0]);
        expect(outline[1]).toEqual([600, 0]);
        expect(outline[2][0]).toBe(600);
        expect(outline[2][1]).toBeCloseTo(2000, 6);
        expect(outline[3][0]).toBe(0);
        expect(outline[3][1]).toBeCloseTo(1000, 6);
        expect(mirror.parts[0].dim.z).toBeCloseTo(2000, 6);
    });

    it('skosneDoorHeightAt: wysokość w środku plus x*tan(beta) plus nałożenia', () => {
        const H_center = 1500, W = 600, angleDeg = baseSlopeDeg, ovTop = 14, ovBot = 15;
        const beta = skosBetaRad(angleDeg);
        const tanBeta = Math.tan(beta);
        const cosBeta = Math.cos(beta);
        const rise = skosTopOverlapRiseMm(ovTop, angleDeg);

        // lewa krawędź skrzydła (u=0, x = -W/2 = -300)
        const lewa = skosneDoorHeightAt(0, H_center, W, angleDeg, ovTop, ovBot);
        expect(lewa).toBeCloseTo(H_center - 300 * tanBeta + ovBot + rise, 9);
        expect(lewa).toBeCloseTo(2000 + ovBot + 14 * cosBeta, 6);

        // prawa krawędź skrzydła (u=1, x = +W/2 = +300)
        const prawa = skosneDoorHeightAt(1, H_center, W, angleDeg, ovTop, ovBot);
        expect(prawa).toBeCloseTo(H_center + 300 * tanBeta + ovBot + rise, 9);
        expect(prawa).toBeCloseTo(1000 + ovBot + 14 * cosBeta, 6);
    });

    it('nałożenie górne mierzone PROSTOPADLE do skosu: rise = nalozenie·cos(β)', () => {
        const angleDeg = baseSlopeDeg, n = 18;
        const beta = skosBetaRad(angleDeg);
        expect(skosTopOverlapRiseMm(n, angleDeg)).toBeCloseTo(n * Math.cos(beta), 9);
        // Kąt płaski 0° → pełne nałożenie, zgodnie z modułem DRZWI
        expect(skosTopOverlapRiseMm(n, 0)).toBeCloseTo(n, 9);
        // Skos stromy → mniej w pionie (pokrycie idzie wzdłuż skosu)
        expect(skosTopOverlapRiseMm(n, angleDeg)).toBeLessThan(n);
    });

    it('dół jest zawsze pionowy — niezależnie od skosu', () => {
        const zTolne = skosneDoorHeightAt(0, 1500, 600, baseSlopeDeg, 0, 15);
        const zZero = skosneDoorHeightAt(0, 1500, 600, baseSlopeDeg, 0, 0);
        expect(zTolne - zZero).toBeCloseTo(15, 9);
    });

    it('wieniec skośny: pionowa rozpiętość = t / cos(β)', () => {
        const t = 18;
        expect(skosRailVerticalSpanMm(t, 0)).toBeCloseTo(t, 9);
        expect(skosRailVerticalSpanMm(t, baseSlopeDeg)).toBeGreaterThan(t);
    });

    it('nałożenie górne 0 i boczne nałożenia → góra skrzydła idealnie licuje się ze spodem wieńca skośnego', () => {
        const ovL = 16, ovR = 16;
        const plan = planFrom({
            dach_kat_deg: baseSlopeDeg,
            nalozenie_gora_mm: 0,
            nalozenie_dol_mm: 15,
            nalozenie_lewe_mm: ovL,
            nalozenie_prawe_mm: ovR
        });
        const outline = (plan.parts[0].customProperties as any).outline2d as number[][];
        const tanBeta = Math.tan(skosBetaRad(baseSlopeDeg));

        // Spód wieńca w układzie wnęki względem spodu drzwi:
        // xL = -300 - 16 = -316 -> Z_top = 1500 + (-316)*tanBeta + 15
        // xP = +300 + 16 = +316 -> Z_top = 1500 + (+316)*tanBeta + 15
        const expectedL = 1500 + (-316) * tanBeta + 15;
        const expectedR = 1500 + (+316) * tanBeta + 15;

        expect(outline[3][1]).toBeCloseTo(expectedL, 6);
        expect(outline[2][1]).toBeCloseTo(expectedR, 6);

        // Nachylenie góry skrzydła jest w 100% identyczne z nachyleniem wieńca korpusu!
        const leafW = 600 + ovL + ovR;
        const nachylenieSkrzydla = (outline[2][1] - outline[3][1]) / leafW;
        expect(nachylenieSkrzydla).toBeCloseTo(tanBeta, 9);
    });

    // ─── Zawias na krawędzi pionowej ─────────────────────────────────────────

    it('LEWE wymaga spadku w prawo (dach_kat_deg <= 0); niespójność to błąd', () => {
        const rightHigherAngle = Math.atan(1000 / 600) * 180 / Math.PI;
        expect(() => planFrom({ rodzaj_drzwi: 'LEFT', dach_kat_deg: rightHigherAngle }))
            .toThrow(/krawędzi pionowej/);
    });

    it('PRAWE wymaga wzniosu w prawo (dach_kat_deg >= 0)', () => {
        expect(() => planFrom({ rodzaj_drzwi: 'RIGHT', dach_kat_deg: baseSlopeDeg }))
            .toThrow(/krawędzi pionowej/);
    });

    it('równe wysokości (kąt 0): obie krawędzie pionowe, oba warianty dopuszczalne', () => {
        expect(planFrom({ dach_kat_deg: 0, rodzaj_drzwi: 'LEFT' }).parts).toHaveLength(1);
        expect(planFrom({ dach_kat_deg: 0, rodzaj_drzwi: 'RIGHT' }).parts).toHaveLength(1);
    });

    it('zawiasy i puszki lądują na krawędzi pionowej, nigdy na pochylonej', () => {
        const plan = planFrom({ uzyj_zawias_1: true, uzyj_zawias_6: true, pozycja_zawias_1_mm: 100, pozycja_zawias_6_mm: 100 });
        const leaf = plan.parts[0];
        const cups = (leaf.features ?? []).filter(f => f.params.isDoorCup);
        expect(cups.length).toBe(2);
        // Lewa skośna = pionowa po lewej → puszka przy u ≈ edgeDist (blisko 0)
        for (const cup of cups) {
            expect(cup.params.side).toBe('left');
            expect(cup.params.u).toBeLessThan(60);
            expect(cup.params.hardwareId).toBe(`hinge_left_${cup.params.hingeIndex}`);
        }
    });

    it('okucia hardware dostają tę samą stronę co narożniki na froncie', () => {
        const plan = planFrom({ uzyj_zawias_1: true, pozycja_zawias_1_mm: 100 });
        const cup = plan.parts[0].features!.find(f => f.params.isDoorCup)!;
        const hw = plan.hardware!.find(h => h.id === 'hinge_left_1')!;
        expect(hw.side).toBe('left');
        expect(hw.loc.x).toBeCloseTo(plan.parts[0].loc.x - plan.parts[0].dim.x / 2 + cup.params.u, 5);
        expect(hw.loc.z).toBeCloseTo(plan.parts[0].loc.z - plan.parts[0].dim.z / 2 + cup.params.v, 5);
    });

    it('wariant PRAWE przenosi puszki na prawą krawędź', () => {
        const mirrorAngleDeg = Math.atan(1000 / 600) * 180 / Math.PI;
        const plan = planFrom({ rodzaj_drzwi: 'RIGHT', dach_kat_deg: mirrorAngleDeg, uzyj_zawias_1: true });
        const cup = plan.parts[0].features!.find(f => f.params.isDoorCup)!;
        expect(cup.params.side).toBe('right');
        expect(cup.params.u).toBeGreaterThan(540);
        expect(plan.hardware![0].side).toBe('right');
    });

    // ─── Fail-fast ───────────────────────────────────────────────────────────

    it('brak dach_kat_deg: ostrzeżenie i pusty plan (zero zgadywania)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { dach_kat_deg: _d, ...rest } = baseParams;
        const plan = buildSkosneDoorsPlan(rest, dims);
        expect(plan.parts).toHaveLength(0);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('dach_kat_deg'));
    });

    it('zbyt niskie skrzydło: ostrzeżenie i pusty plan', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const tinyDims = { width_mm: 600, height_mm: 10, depth_mm: 600 };
        const plan = buildSkosneDoorsPlan(baseParams, tinyDims);
        expect(plan.parts).toHaveLength(0);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('pomijam plan'));
    });

    it('odrzuca wycofane aliasy zamiast po cichu mapować', () => {
        expect(() => assertCanonicalSkosneDoorsParams({ heightLeft: 2000 }))
            .toThrow(/heightLeft → dach_kat_deg/);
        expect(() => assertCanonicalSkosneDoorsParams({ wysokosc_lewy_mm: 2000 }))
            .toThrow(/wysokosc_lewy_mm → dach_kat_deg/);
        expect(() => assertCanonicalSkosneDoorsParams({ ov_top: 14 }))
            .toThrow(/ov_top → nalozenie_gora_mm/);
        expect(() => assertCanonicalSkosneDoorsParams({ dach_kat_deg: -45 })).not.toThrow();
    });

    // ─── Obrzeża ────────────────────────────────────────────────────────────

    it('pochylona krawędź nie dostaje obrzeża; trzy proste krawędzie tak', () => {
        const band = planFrom().parts[0].edge_banding!;
        expect(band['-X'].active).toBe(true);
        expect(band['+X'].active).toBe(true);
        expect(band['-Y'].active).toBe(true);
        expect(band['+Y'].active).toBe(false);
        expect(band.NOTCH.active).toBe(false);
    });

    it('klasyfikacja obrysu: dół -Y, boki ±X, góra pochylona +Y', () => {
        const outline: number[][] = [[0, 0], [600, 0], [600, 1000], [0, 2000]];
        const keys = outline.map((p, i) => {
            const q = outline[(i + 1) % outline.length];
            return classifyOutlineSegmentEdge(p[0], p[1], q[0], q[1], 600, 2000);
        });
        expect(keys).toEqual(['-Y', '+X', '+Y', '-X']);
    });
});