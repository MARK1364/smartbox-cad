/**
 * PMI Measure (miarka) — czysta matematyka.
 *
 * Odpowiednik narzędzia `4.Pomiar` z `@@BLENDER/A8_pmi/pmi_core.py`:
 * odcinek między dwoma punktami bez linii wymiarowej CAD.
 * Długość zawsze; składowe dX/dY/dZ tylko gdy pomiar nie leży na jednej osi CAD.
 */

import { Vec3, v3, v3Add, v3Copy, v3Dot, v3Len, v3LenSq, v3Scale, v3Sub } from './dimension-solver';

/** Poniżej tej wartości składowa jest traktowana jako zero [mm]. */
export const MEASURE_DELTA_EPS = 0.5;

export type MeasureElementKind = 'point' | 'vertex' | 'edge' | 'plane';

export interface MeasureDeltas {
    length: number;
    dX: number;
    dY: number;
    dZ: number;
}

export interface MeasureDeltaSegment {
    axis: 'X' | 'Y' | 'Z';
    a: Vec3;
    b: Vec3;
}

export interface MeasureElement {
    kind: MeasureElementKind;
    worldPos: Vec3;
    edgeA?: Vec3 | null;
    edgeB?: Vec3 | null;
    planeOrigin?: Vec3 | null;
    planeNormal?: Vec3 | null;
}

/**
 * Delty w osiach CAD (X szerokość, Y głębokość, Z wysokość).
 * Wejście jest w przestrzeni Babylon (Y-up).
 */
export function cadDeltasFromRender(p1: Vec3, p2: Vec3): MeasureDeltas {
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.z - p1.z);
    const dz = Math.abs(p2.y - p1.y);
    return { length: v3Len(v3Sub(p2, p1)), dX: dx, dY: dy, dZ: dz };
}

export function significantDeltaAxes(deltas: MeasureDeltas, eps = MEASURE_DELTA_EPS): Array<'X' | 'Y' | 'Z'> {
    const axes: Array<'X' | 'Y' | 'Z'> = [];
    if (deltas.dX > eps) axes.push('X');
    if (deltas.dY > eps) axes.push('Y');
    if (deltas.dZ > eps) axes.push('Z');
    return axes;
}

/**
 * Delty pokazujemy tylko gdy pomiar ma składowe na więcej niż jednej osi.
 * Pomiar wzdłuż jednej osi to po prostu L.
 */
export function shouldShowDeltas(deltas: MeasureDeltas, eps = MEASURE_DELTA_EPS): boolean {
    return significantDeltaAxes(deltas, eps).length >= 2;
}

/**
 * Schodki XYZ w przestrzeni Babylon (jak w Blenderze: X, potem Y, potem Z CAD).
 * CAD X = Babylon X, CAD Y = Babylon Z, CAD Z = Babylon Y.
 */
export function measureDeltaSegments(p1: Vec3, p2: Vec3, eps = MEASURE_DELTA_EPS): MeasureDeltaSegment[] {
    const pDx = v3(p2.x, p1.y, p1.z);
    const pDy = v3(p2.x, p1.y, p2.z);
    const candidates: MeasureDeltaSegment[] = [
        { axis: 'X', a: p1, b: pDx },
        { axis: 'Y', a: pDx, b: pDy },
        { axis: 'Z', a: pDy, b: p2 },
    ];
    return candidates.filter(seg => v3Len(v3Sub(seg.b, seg.a)) > eps);
}

export function closestPointOnSegment(p: Vec3, a: Vec3, b: Vec3): Vec3 {
    const ab = v3Sub(b, a);
    const lenSq = v3LenSq(ab);
    if (lenSq < 1e-12) return v3Copy(a);
    const t = Math.max(0, Math.min(1, v3Dot(v3Sub(p, a), ab) / lenSq));
    return v3Add(a, v3Scale(ab, t));
}

export function projectPointOnPlane(p: Vec3, origin: Vec3, normal: Vec3): Vec3 {
    const nLen = v3Len(normal);
    if (nLen < 1e-9) return v3Copy(p);
    const n = v3Scale(normal, 1 / nLen);
    return v3Sub(p, v3Scale(n, v3Dot(v3Sub(p, origin), n)));
}

/** Najbliższe punkty dwóch odcinków (dla pomiaru krawędź–krawędź). */
export function closestPointsOnSegments(
    a1: Vec3,
    a2: Vec3,
    b1: Vec3,
    b2: Vec3,
): { pa: Vec3; pb: Vec3 } {
    const d1 = v3Sub(a2, a1);
    const d2 = v3Sub(b2, b1);
    const r = v3Sub(a1, b1);
    const a = v3Dot(d1, d1);
    const e = v3Dot(d2, d2);
    const f = v3Dot(d2, r);

    let s = 0;
    let t = 0;

    if (a <= 1e-12 && e <= 1e-12) {
        return { pa: v3Copy(a1), pb: v3Copy(b1) };
    }
    if (a <= 1e-12) {
        t = Math.max(0, Math.min(1, f / e));
    } else {
        const c = v3Dot(d1, r);
        if (e <= 1e-12) {
            s = Math.max(0, Math.min(1, -c / a));
        } else {
            const b = v3Dot(d1, d2);
            const denom = a * e - b * b;
            if (Math.abs(denom) > 1e-12) {
                s = Math.max(0, Math.min(1, (b * f - c * e) / denom));
            }
            t = (b * s + f) / e;
            if (t < 0) {
                t = 0;
                s = Math.max(0, Math.min(1, -c / a));
            } else if (t > 1) {
                t = 1;
                s = Math.max(0, Math.min(1, (b - c) / a));
            }
        }
    }

    return {
        pa: v3Add(a1, v3Scale(d1, s)),
        pb: v3Add(b1, v3Scale(d2, t)),
    };
}

function isVertexLike(kind: MeasureElementKind): boolean {
    return kind === 'vertex' || kind === 'point';
}

/** Promień uznania wspólnego narożnika połączonych krawędzi [mm]. */
export const EDGE_VERTEX_EPS = 1.0;

export interface TwoEdgeMeasureResult {
    mode: 'chain' | 'distance';
    path: Vec3[];
    length: number;
    junction: Vec3 | null;
}

export function verticesCoincide(a: Vec3, b: Vec3, eps = EDGE_VERTEX_EPS): boolean {
    return v3Len(v3Sub(a, b)) <= eps;
}

/**
 * Dwie krawędzie mają wspólny koniec → łańcuch A–B–C i suma długości obu odcinków.
 */
export function connectedEdgeChain(
    e1a: Vec3,
    e1b: Vec3,
    e2a: Vec3,
    e2b: Vec3,
    eps = EDGE_VERTEX_EPS,
): { path: Vec3[]; length: number; junction: Vec3 } | null {
    const tries: Array<[Vec3, Vec3, Vec3, Vec3]> = [
        [e1a, e2a, e1b, e2b],
        [e1a, e2b, e1b, e2a],
        [e1b, e2a, e1a, e2b],
        [e1b, e2b, e1a, e2a],
    ];

    for (const [j1, j2, end1, end2] of tries) {
        if (!verticesCoincide(j1, j2, eps)) continue;
        const junction = v3Scale(v3Add(j1, j2), 0.5);
        const length = v3Len(v3Sub(e1a, e1b)) + v3Len(v3Sub(e2a, e2b));
        return { path: [end1, junction, end2], length, junction };
    }
    return null;
}

/** Ctrl + dwie krawędzie: suma połączonych albo najkrótszy dystans między odcinkami. */
export function measureTwoEdges(
    e1a: Vec3,
    e1b: Vec3,
    e2a: Vec3,
    e2b: Vec3,
): TwoEdgeMeasureResult {
    const chain = connectedEdgeChain(e1a, e1b, e2a, e2b);
    if (chain) {
        return { mode: 'chain', path: chain.path, length: chain.length, junction: chain.junction };
    }
    const { pa, pb } = closestPointsOnSegments(e1a, e1b, e2a, e2b);
    return {
        mode: 'distance',
        path: [pa, pb],
        length: v3Len(v3Sub(pb, pa)),
        junction: null,
    };
}

export function pathLength(path: Vec3[]): number {
    let total = 0;
    for (let i = 0; i + 1 < path.length; i++) {
        total += v3Len(v3Sub(path[i + 1], path[i]));
    }
    return total;
}

/** Długość miarki po ścieżce kotwic (z opcjonalnym punktem pośrednim łańcucha). */
export function measurementPathLength(p1: Vec3, p2: Vec3, via: Vec3 | null = null): number {
    return pathLength(via ? [p1, via, p2] : [p1, p2]);
}


/**
 * Najkrótsza droga między dwoma elementami — jak w Blenderze przy Ctrl.
 * Zwraca nowe pozycje końców odcinka pomiaru.
 */
export function projectMeasureElements(
    first: MeasureElement,
    second: MeasureElement,
): { p1: Vec3; p2: Vec3 } {
    let p1 = v3Copy(first.worldPos);
    let p2 = v3Copy(second.worldPos);

    const e1 = first.kind === 'edge' && first.edgeA && first.edgeB;
    const e2 = second.kind === 'edge' && second.edgeA && second.edgeB;
    const pl1 = first.kind === 'plane' && first.planeOrigin && first.planeNormal;
    const pl2 = second.kind === 'plane' && second.planeOrigin && second.planeNormal;

    if (isVertexLike(first.kind) && e2) {
        p2 = closestPointOnSegment(p1, second.edgeA!, second.edgeB!);
    } else if (e1 && isVertexLike(second.kind)) {
        p1 = closestPointOnSegment(p2, first.edgeA!, first.edgeB!);
    } else if (e1 && e2) {
        const closest = closestPointsOnSegments(first.edgeA!, first.edgeB!, second.edgeA!, second.edgeB!);
        p1 = closest.pa;
        p2 = closest.pb;
    } else if (pl1 && pl2) {
        const closest = closestPointsOnPlanes(
            first.planeOrigin!, first.planeNormal!,
            second.planeOrigin!, second.planeNormal!,
            first.worldPos, second.worldPos,
        );
        p1 = closest.p1;
        p2 = closest.p2;
    } else if (pl1 && isVertexLike(second.kind)) {
        p1 = projectPointOnPlane(p2, first.planeOrigin!, first.planeNormal!);
    } else if (isVertexLike(first.kind) && pl2) {
        p2 = projectPointOnPlane(p1, second.planeOrigin!, second.planeNormal!);
    } else if (pl1 && e2) {
        const closest = closestPointsOnSegmentAndPlane(
            second.edgeA!, second.edgeB!,
            first.planeOrigin!, first.planeNormal!,
        );
        p1 = closest.onPlane;
        p2 = closest.onSegment;
    } else if (e1 && pl2) {
        const closest = closestPointsOnSegmentAndPlane(
            first.edgeA!, first.edgeB!,
            second.planeOrigin!, second.planeNormal!,
        );
        p1 = closest.onSegment;
        p2 = closest.onPlane;
    }

    return { p1, p2 };
}

/** Najkrótszy odcinek między dwoma płaszczyznami (równoległe: wzdłuż normalnej). */
export function closestPointsOnPlanes(
    origin1: Vec3,
    normal1: Vec3,
    origin2: Vec3,
    normal2: Vec3,
    hint1: Vec3,
    hint2: Vec3,
): { p1: Vec3; p2: Vec3 } {
    const n1 = v3Len(normal1) > 1e-9 ? v3Scale(normal1, 1 / v3Len(normal1)) : v3(0, 1, 0);
    const n2 = v3Len(normal2) > 1e-9 ? v3Scale(normal2, 1 / v3Len(normal2)) : v3(0, 1, 0);
    const parallel = Math.abs(v3Dot(n1, n2)) > 0.995;
    if (parallel) {
        const p1 = projectPointOnPlane(hint1, origin1, n1);
        const p2 = projectPointOnPlane(p1, origin2, n2);
        return { p1, p2: projectPointOnPlane(p2, origin2, n2) };
    }
    const p1 = projectPointOnPlane(hint1, origin1, n1);
    const p2 = projectPointOnPlane(p1, origin2, n2);
    if (v3Len(v3Sub(p2, p1)) < 1e-6) {
        return { p1: projectPointOnPlane(hint2, origin1, n1), p2: projectPointOnPlane(hint2, origin2, n2) };
    }
    return { p1, p2 };
}

/** Najkrótsza droga odcinek–płaszczyzna. */
export function closestPointsOnSegmentAndPlane(
    a: Vec3,
    b: Vec3,
    origin: Vec3,
    normal: Vec3,
): { onSegment: Vec3; onPlane: Vec3 } {
    const nLen = v3Len(normal);
    const n = nLen > 1e-9 ? v3Scale(normal, 1 / nLen) : v3(0, 1, 0);
    const signed = (p: Vec3) => v3Dot(v3Sub(p, origin), n);
    const sa = signed(a);
    const sb = signed(b);
    if (sa * sb < 0 && Math.abs(sa - sb) > 1e-12) {
        const t = sa / (sa - sb);
        const onSegment = v3Add(a, v3Scale(v3Sub(b, a), t));
        return { onSegment, onPlane: v3Copy(onSegment) };
    }
    if (Math.abs(sa) <= Math.abs(sb)) {
        return { onSegment: v3Copy(a), onPlane: projectPointOnPlane(a, origin, n) };
    }
    return { onSegment: v3Copy(b), onPlane: projectPointOnPlane(b, origin, n) };
}
