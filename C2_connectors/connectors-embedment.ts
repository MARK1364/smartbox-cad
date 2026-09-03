/**
 * Role formatek na styku (boczek = FACE, wieniec = EDGE) oraz długości
 * dwóch odcinków złącza (część w płaszczyźnie + część w czole).
 *
 * LCS CAD: X = szerokość, Y = grubość, Z = wysokość.
 * Kontakt na osi grubości (Y) = ściana INNER/OUTER boczka.
 * Kontakt na X/Z = czoło wieńca.
 */

import rulesJson from './connectors_3_rules.json';
import type { Vec3Tuple } from './connectors-types.js';

export interface DrillSpec {
    diameter_mm: number;
    depth_mm: number;
    face_type: 'EDGE' | 'FACE';
    offset_from_edge_mm?: number;
    /** Konfirmat w boczku: otwór na wylot (głębokość = grubość płyty). */
    through?: boolean;
}

export interface ConnectorDrillSpecs {
    panel_a?: DrillSpec;
    panel_b?: DrillSpec;
    panel_b_bolt?: DrillSpec;
    panel_b_housing?: DrillSpec;
}

export const DRILLING_SPECS: Record<string, ConnectorDrillSpecs> =
    (rulesJson as any).drilling_specs ?? {};

export interface SymbolSegments {
    /** Odcinek w boczku (płaszczyzna INNER/OUTER) [mm]. */
    faceMm: number;
    /** Odcinek w wieńcu (czoło) [mm]. */
    edgeMm: number;
    /** Średnica walca w boczku [mm] — konfirmat 7, kołek 8. */
    faceDiaMm: number;
    /** Średnica walca w wieńcu [mm] — konfirmat 5, kołek 8. */
    edgeDiaMm: number;
    /** Otwór w boczku na wylot. */
    throughFace: boolean;
}

/**
 * Normalna styku w LCS CAD rodzica. |Y| największe → rodzic to boczek (FACE).
 * FACE_Z w skanerze potwierdza ścianę grubości (INNER/OUTER) — nie nadpisuje normalnej.
 */
export function isParentFaceContact(normalLocalMm: Vec3Tuple, faceName?: string): boolean {
    if (faceName) {
        const n = faceName.toUpperCase();
        if (n.includes('FACE_Z') || n === 'INNER' || n === 'OUTER') return true;
    }
    const ax = Math.abs(normalLocalMm[0]);
    const ay = Math.abs(normalLocalMm[1]);
    const az = Math.abs(normalLocalMm[2]);
    return ay >= ax && ay >= az;
}

function faceSpecOf(type: string): DrillSpec | undefined {
    const specs = DRILLING_SPECS[type];
    if (!specs) return undefined;
    return specs.panel_b ?? specs.panel_b_bolt;
}

function edgeSpecOf(type: string): DrillSpec | undefined {
    return DRILLING_SPECS[type]?.panel_a;
}

export function isThroughFaceType(type: string): boolean {
    const spec = faceSpecOf(type);
    if (spec?.through) return true;
    return type.startsWith('konfirmat');
}

/**
 * Długości dwóch symboli.
 * Kołek: 12 mm w boczku (nieprzelot) + 23 mm w wieńcu (= 35 mm okucia).
 * Konfirmat: grubość boczka (przelot) + reszta okucia w wieńcu (= 50 mm).
 */
export function getSymbolSegments(
    type: string,
    hardwareLengthMm: number,
    faceThicknessMm: number,
): SymbolSegments {
    const faceSpec = faceSpecOf(type);
    const edgeSpec = edgeSpecOf(type);
    const throughFace = isThroughFaceType(type);
    const thick = faceThicknessMm > 0 ? faceThicknessMm : 18;
    const hw = hardwareLengthMm > 0 ? hardwareLengthMm : 35;

    let faceMm = faceSpec?.depth_mm ?? 12;
    if (throughFace) {
        faceMm = thick;
    } else {
        faceMm = Math.min(faceMm, Math.max(1, thick - 1));
    }

    let edgeMm = edgeSpec?.depth_mm ?? 23;
    if (throughFace) {
        edgeMm = Math.max(1, hw - faceMm);
    }

    const faceDiaMm = faceSpec?.diameter_mm ?? 8;
    const edgeDiaMm = edgeSpec?.diameter_mm ?? faceDiaMm;

    return { faceMm, edgeMm, faceDiaMm, edgeDiaMm, throughFace };
}

/** Głębokość otworu FACE na formatce (CNC) — konfirmat = grubość płyty. */
export function getFaceHoleDepthMm(type: string, faceThicknessMm: number): number {
    const spec = faceSpecOf(type);
    const thick = faceThicknessMm > 0 ? faceThicknessMm : 18;
    if (isThroughFaceType(type)) return thick;
    const depth = spec?.depth_mm ?? 12;
    return Math.min(depth, Math.max(1, thick - 1));
}

export function getEdgeHoleDepthMm(type: string): number {
    return edgeSpecOf(type)?.depth_mm ?? 23;
}

export function getFaceHoleDiameterMm(type: string): number {
    return faceSpecOf(type)?.diameter_mm ?? 8;
}

export function getEdgeHoleDiameterMm(type: string): number {
    return edgeSpecOf(type)?.diameter_mm ?? 8;
}

export type ConnectorEndFace = 'FACE_X_PLUS' | 'FACE_X_MINUS' | 'FACE_Y_PLUS' | 'FACE_Y_MINUS';

/** Najbliższe czoło (nigdy FACE_Z / grubość). */
export function nearestEndFace(
    localX: number,
    localY: number,
    widthMm: number,
    heightMm: number,
): ConnectorEndFace {
    const hw = widthMm / 2;
    const hh = heightMm / 2;
    const dXp = Math.abs(hw - localX);
    const dXm = Math.abs(-hw - localX);
    const dYp = Math.abs(hh - localY);
    const dYm = Math.abs(-hh - localY);
    const m = Math.min(dXp, dXm, dYp, dYm);
    if (m === dXp) return 'FACE_X_PLUS';
    if (m === dXm) return 'FACE_X_MINUS';
    if (m === dYp) return 'FACE_Y_PLUS';
    return 'FACE_Y_MINUS';
}

/**
 * Czoło wieńca z normalnej w LCS panelu (Z = grubość).
 * Jeśli normalna leży w grubości (Z) — bierz najbliższy koniec płyty.
 */
export function resolveEdgeFace(
    normalPanel: Vec3Tuple,
    localX: number,
    localY: number,
    widthMm: number,
    heightMm: number,
): ConnectorEndFace {
    const [nx, ny] = normalPanel;
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(normalPanel[2]);
    if (ax >= ay && ax > az) return nx >= 0 ? 'FACE_X_PLUS' : 'FACE_X_MINUS';
    if (ay >= ax && ay > az) return ny >= 0 ? 'FACE_Y_PLUS' : 'FACE_Y_MINUS';
    return nearestEndFace(localX, localY, widthMm, heightMm);
}
