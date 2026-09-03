/**
 * Przepis katalogu + gabaryt ściany płyty → cecha groove (mesh/CAM już to umie).
 * UV w mm. Ramka: odsadzenia l/r/t/b. Rewizja: dwie linie do krawędzi formatki.
 */

import { nmToMm } from '../A1_core/cad-math/units.js';
import { normalizeFaceName, type FaceName, type PanelModel } from '../A4_smartpanel/panel-model.js';
import { pocketFromEdgeDims } from './operacje-placement.js';
import type {
    OperationEdgeRefs,
    OperationFeature,
    OperationInsetsMm,
    OperationRecipe,
} from './operacje-types.js';
import { LIBRARY_SOURCE } from './operacje-types.js';

const MIN_POCKET_MM = 1;

export interface OperationApplyOverrides {
    frameMm?: number;
    frameWMm?: number;
    frameHMm?: number;
    depthMm?: number;
    widthMm?: number;
    heightMm?: number;
    uMm?: number;
    vMm?: number;
    uEdge?: FaceName;
    vEdge?: FaceName;
}

export function uniformInsetsMm(frameMm: number): OperationInsetsMm {
    const w = Math.max(0, frameMm);
    return { l: w, r: w, t: w, b: w };
}

function defaultEdge(recipe: OperationRecipe): OperationEdgeRefs {
    return recipe.edge || {
        uEdge: 'FACE_X_MINUS',
        vEdge: 'FACE_Y_MINUS',
        uMm: 100,
        vMm: 80,
    };
}

export function recipeWithOverrides(
    recipe: OperationRecipe,
    overrides?: OperationApplyOverrides | null,
    existing?: { params?: any } | null,
): OperationRecipe {
    const p = existing?.params || {};
    const next: OperationRecipe = {
        ...recipe,
        insets: { ...recipe.insets },
        sizeMm: { ...(recipe.sizeMm || { w: 120, h: 80 }) },
        edge: { ...defaultEdge(recipe) },
    };

    const isEdge = recipe.placement === 'edge_dims' || p.placement === 'edge_dims';
    next.placement = isEdge ? 'edge_dims' : 'frame';

    if (next.placement === 'edge_dims') {
        next.sizeMm = {
            w: overrides?.widthMm ?? (Number.isFinite(p.width) ? Number(p.width) : next.sizeMm.w),
            h: overrides?.heightMm ?? (Number.isFinite(p.length) ? Number(p.length) : next.sizeMm.h),
        };
        next.edge = {
            uEdge: overrides?.uEdge || p.u_edge || next.edge.uEdge,
            vEdge: overrides?.vEdge || p.v_edge || next.edge.vEdge,
            uMm: overrides?.uMm ?? (Number.isFinite(p.u_ref) ? Number(p.u_ref) : next.edge.uMm),
            vMm: overrides?.vMm ?? (Number.isFinite(p.v_ref) ? Number(p.v_ref) : next.edge.vMm),
        };
    } else {
        const existingInsets = p.insets;
        if (existingInsets) next.insets = { ...next.insets, ...existingInsets };
        if (overrides?.frameMm != null && Number.isFinite(overrides.frameMm)) {
            next.insets = uniformInsetsMm(overrides.frameMm);
        } else {
            if (overrides?.frameWMm != null && Number.isFinite(overrides.frameWMm)) {
                const w = Math.max(0, overrides.frameWMm);
                next.insets.l = w;
                next.insets.r = w;
            }
            if (overrides?.frameHMm != null && Number.isFinite(overrides.frameHMm)) {
                const h = Math.max(0, overrides.frameHMm);
                next.insets.t = h;
                next.insets.b = h;
            }
        }
    }

    if (overrides?.depthMm != null && Number.isFinite(overrides.depthMm) && !recipe.through) {
        next.depthMm = Math.max(MIN_POCKET_MM, overrides.depthMm);
        next.kind = 'POCKET';
        next.through = false;
    } else if (p.through) {
        next.through = true;
        next.kind = 'THROUGH';
    } else if (Number.isFinite(p.depth) && !recipe.through) {
        next.depthMm = Number(p.depth);
    }
    return next;
}

export function faceHintToFace(hint: OperationRecipe['face_hint']): FaceName {
    if (hint === 'INNER') return 'FACE_Z_PLUS';
    return 'FACE_Z_MINUS';
}

export function operationFeatureId(libraryId: string, face: FaceName): string {
    return `op_${libraryId}_${face}`;
}

function faceSizeMm(panel: PanelModel, face: FaceName): { width: number; height: number } {
    const data = panel.getFace(face);
    return { width: data.width, height: data.height };
}

export function pocketRectMm(
    faceW: number,
    faceH: number,
    insets: OperationInsetsMm,
): { u: number; v: number; width: number; length: number } | null {
    const u = Math.max(0, insets.l);
    const v = Math.max(0, insets.b);
    const width = faceW - insets.l - insets.r;
    const length = faceH - insets.b - insets.t;
    if (width < MIN_POCKET_MM || length < MIN_POCKET_MM) return null;
    return { u, v, width, length };
}

export function resolveOperationDepthMm(recipe: OperationRecipe, panel: PanelModel): number {
    const thickness = nmToMm(panel.thickness);
    if (recipe.through || recipe.kind === 'THROUGH') {
        return Math.max(MIN_POCKET_MM, thickness);
    }
    const depth = recipe.depthMm > 0 ? recipe.depthMm : 6;
    return Math.min(depth, Math.max(MIN_POCKET_MM, thickness));
}

export function buildOperationFeature(
    recipe: OperationRecipe,
    panel: PanelModel,
    face: string,
    existingId?: string,
): OperationFeature | null {
    const faceName = normalizeFaceName(face);
    const { width: faceW, height: faceH } = faceSizeMm(panel, faceName);
    const rect = recipe.placement === 'edge_dims'
        ? pocketFromEdgeDims(faceName, faceW, faceH, {
            uEdge: recipe.edge.uEdge,
            vEdge: recipe.edge.vEdge,
            uMm: recipe.edge.uMm,
            vMm: recipe.edge.vMm,
            widthMm: recipe.sizeMm.w,
            heightMm: recipe.sizeMm.h,
        })
        : pocketRectMm(faceW, faceH, recipe.insets);
    if (!rect) return null;
    const depth = resolveOperationDepthMm(recipe, panel);

    return {
        id: existingId || operationFeatureId(recipe.id, faceName),
        type: 'groove',
        name: recipe.name,
        face: faceName,
        params: {
            u: rect.u,
            v: rect.v,
            width: rect.width,
            length: rect.length,
            depth,
            library_id: recipe.id,
            source: LIBRARY_SOURCE,
            insets: { ...recipe.insets },
            fill: recipe.fill,
            kind: recipe.kind,
            through: recipe.through || recipe.kind === 'THROUGH',
            placement: recipe.placement,
            u_edge: recipe.edge.uEdge,
            v_edge: recipe.edge.vEdge,
            u_ref: recipe.edge.uMm,
            v_ref: recipe.edge.vMm,
        },
    };
}
