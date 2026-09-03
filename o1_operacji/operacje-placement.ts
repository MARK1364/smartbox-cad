/**
 * Pozycjonowanie wycięcia jak w Creo: dwie linie od środka prostokąta do krawędzi formatki.
 * Kotwica = ściana/krawędź płyty (L/P/G/D), wymiar = odległość do środka kieszeni.
 */

import { normalizeFaceName, type FaceName } from '../A4_smartpanel/panel-model.js';
import type { OperationEdgePlacement } from './operacje-types.js';

const MIN_POCKET_MM = 1;

export type EdgeU = 'FACE_X_MINUS' | 'FACE_X_PLUS';
export type EdgeV = 'FACE_Y_MINUS' | 'FACE_Y_PLUS';

export function tryNormalizeFace(face: string | null | undefined): FaceName | null {
    if (!face) return null;
    try {
        return normalizeFaceName(face);
    } catch {
        return null;
    }
}

export function isUEdge(face: string | null | undefined): face is EdgeU {
    const n = tryNormalizeFace(face);
    return n === 'FACE_X_MINUS' || n === 'FACE_X_PLUS';
}

export function isVEdge(face: string | null | undefined): face is EdgeV {
    const n = tryNormalizeFace(face);
    return n === 'FACE_Y_MINUS' || n === 'FACE_Y_PLUS';
}

export function parseSideToken(raw: string | undefined, axis: 'u' | 'v'): EdgeU | EdgeV {
    const key = String(raw || '').toLowerCase();
    if (axis === 'u') {
        if (key === 'r' || key === 'right' || key === 'prawo' || key.includes('x_plus')) return 'FACE_X_PLUS';
        return 'FACE_X_MINUS';
    }
    if (key === 't' || key === 'top' || key === 'gora' || key === 'góra' || key.includes('y_plus')) return 'FACE_Y_PLUS';
    return 'FACE_Y_MINUS';
}

export function edgeShortLabel(face: string): string {
    const n = normalizeFaceName(face);
    if (n === 'FACE_X_MINUS') return 'Lewa';
    if (n === 'FACE_X_PLUS') return 'Prawa';
    if (n === 'FACE_Y_PLUS') return 'Góra';
    if (n === 'FACE_Y_MINUS') return 'Dół';
    return face;
}

/** Klucz krawędzi B-rep (dol_lewo, przod_prawo, …) → ściana formatki. */
export function edgeKeyToPanelFace(
    edgeKey: string | null | undefined,
    slot?: 'u' | 'v' | 'auto',
): FaceName | null {
    const k = String(edgeKey || '').toLowerCase();
    if (!k) return null;
    const hasL = k.includes('lewo');
    const hasR = k.includes('prawo');
    const hasB = k.includes('dol');
    const hasT = k.includes('gora') || k.includes('góra');
    const preferV = slot === 'v';
    const preferU = slot === 'u' || slot === 'auto' || !slot;
    if (preferU) {
        if (hasL && !hasR) return 'FACE_X_MINUS';
        if (hasR && !hasL) return 'FACE_X_PLUS';
        if (slot === 'u') return null;
    }
    if (preferV || !preferU) {
        if (hasB && !hasT) return 'FACE_Y_MINUS';
        if (hasT && !hasB) return 'FACE_Y_PLUS';
    }
    if (!preferU) {
        if (hasL && !hasR) return 'FACE_X_MINUS';
        if (hasR && !hasL) return 'FACE_X_PLUS';
    }
    return null;
}

/**
 * UV na ścianie operacji: u rośnie w prawo na FACE_Z_PLUS, w lewo na FACE_Z_MINUS.
 */
export function pocketFromEdgeDims(
    opFace: string,
    faceW: number,
    faceH: number,
    place: OperationEdgePlacement,
): { u: number; v: number; width: number; length: number } | null {
    const width = Math.max(MIN_POCKET_MM, place.widthMm);
    const length = Math.max(MIN_POCKET_MM, place.heightMm);
    if (width > faceW - MIN_POCKET_MM || length > faceH - MIN_POCKET_MM) return null;

    const uEdge = isUEdge(place.uEdge) ? place.uEdge : 'FACE_X_MINUS';
    const vEdge = isVEdge(place.vEdge) ? place.vEdge : 'FACE_Y_MINUS';
    const du = Math.max(0, place.uMm);
    const dv = Math.max(0, place.vMm);
    const zPlus = normalizeFaceName(opFace) === 'FACE_Z_PLUS';
    const halfW = width / 2;
    const halfH = length / 2;

    let uCenter: number;
    if (uEdge === 'FACE_X_MINUS') {
        uCenter = zPlus ? du : faceW - du;
    } else {
        uCenter = zPlus ? faceW - du : du;
    }

    let vCenter: number;
    if (vEdge === 'FACE_Y_MINUS') {
        vCenter = dv;
    } else {
        vCenter = faceH - dv;
    }

    let u = uCenter - halfW;
    let v = vCenter - halfH;
    u = Math.max(0, Math.min(u, faceW - width));
    v = Math.max(0, Math.min(v, faceH - length));
    return { u, v, width, length };
}

export function distanceToUEdge(
    opFace: string,
    uEdge: EdgeU,
    u: number,
    width: number,
    faceW: number,
): number {
    const zPlus = normalizeFaceName(opFace) === 'FACE_Z_PLUS';
    const uCenter = u + width / 2;
    if (uEdge === 'FACE_X_MINUS') {
        return zPlus ? uCenter : faceW - uCenter;
    }
    return zPlus ? faceW - uCenter : uCenter;
}

export function distanceToVEdge(
    vEdge: EdgeV,
    v: number,
    length: number,
    faceH: number,
): number {
    const vCenter = v + length / 2;
    if (vEdge === 'FACE_Y_MINUS') return vCenter;
    return faceH - vCenter;
}

export function rebindUEdge(
    opFace: string,
    rect: { u: number; width: number },
    faceW: number,
    next: EdgeU,
): { uEdge: EdgeU; uMm: number } {
    return { uEdge: next, uMm: Math.max(0, distanceToUEdge(opFace, next, rect.u, rect.width, faceW)) };
}

export function rebindVEdge(
    rect: { v: number; length: number },
    faceH: number,
    next: EdgeV,
): { vEdge: EdgeV; vMm: number } {
    return { vEdge: next, vMm: Math.max(0, distanceToVEdge(next, rect.v, rect.length, faceH)) };
}

export function uvOnUEdge(opFace: string, uEdge: EdgeU, faceW: number): number {
    const zPlus = normalizeFaceName(opFace) === 'FACE_Z_PLUS';
    if (uEdge === 'FACE_X_MINUS') return zPlus ? 0 : faceW;
    return zPlus ? faceW : 0;
}

export function uvOnVEdge(vEdge: EdgeV, faceH: number): number {
    return vEdge === 'FACE_Y_MINUS' ? 0 : faceH;
}

export function dimHandleUv(
    opFace: string,
    slot: 'u' | 'v',
    rect: { u: number; v: number; width: number; length: number },
    uEdge: string,
    vEdge: string,
    faceW: number,
    faceH: number,
): { u: number; v: number } {
    const midU = rect.u + rect.width / 2;
    const midV = rect.v + rect.length / 2;
    if (slot === 'u') {
        const edge = isUEdge(uEdge) ? uEdge : 'FACE_X_MINUS';
        return { u: uvOnUEdge(opFace, edge, faceW), v: midV };
    }
    const edge = isVEdge(vEdge) ? vEdge : 'FACE_Y_MINUS';
    return { u: midU, v: uvOnVEdge(edge, faceH) };
}

/** Przeciągane kółko przysysa się do bliższej krawędzi formatki (połowa ściany). */
export function snapDimHandleToEdge(
    opFace: string,
    slot: 'u' | 'v',
    pointerU: number,
    pointerV: number,
    rect: { u: number; v: number; width: number; length: number },
    faceW: number,
    faceH: number,
): { uEdge?: EdgeU; vEdge?: EdgeV; handleU: number; handleV: number } {
    const midU = rect.u + rect.width / 2;
    const midV = rect.v + rect.length / 2;
    const zPlus = normalizeFaceName(opFace) === 'FACE_Z_PLUS';
    if (slot === 'u') {
        const toLow = pointerU < faceW / 2;
        const uEdge: EdgeU = toLow
            ? (zPlus ? 'FACE_X_MINUS' : 'FACE_X_PLUS')
            : (zPlus ? 'FACE_X_PLUS' : 'FACE_X_MINUS');
        return { uEdge, handleU: toLow ? 0 : faceW, handleV: midV };
    }
    const toLow = pointerV < faceH / 2;
    const vEdge: EdgeV = toLow ? 'FACE_Y_MINUS' : 'FACE_Y_PLUS';
    return { vEdge, handleU: midU, handleV: toLow ? 0 : faceH };
}

const DEFAULT_MAGNET_MM = 28;

/** Podczas przeciągania: jedź z kursorem po osi, dociągaj tylko przy samej krawędzi. */
export function dragHandleAlongAxis(
    slot: 'u' | 'v',
    pointerU: number,
    pointerV: number,
    rect: { u: number; v: number; width: number; length: number },
    faceW: number,
    faceH: number,
    magnetMm = DEFAULT_MAGNET_MM,
): { handleU: number; handleV: number } {
    const midU = rect.u + rect.width / 2;
    const midV = rect.v + rect.length / 2;
    const magnet = Math.max(8, magnetMm);
    if (slot === 'u') {
        let hu = Math.max(0, Math.min(faceW, pointerU));
        if (hu <= magnet) hu = 0;
        else if (hu >= faceW - magnet) hu = faceW;
        return { handleU: hu, handleV: midV };
    }
    let hv = Math.max(0, Math.min(faceH, pointerV));
    if (hv <= magnet) hv = 0;
    else if (hv >= faceH - magnet) hv = faceH;
    return { handleU: midU, handleV: hv };
}

/** Krawędź tylko gdy kółko już siedzi na brzegu — nie w połowie płyty. */
export function magnetEdgeIfAtBound(
    opFace: string,
    slot: 'u' | 'v',
    handleU: number,
    handleV: number,
    faceW: number,
    faceH: number,
): { uEdge?: EdgeU; vEdge?: EdgeV } | null {
    if (slot === 'u') {
        if (handleU > 0 && handleU < faceW) return null;
        const snapped = snapDimHandleToEdge(opFace, slot, handleU, handleV, { u: 0, v: 0, width: 0, length: 0 }, faceW, faceH);
        return { uEdge: snapped.uEdge };
    }
    if (handleV > 0 && handleV < faceH) return null;
    const snapped = snapDimHandleToEdge(opFace, slot, handleU, handleV, { u: 0, v: 0, width: 0, length: 0 }, faceW, faceH);
    return { vEdge: snapped.vEdge };
}

export function isEdgeDimHandleMesh(mesh: any): boolean {
    if (!mesh) return false;
    if (mesh.metadata?.type === 'edge-dim-handle') return true;
    return String(mesh.name || '').startsWith('groove_dim_handle_');
}
