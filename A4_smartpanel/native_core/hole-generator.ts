/**
 * Generator otworów walcowych (pojedyncze, TRIPLE, SYSTEM_32 / ROW) na licu płyty.
 * Wydzielony z cap-machining.ts (Punkt C) — matematyka 1:1.
 */
import { localTo3D, type computeFaceData } from './face-lcs.js';
import { readFeatureUV } from './feature-uv.js';
import { isPointInPolygon2D } from './planar-features.js';
import { appendQuad, appendTriangle, type FaceMeshData } from './face-mesh.js';
import type { CadEdge } from './brep-topology.js';

type FaceData = ReturnType<typeof computeFaceData>;

export function generateCircle(cx: number, cy: number, r: number, segments: number = 24) {
    const pts: number[][] = [];
    for (let i = 0; i < segments; i++) {
        const theta = (2 * Math.PI * i) / segments;
        pts.push([cx + r * Math.cos(theta), cy + r * Math.sin(theta)]);
    }
    return pts;
}

/** Środek otworu w układzie lica (u, v) + sufiks klucza krawędzi B-rep (`e_hole_<id><suffix>`). */
export interface HoleCenter { cx: number; cy: number; suffix: string }

/** Rozwija szablon wiercenia (`template_id`) na listę środków otworów. */
export function expandHoleCenters(params: any): HoleCenter[] {
    const { u: cxRaw, v: cyRaw } = readFeatureUV(params);
    const template = params.template_id || 'SINGLE';
    const spacing = params.spacing || 32;

    const holeCenters: HoleCenter[] = [];
    if (template === 'TRIPLE') {
        const offsetZ = params.offsetZ || 32;
        holeCenters.push({ cx: cxRaw, cy: cyRaw, suffix: '' });
        holeCenters.push({ cx: cxRaw, cy: cyRaw + offsetZ, suffix: '_t' });
        holeCenters.push({ cx: cxRaw, cy: cyRaw - offsetZ, suffix: '_b' });
    } else if (template === 'SYSTEM_32' || template === 'ROW') {
        const count = params.count || 5;
        for (let i = 0; i < count; i++) {
            holeCenters.push({ cx: cxRaw, cy: cyRaw + i * spacing, suffix: `_${i}` });
        }
    } else {
        holeCenters.push({ cx: cxRaw, cy: cyRaw, suffix: '' });
    }
    return holeCenters;
}

/**
 * Siatka otworów cechy `hole` na licu: ścianki walca (+ denko, gdy nie na wylot) trafiają do `mesh`,
 * kontury okręgów (CW) do `holes2D` — wycinane później z czapki przez cap-triangulation.
 */
export function appendFaceHoleMeshes(feat: any, ctx: {
    faceData: FaceData;
    outerContour: number[][];
    t: number;
    mesh: FaceMeshData;
    holes2D: number[][][];
}): void {
    const { faceData, outerContour, t, mesh: faceResult, holes2D } = ctx;
    const r = (feat.params.diameter || 35) / 2;
    const depth = feat.params.depth || 10;

    for (const { cx, cy } of expandHoleCenters(feat.params)) {
        const isInsideFace =
            cx >= r && cx <= (faceData.width - r) &&
            cy >= r && cy <= (faceData.height - r) &&
            isPointInPolygon2D(cx, cy, outerContour);

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
}

/** Krawędzie B-rep (okręgi na licu) dla cechy `hole`. */
export function appendHoleEdges(featureEdges: CadEdge[], feat: any, faceData: FaceData, faceContour: number[][]): void {
    const r = (feat.params.diameter || 35) / 2;

    for (const { cx, cy, suffix } of expandHoleCenters(feat.params)) {
        if (!isPointInPolygon2D(cx, cy, faceContour)) continue;
        const circle2D = generateCircle(cx, cy, r, 24);
        circle2D.push(circle2D[0]);
        const points = circle2D.map(p => localTo3D(faceData, p[0], p[1], 0));
        featureEdges.push({
            key: `e_hole_${feat.id}${suffix}`,
            points
        });
    }
}
