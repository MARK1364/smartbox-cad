import { describe, it, expect } from 'vitest';
import {
    buildBossExtrudeMesh,
    assertBossExtrudeAxioms,
    assertAdditiveFeaturePreservesBase,
    type BossExtrudeInput
} from '../native_core/planar-feature-mesh.js';

describe('Trzy Aksjomaty SolidWorks: Operacja WYCIĄGNIĘCIA (Boss-Extrude / Dodanie materiału)', () => {
    const defaultRectPolygon: Array<[number, number]> = [
        [50, 50],
        [250, 50],
        [250, 150],
        [50, 150]
    ];

    describe('Aksjomat 1: Niezmiennik super-zbioru (Super-Volume Invariant)', () => {
        it('V_baza ⊆ V_wynik: ujemna wysokość (h < 0) stapia się z bazą (Merge Result) i nie wygryza pustki', () => {
            const input: BossExtrudeInput = {
                id: 'boss_negative_h',
                face: 'FACE_Z_PLUS',
                polygon: defaultRectPolygon,
                height: -10, // Błędny znak w danych wejściowych
                plateW: 600,
                plateH: 800,
                plateT: 18
            };

            const result = buildBossExtrudeMesh(input);

            // Materiał nie wycina otworu: effectiveHeight jest sklamrowane do 0
            expect(result.effectiveHeight).toBe(0);
            expect(result.topMesh.positions.length).toBe(0);
            expect(result.wallsMesh.positions.length).toBe(0);

            // Asercja nie rzuca błędu, potwierdza bezpieczne scalenie
            expect(() => assertBossExtrudeAxioms(result, input)).not.toThrow();
        });

        it('assertAdditiveFeaturePreservesBase klamruje wierzchołki penetrujące bazę do lica formatki', () => {
            // Płyta 18mm: Z mieści się w [-9, +9] mm. Dla wyciągnięcia na górnym licu (dir=+1) lico to +9mm.
            const addedPositions = [
                0, 0, 15,   // poprawny punkt wyciągnięcia nad licem (+15 mm)
                10, 10, 5,  // punkt penetrujący wnętrze płyty (+5 mm zamiast >= +9 mm)
                20, 20, -20 // punkt penetrujący głęboko pod płytę
            ];

            assertAdditiveFeaturePreservesBase('test_additive', addedPositions, -9, 9, 1);

            expect(addedPositions[2]).toBe(15);
            expect(addedPositions[5]).toBe(9); // sklamrowane do lica górnego (+9 mm)
            expect(addedPositions[8]).toBe(9); // sklamrowane do lica górnego (+9 mm)
        });
    });

    describe('Aksjomat 2: Wektor normalny ściany (+n̂) i dodatnia wysokość (h > 0)', () => {
        it('wyciągnięcie na FACE_Z_PLUS idzie wzdłuż +n̂ (w stronę +Z): P_nowy = P_lico + h * n̂', () => {
            const plateT = 18; // lico Z_PLUS leży w Z = +9 mm
            const h = 25;
            const input: BossExtrudeInput = {
                id: 'boss_z_plus',
                face: 'FACE_Z_PLUS',
                polygon: defaultRectPolygon,
                height: h,
                plateW: 600,
                plateH: 800,
                plateT: plateT
            };

            const result = buildBossExtrudeMesh(input);
            expect(result.effectiveHeight).toBe(25);
            expect(result.topMesh.positions.length).toBeGreaterThan(0);

            // Wszystkie punkty wierzchu muszą leżeć dokładnie w Z = +9 + 25 = +34 mm
            const expectedZ = plateT / 2 + h;
            for (let i = 2; i < result.topMesh.positions.length; i += 3) {
                expect(result.topMesh.positions[i]).toBeCloseTo(expectedZ, 4);
            }

            expect(() => assertBossExtrudeAxioms(result, input)).not.toThrow();
        });

        it('wyciągnięcie na FACE_Z_MINUS idzie wzdłuż +n̂ (w stronę -Z): P_nowy = P_lico + h * n̂', () => {
            const plateT = 18; // lico Z_MINUS leży w Z = -9 mm, normalna n̂ = (0, 0, -1)
            const h = 15;
            const input: BossExtrudeInput = {
                id: 'boss_z_minus',
                face: 'FACE_Z_MINUS',
                polygon: defaultRectPolygon,
                height: h,
                plateW: 600,
                plateH: 800,
                plateT: plateT
            };

            const result = buildBossExtrudeMesh(input);
            expect(result.effectiveHeight).toBe(15);

            // Wszystkie punkty wierzchu muszą leżeć w Z = -9 - 15 = -24 mm
            const expectedZ = -plateT / 2 - h;
            for (let i = 2; i < result.topMesh.positions.length; i += 3) {
                expect(result.topMesh.positions[i]).toBeCloseTo(expectedZ, 4);
            }

            expect(() => assertBossExtrudeAxioms(result, input)).not.toThrow();
        });

        it('AABB(V_baza) ⊆ AABB(V_wynik): obwiednia formatki może się tylko powiększyć', () => {
            const plateW = 600;
            const plateH = 800;
            const plateT = 18;
            const h = 30;

            const input: BossExtrudeInput = {
                id: 'boss_aabb',
                face: 'FACE_Z_PLUS',
                polygon: defaultRectPolygon,
                height: h,
                plateW,
                plateH,
                plateT
            };

            const result = buildBossExtrudeMesh(input);

            // Baza AABB: Z w [-9, +9] mm
            // Wynik AABB: Z w [-9, +39] mm
            let maxZ = -Infinity;
            for (let i = 2; i < result.topMesh.positions.length; i += 3) {
                if (result.topMesh.positions[i] > maxZ) maxZ = result.topMesh.positions[i];
            }
            expect(maxZ).toBeCloseTo(plateT / 2 + h, 4);
            expect(maxZ).toBeGreaterThan(plateT / 2);
        });
    });

    describe('Aksjomat 3: Orientacja ścianek i eliminacja ścian wewnętrznych (Merge Solids)', () => {
        it('ściana styku zostaje wyeliminowana (brak podwójnej ściany w środku / brak non-manifold)', () => {
            const input: BossExtrudeInput = {
                id: 'boss_merge',
                face: 'FACE_Z_PLUS',
                polygon: defaultRectPolygon,
                height: 20,
                plateW: 600,
                plateH: 800,
                plateT: 18
            };

            const result = buildBossExtrudeMesh(input);

            // Brak siatki dna w miejscu styku z formatką bazową
            expect((result as any).bottomMesh).toBeUndefined();
            expect(result.topMesh).toBeDefined();
            expect(result.wallsMesh).toBeDefined();
        });

        it('ścianki boczne posiadają wektory normalne skierowane w przestrzeń zewnętrzną (od materiału)', () => {
            const input: BossExtrudeInput = {
                id: 'boss_normals',
                face: 'FACE_Z_PLUS',
                polygon: [
                    [0, 0],
                    [100, 0],
                    [100, 100],
                    [0, 100]
                ],
                height: 10,
                plateW: 600,
                plateH: 800,
                plateT: 18
            };

            const result = buildBossExtrudeMesh(input);
            expect(result.wallsMesh.indices.length).toBeGreaterThan(0);

            // Walidacja przez asercję
            expect(() => assertBossExtrudeAxioms(result, input)).not.toThrow();
        });
    });
});
