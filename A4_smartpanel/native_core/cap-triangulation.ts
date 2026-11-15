/**
 * Triangulacja czapki lica płyty (earcut) z wycięciem otworów, wpustów, kieszeni i wycięć brzegowych.
 * Wydzielone z cap-machining.ts (Punkt C) — matematyka 1:1.
 */
import earcut from 'earcut';
import { normalizeFaceName } from '../panel-model.js';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { computeFaceData, localTo3D } from './face-lcs.js';
import {
    cleanDuplicatePoints,
    clipPolygonByConvex,
    isAxisAlignedRect,
    isPointInPolygon2D,
    mergeAdjacentPolygons,
    signedArea2D
} from './planar-features.js';
import { isFeatureSkipped } from './planar-feature-mesh.js';
import type { FaceMeshData } from './face-mesh.js';

function clipPolygonByHalfPlane(
    poly: number[][],
    axis: 'u' | 'v',
    bound: number,
    keepLess: boolean
): number[][] {
    const EPS = 1e-5;
    const out: number[][] = [];
    const n = poly.length;
    if (n < 3) return out;
    const isInside = (p: number[]) => {
        const val = axis === 'u' ? p[0] : p[1];
        return keepLess ? val <= bound + EPS : val >= bound - EPS;
    };
    const intersect = (p1: number[], p2: number[]) => {
        const val1 = axis === 'u' ? p1[0] : p1[1];
        const val2 = axis === 'u' ? p2[0] : p2[1];
        const denom = val2 - val1;
        if (Math.abs(denom) < 1e-9) return p1;
        const t = Math.max(0, Math.min(1, (bound - val1) / denom));
        return [
            p1[0] + t * (p2[0] - p1[0]),
            p1[1] + t * (p2[1] - p1[1])
        ];
    };
    for (let i = 0; i < n; i++) {
        const cur = poly[i];
        const prev = poly[(i - 1 + n) % n];
        const curIn = isInside(cur);
        const prevIn = isInside(prev);
        if (curIn) {
            if (!prevIn) out.push(intersect(prev, cur));
            out.push(cur);
        } else if (prevIn) {
            out.push(intersect(prev, cur));
        }
    }
    return cleanDuplicatePoints(out);
}

function subtractBoxFromPolygon(
    poly: number[][],
    u0: number, u1: number,
    v0: number, v1: number
): number[][][] {
    const minArea = 1e-2;
    let pMinU = Infinity, pMaxU = -Infinity, pMinV = Infinity, pMaxV = -Infinity;
    for (const [u, v] of poly) {
        if (u < pMinU) pMinU = u;
        if (u > pMaxU) pMaxU = u;
        if (v < pMinV) pMinV = v;
        if (v > pMaxV) pMaxV = v;
    }
    if (u1 <= pMinU + 1e-4 || u0 >= pMaxU - 1e-4 || v1 <= pMinV + 1e-4 || v0 >= pMaxV - 1e-4) {
        return [poly];
    }

    // Jeśli prostokąt leży poza wielokątem (np. w wyciętym narożniku) — nie tnij
    const midU = (u0 + u1) / 2;
    const midV = (v0 + v1) / 2;
    const eps = 1e-2;
    const samples = [
        [midU, midV],
        [u0 + eps, v0 + eps],
        [u1 - eps, v0 + eps],
        [u1 - eps, v1 - eps],
        [u0 + eps, v1 - eps]
    ];
    const anyInside = samples.some(([x, y]) => isPointInPolygon2D(x, y, poly as [number, number][]));
    if (!anyInside) {
        return [poly];
    }

    const p1 = clipPolygonByHalfPlane(poly, 'v', v0, true);
    const p2 = clipPolygonByHalfPlane(poly, 'v', v1, false);
    const middle = clipPolygonByHalfPlane(
        clipPolygonByHalfPlane(poly, 'v', v0, false),
        'v', v1, true
    );
    const p3 = clipPolygonByHalfPlane(middle, 'u', u0, true);
    const p4 = clipPolygonByHalfPlane(middle, 'u', u1, false);

    const result: number[][][] = [];
    for (const p of [p1, p2, p3, p4]) {
        if (p.length >= 3 && Math.abs(signedArea2D(p)) > minArea) {
            result.push(p);
        }
    }
    return mergeAdjacentPolygons(result);
}

/**
 * Wycina prostokąt brzegowy bezpośrednio z dowolnego czworokąta osiowego (CCW),
 * tworząc pojedynczy wielokąt (np. 6-kąt w narożniku lub 8-kąt przy wcince bocznej),
 * eliminując podział płyty na paski i zapobiegając poziomym liniom na całej formatce.
 */
export function cutBoxFromPolygon(
    poly: number[][],
    u0: number, u1: number,
    v0: number, v1: number
): number[][][] | null {
    if (!poly || poly.length < 3) return null;
    if (!isAxisAlignedRect(poly)) {
        return subtractBoxFromPolygon(poly, u0, u1, v0, v1);
    }
    const EPS = 0.05;

    let pMinU = Infinity, pMaxU = -Infinity, pMinV = Infinity, pMaxV = -Infinity;
    for (const [u, v] of poly) {
        if (u < pMinU) pMinU = u;
        if (u > pMaxU) pMaxU = u;
        if (v < pMinV) pMinV = v;
        if (v > pMaxV) pMaxV = v;
    }

    const bU0 = Math.max(pMinU, u0);
    const bU1 = Math.min(pMaxU, u1);
    const bV0 = Math.max(pMinV, v0);
    const bV1 = Math.min(pMaxV, v1);

    if (bU1 - bU0 <= EPS || bV1 - bV0 <= EPS) {
        return [poly]; // Brak przecięcia
    }

    const touchesU0 = bU0 <= pMinU + EPS;
    const touchesU1 = bU1 >= pMaxU - EPS;
    const touchesV0 = bV0 <= pMinV + EPS;
    const touchesV1 = bV1 >= pMaxV - EPS;

    // Całkowite pochłonięcie prostokąta
    if (touchesU0 && touchesU1 && touchesV0 && touchesV1) {
        return [];
    }

    // Odcięcie lewego końca wzdłuż całej wysokości
    if (touchesU0 && touchesV0 && touchesV1 && !touchesU1) {
        return [[[bU1, pMinV], [pMaxU, pMinV], [pMaxU, pMaxV], [bU1, pMaxV]]];
    }
    // Odcięcie prawego końca wzdłuż całej wysokości
    if (touchesU1 && touchesV0 && touchesV1 && !touchesU0) {
        return [[[pMinU, pMinV], [bU0, pMinV], [bU0, pMaxV], [pMinU, pMaxV]]];
    }
    // Odcięcie dolnego końca wzdłuż całej szerokości
    if (touchesV0 && touchesU0 && touchesU1 && !touchesV1) {
        return [[[pMinU, bV1], [pMaxU, bV1], [pMaxU, pMaxV], [pMinU, pMaxV]]];
    }
    // Odcięcie górnego końca wzdłuż całej szerokości
    if (touchesV1 && touchesU0 && touchesU1 && !touchesV0) {
        return [[[pMinU, pMinV], [pMaxU, pMinV], [pMaxU, bV0], [pMinU, bV0]]];
    }

    // 1. Lewy dolny narożnik
    if (touchesU0 && touchesV0 && !touchesU1 && !touchesV1) {
        return [[
            [bU1, pMinV],
            [pMaxU, pMinV],
            [pMaxU, pMaxV],
            [pMinU, pMaxV],
            [pMinU, bV1],
            [bU1, bV1]
        ]];
    }
    // 2. Prawy dolny narożnik
    if (touchesU1 && touchesV0 && !touchesU0 && !touchesV1) {
        return [[
            [pMinU, pMinV],
            [bU0, pMinV],
            [bU0, bV1],
            [pMaxU, bV1],
            [pMaxU, pMaxV],
            [pMinU, pMaxV]
        ]];
    }
    // 3. Prawy górny narożnik
    if (touchesU1 && touchesV1 && !touchesU0 && !touchesV0) {
        return [[
            [pMinU, pMinV],
            [pMaxU, pMinV],
            [pMaxU, bV0],
            [bU0, bV0],
            [bU0, pMaxV],
            [pMinU, pMaxV]
        ]];
    }
    // 4. Lewy górny narożnik
    if (touchesU0 && touchesV1 && !touchesU1 && !touchesV0) {
        return [[
            [pMinU, pMinV],
            [pMaxU, pMinV],
            [pMaxU, pMaxV],
            [bU1, pMaxV],
            [bU1, bV0],
            [pMinU, bV0]
        ]];
    }
    // 5. Wcinka w lewym boku
    if (touchesU0 && !touchesU1 && !touchesV0 && !touchesV1) {
        return [[
            [pMinU, pMinV],
            [pMaxU, pMinV],
            [pMaxU, pMaxV],
            [pMinU, pMaxV],
            [pMinU, bV1],
            [bU1, bV1],
            [bU1, bV0],
            [pMinU, bV0]
        ]];
    }
    // 6. Wcinka w prawym boku
    if (touchesU1 && !touchesU0 && !touchesV0 && !touchesV1) {
        return [[
            [pMinU, pMinV],
            [pMaxU, pMinV],
            [pMaxU, bV0],
            [bU0, bV0],
            [bU0, bV1],
            [pMaxU, bV1],
            [pMaxU, pMaxV],
            [pMinU, pMaxV]
        ]];
    }
    // 7. Wcinka w dolnym boku
    if (touchesV0 && !touchesV1 && !touchesU0 && !touchesU1) {
        return [[
            [pMinU, pMinV],
            [bU0, pMinV],
            [bU0, bV1],
            [bU1, bV1],
            [bU1, pMinV],
            [pMaxU, pMinV],
            [pMaxU, pMaxV],
            [pMinU, pMaxV]
        ]];
    }
    // 8. Wcinka w górnym boku
    if (touchesV1 && !touchesV0 && !touchesU0 && !touchesU1) {
        return [[
            [pMinU, pMinV],
            [pMaxU, pMinV],
            [pMaxU, pMaxV],
            [bU1, pMaxV],
            [bU1, bV0],
            [bU0, bV0],
            [bU0, pMaxV],
            [pMinU, pMaxV]
        ]];
    }
    // 9. Przelot przez całą szerokość U
    if (touchesU0 && touchesU1 && !touchesV0 && !touchesV1) {
        return [
            [
                [pMinU, pMinV],
                [pMaxU, pMinV],
                [pMaxU, bV0],
                [pMinU, bV0]
            ],
            [
                [pMinU, bV1],
                [pMaxU, bV1],
                [pMaxU, pMaxV],
                [pMinU, pMaxV]
            ]
        ];
    }
    // 10. Przelot przez całą wysokość V
    if (touchesV0 && touchesV1 && !touchesU0 && !touchesU1) {
        return [
            [
                [pMinU, pMinV],
                [bU0, pMinV],
                [bU0, pMaxV],
                [pMinU, pMaxV]
            ],
            [
                [bU1, pMinV],
                [pMaxU, pMinV],
                [pMaxU, pMaxV],
                [bU1, pMaxV]
            ]
        ];
    }

    return null;
}

/**
 * Otwór musi leżeć na materiale. Bez przycięcia earcut dostaje dziurę poza obrysem
 * i wygryza trójkąty z litej części formatki (wieniec L / wcięcie).
 */
export function clipHolesToContour(holes2D: number[][][], outerContour: number[][]): number[][][] {
    const contourArea = Math.abs(signedArea2D(outerContour));
    const minArea = Math.max(1e-9, contourArea * 1e-9);
    const clipped: number[][][] = [];

    for (const hole of holes2D) {
        if (hole.length < 3) continue;
        if (hole.length > 4) {
            clipped.push(hole);
            continue;
        }
        const piece = clipPolygonByConvex(outerContour, hole);
        if (piece.length < 3) continue;
        if (Math.abs(signedArea2D(piece)) < minArea) continue;
        clipped.push(piece);
    }

    return clipped;
}

function projectBoxToFace(rawFaceName: string, min: number[], max: number[], w: number, h: number, t: number) {
    const faceData = computeFaceData(rawFaceName, w, h, t);
    let uMin = Infinity, uMax = -Infinity;
    let vMin = Infinity, vMax = -Infinity;

    for (let ix = 0; ix < 2; ix++) {
        for (let iy = 0; iy < 2; iy++) {
            for (let iz = 0; iz < 2; iz++) {
                const px = ix === 0 ? min[0] : max[0];
                const py = iy === 0 ? min[1] : max[1];
                const pz = iz === 0 ? min[2] : max[2];

                const dx = px - faceData.origin[0];
                const dy = py - faceData.origin[1];
                const dz = pz - faceData.origin[2];

                const u = dx * faceData.uAxis[0] + dy * faceData.uAxis[1] + dz * faceData.uAxis[2];
                const v = dx * faceData.vAxis[0] + dy * faceData.vAxis[1] + dz * faceData.vAxis[2];

                uMin = Math.min(uMin, u);
                uMax = Math.max(uMax, u);
                vMin = Math.min(vMin, v);
                vMax = Math.max(vMax, v);
            }
        }
    }

    uMin = Math.max(0, uMin);
    uMax = Math.min(faceData.width, uMax);
    vMin = Math.max(0, vMin);
    vMax = Math.min(faceData.height, vMax);

    if (uMin >= uMax || vMin >= vMax) return null;

    return [
        [uMin, vMin],
        [uMin, vMax],
        [uMax, vMax],
        [uMax, vMin]
    ];
}

export function collectExtraHoles2D(
    features: any[] | undefined,
    w: number,
    h: number,
    t: number
): Record<string, number[][][]> {
    const extraHoles2D: Record<string, number[][][]> = {
        FACE_X_PLUS: [], FACE_X_MINUS: [], FACE_Y_PLUS: [], FACE_Y_MINUS: [], FACE_Z_PLUS: [], FACE_Z_MINUS: []
    };
    if (!features) return extraHoles2D;

    for (const feat of features) {
        if (isFeatureSkipped(feat)) continue;
        const isAreaFeature = feat.type === 'groove' || feat.type === 'pocket' || feat.type === 'cutout';
        if (feat.type !== 'hole' && !isAreaFeature) {
            console.warn(`[cap-machining] Pominięto extraHoles dla nieobsługiwanego typu feature: "${feat?.type}" (id: ${feat?.id ?? 'brak'}).`);
            continue;
        }
        if (!isAreaFeature) continue;

        const gp = getGrooveParamsMm(feat.params);
        const featFace = feat.face ? normalizeFaceName(feat.face) : (feat.side ? normalizeFaceName(feat.side) : 'FACE_Z_PLUS');
        const faceData = computeFaceData(featFace, w, h, t);

        const isCutout = feat.type === 'cutout'
            || feat.params?.through === true
            || feat.params?.kind === 'THROUGH';
        let depth = gp.depth;
        if (isCutout || depth >= t - 0.05) {
            depth = Math.min(depth, t);
            if (depth <= 0) depth = t;
        }

        const p00_0 = localTo3D(faceData, gp.u, gp.v, 0);
        const p11_d = localTo3D(faceData, gp.u + gp.width, gp.v + gp.length, depth);

        const min = [
            Math.min(p00_0[0], p11_d[0]), Math.min(p00_0[1], p11_d[1]), Math.min(p00_0[2], p11_d[2])
        ];
        const max = [
            Math.max(p00_0[0], p11_d[0]), Math.max(p00_0[1], p11_d[1]), Math.max(p00_0[2], p11_d[2])
        ];

        const EPS = 0.01;
        const hw = w / 2, hh = h / 2, ht = t / 2;
        const pushHole = (rawFace: string) => {
            const canonicalFace = normalizeFaceName(rawFace);
            if (canonicalFace === featFace) return;
            const hole = projectBoxToFace(canonicalFace, min, max, w, h, t);
            if (hole) {
                if (!extraHoles2D[canonicalFace]) extraHoles2D[canonicalFace] = [];
                extraHoles2D[canonicalFace].push(hole);
            }
        };

        if (min[0] <= -hw + EPS) pushHole('FACE_X_MINUS');
        if (max[0] >= hw - EPS) pushHole('FACE_X_PLUS');
        if (min[1] <= -hh + EPS) pushHole('FACE_Y_MINUS');
        if (max[1] >= hh - EPS) pushHole('FACE_Y_PLUS');
        if (min[2] <= -ht + EPS) pushHole('FACE_Z_MINUS');
        if (max[2] >= ht - EPS) pushHole('FACE_Z_PLUS');
    }

    // Scalanie / docinanie nakładających się otworów (np. narożnik L dwóch łączących się wpustów),
    // aby earcut nie otrzymywał przecinających się dziur i nie generował wiszących trójkątów nad wpustem.
    for (const face of Object.keys(extraHoles2D)) {
        extraHoles2D[face] = mergeOverlappingRectHoles(extraHoles2D[face]);
    }

    return extraHoles2D;
}

function mergeOverlappingRectHoles(holes: number[][][]): number[][][] {
    if (holes.length <= 1) return holes;
    const EPS = 0.05;
    const result: number[][][] = [];

    for (let i = 0; i < holes.length; i++) {
        const h = holes[i];
        if (h.length !== 4) {
            result.push(h);
            continue;
        }
        let uMin = Math.min(h[0][0], h[1][0], h[2][0], h[3][0]);
        let uMax = Math.max(h[0][0], h[1][0], h[2][0], h[3][0]);
        let vMin = Math.min(h[0][1], h[1][1], h[2][1], h[3][1]);
        let vMax = Math.max(h[0][1], h[1][1], h[2][1], h[3][1]);

        let merged = false;
        for (let j = 0; j < result.length; j++) {
            const q = result[j];
            if (q.length !== 4) continue;
            const quMin = Math.min(q[0][0], q[1][0], q[2][0], q[3][0]);
            const quMax = Math.max(q[0][0], q[1][0], q[2][0], q[3][0]);
            const qvMin = Math.min(q[0][1], q[1][1], q[2][1], q[3][1]);
            const qvMax = Math.max(q[0][1], q[1][1], q[2][1], q[3][1]);

            const inU0 = Math.max(uMin, quMin);
            const inU1 = Math.min(uMax, quMax);
            const inV0 = Math.max(vMin, qvMin);
            const inV1 = Math.min(vMax, qvMax);

            if (inU1 - inU0 > EPS && inV1 - inV0 > EPS) {
                const Umin = Math.min(uMin, quMin);
                const Umax = Math.max(uMax, quMax);
                const Vmin = Math.min(vMin, qvMin);
                const Vmax = Math.max(vMax, qvMax);

                let polyL: number[][] | null = null;
                if (inU1 >= Umax - EPS && inV1 >= Vmax - EPS) {
                    polyL = [
                        [Umin, inV0],
                        [inU0, inV0],
                        [inU0, Vmin],
                        [Umax, Vmin],
                        [Umax, Vmax],
                        [Umin, Vmax]
                    ];
                } else if (inU0 <= Umin + EPS && inV1 >= Vmax - EPS) {
                    polyL = [
                        [Umin, Vmin],
                        [Umin, Vmax],
                        [Umax, Vmax],
                        [Umax, inV0],
                        [inU1, inV0],
                        [inU1, Vmin]
                    ];
                } else if (inU1 >= Umax - EPS && inV0 <= Vmin + EPS) {
                    polyL = [
                        [Umin, Vmin],
                        [Umax, Vmin],
                        [Umax, Vmax],
                        [inU0, Vmax],
                        [inU0, inV1],
                        [Umin, inV1]
                    ];
                } else if (inU0 <= Umin + EPS && inV0 <= Vmin + EPS) {
                    polyL = [
                        [Umin, Vmax],
                        [Umin, Vmin],
                        [Umax, Vmin],
                        [Umax, inV1],
                        [inU1, inV1],
                        [inU1, Vmax]
                    ];
                }

                if (polyL) {
                    result[j] = polyL;
                    merged = true;
                    break;
                }
            }
        }

        if (!merged && uMax - uMin > EPS && vMax - vMin > EPS) {
            result.push([
                [uMin, vMin],
                [uMin, vMax],
                [uMax, vMax],
                [uMax, vMin]
            ]);
        }
    }
    return result;
}

function pointToSegmentDistSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) return (px - ax) * (px - ax) + (py - ay) * (py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

/** Sprawdza, czy wielokąt `inner` leży ściśle wewnątrz `outer` (bez dotykania krawędzi ani wierzchołków). */
export function isPolygonStrictlyInside(
    inner: number[][],
    outer: [number, number][],
    tol = 0.05
): boolean {
    if (inner.length < 3 || outer.length < 3) return false;
    const tolSq = tol * tol;
    for (const [px, py] of inner) {
        if (!isPointInPolygon2D(px, py, outer)) return false;
        for (let i = 0; i < outer.length; i++) {
            const [ax, ay] = outer[i];
            const [bx, by] = outer[(i + 1) % outer.length];
            if (pointToSegmentDistSq(px, py, ax, ay, bx, by) <= tolSq) return false;
        }
    }
    const innerTyped = inner as [number, number][];
    for (const [ox, oy] of outer) {
        if (isPointInPolygon2D(ox, oy, innerTyped)) return false;
    }
    return true;
}

function isHoleContainedIn(inner: number[][], outer: number[][], tol = 0.05): boolean {
    if (inner.length < 3 || outer.length < 3) return false;
    const areaInner = Math.abs(signedArea2D(inner));
    const areaOuter = Math.abs(signedArea2D(outer));
    if (areaOuter + tol < areaInner) return false;

    let iMinU = Infinity, iMaxU = -Infinity, iMinV = Infinity, iMaxV = -Infinity;
    for (const [u, v] of inner) {
        if (u < iMinU) iMinU = u;
        if (u > iMaxU) iMaxU = u;
        if (v < iMinV) iMinV = v;
        if (v > iMaxV) iMaxV = v;
    }
    let oMinU = Infinity, oMaxU = -Infinity, oMinV = Infinity, oMaxV = -Infinity;
    for (const [u, v] of outer) {
        if (u < oMinU) oMinU = u;
        if (u > oMaxU) oMaxU = u;
        if (v < oMinV) oMinV = v;
        if (v > oMaxV) oMaxV = v;
    }
    if (iMinU < oMinU - tol || iMaxU > oMaxU + tol || iMinV < oMinV - tol || iMaxV > oMaxV + tol) {
        return false;
    }

    const outerTyped = outer as [number, number][];
    const tolSq = tol * tol;
    for (const [px, py] of inner) {
        if (isPointInPolygon2D(px, py, outerTyped)) continue;
        let onEdge = false;
        for (let i = 0; i < outer.length; i++) {
            const [ax, ay] = outer[i];
            const [bx, by] = outer[(i + 1) % outer.length];
            if (pointToSegmentDistSq(px, py, ax, ay, bx, by) <= tolSq) {
                onEdge = true;
                break;
            }
        }
        if (!onEdge) return false;
    }
    const cx = inner.reduce((s, p) => s + p[0], 0) / inner.length;
    const cy = inner.reduce((s, p) => s + p[1], 0) / inner.length;
    return isPointInPolygon2D(cx, cy, outerTyped);
}

function holesOverlap2D(a: number[][], b: number[][], tol = 0.05): boolean {
    let aMinU = Infinity, aMaxU = -Infinity, aMinV = Infinity, aMaxV = -Infinity;
    for (const [u, v] of a) {
        if (u < aMinU) aMinU = u;
        if (u > aMaxU) aMaxU = u;
        if (v < aMinV) aMinV = v;
        if (v > aMaxV) aMaxV = v;
    }
    let bMinU = Infinity, bMaxU = -Infinity, bMinV = Infinity, bMaxV = -Infinity;
    for (const [u, v] of b) {
        if (u < bMinU) bMinU = u;
        if (u > bMaxU) bMaxU = u;
        if (v < bMinV) bMinV = v;
        if (v > bMaxV) bMaxV = v;
    }
    if (aMaxU <= bMinU + tol || bMaxU <= aMinU + tol || aMaxV <= bMinV + tol || bMaxV <= aMinV + tol) {
        return false;
    }
    const aTyped = a as [number, number][];
    const bTyped = b as [number, number][];
    for (const [px, py] of a) {
        if (isPointInPolygon2D(px, py, bTyped)) return true;
    }
    for (const [px, py] of b) {
        if (isPointInPolygon2D(px, py, aTyped)) return true;
    }
    return false;
}

/**
 * Trianguluje listę wielokątów z otworami na głębokości `depth` (w układzie `faceData`),
 * usuwając zagnieżdżone otwory i rozcinając wielokąty w razie nakładania lub styku z brzegiem.
 */
export function triangulatePolygonsWithHoles(
    initialPolys: number[][][],
    candidateHoles: number[][][],
    faceData: ReturnType<typeof computeFaceData>,
    depth: number,
    target: FaceMeshData
): void {
    const TOL = 0.05;
    // 1. Usuń otwory całkowicie zawarte wewnątrz innego otworu (earcut nie obsługuje zagnieżdżonych dziur)
    const filteredHoles = candidateHoles.filter((hA, idxA) => {
        for (let idxB = 0; idxB < candidateHoles.length; idxB++) {
            if (idxA === idxB) continue;
            const hB = candidateHoles[idxB];
            if (isHoleContainedIn(hA, hB, TOL)) {
                const areaA = Math.abs(signedArea2D(hA));
                const areaB = Math.abs(signedArea2D(hB));
                if (areaB > areaA + TOL || idxB < idxA) {
                    return false;
                }
            }
        }
        return true;
    });

    // 2. Jeśli dwa otwory częściowo się nakładają (lub otwór nie leży ściśle wewnątrz poligonu),
    // rozetnij poligon prostokątem otworu zamiast przekazywać kolidujące dziury do earcut.
    let polys = initialPolys;
    const earcutHoles: number[][][] = [];
    /** Czy otwór należy przypiąć do tego poligonu? Okrąg styczny do obrysu przechodzi testem środka. */
    const holeBelongsToPoly = (hole: number[][], poly: number[][]): boolean => {
        if (isPolygonStrictlyInside(hole, poly as [number, number][], TOL)) return true;
        if (hole.length === 4) return false;
        const cx = hole.reduce((s, q) => s + q[0], 0) / hole.length;
        const cy = hole.reduce((s, q) => s + q[1], 0) / hole.length;
        return isPointInPolygon2D(cx, cy, poly as [number, number][]);
    };
    for (let i = 0; i < filteredHoles.length; i++) {
        const hole = filteredHoles[i];
        const overlapsOther = filteredHoles.some((other, j) => j !== i && holesOverlap2D(hole, other, TOL));
        // Okrągły otwór styczny do obrysu nie jest „ściśle wewnątrz", ale earcut potrafi go
        // pomostkować, o ile jego środek leży w materiale. Bez tego otwór na krawędzi gubił czapkę.
        const belongsToSomePoly = polys.some(p => holeBelongsToPoly(hole, p));
        if (!overlapsOther && belongsToSomePoly) {
            earcutHoles.push(hole);
        } else if (hole.length === 4) {
            const u0 = Math.min(hole[0][0], hole[1][0], hole[2][0], hole[3][0]);
            const u1 = Math.max(hole[0][0], hole[1][0], hole[2][0], hole[3][0]);
            const v0 = Math.min(hole[0][1], hole[1][1], hole[2][1], hole[3][1]);
            const v1 = Math.max(hole[0][1], hole[1][1], hole[2][1], hole[3][1]);
            const nextPolys: number[][][] = [];
            for (const p of polys) {
                const cutResult = cutBoxFromPolygon(p, u0, u1, v0, v1);
                if (cutResult) nextPolys.push(...cutResult);
                else nextPolys.push(...subtractBoxFromPolygon(p, u0, u1, v0, v1));
            }
            polys = nextPolys;
        }
    }

    for (const poly of polys) {
        const flatVertices: number[] = [];
        const holeIndices: number[] = [];

        for (const [u, v] of poly) {
            flatVertices.push(u, v);
        }

        for (const hole of earcutHoles) {
            if (holeBelongsToPoly(hole, poly)) {
                holeIndices.push(flatVertices.length / 2);
                for (const [hu, hv] of hole) {
                    flatVertices.push(hu, hv);
                }
            }
        }

        const triangles = earcut(flatVertices, holeIndices, 2);
        const offset = target.positions.length / 3;
        for (let i = 0; i < flatVertices.length; i += 2) {
            const u = flatVertices[i];
            const v = flatVertices[i + 1];
            target.positions.push(...localTo3D(faceData, u, v, depth));
        }

        for (const idx of triangles) {
            target.indices.push(idx + offset);
        }
    }
}

/**
 * Czapka lica: dzieli obrys na rozłączne wielokąty materiału (cechy przecinające brzeg),
 * dodaje otwory wewnętrzne i trianguluje earcut → dopisuje do `faceResult`.
 */
export function triangulateFaceCap(opts: {
    faceData: ReturnType<typeof computeFaceData>;
    outerContour: number[][];
    feats: any[];
    holes2D: number[][][];
    faceResult: FaceMeshData;
}): void {
    const { faceData, outerContour, feats, holes2D, faceResult } = opts;

    // Podział lica na rozłączne wielokąty materiału przez wycięcie obszarów wpustów/kieszeni
    const areaFeats = feats.filter(
        (f: any) => !isFeatureSkipped(f) && (f.type === 'groove' || f.type === 'pocket' || f.type === 'cutout')
    );

    const EDGE_TOL = 0.05;
    const innerHoles: number[][][] = [];
    let facePolygons: number[][][] = [outerContour];

    // 1. Cechy obszarowe na tym licu (wpusty, kieszenie, wycięcia)
    for (const feat of areaFeats) {
        const customPoly: Array<[number, number]> | undefined = Array.isArray(feat.params?.polygon) && feat.params.polygon.length >= 3
            ? feat.params.polygon
            : undefined;

        let forceNotInner = false;
        if (customPoly) {
            const isInnerPoly = isPolygonStrictlyInside(customPoly, outerContour as [number, number][], EDGE_TOL);
            if (isInnerPoly) {
                innerHoles.push(customPoly);
                continue;
            }
            forceNotInner = true;
        }

        let cMinU = Infinity, cMaxU = -Infinity;
        let cMinV = Infinity, cMaxV = -Infinity;
        if (outerContour && outerContour.length > 0) {
            for (const [cu, cv] of outerContour) {
                if (cu < cMinU) cMinU = cu;
                if (cu > cMaxU) cMaxU = cu;
                if (cv < cMinV) cMinV = cv;
                if (cv > cMaxV) cMaxV = cv;
            }
        } else {
            cMinU = 0; cMaxU = faceData.width;
            cMinV = 0; cMaxV = faceData.height;
        }

        const gp = getGrooveParamsMm(feat.params);
        const touchesU0 = gp.u <= EDGE_TOL || gp.u <= cMinU + EDGE_TOL;
        const touchesU1 = (gp.u + gp.width) >= faceData.width - EDGE_TOL || (gp.u + gp.width) >= cMaxU - EDGE_TOL;
        const touchesV0 = gp.v <= EDGE_TOL || gp.v <= cMinV + EDGE_TOL;
        const touchesV1 = (gp.v + gp.length) >= faceData.height - EDGE_TOL || (gp.v + gp.length) >= cMaxV - EDGE_TOL;

        const u0 = touchesU0 ? Math.min(0, cMinU) : Math.max(0, gp.u);
        const u1 = touchesU1 ? Math.max(faceData.width, cMaxU) : Math.min(faceData.width, gp.u + gp.width);
        const v0 = touchesV0 ? Math.min(0, cMinV) : Math.max(0, gp.v);
        const v1 = touchesV1 ? Math.max(faceData.height, cMaxV) : Math.min(faceData.height, gp.v + gp.length);
        if (u1 - u0 <= EDGE_TOL || v1 - v0 <= EDGE_TOL) continue;

        const isInnerNominal = u0 > EDGE_TOL && u1 < faceData.width - EDGE_TOL &&
                        v0 > EDGE_TOL && v1 < faceData.height - EDGE_TOL;
        const testPoints: [number, number][] = [
            [u0 + EDGE_TOL, v0 + EDGE_TOL],
            [u1 - EDGE_TOL, v0 + EDGE_TOL],
            [u1 - EDGE_TOL, v1 - EDGE_TOL],
            [u0 + EDGE_TOL, v1 - EDGE_TOL],
            [(u0 + u1) / 2, (v0 + v1) / 2]
        ];
        const isInner = !forceNotInner && isInnerNominal && testPoints.every(([px, py]) =>
            isPointInPolygon2D(px, py, outerContour as [number, number][])
        );

        if (isInner) {
            // Wewnętrzny prostokąt: dodajemy jako otwór do earcut (CW),
            // unikając rozcinania lica płyty i tworzenia sztucznych krawędzi przez cały panel
            innerHoles.push([
                [u0, v0],
                [u0, v1],
                [u1, v1],
                [u1, v0]
            ]);
        } else {
            // Otwór przecinający brzeg formatki: modyfikuje obrys materiału
            const nextPolys: number[][][] = [];
            for (const poly of facePolygons) {
                const cutResult = cutBoxFromPolygon(poly, u0, u1, v0, v1);
                if (cutResult) {
                    nextPolys.push(...cutResult);
                } else {
                    nextPolys.push(...subtractBoxFromPolygon(poly, u0, u1, v0, v1));
                }
            }
            facePolygons = nextPolys;
        }
    }

    // 2. Prostokątne otwory przelotowe z innych ścian (np. rewizja ze ściany przeciwnej)
    for (const h of holes2D) {
        if (h.length === 4) {
            const u0 = Math.min(h[0][0], h[1][0], h[2][0], h[3][0]);
            const u1 = Math.max(h[0][0], h[1][0], h[2][0], h[3][0]);
            const v0 = Math.min(h[0][1], h[1][1], h[2][1], h[3][1]);
            const v1 = Math.max(h[0][1], h[1][1], h[2][1], h[3][1]);
            if (u1 - u0 <= EDGE_TOL || v1 - v0 <= EDGE_TOL) continue;

            const rectHole = [
                [u0, v0],
                [u0, v1],
                [u1, v1],
                [u1, v0]
            ];
            const isInner = u0 > EDGE_TOL && u1 < faceData.width - EDGE_TOL &&
                            v0 > EDGE_TOL && v1 < faceData.height - EDGE_TOL &&
                            isPolygonStrictlyInside(rectHole, outerContour as [number, number][], EDGE_TOL);

            if (isInner) {
                const alreadyAdded = innerHoles.some(ih =>
                    Math.abs(ih[0][0] - u0) < EDGE_TOL && Math.abs(ih[2][0] - u1) < EDGE_TOL &&
                    Math.abs(ih[0][1] - v0) < EDGE_TOL && Math.abs(ih[2][1] - v1) < EDGE_TOL
                );
                if (!alreadyAdded) {
                    innerHoles.push([
                        [u0, v0],
                        [u0, v1],
                        [u1, v1],
                        [u1, v0]
                    ]);
                }
            } else {
                const nextPolys: number[][][] = [];
                for (const poly of facePolygons) {
                    const cutResult = cutBoxFromPolygon(poly, u0, u1, v0, v1);
                    if (cutResult) {
                        nextPolys.push(...cutResult);
                    } else {
                        nextPolys.push(...subtractBoxFromPolygon(poly, u0, u1, v0, v1));
                    }
                }
                facePolygons = nextPolys;
            }
        }
    }

    // Otwory do triangulacji earcut: okrągłe + wewnętrzne prostokątne
    const allHoles: number[][][] = [];
    for (const h of holes2D) {
        if (h.length >= 8) {
            allHoles.push(h);
        }
    }
    allHoles.push(...innerHoles);

    triangulatePolygonsWithHoles(facePolygons, allHoles, faceData, 0, faceResult);
}
