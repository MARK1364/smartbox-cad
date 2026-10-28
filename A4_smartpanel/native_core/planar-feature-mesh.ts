/**
 * Budowa geometrii 3D cech obszarowych (wpusty, kieszenie, wycięcia):
 * siatki dna, ścianek w0..w3, zlicowania L-union i krawędzie B-rep.
 * Wydzielone z planar-features.ts — czysty podział 2D vs 3D.
 */
import earcut from 'earcut';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { normalizeFaceName } from '../../A1_core/face-name.js';
import { localTo3D, type computeFaceData } from './face-lcs.js';
import { appendQuad, emptyMesh, type FaceMeshData } from './face-mesh.js';
import type { CadEdge } from './brep-topology.js';
import { isAxisAlignedRect, isEdgeOnContour } from './planar-features.js';

type FaceData = ReturnType<typeof computeFaceData>;

export function isFeatureSkipped(feat: any): boolean {
    if (!feat) return true;
    if (feat.visible === false || feat.frozen || feat.params?.frozen) return true;
    if (feat.is_assembly_drilling || feat.params?.is_assembly_drilling) return true;
    return false;
}

export function clipIntervals(
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

function resolveBevelGrooveBounds(
    uRaw: number, vRaw: number, wRaw: number, hRaw: number,
    faceData: FaceData,
    outerContour: number[][],
    bottomContour: number[][] | undefined,
    depth: number,
    t: number
) {
    const EDGE_EPS = 0.05;
    if (!bottomContour || bottomContour.length === 0) {
        const u0 = Math.max(0, uRaw);
        const u1 = Math.min(faceData.width, uRaw + wRaw);
        const v0 = Math.max(0, vRaw);
        const v1 = Math.min(faceData.height, vRaw + hRaw);
        const throughU0 = u0 <= EDGE_EPS || isEdgeOnContour([u0, v0], [u0, v1], outerContour);
        const throughU1 = u1 >= faceData.width - EDGE_EPS || isEdgeOnContour([u1, v0], [u1, v1], outerContour);
        const throughV0 = v0 <= EDGE_EPS || isEdgeOnContour([u0, v0], [u1, v0], outerContour);
        const throughV1 = v1 >= faceData.height - EDGE_EPS || isEdgeOnContour([u0, v1], [u1, v1], outerContour);
        return {
            u0_top: u0, u1_top: u1, v0_top: v0, v1_top: v1,
            u0_bot: u0, u1_bot: u1, v0_bot: v0, v1_bot: v1,
            throughU0, throughU1, throughV0, throughV1
        };
    }

    let uMinTop = Infinity, uMaxTop = -Infinity, vMinTop = Infinity, vMaxTop = -Infinity;
    for (const [cu, cv] of outerContour) {
        if (cu < uMinTop) uMinTop = cu;
        if (cu > uMaxTop) uMaxTop = cu;
        if (cv < vMinTop) vMinTop = cv;
        if (cv > vMaxTop) vMaxTop = cv;
    }
    let uMinBot = Infinity, uMaxBot = -Infinity, vMinBot = Infinity, vMaxBot = -Infinity;
    for (const [cu, cv] of bottomContour) {
        if (cu < uMinBot) uMinBot = cu;
        if (cu > uMaxBot) uMaxBot = cu;
        if (cv < vMinBot) vMinBot = cv;
        if (cv > vMaxBot) vMaxBot = cv;
    }

    const s = t > 1e-6 ? Math.max(0, Math.min(1, depth / t)) : 0;
    const uMinD = uMinTop + s * (uMinBot - uMinTop);
    const uMaxD = uMaxTop + s * (uMaxBot - uMaxTop);
    const vMinD = vMinTop + s * (vMinBot - vMinTop);
    const vMaxD = vMaxTop + s * (vMaxBot - vMaxTop);

    const touchesU0 = uRaw <= EDGE_EPS || uRaw <= uMinTop + EDGE_EPS;
    const touchesU1 = (uRaw + wRaw) >= faceData.width - EDGE_EPS || (uRaw + wRaw) >= uMaxTop - EDGE_EPS;
    const touchesV0 = vRaw <= EDGE_EPS || vRaw <= vMinTop + EDGE_EPS;
    const touchesV1 = (vRaw + hRaw) >= faceData.height - EDGE_EPS || (vRaw + hRaw) >= vMaxTop - EDGE_EPS;

    const u0_top = touchesU0 ? uMinTop : Math.max(uMinTop, uRaw);
    const u1_top = touchesU1 ? uMaxTop : Math.min(uMaxTop, uRaw + wRaw);
    const v0_top = touchesV0 ? vMinTop : Math.max(vMinTop, vRaw);
    const v1_top = touchesV1 ? vMaxTop : Math.min(vMaxTop, vRaw + hRaw);

    const v0Shift = v0_top > faceData.height / 2 ? s * (vMaxBot - vMaxTop) : s * (vMinBot - vMinTop);
    const v1Shift = v1_top > faceData.height / 2 ? s * (vMaxBot - vMaxTop) : s * (vMinBot - vMinTop);
    const u0_bot = touchesU0 ? uMinD : Math.max(uMinD, uRaw);
    const u1_bot = touchesU1 ? uMaxD : Math.min(uMaxD, uRaw + wRaw);
    const v0_bot = touchesV0 ? vMinD : Math.max(vMinD, v0_top + v0Shift);
    const v1_bot = touchesV1 ? vMaxD : Math.min(vMaxD, v1_top + v1Shift);

    return {
        u0_top, u1_top, v0_top, v1_top,
        u0_bot, u1_bot, v0_bot, v1_bot,
        throughU0: touchesU0,
        throughU1: touchesU1,
        throughV0: touchesV0,
        throughV1: touchesV1
    };
}

/** Siatki B-rep cechy obszarowej: `feature_<id>_bottom` oraz ścianki `_w0.._w3` → `featureMeshes`. */
export function buildAreaFeatureMeshes(feat: any, ctx: {
    faceData: FaceData;
    outerContour: number[][];
    bottomContour?: number[][];
    feats: any[];
    lUnion: LGrooveUnion | null;
    t: number;
    featureMeshes: Record<string, FaceMeshData>;
}): void {
    const { faceData, outerContour, bottomContour, feats, lUnion, t, featureMeshes } = ctx;
    if (lUnion && (feat === lUnion.gA || feat === lUnion.gB)) {
        if (feat === lUnion.gB) return;
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
                    localTo3D(faceData, pB[0], pB[1], 0),
                    localTo3D(faceData, pB[0], pB[1], depth),
                    localTo3D(faceData, pA[0], pA[1], depth)
                );
            }
        }
        if (w0.positions.length > 0) {
            featureMeshes[`feature_${fidA}_w0`] = w0;
        }
        return;
    }
    const gp = getGrooveParamsMm(feat.params);
    const uRaw = gp.u;
    const vRaw = gp.v;
    const wRaw = gp.width;
    const hRaw = gp.length;
    let depth = gp.depth;

    const fid = String(feat.id || feat.type || 'area_feature');
    const isGrooveThrough = feat.type === 'cutout'
        || feat.params?.through === true
        || feat.params?.kind === 'THROUGH'
        || (String(feat.face || '').includes('FACE_Z') && depth >= t - 0.05);

    if (isGrooveThrough) {
        depth = Math.min(depth, t);
        if (depth <= 0) depth = t;
    }

    const customPoly: Array<[number, number]> | undefined = Array.isArray(feat.params?.polygon) && feat.params.polygon.length >= 3
        ? feat.params.polygon
        : undefined;

    if (customPoly) {
        const w0 = emptyMesh();
        for (let k = 0; k < customPoly.length; k++) {
            const pA = customPoly[k];
            const pB = customPoly[(k + 1) % customPoly.length];
            if (!isEdgeOnContour(pA, pB, outerContour)) {
                appendQuad(
                    w0,
                    localTo3D(faceData, pA[0], pA[1], 0),
                    localTo3D(faceData, pB[0], pB[1], 0),
                    localTo3D(faceData, pB[0], pB[1], depth),
                    localTo3D(faceData, pA[0], pA[1], depth)
                );
            }
        }
        if (w0.positions.length > 0) {
            featureMeshes[`feature_${fid}_w0`] = w0;
        }
        if (!isGrooveThrough) {
            const flat = customPoly.flat();
            const triIndices = earcut(flat, [], 2);
            const bottom = emptyMesh();
            for (const [pu, pv] of customPoly) {
                bottom.positions.push(...localTo3D(faceData, pu, pv, depth));
            }
            bottom.indices.push(...triIndices);
            featureMeshes[`feature_${fid}_bottom`] = bottom;
        }
        return;
    }

    const EDGE_EPS = 0.05;
    const {
        u0_top: u0, u1_top: u1, v0_top: v0, v1_top: v1,
        u0_bot, u1_bot, v0_bot, v1_bot,
        throughU0, throughU1, throughV0, throughV1
    } = resolveBevelGrooveBounds(uRaw, vRaw, wRaw, hRaw, faceData, outerContour, bottomContour, depth, t);

    if (u1 <= u0 || v1 <= v0 || u1_bot <= u0_bot || v1_bot <= v0_bot) return;

    // Otwór wlotu wpustu dostarcza collectExtraHoles2D (opts.extraHoles) — drugi,
    // pokrywający się kontur rozsypuje earcut i czapka gubi wielkie połacie.

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
        let botU0 = u0_bot;
        let botU1 = u1_bot;
        let botV0 = v0_bot;
        let botV1 = v1_bot;
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
        if (!throughV0) {
            const su0_bot = Math.abs(su0 - u0) <= EDGE_EPS ? u0_bot : su0;
            const su1_bot = Math.abs(su1 - u1) <= EDGE_EPS ? u1_bot : su1;
            appendQuad(
                w0,
                localTo3D(faceData, su0, v0, 0),
                localTo3D(faceData, su1, v0, 0),
                localTo3D(faceData, su1_bot, v0_bot, depth),
                localTo3D(faceData, su0_bot, v0_bot, depth)
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
        if (!throughV1) {
            const su0_bot = Math.abs(su0 - u0) <= EDGE_EPS ? u0_bot : su0;
            const su1_bot = Math.abs(su1 - u1) <= EDGE_EPS ? u1_bot : su1;
            appendQuad(
                w2,
                localTo3D(faceData, su1, v1, 0),
                localTo3D(faceData, su0, v1, 0),
                localTo3D(faceData, su0_bot, v1_bot, depth),
                localTo3D(faceData, su1_bot, v1_bot, depth)
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
        if (!throughU0) {
            const sv0_bot = Math.abs(sv0 - v0) <= EDGE_EPS ? v0_bot : sv0;
            const sv1_bot = Math.abs(sv1 - v1) <= EDGE_EPS ? v1_bot : sv1;
            appendQuad(
                w3,
                localTo3D(faceData, u0, sv1, 0),
                localTo3D(faceData, u0, sv0, 0),
                localTo3D(faceData, u0_bot, sv0_bot, depth),
                localTo3D(faceData, u0_bot, sv1_bot, depth)
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
        if (!throughU1) {
            const sv0_bot = Math.abs(sv0 - v0) <= EDGE_EPS ? v0_bot : sv0;
            const sv1_bot = Math.abs(sv1 - v1) <= EDGE_EPS ? v1_bot : sv1;
            appendQuad(
                w1,
                localTo3D(faceData, u1, sv0, 0),
                localTo3D(faceData, u1, sv1, 0),
                localTo3D(faceData, u1_bot, sv1_bot, depth),
                localTo3D(faceData, u1_bot, sv0_bot, depth)
            );
        }
    }
    if (w1.positions.length > 0) {
        featureMeshes[`feature_${fid}_w1`] = w1;
    }
}

/** Krawędzie B-rep cechy obszarowej (`e_groove_<id>_tN`, `_bN`, `_vN`, `_v_corner`, `_v_mouth_N`). */
export function appendAreaFeatureEdges(featureEdges: CadEdge[], feat: any, ctx: {
    faceData: FaceData;
    faceContour: number[][];
    bottomContour?: number[][];
    lUnion: LGrooveUnion | null;
    normFace: string;
    t: number;
}): void {
    const { faceData, faceContour, bottomContour, lUnion, normFace, t } = ctx;
    if (lUnion && (feat === lUnion.gA || feat === lUnion.gB)) {
        if (feat === lUnion.gB) return;
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

            const onContour = isEdgeOnContour(pA, pB, faceContour);
            if (!onContour) {
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
            const isPrevOnContour = isEdgeOnContour(pPrev, pA, faceContour);
            const isNextOnContour = isEdgeOnContour(pA, pNext, faceContour);
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
        return;
    }
    const gp = getGrooveParamsMm(feat.params);
    const u0 = gp.u;
    const v0 = gp.v;
    const gw = gp.width;
    const gh = gp.length;
    let depth = gp.depth;

    const isGrooveThrough = feat.type === 'cutout'
        || feat.params?.through === true
        || feat.params?.kind === 'THROUGH'
        || (normFace.includes('FACE_Z') && depth >= t - 0.05);

    if (isGrooveThrough && (depth <= 0 || depth < t - 0.05)) {
        depth = t;
    }

    const customPoly: Array<[number, number]> | undefined =
        Array.isArray(feat.params?.polygon) && feat.params.polygon.length >= 3 && !isAxisAlignedRect(feat.params.polygon)
            ? feat.params.polygon
            : undefined;

    if (customPoly) {
        const m = customPoly.length;
        for (let k = 0; k < m; k++) {
            const pA = customPoly[k];
            const pB = customPoly[(k + 1) % m];
            const pA_0 = localTo3D(faceData, pA[0], pA[1], 0);
            const pB_0 = localTo3D(faceData, pB[0], pB[1], 0);
            const pA_d = localTo3D(faceData, pA[0], pA[1], depth);
            const pB_d = localTo3D(faceData, pB[0], pB[1], depth);

            const onContour = isEdgeOnContour(pA, pB, faceContour);
            if (!onContour) {
                featureEdges.push({ key: `e_groove_${feat.id}_t${k + 1}`, points: [pA_0, pB_0] });
            }
            if (!isGrooveThrough || !onContour) {
                featureEdges.push({ key: `e_groove_${feat.id}_b${k + 1}`, points: [pA_d, pB_d] });
            }
        }
        for (let k = 0; k < m; k++) {
            const pPrev = customPoly[(k - 1 + m) % m];
            const pA = customPoly[k];
            const pNext = customPoly[(k + 1) % m];
            const prevOnContour = isEdgeOnContour(pPrev, pA, faceContour);
            const nextOnContour = isEdgeOnContour(pA, pNext, faceContour);
            if (!(prevOnContour && nextOnContour)) {
                const pA_0 = localTo3D(faceData, pA[0], pA[1], 0);
                const pA_d = localTo3D(faceData, pA[0], pA[1], depth);
                featureEdges.push({ key: `e_groove_${feat.id}_v${k + 1}`, points: [pA_0, pA_d] });
            }
        }
        return;
    }

    const {
        u0_top, u1_top, v0_top, v1_top,
        u0_bot, u1_bot, v0_bot, v1_bot,
        throughU0, throughU1, throughV0, throughV1
    } = resolveBevelGrooveBounds(u0, v0, gw, gh, faceData, faceContour, bottomContour, depth, t);

    const p00_0 = localTo3D(faceData, u0_top, v0_top, 0);
    const p10_0 = localTo3D(faceData, u1_top, v0_top, 0);
    const p11_0 = localTo3D(faceData, u1_top, v1_top, 0);
    const p01_0 = localTo3D(faceData, u0_top, v1_top, 0);

    const p00_d = localTo3D(faceData, u0_bot, v0_bot, depth);
    const p10_d = localTo3D(faceData, u1_bot, v0_bot, depth);
    const p11_d = localTo3D(faceData, u1_bot, v1_bot, depth);
    const p01_d = localTo3D(faceData, u0_bot, v1_bot, depth);



    if (!throughV0) featureEdges.push({ key: `e_groove_${feat.id}_t1`, points: [p00_0, p10_0] });
    if (!throughU1) featureEdges.push({ key: `e_groove_${feat.id}_t2`, points: [p10_0, p11_0] });
    if (!throughV1) featureEdges.push({ key: `e_groove_${feat.id}_t3`, points: [p11_0, p01_0] });
    if (!throughU0) featureEdges.push({ key: `e_groove_${feat.id}_t4`, points: [p01_0, p00_0] });

    if (!isGrooveThrough || !throughV0) featureEdges.push({ key: `e_groove_${feat.id}_b1`, points: [p00_d, p10_d] });
    if (!isGrooveThrough || !throughU1) featureEdges.push({ key: `e_groove_${feat.id}_b2`, points: [p10_d, p11_d] });
    if (!isGrooveThrough || !throughV1) featureEdges.push({ key: `e_groove_${feat.id}_b3`, points: [p11_d, p01_d] });
    if (!isGrooveThrough || !throughU0) featureEdges.push({ key: `e_groove_${feat.id}_b4`, points: [p01_d, p00_d] });

    // Krawędzie pionowe cechy istnieją wtedy, gdy przynajmniej jedna ścianka dochodzi do tego narożnika.
    // Zlicowane (współpłaszczyznowe) krawędzie są centralnie rozpuszczane przez dissolveCoplanarEdges (brep-topology.ts).
    if (!(throughU0 && throughV0)) featureEdges.push({ key: `e_groove_${feat.id}_v1`, points: [p00_0, p00_d] });
    if (!(throughU1 && throughV0)) featureEdges.push({ key: `e_groove_${feat.id}_v2`, points: [p10_0, p10_d] });
    if (!(throughU1 && throughV1)) featureEdges.push({ key: `e_groove_${feat.id}_v3`, points: [p11_0, p11_d] });
    if (!(throughU0 && throughV1)) featureEdges.push({ key: `e_groove_${feat.id}_v4`, points: [p01_0, p01_d] });
}

