/**
 * SmartPanel Web — C1_CNC Geometry Utils
 * 
 * Funkcje pomocnicze matematyki 3D i geometrii dla układów CNC,
 * w tym obliczanie AABB, kompensacja promienia freza i transformacje.
 */

import { Vector3D } from '../dto/cam-dto.js';

export interface AABB {
    min: Vector3D;
    max: Vector3D;
}

export function createVector3D(x = 0, y = 0, z = 0): Vector3D {
    return { x, y, z };
}

export function vecLength(v: Vector3D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function vecNormalize(v: Vector3D): Vector3D {
    const len = vecLength(v);
    if (len < 1e-7) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function vecAdd(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vecSub(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vecScale(v: Vector3D, s: number): Vector3D {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vecDot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vecCross(a: Vector3D, b: Vector3D): Vector3D {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

export function vecDistance(a: Vector3D, b: Vector3D): number {
    return vecLength(vecSub(a, b));
}

export function aabbIntersects(a: AABB, b: AABB, eps = 0.5): boolean {
    return (
        a.min.x <= b.max.x + eps && a.max.x >= b.min.x - eps &&
        a.min.y <= b.max.y + eps && a.max.y >= b.min.y - eps &&
        a.min.z <= b.max.z + eps && a.max.z >= b.min.z - eps
    );
}

/**
 * Oblicza ścieżkę z kompensacją promienia freza (INSIDE / OUTSIDE / CENTER).
 */
export function calculateRadiusOffsetPath(
    pts: Vector3D[],
    wcsDir: Vector3D,
    compensation: 'CENTER' | 'INSIDE' | 'OUTSIDE',
    toolRadius: number,
    panelCenter?: Vector3D
): Vector3D[] {
    if (!pts || pts.length < 2 || compensation === 'CENTER' || toolRadius <= 0.0001) {
        return pts.map(p => ({ ...p }));
    }

    const n = pts.length;
    const isClosed = vecDistance(pts[0], pts[n - 1]) < 0.005;

    let refCenter = panelCenter;
    if (isClosed && n >= 3) {
        let sum = createVector3D();
        for (let i = 0; i < n - 1; i++) {
            sum = vecAdd(sum, pts[i]);
        }
        refCenter = vecScale(sum, 1 / (n - 1));
    }

    const segmentOffsets: Vector3D[] = [];
    for (let i = 0; i < n - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const diff = vecSub(p2, p1);
        if (vecLength(diff) < 0.0001) {
            segmentOffsets.push(createVector3D());
            continue;
        }

        const d = vecNormalize(diff);
        let r = vecNormalize(vecCross(d, wcsDir));

        if (refCenter) {
            const pMid = vecScale(vecAdd(p1, p2), 0.5);
            let vToCenter = vecSub(refCenter, pMid);
            // Project onto plane perpendicular to wcsDir
            vToCenter = vecSub(vToCenter, vecScale(wcsDir, vecDot(vToCenter, wcsDir)));

            const offsetDir = vecDot(r, vToCenter) >= 0
                ? (compensation === 'INSIDE' ? r : vecScale(r, -1))
                : (compensation === 'INSIDE' ? vecScale(r, -1) : r);
            segmentOffsets.push(vecScale(offsetDir, toolRadius));
        } else {
            const offsetDir = compensation === 'INSIDE' ? r : vecScale(r, -1);
            segmentOffsets.push(vecScale(offsetDir, toolRadius));
        }
    }

    const offsetPts: Vector3D[] = pts.map(p => ({ ...p }));

    if (isClosed && segmentOffsets.length >= 2) {
        const vPrev = segmentOffsets[segmentOffsets.length - 1];
        const vNext = segmentOffsets[0];
        let vCorner = vecAdd(vPrev, vNext);

        if (vecLength(vCorner) > 0.0001) {
            vCorner = vecNormalize(vCorner);
            const dPrev = vecNormalize(vecSub(pts[0], pts[n - 2]));
            const dNext = vecNormalize(vecSub(pts[1], pts[0]));
            const dot = vecDot(dPrev, dNext);
            const cosHalf = (1.0 + dot) / 2.0;

            if (cosHalf > 0.01) {
                const factor = Math.min(2.0, 1.0 / Math.sqrt(cosHalf));
                vCorner = vecScale(vCorner, toolRadius * factor);
            } else {
                vCorner = vPrev;
            }
        } else {
            vCorner = vPrev;
        }
        offsetPts[0] = vecAdd(pts[0], vCorner);
    } else {
        offsetPts[0] = vecAdd(pts[0], segmentOffsets[0]);
    }

    for (let i = 1; i < n - 1; i++) {
        const vPrev = segmentOffsets[i - 1];
        const vNext = segmentOffsets[i];
        let vCorner = vecAdd(vPrev, vNext);

        if (vecLength(vCorner) > 0.0001) {
            vCorner = vecNormalize(vCorner);
            const dPrev = vecNormalize(vecSub(pts[i], pts[i - 1]));
            const dNext = vecNormalize(vecSub(pts[i + 1], pts[i]));
            const dot = vecDot(dPrev, dNext);
            const cosHalf = (1.0 + dot) / 2.0;

            if (cosHalf > 0.01) {
                const factor = Math.min(2.0, 1.0 / Math.sqrt(cosHalf));
                vCorner = vecScale(vCorner, toolRadius * factor);
            } else {
                vCorner = vPrev;
            }
        } else {
            vCorner = vPrev;
        }

        offsetPts[i] = vecAdd(pts[i], vCorner);
    }

    if (isClosed) {
        offsetPts[n - 1] = { ...offsetPts[0] };
    } else {
        offsetPts[n - 1] = vecAdd(pts[n - 1], segmentOffsets[segmentOffsets.length - 1]);
    }

    return offsetPts;
}

/**
 * Oblicza ostateczną ścieżkę konturu uwzględniającą:
 *  - Lead-In (wejście rozbiegowe)
 *  - Lead-Out (wyjście wybiegowe)
 *  - Compensation (kompensacja promienia freza Left / Right / Center)
 *  - Reverse Direction (odwrócenie kierunku)
 */
export function generateEffectiveContourPath(
    rawPoints: Vector3D[],
    leadIn: number = 0,
    leadOut: number = 0,
    compensation: 'Left' | 'Right' | 'Center' = 'Center',
    toolRadius: number = 0,
    reverseDirection: boolean = false
): Vector3D[] {
    if (!rawPoints || rawPoints.length < 2) return rawPoints || [];

    // 1. Kierunek ścieżki
    let pts = reverseDirection ? [...rawPoints].reverse() : [...rawPoints];

    // 2. Kompensacja promienia freza (G41 / G42 / G40)
    if (compensation !== 'Center' && toolRadius > 0.001) {
        const offsetSign = compensation === 'Left' ? -1 : 1;
        const offsetPts: Vector3D[] = [];

        for (let i = 0; i < pts.length; i++) {
            let dx = 0, dy = 0;
            if (i < pts.length - 1) {
                dx += pts[i + 1].x - pts[i].x;
                dy += pts[i + 1].y - pts[i].y;
            }
            if (i > 0) {
                dx += pts[i].x - pts[i - 1].x;
                dy += pts[i].y - pts[i - 1].y;
            }
            const len = Math.hypot(dx, dy) || 1;
            const nx = (-dy / len) * offsetSign * toolRadius;
            const ny = (dx / len) * offsetSign * toolRadius;

            offsetPts.push({
                x: pts[i].x + nx,
                y: pts[i].y + ny,
                z: pts[i].z
            });
        }
        pts = offsetPts;
    }

    // 3. Rozbieg / Wejście (Lead-In)
    if (leadIn > 0 && pts.length >= 2) {
        const p0 = pts[0];
        const p1 = pts[1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;

        const leadInStart: Vector3D = {
            x: p0.x - (dx / len) * leadIn,
            y: p0.y - (dy / len) * leadIn,
            z: p0.z
        };
        pts = [leadInStart, ...pts];
    }

    // 4. Wybieg / Wyjście (Lead-Out)
    if (leadOut > 0 && pts.length >= 2) {
        const pLast = pts[pts.length - 1];
        const pPrev = pts[pts.length - 2];
        const dx = pLast.x - pPrev.x;
        const dy = pLast.y - pPrev.y;
        const len = Math.hypot(dx, dy) || 1;

        const leadOutEnd: Vector3D = {
            x: pLast.x + (dx / len) * leadOut,
            y: pLast.y + (dy / len) * leadOut,
            z: pLast.z
        };
        pts.push(leadOutEnd);
    }

    return pts;
}

/**
 * Łączy zaznaczone odcinki krawędzi (segments) w jeden spójny profil (polyline).
 */
export function chainEdgeSegments(edgeSegments: { points: Vector3D[] }[]): Vector3D[] {
    if (edgeSegments.length === 0) return [];
    if (edgeSegments.length === 1) return edgeSegments[0].points;

    const distSq = (p1: Vector3D, p2: Vector3D) => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = p1.z - p2.z;
        return dx * dx + dy * dy + dz * dz;
    };

    const remaining = edgeSegments.map(s => ({ points: [...s.points] }));
    let currentChain = [...remaining.shift()!.points];

    while (remaining.length > 0) {
        const chainEnd = currentChain[currentChain.length - 1];
        const chainStart = currentChain[0];
        let bestIndex = -1;
        let bestMode: 'end-to-start' | 'end-to-end' | 'start-to-start' | 'start-to-end' = 'end-to-start';
        let minDistanceSq = 25.0; // Tolerancja przerw (5mm)

        for (let i = 0; i < remaining.length; i++) {
            const seg = remaining[i].points;
            const segStart = seg[0];
            const segEnd = seg[seg.length - 1];

            const d1 = distSq(chainEnd, segStart);
            if (d1 < minDistanceSq) {
                minDistanceSq = d1;
                bestIndex = i;
                bestMode = 'end-to-start';
            }

            const d2 = distSq(chainEnd, segEnd);
            if (d2 < minDistanceSq) {
                minDistanceSq = d2;
                bestIndex = i;
                bestMode = 'end-to-end';
            }

            const d3 = distSq(chainStart, segEnd);
            if (d3 < minDistanceSq) {
                minDistanceSq = d3;
                bestIndex = i;
                bestMode = 'start-to-end';
            }

            const d4 = distSq(chainStart, segStart);
            if (d4 < minDistanceSq) {
                minDistanceSq = d4;
                bestIndex = i;
                bestMode = 'start-to-start';
            }
        }

        if (bestIndex !== -1) {
            const [nextSeg] = remaining.splice(bestIndex, 1);
            const segPts = [...nextSeg.points];

            if (bestMode === 'end-to-start') {
                const startIdx = distSq(chainEnd, segPts[0]) < 0.01 ? 1 : 0;
                currentChain.push(...segPts.slice(startIdx));
            } else if (bestMode === 'end-to-end') {
                segPts.reverse();
                const startIdx = distSq(chainEnd, segPts[0]) < 0.01 ? 1 : 0;
                currentChain.push(...segPts.slice(startIdx));
            } else if (bestMode === 'start-to-end') {
                const endIdx = distSq(chainStart, segPts[segPts.length - 1]) < 0.01 ? segPts.length - 1 : segPts.length;
                currentChain.unshift(...segPts.slice(0, endIdx));
            } else if (bestMode === 'start-to-start') {
                segPts.reverse();
                const endIdx = distSq(chainStart, segPts[segPts.length - 1]) < 0.01 ? segPts.length - 1 : segPts.length;
                currentChain.unshift(...segPts.slice(0, endIdx));
            }
        } else {
            const unconnected = remaining.shift()!;
            currentChain.push(...unconnected.points);
        }
    }

    return currentChain;
}

