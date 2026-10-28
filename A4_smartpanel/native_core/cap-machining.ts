/**
 * Obróbka na ścianach płyty (otwory, wpusty) — wspólna dla box i outline2d.
 * Matematyka 1:1 z historycznej pętli FACE w mesh_builder (copy-move).
 */
import earcut from 'earcut';
import { normalizeFaceName } from '../panel-model.js';
import { computeFaceData, localTo3D } from './face-lcs.js';
import { isPointInPolygon2D } from './planar-features.js';
import { isFeatureSkipped, detectLGrooveUnion, buildAreaFeatureMeshes, appendAreaFeatureEdges } from './planar-feature-mesh.js';
import { appendQuad, appendTriangle, emptyMesh, type FaceMeshData } from './face-mesh.js';
import { generateCircle, expandHoleCenters, appendFaceHoleMeshes, appendHoleEdges } from './hole-generator.js';
import { triangulateFaceCap } from './cap-triangulation.js';
import type { CadEdge } from './brep-topology.js';

// Publiczne API (zgodność wsteczna) — implementacje w dedykowanych serwisach native_core:
//   face-mesh.ts        — prymitywy siatki lica
//   brep-topology.ts    — CadEdge, dissolver krawędzi współpłaszczyznowych
//   planar-features.ts      — czysta matematyka boolowska 2D (EarCut, polygon clipping)
//   planar-feature-mesh.ts  — budowa siatek 3D wpustów / kieszeni / wycięć (dno, ścianki, krawędzie)
//   hole-generator.ts   — otwory walcowe, TRIPLE, SYSTEM_32
//   cap-triangulation.ts — triangulacja earcut czapki lica z otworami
export { getGrooveParamsMm } from '../../A1_core/groove-params.js';
export { readFeatureUV, hasFeatureParamsUV } from './feature-uv.js';
export { isPointInPolygon2D } from './planar-features.js';
export { isFeatureSkipped, detectLGrooveUnion, type LGrooveUnion } from './planar-feature-mesh.js';
export { generateCircle, expandHoleCenters } from './hole-generator.js';
export { cutBoxFromPolygon, collectExtraHoles2D } from './cap-triangulation.js';
export type { FaceMeshData } from './face-mesh.js';
export type { CadEdge } from './brep-topology.js';

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
        const raw = key.slice('e_groove_'.length).replace(/_seg\d+$/, '');
        for (const suffix of GROOVE_EDGE_SUFFIXES) {
            if (raw.endsWith(suffix)) return raw.slice(0, -suffix.length);
        }
        const mPoly = raw.match(/^(.*)_(?:[tbv]\d+|v_corner|v_mouth_\d+|v_wall_\d+)$/);
        if (mPoly && mPoly[1]) return mPoly[1];
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

export function featuresOnFace(features: any[] | undefined, face: string): any[] {
    if (!features) return [];
    return features.filter((f: any) => {
        if (isFeatureSkipped(f)) return false;
        const fFace = f.face ? normalizeFaceName(f.face) : (f.side ? normalizeFaceName(f.side) : '');
        return fFace === face;
    });
}

export function buildFaceMeshWithFeatures(opts: {
    faceData: ReturnType<typeof computeFaceData>;
    outerContour: number[][];
    bottomContour?: number[][];
    extraHoles: number[][][];
    featuresOnFace: any[];
    w: number;
    h: number;
    t: number;
}): FaceBuildResult {
    const { faceData, outerContour, bottomContour, extraHoles, featuresOnFace: feats, w, h, t } = opts;
    const holes2D: number[][][] = extraHoles ? [...extraHoles] : [];
    const faceResult: FaceMeshData = emptyMesh();
    const featureMeshes: Record<string, FaceMeshData> = {};
    const lUnion = detectLGrooveUnion(feats, w, h);

    for (const feat of feats) {
        if (feat.type === 'hole') {
            appendFaceHoleMeshes(feat, { faceData, outerContour, t, mesh: faceResult, holes2D });
        } else if (feat.type === 'groove' || feat.type === 'pocket' || feat.type === 'cutout') {
            buildAreaFeatureMeshes(feat, { faceData, outerContour, bottomContour, feats, lUnion, t, featureMeshes });
        } else {
            console.warn(`[cap-machining] Pominięto nieobsługiwany typ feature: "${feat?.type}" (id: ${feat?.id ?? 'brak'}). Dozwolone typy to 'hole' i 'groove'.`);
            continue;
        }
    }

    triangulateFaceCap({ faceData, outerContour, feats, holes2D, faceResult });

    return { mesh: faceResult, featureMeshes };
}

export function appendFeatureEdges(
    edges: CadEdge[],
    features: any[] | undefined,
    w: number,
    h: number,
    t: number,
    customFaceDataMap?: Record<string, any>,
    outerContourParam?: number[][],
    bevelContoursMap?: Record<string, { faceContour: number[][]; bottomContour: number[][] }>
): void {
    if (!features) return;

    const featureEdges: CadEdge[] = [];
    const outerContour = outerContourParam || [[0, 0], [w, 0], [w, h], [0, h]];
    const lUnion = detectLGrooveUnion(features, w, h);

    for (const feat of features) {
        if (isFeatureSkipped(feat)) continue;
        const normFace = normalizeFaceName(feat.face || feat.side || 'FACE_Z_PLUS');
        const faceData = (customFaceDataMap && customFaceDataMap[normFace]) || computeFaceData(normFace, w, h, t);
        const bevelEntry = bevelContoursMap && bevelContoursMap[normFace];
        const faceContour = bevelEntry
            ? bevelEntry.faceContour
            : (normFace === 'FACE_Z_MINUS'
                ? outerContour.map(([u, v]) => [w - u, v]).reverse()
                : outerContour);
        const bottomContour = bevelEntry ? bevelEntry.bottomContour : undefined;
        if (feat.type === 'hole') {
            appendHoleEdges(featureEdges, feat, faceData, faceContour);
        } else if (feat.type === 'groove' || feat.type === 'pocket' || feat.type === 'cutout') {
            appendAreaFeatureEdges(featureEdges, feat, { faceData, faceContour, bottomContour, lUnion, normFace, t });
        } else {
            console.warn(`[cap-machining] Pominięto krawędzie dla nieobsługiwanego typu feature: "${feat?.type}" (id: ${feat?.id ?? 'brak'}).`);
            continue;
        }
    }

    edges.push(...featureEdges);
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
                const r = (feat.params.diameter || 35) / 2;
                const depth = feat.params.depth || 10;

                for (const { cx, cy, suffix } of expandHoleCenters(feat.params)) {
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

                        for (let i = 0; i < segments; i++) {
                            const nextI = (i + 1) % segments;
                            appendTriangle(mesh, p3dBottom[i], pCenterBottom, p3dBottom[nextI]);
                            appendQuad(mesh, p3dTop[i], p3dTop[nextI], p3dBottom[nextI], p3dBottom[i]);
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

                        for (let i = 0; i < segments; i++) {
                            const nextI = (i + 1) % segments;
                            appendTriangle(mesh, p3dBottom[nextI], pCenterBottom, p3dBottom[i]);
                            appendQuad(mesh, p3dTop[nextI], p3dTop[i], p3dBottom[i], p3dBottom[nextI]);
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
