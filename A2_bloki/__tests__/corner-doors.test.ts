import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCornerDoorsPlan } from '../01_module-plans.js';
import { applyLcsMapping } from '../../A3_smartframe/smartframe-engine.js';
import {
    assertCanonicalCornerDoorsParams,
    normalizeCornerDoorsParams
} from '../07_corner-doors-engine.js';

describe('blok_corner_doors', () => {
    /** SB z xMin/yMax na ściankach wcięcia L — narożnik w (−W/2, +D/2). */
    const baseParams = {
        grubosc_frontu_mm: 18,
        szczelina_srodkowa_mm: 0,
        nalozenie_gora_mm: 0,
        nalozenie_dol_mm: 0,
        nalozenie_lewe_mm: 16,
        nalozenie_prawe_mm: 0,
        uzyj_zawias_1: false,
        uzyj_zawias_6: false,
    };

    const baseDims = { width_mm: 352, height_mm: 684, depth_mm: 352 };

    function planFrom(raw: Record<string, unknown>) {
        return buildCornerDoorsPlan(raw, baseDims);
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('odrzuca wycofane aliasy (fail-fast)', () => {
        expect(() => assertCanonicalCornerDoorsParams({ ov_top: 14 })).toThrow(/ov_top → nalozenie_gora_mm/);
        expect(() => assertCanonicalCornerDoorsParams({ thickness: 18 })).toThrow(/thickness → grubosc_frontu_mm/);
        expect(() => assertCanonicalCornerDoorsParams({ szczelina_srodkowa_mm: 8 })).not.toThrow();
        expect(() => assertCanonicalCornerDoorsParams({ ov_top: undefined })).not.toThrow();
    });

    it('Drzwi_Lewe = depth − szcz/2 + nalozenie − grubość', () => {
        // szcz=0: 352 + 16 − 18 = 350
        const plan = planFrom(baseParams);
        const lewe = plan.parts.find(p => p.name === 'Drzwi_Lewe')!;
        expect(lewe.dim.x).toBeCloseTo(350, 5);
    });

    it('nalozenie licuje z frontem SB (−D/2)', () => {
        const t = 18;
        const depth = 352;
        const frontY = -depth / 2;
        const plan = planFrom({
            ...baseParams,
            szczelina_srodkowa_mm: 4,
            nalozenie_lewe_mm: t,
        });
        const lewe = plan.parts.find(p => p.name === 'Drzwi_Lewe')!;
        const krawedzFront = lewe.loc.y - lewe.dim.x / 2;
        expect(krawedzFront).toBeCloseTo(frontY - t, 5);
    });

    it('narożnik L = (−W/2, +D/2); lewe na xNotch, ODS −1', () => {
        const width = 352;
        const plan = planFrom({
            ...baseParams,
            nalozenie_lewe_mm: 0,
            nalozenie_prawe_mm: 0,
        });
        const leafX = plan.parts.find(p => p.name === 'Drzwi_Prawe')!;
        const leafY = plan.parts.find(p => p.name === 'Drzwi_Lewe')!;
        const xNotch = -width / 2;
        expect(leafY.loc.x).toBeCloseTo(xNotch + 9 - 1, 5); // t/2 − ODS
        expect(leafX.lcs.rotation).toEqual([0, 0, 0]);
        expect(leafY.lcs.rotation).toEqual([0, 0, 90]);
        expect(applyLcsMapping(leafX.dim, leafX.lcs).z).toBe(18);
    });

    it('SB 352×352 / szcz 8 / nalozenie 16 → obie drzwi 346 mm', () => {
        const plan = planFrom({
            ...baseParams,
            grubosc_frontu_mm: 18,
            szczelina_srodkowa_mm: 8,
            nalozenie_lewe_mm: 16,
            nalozenie_prawe_mm: 16,
        });
        const lewe = plan.parts.find(p => p.name === 'Drzwi_Lewe')!;
        const prawe = plan.parts.find(p => p.name === 'Drzwi_Prawe')!;
        expect(lewe.dim.x).toBeCloseTo(346, 5);
        expect(prawe.dim.x).toBeCloseTo(346, 5);
    });

    it('buildCornerDoorsPlan — tylko dims SB, bez korpusu', () => {
        const plan = buildCornerDoorsPlan(
            {
                szczelina_srodkowa_mm: 0,
                nalozenie_lewe_mm: 16,
                nalozenie_prawe_mm: 0,
                nalozenie_gora_mm: 0,
                nalozenie_dol_mm: 0,
                grubosc_frontu_mm: 18,
                uzyj_zawias_1: false,
                uzyj_zawias_6: false,
            },
            { width_mm: 352, height_mm: 684, depth_mm: 352 }
        );
        expect(plan.parts.find(p => p.name === 'Drzwi_Lewe')!.dim.x).toBeCloseTo(350, 5);
        expect(plan.parts[0].meta.cornerAt).toBe('innerL_wieniec');
    });

    it('prawe na yNotch (+D/2) przy froncie grubości 10', () => {
        const depth = 352;
        const yNotch = depth / 2;
        const ods = 1;

        const plan10 = planFrom({
            ...baseParams,
            grubosc_frontu_mm: 10,
            nalozenie_lewe_mm: 0,
            nalozenie_prawe_mm: 0,
        });
        const prawe = plan10.parts.find(p => p.name === 'Drzwi_Prawe')!;
        expect(prawe.loc.y + prawe.dim.y / 2).toBeCloseTo(yNotch - ods, 5);
        expect(prawe.dim.y).toBe(10);
    });

    it('brak szczelina_srodkowa_mm — ostrzeżenie, pusty plan', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { szczelina_srodkowa_mm: _drop, ...rest } = baseParams;
        const plan = planFrom(rest);
        expect(plan.parts).toHaveLength(0);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('szczelina_srodkowa_mm'));
    });

    it('brak nalozenie_lewe_mm — ostrzeżenie, pusty plan', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { nalozenie_lewe_mm: _drop, ...rest } = baseParams;
        const plan = planFrom(rest);
        expect(plan.parts).toHaveLength(0);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('nalozenie_lewe_mm'));
    });

    it('normalizeCornerDoorsParams odrzuca thickness zamiast cichego mapowania', () => {
        expect(() => normalizeCornerDoorsParams({ thickness: 18 } as any, baseDims)).toThrow(/thickness/);
    });
});
