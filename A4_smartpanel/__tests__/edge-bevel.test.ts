import { describe, it, expect } from 'vitest';
import { bevelInsetMm, buildBeveledBox } from '../native_core/edge-bevel.js';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('pochylenie krawędzi formatki', () => {
    it('45° na +X cofa spód o grubość, lico Z+ zostaje', () => {
        expect(bevelInsetMm(18, 45)).toBeCloseTo(18, 6);
        const box = buildBeveledBox(200, 80, 18, { '+X': 45, '-X': 0, '+Y': 0, '-Y': 0 });
        expect(box.top[1][0]).toBeCloseTo(100, 6);
        expect(box.bottom[1][0]).toBeCloseTo(100 - 18, 6);
        expect(box.bottom[0][0]).toBeCloseTo(-100, 6);
        const dx = box.top[1][0] - box.bottom[1][0];
        const dz = box.top[1][2] - box.bottom[1][2];
        expect(dx).toBeCloseTo(18, 6);
        expect(dz).toBeCloseTo(18, 6);
    });

    it('cztery krawędzie 45° — spód mniejszy o grubość z każdej strony (ucios ramki)', () => {
        const box = buildBeveledBox(200, 80, 18, { '+X': 45, '-X': 45, '+Y': 45, '-Y': 45 });
        expect(box.bottom[0][0]).toBeCloseTo(-100 + 18, 6);
        expect(box.bottom[1][0]).toBeCloseTo(100 - 18, 6);
        expect(box.bottom[0][1]).toBeCloseTo(-40 + 18, 6);
        expect(box.bottom[2][1]).toBeCloseTo(40 - 18, 6);
        expect(box.top[2][0]).toBeCloseTo(100, 6);
    });

    it('cutAnchor Z− na +Y: zewnętrzne lico (+Y) zostaje, wewnętrzne skrócone', () => {
        const hy = 40;
        const iy = 18;
        const box = buildBeveledBox(200, 80, 18, {
            '+X': { angle: 0, anchor: 'Z_PLUS' },
            '-X': { angle: 0, anchor: 'Z_PLUS' },
            '+Y': { angle: 45, anchor: 'Z_MINUS' },
            '-Y': { angle: 0, anchor: 'Z_PLUS' },
        });
        expect(box.bottom[2][1]).toBeCloseTo(hy, 6);
        expect(box.top[2][1]).toBeCloseTo(hy - iy, 6);
        expect(box.top[2][1]).toBeLessThan(hy);
    });

    it('mesh formatki czyta cutAngle z obrzeża', () => {
        const mesh = buildMeshFromPanel({
            width: mmToNm(200),
            height: mmToNm(80),
            thickness: mmToNm(18),
            role: 'PANEL',
            edgeBanding: {
                '+X': { active: true, cutAngle: 45 },
                '-X': { active: false, cutAngle: 0 },
                '+Y': { active: false },
                '-Y': { active: false },
            },
        });
        const side = mesh.FACE_X_PLUS.positions as number[];
        const topX = side[0];
        const botX = side[9];
        expect(Math.abs(topX - botX)).toBeCloseTo(18, 4);
    });

    it('formatka ze ściętą krawędzią (bevel) zachowuje otwory i wpusty (featureMeshes oraz edges)', () => {
        const mesh = buildMeshFromPanel({
            width: mmToNm(200),
            height: mmToNm(80),
            thickness: mmToNm(18),
            role: 'PANEL',
            edgeBanding: {
                '+X': { active: true, cutAngle: 45 },
                '-X': { active: false, cutAngle: 0 },
                '+Y': { active: false },
                '-Y': { active: false },
            },
            features: [
                {
                    id: 101,
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 50, v: 40, diameter: 35, depth: 10 }
                },
                {
                    id: 102,
                    type: 'groove',
                    face: 'FACE_Z_PLUS',
                    params: { u: 10, v: 10, width: 4, length: 60, depth: 8 }
                }
            ]
        });

        // Ściana Z+ powinna być ztriangulowana z otworami/wpustem (znacznie więcej niż 4 wierzchołki prostokąta)
        expect(mesh.FACE_Z_PLUS.positions.length).toBeGreaterThan(12);

        // Krawędzie B-rep muszą zawierać obrys otworu i wpustu
        const holeEdge = mesh.edges.find((e: any) => e.key === 'e_hole_101');
        expect(holeEdge).toBeDefined();
        expect(holeEdge.points.length).toBeGreaterThan(10);

        const grooveEdge = mesh.edges.find((e: any) => e.key === 'e_groove_102_t1');
        expect(grooveEdge).toBeDefined();

        // Siatki płaszczyzn B-rep operacji (dno wpustu) muszą być wygenerowane
        expect(mesh['feature_102_bottom']).toBeDefined();
        expect(mesh['feature_102_bottom'].positions.length).toBeGreaterThan(0);
    });

    it('formatka ze ściętą krawędzią (bevel) zachowuje nawierty na ścianach bocznych (np. kołek na FACE_X_PLUS)', () => {
        const mesh = buildMeshFromPanel({
            width: mmToNm(200),
            height: mmToNm(80),
            thickness: mmToNm(18),
            role: 'PANEL',
            edgeBanding: {
                '+X': { active: false },
                '-X': { active: false },
                '+Y': { active: true, cutAngle: 45 },
                '-Y': { active: false },
            },
            features: [
                {
                    id: 201,
                    type: 'hole',
                    face: 'FACE_X_PLUS',
                    params: { u: 9, v: 40, diameter: 8, depth: 30 }
                }
            ]
        });

        // Ściana X+ powinna być ztriangulowana z otworem kołka (więcej niż 12 floatów dla 4 wierzchołków)
        expect(mesh.FACE_X_PLUS.positions.length).toBeGreaterThan(12);

        // Krawędź otworu e_hole_201 musi być obecna w edges
        const holeEdge = mesh.edges.find((e: any) => e.key === 'e_hole_201');
        expect(holeEdge).toBeDefined();
        expect(holeEdge.points.length).toBeGreaterThan(10);
    });

    it('ściana boczna ze ścięciem 45° i otworem zachowuje pełną rozpiętość fazy 3D (18 mm w osi X)', () => {
        const mesh = buildMeshFromPanel({
            width: mmToNm(200),
            height: mmToNm(80),
            thickness: mmToNm(18),
            role: 'PANEL',
            edgeBanding: {
                '+X': { active: true, cutAngle: 45 },
                '-X': { active: false },
                '+Y': { active: false },
                '-Y': { active: false },
            },
            features: [
                {
                    id: 301,
                    type: 'hole',
                    face: 'FACE_X_PLUS',
                    params: { u: 9, v: 40, diameter: 6, depth: 10 }
                }
            ]
        });

        // Wierzchołki ściany FACE_X_PLUS w 3D muszą zachowywać skos 45° (rozpiętość w osi X = 18 mm)
        const pos = mesh.FACE_X_PLUS.positions as number[];
        let minX = Infinity;
        let maxX = -Infinity;
        for (let i = 0; i < pos.length; i += 3) {
            const x = pos[i];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
        }

        const spanX = maxX - minX;
        expect(spanX).toBeGreaterThan(17.9);
        expect(spanX).toBeLessThan(18.5);
    });

    it('otwór na ścianie bocznej zachowuje nominalną pozycję Y i Z niezależnie od kąta fazy', () => {
        const u = 6;
        const v = 30;
        const w = 200;
        const h = 80;
        const t = 18;

        // 1. Bez ucięcia (0°)
        const meshFlat = buildMeshFromPanel({
            width: mmToNm(w),
            height: mmToNm(h),
            thickness: mmToNm(t),
            role: 'PANEL',
            edgeBanding: {
                '+X': { active: false },
                '-X': { active: false },
                '+Y': { active: false },
                '-Y': { active: false },
            },
            features: [
                {
                    id: 401,
                    type: 'hole',
                    face: 'FACE_X_PLUS',
                    params: { u, v, diameter: 8, depth: 4 }
                }
            ]
        });

        // 2. Ze ścięciem 45°
        const meshBevel = buildMeshFromPanel({
            width: mmToNm(w),
            height: mmToNm(h),
            thickness: mmToNm(t),
            role: 'PANEL',
            edgeBanding: {
                '+X': { active: true, cutAngle: 45 },
                '-X': { active: false },
                '+Y': { active: false },
                '-Y': { active: false },
            },
            features: [
                {
                    id: 401,
                    type: 'hole',
                    face: 'FACE_X_PLUS',
                    params: { u, v, diameter: 8, depth: 4 }
                }
            ]
        });

        const edgeFlat = meshFlat.edges.find((e: any) => e.key === 'e_hole_401');
        const edgeBevel = meshBevel.edges.find((e: any) => e.key === 'e_hole_401');
        expect(edgeFlat).toBeDefined();
        expect(edgeBevel).toBeDefined();

        const centerOf = (pts: number[][]) => {
            let sumX = 0, sumY = 0, sumZ = 0;
            const n = pts.length - 1;
            for (let i = 0; i < n; i++) {
                sumX += pts[i][0];
                sumY += pts[i][1];
                sumZ += pts[i][2];
            }
            return [sumX / n, sumY / n, sumZ / n];
        };

        const centerFlat = centerOf(edgeFlat.points);
        const centerBevel = centerOf(edgeBevel.points);

        // Środek na ścianie płaskiej: dokładnie [100, -10, 3]
        expect(centerFlat[0]).toBeCloseTo(100, 2);
        expect(centerFlat[1]).toBeCloseTo(-10, 2);
        expect(centerFlat[2]).toBeCloseTo(3, 2);

        // Środek na ścianie ze ścięciem 45°:
        // Pozycje Y i Z MUSZĄ być bit-identyczne z nominalnymi (-10 i 3)!
        expect(centerBevel[1]).toBeCloseTo(-10, 2);
        expect(centerBevel[2]).toBeCloseTo(3, 2);

        // Pozycja X musi leżeć na skośnej płaszczyźnie 45°: przy z=3 (6 mm poniżej Z+), X = 100 - 6 = 94
        expect(centerBevel[0]).toBeCloseTo(94, 2);
    });
});
