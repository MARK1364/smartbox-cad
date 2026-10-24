import { computeFaceData, localTo3D } from './face-lcs.js';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import {
    appendFeatureEdges,
    buildFaceMeshWithFeatures,
    collectExtraHoles2D,
    featuresOnFace
} from './cap-machining.js';

export type OutlineSegmentEdgeKey = '+X' | '-X' | '+Y' | '-Y' | 'NOTCH';

export function classifyOutlineSegmentEdge(
    u0: number, v0: number, u1: number, v1: number, plateW: number, plateD: number
): OutlineSegmentEdgeKey {
    const tolU = Math.min(plateW * 0.25, Math.max(50, plateW * 0.08));
    const tolV = Math.min(plateD * 0.25, Math.max(50, plateD * 0.08));
    const du = Math.abs(u1 - u0);
    const dv = Math.abs(v1 - v0);
    if (du < dv * 0.25) {
        const u = (u0 + u1) / 2;
        if (u <= tolU) return '-X';
        if (u >= plateW - tolU) return '+X';
    }
    if (dv < du * 0.25) {
        const v = (v0 + v1) / 2;
        if (v <= tolV) return '-Y';
        if (v >= plateD - tolV) return '+Y';
    }
    // Krawędź skośna rozpięta na szerokości formatki (np. ścięte plecy lub dach)
    if (du >= plateW * 0.7) {
        const vAvg = (v0 + v1) / 2;
        if (vAvg <= plateD * 0.5) return '-Y';
        if (vAvg > plateD * 0.5) return '+Y';
    }
    return 'NOTCH';
}

/** Precyzja numeryczna dla porównań zmiennoprzecinkowych (1 mikrometr = 0.001 mm = 1000 nm). */
const CAD_EPS = 0.001;

interface OutlineSubSegment {
    u0: number; v0: number;
    u1: number; v1: number;
    depthPlus: number;
    depthMinus: number;
}

interface ExtrusionGrooveBox {
    fu0: number;
    fu1: number;
    fv0: number;
    fv1: number;
    depth: number;
    isPlus: boolean;
}

function extractGrooveBoxes(features?: any[]): ExtrusionGrooveBox[] {
    if (!features || features.length === 0) return [];
    const boxes: ExtrusionGrooveBox[] = [];
    for (const f of features) {
        if (!f || (f.type !== 'groove' && f.type !== 'pocket' && f.type !== 'cutout')) continue;
        const gp = getGrooveParamsMm(f.params);
        const depth = gp.depth || 0;
        if (depth <= CAD_EPS) continue;
        const isPlus = !f.face || String(f.face).includes('PLUS');
        boxes.push({
            fu0: gp.u,
            fu1: gp.u + gp.width,
            fv0: gp.v,
            fv1: gp.v + gp.length,
            depth,
            isPlus
        });
    }
    return boxes;
}

function splitSegmentByGrooves(
    u0: number, v0: number,
    u1: number, v1: number,
    grooveBoxes: ExtrusionGrooveBox[]
): OutlineSubSegment[] {
    const isHoriz = Math.abs(v1 - v0) < CAD_EPS;
    const isVert = Math.abs(u1 - u0) < CAD_EPS;

    if (grooveBoxes.length === 0 || (!isHoriz && !isVert)) {
        return [{ u0, v0, u1, v1, depthPlus: 0, depthMinus: 0 }];
    }

    const splitT = new Set<number>([0, 1]);

    for (const box of grooveBoxes) {
        if (isVert) {
            const uEdge = u0;
            const touches = Math.abs(box.fu0 - uEdge) < CAD_EPS || Math.abs(box.fu1 - uEdge) < CAD_EPS;
            if (touches) {
                const totalDv = v1 - v0;
                if (Math.abs(totalDv) > CAD_EPS) {
                    const tStart = (box.fv0 - v0) / totalDv;
                    const tEnd = (box.fv1 - v0) / totalDv;
                    if (tStart > CAD_EPS && tStart < 1 - CAD_EPS) splitT.add(tStart);
                    if (tEnd > CAD_EPS && tEnd < 1 - CAD_EPS) splitT.add(tEnd);
                }
            }
        } else if (isHoriz) {
            const vEdge = v0;
            const touches = Math.abs(box.fv0 - vEdge) < CAD_EPS || Math.abs(box.fv1 - vEdge) < CAD_EPS;
            if (touches) {
                const totalDu = u1 - u0;
                if (Math.abs(totalDu) > CAD_EPS) {
                    const tStart = (box.fu0 - u0) / totalDu;
                    const tEnd = (box.fu1 - u0) / totalDu;
                    if (tStart > CAD_EPS && tStart < 1 - CAD_EPS) splitT.add(tStart);
                    if (tEnd > CAD_EPS && tEnd < 1 - CAD_EPS) splitT.add(tEnd);
                }
            }
        }
    }

    const sortedT = Array.from(splitT).sort((a, b) => a - b);
    const result: OutlineSubSegment[] = [];

    for (let i = 0; i < sortedT.length - 1; i++) {
        const tA = sortedT[i];
        const tB = sortedT[i + 1];
        const subU0 = u0 + tA * (u1 - u0);
        const subV0 = v0 + tA * (v1 - v0);
        const subU1 = u0 + tB * (u1 - u0);
        const subV1 = v0 + tB * (v1 - v0);

        const midU = (subU0 + subU1) / 2;
        const midV = (subV0 + subV1) / 2;
        let depthPlus = 0;
        let depthMinus = 0;

        for (const box of grooveBoxes) {
            if (midU >= box.fu0 - CAD_EPS && midU <= box.fu1 + CAD_EPS && midV >= box.fv0 - CAD_EPS && midV <= box.fv1 + CAD_EPS) {
                if (box.isPlus) depthPlus = Math.max(depthPlus, box.depth);
                else depthMinus = Math.max(depthMinus, box.depth);
            }
        }

        result.push({ u0: subU0, v0: subV0, u1: subU1, v1: subV1, depthPlus, depthMinus });
    }

    // Scal sąsiadujące podsegmenty o identycznych głębokościach (brak uskoku w ściance = jednolita płaszczyzna bez zbędnych krawędzi)
    const merged: OutlineSubSegment[] = [];
    for (const sub of result) {
        if (merged.length === 0) {
            merged.push({ ...sub });
            continue;
        }
        const last = merged[merged.length - 1];
        if (Math.abs(last.depthPlus - sub.depthPlus) < CAD_EPS && Math.abs(last.depthMinus - sub.depthMinus) < CAD_EPS) {
            last.u1 = sub.u1;
            last.v1 = sub.v1;
        } else {
            merged.push({ ...sub });
        }
    }

    return merged;
}

export interface OutlineCapVertices {
    topPts: number[][];
    bottomPts: number[][];
}

export function computeOutlineCapVertices(
    outline2d: number[][],
    plateW: number,
    plateD: number,
    thickness: number
): OutlineCapVertices {
    const facePlus = computeFaceData('FACE_Z_PLUS', plateW, plateD, thickness);
    const faceMinus = computeFaceData('FACE_Z_MINUS', plateW, plateD, thickness);
    const topPts: number[][] = [];
    const bottomPts: number[][] = [];
    for (let i = 0; i < outline2d.length; i++) {
        const [u, v] = outline2d[i];
        topPts.push(localTo3D(facePlus, u, v, 0));
        bottomPts.push(localTo3D(faceMinus, faceMinus.width - u, v, 0));
    }
    return { topPts, bottomPts };
}

function buildOutlineWalls(
    outline2d: number[][],
    plateW: number,
    plateD: number,
    thickness: number,
    features?: any[]
) {
    const n = outline2d.length;
    const facePlus = computeFaceData('FACE_Z_PLUS', plateW, plateD, thickness);
    const faceMinus = computeFaceData('FACE_Z_MINUS', plateW, plateD, thickness);
    const sides: Record<string, { positions: number[]; indices: number[]; edgeKey: OutlineSegmentEdgeKey }> = {};
    const edges: Array<{ key: string; points: number[][] }> = [];
    const allVertices: number[][] = [];

    const grooveBoxes = extractGrooveBoxes(features);
    const allSubsegs = outline2d.map((pt, i) => {
        const next = (i + 1) % n;
        const [u0, v0] = pt;
        const [u1, v1] = outline2d[next];
        return splitSegmentByGrooves(u0, v0, u1, v1, grooveBoxes);
    });

    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        const [u0, v0] = outline2d[i];
        const [u1, v1] = outline2d[next];
        const edgeKey = classifyOutlineSegmentEdge(u0, v0, u1, v1, plateW, plateD);
        const subsegs = allSubsegs[i];

        const prevIdx = (i - 1 + n) % n;
        const prevSubsegs = allSubsegs[prevIdx];
        const prevLastSub = prevSubsegs[prevSubsegs.length - 1];

        const pos: number[] = [];
        const ind: number[] = [];
        let vertOffset = 0;

        for (let sIdx = 0; sIdx < subsegs.length; sIdx++) {
            const sub = subsegs[sIdx];
            const p0t = localTo3D(facePlus, sub.u0, sub.v0, sub.depthPlus);
            const p1t = localTo3D(facePlus, sub.u1, sub.v1, sub.depthPlus);
            const p0b = localTo3D(faceMinus, faceMinus.width - sub.u0, sub.v0, sub.depthMinus);
            const p1b = localTo3D(faceMinus, faceMinus.width - sub.u1, sub.v1, sub.depthMinus);

            pos.push(...p0t, ...p1t, ...p1b, ...p0b);
            ind.push(vertOffset, vertOffset + 1, vertOffset + 2, vertOffset, vertOffset + 2, vertOffset + 3);
            vertOffset += 4;

            const suffix = subsegs.length > 1 ? `_${vertOffset}` : '';
            edges.push({ key: `outline_top_${i}${suffix}`, points: [p0t, p1t] });
            edges.push({ key: `outline_bottom_${i}${suffix}`, points: [p0b, p1b] });

            // Krawędź pionowa narożnika obrysu: na wierzchołku narożnika (sIdx === 0)
            // Natywna krawędź narożnika formatki zachowuje swoją pozycję w narożniku obrysu (przycięta do 7 mm przez schodek wpustu)
            if (sIdx === 0) {
                if (prevLastSub) {
                    const cornerDepthPlus = Math.min(prevLastSub.depthPlus, sub.depthPlus);
                    const cornerDepthMinus = Math.min(prevLastSub.depthMinus, sub.depthMinus);
                    const pCornert = localTo3D(facePlus, sub.u0, sub.v0, cornerDepthPlus);
                    const pCornerb = localTo3D(faceMinus, faceMinus.width - sub.u0, sub.v0, cornerDepthMinus);
                    edges.push({ key: `outline_vert_${i}${suffix}`, points: [pCornert, pCornerb] });
                } else {
                    edges.push({ key: `outline_vert_${i}${suffix}`, points: [p0t, p0b] });
                }
            } else {
                // Na wewnętrznym łączeniu podsegmentów (uskok schodka):
                // Krawędź pionowa istnieje TYLKO wzdłuż uskoku (np. 11 mm od lica do dna wpustu).
                // Poniżej uskoku (od dna wpustu do spodu płyty) ścianka jest ciągła i płaska — brak zbędnej krawędzi 7 mm!
                const prevSub = subsegs[sIdx - 1];
                const dPlus0 = Math.min(prevSub.depthPlus, sub.depthPlus);
                const dPlus1 = Math.max(prevSub.depthPlus, sub.depthPlus);
                if (dPlus1 - dPlus0 > CAD_EPS) {
                    const pStepT0 = localTo3D(facePlus, sub.u0, sub.v0, dPlus0);
                    const pStepT1 = localTo3D(facePlus, sub.u0, sub.v0, dPlus1);
                    edges.push({ key: `outline_step_top_${i}${suffix}`, points: [pStepT0, pStepT1] });
                }
                const dMinus0 = Math.min(prevSub.depthMinus, sub.depthMinus);
                const dMinus1 = Math.max(prevSub.depthMinus, sub.depthMinus);
                if (dMinus1 - dMinus0 > CAD_EPS) {
                    const pStepB0 = localTo3D(faceMinus, faceMinus.width - sub.u0, sub.v0, dMinus0);
                    const pStepB1 = localTo3D(faceMinus, faceMinus.width - sub.u0, sub.v0, dMinus1);
                    edges.push({ key: `outline_step_bot_${i}${suffix}`, points: [pStepB0, pStepB1] });
                }
            }

            allVertices.push(p0t, p0b);
        }

        sides[`OUTLINE_SIDE_${i}`] = {
            positions: pos,
            indices: ind,
            edgeKey
        };
    }

    return { sides, edges, vertices: allVertices };
}

export interface PolygonExtrusionInput {
    outline2d: number[][];
    plateW: number;
    plateD: number;
    thickness: number;
    features?: any[];
}

export function buildPolygonPanelTopology(input: PolygonExtrusionInput): Record<string, any> {
    const { outline2d, plateW, plateD, thickness, features } = input;
    const wall = buildOutlineWalls(outline2d, plateW, plateD, thickness, features);

    const extraHoles = collectExtraHoles2D(features, plateW, plateD, thickness);
    const facePlus = computeFaceData('FACE_Z_PLUS', plateW, plateD, thickness);
    const faceMinus = computeFaceData('FACE_Z_MINUS', plateW, plateD, thickness);

    const contourPlus = outline2d.map(([u, v]) => [u, v]);
    const contourMinus = outline2d.map(([u, v]) => [faceMinus.width - u, v]).reverse();

    const builtPlus = buildFaceMeshWithFeatures({
        faceData: facePlus,
        outerContour: contourPlus,
        extraHoles: extraHoles.FACE_Z_PLUS || [],
        featuresOnFace: featuresOnFace(features, 'FACE_Z_PLUS'),
        w: plateW,
        h: plateD,
        t: thickness
    });
    const builtMinus = buildFaceMeshWithFeatures({
        faceData: faceMinus,
        outerContour: contourMinus,
        extraHoles: extraHoles.FACE_Z_MINUS || [],
        featuresOnFace: featuresOnFace(features, 'FACE_Z_MINUS'),
        w: plateW,
        h: plateD,
        t: thickness
    });

    const result: Record<string, any> = {
        FACE_X_PLUS: { positions: [], indices: [] },
        FACE_X_MINUS: { positions: [], indices: [] },
        FACE_Y_PLUS: { positions: [], indices: [] },
        FACE_Y_MINUS: { positions: [], indices: [] },
        FACE_Z_PLUS: builtPlus.mesh,
        FACE_Z_MINUS: builtMinus.mesh,
        ...builtPlus.featureMeshes,
        ...builtMinus.featureMeshes,
        ...wall.sides,
        edges: [...wall.edges],
        vertices: wall.vertices
    };

    appendFeatureEdges(result.edges, features, plateW, plateD, thickness, undefined, outline2d);
    return result;
}
