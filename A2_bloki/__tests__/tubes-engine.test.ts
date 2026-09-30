import { describe, it, expect } from 'vitest';
import { buildTubesPlan } from '../tubes-adapter.js';
import { assertCanonicalTubesParams } from '../tubes-engine.js';
import { isCylindricalPart, isTubeRodPart } from '../../A1_core/cad-node/part-shape.js';

/** Lewy uchwyt: rola HOLDER + ujemne X (nie `name`). */
function findLeftHolder(parts: any[]) {
    return parts.find((p) => p.role === 'HOLDER' && p.loc.x < 0);
}

/** Prawy uchwyt: rola HOLDER + dodatnie X (nie `name`). */
function findRightHolder(parts: any[]) {
    return parts.find((p) => p.role === 'HOLDER' && p.loc.x > 0);
}

describe('buildTubesPlan (Bloki Drążek V1)', () => {
    it('generates tube rod and holders with default parameters', () => {
        const plan = buildTubesPlan({}, { width_mm: 600, height_mm: 720, depth_mm: 500 });

        expect(plan.parts).toHaveLength(3); // ROD, HOLDER_LEFT, HOLDER_RIGHT

        const rod = plan.parts.find((p: any) => p.role === 'TUBE_ROD');
        expect(rod).toBeDefined();
        expect(rod.dim.x).toBe(600 - 2); // 598
        expect(rod.dim.y).toBe(25); // fi25
        expect(rod.dim.z).toBe(25);
        expect(rod.loc.z).toBe(720 - 70); // height - odstep_gora_mm(70) = 650

        const holderL = findLeftHolder(plan.parts);
        expect(holderL).toBeDefined();
        expect(holderL.dim.x).toBe(5); // thickness 5mm
        expect(holderL.dim.y).toBe(45); // diameter 45mm
        expect(holderL.loc.x).toBe(-600 / 2 + 5 / 2); // -297.5
    });

    it('generates top shelf when pokaz_polke is true', () => {
        const plan = buildTubesPlan(
            { pokaz_polke: true, przestrzen_nad_polka_mm: 80, odstep_gora_mm: 60 },
            { width_mm: 800, depth_mm: 500, height_mm: 1000 }
        );

        expect(plan.parts).toHaveLength(4); // SHELF, ROD, HOLDER_L, HOLDER_R

        const shelf = plan.parts.find((p: any) => p.role === 'SHELF_PANEL');
        expect(shelf).toBeDefined();
        expect(shelf.dim.x).toBe(800 - 4); // 796
        expect(shelf.dim.y).toBe(500 - 10); // 490
        expect(shelf.dim.z).toBe(18); // 18mm
        expect(shelf.loc.z).toBe(1000 - 80 - 18 / 2); // 911
    });

    it('oznacza bryły walcowe jawną flagą shape, nie heurystyką nazw', () => {
        const plan = buildTubesPlan({}, { width_mm: 600, height_mm: 720, depth_mm: 500 });

        for (const part of plan.parts) {
            const isRod = part.role === 'TUBE_ROD';
            const isHolder = part.role === 'HOLDER';
            expect(isCylindricalPart(part)).toBe(isRod || isHolder);
            if (isRod || isHolder) {
                expect(part.customProperties?.shape).toBe('CYLINDER');
            }
        }

        const rod = plan.parts.find((p: any) => p.role === 'TUBE_ROD')!;
        expect(isTubeRodPart(rod)).toBe(true);

        const holderL = findLeftHolder(plan.parts)!;
        const holderR = findRightHolder(plan.parts)!;
        expect(isTubeRodPart(holderL)).toBe(false);
        expect(isTubeRodPart(holderR)).toBe(false);
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
        const rod = plan.parts.find((p: any) => p.role === 'TUBE_ROD')!;
        const renamed = { ...rod, name: 'Polka_Zwykla' };
        expect(isCylindricalPart(renamed)).toBe(true);
        expect(isTubeRodPart(renamed)).toBe(true);
    });

    it('odrzuca wycofane aliasy (fail-fast)', () => {
        expect(() => assertCanonicalTubesParams({ show_shelf: true })).toThrow(/show_shelf → pokaz_polke/);
        expect(() => assertCanonicalTubesParams({ offset_top: 60 })).toThrow(/offset_top → odstep_gora_mm/);
        expect(() => assertCanonicalTubesParams({ pokaz_polke: true })).not.toThrow();
    });
});
