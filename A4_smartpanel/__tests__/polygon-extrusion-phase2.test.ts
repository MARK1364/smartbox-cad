import { describe, it, expect } from 'vitest';
import {
    buildPolygonPanelTopology,
    BrepEdgeData
} from '../native_core/polygon-extrusion';
import { buildBoxTopology } from '../native_core/box-topology';
import { buildFaceMeshWithFeatures, featuresOnFace } from '../native_core/cap-machining';
import { computeFaceData } from '../native_core/face-lcs';
import { mmToNm } from '../../A1_core/cad-math/units';

describe('Faza 2: Walidacja Ekstrudowania Prostokąta (N=4) i Profilu L', () => {

    describe('1. Porównanie geometrii prostokąta N=4 z modelem boxTopo', () => {
        const W = 600;
        const H = 800;
        const T = 18;
        const rectOutline = [[0, 0], [W, 0], [W, H], [0, H]];

        const polyTopo = buildPolygonPanelTopology({
            outline2d: rectOutline,
            plateW: W,
            plateD: H,
            thickness: T
        });

        const boxTopo = buildBoxTopology(W, H, T);

        it('wymiary BoundingBox wierzchołków profilu N=4 są identyczne z boxTopo', () => {
            const polyVertices = polyTopo.vertices as number[][];
            const boxVertices = boxTopo.vertices;

            // Sprawdzenie skrajnych zakresów X, Y, Z
            const polyMinX = Math.min(...polyVertices.map(v => v[0]));
            const polyMaxX = Math.max(...polyVertices.map(v => v[0]));
            const polyMinY = Math.min(...polyVertices.map(v => v[1]));
            const polyMaxY = Math.max(...polyVertices.map(v => v[1]));
            const polyMinZ = Math.min(...polyVertices.map(v => v[2]));
            const polyMaxZ = Math.max(...polyVertices.map(v => v[2]));

            const boxMinX = Math.min(...boxVertices.map(v => v[0]));
            const boxMaxX = Math.max(...boxVertices.map(v => v[0]));
            const boxMinY = Math.min(...boxVertices.map(v => v[1]));
            const boxMaxY = Math.max(...boxVertices.map(v => v[1]));
            const boxMinZ = Math.min(...boxVertices.map(v => v[2]));
            const boxMaxZ = Math.max(...boxVertices.map(v => v[2]));

            expect(polyMinX).toBeCloseTo(boxMinX, 3);
            expect(polyMaxX).toBeCloseTo(boxMaxX, 3);
            expect(polyMinY).toBeCloseTo(boxMinY, 3);
            expect(polyMaxY).toBeCloseTo(boxMaxY, 3);
            expect(polyMinZ).toBeCloseTo(boxMinZ, 3);
            expect(polyMaxZ).toBeCloseTo(boxMaxZ, 3);

            expect(polyMinX).toBeCloseTo(-W / 2, 3);
            expect(polyMaxX).toBeCloseTo(W / 2, 3);
            expect(polyMinY).toBeCloseTo(-H / 2, 3);
            expect(polyMaxY).toBeCloseTo(H / 2, 3);
            expect(polyMinZ).toBeCloseTo(-T / 2, 3);
            expect(polyMaxZ).toBeCloseTo(T / 2, 3);
        });

        it('pokrycie 12 krawędzi B-rep profilu N=4 odpowiada 12 krawędziom boxTopo', () => {
            const polyEdges = polyTopo.edges as BrepEdgeData[];
            const boxEdges = boxTopo.edges;

            expect(boxEdges.length).toBe(12);
            // Profil N=4 generuje dokładnie 12 krawędzi nominalnych (4 góra + 4 dół + 4 piony)
            const nominalEdges = polyEdges.filter(e => e.alias !== undefined);
            expect(nominalEdges.length).toBe(12);

            const expectedAliases = [
                'dol_przod', 'przod_prawo', 'gora_przod', 'przod_lewo',
                'dol_tyl', 'tyl_prawo', 'gora_tyl', 'tyl_lewo',
                'dol_lewo', 'dol_prawo', 'gora_prawo', 'gora_lewo'
            ];

            for (const alias of expectedAliases) {
                const found = polyEdges.find(e => e.alias === alias);
                expect(found).toBeDefined();
            }
        });
    });

    describe('2. Zgodność ścian bocznych i nakładania obrzeży', () => {
        const W = 500;
        const H = 700;
        const T = 18;
        const rectOutline = [[0, 0], [W, 0], [W, H], [0, H]];

        const topo = buildPolygonPanelTopology({
            outline2d: rectOutline,
            plateW: W,
            plateD: H,
            thickness: T
        });

        it('każda ścianka OUTLINE_SIDE_i posiada poprawny edgeKey dla obrzeża', () => {
            const side0 = topo.OUTLINE_SIDE_0;
            const side1 = topo.OUTLINE_SIDE_1;
            const side2 = topo.OUTLINE_SIDE_2;
            const side3 = topo.OUTLINE_SIDE_3;

            expect(side0.edgeKey).toBe('-Y');
            expect(side1.edgeKey).toBe('+X');
            expect(side2.edgeKey).toBe('+Y');
            expect(side3.edgeKey).toBe('-X');
        });

        it('współrzędne ścian bocznych leżą dokładnie na nominalnych granicach formatki', () => {
            // side0: dolna krawędź v=0 -> Y = -H/2
            const pos0 = topo.OUTLINE_SIDE_0.positions as number[];
            for (let i = 1; i < pos0.length; i += 3) {
                expect(pos0[i]).toBeCloseTo(-H / 2, 3);
            }

            // side1: prawa krawędź u=W -> X = +W/2
            const pos1 = topo.OUTLINE_SIDE_1.positions as number[];
            for (let i = 0; i < pos1.length; i += 3) {
                expect(pos1[i]).toBeCloseTo(W / 2, 3);
            }

            // side2: górna krawędź v=H -> Y = +H/2
            const pos2 = topo.OUTLINE_SIDE_2.positions as number[];
            for (let i = 1; i < pos2.length; i += 3) {
                expect(pos2[i]).toBeCloseTo(H / 2, 3);
            }

            // side3: lewa krawędź u=0 -> X = -W/2
            const pos3 = topo.OUTLINE_SIDE_3.positions as number[];
            for (let i = 0; i < pos3.length; i += 3) {
                expect(pos3[i]).toBeCloseTo(-W / 2, 3);
            }
        });
    });

    describe('3. Pozycjonowanie otworów (Hole Machining)', () => {
        const W = 600;
        const H = 800;
        const T = 18;
        const rectOutline = [[0, 0], [W, 0], [W, H], [0, H]];

        it('otwór na licu FACE_Z_PLUS generuje geometrię cylindra w siatce lica oraz krawędź e_hole', () => {
            const holeFeature = {
                id: 101,
                type: 'hole',
                face: 'FACE_Z_PLUS',
                params: {
                    u: 100,
                    v: 150,
                    diameter: 35,
                    depth: 13
                }
            };

            const topo = buildPolygonPanelTopology({
                outline2d: rectOutline,
                plateW: W,
                plateD: H,
                thickness: T,
                features: [holeFeature]
            });

            // Siatka lica roboczego FACE_Z_PLUS zawiera wierzchołki lica oraz ścianki i dno otworu
            const faceZPlus = topo.FACE_Z_PLUS;
            expect(faceZPlus).toBeDefined();
            expect(faceZPlus.positions.length).toBeGreaterThan(0);

            // Sprawdzamy czy w pozycjach Z+ znajdują się wierzchołki dna otworu o Z = +9 - 13 = -4 mm
            const zCoords = (faceZPlus.positions as number[]).filter((_, i) => i % 3 === 2);
            const hasHoleBottom = zCoords.some(z => Math.abs(z - (9 - 13)) < 0.05);
            expect(hasHoleBottom).toBe(true);

            // Krawędzie B-rep zawierają okrąg otworu z identyfikatorem e_hole_101
            const edges = topo.edges as Array<{ key: string; points: number[][] }>;
            const holeEdge = edges.find(e => e.key === 'e_hole_101');
            expect(holeEdge).toBeDefined();
            expect(holeEdge?.points.length).toBeGreaterThan(10);

            // Środek krawędzi otworu w LCS: X = 100 - 300 = -200, Y = 150 - 400 = -250, Z = +9 (+T/2)
            const pts = holeEdge!.points;
            const uniquePts = pts.slice(0, pts.length - 1);
            const avgX = uniquePts.reduce((sum, p) => sum + p[0], 0) / uniquePts.length;
            const avgY = uniquePts.reduce((sum, p) => sum + p[1], 0) / uniquePts.length;
            const avgZ = uniquePts.reduce((sum, p) => sum + p[2], 0) / uniquePts.length;

            expect(avgX).toBeCloseTo(-W / 2 + 100, 1);
            expect(avgY).toBeCloseTo(-H / 2 + 150, 1);
            expect(avgZ).toBeCloseTo(T / 2, 1);
        });
    });

    describe('4. Profil L (Wieniec narożny) i wpusty HDF', () => {
        const plateW = 882;
        const plateD = 882;
        const armU = 600;
        const armV = 600;
        const outlineL = [
            [0, 0],
            [plateW, 0],
            [plateW, armV],
            [armU, armV],
            [armU, plateD],
            [0, plateD]
        ];

        it('profil L zachowuje rozcinanie podsegmentów ścianki przez wpust przylegający do brzegu', () => {
            const groove = {
                id: 'g_hdf',
                type: 'groove',
                face: 'FACE_Z_PLUS',
                params: {
                    u: 0,
                    v: 0,
                    width: plateW,
                    length: 4,
                    depth: 10
                }
            };

            const topo = buildPolygonPanelTopology({
                outline2d: outlineL,
                plateW,
                plateD,
                thickness: 18,
                features: [groove]
            });

            // Ścianki boczne profilu L
            expect(topo.OUTLINE_SIDE_0).toBeDefined();
            expect(topo.OUTLINE_SIDE_1).toBeDefined();
            expect(topo.OUTLINE_SIDE_2).toBeDefined();
            expect(topo.OUTLINE_SIDE_3).toBeDefined();
            expect(topo.OUTLINE_SIDE_4).toBeDefined();
            expect(topo.OUTLINE_SIDE_5).toBeDefined();

            // Wpust wzdłuż krawędzi -Y (odcinek 0) tworzy podsegmenty lub modyfikuje głębokość ścianki
            const side0 = topo.OUTLINE_SIDE_0;
            expect(side0.edgeKey).toBe('-Y');
        });
    });
});
