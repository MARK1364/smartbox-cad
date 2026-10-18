import { describe, it, expect } from 'vitest';
import { buildShelfPlan } from '../03_shelf-adapter.js';
import { assertCanonicalShelfParams } from '../03_shelf-engine.js';

describe('buildShelfPlan (Bloki Wieniec V1)', () => {
    it('generates shelf with zero side/front/back offsets by default (fits full width and depth)', () => {
        const plan = buildShelfPlan(
            { grubosc_wienca_mm: 18 },
            { width_mm: 800, height_mm: 720, depth_mm: 560 }
        );

        expect(plan.parts).toHaveLength(1);
        const wieniec = plan.parts[0];

        expect(wieniec.name).toBe('Wieniec');
        expect(wieniec.role).toBe('SHELF_BOARD');

        // Bez luzów bocznych (luz_boczny_mm = 0) oraz bez odsunięcia przód/tył
        expect(wieniec.dim.x).toBe(800);
        expect(wieniec.dim.y).toBe(560);
        expect(wieniec.dim.z).toBe(18);

        // Pozycja wycentrowana w X i Y, domyślny prześwit od dołu = 100 mm (spód na Z=100)
        expect(wieniec.loc.x).toBe(0);
        expect(wieniec.loc.y).toBe(0);
        expect(wieniec.loc.z).toBe(100 + 9); // odstep_dol_mm(100) + grubosc(18)/2

        // Oklejenie na froncie (+Y), brak na tyle (-Y)
        expect(wieniec.edge_banding['+Y'].active).toBe(true);
        expect(wieniec.edge_banding['-Y'].active).toBe(false);

        // Zgodność z regułami LCS
        expect(wieniec.lcs.faces.INNER).toBe('FACE_Z_PLUS');
        expect(wieniec.lcs.faces.OUTER).toBe('FACE_Z_MINUS');
    });

    it('buildShelfPlan adapter passes default 100mm odstep_dol_mm', () => {
        const plan = buildShelfPlan({}, { width_mm: 564, depth_mm: 450, height_mm: 600  });
        expect(plan.parts).toHaveLength(1);
        const wieniec = plan.parts[0];

        expect(wieniec.dim.x).toBe(564);
        expect(wieniec.dim.y).toBe(450);
        expect(wieniec.dim.z).toBe(18);
        expect(wieniec.loc.x).toBe(0);
        expect(wieniec.loc.y).toBe(0);
        expect(wieniec.loc.z).toBe(100 + 9);
    });

    it('respects custom odstep_dol_mm if specified', () => {
        const plan = buildShelfPlan(
            { odstep_dol_mm: 120 },
            { width_mm: 600, depth_mm: 500, height_mm: 700  }
        );
        const wieniec = plan.parts[0];

        expect(wieniec.dim.x).toBe(600);
        expect(wieniec.dim.y).toBe(500);
        expect(wieniec.loc.z).toBe(120 + 9);
    });

    it('respects explicit side and front offsets if provided by user', () => {
        const plan = buildShelfPlan(
            { luz_boczny_mm: 3, odsuniecie_przod_mm: 5, odsuniecie_tyl_mm: 2 },
            { width_mm: 600, height_mm: 720, depth_mm: 500 }
        );

        const wieniec = plan.parts[0];
        expect(wieniec.dim.x).toBe(600 - 2 * 3); // 594
        expect(wieniec.dim.y).toBe(500 - (5 + 2)); // 493
        expect(wieniec.loc.y).toBe((5 - 2) / 2); // 1.5
    });

    it('respects custom odstep_gora_mm and calculates clearance from top ceiling', () => {
        const plan = buildShelfPlan(
            { grubosc_wienca_mm: 18, baza_odniesienia: 'top', odstep_gora_mm: 80 },
            { width_mm: 600, height_mm: 720, depth_mm: 500 }
        );

        const wieniec = plan.parts[0];
        // zCenter = height(720) - odstep_gora_mm(80) - grubosc(18)/2 = 631
        expect(wieniec.loc.z).toBe(631);

        // Górne lico = 631 + 9 = 640. Przestrzeń od góry = 720 - 640 = 80
        const topFaceZ = wieniec.loc.z + wieniec.dim.z / 2;
        expect(720 - topFaceZ).toBe(80);

        // Dolne lico = 631 - 9 = 622. Przestrzeń od dołu = 622
        const bottomFaceZ = wieniec.loc.z - wieniec.dim.z / 2;
        expect(bottomFaceZ).toBe(622);
    });

    it('buildShelfPlan adapter passes odstep_gora_mm with baza_odniesienia=top', () => {
        const plan = buildShelfPlan(
            { odstep_gora_mm: 50, baza_odniesienia: 'top' },
            { width_mm: 500, depth_mm: 400, height_mm: 800  }
        );
        const wieniec = plan.parts[0];
        // zCenter = 800 - 50 - 9 = 741
        expect(wieniec.loc.z).toBe(741);
        expect(800 - (wieniec.loc.z + 9)).toBe(50);
    });

    it('odrzuca wycofane aliasy (fail-fast)', () => {
        expect(() => assertCanonicalShelfParams({ offset_bottom: 100 })).toThrow(/offset_bottom → odstep_dol_mm/);
        expect(() => assertCanonicalShelfParams({ thickness: 18 })).toThrow(/thickness → grubosc_wienca_mm/);
        expect(() => assertCanonicalShelfParams({ referenceFrom: 'top' })).toThrow(/referenceFrom → baza_odniesienia/);
        expect(() => assertCanonicalShelfParams({ odstep_dol_mm: 100 })).not.toThrow();
    });
});
