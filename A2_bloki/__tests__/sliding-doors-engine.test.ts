import { describe, it, expect } from 'vitest';
import {
    calculateSlidingDoorsPlan,
    normalizeSlidingDoorsParams,
    calculateDefaultSlidingDoorsCount,
    assertCanonicalSlidingDoorsParams
} from '../19_sliding-doors-engine.js';
import type { BlokiDimensions_mm } from '../01_bloki-types.js';

describe('19_sliding-doors-engine (Sevroll System)', () => {
    const defaultDims: BlokiDimensions_mm = {
        width_mm: 1800,
        height_mm: 2500,
        depth_mm: 600
    };

    describe('calculateDefaultSlidingDoorsCount (Sevroll wytyczne projektowe)', () => {
        it('wylicza 2 skrzydła dla szaf węższych niż 1800 mm', () => {
            expect(calculateDefaultSlidingDoorsCount(1000)).toBe(2);
            expect(calculateDefaultSlidingDoorsCount(1200)).toBe(2);
            expect(calculateDefaultSlidingDoorsCount(1600)).toBe(2);
            expect(calculateDefaultSlidingDoorsCount(1799)).toBe(2);
        });

        it('wylicza 3 skrzydła dla szaf 1800–2699 mm', () => {
            expect(calculateDefaultSlidingDoorsCount(1800)).toBe(3);
            expect(calculateDefaultSlidingDoorsCount(2000)).toBe(3);
            expect(calculateDefaultSlidingDoorsCount(2400)).toBe(3);
            expect(calculateDefaultSlidingDoorsCount(2699)).toBe(3);
        });

        it('wylicza 4 skrzydła dla szaf 2700–3599 mm', () => {
            expect(calculateDefaultSlidingDoorsCount(2700)).toBe(4);
            expect(calculateDefaultSlidingDoorsCount(3000)).toBe(4);
            expect(calculateDefaultSlidingDoorsCount(3599)).toBe(4);
        });

        it('wylicza 5 skrzydeł dla szaf od 3600 mm wzwyż', () => {
            expect(calculateDefaultSlidingDoorsCount(3600)).toBe(5);
            expect(calculateDefaultSlidingDoorsCount(4000)).toBe(5);
        });
    });

    describe('normalizeSlidingDoorsParams', () => {
        it('ustawia kanoniczne parametry Sevroll jako wartości domyślne', () => {
            const p = normalizeSlidingDoorsParams({}, defaultDims);
            expect(p.liczba_skrzydel).toBe(3); // dla W=1800 domyślnie 3 skrzydła
            expect(p.zakladka_mm).toBe(30);     // standardowy zakład profilu Sevroll
            expect(p.typ_rolki).toBe('BOTTOM'); // system dolnobieżny Sevroll
            expect(p.tor_gorny_wysokosc_mm).toBe(40);
            expect(p.tor_gorny_glebokosc_mm).toBe(75);
            expect(p.tor_dolny_wysokosc_mm).toBe(10);
            expect(p.tor_dolny_glebokosc_mm).toBe(60);
            expect(p.rozstaw_torow_mm).toBe(35);
            expect(p.szerokosc_raczki_mm).toBe(25);
            expect(p.grubosc_raczki_mm).toBe(28);
            expect(p.pokaz_raczki).toBe(true);
            expect(p.pokaz_rolki).toBe(true);
        });

        it('odrzuca wycofane aliasy (fail-fast, reguła kontraktu)', () => {
            expect(() => assertCanonicalSlidingDoorsParams({ door_count: 2 } as any)).toThrow();
            expect(() => assertCanonicalSlidingDoorsParams({ leaf_count: 2 } as any)).toThrow();
            expect(() => assertCanonicalSlidingDoorsParams({ guide_height: 10 } as any)).toThrow();
        });
    });

    describe('calculateSlidingDoorsPlan', () => {
        it('generuje tor górny i tor dolny podwójny', () => {
            const params = normalizeSlidingDoorsParams({ liczba_skrzydel: 2 }, defaultDims);
            const plan = calculateSlidingDoorsPlan(defaultDims, params);

            const torGorny = plan.parts.find(p => p.name === 'Tor_Gorny');
            expect(torGorny).toBeDefined();
            expect(torGorny?.role).toBe('SLIDING_TRACK');
            expect(torGorny?.dim.x).toBe(1800);
            expect(torGorny?.dim.y).toBe(75);
            expect(torGorny?.dim.z).toBe(40);

            const torDolny = plan.parts.find(p => p.name === 'Tor_Dolny');
            expect(torDolny).toBeDefined();
            expect(torDolny?.role).toBe('SLIDING_TRACK');
            expect(torDolny?.dim.x).toBe(1800);
            expect(torDolny?.dim.y).toBe(60);
            expect(torDolny?.dim.z).toBe(10);
        });

        it('drzwi mijają się w osi Y (brak kolizji toru przedniego i tylnego)', () => {
            const params = normalizeSlidingDoorsParams({ liczba_skrzydel: 2 }, defaultDims);
            const plan = calculateSlidingDoorsPlan(defaultDims, params);

            const door1 = plan.parts.find(p => p.name === 'Drzwi_Przesuwne_1');
            const door2 = plan.parts.find(p => p.name === 'Drzwi_Przesuwne_2');
            expect(door1).toBeDefined();
            expect(door2).toBeDefined();

            // Skrzydło 1 jest na torze tylnym, skrzydło 2 na torze przednim
            expect(door1!.loc.y).not.toBe(door2!.loc.y);
            // Rozstaw w Y odpowiada rozstawowi torów (35 mm)
            const rozstepY = Math.abs(door1!.loc.y - door2!.loc.y);
            expect(rozstepY).toBeCloseTo(35, 1);
        });

        it('generuje rączki aluminiowe na lewym i prawym boku skrzydła na PEŁNĄ wysokość', () => {
            const params = normalizeSlidingDoorsParams({ liczba_skrzydel: 2 }, defaultDims);
            const plan = calculateSlidingDoorsPlan(defaultDims, params);

            // Skrzydło 1 ma rączkę lewą i prawą
            const raczkaL1 = plan.parts.find(p => p.name === 'Raczka_Lewa_1');
            const raczkaP1 = plan.parts.find(p => p.name === 'Raczka_Prawa_1');
            expect(raczkaL1).toBeDefined();
            expect(raczkaP1).toBeDefined();

            // Rączki mają dokładnie taką samą pełną wysokość jak skrzydło (H - 40 mm = 2460 mm)
            const door1 = plan.parts.find(p => p.name === 'Drzwi_Przesuwne_1');
            expect(door1?.dim.z).toBe(2460);
            expect(raczkaL1?.dim.z).toBe(2460);
            expect(raczkaP1?.dim.z).toBe(2460);

            // Szerokość rączki w X = 25 mm, grubość w Y = 28 mm
            expect(raczkaL1?.dim.x).toBe(25);
            expect(raczkaL1?.dim.y).toBe(28);

            // Rączki poruszają się w tej samej osi Y co dane skrzydło
            expect(raczkaL1?.loc.y).toBe(door1?.loc.y);
            expect(raczkaP1?.loc.y).toBe(door1?.loc.y);
        });

        it('stosuje wzór Sevroll na szerokość skrzydła i zakładkę', () => {
            // W = 1800, n = 2, Z = 30 -> Sd = (1800 + 30) / 2 = 915 mm
            const params = normalizeSlidingDoorsParams({ liczba_skrzydel: 2, zakladka_mm: 30 }, defaultDims);
            const plan = calculateSlidingDoorsPlan(defaultDims, params);

            const raczkaL1 = plan.parts.find(p => p.name === 'Raczka_Lewa_1')!;
            const raczkaP1 = plan.parts.find(p => p.name === 'Raczka_Prawa_1')!;
            const raczkaL2 = plan.parts.find(p => p.name === 'Raczka_Lewa_2')!;
            const raczkaP2 = plan.parts.find(p => p.name === 'Raczka_Prawa_2')!;

            // Lewy brzeg skrzydła 1 to loc.x - w/2
            const leaf1Left = raczkaL1.loc.x - 25 / 2;
            const leaf1Right = raczkaP1.loc.x + 25 / 2;
            const leaf1Width = leaf1Right - leaf1Left;
            expect(leaf1Width).toBeCloseTo(915, 1);

            const leaf2Left = raczkaL2.loc.x - 25 / 2;
            const leaf2Right = raczkaP2.loc.x + 25 / 2;
            const leaf2Width = leaf2Right - leaf2Left;
            expect(leaf2Width).toBeCloseTo(915, 1);

            // Skrzydło 1 zaczyna się od lewej krawędzi wnęki (-900)
            expect(leaf1Left).toBeCloseTo(-900, 1);
            // Skrzydło 2 kończy się na prawej krawędzi wnęki (+900)
            expect(leaf2Right).toBeCloseTo(900, 1);

            // Zakładka w środku = leaf1Right - leaf2Left = 15 - (-15) = 30 mm
            const overlap = leaf1Right - leaf2Left;
            expect(overlap).toBeCloseTo(30, 1);
        });

        it('dla 3 skrzydeł mijanie jest w układzie Tył - Przód - Tył', () => {
            const params = normalizeSlidingDoorsParams({ liczba_skrzydel: 3 }, defaultDims);
            const plan = calculateSlidingDoorsPlan(defaultDims, params);

            const d1 = plan.parts.find(p => p.name === 'Drzwi_Przesuwne_1')!;
            const d2 = plan.parts.find(p => p.name === 'Drzwi_Przesuwne_2')!;
            const d3 = plan.parts.find(p => p.name === 'Drzwi_Przesuwne_3')!;

            // D1 i D3 na torze tylnym, D2 na torze przednim
            expect(d1.loc.y).toBe(d3.loc.y);
            expect(d2.loc.y).not.toBe(d1.loc.y);
        });

        it('reaguje na flagi pokaz_raczki i pokaz_rolki', () => {
            const noHandlesParams = normalizeSlidingDoorsParams({ pokaz_raczki: false, pokaz_rolki: false }, defaultDims);
            const plan = calculateSlidingDoorsPlan(defaultDims, noHandlesParams);

            const handles = plan.parts.filter(p => p.name.startsWith('Raczka_'));
            const rollers = plan.parts.filter(p => p.name.startsWith('Rolka_'));
            expect(handles.length).toBe(0);
            expect(rollers.length).toBe(0);
        });

        it('generuje wózki toczne dolne w torze dolnym i prowadniki w torze górnym', () => {
            const params = normalizeSlidingDoorsParams({ liczba_skrzydel: 2, typ_rolki: 'BOTH' }, defaultDims);
            const plan = calculateSlidingDoorsPlan(defaultDims, params);

            const upperRollers = plan.parts.filter(p => p.name.includes('_TG_'));
            const bottomRollers = plan.parts.filter(p => p.name.includes('_TD_'));
            // 2 skrzydła x 2 rolki (L i R) = 4 górne i 4 dolne
            expect(upperRollers.length).toBe(4);
            expect(bottomRollers.length).toBe(4);
        });
    });
});
