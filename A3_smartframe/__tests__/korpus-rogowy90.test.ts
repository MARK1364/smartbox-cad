import { describe, it, expect } from 'vitest';
import { planCabinet } from '../smartframe-engine.js';

describe('KORPUS_ROGOWY90 kÄ…townik', () => {
    it('plans two perpendicular backs and two end sides', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600, glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 3
        });

        expect(plan.zones).toHaveLength(1);

        const backs = plan.parts.filter(p => p.role === 'BACK_PANEL');
        expect(backs).toHaveLength(2);

        const keys = plan.parts.map(p => p.key);
        expect(keys.some(k => k.includes('PLECY_Y') || k === 'PLECY_Y')).toBe(true);
        expect(keys.some(k => k.includes('PLECY_X') || k === 'PLECY_X')).toBe(true);
        expect(keys.some(k => k.includes('BOK_P') || k === 'BOK_P')).toBe(true);
        expect(keys.some(k => k.includes('BOK_L') || k === 'BOK_L')).toBe(true);

        const bokP = plan.parts.find(p => p.key === 'BOK_P' || p.key.endsWith('BOK_P'))!;
        const bokL = plan.parts.find(p => p.key === 'BOK_L' || p.key.endsWith('BOK_L'))!;
        expect(bokP).toBeDefined();
        expect(bokL).toBeDefined();
        expect(bokP.name).toMatch(/Bok_P/i);
        expect(bokL.name).toMatch(/Bok_L/i);

        // Bok_P przy +X, gĹ‚Ä™bokoĹ›Ä‡ ramienia Ay=600 â†’ dim.y â‰ 600
        expect(bokP.dim.y).toBeCloseTo(600, 0);
        expect(bokP.loc.x).toBeGreaterThan(0);

        // Bok_L przy â’Y, szerokoĹ›Ä‡ ramienia Ax=600 â†’ dim.x â‰ 600
        expect(bokL.dim.x).toBeCloseTo(600, 0);
        expect(bokL.loc.y).toBeLessThan(0);

        // Boki prostopadĹ‚e: jeden stoi w pĹ‚aszczyĹşnie YZ (gruboĹ›Ä‡ w X), drugi w XZ (gruboĹ›Ä‡ w Y)
        expect(bokP.dim.z).toBeCloseTo(18, 0);
        expect(bokL.dim.y).toBeCloseTo(18, 0);
    });

    it('builds single L-shaped wieniec with outline2d notch (not two panels)', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600
        });

        const bottoms = plan.parts.filter(p => p.role === 'BOTTOM_PANEL');
        const tops = plan.parts.filter(p => p.role === 'TOP_PANEL');
        expect(bottoms).toHaveLength(1);
        expect(tops).toHaveLength(1);

        const outline = bottoms[0].customProperties?.outline2d;
        expect(Array.isArray(outline)).toBe(true);
        expect(outline.length).toBe(6); // L = 6 wierzchoĹ‚kĂłw
        expect(bottoms[0].customProperties?.shape).toBe('L_NOTCH');

        // DĂłĹ‚ [90,180,0]: lustro U wzglÄ™dem gĂłry (Ry=180)
        const topOutline = tops[0].customProperties?.outline2d;
        expect(outline[1][0]).toBeLessThan(topOutline[1][0]); // dĂłĹ‚: lustro U, gĂłra: armU
        expect(JSON.stringify(outline)).not.toBe(JSON.stringify(topOutline));

        // Brak BLIND_PANEL (to nie Rogowy1)
        expect(plan.parts.some(p => p.role === 'BLIND_PANEL')).toBe(false);
    });

    it('forces liczba_stref=1', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 3,
            wysokosc_strefy_dolnej_mm: 300,
            wysokosc_strefy_srodkowej_mm: 200,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600
        });
        expect(plan.zones).toHaveLength(1);
    });

    it('niesymetryczne boki: bokLewy â‰  bokPrawy', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 500,
            glebokosc_boku_prawego_mm: 700
        });

        const bokP = plan.parts.find(p => p.key === 'BOK_P' || p.key.endsWith('BOK_P'))!;
        const bokL = plan.parts.find(p => p.key === 'BOK_L' || p.key.endsWith('BOK_L'))!;
        expect(bokP.dim.y).toBeCloseTo(700, 0); // bokPrawy
        expect(bokL.dim.x).toBeCloseTo(500, 0); // bokLewy

        const bottom = plan.parts.find(p => p.role === 'BOTTOM_PANEL')!;
        const outline = bottom.customProperties?.outline2d as number[][];
        // DĂłĹ‚ Ry=180: lustro U â€” wciecieLewe=500 â†’ u = plateW â’ 500
        const plateW = bottom.dim.x;
        const us = outline.map(p => p[0]);
        expect(us).toContain(plateW - 500);
        // wcieciePrawe=700 â†’ plateD - wcieciePrawe w outline gĂłry; po lustrze dĂłĹ‚ ma inne v, ale szerokoĹ›Ä‡ notch = bokLewy
        expect(bokP.dim.y).not.toBeCloseTo(bokL.dim.x, 0);
    });

    it('wycofany armDepth jest odrzucany fail-fast (zamiast zgadywania obu osi)', () => {
        expect(() => planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            armDepth: 550
        } as any)).toThrow(/armDepth/);
    });

    it('dodatni shiftX/shiftY wciÄ…ga plecy do Ĺ›rodka (nie na zewnÄ…trz)', () => {
        const base = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600, glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 3
        });
        const inset = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600, glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 3,
            // Klucze jak z gizmo (panel.name â†’ Plecy_Y / Plecy_X)
            offsets: {
                Plecy_Y_shiftY: 20,
                Plecy_X_shiftX: 20
            }
        });

        const baseY = base.parts.find(p => p.key === 'PLECY_Y' || p.key.endsWith('PLECY_Y'))!;
        const baseX = base.parts.find(p => p.key === 'PLECY_X' || p.key.endsWith('PLECY_X'))!;
        const inY = inset.parts.find(p => p.key === 'PLECY_Y' || p.key.endsWith('PLECY_Y'))!;
        const inX = inset.parts.find(p => p.key === 'PLECY_X' || p.key.endsWith('PLECY_X'))!;

        // PLECY_Y na +Y â†’ do Ĺ›rodka = mniejszy Y
        expect(inY.loc.y).toBeLessThan(baseY.loc.y);
        // PLECY_X na â’X â†’ do Ĺ›rodka = wiÄ™kszy X
        expect(inX.loc.x).toBeGreaterThan(baseX.loc.x);
    });

    it('plecy: 11 mm przy wieĹ„cach/bokach, 0 tylko w naroĹĽniku styku plecĂłw', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600, glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 3
        });

        const plecyY = plan.parts.find(p => p.key === 'PLECY_Y' || p.key.endsWith('PLECY_Y'))!;
        const plecyX = plan.parts.find(p => p.key === 'PLECY_X' || p.key.endsWith('PLECY_X'))!;

        // PLECY_Y: (W-3-18) + 0(naroĹĽnik) + 11(BOK) = 890; H: (720-18-18)+11+11 = 706
        expect(plecyY.dim.x).toBeCloseTo(890, 0);
        expect(plecyY.dim.z).toBeCloseTo(706, 0);

        // PLECY_X: H 706; D: (900-18-3) + 11(Bok_L) + 0(naroĹĽnik) = 890
        expect(plecyX.dim.x).toBeCloseTo(706, 0);
        expect(plecyX.dim.y).toBeCloseTo(890, 0);
    });

    it('listwa naroĹĽna: wys. wnÄ™ki Ă— 100 mm w rogu styku plecĂłw', () => {
        const plan = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: 600, glebokosc_boku_prawego_mm: 600,
            cofniecie_plecow_mm: 3
        });

        const listwa = plan.parts.find(p =>
            p.key === 'LISTWA_NAROZNA' ||
            p.key.endsWith('LISTWA_NAROZNA') ||
            (p.role === 'VERTICAL_DIVIDER' && String((p as any).name || '').toUpperCase().includes('NAROZ'))
        )!;
        expect(listwa).toBeDefined();
        expect(listwa.role).toBe('VERTICAL_DIVIDER');

        // wnÄ™ka H-18-18 = 684; szer. 100; gruboĹ›Ä‡ 18
        expect(listwa.dim.x).toBeCloseTo(684, 0);
        expect(listwa.dim.y).toBeCloseTo(100, 0);
        expect(listwa.dim.z).toBeCloseTo(18, 0);

        // W rogu: przy â’X (za PLECY_X) i przy +Y (pod PLECY_Y)
        expect(listwa.loc.x).toBeLessThan(0);
        expect(listwa.loc.y).toBeGreaterThan(0);
    });
});
