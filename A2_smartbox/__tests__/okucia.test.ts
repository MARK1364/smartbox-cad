import { describe, it, expect } from 'vitest';
import {
    DEFAULT_HINGE_ID,
    getDrawerDrill,
    getHardware,
    hingeCorpusHolesMm,
    hingeFrontHolesMm,
    hingeFrontHolesNm,
    listByType
} from '../../Biblioteki/okucia/index.js';
import { DoorsEngine } from '../doors-engine.js';
import { DrawersEngine } from '../drawers-engine.js';

describe('Biblioteka okuć', () => {
    it('resolves Blum hinge from catalog', () => {
        const hw = getHardware(DEFAULT_HINGE_ID);
        expect(hw?.type).toBe('HINGE');
        expect(hw?.art_no).toBe('71B3550');
        expect(hw?.id).toBe(DEFAULT_HINGE_ID);
    });

    it('exposes parametric hinge holes in mm for UI and nm for engines', () => {
        const front = hingeFrontHolesMm(DEFAULT_HINGE_ID);
        const cup = front.find((h) => h.isCup);
        expect(cup?.dia).toBe(35);
        expect(cup?.edgeDist).toBe(21.5);
        const corpus = hingeCorpusHolesMm(DEFAULT_HINGE_ID);
        expect(corpus).toHaveLength(2);
        expect(corpus[0].frontDist).toBe(37);
        expect(Math.abs(corpus[0].zOffset)).toBe(16);

        const cupNm = hingeFrontHolesNm(DEFAULT_HINGE_ID).find((h) => h.isCup);
        expect(cupNm?.dia).toBe(35_000_000);
        expect(cupNm?.edgeDist).toBe(21_500_000);
    });

    it('lists rails from shared szuflady.json (mm konfig → meters)', () => {
        const rails = listByType('RAIL');
        expect(rails.map((r) => r.id).sort()).toEqual([
            'D214', 'KOSZ350', 'M94', 'MR100', 'MR150', 'MR200', 'S114', 'S162', 'T108', 'T158'
        ]);
        expect(Object.keys(getHardware('M94')?.lengths || {})).toEqual(
            expect.arrayContaining(['300', '350', '400', '450', '500'])
        );
        expect(getDrawerDrill().corpus_hole.dia).toBeCloseTo(0.003);
        expect(getDrawerDrill().corpus_hole.depth).toBeCloseTo(0.012);
        expect(getHardware('M94')?.mount?.corpus_height).toBeCloseTo(0.094);
        expect(getHardware('D214')?.mount?.corpus_height).toBeCloseTo(0.214);
        expect(getHardware('M94')?.drill?.dia).toBeCloseTo(0.003);
        expect(getHardware('M94')?.lengths?.['450']?.x_positions).toEqual([0.037, 0.133, 0.261, 0.357]);
        expect(getHardware('M94')?.lengths?.['500']?.x_positions).toEqual([0.037, 0.133, 0.261, 0.453]);
        expect(getHardware('M94')?.front_holes?.z_positions).toEqual([0.02, 0.074]);
        expect((getHardware('M94')?.front_holes as any)?.x_offset).toBeCloseTo(0.031);
    });
});

describe('DoorsEngine reads hinge catalog', () => {
    it('uses cup Ø35 / 21.5 mm from zawiasy.json', () => {
        const plan = new DoorsEngine().plan({
            width: 600,
            height: 720,
            depth: 500,
            door_type: 'LEFT',
            use_hinge_2: false,
            use_hinge_3: false,
            use_hinge_4: false,
            use_hinge_5: false
        });
        const cups = plan.parts[0].features.filter((f: any) => f.params?.isDoorCup);
        expect(cups.length).toBeGreaterThan(0);
        expect(cups[0].params.diameter).toBe(35);
        expect(cups[0].params.u).toBe(21.5);
        expect(cups[0].params.template_id).toBe('BLUM_110_STANDARD');
    });
});

describe('DrawersEngine reads rail catalog', () => {
    it('builds rails from catalog mount + lengths', () => {
        const plan = new DrawersEngine().plan({ count: 1, rail_system: 'M94' });
        const rail = plan.parts.find((p: any) => p.role === 'PROWADNICA');
        expect(rail.customProperties.library_id).toBe('M94');
        expect(rail.dim.z).toBe(35);
        const front = plan.parts.find((p: any) => p.role === 'FRONT');
        const holes = (front.features || []).filter((f: any) => f.params?.isDrawerFrontHole);
        expect(holes.length).toBe(4);
        expect(holes[0].params.diameter).toBe(3);
        expect(holes[0].params.depth).toBe(10);
        expect(holes[0].params.u).toBe(31);
        const vs = holes.map((h: any) => h.params.v).sort((a: number, b: number) => a - b);
        expect(vs).toEqual([35, 35, 89, 89]);
    });
});
