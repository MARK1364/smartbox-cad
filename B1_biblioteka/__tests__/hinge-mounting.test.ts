import { describe, it, expect } from 'vitest';
import { resolveHingeMounting, getHardware } from '../index.js';

describe('Hinge Mounting Plate Calculation (Blum SSOT)', () => {
    it('dobiera prowadnik H=0 dla standardowego nałożenia frontu 16 mm (bok 18 mm, szczelina 2 mm)', () => {
        const result = resolveHingeMounting({
            hingeId: 'BLUM_71B3550',
            overlay_mm: 16,
            cup_k_mm: 4.5,
        });

        // Wzór Bluma: H = K + A - FA = 4.5 + 11.5 - 16 = 0 mm
        expect(result.plate_height_mm).toBe(0);
        expect(result.cup_k_mm).toBe(4.5);
        expect(result.cup_center_from_edge_mm).toBe(22);
        expect(result.plate_part_name).toBe('prowadnik_krzyzowy_h0');
        expect(result.adjustment_screw_mm).toBe(0);
    });

    it('dobiera wyższy prowadnik H=3 gdy nałożenie frontu wynosi 13 mm', () => {
        const result = resolveHingeMounting({
            hingeId: 'BLUM_71B3550',
            overlay_mm: 13,
            cup_k_mm: 4.5,
        });

        // Wzór Bluma: H = K + A - FA = 4.5 + 11.5 - 13 = 3 mm
        expect(result.plate_height_mm).toBe(3);
        expect(result.plate_part_name).toBe('prowadnik_krzyzowy_h3');
        expect(result.adjustment_screw_mm).toBe(0);
    });

    it('szanuje wymuszony prowadnik (forced_plate_h = 3) dla zawiasów specjalnych', () => {
        const result = resolveHingeMounting({
            hingeId: 'BLUM_71B3550',
            forced_plate_h: 3,
            overlay_mm: 16,
        });

        expect(result.plate_height_mm).toBe(3);
        expect(result.plate_part_name).toBe('prowadnik_krzyzowy_h3');
    });

    it('akceptuje zawiasy Blum z pliku współdzielonego blum zawiasy.glb bez ostrzeżenia o braku pliku', () => {
        const standard = getHardware('BLUM_71B3550');
        expect(standard).toBeDefined();
        expect(standard?.brand).toBe('Blum');

        const rownolegly = getHardware('BLUM_79B9550');
        expect(rownolegly).toBeDefined();
        expect(rownolegly?.art_no).toBe('47561700');
        expect((rownolegly?.visual as any)?.glb_node).toBe('rownolegly_nakladany_47561700');
        const mount = resolveHingeMounting({ hingeId: 'BLUM_79B9550', overlay_mm: 16 });
        expect(mount.plate_height_mm).toBe(3);
        expect(mount.plate_part_name).toBe('prowadnik_krzyzowy_h3');
    });
});
