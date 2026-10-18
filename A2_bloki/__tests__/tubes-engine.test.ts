import { describe, it, expect } from 'vitest';
import { buildTubesPlan } from '../08_tubes-adapter.js';
import { assertCanonicalTubesParams } from '../08_tubes-engine.js';
import { isCylindricalPart, isTubeRodPart } from '../../A1_core/cad-node/part-shape.js';

/** Lewy uchwyt: rola HOLDER + ujemne X (nie `name`). */
function findLeftHolder(hardware: any[]) {
    return hardware.find((p) => p.role === 'HOLDER' && p.loc.x < 0);
}

/** Prawy uchwyt: rola HOLDER + dodatnie X (nie `name`). */
function findRightHolder(hardware: any[]) {
    return hardware.find((p) => p.role === 'HOLDER' && p.loc.x > 0);
}

describe('buildTubesPlan (Bloki Drążek V1)', () => {
    it('generates tube rod and holders as hardware with default parameters', () => {
        const plan = buildTubesPlan({}, { width_mm: 600, height_mm: 720, depth_mm: 500 });

        expect(plan.parts).toHaveLength(0); // Brak półki -> brak formatek meblowych w parts
        expect(plan.hardware).toBeDefined();
        expect(plan.hardware).toHaveLength(3); // ROD, HOLDER_LEFT, HOLDER_RIGHT

        const rod = plan.hardware!.find((p: any) => p.role === 'TUBE_ROD');
        expect(rod).toBeDefined();
        expect(rod.hardwareType).toBe('TUBE');
        expect(rod.dim.x).toBe(600 - 2); // 598
        expect(rod.dim.y).toBe(25); // fi25
        expect(rod.dim.z).toBe(25);
        expect(rod.loc.z).toBe(720 - 70); // height - odstep_gora_mm(70) = 650

        const holderL = findLeftHolder(plan.hardware!);
        expect(holderL).toBeDefined();
        expect(holderL.hardwareType).toBe('TUBE');
        expect(holderL.hardwareId).toBe('ROZETA_FI25');
        expect(holderL.dim.x).toBe(5); // thickness 5mm
        expect(holderL.dim.y).toBe(45); // diameter 45mm
        expect(holderL.loc.x).toBe(-600 / 2 + 5 / 2); // -297.5
    });

    it('generates top shelf as panel part when pokaz_polke is true', () => {
        const plan = buildTubesPlan(
            { pokaz_polke: true, przestrzen_nad_polka_mm: 80, odstep_gora_mm: 60 },
            { width_mm: 800, depth_mm: 500, height_mm: 1000 }
        );

        expect(plan.parts).toHaveLength(1); // SHELF
        expect(plan.hardware).toHaveLength(3); // ROD, HOLDER_L, HOLDER_R

        const shelf = plan.parts.find((p: any) => p.role === 'SHELF_PANEL');
        expect(shelf).toBeDefined();
        expect(shelf.nodeType).toBe('PART');
        expect(shelf.dim.x).toBe(800 - 4); // 796
        expect(shelf.dim.y).toBe(500 - 10); // 490
        expect(shelf.dim.z).toBe(18); // 18mm
        expect(shelf.loc.z).toBe(1000 - 80 - 18 / 2); // 911
    });

    it('oznacza bryły walcowe jawną flagą shape, nie heurystyką nazw', () => {
        const plan = buildTubesPlan({}, { width_mm: 600, height_mm: 720, depth_mm: 500 });

        for (const hw of plan.hardware!) {
            const isRod = hw.role === 'TUBE_ROD';
            const isHolder = hw.role === 'HOLDER';
            expect(isCylindricalPart(hw as any)).toBe(isRod || isHolder);
            if (isRod || isHolder) {
                expect(hw.customProperties?.shape).toBe('CYLINDER');
            }
        }

        const rod = plan.hardware!.find((p: any) => p.role === 'TUBE_ROD')!;
        expect(isTubeRodPart(rod as any)).toBe(true);

        const holderL = findLeftHolder(plan.hardware!)!;
        const holderR = findRightHolder(plan.hardware!)!;
        expect(isTubeRodPart(holderL as any)).toBe(false);
        expect(isTubeRodPart(holderR as any)).toBe(false);
        expect(holderL.customProperties?.shape).toBe('CYLINDER');
        expect(holderR.customProperties?.shape).toBe('CYLINDER');
    });

    it('półka nad drążkiem pozostaje płytą (brak flagi CYLINDER)', () => {
        const plan = buildTubesPlan(
            { pokaz_polke: true },
            { width_mm: 600, height_mm: 720, depth_mm: 500 }
        );

        const shelf = plan.parts.find((p: any) => p.role === 'SHELF_PANEL')!;
        expect(isCylindricalPart(shelf)).toBe(false);
        expect(shelf.customProperties?.shape).toBeUndefined();
    });

    it('name jest tylko display — zmiana nazwy nie zmienia klasyfikacji bryły', () => {
        const plan = buildTubesPlan({}, { width_mm: 600, height_mm: 720, depth_mm: 500 });
        const rod = plan.hardware!.find((p: any) => p.role === 'TUBE_ROD')!;
        const renamed = { ...rod, name: 'Polka_Zwykla' };
        expect(isCylindricalPart(renamed as any)).toBe(true);
        expect(isTubeRodPart(renamed as any)).toBe(true);
    });

    it('odrzuca wycofane aliasy (fail-fast)', () => {
        expect(() => assertCanonicalTubesParams({ show_shelf: true })).toThrow(/show_shelf → pokaz_polke/);
        expect(() => assertCanonicalTubesParams({ offset_top: 60 })).toThrow(/offset_top → odstep_gora_mm/);
        expect(() => assertCanonicalTubesParams({ pokaz_polke: true })).not.toThrow();
    });
});
