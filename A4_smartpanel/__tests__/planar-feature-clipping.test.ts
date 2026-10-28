import { describe, it, expect } from 'vitest';
import { buildPolygonPanelTopology, clipFeaturesToOutline, intersectPolygonWithContour } from '../native_core/polygon-extrusion.js';

function meshArea3D(m: { positions?: number[]; indices?: number[] } | undefined): number {
    if (!m?.indices?.length || !m?.positions?.length) return 0;
    let area = 0;
    for (let i = 0; i < m.indices.length; i += 3) {
        const i0 = m.indices[i] * 3;
        const i1 = m.indices[i + 1] * 3;
        const i2 = m.indices[i + 2] * 3;
        const ax = m.positions[i0], ay = m.positions[i0 + 1], az = m.positions[i0 + 2];
        const bx = m.positions[i1], by = m.positions[i1 + 1], bz = m.positions[i1 + 2];
        const cx = m.positions[i2], cy = m.positions[i2 + 1], cz = m.positions[i2 + 2];
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    return area;
}

describe('Planar Feature Clipping (EffectiveFeature = FeaturePolygon ∩ OuterContour)', () => {
    it('docina pionowy wpust do skośnej krawędzi dachu (szafka poddaszowa / trapez)', () => {
        // Trapez: szerokość 600, lewy bok wys. 500, prawy bok wys. 800 (skos dachu od (0,500) do (600,800))
        const slopedOutline = [
            [0, 0],
            [600, 0],
            [600, 800],
            [0, 500]
        ];
        // Wpust pionowy u = 18..22 (szer. 4 mm), zadany na pełną wysokość nominalną v = 0..800, głębokość 11 mm.
        // Na skosie v(u) = 500 + (u / 600) * 300 = 500 + 0.5 * u:
        // Dla u = 18 -> v = 509; dla u = 22 -> v = 511.
        const clipped = clipFeaturesToOutline(
            [{
                id: 'g_sloped',
                type: 'groove',
                face: 'FACE_Z_PLUS',
                params: { u: 18, v: 0, width: 4, length: 800, depth: 11 }
            }],
            slopedOutline,
            600,
            800
        );

        expect(clipped.length).toBe(1);
        const poly = clipped[0].params.polygon as number[][];
        expect(poly).toBeDefined();
        expect(poly.length).toBe(4);

        const maxV = Math.max(...poly.map(p => p[1]));
        expect(maxV).toBeCloseTo(511, 1);

        // Budujemy pełną topologię 3D dla skośnego boku z wpustem
        const topo = buildPolygonPanelTopology({
            outline2d: slopedOutline,
            plateW: 600,
            plateD: 800,
            thickness: 18,
            features: [{
                id: 'g_sloped',
                type: 'groove',
                face: 'FACE_Z_PLUS',
                params: { u: 18, v: 0, width: 4, length: 800, depth: 11 }
            }]
        });

        // 1. Pole dna wpustu to dokładnie pole trapezu: 4 * (509 + 511) / 2 = 2040 mm^2 (a nie 4 * 800 = 3200 mm^2)
        const bottomMesh = topo['feature_g_sloped_bottom'];
        expect(bottomMesh).toBeDefined();
        expect(meshArea3D(bottomMesh)).toBeCloseTo(2040, 0);

        // 2. Pole lica FACE_Z_PLUS to pole trapezu (600 * (500 + 800) / 2 = 390_000) minus 2040 = 387_960 mm^2
        expect(meshArea3D(topo.FACE_Z_PLUS)).toBeCloseTo(390_000 - 2040, 0);

        // 3. Ścianka boczna dachu (OUTLINE_SIDE_2: od (600,800) do (0,500)) została rozcięta przez wlot wpustu (3 podsegmenty = 12 wierzchołków = 36 współrzędnych)
        const roofSide = topo.OUTLINE_SIDE_2;
        expect(roofSide).toBeDefined();
        expect(roofSide.positions.length).toBe(36);
    });

    it('docina dno i ścianki wpustu wychodzącego w pustkę wcięcia L (brak geometrii wiszącej w powietrzu)', () => {
        const outlineL = [
            [0, 0],
            [882, 0],
            [882, 700],
            [500, 700],
            [500, 882],
            [0, 882]
        ];
        // Wpust na wysokości v = 800..804 zadany na całą szerokość 882 mm; materiał istnieje tylko dla u = 0..500
        const topo = buildPolygonPanelTopology({
            outline2d: outlineL,
            plateW: 882,
            plateD: 882,
            thickness: 18,
            features: [{
                id: 'g_over_l',
                type: 'groove',
                face: 'FACE_Z_PLUS',
                params: { u: 0, v: 800, width: 882, length: 4, depth: 8 }
            }]
        });

        const bottomMesh = topo['feature_g_over_l_bottom'];
        expect(bottomMesh).toBeDefined();
        // Pole dna wpustu musi wynosić 500 * 4 = 2000 mm^2, a nie 882 * 4 = 3528 mm^2
        expect(meshArea3D(bottomMesh)).toBeCloseTo(500 * 4, 0);
    });

    it('odrzuca otwory z rzędu SYSTEM_32 wypadające poza skośnym ścięciem formatki', () => {
        const slopedOutline = [
            [0, 0],
            [400, 0],
            [400, 400],
            [0, 200]
        ];
        // Rząd 5 otworów co 32 mm przy u = 37: v = 150, 182, 214, 246, 278.
        // Dla u = 37 wysokość skosu wynosi v_max = 200 + (37 / 400) * 200 = 218.5 mm.
        // W materiale mieszczą się tylko otwory o v = 150 i v = 182 (oraz v = 214 blisko krawędzi, ale > 218.5 - r odpada).
        // Otwory v = 246 i v = 278 leżą całkowicie w powietrzu ponad skosem.
        const topo = buildPolygonPanelTopology({
            outline2d: slopedOutline,
            plateW: 400,
            plateD: 400,
            thickness: 18,
            features: [{
                id: 'sys32',
                type: 'hole',
                face: 'FACE_Z_PLUS',
                params: {
                    u: 37,
                    v: 150,
                    diameter: 5,
                    depth: 12,
                    template_id: 'SYSTEM_32',
                    spacing: 32,
                    count: 5
                }
            }]
        });

        const holeEdges = (topo.edges as Array<{ key: string }>).filter(e => e.key.startsWith('e_hole_sys32'));
        // Tylko 3 pierwsze otwory (v = 150, 182, 214 <= 218.5) mają środki wewnątrz trapezu; v = 246 i 278 są poza obrysem
        expect(holeEdges.map(e => e.key)).toEqual(['e_hole_sys32_0', 'e_hole_sys32_1', 'e_hole_sys32_2']);
    });

    it('przycina kieszeń do zaokrąglonego narożnika formatki (fillet_mm)', () => {
        const topo = buildPolygonPanelTopology({
            outline2d: [
                [0, 0],
                [300, 0],
                [300, 300],
                [0, 300]
            ],
            fillet_mm: 50,
            plateW: 300,
            plateD: 300,
            thickness: 18,
            features: [{
                id: 'corner_pocket',
                type: 'pocket',
                face: 'FACE_Z_PLUS',
                params: { u: 0, v: 0, width: 60, length: 60, depth: 6 }
            }]
        });

        const bottomMesh = topo['feature_corner_pocket_bottom'];
        expect(bottomMesh).toBeDefined();
        // Pełny kwadrat 60x60 miałby 3600 mm^2; zaokrąglenie R=50 odcina narożnik o polu R^2*(1 - pi/4) ≈ 536.5 mm^2
        const expectedArea = 3600 - 50 * 50 * (1 - Math.PI / 4);
        expect(meshArea3D(bottomMesh)).toBeCloseTo(expectedArea, -1);
    });
});
