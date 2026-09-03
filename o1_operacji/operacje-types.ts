/**
 * O1 — operacje na formatce (wcięcia, ramka, szkło).
 * Katalog JSON: metry. Silnik / feature na płycie: mm (jak otwory zawiasów).
 */

import type { FaceName } from '../A4_smartpanel/panel-model.js';

export type OperationKind = 'POCKET' | 'THROUGH';
export type OperationFill = 'none' | 'glass';
export type OperationFaceHint = 'OUTER' | 'INNER' | 'ANY';

export interface OperationInsetsM {
    l?: number;
    r?: number;
    t?: number;
    b?: number;
}

export interface OperationInsetsMm {
    l: number;
    r: number;
    t: number;
    b: number;
}

export type OperationPlacement = 'frame' | 'edge_dims';

export interface OperationEdgeRefs {
    uEdge: FaceName;
    vEdge: FaceName;
    uMm: number;
    vMm: number;
}

export interface OperationEdgePlacement extends OperationEdgeRefs {
    widthMm: number;
    heightMm: number;
}

export interface OperationRecipe {
    id: string;
    name: string;
    kind: OperationKind;
    face_hint: OperationFaceHint;
    placement: OperationPlacement;
    insets: OperationInsetsMm;
    sizeMm: { w: number; h: number };
    edge: OperationEdgeRefs;
    depthMm: number;
    through: boolean;
    fill: OperationFill;
}

export interface OperationFeatureParams {
    u: number;
    v: number;
    width: number;
    length: number;
    depth: number;
    library_id: string;
    source: 'library';
    insets: OperationInsetsMm;
    fill: OperationFill;
    kind: OperationKind;
    through: boolean;
    placement?: OperationPlacement;
    u_edge?: FaceName;
    v_edge?: FaceName;
    u_ref?: number;
    v_ref?: number;
}

export interface OperationFeature {
    id: string;
    type: 'groove';
    name: string;
    face: FaceName;
    params: OperationFeatureParams;
}

export const OPERACJE_DRAG_MIME = 'application/cad-operation';
export const OPERACJE_PANEL_TITLE = 'Operacje';
export const LIBRARY_SOURCE = 'library' as const;
/** Klik w drzewie: otwórz zakładkę Operacje i edytuj instancję na danej płycie. */
export const CAD_EDIT_LIBRARY_OPERATION = 'cad-edit-library-operation';
