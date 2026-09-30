import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { normalizeFaceName, FaceName } from '../panel-model.js';

/** Układ lokalny ściany płyty (u,v w mm) → LCS wycentrowany w (0,0,0). */
export function computeFaceData(rawFaceName: string, w: number, h: number, t: number) {
    const faceName = normalizeFaceName(rawFaceName);
    const cx = -w / 2;
    const cy = -h / 2;
    const cz = -t / 2;
    switch (faceName) {
        case 'FACE_Z_PLUS':  return { origin: [cx, cy, cz + t], uAxis: [1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, 1], width: w, height: h };
        case 'FACE_Z_MINUS': return { origin: [cx + w, cy, cz], uAxis: [-1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, -1], width: w, height: h };
        case 'FACE_X_MINUS': return { origin: [cx, cy, cz], uAxis: [0, 0, 1], vAxis: [0, 1, 0], normal: [-1, 0, 0], width: t, height: h };
        case 'FACE_X_PLUS':  return { origin: [cx + w, cy, cz + t], uAxis: [0, 0, -1], vAxis: [0, 1, 0], normal: [1, 0, 0], width: t, height: h };
        case 'FACE_Y_PLUS':  return { origin: [cx, cy + h, cz + t], uAxis: [1, 0, 0], vAxis: [0, 0, -1], normal: [0, 1, 0], width: w, height: t };
        case 'FACE_Y_MINUS': return { origin: [cx, cy, cz], uAxis: [1, 0, 0], vAxis: [0, 0, 1], normal: [0, -1, 0], width: w, height: t };
        default: throw new Error(`Unknown face: ${faceName}`);
    }
}

export function localTo3D(faceData: ReturnType<typeof computeFaceData>, u: number, v: number, depthOffset: number = 0): number[] {
    return [
        faceData.origin[0] + faceData.uAxis[0] * u + faceData.vAxis[0] * v - faceData.normal[0] * depthOffset,
        faceData.origin[1] + faceData.uAxis[1] * u + faceData.vAxis[1] * v - faceData.normal[1] * depthOffset,
        faceData.origin[2] + faceData.uAxis[2] * u + faceData.vAxis[2] * v - faceData.normal[2] * depthOffset
    ];
}

/**
 * Rzutuje lokalny punkt 3D formatki (w mm) na płaszczyznę danej ściany (u,v w mm).
 * Jest to dokładna operacja odwrotna do localTo3D (dla depthOffset = 0).
 */
export function local3DToFaceUV(
    faceData: ReturnType<typeof computeFaceData>,
    localPtMm: [number, number, number] | Vec3
): { u: number; v: number } {
    const px = Array.isArray(localPtMm) ? localPtMm[0] : localPtMm.x;
    const py = Array.isArray(localPtMm) ? localPtMm[1] : localPtMm.y;
    const pz = Array.isArray(localPtMm) ? localPtMm[2] : localPtMm.z;

    const dx = px - faceData.origin[0];
    const dy = py - faceData.origin[1];
    const dz = pz - faceData.origin[2];

    const u = dx * faceData.uAxis[0] + dy * faceData.uAxis[1] + dz * faceData.uAxis[2];
    const v = dx * faceData.vAxis[0] + dy * faceData.vAxis[1] + dz * faceData.vAxis[2];

    return { u, v };
}

/**
 * Rzutuje punkt ze współrzędnych świata/mebla 3D (w mm) na ścianę formatki (CADNode),
 * wyznaczając dokładne współrzędne (u, v w mm) z uwzględnieniem orientacji panelu.
 */
export function point3DToFaceUV(
    panelNode: any,
    faceName: string,
    worldPtMm: [number, number, number] | Vec3
): { u: number; v: number } | null {
    if (!panelNode?.domainData) return null;
    const pw = nmToMm(panelNode.domainData.width || panelNode.domainData.length || 0);
    const ph = nmToMm(panelNode.domainData.height || panelNode.domainData.depth || 0);
    const pt = nmToMm(panelNode.domainData.thickness || 0);
    if (pw <= 0 || ph <= 0) return null;

    const fd = computeFaceData(faceName, pw, ph, pt);
    const wx = Array.isArray(worldPtMm) ? worldPtMm[0] : worldPtMm.x;
    const wy = Array.isArray(worldPtMm) ? worldPtMm[1] : worldPtMm.y;
    const wz = Array.isArray(worldPtMm) ? worldPtMm[2] : worldPtMm.z;

    const worldVec = new Vec3(mmToNm(wx), mmToNm(wy), mmToNm(wz));
    const mat = typeof panelNode.getWorldMatrix === 'function' ? panelNode.getWorldMatrix() : panelNode.localMatrix;

    if (!mat) {
        // Fallback: brak macierzy (np. w izolowanych testach)
        const localPtMm: [number, number, number] = [wx, wy, wz];
        return local3DToFaceUV(fd, localPtMm);
    }

    const invMat = mat.invert();
    const localVecNm = invMat.transformPoint(worldVec);
    const localPtMm: [number, number, number] = [nmToMm(localVecNm.x), nmToMm(localVecNm.y), nmToMm(localVecNm.z)];

    return local3DToFaceUV(fd, localPtMm);
}

/**
 * Oblicza współrzędną U na danej ścianie formatki dla zadanej odległości od krawędzi frontowej (czoła) mebla.
 *
 * W standardzie CAD Z-up przód mebla to wektor -Y (0, -1, 0), a tył to +Y (0, 1, 0).
 * Funkcja transformuje lokalny kierunek osi U ściany do układu mebla:
 * - Jeśli oś U biegnie w stronę tyłu (+Y), początek U=0 leży na krawędzi frontowej -> zwraca frontDistMm.
 * - Jeśli oś U biegnie w stronę przodu (-Y), początek U=0 leży na krawędzi tylnej -> zwraca faceWidthMm - frontDistMm.
 */
export function calcFaceUFromFront(
    targetNode: any,
    faceName: string,
    faceWidthMm: number,
    frontDistMm: number,
    fallbackSide: 'left' | 'right' = 'left'
): number {
    const fd = computeFaceData(faceName, faceWidthMm, 100, 18);
    const localUDir = new Vec3(fd.uAxis[0], fd.uAxis[1], fd.uAxis[2]);

    const worldU = targetNode?.localMatrix
        ? targetNode.localMatrix.transformDirection(localUDir)
        : (fallbackSide === 'left' ? new Vec3(0, -1, 0) : new Vec3(0, 1, 0));

    const isOriginAtFront = worldU.y > 0.1;
    return isOriginAtFront ? frontDistMm : Math.max(0, faceWidthMm - frontDistMm);
}

/**
 * Oblicza współrzędną U na danej ścianie formatki dla zadanej odległości od krawędzi tylnej (pleców) mebla.
 * Jest to lustrzany odpowiednik calcFaceUFromFront.
 */
export function calcFaceUFromBack(
    targetNode: any,
    faceName: string,
    faceWidthMm: number,
    backDistMm: number,
    fallbackSide: 'left' | 'right' = 'left'
): number {
    return calcFaceUFromFront(
        targetNode,
        faceName,
        faceWidthMm,
        Math.max(0, faceWidthMm - backDistMm),
        fallbackSide
    );
}


/**
 * Oblicza współrzędną V na danej ścianie formatki dla zadanej odległości od krawędzi frontowej mebla.
 *
 * W standardzie CAD Z-up przód mebla to wektor -Y (0, -1, 0), a tył to +Y (0, 1, 0).
 * Jeśli oś V biegnie w stronę tyłu (+Y), początek V=0 leży na krawędzi frontowej -> zwraca frontDistMm.
 * Jeśli oś V biegnie w stronę przodu (-Y), początek V=0 leży na krawędzi tylnej -> zwraca faceHeightMm - frontDistMm.
 */
export function calcFaceVFromFront(
    targetNode: any,
    faceName: string,
    faceHeightMm: number,
    frontDistMm: number
): number {
    const fd = computeFaceData(faceName, 100, faceHeightMm, 18);
    const localVDir = new Vec3(fd.vAxis[0], fd.vAxis[1], fd.vAxis[2]);

    const worldV = targetNode?.localMatrix
        ? targetNode.localMatrix.transformDirection(localVDir)
        : new Vec3(0, 1, 0);

    const isOriginAtFront = worldV.y > 0.1;
    return isOriginAtFront ? frontDistMm : Math.max(0, faceHeightMm - frontDistMm);
}

export const PANEL_FACE_NAMES: FaceName[] = [
    'FACE_X_PLUS',
    'FACE_X_MINUS',
    'FACE_Y_PLUS',
    'FACE_Y_MINUS',
    'FACE_Z_PLUS',
    'FACE_Z_MINUS'
];


