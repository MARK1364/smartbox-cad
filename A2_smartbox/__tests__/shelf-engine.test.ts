import { describe, it, expect } from 'vitest';
import { ShelfEngine } from '../shelf-engine.js';
import { buildShelfPlan } from '../shelf-adapter.js';

describe('ShelfEngine (SmartBox Wieniec V1)', () => {
    it('generates shelf with zero side/front/back offsets by default (fits full width and depth)', () => {
        const engine = new ShelfEngine();
        const plan = engine.plan({
            width: 800,
            depth: 560,
            height: 720,
            thickness: 18
        });

        expect(plan.parts).toHaveLength(1);
        const wieniec = plan.parts[0];

        expect(wieniec.name).toBe('Wieniec');
        expect(wieniec.role).toBe('SHELF_BOARD');

        // Bez luzów bocznych (offsetSide = 0) oraz bez odsunięcia przód/tył (offsetFront = 0, offsetBack = 0)
        expect(wieniec.dim.x).toBe(800);
        expect(wieniec.dim.y).toBe(560);
        expect(wieniec.dim.z).toBe(18);

        // Pozycja wycentrowana w X i Y, domyślny prześwit od dołu = 100 mm (spód na Z=100)
        expect(wieniec.loc.x).toBe(0);
        expect(wieniec.loc.y).toBe(0);
        expect(wieniec.loc.z).toBe(100 + 9); // offsetBottom(100) + thickness(18)/2

        // Oklejenie na froncie (+Y), brak na tyle (-Y)
        expect(wieniec.edge_banding['+Y'].active).toBe(true);
        expect(wieniec.edge_banding['-Y'].active).toBe(false);

        // Zgodność z regułami LCS
        expect(wieniec.lcs.faces.INNER).toBe('FACE_Z_PLUS');
        expect(wieniec.lcs.faces.OUTER).toBe('FACE_Z_MINUS');
    });

    it('buildShelfPlan adapter passes default 100mm offsetBottom', () => {
        const plan = buildShelfPlan({}, { width: 564, depth: 450, height: 600 });
        expect(plan.parts).toHaveLength(1);
        const wieniec = plan.parts[0];

        expect(wieniec.dim.x).toBe(564);
        expect(wieniec.dim.y).toBe(450);
        expect(wieniec.dim.z).toBe(18);
        expect(wieniec.loc.x).toBe(0);
        expect(wieniec.loc.y).toBe(0);
        expect(wieniec.loc.z).toBe(100 + 9);
    });

    it('respects custom offset_bottom if specified', () => {
        const plan = buildShelfPlan({ offset_bottom: 120 }, { width: 600, depth: 500, height: 700 });
        const wieniec = plan.parts[0];

        expect(wieniec.dim.x).toBe(600);
        expect(wieniec.dim.y).toBe(500);
        expect(wieniec.loc.z).toBe(120 + 9);
    });

    it('respects explicit side and front offsets if provided by user', () => {
        const engine = new ShelfEngine();
        const plan = engine.plan({
            width: 600,
            depth: 500,
            offsetSide: 3,
            offsetFront: 5,
            offsetBack: 2
        });

        const wieniec = plan.parts[0];
        expect(wieniec.dim.x).toBe(600 - 2 * 3); // 594
        expect(wieniec.dim.y).toBe(500 - (5 + 2)); // 493
        expect(wieniec.loc.y).toBe((5 - 2) / 2); // 1.5
    });

    it('respects custom offset_top and calculates clearance from top ceiling', () => {
        const engine = new ShelfEngine();
        const plan = engine.plan({
            height: 720,
            thickness: 18,
            referenceFrom: 'top',
            offsetTop: 80
        });

        const wieniec = plan.parts[0];
        // zCenter = height(720) - offsetTop(80) - thickness(18)/2 = 631
        expect(wieniec.loc.z).toBe(631);

        // Górne lico = 631 + 9 = 640. Przestrzeń od góry = 720 - 640 = 80
        const topFaceZ = wieniec.loc.z + wieniec.dim.z / 2;
        expect(720 - topFaceZ).toBe(80);

        // Dolne lico = 631 - 9 = 622. Przestrzeń od dołu = 622
        const bottomFaceZ = wieniec.loc.z - wieniec.dim.z / 2;
        expect(bottomFaceZ).toBe(622);
    });

    it('buildShelfPlan adapter passes offset_top with referenceFrom=top', () => {
        const plan = buildShelfPlan(
            { offset_top: 50, referenceFrom: 'top' },
            { width: 500, depth: 400, height: 800 }
        );
        const wieniec = plan.parts[0];
        // zCenter = 800 - 50 - 9 = 741
        expect(wieniec.loc.z).toBe(741);
        expect(800 - (wieniec.loc.z + 9)).toBe(50);
    });
});
