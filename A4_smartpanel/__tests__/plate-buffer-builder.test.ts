import { describe, it, expect } from 'vitest';
import {
    buildBoxContinuousBuffers,
    buildBoxPanelMeshData,
    FACE_CODES,
    ROLE_FLAGS,
    VERTEX_STRIDE_FLOATS
} from '../native_core/plate-buffer-builder.js';
import { buildPolygonPanelTopology } from '../native_core/polygon-extrusion.js';
import { KRAWEDZIE } from '../native_core/topology.js';

describe('PlateBufferBuilder (Faza 1 & 2)', () => {
    const W = 600;
    const H = 720;
    const T = 18;

    describe('Faza 1: Czysta Płyta Prostopadłościenna', () => {
        it('generuje ciągłe bufory binarne o poprawnych wymiarach i strukturze', () => {
            const buffers = buildBoxContinuousBuffers(W, H, T);

            expect(buffers.vertexCount).toBe(24);
            expect(buffers.indexCount).toBe(36);
            expect(buffers.faceCount).toBe(6);

            // 24 wierzchołki * 8 floatów (X, Y, Z, Nx, Ny, Nz, U, V) = 192 floatów
            expect(buffers.vertices.length).toBe(24 * VERTEX_STRIDE_FLOATS);
            // 12 trójkątów * 3 indeksy = 36 indeksów
            expect(buffers.indices.length).toBe(36);
            // 8 narożników B-Rep * 3 współrzędne (X, Y, Z w Float64) = 24 doubles
            expect(buffers.brepCorners.length).toBe(24);
            // 6 ścian * 6 intów rekordu topologii = 36 intów
            expect(buffers.topology.length).toBe(36);

            // Weryfikacja kodów ścian w topologii
            expect(buffers.topology[0]).toBe(FACE_CODES.FACE_Z_PLUS);
            expect(buffers.topology[3]).toBe(ROLE_FLAGS.FACE_LICO);

            expect(buffers.topology[6]).toBe(FACE_CODES.FACE_Z_MINUS);
            expect(buffers.topology[9]).toBe(ROLE_FLAGS.FACE_LICO);

            expect(buffers.topology[12]).toBe(FACE_CODES.FACE_X_PLUS);
            expect(buffers.topology[15]).toBe(ROLE_FLAGS.EDGE_BAND);
        });

        it('narożniki B-Rep w Float64Array odpowiadają dokładnie wymiarom nominalnym co do nanometra', () => {
            const buffers = buildBoxContinuousBuffers(W, H, T);
            const b = buffers.brepCorners;

            const hw = W / 2;
            const hh = H / 2;
            const ht = T / 2;

            // 0: tyl_dol_lewo [-hw, -hh, -ht]
            expect(b[0]).toBeCloseTo(-hw, 6);
            expect(b[1]).toBeCloseTo(-hh, 6);
            expect(b[2]).toBeCloseTo(-ht, 6);

            // 6: przod_gora_prawo [hw, hh, ht]
            expect(b[18]).toBeCloseTo(hw, 6);
            expect(b[19]).toBeCloseTo(hh, 6);
            expect(b[20]).toBeCloseTo(ht, 6);
        });

        it('porównanie A/B z buildPolygonPanelTopology: zgodność 12 krawędzi i 6 ścian', () => {
            const bufferResult = buildBoxPanelMeshData(W, H, T);
            const polyResult = buildPolygonPanelTopology({
                outline2d: [
                    [0, 0],
                    [W, 0],
                    [W, H],
                    [0, H]
                ],
                plateW: W,
                plateD: H,
                thickness: T
            });

            // 1. Sprawdzenie obecności 12 krawędzi topologicznych
            expect(bufferResult.edges.length).toBe(12);
            for (const edgeKey of Object.keys(KRAWEDZIE)) {
                const hasEdge = bufferResult.edges.some(e => e.key === edgeKey);
                expect(hasEdge, `Brak krawędzi ${edgeKey}`).toBe(true);
            }

            // 2. Sprawdzenie wymiarów lica przodu (FACE_Z_PLUS)
            const zPlusBuf = bufferResult.FACE_Z_PLUS;
            const zPlusPoly = polyResult.FACE_Z_PLUS;

            expect(zPlusBuf.positions.length).toBe(12); // 4 wierzchołki * 3 współrzędne
            expect(zPlusBuf.indices.length).toBe(6);     // 2 trójkąty

            for (let i = 2; i < zPlusBuf.positions.length; i += 3) {
                expect(zPlusBuf.positions[i]).toBeCloseTo(T / 2, 6);
            }
            for (let i = 2; i < zPlusPoly.positions.length; i += 3) {
                expect(zPlusPoly.positions[i]).toBeCloseTo(T / 2, 6);
            }

            // 3. Sprawdzenie flag krawędzi (edgeKey na wąskich bokach)
            expect(bufferResult.FACE_X_PLUS.edgeKey).toBe('+X');
            expect(bufferResult.FACE_X_MINUS.edgeKey).toBe('-X');
            expect(bufferResult.FACE_Y_PLUS.edgeKey).toBe('+Y');
            expect(bufferResult.FACE_Y_MINUS.edgeKey).toBe('-Y');
        });
    });

    describe('Faza 2: Obsługa Nawiertów i Otworów Walcowych', () => {
        it('obsługuje pojedynczy otwór nieprzelotowy (puszka zawiasu fi35)', () => {
            const features = [
                {
                    id: 'hinge_cup_1',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 100, v: 120, diameter: 35, depth: 12.5 }
                }
            ];

            const result = buildBoxPanelMeshData(W, H, T, features);

            // Sprawdzenie krawędzi B-Rep otworu
            const holeEdge = result.edges.find(e => e.key === 'e_hole_hinge_cup_1');
            expect(holeEdge).toBeDefined();
            expect(holeEdge!.points.length).toBe(25); // 24 segmenty + domknięcie

            // Siatka lica przodu powinna zawierać czapkę z wyciętym otworem + ścianki cylindra + dno
            const zPlus = result.FACE_Z_PLUS;
            expect(zPlus.positions.length).toBeGreaterThan(12); // więcej niż 4 wierzchołki
            expect(zPlus.indices.length).toBeGreaterThan(6);     // więcej niż 2 trójkąty
        });

        it('obsługuje szablon TRIPLE oraz SYSTEM_32 / ROW', () => {
            const features = [
                {
                    id: 'hinge_screws',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 100, v: 120, template_id: 'TRIPLE', offsetZ: 32, diameter: 5, depth: 12 }
                },
                {
                    id: 'shelf_row',
                    type: 'hole',
                    face: 'FACE_Z_MINUS',
                    params: { u: 50, v: 200, template_id: 'SYSTEM_32', count: 5, spacing: 32, diameter: 5, depth: 10 }
                }
            ];

            const result = buildBoxPanelMeshData(W, H, T, features);

            // TRIPLE: 3 otwory
            expect(result.edges.some(e => e.key === 'e_hole_hinge_screws')).toBe(true);
            expect(result.edges.some(e => e.key === 'e_hole_hinge_screws_t')).toBe(true);
            expect(result.edges.some(e => e.key === 'e_hole_hinge_screws_b')).toBe(true);

            // SYSTEM_32: 5 otworów
            for (let i = 0; i < 5; i++) {
                expect(result.edges.some(e => e.key === `e_hole_shelf_row_${i}`)).toBe(true);
            }
        });

        it('obsługuje wiercenia czołowe na wąskich krawędziach (np. FACE_X_MINUS)', () => {
            const features = [
                {
                    id: 'dowel_edge_1',
                    type: 'hole',
                    face: 'FACE_X_MINUS',
                    params: { u: 9, v: 150, diameter: 8, depth: 30 }
                }
            ];

            const result = buildBoxPanelMeshData(W, H, T, features);

            expect(result.edges.some(e => e.key === 'e_hole_dowel_edge_1')).toBe(true);
            expect(result.FACE_X_MINUS.indices.length).toBeGreaterThan(6);
        });

        it('porównanie A/B z buildPolygonPanelTopology dla boku szafki z 16 nawiertami', () => {
            // Symulacja boku szafki kuchennej: 2x TRIPLE (zawiasy) + 2x rzędy podpórek półek (5 otworów każdy) = 16 nawiertów
            const features = [
                { id: 'h1', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 100, template_id: 'TRIPLE', offsetZ: 32, diameter: 5, depth: 12 } },
                { id: 'h2', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 600, template_id: 'TRIPLE', offsetZ: 32, diameter: 5, depth: 12 } },
                { id: 's1', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 50,  v: 250, template_id: 'SYSTEM_32', count: 5, spacing: 32, diameter: 5, depth: 10 } },
                { id: 's2', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 550, v: 250, template_id: 'SYSTEM_32', count: 5, spacing: 32, diameter: 5, depth: 10 } },
            ];

            // 1. Stara metoda
            const oldRes = buildPolygonPanelTopology({
                outline2d: [[0, 0], [W, 0], [W, H], [0, H]],
                plateW: W, plateD: H, thickness: T,
                features
            });

            // 2. Nowa metoda
            const newRes = buildBoxPanelMeshData(W, H, T, features);

            // Weryfikacja: obie metody znajdują i wycinają wszystkie 16 nawiertów B-Rep
            const oldHoleEdges = oldRes.edges.filter(e => e.key.startsWith('e_hole_'));
            const newHoleEdges = newRes.edges.filter(e => e.key.startsWith('e_hole_'));

            expect(oldHoleEdges.length).toBe(16);
            expect(newHoleEdges.length).toBe(16);

            for (const oldEdge of oldHoleEdges) {
                const found = newHoleEdges.find(e => e.key === oldEdge.key);
                expect(found, `Brak krawędzi ${oldEdge.key} w nowym silniku`).toBeDefined();
            }
        });

        it('bezpośredni benchmark porównawczy: Stara metoda vs Nowa Faza 2 dla 16 nawiertów', () => {
            const features = [
                { id: 'h1', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 100, template_id: 'TRIPLE', offsetZ: 32, diameter: 5, depth: 12 } },
                { id: 'h2', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 600, template_id: 'TRIPLE', offsetZ: 32, diameter: 5, depth: 12 } },
                { id: 's1', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 50,  v: 250, template_id: 'SYSTEM_32', count: 5, spacing: 32, diameter: 5, depth: 10 } },
                { id: 's2', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 550, v: 250, template_id: 'SYSTEM_32', count: 5, spacing: 32, diameter: 5, depth: 10 } },
            ];

            const iterations = 500;

            // Warmup
            for (let i = 0; i < 50; i++) {
                buildPolygonPanelTopology({
                    outline2d: [[0, 0], [W, 0], [W, H], [0, H]],
                    plateW: W, plateD: H, thickness: T,
                    features
                });
                buildBoxContinuousBuffers(W, H, T, features);
                buildBoxPanelMeshData(W, H, T, features);
            }

            // 1. Stara metoda
            const t0Old = performance.now();
            for (let i = 0; i < iterations; i++) {
                buildPolygonPanelTopology({
                    outline2d: [[0, 0], [W, 0], [W, H], [0, H]],
                    plateW: W, plateD: H, thickness: T,
                    features
                });
            }
            const timeOld = performance.now() - t0Old;
            const perPanelOld = timeOld / iterations;

            // 2. Nowa metoda - MeshData + TypedArray
            const t0Mesh = performance.now();
            for (let i = 0; i < iterations; i++) {
                buildBoxPanelMeshData(W, H, T, features);
            }
            const timeMesh = performance.now() - t0Mesh;
            const perPanelMesh = timeMesh / iterations;

            // 3. Nowa metoda - Continuous TypedArray
            const t0Continuous = performance.now();
            for (let i = 0; i < iterations; i++) {
                buildBoxContinuousBuffers(W, H, T, features);
            }
            const timeContinuous = performance.now() - t0Continuous;
            const perPanelContinuous = timeContinuous / iterations;

            const speedupContinuous = perPanelOld / perPanelContinuous;
            const speedupMesh = perPanelOld / perPanelMesh;

            console.log('\n================ BIEŻĄCY POMIAR WYDAJNOŚCI (16 NAWIERTÓW) ================');
            console.log(`1. STARA METODA (buildPolygonPanelTopology): ${perPanelOld.toFixed(4)} ms/formatka (${(1000 / perPanelOld).toFixed(0)} formatek/sek)`);
            console.log(`2. NOWA METODA - MeshData + TypedArray:      ${perPanelMesh.toFixed(4)} ms/formatka (${(1000 / perPanelMesh).toFixed(0)} formatek/sek) [${speedupMesh.toFixed(1)}x szybciej]`);
            console.log(`3. NOWA METODA - Continuous TypedArray:      ${perPanelContinuous.toFixed(4)} ms/formatka (${(1000 / perPanelContinuous).toFixed(0)} formatek/sek) [${speedupContinuous.toFixed(1)}x szybciej]`);
            console.log(`>>> PRZYSPIESZENIE: ${speedupContinuous.toFixed(1)}x SZYBCIEJ <<<`);
            console.log('==========================================================================\n');

            expect(perPanelContinuous).toBeLessThan(perPanelOld);
            expect(speedupContinuous).toBeGreaterThan(2.0); // Przyspieszenie co najmniej 2x względem starego silnika
            expect(perPanelContinuous).toBeLessThan(0.6);   // Bez narzutu GC, podłoga to czysty earcut (0.26 ms)
        });
    });
});
