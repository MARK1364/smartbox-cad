import { describe, it, expect } from 'vitest';
import { planCabinet } from '../smartframe-engine.js';
import { resolveBlindPanelEdgeBanding } from '../smartframe-adapter';

describe('KORPUS_ROGOWY1 blind panel', () => {
    it('plans LEFT blind panel at interior front with expected dim/loc', () => {
        const plan = planCabinet({
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy1',
            szerokosc_blendy_mm: 400,
            strona_blendy: 'LEFT',
            cofniecie_plecow_mm: 3
        });

        expect(plan.zones).toHaveLength(1);
        expect(plan.zones[0].zoneKey).toBe('SEKCJA_B');

        const roles = plan.parts.map(p => p.role);
        expect(roles).toContain('BLIND_PANEL');
        expect(roles).toContain('BACK_PANEL');
        expect(roles).toContain('LEFT_SIDE_PANEL');
        expect(roles).not.toContain('ZONE');

        // Brak sekcji środkowej / górnej w częściach
        const keys = plan.parts.map(p => p.key);
        expect(keys.some(k => k.includes('SEKCJA_M') || k.startsWith('M_'))).toBe(false);

        const blind = plan.parts.find(p => p.role === 'BLIND_PANEL')!;
        expect(blind).toBeDefined();
        expect(blind.dim.x).toBeCloseTo(400, 0);
        expect(blind.dim.y).toBeCloseTo(18, 0); // grubość płyty 18 mm
        // wysokość = światło między wieńcami: 2200 - 18 - 18 = 2164
        expect(blind.dim.z).toBeCloseTo(2164, 0);

        // LEFT: od wewnętrznej ściany lewego boku + blindWidth/2
        // x = -W/2 + leftThick + blindW/2 = -400 + 18 + 200 = -182
        expect(blind.loc.x).toBeCloseTo(-182, 0);
        // przy froncie wewnątrz: -D/2 + th/2 = -300 + 9 = -291
        expect(blind.loc.y).toBeCloseTo(-291, 0);
        // środek światła: 18 + 2164/2 = 1100
        expect(blind.loc.z).toBeCloseTo(1100, 0);
    });

    it('mirrors loc.x for RIGHT blind side', () => {
        const plan = planCabinet({
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy1',
            szerokosc_blendy_mm: 400,
            strona_blendy: 'RIGHT',
            cofniecie_plecow_mm: 3
        });

        const blind = plan.parts.find(p => p.role === 'BLIND_PANEL')!;
        expect(blind).toBeDefined();
        expect(blind.dim.x).toBeCloseTo(400, 0);
        // RIGHT: W/2 - rightThick - blindW/2 = 400 - 18 - 200 = 182
        expect(blind.loc.x).toBeCloseTo(182, 0);
        expect(blind.loc.y).toBeCloseTo(-291, 0);
    });

    it('forces zoneCount=1 even when params ask for 3', () => {
        const plan = planCabinet({
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 3,
            wysokosc_strefy_dolnej_mm: 500,
            wysokosc_strefy_srodkowej_mm: 1200,
            typ_korpusu: 'korpus_rogowy1',
            szerokosc_blendy_mm: 400,
            strona_blendy: 'LEFT'
        });

        expect(plan.zones).toHaveLength(1);
        expect(plan.parts.some(p => p.zoneId === 'SEKCJA_M' || p.key.startsWith('M_'))).toBe(false);
        expect(plan.parts.some(p => p.role === 'BLIND_PANEL')).toBe(true);
    });

    it('korpus3 regression: no BLIND_PANEL', () => {
        const plan = planCabinet({
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1,
            typ_korpusu: 'korpus3',
            cofniecie_plecow_mm: 3
        });

        const roles = plan.parts.map(p => p.role);
        expect(roles).not.toContain('BLIND_PANEL');
        expect(roles).toContain('BACK_PANEL');
        expect(roles).toContain('LEFT_SIDE_PANEL');
        expect(roles).toContain('TOP_PANEL');
    });

    it('ABS edge banding only on opening side (światło)', () => {
        const left = resolveBlindPanelEdgeBanding('LEFT');
        expect(left['+X'].active).toBe(true);
        expect(left['-X'].active).toBe(false);
        expect(left['+Y'].active).toBe(false);
        expect(left['-Y'].active).toBe(false);

        const right = resolveBlindPanelEdgeBanding('RIGHT');
        expect(right['-X'].active).toBe(true);
        expect(right['+X'].active).toBe(false);
        expect(right['+Y'].active).toBe(false);
        expect(right['-Y'].active).toBe(false);
    });

    it('TRAVERSE_H / TRAVERSE_V: dwa wieńce TOP (gizmo pomarańczowy)', () => {
        const base = {
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1 as const,
            typ_korpusu: 'korpus_rogowy1' as const,
            szerokosc_blendy_mm: 400,
            strona_blendy: 'LEFT' as const,
            cofniecie_plecow_mm: 3,
            szerokosc_trawersu_mm: 100,
        };

        const full = planCabinet({ ...base, tryb_wienca_gornego: 'FULL' });
        expect(full.parts.filter(p => p.role === 'TOP_PANEL')).toHaveLength(1);

        const th = planCabinet({ ...base, tryb_wienca_gornego: 'TRAVERSE_H' });
        const thTops = th.parts.filter(p => p.role === 'TOP_PANEL');
        expect(thTops).toHaveLength(2);
        expect(thTops.some(p => p.key.includes('WIENIEC_G_T2'))).toBe(true);

        const tv = planCabinet({ ...base, tryb_wienca_gornego: 'TRAVERSE_V' });
        const tvTops = tv.parts.filter(p => p.role === 'TOP_PANEL');
        expect(tvTops).toHaveLength(2);
        expect(tvTops.some(p => p.key.includes('WIENIEC_G_T2'))).toBe(true);
    });

    it('TRAVERSE_V: blind i plecy skracają się o szerokość trawersu (nie grubość 18)', () => {
        const base = {
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1 as const,
            typ_korpusu: 'korpus_rogowy1' as const,
            szerokosc_blendy_mm: 400,
            strona_blendy: 'LEFT' as const,
            cofniecie_plecow_mm: 3,
            szerokosc_trawersu_mm: 100,
        };

        const full = planCabinet({ ...base, tryb_wienca_gornego: 'FULL' });
        const fullBlind = full.parts.find(p => p.role === 'BLIND_PANEL')!;
        // 2200 - 18 - 18 = 2164
        expect(fullBlind.dim.z).toBeCloseTo(2164, 0);

        const tv = planCabinet({ ...base, tryb_wienca_gornego: 'TRAVERSE_V' });
        const tvBlind = tv.parts.find(p => p.role === 'BLIND_PANEL')!;
        const tvBack = tv.parts.find(p => p.role === 'BACK_PANEL')!;
        // 2200 - 18 - 100 = 2082
        expect(tvBlind.dim.z).toBeCloseTo(2082, 0);
        // środek światła: 18 + 2082/2 = 1059
        expect(tvBlind.loc.z).toBeCloseTo(1059, 0);
        // plecy: innerH + groovey (domyślnie 11+11) = 2082+22 = 2104
        expect(tvBack.dim.z).toBeCloseTo(2104, 0);
    });
});
