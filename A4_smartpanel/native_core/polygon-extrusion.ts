/**
 * Ekstruzja wielokąta outline2d — caps, boki i krawędzie CAD z jednego obrysu (SSOT).
 */
import { computeFaceData, localTo3D } from './face-lcs.js';
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
    const tolU = Math.max(1, plateW * 0.02);
    const tolV = Math.max(1, plateD * 0.02);
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
    return 'NOTCH';
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
    thickness: number
) {
    const n = outline2d.length;
    const { topPts, bottomPts } = computeOutlineCapVertices(outline2d, plateW, plateD, thickness);
    const sides: Record<string, { positions: number[]; indices: number[]; edgeKey: OutlineSegmentEdgeKey }> = {};
    const edges: Array<{ key: string; points: number[][] }> = [];

    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        const [u0, v0] = outline2d[i];
        const [u1, v1] = outline2d[next];
        const p0t = topPts[i];
        const p1t = topPts[next];
        const p0b = bottomPts[i];
        const p1b = bottomPts[next];
        const edgeKey = classifyOutlineSegmentEdge(u0, v0, u1, v1, plateW, plateD);

        sides[`OUTLINE_SIDE_${i}`] = {
            positions: [...p0t, ...p1t, ...p1b, ...p0b],
            indices: [0, 1, 2, 0, 2, 3],
            edgeKey
        };
        // Pełny obwód B-rep: góra + dół + pion — bez dolnego obrysu PMI nie łapie
        // zewnętrznych krawędzi od spodu (np. wieniec górny od środka szafy).
        edges.push({ key: `outline_top_${i}`, points: [p0t, p1t] });
        edges.push({ key: `outline_bottom_${i}`, points: [p0b, p1b] });
        edges.push({ key: `outline_vert_${i}`, points: [p0t, p0b] });
    }

    return { sides, edges, vertices: [...topPts, ...bottomPts] };
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
    const wall = buildOutlineWalls(outline2d, plateW, plateD, thickness);

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

    appendFeatureEdges(result.edges, features, plateW, plateD, thickness);
    return result;
}
