import { describe, it, expect } from 'vitest';
import {
    normalizeDrawerSideProfile,
    buildDrawerSideLoops2D,
    loop2DToSvgPath,
    createParametricDrawerSideMesh
} from '../szuflady/parametric-drawer-side.js';
import { buildDrawersPlan } from '../../A2_bloki/01_module-plans.js';

describe('Parametryczny silnik 2D/3D boczka szuflady (3 pętle: Boczek, Mocowanie, Prowadnica N)', () => {
    it('generuje 3 pętle 2D identyczne z silnikiem referencyjnym (domyślne b_h=178, b_y=194, b_ph=148, p_th=16)', () => {
        const res = buildDrawerSideLoops2D();

        expect(res.params.b_h).toBe(178);
        expect(res.params.b_y).toBe(194);
        expect(res.params.b_ph).toBe(148);
        expect(res.params.p_th).toBe(16);
        expect(res.params.b_bw).toBeCloseTo(3.5);
        expect(res.params.bottomY).toBe(16);
        expect(res.params.shelfY).toBe(46);
        expect(res.params.railTopY).toBe(30);
        expect(res.params.railBottomY).toBe(7);

        // ① Pętla Boczka (6 punktów)
        expect(res.boczek).toEqual([
            [7, 194],
            [7, 16],
            [10.5, 16],
            [10.5, 46],
            [19, 46],
            [19, 194],
        ]);

        // ② Pętla Mocowania (8 punktów, baza 0,0)
        expect(res.mocowanie).toEqual([
            [0, 0],
            [0, 60],
            [2, 60],
            [2, 2],
            [25, 2],
            [25, 21],
            [45, 21],
            [45, 0],
        ]);

        // ③ Pętla Prowadnicy N (8 punktów, góra=30, dół=7)
        expect(res.prowadnica).toEqual([
            [14, 7],
            [14, 30],
            [56, 30],
            [56, 7],
            [46, 7],
            [46, 27],
            [24, 27],
            [24, 7],
        ]);

        expect(loop2DToSvgPath(res.boczek)).toBe(
            'M 7.00,194.00 L 7.00,16.00 L 10.50,16.00 L 10.50,46.00 L 19.00,46.00 L 19.00,194.00 Z'
        );
    });

    it('odchyla wewnętrzną ściankę boczka pod skosem gdy wciecie_dna przekracza (b_tw - b_bw)', () => {
        const res = buildDrawerSideLoops2D({
            b_x: 7,
            b_tw: 12,
            b_bw: 3.5,
            wciecie_dna: 15, // 7 + 3.5 + 15 = 25.5 > topInnerX (19)
        });
        expect(res.boczek[4]).toEqual([25.5, 46]);
        expect(res.boczek[5]).toEqual([19, 194]);
    });

    it('integruje parametry profilu z buildDrawersPlan oraz pozycjonuje Dno i Plecy na rzędnych railTopY i shelfY', () => {
        const plan = buildDrawersPlan(
            { liczba_szuflad: 1, konfiguracje_prowadnic: { 1: { system: 'S131', length: '450' } } },
            { width_mm: 600, height_mm: 720, depth_mm: 500 }
        );

        const railL = (plan.hardware || []).find((h: any) => h.id === 'drawer_1_rail_L');
        const railR = (plan.hardware || []).find((h: any) => h.id === 'drawer_1_rail_R');
        expect(railL).toBeDefined();
        expect(railR).toBeDefined();
        expect(railL?.loc.x).toBe(-300);
        expect(railR?.loc.x).toBe(300);
        expect(railL?.params?.profile?.b_h).toBe(131);
        expect(railL?.params?.profile?.railTopY).toBe(30);
        expect(railL?.params?.profile?.shelfY).toBe(46);

        const bottom = plan.parts.find((p: any) => p.role === 'DRAWER_BOTTOM');
        const back = plan.parts.find((p: any) => p.role === 'DRAWER_BACK');
        expect(bottom?.loc.z).toBe(46 + 16 / 2); // shelfY + thickness/2 (wchodzi we wnękę na płytę dna boczka)
        expect(back?.loc.z).toBe(46 + (back!.dim.z / 2)); // shelfY + backH/2
    });

    it('poprawnie wczytuje warianty z arkusza CSV (Sevroll S90/S131/S178/S214, Blum Antaro M94/D214, Merivo MR100/MR200)', () => {
        const sevrollCases = [
            { id: 'S90', b_h: 90, b_ph: 60, b_y: 106, shelfY: 46, railTopY: 30 },
            { id: 'S131', b_h: 131, b_ph: 101, b_y: 147, shelfY: 46, railTopY: 30 },
            { id: 'S178', b_h: 178, b_ph: 148, b_y: 194, shelfY: 46, railTopY: 30 },
            { id: 'S214', b_h: 214, b_ph: 183, b_y: 229, shelfY: 46, railTopY: 30 }
        ];

        for (const c of sevrollCases) {
            const plan = buildDrawersPlan(
                { liczba_szuflad: 1, konfiguracje_prowadnic: { 1: { system: c.id, length: '500' } } },
                { width_mm: 600, height_mm: 720, depth_mm: 550 }
            );
            const railL = (plan.hardware || []).find((h: any) => h.id === 'drawer_1_rail_L');
            expect(railL?.params?.profile?.b_h).toBe(c.b_h);
            expect(railL?.params?.profile?.b_ph).toBe(c.b_ph);
            expect(railL?.params?.profile?.b_y).toBe(c.b_y);
            expect(railL?.params?.profile?.shelfY).toBe(c.shelfY);
            expect(railL?.params?.profile?.railTopY).toBe(c.railTopY);

            const bottom = plan.parts.find((p: any) => p.role === 'DRAWER_BOTTOM');
            const back = plan.parts.find((p: any) => p.role === 'DRAWER_BACK');
            // Sevroll: dno Lw-21 (600-21 = 579), L-20 (500-20 = 480); plecy Lw-42 (600-42 = 558), wys = b_ph
            expect(bottom?.dim.x).toBe(579);
            expect(bottom?.dim.y).toBe(480);
            expect(back?.dim.x).toBe(558);
            expect(back?.dim.z).toBe(c.b_ph);
        }

        // Merivo MR100: dno Lw-51 (549), L-26 (474), plecy Lw-51 (549), wys = 83
        const merivoPlan = buildDrawersPlan(
            { liczba_szuflad: 1, konfiguracje_prowadnic: { 1: { system: 'MR100', length: '500' } } },
            { width_mm: 600, height_mm: 720, depth_mm: 550 }
        );
        const mrBottom = merivoPlan.parts.find((p: any) => p.role === 'DRAWER_BOTTOM');
        const mrBack = merivoPlan.parts.find((p: any) => p.role === 'DRAWER_BACK');
        expect(mrBottom?.dim.x).toBe(549);
        expect(mrBottom?.dim.y).toBe(474);
        expect(mrBack?.dim.x).toBe(549);
        expect(mrBack?.dim.z).toBe(83);

        // Antaro M94: dno Lw-75 (525), L-24 (476), plecy Lw-87 (513), wys = 84
        const antaroPlan = buildDrawersPlan(
            { liczba_szuflad: 1, konfiguracje_prowadnic: { 1: { system: 'M94', length: '500' } } },
            { width_mm: 600, height_mm: 720, depth_mm: 550 }
        );
        const antaroBottom = antaroPlan.parts.find((p: any) => p.role === 'DRAWER_BOTTOM');
        const antaroBack = antaroPlan.parts.find((p: any) => p.role === 'DRAWER_BACK');
        expect(antaroBottom?.dim.x).toBe(525);
        expect(antaroBottom?.dim.y).toBe(476);
        expect(antaroBack?.dim.x).toBe(513);
        expect(antaroBack?.dim.z).toBe(84);
        const antaroRail = (antaroPlan.hardware || []).find((h: any) => h.id === 'drawer_1_rail_L');
        expect(antaroRail?.params?.profile?.b_h).toBe(86.4);
        expect(antaroRail?.params?.profile?.b_ph).toBe(86.5);
        expect(antaroRail?.params?.profile?.b_y).toBe(95.5);

        const antaroLoops = buildDrawerSideLoops2D(antaroRail?.params?.profile);
        // Rzeczywista pętla boczka Antaro z DXF (BOCZKI M PRAWE.DXF): 121 punktów
        // z wysokością całkowitą równą dokładnie 95.5 mm zgodnie z JSON
        expect(antaroLoops.boczek.length).toBe(121);
        const maxY = Math.max(...antaroLoops.boczek.map(p => p[1]));
        expect(maxY).toBe(95.5);
        // Spód oparcia pod dno (X=50.35, Y=9.1)
        const bottomFlangePoint = antaroLoops.boczek.find(p => p[0] === 50.35 && p[1] === 9.1);
        expect(bottomFlangePoint).toBeDefined();
    });

    it('różnicuje długości wyciągnięć boczku, prowadnicy i mocowania ze sterowaniem z JSON', () => {
        const cases = [
            { len: '270', expectedBoczek: 270, expectedMocowanie: 260, expectedProwadnica: 278 },
            { len: '300', expectedBoczek: 300, expectedMocowanie: 260, expectedProwadnica: 308 },
            { len: '350', expectedBoczek: 350, expectedMocowanie: 260, expectedProwadnica: 358 },
            { len: '400', expectedBoczek: 400, expectedMocowanie: 290, expectedProwadnica: 408 },
            { len: '450', expectedBoczek: 450, expectedMocowanie: 290, expectedProwadnica: 458 },
            { len: '500', expectedBoczek: 500, expectedMocowanie: 320, expectedProwadnica: 508 },
            { len: '550', expectedBoczek: 550, expectedMocowanie: 320, expectedProwadnica: 558 },
        ];

        for (const c of cases) {
            const plan = buildDrawersPlan(
                { liczba_szuflad: 1, konfiguracje_prowadnic: { 1: { system: 'S178', length: c.len } } },
                { width_mm: 600, height_mm: 720, depth_mm: 600 }
            );
            const railL = (plan.hardware || []).find((h: any) => h.id === 'drawer_1_rail_L');
            expect(railL?.params?.profile?.boczek_len).toBe(c.expectedBoczek);
            expect(railL?.params?.profile?.mocowanie_len).toBe(c.expectedMocowanie);
            expect(railL?.params?.profile?.prowadnica_len).toBe(c.expectedProwadnica);
            expect(railL?.params?.profile?.m_h).toBe(60);
        }
    });
});

