import { describe, it, expect } from 'vitest';
import { buildPolygonPanelTopology } from '../native_core/polygon-extrusion.js';
import { dissolveCoplanarEdges } from '../native_core/brep-topology.js';

describe('B-rep Co-planar Edge Dissolver (OCCT ShapeUpgrade_UnifySameDomain equivalent)', () => {
    it('rozpuszcza pionową krawędź-widmo na płaskim boku, gdy outline2d zawiera współliniowy wierzchołek pośredni', () => {
        // Prostokąt 400x300x18 z dodatkowym wierzchołkiem [200, 0] na dolnej krawędzi v = 0
        const topo = buildPolygonPanelTopology({
            outline2d: [
                [0, 0],
                [200, 0],
                [400, 0],
                [400, 300],
                [0, 300]
            ],
            plateW: 400,
            plateD: 300,
            thickness: 18
        });

        const edges = topo.edges as Array<{ key: string; points: number[][] }>;

        // W punkcie u = 200, v = 0 (w LCS: X = 0, Y = -150) dwie ścianki OUTLINE_SIDE_0 i OUTLINE_SIDE_1
        // leżą w jednej płaszczyźnie Y = -150 o tej samej normalnej (0, -1, 0).
        // Pionowa krawędź łącząca je pod kątem 180° musi zostać rozpuszczona.
        const midWallVertEdges = edges.filter(e => {
            if (e.points.length !== 2) return false;
            const [p0, p1] = e.points;
            return (
                Math.abs(p0[0] - 0) < 0.05 &&
                Math.abs(p1[0] - 0) < 0.05 &&
                Math.abs(p0[1] - (-150)) < 0.05 &&
                Math.abs(p1[1] - (-150)) < 0.05 &&
                Math.abs(p0[2] - p1[2]) > 0.1
            );
        });

        expect(midWallVertEdges.length).toBe(0);

        // Natomiast 4 prawdziwe narożniki 90° formatki są zachowane
        const cornerVertEdges = edges.filter(e => {
            if (e.points.length !== 2) return false;
            const [p0, p1] = e.points;
            return Math.abs(p0[0] - p1[0]) < 0.05 &&
                   Math.abs(p0[1] - p1[1]) < 0.05 &&
                   Math.abs(Math.abs(p0[2] - p1[2]) - 18) < 0.1;
        });
        expect(cornerVertEdges.length).toBe(4);
    });

    it('przycina częściowo współpłaszczyznową krawędź dokładnie do odcinka, gdzie istnieje rzeczywisty uskok 90°', () => {
        // Budujemy topologię z wcięciem narożnym i wpustem zlicowanym ze ścianką wcięcia
        // Wcięcie: u = 0..16, v = 602..720; Wpust: u = 13..16, v = 0..602, depth = 11
        const topo = buildPolygonPanelTopology({
            outline2d: [
                [0, 0],
                [600, 0],
                [600, 720],
                [16, 720],
                [16, 602],
                [0, 602]
            ],
            plateW: 600,
            plateD: 720,
            thickness: 18,
            features: [
                {
                    id: 'g_flush',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: { u: 13, v: 0, width: 3, length: 602, depth: 11 }
                }
            ]
        });

        // Dodajemy sztucznie pełną krawędź pionową od Z = -9 do Z = +9 na styku u = 16, v = 602 (X = -284, Y = 242),
        // gdzie w zakresie Z = [-2, +9] płaszczyzna X = -284 jest ciągła (180°), a w Z = [-9, -2] tworzy narożnik 90°
        topo.edges.push({
            key: 'test_full_vert_edge',
            points: [
                [-284, 242, -9],
                [-284, 242, 9]
            ]
        });

        const dissolved = dissolveCoplanarEdges(topo);
        const testEdge = dissolved.find(e => e.key.startsWith('test_full_vert_edge'));
        expect(testEdge).toBeDefined();

        const zMin = Math.min(testEdge!.points[0][2], testEdge!.points[1][2]);
        const zMax = Math.max(testEdge!.points[0][2], testEdge!.points[1][2]);
        // Górne 11 mm (od -2 do +9) zostało rozpuszczone jako szew 180°, zostało dolne 7 mm (od -9 do -2)
        expect(zMin).toBeCloseTo(-9, 1);
        expect(zMax).toBeCloseTo(-2, 1);
    });

    it('brak zbytecznej krawędzi 7mm na płaskiej ściance tylnej boczku przy wcięciu na plecy 11mm', () => {
        // Formatka boku szafki 550x720x18 z wcięciem/wpustem na plecy:
        // Wpust na FACE_Z_PLUS o głębokości 11 mm, szerokości 3 mm przy tylnej krawędzi (u = 547..550),
        // kończący się 7 mm przed końcem formatki (v = 7..713 mm).
        const topo = buildPolygonPanelTopology({
            outline2d: [
                [0, 0],
                [550, 0],
                [550, 720],
                [0, 720]
            ],
            plateW: 550,
            plateD: 720,
            thickness: 18,
            features: [
                {
                    id: 'feat_notch',
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 547,
                        v: 7,
                        width: 3,
                        length: 706,
                        depth: 11
                    }
                }
            ]
        });

        const edges = topo.edges as Array<{ key: string; points: number[][] }>;

        // 1. Uskok 11 mm na krawędzi wcięcia (od Z = +9 do Z = -2) istnieje i ma dokładnie 11 mm:
        const stepEdges11mm = edges.filter(e => {
            if (e.points.length !== 2) return false;
            const p0 = e.points[0];
            const p1 = e.points[1];
            const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
            return Math.abs(len - 11) < 0.1 && (
                (Math.abs(p0[2] - 9) < 0.1 && Math.abs(p1[2] - (-2)) < 0.1) ||
                (Math.abs(p0[2] - (-2)) < 0.1 && Math.abs(p1[2] - 9) < 0.1)
            );
        });
        expect(stepEdges11mm.length).toBeGreaterThanOrEqual(1);

        // 2. BEZWZGLĘDNY BRAK zbytecznej krawędzi 7 mm na płaskiej tylnej ściance boczku (od Z = -2 do Z = -9):
        const spurious7mmEdges = edges.filter(e => {
            if (e.points.length !== 2) return false;
            const p0 = e.points[0];
            const p1 = e.points[1];
            const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
            const isNearXPlus = Math.abs(p0[0] - 275) < 0.1 && Math.abs(p1[0] - 275) < 0.1;
            const isNearStepY = Math.abs(p0[1] - 353) < 0.5 || Math.abs(p0[1] - (-353)) < 0.5;
            const spansZ2to9 = (
                (Math.abs(p0[2] - (-2)) < 0.1 && Math.abs(p1[2] - (-9)) < 0.1) ||
                (Math.abs(p0[2] - (-9)) < 0.1 && Math.abs(p1[2] - (-2)) < 0.1)
            );
            return isNearXPlus && isNearStepY && spansZ2to9 && Math.abs(len - 7) < 0.1;
        });
        expect(spurious7mmEdges.length).toBe(0);

        // 3. Sprawdzenie, że siatka ścianki bocznej OUTLINE_SIDE_1 nie posiada rozcięć / T-junctions:
        const rearWall = topo.OUTLINE_SIDE_1;
        expect(rearWall).toBeDefined();
        // Na ściance o 3 podsegmentach siatka ma spójne 10 wierzchołków bez duplikacji na szwach
        expect(rearWall.positions.length / 3).toBe(10);
    });
});
