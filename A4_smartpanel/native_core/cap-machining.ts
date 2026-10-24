/**
 * Obróbka na ścianach płyty (otwory, wpusty) — wspólna dla box i outline2d.
 * Matematyka 1:1 z historycznej pętli FACE w mesh_builder (copy-move).
 */
import earcut from 'earcut';
import { normalizeFaceName } from '../panel-model.js';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { computeFaceData, localTo3D } from './face-lcs.js';
import { readFeatureUV } from './feature-uv.js';

export { getGrooveParamsMm } from '../../A1_core/groove-params.js';
export { readFeatureUV, hasFeatureParamsUV } from './feature-uv.js';

export type FaceMeshData = { positions: number[]; indices: number[] };
export type CadEdge = { key: string; points: number[][] };

export type FaceBuildResult = {
    mesh: FaceMeshData;
    /** Osobne płaszczyzny B-rep operacji — pickowane jako feature (dno, ścianki). */
    featureMeshes: Record<string, FaceMeshData>;
};

/** Sufiksy kluczy `feature_<id>_<suffix>` — id może zawierać `_`. */
const FEATURE_FACE_SUFFIXES = ['_bottom', '_w0', '_w1', '_w2', '_w3'] as const;

const GROOVE_EDGE_SUFFIXES = [
    '_t1', '_t2', '_t3', '_t4',
    '_b1', '_b2', '_b3', '_b4',
    '_v1', '_v2', '_v3', '_v4',
] as const;

export function parseFeatureFaceKey(faceName: string): { featureId: string; subType: string } | null {
    if (!faceName.startsWith('feature_')) return null;
    const raw = faceName.slice('feature_'.length);
    for (const suffix of FEATURE_FACE_SUFFIXES) {
        if (raw.endsWith(suffix)) {
            return {
                featureId: raw.slice(0, -suffix.length),
                subType: suffix.slice(1),
            };
        }
    }
    const last = raw.lastIndexOf('_');
    if (last <= 0) return { featureId: raw, subType: '' };
    return { featureId: raw.slice(0, last), subType: raw.slice(last + 1) };
}

/** `e_groove_<featureId>_t1` / `e_hole_<featureId>` → id operacji. */
export function featureIdFromBrepEdgeKey(edgeKey: string): string | null {
    const key = String(edgeKey || '');
    if (key.startsWith('e_groove_')) {
        const raw = key.slice('e_groove_'.length);
        for (const suffix of GROOVE_EDGE_SUFFIXES) {
            if (raw.endsWith(suffix)) return raw.slice(0, -suffix.length);
        }
        return raw || null;
    }
    if (key.startsWith('e_hole_')) {
        const raw = key.slice('e_hole_'.length);
        // suffix opcjonalny: '', '_t', '_b', '_0', '_1', …
        const m = raw.match(/^(.*?)(?:_t|_b|_\d+)?$/);
        return (m && m[1]) ? m[1] : (raw || null);
    }
    return null;
}

function emptyMesh(): FaceMeshData {
    return { positions: [], indices: [] };
}

function signedArea2D(poly: number[][]): number {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
        const [x0, y0] = poly[i];
        const [x1, y1] = poly[(i + 1) % poly.length];
        s += x0 * y1 - x1 * y0;
    }
    return s / 2;
}

/**
 * Sutherland–Hodgman: obszar `subject` przycięty wypukłym oknem `convexClip`.
 * Obrys formatki bywa wklęsły (wieniec L), okno — prostokąt wpustu lub koło otworu.
 */
function clipPolygonByConvex(subject: number[][], convexClip: number[][]): number[][] {
    const EPS = 1e-7;
    const win = signedArea2D(convexClip) < 0 ? [...convexClip].reverse() : convexClip;
    let output = subject;

    for (let i = 0; i < win.length && output.length > 0; i++) {
        const a = win[i];
        const b = win[(i + 1) % win.length];
        const side = (p: number[]) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        const cross = (p: number[], q: number[]) => {
            const sp = side(p);
            const t = sp / (sp - side(q));
            return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
        };

        const input = output;
        output = [];
        for (let j = 0; j < input.length; j++) {
            const prev = input[(j + input.length - 1) % input.length];
            const cur = input[j];
            const curIn = side(cur) >= -EPS;
            const prevIn = side(prev) >= -EPS;
            if (curIn) {
                if (!prevIn) output.push(cross(prev, cur));
                output.push(cur);
            } else if (prevIn) {
                output.push(cross(prev, cur));
            }
        }
    }

    return output;
}

function cleanDuplicatePoints(poly: number[][]): number[][] {
    if (poly.length < 3) return [];
    const res: number[][] = [];
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const prev = res.length > 0 ? res[res.length - 1] : poly[poly.length - 1];
        if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-4) {
            res.push(p);
        }
    }
    if (res.length >= 2 && Math.hypot(res[0][0] - res[res.length - 1][0], res[0][1] - res[res.length - 1][1]) < 1e-4) {
        res.pop();
    }
    return res.length >= 3 ? res : [];
}

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

function simplifyCollinear2D(poly: number[][], eps = 0.05): number[][] {
    if (poly.length <= 3) return poly;
    const out: number[][] = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        const prev = poly[(i + n - 1) % n];
        const curr = poly[i];
        const next = poly[(i + 1) % n];

        const d1x = curr[0] - prev[0];
        const d1y = curr[1] - prev[1];
        const d2x = next[0] - curr[0];
        const d2y = next[1] - curr[1];

        const len1 = Math.hypot(d1x, d1y);
        const len2 = Math.hypot(d2x, d2y);
        if (len1 < eps || len2 < eps) continue;

        const cross = (d1x * d2y - d1y * d2x) / (len1 * len2);
        const dot = (d1x * d2x + d1y * d2y) / (len1 * len2);

        if (Math.abs(cross) < 1e-3 && dot > 0.999) {
            continue;
        }
        out.push(curr);
    }
    return out.length >= 3 ? out : poly;
}

function mergeAdjacentPolygons(polys: number[][][]): number[][][] {
    const cleaned = polys
        .map(p => cleanDuplicatePoints(p))
        .filter(p => p.length >= 3 && Math.abs(signedArea2D(p)) > 1e-4);

    if (cleaned.length <= 1) return cleaned;

    const EPS = 0.02;
    const snap = (n: number) => Math.round(n * 100) / 100;
    const ptKey = (p: [number, number]) => `${snap(p[0])},${snap(p[1])}`;

    const allVertices: Array<[number, number]> = [];
    for (const poly of cleaned) {
        for (const [u, v] of poly) {
            if (!allVertices.some(([eu, ev]) => Math.hypot(eu - u, ev - v) <= EPS)) {
                allVertices.push([u, v]);
            }
        }
    }

    interface DirectedSegment {
        p0: [number, number];
        p1: [number, number];
        fwdKey: string;
        revKey: string;
    }

    const segments: DirectedSegment[] = [];

    for (const poly of cleaned) {
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const a = poly[i] as [number, number];
            const b = poly[(i + 1) % n] as [number, number];
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const lenSq = dx * dx + dy * dy;
            if (lenSq < EPS * EPS) continue;

            const splits: Array<{ t: number; pt: [number, number] }> = [];
            for (const v of allVertices) {
                const t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / lenSq;
                if (t > 0.001 && t < 0.999) {
                    const projX = a[0] + t * dx;
                    const projY = a[1] + t * dy;
                    if (Math.hypot(v[0] - projX, v[1] - projY) <= EPS) {
                        splits.push({ t, pt: v });
                    }
                }
            }

            splits.sort((s1, s2) => s1.t - s2.t);
            const chain = [a, ...splits.map(s => s.pt), b];
            for (let j = 0; j < chain.length - 1; j++) {
                const p0 = chain[j];
                const p1 = chain[j + 1];
                if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > EPS) {
                    const k0 = ptKey(p0);
                    const k1 = ptKey(p1);
                    segments.push({
                        p0,
                        p1,
                        fwdKey: `${k0}->${k1}`,
                        revKey: `${k1}->${k0}`
                    });
                }
            }
        }
    }

    const revCount = new Map<string, number>();
    for (const seg of segments) {
        revCount.set(seg.fwdKey, (revCount.get(seg.fwdKey) || 0) + 1);
    }

    const surviving: DirectedSegment[] = [];
    for (const seg of segments) {
        const opposing = revCount.get(seg.revKey) || 0;
        if (opposing > 0) {
            revCount.set(seg.revKey, opposing - 1);
            revCount.set(seg.fwdKey, (revCount.get(seg.fwdKey) || 1) - 1);
        } else {
            surviving.push(seg);
        }
    }

    if (surviving.length === 0) return [];

    const adj = new Map<string, Array<{ toKey: string; pt: [number, number] }>>();
    const ptMap = new Map<string, [number, number]>();

    for (const seg of surviving) {
        const k0 = ptKey(seg.p0);
        const k1 = ptKey(seg.p1);
        ptMap.set(k0, seg.p0);
        ptMap.set(k1, seg.p1);
        if (!adj.has(k0)) adj.set(k0, []);
        adj.get(k0)!.push({ toKey: k1, pt: seg.p1 });
    }

    const mergedLoops: number[][][] = [];
    const visitedEdges = new Set<string>();

    for (const [startKey, edges] of adj.entries()) {
        for (const edge of edges) {
            const edgeId = `${startKey}->${edge.toKey}`;
            if (visitedEdges.has(edgeId)) continue;

            const loop: number[][] = [ptMap.get(startKey)!];
            visitedEdges.add(edgeId);
            let currKey = edge.toKey;
            let stuck = false;

            while (currKey !== startKey) {
                loop.push(ptMap.get(currKey)!);
                const nextEdges = adj.get(currKey) || [];
                const nextEdge = nextEdges.find(e => !visitedEdges.has(`${currKey}->${e.toKey}`));
                if (!nextEdge) {
                    stuck = true;
                    break;
                }
                visitedEdges.add(`${currKey}->${nextEdge.toKey}`);
                currKey = nextEdge.toKey;
                if (loop.length > 500) {
                    stuck = true;
                    break;
                }
            }

            if (!stuck && loop.length >= 3) {
                const simplified = simplifyCollinear2D(loop, EPS);
                if (simplified.length >= 3) {
                    if (signedArea2D(simplified) < 0) {
                        simplified.reverse();
                    }
                    mergedLoops.push(simplified);
                }
            }
        }
    }

    return mergedLoops.length > 0 ? mergedLoops : cleaned;
}

/**
 * Wycina prostokąt brzegowy bezpośrednio z dowolnego czworokąta osiowego (CCW),
 * tworząc pojedynczy wielokąt (np. 6-kąt w narożniku lub 8-kąt przy wcince bocznej),
 * eliminując podział płyty na paski i zapobiegając poziomym liniom na całej formatce.
 */
function cutBoxFromPolygon(
    poly: number[][],
    u0: number, u1: number,
    v0: number, v1: number
): number[][][] | null {
    if (!poly || poly.length < 3) return null;
    if (poly.length !== 4) {
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
function clipHolesToContour(holes2D: number[][][], outerContour: number[][]): number[][][] {
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

function clipIntervals(
    start: number,
    end: number,
    holes: Array<[number, number]>
): Array<[number, number]> {
    let segments: Array<[number, number]> = [[start, end]];
    const EPS = 0.05;

    for (const [h0, h1] of holes) {
        const next: Array<[number, number]> = [];
        for (const [s0, s1] of segments) {
            if (h1 <= s0 + EPS || h0 >= s1 - EPS) {
                next.push([s0, s1]);
                continue;
            }
            if (h0 > s0 + EPS) {
                next.push([s0, h0]);
            }
            if (h1 < s1 - EPS) {
                next.push([h1, s1]);
            }
        }
        segments = next;
    }
    return segments.filter(([s0, s1]) => s1 - s0 > EPS);
}

function appendQuad(mesh: FaceMeshData, pA: number[], pB: number[], pC: number[], pD: number[]) {
    const idx = mesh.positions.length / 3;
    mesh.positions.push(...pA, ...pB, ...pC, ...pD);
    mesh.indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
}

function appendTriangle(mesh: FaceMeshData, pA: number[], pB: number[], pC: number[]) {
    const idx = mesh.positions.length / 3;
    mesh.positions.push(...pA, ...pB, ...pC);
    mesh.indices.push(idx, idx + 1, idx + 2);
}

export function generateCircle(cx: number, cy: number, r: number, segments: number = 24) {
    const pts: number[][] = [];
    for (let i = 0; i < segments; i++) {
        const theta = (2 * Math.PI * i) / segments;
        pts.push([cx + r * Math.cos(theta), cy + r * Math.sin(theta)]);
    }
    return pts;
}

export function isFeatureSkipped(feat: any): boolean {
    if (!feat) return true;
    if (feat.visible === false || feat.frozen || feat.params?.frozen) return true;
    if (feat.is_assembly_drilling || feat.params?.is_assembly_drilling) return true;
    return false;
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
        const faceData = computeFaceData(feat.face, w, h, t);
        const p00_0 = localTo3D(faceData, gp.u, gp.v, 0);
        const p11_d = localTo3D(faceData, gp.u + gp.width, gp.v + gp.length, gp.depth);

        const min = [
            Math.min(p00_0[0], p11_d[0]), Math.min(p00_0[1], p11_d[1]), Math.min(p00_0[2], p11_d[2])
        ];
        const max = [
            Math.max(p00_0[0], p11_d[0]), Math.max(p00_0[1], p11_d[1]), Math.max(p00_0[2], p11_d[2])
        ];

        const EPS = 0.01;
        const hw = w / 2, hh = h / 2, ht = t / 2;
        const featFace = feat.face ? normalizeFaceName(feat.face) : (feat.side ? normalizeFaceName(feat.side) : '');
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

export interface LGrooveUnion {
    gA: any;
    gB: any;
    polygon: [number, number][];
    innerCorner: [number, number];
    depth: number;
    face: string;
}

export function detectLGrooveUnion(grooves: any[] | undefined, w?: number, h?: number): LGrooveUnion | null {
    if (!grooves || grooves.length < 2) return null;
    const EPS = 0.05;
    for (let i = 0; i < grooves.length; i++) {
        for (let j = i + 1; j < grooves.length; j++) {
            const g1 = grooves[i];
            const g2 = grooves[j];
            if (!g1 || !g2 || isFeatureSkipped(g1) || isFeatureSkipped(g2)) continue;
            if (g1.type !== 'groove' && g1.type !== 'pocket') continue;
            if (g2.type !== 'groove' && g2.type !== 'pocket') continue;

            const face1 = normalizeFaceName(g1.face || g1.side || '');
            const face2 = normalizeFaceName(g2.face || g2.side || '');
            if (face1 !== face2) continue;

            const gp1 = getGrooveParamsMm(g1.params);
            const gp2 = getGrooveParamsMm(g2.params);
            if (Math.abs(gp1.depth - gp2.depth) > EPS) continue;

            const u1_0 = gp1.u, u1_1 = gp1.u + gp1.width;
            const v1_0 = gp1.v, v1_1 = gp1.v + gp1.length;
            const u2_0 = gp2.u, u2_1 = gp2.u + gp2.width;
            const v2_0 = gp2.v, v2_1 = gp2.v + gp2.length;

            const inU0 = Math.max(u1_0, u2_0);
            const inU1 = Math.min(u1_1, u2_1);
            const inV0 = Math.max(v1_0, v2_0);
            const inV1 = Math.min(v1_1, v2_1);

            if (inU1 - inU0 > EPS && inV1 - inV0 > EPS) {
                const is1AlongU = (u1_1 - u1_0) > (v1_1 - v1_0);
                const is2AlongV = (v2_1 - v2_0) > (u2_1 - u2_0);
                const is2AlongU = (u2_1 - u2_0) > (v2_1 - v2_0);
                const is1AlongV = (v1_1 - v1_0) > (u1_1 - u1_0);

                if (!((is1AlongU && is2AlongV) || (is2AlongU && is1AlongV))) continue;

                const gA = is1AlongU ? g1 : g2;
                const gB = is1AlongU ? g2 : g1;
                const gpA = is1AlongU ? gp1 : gp2;
                const gpB = is1AlongU ? gp2 : gp1;

                const uA0 = gpA.u, uA1 = gpA.u + gpA.width;
                const vA0 = gpA.v, vA1 = gpA.v + gpA.length;
                const uB0 = gpB.u, uB1 = gpB.u + gpB.width;
                const vB0 = gpB.v, vB1 = gpB.v + gpB.length;

                const Umin = Math.min(uA0, uB0);
                const Umax = Math.max(uA1, uB1);
                const Vmin = Math.min(vA0, vB0);
                const Vmax = Math.max(vA1, vB1);
                const depth = gpA.depth;

                let polygon: [number, number][] | null = null;
                let innerCorner: [number, number] = [inU0, inV0];

                if (inU1 >= Umax - EPS && inV1 >= Vmax - EPS) {
                    innerCorner = [inU0, inV0];
                    polygon = [
                        [Umin, inV0],
                        [inU0, inV0],
                        [inU0, Vmin],
                        [Umax, Vmin],
                        [Umax, Vmax],
                        [Umin, Vmax]
                    ];
                } else if (inU0 <= Umin + EPS && inV1 >= Vmax - EPS) {
                    innerCorner = [inU1, inV0];
                    polygon = [
                        [Umin, Vmin],
                        [Umin, Vmax],
                        [Umax, Vmax],
                        [Umax, inV0],
                        [inU1, inV0],
                        [inU1, Vmin]
                    ];
                } else if (inU1 >= Umax - EPS && inV0 <= Vmin + EPS) {
                    innerCorner = [inU0, inV1];
                    polygon = [
                        [Umin, Vmin],
                        [Umax, Vmin],
                        [Umax, Vmax],
                        [inU0, Vmax],
                        [inU0, inV1],
                        [Umin, inV1]
                    ];
                } else if (inU0 <= Umin + EPS && inV0 <= Vmin + EPS) {
                    innerCorner = [inU1, inV1];
                    polygon = [
                        [Umin, Vmax],
                        [Umin, Vmin],
                        [Umax, Vmin],
                        [Umax, inV1],
                        [inU1, inV1],
                        [inU1, Vmax]
                    ];
                }

                if (polygon) {
                    if (w !== undefined && h !== undefined) {
                        const isEdgeCorner = (
                            (Math.abs(Umax - w) <= 1 || Math.abs(Umin) <= 1) &&
                            (Math.abs(Vmax - h) <= 1 || Math.abs(Vmin) <= 1)
                        );
                        if (!isEdgeCorner) {
                            continue;
                        }
                    }
                    return { gA, gB, polygon, innerCorner, depth, face: face1 };
                }
            }
        }
    }
    return null;
}

export function featuresOnFace(features: any[] | undefined, face: string): any[] {
    if (!features) return [];
    return features.filter((f: any) => {
        if (isFeatureSkipped(f)) return false;
        const fFace = f.face ? normalizeFaceName(f.face) : (f.side ? normalizeFaceName(f.side) : '');
        return fFace === face;
    });
}

function isEdgeOnContour(p0: [number, number], p1: [number, number], contour: number[][], eps = 0.05): boolean {
    if (!contour || contour.length < 2) return false;
    const n = contour.length;
    for (let i = 0; i < n; i++) {
        const c0 = contour[i];
        const c1 = contour[(i + 1) % n];
        if (Math.abs(c0[0] - c1[0]) <= eps && Math.abs(p0[0] - p1[0]) <= eps) {
            if (Math.abs(p0[0] - c0[0]) <= eps) {
                const minC = Math.min(c0[1], c1[1]) - eps;
                const maxC = Math.max(c0[1], c1[1]) + eps;
                if (p0[1] >= minC && p0[1] <= maxC && p1[1] >= minC && p1[1] <= maxC) {
                    return true;
                }
            }
        }
        if (Math.abs(c0[1] - c1[1]) <= eps && Math.abs(p0[1] - p1[1]) <= eps) {
            if (Math.abs(p0[1] - c0[1]) <= eps) {
                const minC = Math.min(c0[0], c1[0]) - eps;
                const maxC = Math.max(c0[0], c1[0]) + eps;
                if (p0[0] >= minC && p0[0] <= maxC && p1[0] >= minC && p1[0] <= maxC) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function buildFaceMeshWithFeatures(opts: {
    faceData: ReturnType<typeof computeFaceData>;
    outerContour: number[][];
    extraHoles: number[][][];
    featuresOnFace: any[];
    w: number;
    h: number;
    t: number;
}): FaceBuildResult {
    const { faceData, outerContour, extraHoles, featuresOnFace: feats, w, h, t } = opts;
    const holes2D: number[][][] = extraHoles ? [...extraHoles] : [];
    const faceResult: FaceMeshData = emptyMesh();
    const featureMeshes: Record<string, FaceMeshData> = {};
    const lUnion = detectLGrooveUnion(feats, w, h);

    for (const feat of feats) {
        if (feat.type === 'hole') {
            const { u: cxRaw, v: cyRaw } = readFeatureUV(feat.params);
            const r = (feat.params.diameter || 35) / 2;
            const depth = feat.params.depth || 10;

            const template = feat.params.template_id || 'SINGLE';
            const spacing = feat.params.spacing || 32;

            const holeCenters: { cx: number, cy: number }[] = [];
            if (template === 'TRIPLE') {
                const offsetZ = feat.params.offsetZ || 32;
                holeCenters.push({ cx: cxRaw, cy: cyRaw });
                holeCenters.push({ cx: cxRaw, cy: cyRaw + offsetZ });
                holeCenters.push({ cx: cxRaw, cy: cyRaw - offsetZ });
            } else if (template === 'SYSTEM_32' || template === 'ROW') {
                const count = feat.params.count || 5;
                for (let i = 0; i < count; i++) {
                    holeCenters.push({ cx: cxRaw, cy: cyRaw + i * spacing });
                }
            } else {
                holeCenters.push({ cx: cxRaw, cy: cyRaw });
            }

            for (const { cx, cy } of holeCenters) {
                const isInsideFace = cx >= r && cx <= (faceData.width - r) && cy >= r && cy <= (faceData.height - r);

                if (isInsideFace) {
                    const circle = generateCircle(cx, cy, r, 24).reverse();
                    holes2D.push(circle);

                    const segments = 24;
                    const p3dTop: number[][] = [];
                    const p3dBottom: number[][] = [];
                    for (const p of circle) {
                        p3dTop.push(localTo3D(faceData, p[0], p[1], 0));
                        p3dBottom.push(localTo3D(faceData, p[0], p[1], depth));
                    }
                    const pCenterBottom = localTo3D(faceData, cx, cy, depth);

                    const isHoleThrough = feat.params?.through === true
                        || feat.params?.kind === 'THROUGH'
                        || (String(feat.face || '').includes('FACE_Z') && depth >= t - 0.05);

                    // Bez guarda AABB: p3dTop leży zawsze na licu wiercenia (|n|≈t/2),
                    // więc stary warunek |pA| >= half - EPS kasował WSZYSTKIE ścianki,
                    // a przy otworze na krawędzi — także dno (pA na boku płyty).
                    // Przy wierceniu na wylot (through) nie domykamy denka.
                    for (let i = 0; i < segments; i++) {
                        const nextI = (i + 1) % segments;
                        if (!isHoleThrough) {
                            appendTriangle(faceResult, p3dBottom[i], pCenterBottom, p3dBottom[nextI]);
                        }
                        appendQuad(faceResult, p3dTop[i], p3dTop[nextI], p3dBottom[nextI], p3dBottom[i]);
                    }
                }
            }
        } else if (feat.type === 'groove' || feat.type === 'pocket' || feat.type === 'cutout') {
            if (lUnion && (feat === lUnion.gA || feat === lUnion.gB)) {
                if (feat === lUnion.gB) continue;
                const fidA = String(lUnion.gA.id || lUnion.gA.type || 'groove_L');
                const depth = lUnion.depth;

                // 1. Dno L (triangulacja earcut)
                const flat = lUnion.polygon.flat();
                const triIndices = earcut(flat, [], 2);
                const bottom = emptyMesh();
                for (const [u, v] of lUnion.polygon) {
                    bottom.positions.push(...localTo3D(faceData, u, v, depth));
                }
                bottom.indices.push(...triIndices);
                featureMeshes[`feature_${fidA}_bottom`] = bottom;

                // 2. Ścianki pionowe tylko dla krawędzi wewnętrznych
                const w0 = emptyMesh();
                for (let k = 0; k < lUnion.polygon.length; k++) {
                    const pA = lUnion.polygon[k];
                    const pB = lUnion.polygon[(k + 1) % lUnion.polygon.length];
                    if (!isEdgeOnContour(pA, pB, outerContour)) {
                        appendQuad(
                            w0,
                            localTo3D(faceData, pA[0], pA[1], 0),
                            localTo3D(faceData, pA[0], pA[1], depth),
                            localTo3D(faceData, pB[0], pB[1], depth),
                            localTo3D(faceData, pB[0], pB[1], 0)
                        );
                    }
                }
                if (w0.positions.length > 0) {
                    featureMeshes[`feature_${fidA}_w0`] = w0;
                }
                continue;
            }
            const gp = getGrooveParamsMm(feat.params);
            const uRaw = gp.u;
            const vRaw = gp.v;
            const wRaw = gp.width;
            const hRaw = gp.length;
            const depth = gp.depth;

            const u0 = Math.max(0, uRaw);
            const u1 = Math.min(faceData.width, uRaw + wRaw);
            const v0 = Math.max(0, vRaw);
            const v1 = Math.min(faceData.height, vRaw + hRaw);

            if (u1 <= u0 || v1 <= v0) continue;

            // Otwór wlotu wpustu dostarcza collectExtraHoles2D (opts.extraHoles) — drugi,
            // pokrywający się kontur rozsypuje earcut i czapka gubi wielkie połacie.

            const p00_0 = localTo3D(faceData, u0, v0, 0);
            const p10_0 = localTo3D(faceData, u1, v0, 0);
            const p11_0 = localTo3D(faceData, u1, v1, 0);
            const p01_0 = localTo3D(faceData, u0, v1, 0);

            const p00_d = localTo3D(faceData, u0, v0, depth);
            const p10_d = localTo3D(faceData, u1, v0, depth);
            const p11_d = localTo3D(faceData, u1, v1, depth);
            const p01_d = localTo3D(faceData, u0, v1, depth);

            const fid = String(feat.id || feat.type || 'area_feature');
            const isGrooveThrough = feat.type === 'cutout'
                || feat.params?.through === true
                || feat.params?.kind === 'THROUGH'
                || (String(feat.face || '').includes('FACE_Z') && depth >= t - 0.05);

            // Inne wpusty/kieszenie na tym licu o tej samej lub większej głębokości (np. prostopadły wpust w narożniku L)
            const otherGrooves = feats
                .filter((f: any) => f !== feat && (f.type === 'groove' || f.type === 'pocket' || f.type === 'cutout'))
                .map((f: any) => {
                    const p = getGrooveParamsMm(f.params);
                    return {
                        id: String(f.id || f.type || ''),
                        u0: Math.max(0, p.u),
                        u1: Math.min(faceData.width, p.u + p.width),
                        v0: Math.max(0, p.v),
                        v1: Math.min(faceData.height, p.v + p.length),
                        depth: p.depth || 0
                    };
                });

            if (!isGrooveThrough) {
                const bottom = emptyMesh();
                // Sprawdzamy czy wcześniejszy wpust nie pokrył już wspólnego narożnika
                let botU0 = u0;
                let botU1 = u1;
                let botV0 = v0;
                let botV1 = v1;
                for (const o of otherGrooves) {
                    if (Math.abs(o.depth - depth) < 0.05) {
                        const inU0 = Math.max(u0, o.u0);
                        const inU1 = Math.min(u1, o.u1);
                        const inV0 = Math.max(v0, o.v0);
                        const inV1 = Math.min(v1, o.v1);
                        if (inU1 - inU0 > 0.05 && inV1 - inV0 > 0.05) {
                            // Jeśli ten wpust jest wzdłuż V (dłuższy w V niż w U), a drugi wzdłuż U:
                            // ustępujemy narożnik drugiemu wpustowi, skracając dno w V
                            if ((v1 - v0) > (u1 - u0)) {
                                if (Math.abs(inV1 - v1) < 0.05) botV1 = Math.min(botV1, inV0);
                                else if (Math.abs(inV0 - v0) < 0.05) botV0 = Math.max(botV0, inV1);
                            }
                        }
                    }
                }
                const p00_d_bot = localTo3D(faceData, botU0, botV0, depth);
                const p10_d_bot = localTo3D(faceData, botU1, botV0, depth);
                const p11_d_bot = localTo3D(faceData, botU1, botV1, depth);
                const p01_d_bot = localTo3D(faceData, botU0, botV1, depth);
                appendQuad(bottom, p00_d_bot, p10_d_bot, p11_d_bot, p01_d_bot);
                featureMeshes[`feature_${fid}_bottom`] = bottom;
            }

            // Ścianki współpłaszczyznowe z zewnętrznymi licami (przelot U/V) = „cienkie
            // płaszczyzny” — nie rysuj; otwór i tak wycina collectExtraHoles2D lub leży na obrysie formatki.
            // Ponadto odcinamy fragmenty ścianek, które wchodzą w światło innego wpustu (np. w narożniku L).
            const EDGE_EPS = 0.05;

            // w0: na linii v = v0, u in [u0, u1]
            const holesW0: Array<[number, number]> = [];
            for (const o of otherGrooves) {
                if (o.depth >= depth - EDGE_EPS && v0 >= o.v0 - EDGE_EPS && v0 < o.v1 - EDGE_EPS) {
                    const hU0 = Math.max(u0, o.u0);
                    const hU1 = Math.min(u1, o.u1);
                    if (hU1 - hU0 > EDGE_EPS) holesW0.push([hU0, hU1]);
                }
            }
            const segsW0 = clipIntervals(u0, u1, holesW0);
            const w0 = emptyMesh();
            for (const [su0, su1] of segsW0) {
                if (v0 > EDGE_EPS && !isEdgeOnContour([su0, v0], [su1, v0], outerContour)) {
                    appendQuad(
                        w0,
                        localTo3D(faceData, su0, v0, 0),
                        localTo3D(faceData, su0, v0, depth),
                        localTo3D(faceData, su1, v0, depth),
                        localTo3D(faceData, su1, v0, 0)
                    );
                }
            }
            if (w0.positions.length > 0) {
                featureMeshes[`feature_${fid}_w0`] = w0;
            }

            // w2: na linii v = v1, u in [u0, u1]
            const holesW2: Array<[number, number]> = [];
            for (const o of otherGrooves) {
                if (o.depth >= depth - EDGE_EPS && v1 > o.v0 + EDGE_EPS && v1 <= o.v1 + EDGE_EPS) {
                    const hU0 = Math.max(u0, o.u0);
                    const hU1 = Math.min(u1, o.u1);
                    if (hU1 - hU0 > EDGE_EPS) holesW2.push([hU0, hU1]);
                }
            }
            const segsW2 = clipIntervals(u0, u1, holesW2);
            const w2 = emptyMesh();
            for (const [su0, su1] of segsW2) {
                if (v1 < faceData.height - EDGE_EPS && !isEdgeOnContour([su0, v1], [su1, v1], outerContour)) {
                    appendQuad(
                        w2,
                        localTo3D(faceData, su1, v1, 0),
                        localTo3D(faceData, su1, v1, depth),
                        localTo3D(faceData, su0, v1, depth),
                        localTo3D(faceData, su0, v1, 0)
                    );
                }
            }
            if (w2.positions.length > 0) {
                featureMeshes[`feature_${fid}_w2`] = w2;
            }

            // w3: na linii u = u0, v in [v0, v1]
            const holesW3: Array<[number, number]> = [];
            for (const o of otherGrooves) {
                if (o.depth >= depth - EDGE_EPS && u0 >= o.u0 - EDGE_EPS && u0 < o.u1 - EDGE_EPS) {
                    const hV0 = Math.max(v0, o.v0);
                    const hV1 = Math.min(v1, o.v1);
                    if (hV1 - hV0 > EDGE_EPS) holesW3.push([hV0, hV1]);
                }
            }
            const segsW3 = clipIntervals(v0, v1, holesW3);
            const w3 = emptyMesh();
            for (const [sv0, sv1] of segsW3) {
                if (u0 > EDGE_EPS && !isEdgeOnContour([u0, sv0], [u0, sv1], outerContour)) {
                    appendQuad(
                        w3,
                        localTo3D(faceData, u0, sv1, 0),
                        localTo3D(faceData, u0, sv1, depth),
                        localTo3D(faceData, u0, sv0, depth),
                        localTo3D(faceData, u0, sv0, 0)
                    );
                }
            }
            if (w3.positions.length > 0) {
                featureMeshes[`feature_${fid}_w3`] = w3;
            }

            // w1: na linii u = u1, v in [v0, v1]
            const holesW1: Array<[number, number]> = [];
            for (const o of otherGrooves) {
                if (o.depth >= depth - EDGE_EPS && u1 > o.u0 + EDGE_EPS && u1 <= o.u1 + EDGE_EPS) {
                    const hV0 = Math.max(v0, o.v0);
                    const hV1 = Math.min(v1, o.v1);
                    if (hV1 - hV0 > EDGE_EPS) holesW1.push([hV0, hV1]);
                }
            }
            const segsW1 = clipIntervals(v0, v1, holesW1);
            const w1 = emptyMesh();
            for (const [sv0, sv1] of segsW1) {
                if (u1 < faceData.width - EDGE_EPS && !isEdgeOnContour([u1, sv0], [u1, sv1], outerContour)) {
                    appendQuad(
                        w1,
                        localTo3D(faceData, u1, sv0, 0),
                        localTo3D(faceData, u1, sv0, depth),
                        localTo3D(faceData, u1, sv1, depth),
                        localTo3D(faceData, u1, sv1, 0)
                    );
                }
            }
            if (w1.positions.length > 0) {
                featureMeshes[`feature_${fid}_w1`] = w1;
            }
        } else {
            console.warn(`[cap-machining] Pominięto nieobsługiwany typ feature: "${feat?.type}" (id: ${feat?.id ?? 'brak'}). Dozwolone typy to 'hole' i 'groove'.`);
            continue;
        }
    }

    // Podział lica na rozłączne wielokąty materiału przez wycięcie obszarów wpustów/kieszeni
    const areaFeats = feats.filter(
        (f: any) => !isFeatureSkipped(f) && (f.type === 'groove' || f.type === 'pocket' || f.type === 'cutout')
    );

    const EDGE_TOL = 0.05;
    const innerHoles: number[][][] = [];
    let facePolygons: number[][][] = [outerContour];

    // 1. Cechy obszarowe na tym licu (wpusty, kieszenie, wycięcia)
    for (const feat of areaFeats) {
        const gp = getGrooveParamsMm(feat.params);
        const u0 = Math.max(0, gp.u);
        const u1 = Math.min(faceData.width, gp.u + gp.width);
        const v0 = Math.max(0, gp.v);
        const v1 = Math.min(faceData.height, gp.v + gp.length);
        if (u1 - u0 <= EDGE_TOL || v1 - v0 <= EDGE_TOL) continue;

        const isInner = u0 > EDGE_TOL && u1 < faceData.width - EDGE_TOL &&
                        v0 > EDGE_TOL && v1 < faceData.height - EDGE_TOL;

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

            const isInner = u0 > EDGE_TOL && u1 < faceData.width - EDGE_TOL &&
                            v0 > EDGE_TOL && v1 < faceData.height - EDGE_TOL;

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

    for (const poly of facePolygons) {
        const flatVertices: number[] = [];
        const holeIndices: number[] = [];

        for (const [u, v] of poly) {
            flatVertices.push(u, v);
        }

        for (const hole of allHoles) {
            const cx = hole.reduce((s, p) => s + p[0], 0) / hole.length;
            const cy = hole.reduce((s, p) => s + p[1], 0) / hole.length;
            if (isPointInPolygon2D(cx, cy, poly as [number, number][])) {
                holeIndices.push(flatVertices.length / 2);
                for (const [hu, hv] of hole) {
                    flatVertices.push(hu, hv);
                }
            }
        }

        const triangles = earcut(flatVertices, holeIndices, 2);
        const offset = faceResult.positions.length / 3;
        for (let i = 0; i < flatVertices.length; i += 2) {
            const u = flatVertices[i];
            const v = flatVertices[i + 1];
            faceResult.positions.push(...localTo3D(faceData, u, v, 0));
        }

        for (const idx of triangles) {
            faceResult.indices.push(idx + offset);
        }
    }

    return { mesh: faceResult, featureMeshes };
}

function clipEdgesByMouths(existingEdges: CadEdge[], mouths: Array<{ p0: number[]; p1: number[] }>): CadEdge[] {
    if (mouths.length === 0 || existingEdges.length === 0) return [...existingEdges];

    const out: CadEdge[] = [];
    const EPS = 0.05;

    for (const edge of existingEdges) {
        if (!edge.points || edge.points.length !== 2) {
            out.push(edge);
            continue;
        }

        const A = edge.points[0];
        const B = edge.points[1];
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const dz = B[2] - A[2];
        const L = Math.hypot(dx, dy, dz);
        if (L < 1e-4) {
            out.push(edge);
            continue;
        }

        const ux = dx / L;
        const uy = dy / L;
        const uz = dz / L;

        const cutIntervals: Array<[number, number]> = [];

        for (const mouth of mouths) {
            const P0 = mouth.p0;
            const P1 = mouth.p1;

            const v0x = P0[0] - A[0];
            const v0y = P0[1] - A[1];
            const v0z = P0[2] - A[2];
            const s0 = v0x * ux + v0y * uy + v0z * uz;
            const perp0x = v0x - s0 * ux;
            const perp0y = v0y - s0 * uy;
            const perp0z = v0z - s0 * uz;
            const dist0Sq = perp0x * perp0x + perp0y * perp0y + perp0z * perp0z;

            const v1x = P1[0] - A[0];
            const v1y = P1[1] - A[1];
            const v1z = P1[2] - A[2];
            const s1 = v1x * ux + v1y * uy + v1z * uz;
            const perp1x = v1x - s1 * ux;
            const perp1y = v1y - s1 * uy;
            const perp1z = v1z - s1 * uz;
            const dist1Sq = perp1x * perp1x + perp1y * perp1y + perp1z * perp1z;

            if (dist0Sq <= EPS * EPS && dist1Sq <= EPS * EPS) {
                const sMin = Math.min(s0, s1);
                const sMax = Math.max(s0, s1);
                const cStart = Math.max(0, sMin);
                const cEnd = Math.min(L, sMax);
                if (cEnd - cStart > EPS) {
                    cutIntervals.push([cStart, cEnd]);
                }
            }
        }

        if (cutIntervals.length === 0) {
            out.push(edge);
            continue;
        }

        cutIntervals.sort((a, b) => a[0] - b[0]);
        const merged: Array<[number, number]> = [cutIntervals[0]];
        for (let i = 1; i < cutIntervals.length; i++) {
            const prev = merged[merged.length - 1];
            const curr = cutIntervals[i];
            if (curr[0] <= prev[1] + EPS) {
                prev[1] = Math.max(prev[1], curr[1]);
            } else {
                merged.push(curr);
            }
        }

        const surviving: Array<[number, number]> = [];
        let currPos = 0;
        for (const [startCut, endCut] of merged) {
            if (startCut - currPos > EPS) {
                surviving.push([currPos, startCut]);
            }
            currPos = Math.max(currPos, endCut);
        }
        if (L - currPos > EPS) {
            surviving.push([currPos, L]);
        }

        if (surviving.length === 0) {
            continue;
        }

        for (let i = 0; i < surviving.length; i++) {
            const [sA, sB] = surviving[i];
            const pA = [A[0] + sA * ux, A[1] + sA * uy, A[2] + sA * uz];
            const pB = [A[0] + sB * ux, A[1] + sB * uy, A[2] + sB * uz];
            const key = i === 0 ? edge.key : `${edge.key}_${i}`;
            out.push({
                key,
                points: [pA, pB]
            });
        }
    }

    return out;
}

export function appendFeatureEdges(
    edges: CadEdge[],
    features: any[] | undefined,
    w: number,
    h: number,
    t: number,
    customFaceDataMap?: Record<string, any>,
    outerContourParam?: number[][]
): void {
    if (!features) return;

    const mouths: Array<{ p0: number[]; p1: number[] }> = [];
    const featureEdges: CadEdge[] = [];
    const outerContour = outerContourParam || [[0, 0], [w, 0], [w, h], [0, h]];
    const lUnion = detectLGrooveUnion(features, w, h);

    for (const feat of features) {
        if (isFeatureSkipped(feat)) continue;
        const normFace = normalizeFaceName(feat.face || feat.side || '');
        const faceData = (customFaceDataMap && customFaceDataMap[normFace]) || computeFaceData(normFace, w, h, t);
        if (feat.type === 'hole') {
            const { u: cxRaw, v: cyRaw } = readFeatureUV(feat.params);
            const r = (feat.params.diameter || 35) / 2;

            const template = feat.params.template_id || 'SINGLE';
            const spacing = feat.params.spacing || 32;

            const holeCenters: { cx: number, cy: number, suffix: string }[] = [];
            if (template === 'TRIPLE') {
                const offsetZ = feat.params.offsetZ || 32;
                holeCenters.push({ cx: cxRaw, cy: cyRaw, suffix: '' });
                holeCenters.push({ cx: cxRaw, cy: cyRaw + offsetZ, suffix: '_t' });
                holeCenters.push({ cx: cxRaw, cy: cyRaw - offsetZ, suffix: '_b' });
            } else if (template === 'SYSTEM_32' || template === 'ROW') {
                const count = feat.params.count || 5;
                for (let i = 0; i < count; i++) {
                    holeCenters.push({ cx: cxRaw, cy: cyRaw + i * spacing, suffix: `_${i}` });
                }
            } else {
                holeCenters.push({ cx: cxRaw, cy: cyRaw, suffix: '' });
            }

            for (const { cx, cy, suffix } of holeCenters) {
                const circle2D = generateCircle(cx, cy, r, 24);
                circle2D.push(circle2D[0]);
                const points = circle2D.map(p => localTo3D(faceData, p[0], p[1], 0));
                featureEdges.push({
                    key: `e_hole_${feat.id}${suffix}`,
                    points
                });
            }
        } else if (feat.type === 'groove' || feat.type === 'pocket' || feat.type === 'cutout') {
            if (lUnion && (feat === lUnion.gA || feat === lUnion.gB)) {
                if (feat === lUnion.gB) continue;
                const fidA = String(lUnion.gA.id || lUnion.gA.type || 'groove_L');
                const depth = lUnion.depth;
                const isLThrough = depth >= t - 0.05;

                for (let k = 0; k < lUnion.polygon.length; k++) {
                    const pA = lUnion.polygon[k];
                    const pB = lUnion.polygon[(k + 1) % lUnion.polygon.length];
                    const pA_0 = localTo3D(faceData, pA[0], pA[1], 0);
                    const pB_0 = localTo3D(faceData, pB[0], pB[1], 0);
                    const pA_d = localTo3D(faceData, pA[0], pA[1], depth);
                    const pB_d = localTo3D(faceData, pB[0], pB[1], depth);

                    const onContour = isEdgeOnContour(pA, pB, outerContour);
                    if (onContour) {
                        mouths.push({ p0: pA_0, p1: pB_0 });
                        if (isLThrough) {
                            mouths.push({ p0: pA_d, p1: pB_d });
                        }
                    } else {
                        featureEdges.push({ key: `e_groove_${fidA}_t${k + 1}`, points: [pA_0, pB_0] });
                    }

                    if (!isLThrough || !onContour) {
                        featureEdges.push({ key: `e_groove_${fidA}_b${k + 1}`, points: [pA_d, pB_d] });
                    }
                }

                // Krawędź pionowa w narożniku wewnętrznym
                const pCorner_0 = localTo3D(faceData, lUnion.innerCorner[0], lUnion.innerCorner[1], 0);
                const pCorner_d = localTo3D(faceData, lUnion.innerCorner[0], lUnion.innerCorner[1], depth);
                featureEdges.push({ key: `e_groove_${fidA}_v_corner`, points: [pCorner_0, pCorner_d] });

                // Krawędzie pionowe: styk ścianki z obrysem (mouth) oraz narożnik dwóch ścianek
                // (rowek U odsunięty od krawędzi — wszystkie narożniki poza wewnętrznym).
                for (let k = 0; k < lUnion.polygon.length; k++) {
                    const pA = lUnion.polygon[k];
                    const pPrev = lUnion.polygon[(k + lUnion.polygon.length - 1) % lUnion.polygon.length];
                    const pNext = lUnion.polygon[(k + 1) % lUnion.polygon.length];
                    const isPrevOnContour = isEdgeOnContour(pPrev, pA, outerContour);
                    const isNextOnContour = isEdgeOnContour(pA, pNext, outerContour);
                    const isInner = Math.abs(pA[0] - lUnion.innerCorner[0]) <= 0.05
                        && Math.abs(pA[1] - lUnion.innerCorner[1]) <= 0.05;
                    const pA_0 = localTo3D(faceData, pA[0], pA[1], 0);
                    const pA_d = localTo3D(faceData, pA[0], pA[1], depth);
                    if (isPrevOnContour !== isNextOnContour) {
                        featureEdges.push({ key: `e_groove_${fidA}_v_mouth_${k}`, points: [pA_0, pA_d] });
                    } else if (!isPrevOnContour && !isNextOnContour && !isInner) {
                        featureEdges.push({ key: `e_groove_${fidA}_v_wall_${k}`, points: [pA_0, pA_d] });
                    }
                }
                continue;
            }
            const gp = getGrooveParamsMm(feat.params);
            const u0 = gp.u;
            const v0 = gp.v;
            const gw = gp.width;
            const gh = gp.length;
            const depth = gp.depth;

            const u1 = u0 + gw;
            const v1 = v0 + gh;

            const p00_0 = localTo3D(faceData, u0, v0, 0);
            const p10_0 = localTo3D(faceData, u1, v0, 0);
            const p11_0 = localTo3D(faceData, u1, v1, 0);
            const p01_0 = localTo3D(faceData, u0, v1, 0);

            const p00_d = localTo3D(faceData, u0, v0, depth);
            const p10_d = localTo3D(faceData, u1, v0, depth);
            const p11_d = localTo3D(faceData, u1, v1, depth);
            const p01_d = localTo3D(faceData, u0, v1, depth);

            const isGrooveThrough = feat.type === 'cutout'
                || feat.params?.through === true
                || feat.params?.kind === 'THROUGH'
                || (normFace.includes('FACE_Z') && depth >= t - 0.05);

            const EDGE_EPS = 0.05;
            const throughU0 = u0 <= EDGE_EPS || isEdgeOnContour([u0, v0], [u0, v1], outerContour);
            const throughU1 = u1 >= faceData.width - EDGE_EPS || isEdgeOnContour([u1, v0], [u1, v1], outerContour);
            const throughV0 = v0 <= EDGE_EPS || isEdgeOnContour([u0, v0], [u1, v0], outerContour);
            const throughV1 = v1 >= faceData.height - EDGE_EPS || isEdgeOnContour([u0, v1], [u1, v1], outerContour);

            if (throughU0) mouths.push({ p0: p00_0, p1: p01_0 });
            if (throughU1) mouths.push({ p0: p10_0, p1: p11_0 });
            if (throughV0) mouths.push({ p0: p00_0, p1: p10_0 });
            if (throughV1) mouths.push({ p0: p01_0, p1: p11_0 });

            // Jeśli cecha jest przelotowa (np. rewizja / cutout), wycinamy także paszcze na przeciwległym licu (z = depth)
            if (isGrooveThrough) {
                if (throughU0) mouths.push({ p0: p00_d, p1: p01_d });
                if (throughU1) mouths.push({ p0: p10_d, p1: p11_d });
                if (throughV0) mouths.push({ p0: p00_d, p1: p10_d });
                if (throughV1) mouths.push({ p0: p01_d, p1: p11_d });
            }

            // Narożniki przelotowe (uskok/felc na rogu formatki): wycinamy segment narożnika płyty
            if (throughU0 && throughV0) mouths.push({ p0: p00_0, p1: p00_d });
            if (throughU1 && throughV0) mouths.push({ p0: p10_0, p1: p10_d });
            if (throughU1 && throughV1) mouths.push({ p0: p11_0, p1: p11_d });
            if (throughU0 && throughV1) mouths.push({ p0: p01_0, p1: p01_d });

            if (!throughV0) featureEdges.push({ key: `e_groove_${feat.id}_t1`, points: [p00_0, p10_0] });
            if (!throughU1) featureEdges.push({ key: `e_groove_${feat.id}_t2`, points: [p10_0, p11_0] });
            if (!throughV1) featureEdges.push({ key: `e_groove_${feat.id}_t3`, points: [p11_0, p01_0] });
            if (!throughU0) featureEdges.push({ key: `e_groove_${feat.id}_t4`, points: [p01_0, p00_0] });

            if (!isGrooveThrough || !throughV0) featureEdges.push({ key: `e_groove_${feat.id}_b1`, points: [p00_d, p10_d] });
            if (!isGrooveThrough || !throughU1) featureEdges.push({ key: `e_groove_${feat.id}_b2`, points: [p10_d, p11_d] });
            if (!isGrooveThrough || !throughV1) featureEdges.push({ key: `e_groove_${feat.id}_b3`, points: [p11_d, p01_d] });
            if (!isGrooveThrough || !throughU0) featureEdges.push({ key: `e_groove_${feat.id}_b4`, points: [p01_d, p00_d] });

            // Krawędzie pionowe cechy istnieją tylko wtedy, gdy przynajmniej jedna ścianka dochodzi do tego narożnika
            const hasV1 = !(throughU0 && throughV0);
            const hasV2 = !(throughU1 && throughV0);
            const hasV3 = !(throughU1 && throughV1);
            const hasV4 = !(throughU0 && throughV1);

            if (hasV1) featureEdges.push({ key: `e_groove_${feat.id}_v1`, points: [p00_0, p00_d] });
            if (hasV2) featureEdges.push({ key: `e_groove_${feat.id}_v2`, points: [p10_0, p10_d] });
            if (hasV3) featureEdges.push({ key: `e_groove_${feat.id}_v3`, points: [p11_0, p11_d] });
            if (hasV4) featureEdges.push({ key: `e_groove_${feat.id}_v4`, points: [p01_0, p01_d] });
        } else {
            console.warn(`[cap-machining] Pominięto krawędzie dla nieobsługiwanego typu feature: "${feat?.type}" (id: ${feat?.id ?? 'brak'}).`);
            continue;
        }
    }

    const clipped = clipEdgesByMouths(edges, mouths);
    edges.length = 0;
    edges.push(...clipped, ...featureEdges);
}

export function isPointInPolygon2D(x: number, y: number, poly: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function buildProfileMeshWithFeatures(opts: {
    pts2D: [number, number][];
    zFront: number;
    zBack: number;
    features?: any[];
    w: number;
    h: number;
    t: number;
}): { mesh: FaceMeshData; edges: CadEdge[] } {
    const { pts2D, zFront, zBack, features, w, h, t } = opts;
    const mesh: FaceMeshData = { positions: [], indices: [] };
    const edges: CadEdge[] = [];

    const frontHoles2D: number[][][] = [];
    const backHoles2D: number[][][] = [];

    if (features) {
        for (const feat of features) {
            if (isFeatureSkipped(feat)) continue;
            if (feat.type === 'hole') {
                const faceName = normalizeFaceName(feat.face || feat.side || '');
                if (faceName !== 'FACE_Z_PLUS' && faceName !== 'FACE_Z_MINUS') continue;

                const faceData = computeFaceData(faceName, w, h, t);
                const { u: cxRaw, v: cyRaw } = readFeatureUV(feat.params);
                const r = (feat.params.diameter || 35) / 2;
                const depth = feat.params.depth || 10;

                const template = feat.params.template_id || 'SINGLE';
                const spacing = feat.params.spacing || 32;

                const holeCenters: { cx: number; cy: number; suffix: string }[] = [];
                if (template === 'TRIPLE') {
                    const offsetZ = feat.params.offsetZ || 32;
                    holeCenters.push({ cx: cxRaw, cy: cyRaw, suffix: '' });
                    holeCenters.push({ cx: cxRaw, cy: cyRaw + offsetZ, suffix: '_t' });
                    holeCenters.push({ cx: cxRaw, cy: cyRaw - offsetZ, suffix: '_b' });
                } else if (template === 'SYSTEM_32' || template === 'ROW') {
                    const count = feat.params.count || 5;
                    for (let i = 0; i < count; i++) {
                        holeCenters.push({ cx: cxRaw, cy: cyRaw + i * spacing, suffix: `_${i}` });
                    }
                } else {
                    holeCenters.push({ cx: cxRaw, cy: cyRaw, suffix: '' });
                }

                for (const { cx, cy, suffix } of holeCenters) {
                    const p3d = localTo3D(faceData, cx, cy, 0);
                    const posX = p3d[0];
                    const posY = p3d[1];

                    if (!isPointInPolygon2D(posX, posY, pts2D)) continue;

                    const segments = 24;
                    const circle = generateCircle(posX, posY, r, segments);

                    if (faceName === 'FACE_Z_PLUS') {
                        // Otwór od przodu (w dół w osi Z)
                        frontHoles2D.push([...circle].reverse());

                        const p3dTop: number[][] = [];
                        const p3dBottom: number[][] = [];
                        for (const p of circle) {
                            p3dTop.push([p[0], p[1], zFront]);
                            p3dBottom.push([p[0], p[1], zFront - depth]);
                        }
                        const pCenterBottom = [posX, posY, zFront - depth];

                        const addQuad = (pA: number[], pB: number[], pC: number[], pD: number[]) => {
                            const idx = mesh.positions.length / 3;
                            mesh.positions.push(...pA, ...pB, ...pC, ...pD);
                            mesh.indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
                        };
                        const addTriangle = (pA: number[], pB: number[], pC: number[]) => {
                            const idx = mesh.positions.length / 3;
                            mesh.positions.push(...pA, ...pB, ...pC);
                            mesh.indices.push(idx, idx + 1, idx + 2);
                        };

                        for (let i = 0; i < segments; i++) {
                            const nextI = (i + 1) % segments;
                            addTriangle(p3dBottom[i], pCenterBottom, p3dBottom[nextI]);
                            addQuad(p3dTop[i], p3dTop[nextI], p3dBottom[nextI], p3dBottom[i]);
                        }

                        const circleEdge = [...circle, circle[0]].map(p => [p[0], p[1], zFront]);
                        edges.push({ key: `e_hole_${feat.id}${suffix}`, points: circleEdge });
                    } else if (faceName === 'FACE_Z_MINUS') {
                        // Otwór od tyłu (w górę w osi Z)
                        backHoles2D.push(circle);

                        const p3dTop: number[][] = [];
                        const p3dBottom: number[][] = [];
                        for (const p of circle) {
                            p3dTop.push([p[0], p[1], zBack]);
                            p3dBottom.push([p[0], p[1], zBack + depth]);
                        }
                        const pCenterBottom = [posX, posY, zBack + depth];

                        const addQuad = (pA: number[], pB: number[], pC: number[], pD: number[]) => {
                            const idx = mesh.positions.length / 3;
                            mesh.positions.push(...pA, ...pB, ...pC, ...pD);
                            mesh.indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
                        };
                        const addTriangle = (pA: number[], pB: number[], pC: number[]) => {
                            const idx = mesh.positions.length / 3;
                            mesh.positions.push(...pA, ...pB, ...pC);
                            mesh.indices.push(idx, idx + 1, idx + 2);
                        };

                        for (let i = 0; i < segments; i++) {
                            const nextI = (i + 1) % segments;
                            addTriangle(p3dBottom[nextI], pCenterBottom, p3dBottom[i]);
                            addQuad(p3dTop[nextI], p3dTop[i], p3dBottom[i], p3dBottom[nextI]);
                        }

                        const circleEdge = [...circle, circle[0]].map(p => [p[0], p[1], zBack]);
                        edges.push({ key: `e_hole_${feat.id}${suffix}`, points: circleEdge });
                    }
                }
            }
        }
    }

    // 1. Ściana przednia (zFront, CCW)
    const flatFront: number[] = [];
    const holeIndicesFront: number[] = [];
    for (const [x, y] of pts2D) {
        flatFront.push(x, y);
    }
    for (const hole of frontHoles2D) {
        holeIndicesFront.push(flatFront.length / 2);
        for (const [x, y] of hole) {
            flatFront.push(x, y);
        }
    }
    const frontTris = earcut(flatFront, holeIndicesFront, 2);
    const offsetFront = mesh.positions.length / 3;
    for (let i = 0; i < flatFront.length; i += 2) {
        mesh.positions.push(flatFront[i], flatFront[i + 1], zFront);
    }
    for (const idx of frontTris) {
        mesh.indices.push(idx + offsetFront);
    }

    // 2. Ściana tylna (zBack, CW z perspektywy przodu = CCW z tyłu)
    const backPts = [...pts2D].reverse();
    const flatBack: number[] = [];
    const holeIndicesBack: number[] = [];
    for (const [x, y] of backPts) {
        flatBack.push(x, y);
    }
    for (const hole of backHoles2D) {
        holeIndicesBack.push(flatBack.length / 2);
        const reversedHole = [...hole].reverse();
        for (const [x, y] of reversedHole) {
            flatBack.push(x, y);
        }
    }
    const backTris = earcut(flatBack, holeIndicesBack, 2);
    const offsetBack = mesh.positions.length / 3;
    for (let i = 0; i < flatBack.length; i += 2) {
        mesh.positions.push(flatBack[i], flatBack[i + 1], zBack);
    }
    for (const idx of backTris) {
        mesh.indices.push(idx + offsetBack);
    }

    // 3. Ściany boczne (łączące zFront i zBack)
    const n = pts2D.length;
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        const pA = pts2D[i];
        const pB = pts2D[next];

        const idx = mesh.positions.length / 3;
        mesh.positions.push(
            pA[0], pA[1], zFront,
            pB[0], pB[1], zFront,
            pB[0], pB[1], zBack,
            pA[0], pA[1], zBack
        );
        mesh.indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
    }

    return { mesh, edges };
}

