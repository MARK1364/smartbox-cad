import { describe, it, expect } from 'vitest';
import { normalizeFlapsParams, calculateFlapsPlan, assertCanonicalFlapsParams } from '../flaps-engine.js';

describe('flaps-engine (Functional Core)', () => {
    it('normalizes canonical parameters', () => {
        const norm = normalizeFlapsParams({
            kierunek_klapy: 'TOP',
            grubosc_frontu_mm: 19,
            nalozenie_gora_mm: 14,
            nalozenie_dol_mm: 15,
            nalozenie_lewe_mm: 16,
            nalozenie_prawe_mm: 16,
            odsuniecie_zawiasu_lewe_mm: 90,
            odsuniecie_zawiasu_prawe_mm: 90,
            zawias_srodkowy: true
        });

        expect(norm.kierunek_klapy).toBe('TOP');
        expect(norm.grubosc_frontu_mm).toBe(19);
        expect(norm.nalozenie_gora_mm).toBe(14);
        expect(norm.odsuniecie_zawiasu_lewe_mm).toBe(90);
        expect(norm.zawias_srodkowy).toBe(true);
    });

    it('odrzuca wycofane aliasy (fail-fast)', () => {
        expect(() => assertCanonicalFlapsParams({ ov_top: 14 })).toThrow(/ov_top → nalozenie_gora_mm/);
        expect(() => assertCanonicalFlapsParams({ flap_type: 'TOP' })).toThrow(/flap_type → kierunek_klapy/);
    });

    it('calculates flap panel dimensions and positions correctly', () => {
        const dims = { width_mm: 600, height_mm: 400, depth_mm: 350 };
        const params = normalizeFlapsParams({
            kierunek_klapy: 'TOP',
            grubosc_frontu_mm: 18,
            nalozenie_lewe_mm: 16,
            nalozenie_prawe_mm: 16,
            nalozenie_gora_mm: 14,
            nalozenie_dol_mm: 15,
            zawias_srodkowy: true
        });

        const plan = calculateFlapsPlan(dims, params);
        expect(plan.parts).toHaveLength(1);

        const flap = plan.parts[0];
        expect(flap.name).toBe('Klapa');
        expect(flap.role).toBe('FLAP');
        expect(flap.dim.x).toBe(600 + 16 + 16); // 632
        expect(flap.dim.y).toBe(18);
        expect(flap.dim.z).toBe(400 + 14 + 15); // 429

        expect(plan.hardware).toHaveLength(3);
        const hwLeft = plan.hardware?.find(h => h.side === 'left');
        const hwRight = plan.hardware?.find(h => h.side === 'right');
        expect(hwLeft).toBeDefined();
        expect(hwRight).toBeDefined();
    });

    it('sets cup orientation top/bottom toward wreath (not door left/right)', () => {
        const topPlan = calculateFlapsPlan(
            { width_mm: 600, height_mm: 400, depth_mm: 350 },
            normalizeFlapsParams({ kierunek_klapy: 'TOP' })
        );
        const bottomPlan = calculateFlapsPlan(
            { width_mm: 600, height_mm: 400, depth_mm: 350 },
            normalizeFlapsParams({ kierunek_klapy: 'BOTTOM' })
        );

        const topCups = topPlan.parts[0].features.filter((f: any) => f.params?.isFlapCup);
        const bottomCups = bottomPlan.parts[0].features.filter((f: any) => f.params?.isFlapCup);

        expect(topCups.length).toBe(2);
        expect(bottomCups.length).toBe(2);
        for (const cup of topCups) {
            expect(cup.params.orientation).toBe('top');
            expect(cup.params.isFlapCup).toBe(true);
        }
        for (const cup of bottomCups) {
            expect(cup.params.orientation).toBe('bottom');
            expect(cup.params.isFlapCup).toBe(true);
        }

        // Wkręty wzdłuż osi zawiasu (U), nie jak drzwi wzdłuż V
        const topCup = topCups[0];
        const topScrew = topPlan.parts[0].features.find(
            (f: any) => f.params?.isFlapScrew && f.params?.hingeKey === topCup.params.hingeKey
        );
        expect(topScrew.params.v).toBeCloseTo(topCup.params.v - 8.5, 1); // edgeDist 31 vs 22.5 od góry
        expect(Math.abs(topScrew.params.u - topCup.params.u)).toBeCloseTo(22.5, 1);
    });
});
