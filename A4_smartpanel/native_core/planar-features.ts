import earcut from 'earcut';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

export function signedArea2D(poly: ReadonlyArray<readonly number[]>): number {
    let s = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        const [x0, y0] = poly[i];
        const [x1, y1] = poly[(i + 1) % n];
        s += x0 * y1 - x1 * y0;
    }
    return s / 2;
}

export function ensureCCW2D(poly: number[][]): number[][] {
    if (poly.length < 3) return poly;
    return signedArea2D(poly) < 0 ? [...poly].reverse() : poly;
}

export function cleanDuplicatePoints(poly: number[][], eps = 1e-4): number[][] {
    if (poly.length < 3) return [];
    const res: number[][] = [];
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const prev = res.length > 0 ? res[res.length - 1] : poly[poly.length - 1];
        if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) > eps) {
            res.push([p[0], p[1]]);
        }
    }
    if (res.length >= 2 && Math.hypot(res[0][0] - res[res.length - 1][0], res[0][1] - res[res.length - 1][1]) <= eps) {
        res.pop();
    }
    return res.length >= 3 ? res : [];
}

export function simplifyCollinear2D(poly: number[][], eps = 0.05): number[][] {
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

export function isPointInPolygon2D(x: number, y: number, poly: ReadonlyArray<readonly number[]>): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Sprawdza, czy odcinek 2D (p0 -> p1) leży na obrysie zewnętrznym formatki `contour`.
 * Działa dla dowolnego kąta krawędzi (pionowe, poziome, skosy 30°/45°, zdyskretyzowane łuki).
 */
export function isEdgeOnContour(
    p0: readonly number[],
    p1: readonly number[],
    contour: number[][],
    eps = 0.05
): boolean {
    if (!contour || contour.length < 2) return false;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const edgeLen = Math.hypot(dx, dy);
    if (edgeLen <= eps) return true;

    const ux = dx / edgeLen;
    const uy = dy / edgeLen;

    const coveredIntervals: Array<[number, number]> = [];
    const n = contour.length;

    for (let i = 0; i < n; i++) {
        const c0 = contour[i];
        const c1 = contour[(i + 1) % n];
        const cdx = c1[0] - c0[0];
        const cdy = c1[1] - c0[1];
        const cLen = Math.hypot(cdx, cdy);
        if (cLen <= eps) continue;

        const cux = cdx / cLen;
        const cuy = cdy / cLen;

        // Odległość prostopadła p0 i p1 od prostej segmentu obrysu c0 -> c1
        const dist0 = Math.abs((p0[0] - c0[0]) * cuy - (p0[1] - c0[1]) * cux);
        const dist1 = Math.abs((p1[0] - c0[0]) * cuy - (p1[1] - c0[1]) * cux);
        if (dist0 > eps || dist1 > eps) continue;

        // Rzut c0 i c1 na oś odcinka p0 -> p1
        const t0 = (c0[0] - p0[0]) * ux + (c0[1] - p0[1]) * uy;
        const t1 = (c1[0] - p0[0]) * ux + (c1[1] - p0[1]) * uy;
        const start = Math.max(0, Math.min(t0, t1));
        const end = Math.min(edgeLen, Math.max(t0, t1));
        if (end - start > 1e-3) {
            coveredIntervals.push([start, end]);
        }
    }

    if (coveredIntervals.length === 0) return false;
    coveredIntervals.sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let curStart = coveredIntervals[0][0];
    let curEnd = coveredIntervals[0][1];
    for (let i = 1; i < coveredIntervals.length; i++) {
        const [s, e] = coveredIntervals[i];
        if (s <= curEnd + eps) {
            curEnd = Math.max(curEnd, e);
        } else {
            covered += curEnd - curStart;
            curStart = s;
            curEnd = e;
        }
    }
    covered += curEnd - curStart;
    return covered >= edgeLen - eps * 2;
}

/**
 * Sutherland–Hodgman: przycina wielokąt `subject` wypukłym oknem `convexClip`.
 */
export function clipPolygonByConvex(subject: number[][], convexClip: number[][]): number[][] {
    const EPS = 1e-7;
    const win = signedArea2D(convexClip) < 0 ? [...convexClip].reverse() : convexClip;
    let output = subject;

    for (let i = 0; i < win.length && output.length > 0; i++) {
        const a = win[i];
        const b = win[(i + 1) % win.length];
        const side = (p: number[]) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        const cross = (p: number[], q: number[]) => {
            const sp = side(p);
            const denom = sp - side(q);
            const t = Math.abs(denom) > 1e-12 ? sp / denom : 0;
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

/**
 * Scala przylegające wielokąty 2D (usuwa wspólne krawędzie wewnętrzne o przeciwnych zwrotach
 * i upraszcza współliniowe wierzchołki).
 */
export function mergeAdjacentPolygons(polys: number[][][]): number[][][] {
    const cleaned = polys
        .map(p => cleanDuplicatePoints(ensureCCW2D(p)))
        .filter(p => p.length >= 3 && Math.abs(signedArea2D(p)) > 1e-4);

    if (cleaned.length <= 1) return cleaned;

    const EPS = 0.02;
    const allVertices: Array<[number, number]> = [];

    const getVertexId = (u: number, v: number): number => {
        for (let i = 0; i < allVertices.length; i++) {
            if (Math.hypot(allVertices[i][0] - u, allVertices[i][1] - v) <= EPS) {
                return i;
            }
        }
        allVertices.push([u, v]);
        return allVertices.length - 1;
    };

    for (const poly of cleaned) {
        for (const [u, v] of poly) {
            getVertexId(u, v);
        }
    }

    interface DirectedSegment {
        v0: number;
        v1: number;
        fwdKey: string;
        revKey: string;
    }

    const segments: DirectedSegment[] = [];

    for (const poly of cleaned) {
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % n];
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const lenSq = dx * dx + dy * dy;
            if (lenSq < EPS * EPS) continue;

            const splits: Array<{ t: number; vid: number }> = [];
            for (let vid = 0; vid < allVertices.length; vid++) {
                const v = allVertices[vid];
                const t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / lenSq;
                if (t > 0.001 && t < 0.999) {
                    const projX = a[0] + t * dx;
                    const projY = a[1] + t * dy;
                    if (Math.hypot(v[0] - projX, v[1] - projY) <= EPS) {
                        splits.push({ t, vid });
                    }
                }
            }

            splits.sort((s1, s2) => s1.t - s2.t);
            const vStart = getVertexId(a[0], a[1]);
            const vEnd = getVertexId(b[0], b[1]);
            const chain = [vStart, ...splits.map(s => s.vid), vEnd];

            for (let j = 0; j < chain.length - 1; j++) {
                const id0 = chain[j];
                const id1 = chain[j + 1];
                if (id0 !== id1) {
                    segments.push({
                        v0: id0,
                        v1: id1,
                        fwdKey: `${id0}->${id1}`,
                        revKey: `${id1}->${id0}`
                    });
                }
            }
        }
    }

    const fwdCount = new Map<string, number>();
    for (const seg of segments) {
        fwdCount.set(seg.fwdKey, (fwdCount.get(seg.fwdKey) || 0) + 1);
    }

    const surviving: DirectedSegment[] = [];
    for (const seg of segments) {
        const opposing = fwdCount.get(seg.revKey) || 0;
        if (opposing > 0) {
            fwdCount.set(seg.revKey, opposing - 1);
            fwdCount.set(seg.fwdKey, (fwdCount.get(seg.fwdKey) || 1) - 1);
        } else {
            surviving.push(seg);
        }
    }

    if (surviving.length === 0) return [];

    const adj = new Map<number, number[]>();
    for (const seg of surviving) {
        if (!adj.has(seg.v0)) adj.set(seg.v0, []);
        adj.get(seg.v0)!.push(seg.v1);
    }

    const mergedLoops: number[][][] = [];
    const visitedEdges = new Set<string>();

    for (const [startVid, nextVids] of adj.entries()) {
        for (const firstNext of nextVids) {
            const edgeId = `${startVid}->${firstNext}`;
            if (visitedEdges.has(edgeId)) continue;

            const loop: number[][] = [[allVertices[startVid][0], allVertices[startVid][1]]];
            visitedEdges.add(edgeId);
            let currVid = firstNext;
            let stuck = false;

            while (currVid !== startVid) {
                loop.push([allVertices[currVid][0], allVertices[currVid][1]]);
                const candidates = adj.get(currVid) || [];
                const nextVid = candidates.find(cand => !visitedEdges.has(`${currVid}->${cand}`));
                if (nextVid === undefined) {
                    stuck = true;
                    break;
                }
                visitedEdges.add(`${currVid}->${nextVid}`);
                currVid = nextVid;
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

export function isConvexPolygon2D(poly: ReadonlyArray<readonly number[]>): boolean {
    const n = poly.length;
    if (n < 3) return false;
    if (n === 3) return true;
    let sign = 0;
    for (let i = 0; i < n; i++) {
        const p0 = poly[i];
        const p1 = poly[(i + 1) % n];
        const p2 = poly[(i + 2) % n];
        const cross = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0]);
        if (Math.abs(cross) > 1e-5) {
            const s = cross > 0 ? 1 : -1;
            if (sign === 0) sign = s;
            else if (sign !== s) return false;
        }
    }
    return true;
}

function triangulatePolygon2D(poly: number[][]): number[][][] {
    const ccw = ensureCCW2D(poly);
    if (ccw.length < 3) return [];
    if (ccw.length === 3) return [ccw];
    const indices = earcut(ccw.flat(), [], 2);
    const tris: number[][][] = [];
    for (let i = 0; i <= indices.length - 3; i += 3) {
        const a = ccw[indices[i]];
        const b = ccw[indices[i + 1]];
        const c = ccw[indices[i + 2]];
        const t = [[a[0], a[1]], [b[0], b[1]], [c[0], c[1]]];
        if (Math.abs(signedArea2D(t)) > 1e-4) {
            tris.push(ensureCCW2D(t));
        }
    }
    return tris;
}

/**
 * Sprawdza, czy wielokąt jest prostokątem równoległym do osi U/V.
 * Jeśli tak, zwraca jego granice { u0, u1, v0, v1 }.
 */
export function isAxisAlignedRect(
    poly: ReadonlyArray<readonly number[]>,
    eps = 0.05
): { u0: number; u1: number; v0: number; v1: number } | null {
    if (poly.length !== 4) return null;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [u, v] of poly) {
        if (u < u0) u0 = u;
        if (u > u1) u1 = u;
        if (v < v0) v0 = v;
        if (v > v1) v1 = v;
    }
    const w = u1 - u0;
    const h = v1 - v0;
    if (w <= eps || h <= eps) return null;

    for (const [u, v] of poly) {
        const onU = Math.abs(u - u0) <= eps || Math.abs(u - u1) <= eps;
        const onV = Math.abs(v - v0) <= eps || Math.abs(v - v1) <= eps;
        if (!onU || !onV) return null;
    }

    const area = Math.abs(signedArea2D(poly));
    if (Math.abs(area - w * h) > Math.max(0.2, (w + h) * eps)) return null;

    return { u0, u1, v0, v1 };
}

/**
 * Operacja boolowska 2D: EffectiveFeature = FeaturePolygon ∩ OuterContour.
 *
 * Działa dla dowolnego kształtu formatki (skosy 30°/45°, wcięcia narożne L,
 * rewizje pod zawieszki, zaokrąglenia/fillety) oraz dowolnego wielokąta cechy.
 */
export function intersectPolygonWithContour(
    featurePoly: number[][],
    outerContour: number[][]
): number[][][] {
    const subject = cleanDuplicatePoints(ensureCCW2D(featurePoly));
    const contour = cleanDuplicatePoints(ensureCCW2D(outerContour));
    if (subject.length < 3 || contour.length < 3) return [];

    const subjectArea = Math.abs(signedArea2D(subject));
    if (subjectArea <= 1e-3) return [];

    let sMinU = Infinity, sMaxU = -Infinity, sMinV = Infinity, sMaxV = -Infinity;
    for (const [u, v] of subject) {
        if (u < sMinU) sMinU = u;
        if (u > sMaxU) sMaxU = u;
        if (v < sMinV) sMinV = v;
        if (v > sMaxV) sMaxV = v;
    }

    let cMinU = Infinity, cMaxU = -Infinity, cMinV = Infinity, cMaxV = -Infinity;
    for (const [u, v] of contour) {
        if (u < cMinU) cMinU = u;
        if (u > cMaxU) cMaxU = u;
        if (v < cMinV) vMinCheck: cMinV = v;
        if (v > cMaxV) cMaxV = v;
    }

    if (sMaxU <= cMinU + 0.05 || sMinU >= cMaxU - 0.05 || sMaxV <= cMinV + 0.05 || sMinV >= cMaxV - 0.05) {
        return [];
    }

    const contourTris = triangulatePolygon2D(contour);
    const subjectConvexParts = isConvexPolygon2D(subject) ? [subject] : triangulatePolygon2D(subject);

    const clippedPieces: number[][][] = [];
    let intersectedArea = 0;

    for (const tri of contourTris) {
        for (const subPart of subjectConvexParts) {
            const raw = clipPolygonByConvex(tri, subPart);
            const cleaned = cleanDuplicatePoints(raw);
            if (cleaned.length >= 3) {
                const a = Math.abs(signedArea2D(cleaned));
                if (a > 0.02) {
                    intersectedArea += a;
                    clippedPieces.push(ensureCCW2D(cleaned));
                }
            }
        }
    }

    if (intersectedArea <= 0.05 || clippedPieces.length === 0) {
        return [];
    }

    // Twierdzenie o mierze: Feature ⊆ OuterContour <=> Area(Feature ∩ OuterContour) == Area(Feature).
    // Gdy cała cecha leży wewnątrz materiału formatki, zwracamy oryginalny wielokąt cechy bez podziału.
    const areaTol = Math.max(0.1, subjectArea * 1e-3);
    if (Math.abs(intersectedArea - subjectArea) <= areaTol) {
        return [subject];
    }

    return mergeAdjacentPolygons(clippedPieces);
}

/**
 * Przycina listę cech obróbczych (groove, pocket, cutout, hole) do rzeczywistego wielokąta 2D formatki (`outline2d`).
 * Cechy wychodzące w pustkę (np. wcięcie zawieszki, wcięcie narożne L, skos dachu 30°/45°)
 * są docinane lub dzielone na wielokąty leżące ściśle na materiale płyty.
 */
export function clipFeaturesToOutline(
    features: any[] | undefined,
    outline2d: number[][],
    plateW: number,
    plateD: number,
    directContour: boolean = false
): any[] {
    if (!features || features.length === 0 || !outline2d || outline2d.length < 3) {
        return features || [];
    }

    const contourPlus = ensureCCW2D(outline2d.map(([u, v]) => [u, v]));
    const contourMinus = directContour ? contourPlus : ensureCCW2D(outline2d.map(([u, v]) => [plateW - u, v]));

    const result: any[] = [];
    const EPS = 0.05;

    for (const feat of features) {
        if (!feat || !feat.params) {
            result.push(feat);
            continue;
        }

        const faceStr = String(feat.face || feat.side || 'FACE_Z_PLUS');
        if (!faceStr.includes('FACE_Z') && faceStr !== '') {
            result.push(feat);
            continue;
        }
        const isMinus = !directContour && faceStr.includes('MINUS');
        const faceContour = isMinus ? contourMinus : contourPlus;

        if (feat.type === 'hole') {
            const u = Number(feat.params.u ?? feat.params.x) || 0;
            const v = Number(feat.params.v ?? feat.params.y) || 0;
            const template = feat.params.template_id || 'SINGLE';
            if (template === 'SINGLE') {
                const inside = isPointInPolygon2D(u, v, faceContour) ||
                    isEdgeOnContour([u, v], [u, v], faceContour, (Number(feat.params.diameter) || 35) / 2 + EPS);
                if (inside) {
                    result.push(feat);
                }
            } else {
                result.push(feat);
            }
            continue;
        }

        if (feat.type === 'groove' || feat.type === 'pocket' || feat.type === 'cutout') {
            const gp = getGrooveParamsMm(feat.params);
            const u0 = gp.u;
            const v0 = gp.v;
            const u1 = u0 + gp.width;
            const v1 = v0 + gp.length;

            const isThrough = feat.type === 'cutout' || Boolean(feat.params.through);
            if (gp.width <= EPS || gp.length <= EPS || (!isThrough && gp.depth <= EPS)) {
                continue;
            }

            const hasCustomPoly = Array.isArray(feat.params.polygon) && feat.params.polygon.length >= 3;
            const customRect = hasCustomPoly ? isAxisAlignedRect(feat.params.polygon) : null;
            const subjectPoly: number[][] = (hasCustomPoly && !customRect)
                ? feat.params.polygon.map((p: number[]) => [Number(p[0]) || 0, Number(p[1]) || 0])
                : [
                    [u0, v0],
                    [u1, v0],
                    [u1, v1],
                    [u0, v1]
                ];

            const effectivePolys = intersectPolygonWithContour(subjectPoly, faceContour);
            if (effectivePolys.length === 0) {
                // Cecha leży całkowicie poza obrysem formatki (w pustce wcięcia) — pomijamy
                continue;
            }

            for (let idx = 0; idx < effectivePolys.length; idx++) {
                const poly = effectivePolys[idx];
                const rect = isAxisAlignedRect(poly);

                if (rect) {
                    const isUnchanged =
                        effectivePolys.length === 1 &&
                        Math.abs(rect.u0 - u0) <= EPS &&
                        Math.abs(rect.u1 - u1) <= EPS &&
                        Math.abs(rect.v0 - v0) <= EPS &&
                        Math.abs(rect.v1 - v1) <= EPS;

                    if (isUnchanged) {
                        result.push(feat);
                        continue;
                    }

                    const cloned = JSON.parse(JSON.stringify(feat));
                    if (idx > 0) {
                        cloned.id = `${feat.id}_split${idx}`;
                    }
                    const newU = Math.round(rect.u0 * 1000) / 1000;
                    const newV = Math.round(rect.v0 * 1000) / 1000;
                    const newW = Math.round((rect.u1 - rect.u0) * 1000) / 1000;
                    const newL = Math.round((rect.v1 - rect.v0) * 1000) / 1000;

                    cloned.params.u = newU;
                    cloned.params.v = newV;
                    cloned.params.width = newW;
                    cloned.params.length = newL;
                    cloned.params.u_nm = mmToNm(newU);
                    cloned.params.v_nm = mmToNm(newV);
                    cloned.params.width_nm = mmToNm(newW);
                    cloned.params.length_nm = mmToNm(newL);
                    delete cloned.params.polygon;
                    result.push(cloned);
                } else {
                    // Wielokąt nieprostokątny (np. wpust lub kieszeń docięta skosem 30°/45° lub łukiem)
                    let pMinU = Infinity, pMaxU = -Infinity, pMinV = Infinity, pMaxV = -Infinity;
                    for (const [pu, pv] of poly) {
                        if (pu < pMinU) pMinU = pu;
                        if (pu > pMaxU) pMaxU = pu;
                        if (pv < pMinV) pMinV = pv;
                        if (pv > pMaxV) pMaxV = pv;
                    }
                    const cloned = JSON.parse(JSON.stringify(feat));
                    if (idx > 0) {
                        cloned.id = `${feat.id}_split${idx}`;
                    }
                    const newU = Math.round(pMinU * 1000) / 1000;
                    const newV = Math.round(pMinV * 1000) / 1000;
                    const newW = Math.round((pMaxU - pMinU) * 1000) / 1000;
                    const newL = Math.round((pMaxV - pMinV) * 1000) / 1000;

                    cloned.params.u = newU;
                    cloned.params.v = newV;
                    cloned.params.width = newW;
                    cloned.params.length = newL;
                    cloned.params.u_nm = mmToNm(newU);
                    cloned.params.v_nm = mmToNm(newV);
                    cloned.params.width_nm = mmToNm(newW);
                    cloned.params.length_nm = mmToNm(newL);
                    cloned.params.polygon = poly.map(([pu, pv]) => [
                        Math.round(pu * 1000) / 1000,
                        Math.round(pv * 1000) / 1000
                    ]);
                    result.push(cloned);
                }
            }
            continue;
        }

        result.push(feat);
    }

    return result;
}

