import { describe, it, expect } from 'vitest';
import { planCabinet } from '../smartframe-engine.js';
import { korpusDefaultsForTypeMm } from '../korpus-defaults';
import { resolveCabinetType } from '../smartframe-adapter';

function planSkosnyDach() {
    return planCabinet({
        szerokosc_mm: 1200,
        wysokosc_mm: 2200,
        glebokosc_mm: 700,
        liczba_stref: 1,
        typ_korpusu: 'korpus_skosny_dach',
        wysokosc_przod_mm: 1000,
        wysokosc_tyl_mm: 2200,
        cofniecie_plecow_mm: 3
    });
}

describe('KORPUS_SKOSNY_DACH (pod skoĹ›ny dach)', () => {
    it('1 strefa, 5 czÄ™Ĺ›ci', () => {
        const plan = planSkosnyDach();
        expect(plan.zones).toHaveLength(1);
        expect(plan.parts).toHaveLength(5);
    });

    it('boki L=P â€” ten sam bbox, trapez hF z przodu â†’ hB z tyĹ‚u', () => {
        const plan = planSkosnyDach();
        const left = plan.parts.find((p) => p.role === 'LEFT_SIDE_PANEL')!;
        const right = plan.parts.find((p) => p.role === 'RIGHT_SIDE_PANEL')!;
        expect(left.dim.x).toBeCloseTo(2200, 0);
        expect(right.dim.x).toBeCloseTo(2200, 0);
        expect(left.dim.y).toBeCloseTo(700, 0);
        expect(right.dim.y).toBeCloseTo(700, 0);
        expect((left.customProperties as any)?.shape).toBe('skos_dach_side');
        expect((right.customProperties as any)?.outline2d).toEqual([[0, 0], [700, 0], [700, 2200], [0, 1000]]);
        expect((left.customProperties as any)?.outline2d).toEqual([[0, 0], [700, 0], [700, 1000], [0, 2200]]);
    });

    it('wieniec gĂłrny pochylony do tyĹ‚u (Î˛â’90Â°)', () => {
        const plan = planSkosnyDach();
        const top = plan.parts.find((p) => p.role === 'TOP_PANEL')!;
        const betaDeg = (Math.atan2(2200 - 1000, 700) * 180) / Math.PI;
        expect(top.lcs?.rotation?.[0]).toBeCloseTo(betaDeg - 90, 0);
        expect(top.dim.y).toBeCloseTo(Math.hypot(700, 1200), 0);
        expect(top.dim.x).toBeCloseTo(1164, 0);
    });

    it('prototyp korpus_skosny bez zmian', () => {
        const proto = planCabinet({
            szerokosc_mm: 1200, wysokosc_mm: 2200, glebokosc_mm: 700, liczba_stref: 1,
            typ_korpusu: 'korpus_skosny', wysokosc_przod_mm: 1000, wysokosc_tyl_mm: 2200
        });
        const left = proto.parts.find((p) => p.role === 'LEFT_SIDE_PANEL')!;
        expect((left.customProperties as any)?.shape).toBe('skos_side');
        expect(resolveCabinetType('korpus_skosny_dach')).toBe('korpus_skosny_dach');
        expect(resolveCabinetType('korpus_skosny')).toBe('korpus_skosny');
    });

    it('defaults z JSON', () => {
        const defs = korpusDefaultsForTypeMm('korpus_skosny_dach');
        expect(defs.wysokosc_przod_mm).toBe(1000);
        expect(defs.wysokosc_tyl_mm).toBe(2200);
        expect(defs.glebokosc_mm).toBe(700);
    });
});
