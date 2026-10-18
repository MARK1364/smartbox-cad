import { buildShelvesPlan } from '../01_module-plans.js';
import { assertCanonicalShelvesParams } from '../04_shelves-engine.js';
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

    it('SYSTEM_32 / ROW nie tworzy fałszywej formatki System_32 wypełniającej wnękę', () => {
        for (const wzor of ['SYSTEM_32', 'ROW'] as const) {
            const plan = buildShelvesPlan(
                {
                    liczba_polek: 2,
                    grubosc_polki_mm: 18,
                    wzor_nawiercen: wzor,
                    rozstaw_system32_mm: 32,
                    start_system32_z_mm: 100,
                    liczba_otworow_system32: 5
                },
                { width_mm: 800, height_mm: 1000, depth_mm: 500 }
            );

            expect(plan.parts.every(p => p.name !== 'System_32')).toBe(true);
            expect(plan.parts.every(p => p.role !== 'OTHER')).toBe(true);
            expect(plan.parts).toHaveLength(2);
            for (const part of plan.parts) {
                expect(part.role).toBe('SHELF_PANEL');
                // Półka ma grubość, nie wysokość wnęki
                expect(part.dim.z).toBe(18);
                expect(part.dim.z).toBeLessThan(100);
            }
        }
    });

    it('generuje 4 podpórki na każdą półkę z B1_biblioteka (hardware)', () => {
        const plan = buildShelvesPlan(
            { liczba_polek: 2, grubosc_polki_mm: 18 },
            { width_mm: 800, height_mm: 1000, depth_mm: 500 }
        );

        expect(plan.hardware).toBeDefined();
        expect(plan.hardware).toHaveLength(8); // 2 półki * 4 podpórki
        expect(plan.hardware![0].hardwareType).toBe('SHELF_PIN');
        expect(plan.hardware![0].hardwareId).toBe('PODPORKA_FI5');
    });
});
