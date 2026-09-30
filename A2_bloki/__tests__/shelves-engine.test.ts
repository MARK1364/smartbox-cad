import { buildShelvesPlan } from '../module-plans.js';
import { assertCanonicalShelvesParams } from '../shelves-engine.js';
import { describe, it, expect } from 'vitest';

describe('buildShelvesPlan Edge Banding', () => {
    it('generates shelves with default edge banding on +Y', () => {
        const plan = buildShelvesPlan(
            { liczba_polek: 3, grubosc_polki_mm: 18 },
            { width_mm: 800, height_mm: 1000, depth_mm: 500 }
        );

        expect(plan.parts.length).toBe(3);
        for (const part of plan.parts) {
            expect(part.edge_banding).toBeDefined();
            expect(part.edge_banding['+Y']).toBeDefined();
            expect(part.edge_banding['+Y'].active).toBe(true);
            expect(part.edge_banding['+Y'].type_id).toBe('0.008x0.022');

            expect(part.edge_banding['-Y']?.active).toBe(false);
            expect(part.edge_banding['+X']?.active).toBe(false);
            expect(part.edge_banding['-X']?.active).toBe(false);
        }
    });

    it('odrzuca wycofane aliasy (fail-fast)', () => {
        expect(() => assertCanonicalShelvesParams({ shelfCount: 3 })).toThrow(/shelfCount → liczba_polek/);
        expect(() => assertCanonicalShelvesParams({ thickness: 18 })).toThrow(/thickness → grubosc_polki_mm/);
        expect(() => assertCanonicalShelvesParams({ liczba_polek: 3 })).not.toThrow();
    });
});
