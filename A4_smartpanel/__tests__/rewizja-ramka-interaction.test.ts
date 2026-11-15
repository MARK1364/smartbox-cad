import { describe, it, expect } from 'vitest';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import type { FaceMeshData } from '../native_core/face-mesh.js';

function meshXYArea(mesh: FaceMeshData | undefined): number {
    if (!mesh || !mesh.positions.length || !mesh.indices.length) return 0;
    let total = 0;
    const pos = mesh.positions;
    const idx = mesh.indices;
    for (let i = 0; i < idx.length; i += 3) {
        const i0 = idx[i] * 3;
        const i1 = idx[i + 1] * 3;
        const i2 = idx[i + 2] * 3;
        const x0 = pos[i0], y0 = pos[i0 + 1];
        const x1 = pos[i1], y1 = pos[i1 + 1];
        const x2 = pos[i2], y2 = pos[i2 + 1];
        total += Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) * 0.5;
    }
    return total;
}

function anyTriangleCentroidInBox(
    mesh: FaceMeshData | undefined,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
): boolean {
    if (!mesh || !mesh.positions.length || !mesh.indices.length) return false;
    const pos = mesh.positions;
    const idx = mesh.indices;
    for (let i = 0; i < idx.length; i += 3) {
        const i0 = idx[i] * 3;
        const i1 = idx[i + 1] * 3;
        const i2 = idx[i + 2] * 3;
        const cx = (pos[i0] + pos[i1] + pos[i2]) / 3;
        const cy = (pos[i0 + 1] + pos[i1 + 1] + pos[i2 + 1]) / 3;
        if (cx > minX && cx < maxX && cy > minY && cy < maxY) {
            return true;
        }
    }
    return false;
}

function countInvertedZTriangles(mesh: FaceMeshData | undefined, expectedZSign: 1 | -1): number {
    if (!mesh || !mesh.positions.length || !mesh.indices.length) return 0;
    let inverted = 0;
    const pos = mesh.positions;
    const idx = mesh.indices;
    for (let i = 0; i < idx.length; i += 3) {
        const i0 = idx[i] * 3;
        const i1 = idx[i + 1] * 3;
        const i2 = idx[i + 2] * 3;
        const ux = pos[i1] - pos[i0], uy = pos[i1 + 1] - pos[i0 + 1];
        const vx = pos[i2] - pos[i0], vy = pos[i2 + 1] - pos[i0 + 1];
        const nz = ux * vy - uy * vx;
        if (nz * expectedZSign <= 0) inverted++;
    }
    return inverted;
}

describe('Rewizja (cutout) + Ramka (pocket) interaction', () => {
    const W = 500;
    const H = 800;
    const T = 18;
    const halfW = W / 2;
    const halfH = H / 2;

    it('Case 1: wewnętrzna rewizja wewnątrz ramki na tej samej ścianie (FACE_Z_PLUS)', () => {
        const panelData = {
            role: 'SIDE_PANEL',
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            features: [
                {
                    id: 'feat_rewizja',
                    type: 'cutout',
                    name: 'Rewizja',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 100, v: 80, width: 120, length: 80, depth: T, through: true,
                        u_nm: mmToNm(100), v_nm: mmToNm(80), width_nm: mmToNm(120), length_nm: mmToNm(80), depth_nm: mmToNm(T)
                    }
                },
                {
                    id: 'feat_ramka',
                    type: 'pocket',
                    name: 'Ramka',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 60, v: 60, width: W - 120, length: H - 120, depth: 3, through: false,
                        u_nm: mmToNm(60), v_nm: mmToNm(60), width_nm: mmToNm(W - 120), length_nm: mmToNm(H - 120), depth_nm: mmToNm(3)
                    }
                }
            ]
        };

        const mesh = buildMeshFromPanel(panelData) as any;
        const facePlus = mesh.FACE_Z_PLUS;
        const faceMinus = mesh.FACE_Z_MINUS;
        const ramkaBottom = mesh.feature_feat_ramka_bottom;

        // Lico FACE_Z_PLUS: W*H - ramka = 400000 - 380*680 = 141600
        expect(meshXYArea(facePlus)).toBeCloseTo(141600, 0);
        expect(anyTriangleCentroidInBox(facePlus, 60 - halfW + 1, W - 60 - halfW - 1, 60 - halfH + 1, H - 60 - halfH - 1)).toBe(false);

        // Dno ramki: ramka - rewizja = 258400 - 9600 = 248800
        expect(meshXYArea(ramkaBottom)).toBeCloseTo(248800, 0);
        expect(anyTriangleCentroidInBox(ramkaBottom, 100 - halfW + 1, 220 - halfW - 1, 80 - halfH + 1, 160 - halfH - 1)).toBe(false);

        // Lico przeciwne FACE_Z_MINUS: W*H - rewizja = 400000 - 9600 = 390400
        expect(meshXYArea(faceMinus)).toBeCloseTo(390400, 0);
        expect(countInvertedZTriangles(facePlus, 1)).toBe(0);
        expect(countInvertedZTriangles(faceMinus, -1)).toBe(0);
        expect(countInvertedZTriangles(ramkaBottom, 1)).toBe(0);
    });

    it('Case 2: brzegowa rewizja kolidująca z ramką na tej samej ścianie (FACE_Z_PLUS)', () => {
        const panelData = {
            role: 'SIDE_PANEL',
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            features: [
                {
                    id: 'feat_rewizja_edge',
                    type: 'cutout',
                    name: 'Rewizja brzegowa',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 0, v: 80, width: 120, length: 80, depth: T, through: true,
                        u_nm: mmToNm(0), v_nm: mmToNm(80), width_nm: mmToNm(120), length_nm: mmToNm(80), depth_nm: mmToNm(T)
                    }
                },
                {
                    id: 'feat_ramka',
                    type: 'pocket',
                    name: 'Ramka',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 60, v: 60, width: W - 120, length: H - 120, depth: 3, through: false,
                        u_nm: mmToNm(60), v_nm: mmToNm(60), width_nm: mmToNm(W - 120), length_nm: mmToNm(H - 120), depth_nm: mmToNm(3)
                    }
                }
            ]
        };

        const mesh = buildMeshFromPanel(panelData) as any;
        const facePlus = mesh.FACE_Z_PLUS;
        const ramkaBottom = mesh.feature_feat_ramka_bottom;

        // Lico FACE_Z_PLUS: W*H - (ramka U rewizja) = 400000 - (258400 + 9600 - 4800) = 136800
        expect(meshXYArea(facePlus)).toBeCloseTo(136800, 0);
        expect(anyTriangleCentroidInBox(facePlus, 60 - halfW + 1, W - 60 - halfW - 1, 60 - halfH + 1, H - 60 - halfH - 1)).toBe(false);
        expect(anyTriangleCentroidInBox(facePlus, 0 - halfW + 1, 120 - halfW - 1, 80 - halfH + 1, 160 - halfH - 1)).toBe(false);

        // Dno ramki: ramka - (60..120 x 80..160) = 258400 - 4800 = 253600
        expect(meshXYArea(ramkaBottom)).toBeCloseTo(253600, 0);
        expect(anyTriangleCentroidInBox(ramkaBottom, 60 - halfW + 1, 120 - halfW - 1, 80 - halfH + 1, 160 - halfH - 1)).toBe(false);
        expect(countInvertedZTriangles(facePlus, 1)).toBe(0);
        expect(countInvertedZTriangles(ramkaBottom, 1)).toBe(0);
    });

    it('Case 3: rewizja na FACE_Z_MINUS oraz ramka na FACE_Z_PLUS', () => {
        const panelData = {
            role: 'SIDE_PANEL',
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            features: [
                {
                    id: 'feat_rewizja_opp',
                    type: 'cutout',
                    name: 'Rewizja przeciwna',
                    face: 'FACE_Z_MINUS',
                    params: {
                        u: 100, v: 80, width: 120, length: 80, depth: T, through: true,
                        u_nm: mmToNm(100), v_nm: mmToNm(80), width_nm: mmToNm(120), length_nm: mmToNm(80), depth_nm: mmToNm(T)
                    }
                },
                {
                    id: 'feat_ramka',
                    type: 'pocket',
                    name: 'Ramka',
                    face: 'FACE_Z_PLUS',
                    params: {
                        u: 60, v: 60, width: W - 120, length: H - 120, depth: 3, through: false,
                        u_nm: mmToNm(60), v_nm: mmToNm(60), width_nm: mmToNm(W - 120), length_nm: mmToNm(H - 120), depth_nm: mmToNm(3)
                    }
                }
            ]
        };

        const mesh = buildMeshFromPanel(panelData) as any;
        const facePlus = mesh.FACE_Z_PLUS;
        const faceMinus = mesh.FACE_Z_MINUS;
        const ramkaBottom = mesh.feature_feat_ramka_bottom;

        expect(meshXYArea(facePlus)).toBeCloseTo(141600, 0);
        expect(anyTriangleCentroidInBox(facePlus, 60 - halfW + 1, W - 60 - halfW - 1, 60 - halfH + 1, H - 60 - halfH - 1)).toBe(false);
        expect(meshXYArea(ramkaBottom)).toBeCloseTo(248800, 0);
        // rewizja na FACE_Z_MINUS przy u=100..220 leży w 3D przy X = (W - 220 - halfW)..(W - 100 - halfW)
        expect(anyTriangleCentroidInBox(ramkaBottom, W - 220 - halfW + 1, W - 100 - halfW - 1, 80 - halfH + 1, 160 - halfH - 1)).toBe(false);
        expect(meshXYArea(faceMinus)).toBeCloseTo(390400, 0);
        expect(countInvertedZTriangles(facePlus, 1)).toBe(0);
        expect(countInvertedZTriangles(faceMinus, -1)).toBe(0);
        expect(countInvertedZTriangles(ramkaBottom, 1)).toBe(0);
    });

    it('Case 4: Bok korpusu (backGroove na FACE_Z_PLUS + rewizja i ramka na FACE_Z_MINUS)', () => {
        const panelData = {
            role: 'SIDE_PANEL',
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            features: [
                {
                    id: 'feat_back_groove',
                    type: 'groove',
                    name: 'Wpust',
                    face: 'FACE_Z_PLUS',
                    params: { u: 13, v: 7, width: 3, length: H - 14, depth: 11 }
                },
                {
                    id: 'feat_rewizja',
                    type: 'cutout',
                    name: 'Rewizja',
                    face: 'FACE_Z_MINUS',
                    params: { u: 100, v: 80, width: 120, length: 80, depth: T, through: true }
                },
                {
                    id: 'feat_ramka',
                    type: 'pocket',
                    name: 'Ramka',
                    face: 'FACE_Z_MINUS',
                    params: { u: 60, v: 60, width: W - 120, length: H - 120, depth: 3, through: false }
                }
            ]
        };

        const mesh = buildMeshFromPanel(panelData) as any;
        const facePlus = mesh.FACE_Z_PLUS;
        const faceMinus = mesh.FACE_Z_MINUS;
        const ramkaBottom = mesh.feature_feat_ramka_bottom;

        // FACE_Z_MINUS: W*H - ramka = 400000 - 258400 = 141600
        expect(meshXYArea(faceMinus)).toBeCloseTo(141600, 0);
        // FACE_Z_PLUS: W*H - backGroove(3*786=2358) - rewizja(9600) = 388042
        expect(meshXYArea(facePlus)).toBeCloseTo(400000 - 3 * (H - 14) - 9600, 0);
        // Dno ramki: 258400 - 9600 = 248800
        expect(meshXYArea(ramkaBottom)).toBeCloseTo(248800, 0);
        expect(countInvertedZTriangles(facePlus, 1)).toBe(0);
        expect(countInvertedZTriangles(faceMinus, -1)).toBe(0);
        expect(countInvertedZTriangles(ramkaBottom, -1)).toBe(0);
    });

    it('Case 5: brzegowa rewizja + ramka na FACE_Z_MINUS', () => {
        const panelData = {
            role: 'SIDE_PANEL',
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            features: [
                {
                    id: 'feat_rewizja_edge',
                    type: 'cutout',
                    name: 'Rewizja brzegowa',
                    face: 'FACE_Z_MINUS',
                    params: { u: 0, v: 80, width: 120, length: 80, depth: T, through: true }
                },
                {
                    id: 'feat_ramka',
                    type: 'pocket',
                    name: 'Ramka',
                    face: 'FACE_Z_MINUS',
                    params: { u: 60, v: 60, width: W - 120, length: H - 120, depth: 3, through: false }
                }
            ]
        };

        const mesh = buildMeshFromPanel(panelData) as any;
        const facePlus = mesh.FACE_Z_PLUS;
        const faceMinus = mesh.FACE_Z_MINUS;
        const ramkaBottom = mesh.feature_feat_ramka_bottom;

        expect(meshXYArea(faceMinus)).toBeCloseTo(136800, 0);
        expect(meshXYArea(facePlus)).toBeCloseTo(400000 - 9600, 0);
        expect(meshXYArea(ramkaBottom)).toBeCloseTo(253600, 0);
        expect(countInvertedZTriangles(facePlus, 1)).toBe(0);
        expect(countInvertedZTriangles(faceMinus, -1)).toBe(0);
        expect(countInvertedZTriangles(ramkaBottom, -1)).toBe(0);
    });

    it('Case 6: rewizja przekraczająca krawędź ramki (v=20..160) na FACE_Z_MINUS', () => {
        const panelData = {
            role: 'SIDE_PANEL',
            width: mmToNm(W),
            height: mmToNm(H),
            thickness: mmToNm(T),
            features: [
                {
                    id: 'feat_rewizja_cross',
                    type: 'cutout',
                    name: 'Rewizja przecinająca',
                    face: 'FACE_Z_MINUS',
                    params: { u: 100, v: 20, width: 120, length: 140, depth: T, through: true }
                },
                {
                    id: 'feat_ramka',
                    type: 'pocket',
                    name: 'Ramka',
                    face: 'FACE_Z_MINUS',
                    params: { u: 60, v: 60, width: W - 120, length: H - 120, depth: 3, through: false }
                }
            ]
        };

        const mesh = buildMeshFromPanel(panelData) as any;
        const facePlus = mesh.FACE_Z_PLUS;
        const faceMinus = mesh.FACE_Z_MINUS;
        const ramkaBottom = mesh.feature_feat_ramka_bottom;

        // rewizja = 120*140 = 16800; część poza ramką (v=20..60) = 120*40 = 4800; część w ramce (v=60..160) = 120*100 = 12000
        expect(meshXYArea(faceMinus)).toBeCloseTo(400000 - 258400 - 4800, 0);
        expect(meshXYArea(facePlus)).toBeCloseTo(400000 - 16800, 0);
        expect(meshXYArea(ramkaBottom)).toBeCloseTo(258400 - 12000, 0);
        expect(countInvertedZTriangles(facePlus, 1)).toBe(0);
        expect(countInvertedZTriangles(faceMinus, -1)).toBe(0);
        expect(countInvertedZTriangles(ramkaBottom, -1)).toBe(0);
    });

    it('Case 7: ścianki rewizji w ramce mają 15 mm (3..18), poza ramką 18 mm; krawędzie ramki znikają w rewizji', () => {
        const mkParams = (u: number, v: number, w: number, l: number, depth: number, through: boolean) => ({
            u, v, width: w, length: l, depth, through,
            u_nm: mmToNm(u), v_nm: mmToNm(v), width_nm: mmToNm(w), length_nm: mmToNm(l), depth_nm: mmToNm(depth)
        });
        const base = {
            role: 'SIDE_PANEL', width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T)
        };
        const zRange = (m: FaceMeshData | undefined) => {
            const zs: number[] = [];
            for (let i = 2; i < (m?.positions.length ?? 0); i += 3) zs.push(m!.positions[i]);
            return [Math.min(...zs), Math.max(...zs)];
        };

        // A) rewizja w całości w ramce: ścianki 3..18 mm → z = -9 .. +6
        const inside = buildMeshFromPanel({
            ...base,
            features: [
                { id: 'feat_rewizja', type: 'cutout', face: 'FACE_Z_PLUS', params: mkParams(100, 80, 120, 80, T, true) },
                { id: 'feat_ramka', type: 'pocket', face: 'FACE_Z_PLUS', params: mkParams(60, 60, W - 120, H - 120, 3, false) }
            ]
        } as any) as any;
        for (const k of ['w0', 'w1', 'w2', 'w3']) {
            const [zMin, zMax] = zRange(inside[`feature_feat_rewizja_${k}`]);
            expect(zMin).toBeCloseTo(-9, 3);
            expect(zMax).toBeCloseTo(6, 3);
        }

        // B) rewizja przecina krawędź ramki (v=20..160): ścianka u=100 ma część 18 mm (v 20..60) i 15 mm (v 60..160)
        const cross = buildMeshFromPanel({
            ...base,
            features: [
                { id: 'feat_rewizja', type: 'cutout', face: 'FACE_Z_PLUS', params: mkParams(100, 20, 120, 140, T, true) },
                { id: 'feat_ramka', type: 'pocket', face: 'FACE_Z_PLUS', params: mkParams(60, 60, W - 120, H - 120, 3, false) }
            ]
        } as any) as any;
        const tops = new Set<number>();
        const w3 = cross.feature_feat_rewizja_w3 as FaceMeshData;
        for (let i = 2; i < w3.positions.length; i += 3) tops.add(Math.round(w3.positions[i] * 1000) / 1000);
        expect([...tops].sort((a, b) => a - b)).toEqual([-9, 6, 9]);

        // Krawędzie ramki nie mogą wchodzić w światło rewizji (u 100..220, v 20..160 → x -150..-30, y -380..-240)
        const edges = (cross.edges || []) as Array<{ key: string; points: number[][] }>;
        const ramkaEdgesInHole = edges.filter(e => e.key.startsWith('e_groove_feat_ramka_') && e.points.length >= 2).filter(e => {
            const mx = (e.points[0][0] + e.points[1][0]) / 2;
            const my = (e.points[0][1] + e.points[1][1]) / 2;
            return mx > -149 && mx < -31 && my > -379 && my < -241 + 100;
        });
        expect(ramkaEdgesInHole.length).toBe(0);
    });
});
