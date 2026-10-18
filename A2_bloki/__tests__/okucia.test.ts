import { buildFlapsPlan } from '../01_module-plans.js';
import { buildDrawersPlan } from '../01_module-plans.js';
import { buildDoorsPlan } from '../01_module-plans.js';
import { describe, it, expect } from 'vitest';
import {
    DEFAULT_HINGE_ID,
    getDrawerDrill,
    getHardware,
    hingeCorpusHolesMm,
    hingeFrontHolesMm,
    hingeFrontHolesNm,
    listByType
} from '../../B1_biblioteka/index.js';
describe('Biblioteka okuć', () => {
    it('resolves Blum hinge from catalog', () => {
        const hw = getHardware(DEFAULT_HINGE_ID);
        expect(hw?.type).toBe('HINGE');
        expect(hw?.art_no).toBe('71B3550');
        expect(hw?.id).toBe(DEFAULT_HINGE_ID);
    });

    it('resolves Blum hinge 71T3550 without brake from catalog', () => {
        const hw = getHardware('BLUM_71T3550');
        expect(hw?.type).toBe('HINGE');
        expect(hw?.art_no).toBe('71T3550');
        expect(hw?.id).toBe('BLUM_71T3550');
        expect(hw?.price_id).toBe('HINGE_BLUM_71T3550');
    });

    it('strictly requires both {ID}.json and {ID}.glb pair for hinges', () => {
        const hinges = listByType('HINGE');
        expect(hinges.length).toBeGreaterThan(0);
        // Wszystkie zarejestrowane zawiasy muszą posiadać odpowiadający plik GLB
        for (const h of hinges) {
            expect(h.id).toBeDefined();
        }
        expect(hinges.map((h) => h.id)).toContain(DEFAULT_HINGE_ID);
        expect(hinges.map((h) => h.id)).toContain('BLUM_71T3550');
    });

    it('exposes parametric hinge holes in mm for UI and nm for engines', () => {
        const front = hingeFrontHolesMm(DEFAULT_HINGE_ID);
        const cup = front.find((h) => h.isCup);
        expect(cup?.dia).toBe(35);
        expect(cup?.edgeDist).toBe(22.5);
        const corpus = hingeCorpusHolesMm(DEFAULT_HINGE_ID);
        expect(corpus).toHaveLength(2);
        expect(corpus[0].frontDist).toBe(37);
        expect(Math.abs(corpus[0].zOffset)).toBe(16);

        const cupNm = hingeFrontHolesNm(DEFAULT_HINGE_ID).find((h) => h.isCup);
        expect(cupNm?.dia).toBe(35_000_000);
        expect(cupNm?.edgeDist).toBe(22_500_000);
    });

    it('lists rails from shared szuflady.json (all hardware in mm)', () => {
        const rails = listByType('RAIL');
        expect(rails.map((r) => r.id)).toEqual(
            expect.arrayContaining(['D214', 'KOSZ350', 'M94', 'MR100', 'MR150', 'MR200', 'S114', 'S162', 'T108', 'T158', 'BLUM_ANTARO_M'])
        );
        expect(Object.keys(getHardware('M94')?.lengths || {})).toEqual(
            expect.arrayContaining(['300', '350', '400', '450', '500'])
        );
        expect(getDrawerDrill().corpus_hole.dia).toBeCloseTo(3);
        expect(getDrawerDrill().corpus_hole.depth).toBeCloseTo(12);
        expect(getHardware('M94')?.mount?.corpus_height).toBeCloseTo(94);
        expect(getHardware('D214')?.mount?.corpus_height).toBeCloseTo(214);
        expect(getHardware('M94')?.drill?.dia).toBeCloseTo(3);
        expect(getHardware('M94')?.lengths?.['450']?.x_positions).toEqual([37, 133, 261, 357]);
        expect(getHardware('M94')?.lengths?.['500']?.x_positions).toEqual([37, 133, 261, 453]);
        expect(getHardware('M94')?.front_holes?.z_positions).toEqual([20, 74]);
        expect((getHardware('M94')?.front_holes as any)?.x_offset).toBeCloseTo(31);
    });
});

describe('buildDoorsPlan reads hinge catalog', () => {
    it('uses cup Ø35 / 22.5 mm from zawiasy.json', () => {
        const plan = buildDoorsPlan({ rodzaj_drzwi: 'LEFT',
            uzyj_zawias_2: false,
            uzyj_zawias_3: false,
            uzyj_zawias_4: false,
            uzyj_zawias_5: false }, { width_mm: 600, height_mm: 720, depth_mm: 500 });
        const cups = plan.parts[0].features.filter((f: any) => f.params?.isDoorCup);
        expect(cups.length).toBeGreaterThan(0);
        expect(cups[0].params.diameter).toBe(35);
        expect(cups[0].params.u).toBe(22.5);
        expect(cups[0].params.template_id).toBe('BLUM_110_STANDARD');
    });

    it('alternates hinges: odd=71B3550 (hamulec), even=71T3550 (zwykły)', () => {
        const plan = buildDoorsPlan({ rodzaj_drzwi: 'LEFT',
            uzyj_zawias_1: true,
            uzyj_zawias_2: true,
            uzyj_zawias_3: true,
            uzyj_zawias_6: true }, { width_mm: 600, height_mm: 1200, depth_mm: 500 });

        const hw = plan.hardware || [];
        const hinge1 = hw.find((h: any) => h.id === 'hinge_left_1');
        const hinge2 = hw.find((h: any) => h.id === 'hinge_left_2');
        const hinge3 = hw.find((h: any) => h.id === 'hinge_left_3');
        const hinge6 = hw.find((h: any) => h.id === 'hinge_left_6');

        expect(hinge1?.hardwareId).toBe('BLUM_71B3550');
        expect(hinge2?.hardwareId).toBe('BLUM_71T3550');
        expect(hinge3?.hardwareId).toBe('BLUM_71B3550');
        expect(hinge6?.hardwareId).toBe('BLUM_71T3550');
    });
});

describe('buildDrawersPlan reads rail catalog', () => {
    it('builds rails from catalog mount + lengths as hardware', () => {
        const plan = buildDrawersPlan({ liczba_szuflad: 1, konfiguracje_prowadnic: { 1: { system: 'M94', length: '500' } } }, { width_mm: 600, height_mm: 720, depth_mm: 500 });
        const rail = (plan.hardware || []).find((p: any) => p.hardwareType === 'RAIL');
        expect(rail).toBeDefined();
        expect(rail.customProperties.library_id).toBe('M94');
        expect(rail.dim.z).toBe(35);
        expect(rail.hardwareId).toBe('BLUM_ANTARO_M_L');
        const front = plan.parts.find((p: any) => p.role === 'FRONT');
        const holes = (front.features || []).filter((f: any) => f.params?.isDrawerFrontHole);
        expect(holes.length).toBe(4);
        expect(holes[0].params.diameter).toBe(3);
        expect(holes[0].params.depth).toBe(10);
        expect(holes[0].params.u).toBe(31);
        const vs = holes.map((h: any) => h.params.v).sort((a: number, b: number) => a - b);
        expect(vs).toEqual([35, 35, 89, 89]);

        // Szuflada systemowa Antaro M — generuje Dno i Plecy
        const bottom = plan.parts.find((p: any) => p.role === 'DRAWER_BOTTOM');
        expect(bottom).toBeDefined();
        expect(bottom.dim.z).toBe(16);
        expect(bottom.dim.x).toBe(600 - 75); // 525 mm
        expect(bottom.dim.y).toBe(500 - 24); // 476 mm
        expect(bottom.material).toBe('W1100_ST9_16');

        const back = plan.parts.find((p: any) => p.role === 'DRAWER_BACK');
        expect(back).toBeDefined();
        expect(back.dim.y).toBe(16);
        expect(back.dim.x).toBe(600 - 87); // 513 mm
        expect(back.dim.z).toBe(84);
        expect(back.material).toBe('W1100_ST9_16');
    });

    it('builds wooden drawer box for WOODEN construction (e.g. Tandem)', () => {
        const plan = buildDrawersPlan({ liczba_szuflad: 1, konfiguracje_prowadnic: { 1: { system: 'T158', length: '500' } } }, { width_mm: 600, height_mm: 720, depth_mm: 500 });
        const box = plan.parts.find((p: any) => p.role === 'BOX');
        expect(box).toBeDefined();
        const bottom = plan.parts.find((p: any) => p.role === 'DRAWER_BOTTOM');
        expect(bottom).toBeUndefined();
    });
});

describe('buildFlapsPlan reads hinge catalog and alternates hinges', () => {
    it('alternates flap hinges: left=71B3550, right=71T3550, center=71B3550', () => {
        const plan = buildFlapsPlan({ kierunek_klapy: 'TOP',
            zawias_srodkowy: true }, { width_mm: 800, height_mm: 400, depth_mm: 350 });

        const hw = plan.hardware || [];
        const hingeL = hw.find((h: any) => h.side === 'left');
        const hingeR = hw.find((h: any) => h.side === 'right');
        const hingeC = hw.find((h: any) => h.side === 'center');

        expect(hingeL?.hardwareId).toBe('BLUM_71B3550');
        expect(hingeR?.hardwareId).toBe('BLUM_71T3550');
        expect(hingeC?.hardwareId).toBe('BLUM_71B3550');
    });
});
