import type { BrepEdgeData } from './polygon-extrusion.js';

/** Krawędź B-rep cechy (stabilny klucz `e_hole_*` / `e_groove_*` + polilinia 3D w mm). */
export type CadEdge = { key: string; points: number[][] };

export interface PlanarTriangle3D {
    a: [number, number, number];
    b: [number, number, number];
    c: [number, number, number];
    normal: [number, number, number];
    planeD: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
}

const PLANE_DIST_TOL = 0.03;
const NORMAL_COS_TOL = 0.9995; // ~1.8 stopnia
const SLICE_OFFSET_MM = 0.02;
const INTERVAL_MERGE_TOL = 0.05;
const MIN_EDGE_LEN_MM = 0.05;

function dot3(a: readonly number[], b: readonly number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: readonly number[], b: readonly number[]): [number, number, number] {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

/**
 * Wyciąga wszystkie trójkąty ścian płaskich z topologii B-rep formatki.
 */
export function extractPlanarTriangles(topology: Record<string, any>): PlanarTriangle3D[] {
    const triangles: PlanarTriangle3D[] = [];

    for (const [key, val] of Object.entries(topology)) {
        if (key === 'edges' || key === 'vertices') continue;
        if (!val || !Array.isArray(val.positions) || !Array.isArray(val.indices)) continue;
        const pos: number[] = val.positions;
        const ind: number[] = val.indices;
        if (ind.length < 3 || pos.length < 9) continue;

        for (let i = 0; i <= ind.length - 3; i += 3) {
            const i0 = ind[i] * 3;
            const i1 = ind[i + 1] * 3;
            const i2 = ind[i + 2] * 3;
            if (i0 + 2 >= pos.length || i1 + 2 >= pos.length || i2 + 2 >= pos.length) continue;

            const ax = pos[i0], ay = pos[i0 + 1], az = pos[i0 + 2];
            const bx = pos[i1], by = pos[i1 + 1], bz = pos[i1 + 2];
            const cx = pos[i2], cy = pos[i2 + 1], cz = pos[i2 + 2];

            const ux = bx - ax, uy = by - ay, uz = bz - az;
            const vx = cx - ax, vy = cy - ay, vz = cz - az;
            const nx = uy * vz - uz * vy;
            const ny = uz * vx - ux * vz;
            const nz = ux * vy - uy * vx;
            const len = Math.hypot(nx, ny, nz);
            if (len < 1e-6) continue;

            const normal: [number, number, number] = [nx / len, ny / len, nz / len];
            const planeD = normal[0] * ax + normal[1] * ay + normal[2] * az;

            triangles.push({
                a: [ax, ay, az],
                b: [bx, by, bz],
                c: [cx, cy, cz],
                normal,
                planeD,
                minX: Math.min(ax, bx, cx),
                maxX: Math.max(ax, bx, cx),
                minY: Math.min(ay, by, cy),
                maxY: Math.max(ay, by, cy),
                minZ: Math.min(az, bz, cz),
                maxZ: Math.max(az, bz, cz)
            });
        }
    }

    return triangles;
}

function intersectTriangleAtW(
    s0: number, w0: number,
    s1: number, w1: number,
    s2: number, w2: number,
    targetW: number
): [number, number] | null {
    const ptsS: number[] = [];
    const verts: Array<[number, number]> = [[s0, w0], [s1, w1], [s2, w2]];

    for (let i = 0; i < 3; i++) {
        const [sa, wa] = verts[i];
        const [sb, wb] = verts[(i + 1) % 3];
        const da = wa - targetW;
        const db = wb - targetW;

        if (Math.abs(da) <= 1e-6 && Math.abs(db) <= 1e-6) {
            ptsS.push(sa, sb);
        } else if ((da <= 1e-6 && db >= -1e-6) || (da >= -1e-6 && db <= 1e-6)) {
            const denom = wb - wa;
            if (Math.abs(denom) > 1e-6) {
                const t = Math.max(0, Math.min(1, (targetW - wa) / denom));
                ptsS.push(sa + t * (sb - sa));
            } else {
                ptsS.push(sa);
            }
        }
    }

    if (ptsS.length < 2) return null;
    const minS = Math.min(...ptsS);
    const maxS = Math.max(...ptsS);
    if (maxS - minS <= 1e-3) return null;
    return [minS, maxS];
}

function mergeIntervals(intervals: Array<[number, number]>, tol = INTERVAL_MERGE_TOL): Array<[number, number]> {
    if (intervals.length <= 1) return intervals.map(([a, b]) => [a, b]);
    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]];

    for (let i = 1; i < sorted.length; i++) {
        const [curA, curB] = sorted[i];
        const last = merged[merged.length - 1];
        if (curA <= last[1] + tol) {
            last[1] = Math.max(last[1], curB);
        } else {
            merged.push([curA, curB]);
        }
    }
    return merged;
}

function intersectIntervalLists(
    listA: Array<[number, number]>,
    listB: Array<[number, number]>,
    minLen = MIN_EDGE_LEN_MM
): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (const [a0, a1] of listA) {
        for (const [b0, b1] of listB) {
            const start = Math.max(a0, b0);
            const end = Math.min(a1, b1);
            if (end - start > minLen) {
                out.push([start, end]);
            }
        }
    }
    return mergeIntervals(out);
}

function subtractIntervals(
    base: Array<[number, number]>,
    cuts: Array<[number, number]>,
    minLen = MIN_EDGE_LEN_MM
): Array<[number, number]> {
    let current = base.map(([a, b]) => [a, b] as [number, number]);
    for (const [c0, c1] of cuts) {
        const next: Array<[number, number]> = [];
        for (const [s0, s1] of current) {
            if (c1 <= s0 + minLen || c0 >= s1 - minLen) {
                next.push([s0, s1]);
                continue;
            }
            if (c0 - s0 > minLen) {
                next.push([s0, c0]);
            }
            if (s1 - c1 > minLen) {
                next.push([c1, s1]);
            }
        }
        current = next;
    }
    return current.filter(([s0, s1]) => s1 - s0 > minLen);
}

interface NormalGroupIntervals {
    normal: [number, number, number];
    bAxis: [number, number, number];
    plusIntervals: Array<[number, number]>;
    minusIntervals: Array<[number, number]>;
    touchIntervals: Array<[number, number]>;
}

/**
 * Centralny filtr usuwania zbędnych krawędzi współpłaszczyznowych (Co-planar Edge Dissolver,
 * odpowiednik OCCT ShapeUpgrade_UnifySameDomain).
 *
 * Dla każdej prostoliniowej krawędzi B-rep sprawdza trójkąty ścian przylegających do linii krawędzi.
 * Jeśli po obu stronach krawędzi w tej samej płaszczyźnie leżą ściany o tym samym wektorze normalnym
 * (kąt dwuścienny 180°, płaszczyzny zlicowane) i brak ścianki poprzecznej pod innym kątem,
 * współpłaszczyznowy odcinek krawędzi-widmo zostaje rozpuszczony (usunięty lub przycięty).
 */
export function dissolveCoplanarEdges(topology: Record<string, any>): BrepEdgeData[] {
    const rawEdges: BrepEdgeData[] = Array.isArray(topology.edges) ? topology.edges : [];
    if (rawEdges.length === 0) return rawEdges;

    const triangles = extractPlanarTriangles(topology);
    if (triangles.length === 0) return rawEdges;

    const resolvedEdges: BrepEdgeData[] = [];

    for (const edge of rawEdges) {
        if (!edge || !Array.isArray(edge.points) || edge.points.length !== 2) {
            // Krawędzie wielopunktowe (np. okręgi otworów e_hole_*) przechodzą bez zmian
            resolvedEdges.push(edge);
            continue;
        }

        const p0 = edge.points[0];
        const p1 = edge.points[1];
        if (!p0 || !p1 || p0.length < 3 || p1.length < 3) continue;

        const dx = p1[0] - p0[0];
        const dy = p1[1] - p0[1];
        const dz = p1[2] - p0[2];
        const edgeLen = Math.hypot(dx, dy, dz);
        if (edgeLen <= MIN_EDGE_LEN_MM) continue;

        const dir: [number, number, number] = [dx / edgeLen, dy / edgeLen, dz / edgeLen];

        const eMinX = Math.min(p0[0], p1[0]) - PLANE_DIST_TOL;
        const eMaxX = Math.max(p0[0], p1[0]) + PLANE_DIST_TOL;
        const eMinY = Math.min(p0[1], p1[1]) - PLANE_DIST_TOL;
        const eMaxY = Math.max(p0[1], p1[1]) + PLANE_DIST_TOL;
        const eMinZ = Math.min(p0[2], p1[2]) - PLANE_DIST_TOL;
        const eMaxZ = Math.max(p0[2], p1[2]) + PLANE_DIST_TOL;

        const groups: NormalGroupIntervals[] = [];

        for (const tri of triangles) {
            if (
                tri.maxX < eMinX || tri.minX > eMaxX ||
                tri.maxY < eMinY || tri.minY > eMaxY ||
                tri.maxZ < eMinZ || tri.minZ > eMaxZ
            ) {
                continue;
            }

            const dist0 = Math.abs(dot3(p0, tri.normal) - tri.planeD);
            if (dist0 > PLANE_DIST_TOL) continue;
            const dist1 = Math.abs(dot3(p1, tri.normal) - tri.planeD);
            if (dist1 > PLANE_DIST_TOL) continue;

            let group = groups.find(g => dot3(g.normal, tri.normal) >= NORMAL_COS_TOL);
            if (!group) {
                const rawB = cross3(tri.normal, dir);
                const bLen = Math.hypot(rawB[0], rawB[1], rawB[2]);
                if (bLen < 1e-6) continue;
                group = {
                    normal: tri.normal,
                    bAxis: [rawB[0] / bLen, rawB[1] / bLen, rawB[2] / bLen],
                    plusIntervals: [],
                    minusIntervals: [],
                    touchIntervals: []
                };
                groups.push(group);
            }

            const bAxis = group.bAxis;
            const sA = (tri.a[0] - p0[0]) * dir[0] + (tri.a[1] - p0[1]) * dir[1] + (tri.a[2] - p0[2]) * dir[2];
            const wA = (tri.a[0] - p0[0]) * bAxis[0] + (tri.a[1] - p0[1]) * bAxis[1] + (tri.a[2] - p0[2]) * bAxis[2];

            const sB = (tri.b[0] - p0[0]) * dir[0] + (tri.b[1] - p0[1]) * dir[1] + (tri.b[2] - p0[2]) * dir[2];
            const wB = (tri.b[0] - p0[0]) * bAxis[0] + (tri.b[1] - p0[1]) * bAxis[1] + (tri.b[2] - p0[2]) * bAxis[2];

            const sC = (tri.c[0] - p0[0]) * dir[0] + (tri.c[1] - p0[1]) * dir[1] + (tri.c[2] - p0[2]) * dir[2];
            const wC = (tri.c[0] - p0[0]) * bAxis[0] + (tri.c[1] - p0[1]) * bAxis[1] + (tri.c[2] - p0[2]) * bAxis[2];

            const minW = Math.min(wA, wB, wC);
            const maxW = Math.max(wA, wB, wC);
            if (maxW < -SLICE_OFFSET_MM * 2 || minW > SLICE_OFFSET_MM * 2) continue;

            const plusSeg = intersectTriangleAtW(sA, wA, sB, wB, sC, wC, +SLICE_OFFSET_MM);
            if (plusSeg) {
                const c0 = Math.max(0, plusSeg[0]);
                const c1 = Math.min(edgeLen, plusSeg[1]);
                if (c1 - c0 > MIN_EDGE_LEN_MM) {
                    group.plusIntervals.push([c0, c1]);
                    group.touchIntervals.push([c0, c1]);
                }
            }

            const minusSeg = intersectTriangleAtW(sA, wA, sB, wB, sC, wC, -SLICE_OFFSET_MM);
            if (minusSeg) {
                const c0 = Math.max(0, minusSeg[0]);
                const c1 = Math.min(edgeLen, minusSeg[1]);
                if (c1 - c0 > MIN_EDGE_LEN_MM) {
                    group.minusIntervals.push([c0, c1]);
                    group.touchIntervals.push([c0, c1]);
                }
            }
        }

        if (groups.length === 0) {
            resolvedEdges.push(edge);
            continue;
        }

        for (const g of groups) {
            g.plusIntervals = mergeIntervals(g.plusIntervals);
            g.minusIntervals = mergeIntervals(g.minusIntervals);
            g.touchIntervals = mergeIntervals(g.touchIntervals);
        }

        // Wyznacz przedziały współpłaszczyznowego szwu (180° między dwiema ścianami o tej samej normalnej,
        // gdzie brak jakiejkolwiek ściany poprzecznej o innej normalnej)
        const dissolveCuts: Array<[number, number]> = [];
        for (const g of groups) {
            let seam = intersectIntervalLists(g.plusIntervals, g.minusIntervals);
            if (seam.length === 0) continue;

            for (const other of groups) {
                if (other === g) continue;
                if (Math.abs(dot3(g.normal, other.normal)) < NORMAL_COS_TOL) {
                    seam = subtractIntervals(seam, other.touchIntervals);
                    if (seam.length === 0) break;
                }
            }

            dissolveCuts.push(...seam);
        }

        if (dissolveCuts.length === 0) {
            resolvedEdges.push(edge);
            continue;
        }

        const surviving = subtractIntervals([[0, edgeLen]], mergeIntervals(dissolveCuts));
        if (surviving.length === 0) {
            // Cała krawędź leży wewnątrz zlicowanej płaszczyzny (szew 180°) — rozpuszczona
            continue;
        }

        if (
            surviving.length === 1 &&
            surviving[0][0] <= MIN_EDGE_LEN_MM &&
            surviving[0][1] >= edgeLen - MIN_EDGE_LEN_MM
        ) {
            resolvedEdges.push(edge);
            continue;
        }

        for (let idx = 0; idx < surviving.length; idx++) {
            const [s0, s1] = surviving[idx];
            const subP0 = [
                p0[0] + s0 * dir[0],
                p0[1] + s0 * dir[1],
                p0[2] + s0 * dir[2]
            ];
            const subP1 = [
                p0[0] + s1 * dir[0],
                p0[1] + s1 * dir[1],
                p0[2] + s1 * dir[2]
            ];
            resolvedEdges.push({
                ...edge,
                key: surviving.length > 1 ? `${edge.key}_seg${idx}` : edge.key,
                points: [subP0, subP1]
            });
        }
    }

    return resolvedEdges;
}
