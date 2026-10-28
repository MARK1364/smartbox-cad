import { computeFaceData, localTo3D } from './face-lcs.js';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { nmToMm, mmToNm } from '../../A1_core/cad-math/units.js';
import {
    appendFeatureEdges,
    buildFaceMeshWithFeatures,
    collectExtraHoles2D,
    cutBoxFromPolygon,
    featuresOnFace
} from './cap-machining.js';
import { dissolveCoplanarEdges } from './brep-topology.js';
import {
    clipFeaturesToOutline,
    intersectPolygonWithContour,
    isEdgeOnContour
} from './planar-features.js';
import { discretizePolygonWithFillets } from '../../A1_core/cad-math/arc2d.js';

export { clipFeaturesToOutline, intersectPolygonWithContour } from './planar-features.js';

export type OutlineSegmentEdgeKey = '+X' | '-X' | '+Y' | '-Y' | 'NOTCH';
export type SegmentProvenance = 'NOMINAL' | 'CUTOUT' | 'FEATURE';

export interface BrepEdgeData {
    key: string;
    points: number[][];
    faces?: [string, string];
    edgeKey?: OutlineSegmentEdgeKey;
    alias?: string;
}

/** Precyzja numeryczna dla porównań zmiennoprzecinkowych (1 mikrometr = 0.001 mm = 1000 nm). */
const CAD_EPS = 0.001;
/** Tolerancja geometryczna leżenia wierzchołka na nominalnej granicy formatki [mm]. */
const CAD_EPS_BOUND = 0.05;

/**
 * Oblicza pole ze znakiem poligonu 2D (wzór Gaussa / Shoelace).
 * Wartość > 0 oznacza orientację przeciwną do ruchu wskazówek zegara (CCW).
 */
export function computePolygonSignedArea(pts: number[][]): number {
    const n = pts.length;
    if (n < 3) return 0;
    let area = 0;
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        area += pts[i][0] * pts[next][1] - pts[next][0] * pts[i][1];
    }
    return area / 2;
}

/**
 * Normalizuje obrys poligonu do orientacji CCW (przeciwnie do ruchu wskazówek zegara).
 * Jeśli wierzchołki były zdefiniowane CW, funkcja odwraca ich kolejność,
 * gwarantując poprawny kierunek zewnętrznych wektorów normalnych segmentów.
 */
export function ensureCCW(pts: number[][]): number[][] {
    if (pts.length < 3) return pts;
    const area = computePolygonSignedArea(pts);
    if (area < 0) {
        return [...pts].reverse();
    }
    return pts;
}

/**
 * Adapter rzutujący współrzędne profilu 2D (u,v w mm) na lokalny układ 3D (LCS w mm).
 * Standard warsztatowy SSOT:
 * - LCS jest wycentrowany w geometrycznym środku płyty (0, 0, 0).
 * - Lico robocze FACE_Z_PLUS leży na Z = +T/2.
 * - Lico przeciwne FACE_Z_MINUS leży na Z = -T/2.
 */
export function profileUVToLCS(
    u: number,
    v: number,
    zSide: 'PLUS' | 'MINUS',
    depthOffset: number,
    plateW: number,
    plateD: number,
    thickness: number
): number[] {
    const faceName = zSide === 'PLUS' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS';
    const face = computeFaceData(faceName, plateW, plateD, thickness);
    const uInFace = zSide === 'PLUS' ? u : face.width - u;
    return localTo3D(face, uInFace, v, depthOffset);
}

/**
 * Klasyfikacja semantyczna segmentu profilu 2D oparta na:
 * 1. Zewnętrznym wektorze normalnym 2D n = (Δv/L, -Δu/L) dla obrysu zorientowanego CCW.
 * 2. Położeniu na nominalnej granicy formatki ([0, plateW] x [0, plateD]).
 * 3. Pochodzeniu segmentu (NOMINAL vs CUTOUT).
 */
export function classifyOutlineSegmentEdge(
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    plateW: number,
    plateD: number,
    provenance: SegmentProvenance = 'NOMINAL'
): OutlineSegmentEdgeKey {
    const du = u1 - u0;
    const dv = v1 - v0;
    const len = Math.hypot(du, dv);
    if (len < CAD_EPS) {
        return 'NOTCH';
    }

    // Zewnętrzny wektor normalny 2D dla konturu zorientowanego CCW: (dv/L, -du/L)
    const nx = dv / len;
    const ny = -du / len;

    // Granica dolna (-Y): v ≈ 0, normalna skierowana w dół (ny < -0.99)
    if (Math.abs(v0) <= CAD_EPS_BOUND && Math.abs(v1) <= CAD_EPS_BOUND && ny < -0.99) {
        return provenance !== 'CUTOUT' ? '-Y' : 'NOTCH';
    }

    // Granica prawa (+X): u ≈ plateW, normalna skierowana w prawo (nx > 0.99)
    if (Math.abs(u0 - plateW) <= CAD_EPS_BOUND && Math.abs(u1 - plateW) <= CAD_EPS_BOUND && nx > 0.99) {
        return provenance !== 'CUTOUT' ? '+X' : 'NOTCH';
    }

    // Granica górna (+Y): v ≈ plateD, normalna skierowana w górę (ny > 0.99)
    if (Math.abs(v0 - plateD) <= CAD_EPS_BOUND && Math.abs(v1 - plateD) <= CAD_EPS_BOUND && ny > 0.99) {
        return provenance !== 'CUTOUT' ? '+Y' : 'NOTCH';
    }

    // Granica lewa (-X): u ≈ 0, normalna skierowana w lewo (nx < -0.99)
    if (Math.abs(u0) <= CAD_EPS_BOUND && Math.abs(u1) <= CAD_EPS_BOUND && nx < -0.99) {
        return provenance !== 'CUTOUT' ? '-X' : 'NOTCH';
    }

    // Krawędź skośna rozpięta na szerokości formatki (np. ścięte plecy lub dach skośnych drzwi)
    if (provenance !== 'CUTOUT' && Math.abs(du) >= plateW * 0.7) {
        const vAvg = (v0 + v1) / 2;
        if (vAvg > plateD * 0.5 && ny > 0) return '+Y';
        if (vAvg <= plateD * 0.5 && ny < 0) return '-Y';
    }

    // Segmenty wewnętrzne (wcięcia narożnika, kieszenie brzegowe) lub skośne (np. dach, skos)
    return 'NOTCH';
}

interface OutlineSubSegment {
    u0: number; v0: number;
    u1: number; v1: number;
    depthPlus: number;
    depthMinus: number;
}

export interface ExtrusionGrooveBox {
    fu0: number;
    fu1: number;
    fv0: number;
    fv1: number;
    depth: number;
    isPlus: boolean;
    polygon?: number[][];
}

export function extractGrooveBoxes(features?: any[], plateW?: number): ExtrusionGrooveBox[] {
    if (!features || features.length === 0) return [];
    const boxes: ExtrusionGrooveBox[] = [];
    for (const f of features) {
        if (!f || (f.type !== 'groove' && f.type !== 'pocket' && f.type !== 'cutout')) continue;
        const gp = getGrooveParamsMm(f.params);
        const depth = gp.depth || 0;
        if (depth <= CAD_EPS) continue;
        const isPlus = !f.face || String(f.face).includes('PLUS');
        const fu0 = isPlus || plateW === undefined ? gp.u : plateW - (gp.u + gp.width);
        const fu1 = isPlus || plateW === undefined ? gp.u + gp.width : plateW - gp.u;
        let polygon: number[][] | undefined;
        if (Array.isArray(f.params?.polygon) && f.params.polygon.length >= 3) {
            polygon = isPlus || plateW === undefined
                ? f.params.polygon
                : f.params.polygon.map(([pu, pv]: number[]) => [plateW - pu, pv]).reverse();
        }
        boxes.push({
            fu0,
            fu1,
            fv0: gp.v,
            fv1: gp.v + gp.length,
            depth,
            isPlus,
            polygon
        });
    }
    return boxes;
}

export function splitSegmentByGrooves(
    u0: number, v0: number,
    u1: number, v1: number,
    grooveBoxes: ExtrusionGrooveBox[]
): OutlineSubSegment[] {
    if (grooveBoxes.length === 0) {
        return [{ u0, v0, u1, v1, depthPlus: 0, depthMinus: 0 }];
    }

    const isHoriz = Math.abs(v1 - v0) < CAD_EPS;
    const isVert = Math.abs(u1 - u0) < CAD_EPS;
    const segDx = u1 - u0;
    const segDv = v1 - v0;
    const segLen = Math.hypot(segDx, segDv);
    if (segLen < CAD_EPS) {
        return [{ u0, v0, u1, v1, depthPlus: 0, depthMinus: 0 }];
    }

    const splitT = new Set<number>([0, 1]);

    for (const box of grooveBoxes) {
        if (box.polygon && box.polygon.length >= 3) {
            const m = box.polygon.length;
            const ux = segDx / segLen;
            const uv = segDv / segLen;
            for (let k = 0; k < m; k++) {
                const pA = box.polygon[k];
                const pB = box.polygon[(k + 1) % m];
                const distA = Math.abs((pA[0] - u0) * uv - (pA[1] - v0) * ux);
                const distB = Math.abs((pB[0] - u0) * uv - (pB[1] - v0) * ux);
                if (distA <= 0.05 && distB <= 0.05) {
                    const tA = ((pA[0] - u0) * ux + (pA[1] - v0) * uv) / segLen;
                    const tB = ((pB[0] - u0) * ux + (pB[1] - v0) * uv) / segLen;
                    if (tA > CAD_EPS && tA < 1 - CAD_EPS) splitT.add(tA);
                    if (tB > CAD_EPS && tB < 1 - CAD_EPS) splitT.add(tB);
                }
            }
            continue;
        }

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
            let hitsSub = false;
            if (box.polygon && box.polygon.length >= 3) {
                hitsSub = isEdgeOnContour([subU0, subV0], [subU1, subV1], box.polygon, 0.05);
            } else {
                hitsSub = midU >= box.fu0 - CAD_EPS && midU <= box.fu1 + CAD_EPS && midV >= box.fv0 - CAD_EPS && midV <= box.fv1 + CAD_EPS;
            }
            if (hitsSub) {
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
    const normalizedOutline = ensureCCW(outline2d);
    const facePlus = computeFaceData('FACE_Z_PLUS', plateW, plateD, thickness);
    const faceMinus = computeFaceData('FACE_Z_MINUS', plateW, plateD, thickness);
    const topPts: number[][] = [];
    const bottomPts: number[][] = [];
    for (let i = 0; i < normalizedOutline.length; i++) {
        const [u, v] = normalizedOutline[i];
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
    const normalizedOutline = ensureCCW(outline2d);
    const n = normalizedOutline.length;
    const facePlus = computeFaceData('FACE_Z_PLUS', plateW, plateD, thickness);
    const faceMinus = computeFaceData('FACE_Z_MINUS', plateW, plateD, thickness);
    const sides: Record<string, { positions: number[]; indices: number[]; edgeKey: OutlineSegmentEdgeKey }> = {};
    const edges: BrepEdgeData[] = [];
    const allVertices: number[][] = [];

    const grooveBoxes = extractGrooveBoxes(features, plateW);
    const allSubsegs = normalizedOutline.map((pt, i) => {
        const next = (i + 1) % n;
        const [u0, v0] = pt;
        const [u1, v1] = normalizedOutline[next];
        return splitSegmentByGrooves(u0, v0, u1, v1, grooveBoxes);
    });

    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        const [u0, v0] = normalizedOutline[i];
        const [u1, v1] = normalizedOutline[next];
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
            ind.push(vertOffset, vertOffset + 2, vertOffset + 1, vertOffset, vertOffset + 3, vertOffset + 2);
            vertOffset += 4;

            const suffix = subsegs.length > 1 ? `_${vertOffset}` : '';
            
            // Krawędzie górna (Z+) i dolna (Z-) z przypisanym sąsiedztwem ścian i stabilnymi aliasami
            const topEdgeData: BrepEdgeData = {
                key: `outline_top_${i}${suffix}`,
                points: [p0t, p1t],
                faces: ['FACE_Z_PLUS', `OUTLINE_SIDE_${i}`],
                edgeKey
            };
            if (edgeKey === '-Y') topEdgeData.alias = 'dol_przod';
            else if (edgeKey === '+Y') topEdgeData.alias = 'gora_przod';
            else if (edgeKey === '-X') topEdgeData.alias = 'przod_lewo';
            else if (edgeKey === '+X') topEdgeData.alias = 'przod_prawo';
            edges.push(topEdgeData);

            const botEdgeData: BrepEdgeData = {
                key: `outline_bottom_${i}${suffix}`,
                points: [p0b, p1b],
                faces: ['FACE_Z_MINUS', `OUTLINE_SIDE_${i}`],
                edgeKey
            };
            if (edgeKey === '-Y') botEdgeData.alias = 'dol_tyl';
            else if (edgeKey === '+Y') botEdgeData.alias = 'gora_tyl';
            else if (edgeKey === '-X') botEdgeData.alias = 'tyl_lewo';
            else if (edgeKey === '+X') botEdgeData.alias = 'tyl_prawo';
            edges.push(botEdgeData);

            // Krawędź pionowa narożnika obrysu: na wierzchołku narożnika (sIdx === 0)
            if (sIdx === 0) {
                let pCornerPoints: number[][];
                if (prevLastSub) {
                    const cornerDepthPlus = Math.max(prevLastSub.depthPlus, sub.depthPlus);
                    const cornerDepthMinus = Math.max(prevLastSub.depthMinus, sub.depthMinus);
                    const pCornert = localTo3D(facePlus, sub.u0, sub.v0, cornerDepthPlus);
                    const pCornerb = localTo3D(faceMinus, faceMinus.width - sub.u0, sub.v0, cornerDepthMinus);
                    pCornerPoints = [pCornert, pCornerb];
                } else {
                    pCornerPoints = [p0t, p0b];
                }

                // Sprawdzenie leżenia wierzchołka narożnika na jednym z 4 nominalnych rogów formatki
                const isNearX0 = Math.abs(sub.u0) <= CAD_EPS_BOUND;
                const isNearXW = Math.abs(sub.u0 - plateW) <= CAD_EPS_BOUND;
                const isNearY0 = Math.abs(sub.v0) <= CAD_EPS_BOUND;
                const isNearYH = Math.abs(sub.v0 - plateD) <= CAD_EPS_BOUND;

                let vertAlias: string | undefined;
                let vertFaces: [string, string] = [`OUTLINE_SIDE_${prevIdx}`, `OUTLINE_SIDE_${i}`];

                if (isNearX0 && isNearY0) {
                    vertAlias = 'dol_lewo';
                    vertFaces = ['FACE_X_MINUS', 'FACE_Y_MINUS'];
                } else if (isNearXW && isNearY0) {
                    vertAlias = 'dol_prawo';
                    vertFaces = ['FACE_X_PLUS', 'FACE_Y_MINUS'];
                } else if (isNearX0 && isNearYH) {
                    vertAlias = 'gora_lewo';
                    vertFaces = ['FACE_X_MINUS', 'FACE_Y_PLUS'];
                } else if (isNearXW && isNearYH) {
                    vertAlias = 'gora_prawo';
                    vertFaces = ['FACE_X_PLUS', 'FACE_Y_PLUS'];
                }

                edges.push({
                    key: `outline_vert_${i}${suffix}`,
                    points: pCornerPoints,
                    faces: vertFaces,
                    edgeKey,
                    ...(vertAlias ? { alias: vertAlias } : {})
                });
            } else {
                // Na wewnętrznym łączeniu podsegmentów (uskok schodka):
                // Krawędź pionowa istnieje TYLKO wzdłuż uskoku (np. 11 mm od lica do dna wpustu).
                const prevSub = subsegs[sIdx - 1];
                const dPlus0 = Math.min(prevSub.depthPlus, sub.depthPlus);
                const dPlus1 = Math.max(prevSub.depthPlus, sub.depthPlus);
                if (dPlus1 - dPlus0 > CAD_EPS) {
                    const pStepT0 = localTo3D(facePlus, sub.u0, sub.v0, dPlus0);
                    const pStepT1 = localTo3D(facePlus, sub.u0, sub.v0, dPlus1);
                    edges.push({
                        key: `outline_step_top_${i}${suffix}`,
                        points: [pStepT0, pStepT1],
                        faces: ['FACE_Z_PLUS', `OUTLINE_SIDE_${i}`],
                        edgeKey
                    });
                }
                const dMinus0 = Math.min(prevSub.depthMinus, sub.depthMinus);
                const dMinus1 = Math.max(prevSub.depthMinus, sub.depthMinus);
                if (dMinus1 - dMinus0 > CAD_EPS) {
                    const pStepB0 = localTo3D(faceMinus, faceMinus.width - sub.u0, sub.v0, dMinus0);
                    const pStepB1 = localTo3D(faceMinus, faceMinus.width - sub.u0, sub.v0, dMinus1);
                    edges.push({
                        key: `outline_step_bot_${i}${suffix}`,
                        points: [pStepB0, pStepB1],
                        faces: ['FACE_Z_MINUS', `OUTLINE_SIDE_${i}`],
                        edgeKey
                    });
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
    outline2d?: Array<[number, number] | number[] | { u: number; v: number; fillet_mm?: number }>;
    outline2d_nm?: Array<[number, number]>;
    fillet_mm?: number;
    plateW: number;
    plateD: number;
    thickness: number;
    features?: any[];
}

export function buildPolygonPanelTopology(input: PolygonExtrusionInput): Record<string, any> {
    const { plateW, plateD, thickness, features, fillet_mm } = input;
    let outline2d = input.outline2d;
    if (input.outline2d_nm && Array.isArray(input.outline2d_nm) && input.outline2d_nm.length >= 3) {
        outline2d = input.outline2d_nm.map(([unm, vnm]) => [nmToMm(unm), nmToMm(vnm)]);
    }
    if (!outline2d || outline2d.length < 3) {
        throw new Error('[polygon-extrusion] Wymagany jest obrys co najmniej 3-punktowy (outline2d lub outline2d_nm).');
    }

    const hasFillets = (fillet_mm && fillet_mm > 0.05) ||
        outline2d.some(p => typeof p === 'object' && !Array.isArray(p) && ((p as any).fillet_mm ?? 0) > 0.05);

    const baseOutline: number[][] = hasFillets
        ? discretizePolygonWithFillets(outline2d as any, fillet_mm || 0)
        : (outline2d as any).map((p: any) => Array.isArray(p) ? [p[0], p[1]] : [p.u, p.v]);

    const normalizedOutline = ensureCCW(baseOutline);
    const clippedFeatures = clipFeaturesToOutline(features, normalizedOutline, plateW, plateD);
    const wall = buildOutlineWalls(normalizedOutline, plateW, plateD, thickness, clippedFeatures);

    const extraHoles = collectExtraHoles2D(clippedFeatures, plateW, plateD, thickness);
    const facePlus = computeFaceData('FACE_Z_PLUS', plateW, plateD, thickness);
    const faceMinus = computeFaceData('FACE_Z_MINUS', plateW, plateD, thickness);

    const contourPlus = normalizedOutline.map(([u, v]) => [u, v]);
    const contourMinus = normalizedOutline.map(([u, v]) => [faceMinus.width - u, v]).reverse();

    const builtPlus = buildFaceMeshWithFeatures({
        faceData: facePlus,
        outerContour: contourPlus,
        extraHoles: extraHoles.FACE_Z_PLUS || [],
        featuresOnFace: featuresOnFace(clippedFeatures, 'FACE_Z_PLUS'),
        w: plateW,
        h: plateD,
        t: thickness
    });
    const builtMinus = buildFaceMeshWithFeatures({
        faceData: faceMinus,
        outerContour: contourMinus,
        extraHoles: extraHoles.FACE_Z_MINUS || [],
        featuresOnFace: featuresOnFace(clippedFeatures, 'FACE_Z_MINUS'),
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

    appendFeatureEdges(result.edges, clippedFeatures, plateW, plateD, thickness, undefined, normalizedOutline);
    result.edges = dissolveCoplanarEdges(result);
    return result;
}

/**
 * Wyprowadza profil 2D formatki z uwzględnieniem wycięć brzegowych (Notch / Rewizja).
 * Gdy formatka posiada wycięcie dochodzące do krawędzi (u=0, u=W, v=0 lub v=H),
 * wycięcie modyfikuje obrys zewnętrzny formatki (np. 6-kąt narożny lub 8-kąt boczny),
 * dzięki czemu lico płyty triangulowane jest jako jeden spójny poligon bez pasków i linii widma.
 */
export function deriveOutlineWithCutouts(
    plateW: number,
    plateD: number,
    thickness: number,
    features?: any[]
): { outline2d: number[][]; consumedFeatures: Set<any>; adjustedFeatures?: any[] } | null {
    if (!features || !Array.isArray(features) || features.length === 0) {
        return null;
    }

    const EPS = 0.05;
    let currentPoly: number[][] = [
        [0, 0],
        [plateW, 0],
        [plateW, plateD],
        [0, plateD]
    ];
    const consumedFeatures = new Set<any>();
    const cutBoxes: CutoutBoxMm[] = [];

    for (const feat of features) {
        if (!feat || !feat.params) continue;
        const isCutout = feat.type === 'cutout';
        const isThroughPocket = (feat.type === 'pocket') && (
            feat.params.through === true ||
            feat.params.kind === 'THROUGH' ||
            (Number(feat.params.depth) || 0) >= thickness - EPS
        );

        if (!isCutout && !isThroughPocket) continue;

        const face = String(feat.face || feat.side || 'FACE_Z_PLUS');
        if (!face.includes('FACE_Z') && face !== '') continue;

        const gp = getGrooveParamsMm(feat.params);
        const isMinus = face.includes('MINUS');
        const u0 = isMinus ? plateW - (gp.u + gp.width) : gp.u;
        const u1 = isMinus ? plateW - gp.u : gp.u + gp.width;
        const v0 = gp.v;
        const v1 = v0 + gp.length;

        // Czy cecha dotyka przynajmniej jednej krawędzi formatki?
        const touches = (
            u0 <= EPS ||
            u1 >= plateW - EPS ||
            v0 <= EPS ||
            v1 >= plateD - EPS
        );

        if (!touches) continue;

        const cutResult = cutBoxFromPolygon(currentPoly, u0, u1, v0, v1);
        if (cutResult && cutResult.length > 1) {
            throw new Error(`[polygon-extrusion] Wycięcie brzegowe (id: ${feat.id ?? 'brak'}) rozcina formatkę na ${cutResult.length} osobne części. Wycięcie nie może przecinać całej formatki na wskroś dzieląc jej na osobne bryły.`);
        }
        if (cutResult && cutResult.length === 1 && cutResult[0].length >= 3) {
            currentPoly = cutResult[0];
            consumedFeatures.add(feat);
            cutBoxes.push({
                u0: Math.max(0, u0),
                u1: Math.min(plateW, u1),
                v0: Math.max(0, v0),
                v1: Math.min(plateD, v1)
            });
        }
    }

    if (consumedFeatures.size > 0) {
        const remainingFeatures = features.filter((f: any) => !consumedFeatures.has(f));
        const adjustedFeatures = clipFeaturesToOutline(remainingFeatures, currentPoly, plateW, plateD);
        return {
            outline2d: currentPoly,
            consumedFeatures,
            adjustedFeatures
        };
    }

    return null;
}

export interface CutoutBoxMm {
    u0: number;
    u1: number;
    v0: number;
    v1: number;
}

/**
 * Przycina lub dzieli cechy liniowe i kieszenie (groove/pocket) kolidujące z wycięciami brzegowymi,
 * tak aby geometria dna i ścianek nie powstawała w pustce wyciętego materiału.
 */
export function clipFeaturesByCutBoxes(features: any[], cutBoxes: CutoutBoxMm[]): any[] {
    if (!features || features.length === 0 || cutBoxes.length === 0) return features;

    const EPS = 0.05;
    const result: any[] = [];

    for (const feat of features) {
        if (!feat || !feat.params) {
            result.push(feat);
            continue;
        }

        if (feat.type === 'hole') {
            const u = Number(feat.params.u) || 0;
            const v = Number(feat.params.v) || 0;
            const inCut = cutBoxes.some(b =>
                u >= b.u0 - EPS && u <= b.u1 + EPS &&
                v >= b.v0 - EPS && v <= b.v1 + EPS
            );
            if (!inCut) {
                result.push(feat);
            }
            continue;
        }

        if (feat.type === 'groove' || feat.type === 'pocket') {
            let currentPieces: any[] = [feat];

            for (const box of cutBoxes) {
                const nextPieces: any[] = [];
                for (const piece of currentPieces) {
                    const gp = getGrooveParamsMm(piece.params);
                    const pU0 = gp.u;
                    const pU1 = gp.u + gp.width;
                    const pV0 = gp.v;
                    const pV1 = gp.v + gp.length;

                    const inU0 = Math.max(pU0, box.u0);
                    const inU1 = Math.min(pU1, box.u1);
                    const inV0 = Math.max(pV0, box.v0);
                    const inV1 = Math.min(pV1, box.v1);

                    const overlaps = (inU1 - inU0 > EPS) && (inV1 - inV0 > EPS);
                    if (!overlaps) {
                        nextPieces.push(piece);
                        continue;
                    }

                    const isVertGroove = (gp.length >= gp.width);
                    if (isVertGroove) {
                        const lenBefore = inV0 - pV0;
                        if (lenBefore > 0.1) {
                            const pBefore = JSON.parse(JSON.stringify(piece));
                            pBefore.params.v = Math.round(pV0 * 1000) / 1000;
                            pBefore.params.length = Math.round(lenBefore * 1000) / 1000;
                            pBefore.params.v_nm = mmToNm(pBefore.params.v);
                            pBefore.params.length_nm = mmToNm(pBefore.params.length);
                            nextPieces.push(pBefore);
                        }
                        const lenAfter = pV1 - inV1;
                        if (lenAfter > 0.1) {
                            const pAfter = JSON.parse(JSON.stringify(piece));
                            pAfter.id = `${piece.id}_split1`;
                            pAfter.params.v = Math.round(inV1 * 1000) / 1000;
                            pAfter.params.length = Math.round(lenAfter * 1000) / 1000;
                            pAfter.params.v_nm = mmToNm(pAfter.params.v);
                            pAfter.params.length_nm = mmToNm(pAfter.params.length);
                            nextPieces.push(pAfter);
                        }
                    } else {
                        const widthBefore = inU0 - pU0;
                        if (widthBefore > 0.1) {
                            const pBefore = JSON.parse(JSON.stringify(piece));
                            pBefore.params.u = Math.round(pU0 * 1000) / 1000;
                            pBefore.params.width = Math.round(widthBefore * 1000) / 1000;
                            pBefore.params.u_nm = mmToNm(pBefore.params.u);
                            pBefore.params.width_nm = mmToNm(pBefore.params.width);
                            nextPieces.push(pBefore);
                        }
                        const widthAfter = pU1 - inU1;
                        if (widthAfter > 0.1) {
                            const pAfter = JSON.parse(JSON.stringify(piece));
                            pAfter.id = `${piece.id}_split1`;
                            pAfter.params.u = Math.round(inU1 * 1000) / 1000;
                            pAfter.params.width = Math.round(widthAfter * 1000) / 1000;
                            pAfter.params.u_nm = mmToNm(pAfter.params.u);
                            pAfter.params.width_nm = mmToNm(pAfter.params.width);
                            nextPieces.push(pAfter);
                        }
                    }
                }
                currentPieces = nextPieces;
            }

            result.push(...currentPieces);
            continue;
        }

        result.push(feat);
    }

    return result;
}
