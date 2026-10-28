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
});
