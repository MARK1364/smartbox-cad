/**
 * Obróbka na ścianach płyty (otwory, wpusty) — wspólna dla box i outline2d.
 * Matematyka 1:1 z historycznej pętli FACE w mesh_builder (copy-move).
 */
import earcut from 'earcut';
import { normalizeFaceName } from '../panel-model.js';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';

export { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { computeFaceData, localTo3D } from './face-lcs.js';

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
        const piece = clipPolygonByConvex(outerContour, hole);
        if (piece.length < 3) continue;
        if (Math.abs(signedArea2D(piece)) < minArea) continue;
        clipped.push(piece);
    }

    return clipped;
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
        if (feat.type !== 'groove') continue;

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
        const pushHole = (rawFace: string) => {
            const canonicalFace = normalizeFaceName(rawFace);
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

    return extraHoles2D;
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

    for (const feat of feats) {
        if (feat.type === 'hole') {
            const cxRaw = feat.params.u !== undefined ? feat.params.u : (feat.params.x !== undefined ? feat.params.x : 0);
            const cyRaw = feat.params.v !== undefined ? feat.params.v : (feat.params.y !== undefined ? feat.params.y : 0);
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

                    const hw = w / 2, hh = h / 2, ht = t / 2;
                    const EPS = 0.01;

                    const addQuad = (pA: number[], pB: number[], pC: number[], pD: number[]) => {
                        if (Math.abs(pA[0]) >= hw - EPS || Math.abs(pA[1]) >= hh - EPS || Math.abs(pA[2]) >= ht - EPS) return;
                        appendQuad(faceResult, pA, pB, pC, pD);
                    };

                    const addTriangle = (pA: number[], pB: number[], pC: number[]) => {
                        if (Math.abs(pA[0]) >= hw - EPS || Math.abs(pA[1]) >= hh - EPS || Math.abs(pA[2]) >= ht - EPS) return;
                        appendTriangle(faceResult, pA, pB, pC);
                    };

                    for (let i = 0; i < segments; i++) {
                        const nextI = (i + 1) % segments;
                        addTriangle(p3dBottom[i], pCenterBottom, p3dBottom[nextI]);
                        addQuad(p3dTop[i], p3dTop[nextI], p3dBottom[nextI], p3dBottom[i]);
                    }
                }
            }
        } else if (feat.type === 'groove') {
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

            const fid = String(feat.id || 'groove');
            const bottom = emptyMesh();
            appendQuad(bottom, p00_d, p10_d, p11_d, p01_d);
            featureMeshes[`feature_${fid}_bottom`] = bottom;

            // Ścianki współpłaszczyznowe z zewnątrznymi licami (przelot U/V) = „cienkie
            // płaszczyzny” — nie rysuj; otwór i tak wycina collectExtraHoles2D.
            const EDGE_EPS = 0.05;
            const throughU0 = u0 <= EDGE_EPS;
            const throughU1 = u1 >= faceData.width - EDGE_EPS;
            const throughV0 = v0 <= EDGE_EPS;
            const throughV1 = v1 >= faceData.height - EDGE_EPS;

            if (!throughV0) {
                const w0 = emptyMesh();
                appendQuad(w0, p00_0, p00_d, p10_d, p10_0);
                featureMeshes[`feature_${fid}_w0`] = w0;
            }
            if (!throughU1) {
                const w1 = emptyMesh();
                appendQuad(w1, p10_0, p10_d, p11_d, p11_0);
                featureMeshes[`feature_${fid}_w1`] = w1;
            }
            if (!throughV1) {
                const w2 = emptyMesh();
                appendQuad(w2, p11_0, p11_d, p01_d, p01_0);
                featureMeshes[`feature_${fid}_w2`] = w2;
            }
            if (!throughU0) {
                const w3 = emptyMesh();
                appendQuad(w3, p01_0, p01_d, p00_d, p00_0);
                featureMeshes[`feature_${fid}_w3`] = w3;
            }
        }
    }

    const flatVertices: number[] = [];
    const holeIndices: number[] = [];

    for (const [u, v] of outerContour) {
        flatVertices.push(u, v);
    }

    for (const hole of clipHolesToContour(holes2D, outerContour)) {
        holeIndices.push(flatVertices.length / 2);
        for (const [u, v] of hole) {
            flatVertices.push(u, v);
        }
    }

    const triangles = earcut(flatVertices, holeIndices, 2);

    const offset = faceResult.positions.length / 3;
    for (let i = 0; i < flatVertices.length; i += 2) {
        const u = flatVertices[i];
        const v = flatVertices[i + 1];
        const p3d = localTo3D(faceData, u, v, 0);
        faceResult.positions.push(...p3d);
    }

    for (const idx of triangles) {
        faceResult.indices.push(idx + offset);
    }

    return { mesh: faceResult, featureMeshes };
}

export function appendFeatureEdges(
    edges: CadEdge[],
    features: any[] | undefined,
    w: number,
    h: number,
    t: number
): void {
    if (!features) return;

    for (const feat of features) {
        if (isFeatureSkipped(feat)) continue;
        const faceData = computeFaceData(feat.face, w, h, t);
        if (feat.type === 'hole') {
            const cxRaw = feat.params.u !== undefined ? feat.params.u : (feat.params.x !== undefined ? feat.params.x : 0);
            const cyRaw = feat.params.v !== undefined ? feat.params.v : (feat.params.y !== undefined ? feat.params.y : 0);
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
                edges.push({
                    key: `e_hole_${feat.id}${suffix}`,
                    points
                });
            }
        } else if (feat.type === 'groove') {
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

            edges.push({ key: `e_groove_${feat.id}_t1`, points: [p00_0, p10_0] });
            edges.push({ key: `e_groove_${feat.id}_t2`, points: [p10_0, p11_0] });
            edges.push({ key: `e_groove_${feat.id}_t3`, points: [p11_0, p01_0] });
            edges.push({ key: `e_groove_${feat.id}_t4`, points: [p01_0, p00_0] });

            edges.push({ key: `e_groove_${feat.id}_b1`, points: [p00_d, p10_d] });
            edges.push({ key: `e_groove_${feat.id}_b2`, points: [p10_d, p11_d] });
            edges.push({ key: `e_groove_${feat.id}_b3`, points: [p11_d, p01_d] });
            edges.push({ key: `e_groove_${feat.id}_b4`, points: [p01_d, p00_d] });

            edges.push({ key: `e_groove_${feat.id}_v1`, points: [p00_0, p00_d] });
            edges.push({ key: `e_groove_${feat.id}_v2`, points: [p10_0, p10_d] });
            edges.push({ key: `e_groove_${feat.id}_v3`, points: [p11_0, p11_d] });
            edges.push({ key: `e_groove_${feat.id}_v4`, points: [p01_0, p01_d] });
        }
    }
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
                const cxRaw = feat.params.u !== undefined ? feat.params.u : (feat.params.x !== undefined ? feat.params.x : 0);
                const cyRaw = feat.params.v !== undefined ? feat.params.v : (feat.params.y !== undefined ? feat.params.y : 0);
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

