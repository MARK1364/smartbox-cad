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
        expect(() => assertCanonicalShelvesParams({ shelfPositions: [100, 200] })).toThrow(/shelfPositions → pozycje_polek_z_mm/);
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
        expect(plan.hardware![0].params?.shelfName).toBe('Polka_1');
        expect(plan.hardware![0].params?.diameter_mm).toBe(5);
    });

    it('uwzględnia zadaną średnicę podpórki srednica_podporki_mm w planie i otworach', () => {
        const plan = buildShelvesPlan(
            { liczba_polek: 1, grubosc_polki_mm: 18, srednica_podporki_mm: 3 },
            { width_mm: 600, height_mm: 700, depth_mm: 400 }
        );

        expect(plan.hardware).toHaveLength(4);
        expect(plan.hardware![0].params?.diameter_mm).toBe(3);
        const shelfPart = plan.parts[0];
        const holes = shelfPart.features || [];
        expect(holes.length).toBeGreaterThan(0);
        expect(holes[0].params?.diameter_mm).toBe(3);
    });

    it('uwzględnia indywidualne wysokości półek pozycje_polek_z_mm', () => {
        const plan = buildShelvesPlan(
            {
                liczba_polek: 2,
                grubosc_polki_mm: 18,
                srednica_podporki_mm: 5,
                pozycje_polek_z_mm: [250, 595] // dół półki 1 na 250mm, półki 2 na 595mm (np. 575+20)
            },
            { width_mm: 600, height_mm: 1000, depth_mm: 500 }
        );

        expect(plan.parts).toHaveLength(2);
        // Środek półki 1: 250 + 18/2 = 259 mm
        expect(plan.parts[0].loc.z).toBe(259);
        // Środek półki 2: 595 + 18/2 = 604 mm
        expect(plan.parts[1].loc.z).toBe(604);

        // Podpórki półki 1: pod spodem na Z = 250 - 2.5 = 247.5 mm
        const shelf1Pins = plan.hardware!.filter(h => h.params?.shelfIndex === 1);
        expect(shelf1Pins).toHaveLength(4);
        expect(shelf1Pins[0].loc.z).toBe(247.5);

        // Podpórki półki 2: pod spodem na Z = 595 - 2.5 = 592.5 mm
        const shelf2Pins = plan.hardware!.filter(h => h.params?.shelfIndex === 2);
        expect(shelf2Pins).toHaveLength(4);
        expect(shelf2Pins[0].loc.z).toBe(592.5);
    });
});
