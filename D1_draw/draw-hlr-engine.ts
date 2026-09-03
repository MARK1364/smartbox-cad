/**
 * D1_draw - draw-hlr-engine.ts
 * Hidden Line Removal w stylu OpenCASCADE HLRBRep / FreeCAD TechDraw / SolidWorks.
 *
 * Zasada (HLRBRep_Algo):
 * - Każda krawędź jest porównywana z każdą ścianą-zasłoną w rzucie 2D.
 * - Przedział 2D przecięcia jest klasyfikowany wzdłuż PROMIENIA kamery:
 *   głębokość ściany w punkcie (u,v) vs głębokość krawędzi w tym samym (u,v).
 * - Krawędź należąca do ściany nie jest przez nią chowana (brak auto-occlusion).
 * - Ściana zasłania tylko gdy leży ŚCIŚLE bliżej kamery (nie średnia głębokość całej ściany).
 *
 * Głębokość: większa = dalej od kamery. Izometria: kamera z (+X,+Y,+Z), widać przód/górę/bok.
 */

import { DrawProjectionAngle, Draw2DSegment } from './draw-types';
import { ProjectablePart } from './draw-projection';

interface Point3D {
    x: number;
    y: number;
    z: number;
}

interface ProjectedPoint {
    u: number;
    v: number;
    depth: number;
}

interface OccluderFace {
    polygon: Array<{ u: number; v: number }>;
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
    /** depth(u,v) = au + bv + c  (głębokość płaszczyzny w rzucie) */
    a: number;
    b: number;
    c: number;
    partId: string;
    vertIdx: number[];
}

interface ProjectedEdge {
    p1: ProjectedPoint;
    p2: ProjectedPoint;
    i1: number;
    i2: number;
    partId: string;
}

interface Interval {
    start: number;
    end: number;
}

const EDGE_MIN_LEN = 0.1;
const CLIP_MIN_T = 0.002;
const COPLANAR_EPS = 0.75;

export class DrawHLREngine {
    public static computeHLR(
        parts: ProjectablePart[],
        projection: DrawProjectionAngle
    ): {
        segments: Draw2DSegment[];
        widthMm: number;
        heightMm: number;
    } {
        const projectedEdges: ProjectedEdge[] = [];
        const occluderFaces: OccluderFace[] = [];

        for (const part of parts) {
            const vertices = this.getPart3DVertices(part);
            const projVerts = vertices.map((v) => this.project3DPoint(v, projection));
            const partId = part.id || part.name;

            const faceIndices: number[][] = [
                [4, 5, 6, 7],
                [0, 3, 2, 1],
                [0, 4, 7, 3],
                [1, 2, 6, 5],
                [3, 7, 6, 2],
                [0, 1, 5, 4],
            ];

            for (const fIdx of faceIndices) {
                if (!this.isFaceFacingCamera(vertices[fIdx[0]], vertices[fIdx[1]], vertices[fIdx[2]], projection)) {
                    continue;
                }

                let poly = fIdx.map((idx) => ({ u: projVerts[idx].u, v: projVerts[idx].v }));
                const signedArea = this.getPolygonSignedArea(poly);
                if (Math.abs(signedArea) < 0.01) continue;
                if (signedArea < 0) poly = [...poly].reverse();

                const plane = this.fitDepthPlane(fIdx.map((idx) => projVerts[idx]));
                if (!plane) continue;

                const uCoords = poly.map((p) => p.u);
                const vCoords = poly.map((p) => p.v);
                occluderFaces.push({
                    polygon: poly,
                    minU: Math.min(...uCoords),
                    maxU: Math.max(...uCoords),
                    minV: Math.min(...vCoords),
                    maxV: Math.max(...vCoords),
                    a: plane.a,
                    b: plane.b,
                    c: plane.c,
                    partId,
                    vertIdx: fIdx,
                });
            }

            const edgeIndices: Array<[number, number]> = [
                [0, 1], [1, 2], [2, 3], [3, 0],
                [4, 5], [5, 6], [6, 7], [7, 4],
                [0, 4], [1, 5], [2, 6], [3, 7],
            ];

            for (const [i1, i2] of edgeIndices) {
                const p1 = projVerts[i1];
                const p2 = projVerts[i2];
                const len = Math.hypot(p2.u - p1.u, p2.v - p1.v);
                if (len > EDGE_MIN_LEN) {
                    projectedEdges.push({ p1, p2, i1, i2, partId });
                }
            }
        }

        const resultSegments: Draw2DSegment[] = [];
        let segCounter = 0;

        for (const edge of projectedEdges) {
            const occludedIntervals: Interval[] = [];
            const p1 = edge.p1;
            const p2 = edge.p2;

            for (const face of occluderFaces) {
                if (edge.partId === face.partId && face.vertIdx.includes(edge.i1) && face.vertIdx.includes(edge.i2)) {
                    continue;
                }

                const edgeMinU = Math.min(p1.u, p2.u);
                const edgeMaxU = Math.max(p1.u, p2.u);
                const edgeMinV = Math.min(p1.v, p2.v);
                const edgeMaxV = Math.max(p1.v, p2.v);
                if (edgeMaxU < face.minU || edgeMinU > face.maxU || edgeMaxV < face.minV || edgeMinV > face.maxV) {
                    continue;
                }

                const clip = this.clipSegmentWithConvexPolygon(p1, p2, face.polygon);
                if (!clip) continue;

                occludedIntervals.push(...this.hiddenSubIntervals(p1, p2, clip, face));
            }

            const mergedOccluded = this.mergeIntervals(occludedIntervals);
            const visibleIntervals = this.subtractIntervals(mergedOccluded);

            const pushSegment = (range: Interval, hidden: boolean) => {
                if (range.end - range.start <= CLIP_MIN_T) return;
                const x1 = p1.u + range.start * (p2.u - p1.u);
                const y1 = p1.v + range.start * (p2.v - p1.v);
                const x2 = p1.u + range.end * (p2.u - p1.u);
                const y2 = p1.v + range.end * (p2.v - p1.v);
                resultSegments.push({
                    id: hidden ? `hlr_hid_${segCounter++}` : `hlr_vis_${segCounter++}`,
                    x1,
                    y1,
                    x2,
                    y2,
                    isHidden: hidden,
                    strokeColor: hidden ? '#64748b' : '#0f172a',
                    strokeWidth: hidden ? 0.35 : 0.5,
                    dashArray: hidden ? '2,1.5' : undefined,
                });
            };

            for (const vis of visibleIntervals) pushSegment(vis, false);
            for (const hid of mergedOccluded) pushSegment(hid, true);
        }

        const deduped = this.deduplicateSegments(resultSegments);

        if (deduped.length === 0) {
            return { segments: [], widthMm: 800, heightMm: 720 };
        }

        const allX = deduped.flatMap((s) => [s.x1, s.x2]);
        const allY = deduped.flatMap((s) => [s.y1, s.y2]);
        const minX = Math.min(...allX);
        const minY = Math.min(...allY);
        const maxX = Math.max(...allX);
        const maxY = Math.max(...allY);

        for (const s of deduped) {
            s.x1 -= minX;
            s.y1 -= minY;
            s.x2 -= minX;
            s.y2 -= minY;
        }

        return {
            segments: deduped,
            widthMm: Math.max(maxX - minX, 10),
            heightMm: Math.max(maxY - minY, 10),
        };
    }

    /**
     * Wektor od obiektu DO kamery. Głębokość = -dot(camera, p) (większa = dalej).
     */
    private static getCameraVector(projection: DrawProjectionAngle): Point3D {
        switch (projection) {
            case 'FRONT':
                return { x: 0, y: 0, z: 1 };
            case 'BACK':
                return { x: 0, y: 0, z: -1 };
            case 'RIGHT':
                return { x: 1, y: 0, z: 0 };
            case 'LEFT':
                return { x: -1, y: 0, z: 0 };
            case 'TOP':
                return { x: 0, y: 1, z: 0 };
            case 'BOTTOM':
                return { x: 0, y: -1, z: 0 };
            case 'ISO':
            default:
                // SolidWorks isometric: kamera z przodu-góry-prawej (+X,+Y,+Z)
                return { x: 1, y: 1, z: 1 };
        }
    }

    private static project3DPoint(pt: Point3D, projection: DrawProjectionAngle): ProjectedPoint {
        const { x, y, z } = pt;
        const cam = this.getCameraVector(projection);
        const depth = -(cam.x * x + cam.y * y + cam.z * z);

        switch (projection) {
            case 'FRONT':
                return { u: x, v: -y, depth };
            case 'BACK':
                return { u: -x, v: -y, depth };
            case 'RIGHT':
                return { u: -z, v: -y, depth };
            case 'LEFT':
                return { u: z, v: -y, depth };
            case 'TOP':
                return { u: x, v: z, depth };
            case 'BOTTOM':
                return { u: x, v: -z, depth };
            case 'ISO':
            default: {
                const isoAngle = Math.PI / 6;
                const cosA = Math.cos(isoAngle);
                const sinA = Math.sin(isoAngle);
                const u = (x - z) * cosA;
                const v = -y + (x + z) * sinA;
                return { u, v, depth };
            }
        }
    }

    private static getPart3DVertices(part: ProjectablePart): Point3D[] {
        if (part.vertices3D && part.vertices3D.length === 8) {
            return part.vertices3D;
        }
        const hx = part.dim.x / 2;
        const hy = part.dim.y / 2;
        const hz = part.dim.z / 2;
        const cx = part.loc.x;
        const cy = part.loc.y;
        const cz = part.loc.z;

        return [
            { x: cx - hx, y: cy - hy, z: cz - hz },
            { x: cx + hx, y: cy - hy, z: cz - hz },
            { x: cx + hx, y: cy + hy, z: cz - hz },
            { x: cx - hx, y: cy + hy, z: cz - hz },
            { x: cx - hx, y: cy - hy, z: cz + hz },
            { x: cx + hx, y: cy - hy, z: cz + hz },
            { x: cx + hx, y: cy + hy, z: cz + hz },
            { x: cx - hx, y: cy + hy, z: cz + hz },
        ];
    }

    private static isFaceFacingCamera(a: Point3D, b: Point3D, c: Point3D, projection: DrawProjectionAngle): boolean {
        const e1x = b.x - a.x;
        const e1y = b.y - a.y;
        const e1z = b.z - a.z;
        const e2x = c.x - a.x;
        const e2y = c.y - a.y;
        const e2z = c.z - a.z;
        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;
        const cam = this.getCameraVector(projection);
        return nx * cam.x + ny * cam.y + nz * cam.z > 0;
    }

    /**
     * Głębokość płaszczyzny jako funkcja afiniczna rzutu (u,v) — dokładne dla kamery ortograficznej.
     */
    private static fitDepthPlane(pts: ProjectedPoint[]): { a: number; b: number; c: number } | null {
        let best: { a: number; b: number; c: number; area: number } | null = null;
        const n = pts.length;
        for (let i = 0; i < n - 2; i++) {
            for (let j = i + 1; j < n - 1; j++) {
                for (let k = j + 1; k < n; k++) {
                    const p0 = pts[i];
                    const p1 = pts[j];
                    const p2 = pts[k];
                    const det = p0.u * (p1.v - p2.v) - p0.v * (p1.u - p2.u) + (p1.u * p2.v - p2.u * p1.v);
                    if (Math.abs(det) < 1e-6) continue;
                    const a = (p0.depth * (p1.v - p2.v) - p0.v * (p1.depth - p2.depth) + (p1.depth * p2.v - p2.depth * p1.v)) / det;
                    const b = (p0.u * (p1.depth - p2.depth) - p0.depth * (p1.u - p2.u) + (p1.u * p2.depth - p2.u * p1.depth)) / det;
                    const c = (p0.u * (p1.v * p2.depth - p2.v * p1.depth) - p0.v * (p1.u * p2.depth - p2.u * p1.depth) + p0.depth * (p1.u * p2.v - p2.u * p1.v)) / det;
                    const area = Math.abs(det);
                    if (!best || area > best.area) best = { a, b, c, area };
                }
            }
        }
        return best;
    }

    /**
     * Na przedziale 2D [clip] krawędź jest chowana tam, gdzie leży ZA płaszczyzną ściany (diff > EPS).
     * Przecięcie diff=0 rozcina przedział (krawędź przebija ścianę).
     */
    private static hiddenSubIntervals(
        p1: ProjectedPoint,
        p2: ProjectedPoint,
        clip: Interval,
        face: OccluderFace
    ): Interval[] {
        const diffAt = (t: number) => {
            const u = p1.u + t * (p2.u - p1.u);
            const v = p1.v + t * (p2.v - p1.v);
            const edgeD = p1.depth + t * (p2.depth - p1.depth);
            const faceD = face.a * u + face.b * v + face.c;
            return edgeD - faceD;
        };

        const d0 = diffAt(clip.start);
        const d1 = diffAt(clip.end);
        const hidden0 = d0 > COPLANAR_EPS;
        const hidden1 = d1 > COPLANAR_EPS;

        if (hidden0 && hidden1) {
            return [{ start: clip.start, end: clip.end }];
        }
        if (!hidden0 && !hidden1) {
            return [];
        }

        const denom = d1 - d0;
        if (Math.abs(denom) < 1e-12) return hidden0 ? [{ start: clip.start, end: clip.end }] : [];

        const tCross = clip.start + ((COPLANAR_EPS - d0) / denom) * (clip.end - clip.start);
        const t = Math.min(clip.end, Math.max(clip.start, tCross));
        if (hidden0) return [{ start: clip.start, end: t }];
        return [{ start: t, end: clip.end }];
    }

    private static getPolygonSignedArea(pts: Array<{ u: number; v: number }>): number {
        let area = 0;
        const n = pts.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += pts[i].u * pts[j].v - pts[j].u * pts[i].v;
        }
        return area / 2;
    }

    private static clipSegmentWithConvexPolygon(
        p1: ProjectedPoint,
        p2: ProjectedPoint,
        polygon: Array<{ u: number; v: number }>
    ): Interval | null {
        let tIn = 0;
        let tOut = 1;
        const dx = p2.u - p1.u;
        const dy = p2.v - p1.v;

        const signedArea = this.getPolygonSignedArea(polygon);
        const poly = signedArea < 0 ? [...polygon].reverse() : polygon;

        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % n];
            const edgeX = b.u - a.u;
            const edgeY = b.v - a.v;
            const nx = edgeY;
            const ny = -edgeX;
            const wx = p1.u - a.u;
            const wy = p1.v - a.v;
            const numerator = -(wx * nx + wy * ny);
            const denominator = dx * nx + dy * ny;

            if (Math.abs(denominator) < 1e-7) {
                if (numerator < 0) return null;
            } else {
                const t = numerator / denominator;
                if (denominator < 0) {
                    if (t > tIn) tIn = t;
                } else {
                    if (t < tOut) tOut = t;
                }
                if (tIn > tOut) return null;
            }
        }

        const tStart = Math.max(0, tIn);
        const tEnd = Math.min(1, tOut);
        if (tEnd - tStart > CLIP_MIN_T) {
            return { start: tStart, end: tEnd };
        }
        return null;
    }

    private static mergeIntervals(intervals: Interval[]): Interval[] {
        if (intervals.length === 0) return [];
        const sorted = [...intervals].sort((a, b) => a.start - b.start);
        const merged: Interval[] = [{ ...sorted[0] }];

        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const last = merged[merged.length - 1];
            if (current.start <= last.end + CLIP_MIN_T) {
                last.end = Math.max(last.end, current.end);
            } else {
                merged.push({ ...current });
            }
        }
        return merged;
    }

    private static subtractIntervals(occluded: Interval[]): Interval[] {
        const visible: Interval[] = [];
        let cur = 0;
        for (const occ of occluded) {
            if (occ.start > cur + CLIP_MIN_T) {
                visible.push({ start: cur, end: Math.min(1, occ.start) });
            }
            cur = Math.max(cur, occ.end);
        }
        if (cur < 1 - CLIP_MIN_T) {
            visible.push({ start: cur, end: 1 });
        }
        return visible;
    }

    private static deduplicateSegments(segments: Draw2DSegment[]): Draw2DSegment[] {
        const result: Draw2DSegment[] = [];
        const keyMap = new Set<string>();
        const sorted = [...segments].sort((a, b) => (a.isHidden === b.isHidden ? 0 : a.isHidden ? 1 : -1));

        for (const s of sorted) {
            const x1 = Math.round(s.x1 * 10) / 10;
            const y1 = Math.round(s.y1 * 10) / 10;
            const x2 = Math.round(s.x2 * 10) / 10;
            const y2 = Math.round(s.y2 * 10) / 10;
            const p1 = `${Math.min(x1, x2)},${Math.min(y1, y2)}`;
            const p2 = `${Math.max(x1, x2)},${Math.max(y1, y2)}`;
            const key = `${p1}->${p2}`;
            if (!keyMap.has(key)) {
                keyMap.add(key);
                result.push(s);
            }
        }
        return result;
    }
}
