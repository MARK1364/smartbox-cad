/**
 * Instancja operacji na PanelModel.features.
 * Silnik korpusu/SmartBox nie kasuje cech source=library.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { isPanelModel } from '../A1_core/domain-data.js';
import { NativePanelBuilder } from '../A4_smartpanel/native-panel-builder.js';
import { normalizeFaceName, type FaceName, type PanelModel } from '../A4_smartpanel/panel-model.js';
import { getOperation } from './operacje-catalog.js';
import { buildOperationFeature, faceHintToFace, recipeWithOverrides } from './operacje-builder.js';
import type { OperationApplyOverrides } from './operacje-builder.js';
import { LIBRARY_SOURCE } from './operacje-types.js';
import type { OperationFeature, OperationRecipe } from './operacje-types.js';
import {
    edgeKeyToPanelFace,
    isUEdge,
    isVEdge,
    tryNormalizeFace,
} from './operacje-placement.js';

export type { OperationApplyOverrides };

function findPanelView(panel: PanelModel): any | null {
    const views = ContextManager.instance?.panelViews;
    if (!views) return null;
    if (views.has(panel)) return views.get(panel);
    for (const [model, view] of views) {
        if (model === panel || model?.id === panel.id) return view;
    }
    return null;
}

function rebuildPanelMesh(panel: PanelModel): void {
    const view = findPanelView(panel);
    if (view && typeof view.updateMesh === 'function') {
        const builder = new NativePanelBuilder();
        view.updateMesh(builder.build(panel));
        ContextManager.instance.viewport?.applyRenderModeToMeshes?.();
        return;
    }
    const rebuild = (typeof window !== 'undefined') ? (window as any).__rebuildGeometry : null;
    if (typeof rebuild === 'function') rebuild('Zaktualizowano operację');
}

function notifyPanelGeometry(panel?: PanelModel | null): void {
    if (panel) {
        rebuildPanelMesh(panel);
        return;
    }
    const rebuild = (typeof window !== 'undefined') ? (window as any).__rebuildGeometry : null;
    if (typeof rebuild === 'function') {
        rebuild('Zaktualizowano operację');
        return;
    }
    if (typeof window !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
    }
}

function panelFromDocItem(item: any): PanelModel | null {
    const panel = item?.domainData || item;
    if (panel && isPanelModel(panel)) return panel;
    return null;
}

export function collectPanelsWithLibraryOperation(doc: any, libraryId: string): PanelModel[] {
    if (!doc || typeof doc.getPanels !== 'function' || !libraryId) return [];
    const found: PanelModel[] = [];
    for (const item of doc.getPanels()) {
        const panel = panelFromDocItem(item);
        if (!panel?.features?.length) continue;
        if (panel.features.some((f: any) => isLibraryOperation(f) && f.params.library_id === libraryId)) {
            found.push(panel);
        }
    }
    return found;
}

export function isLibraryOperation(f: any): boolean {
    return !!f && f.params?.source === LIBRARY_SOURCE && !!f.params?.library_id;
}

/** Wpust / nut z silnika korpusu (plecy, plan) — nie edytować ręcznie. */
export function isEngineGroove(f: any): boolean {
    if (!f || String(f.type).toLowerCase() !== 'groove') return false;
    return !isLibraryOperation(f);
}

export function featureOperationLabel(f: any): string {
    if (isLibraryOperation(f)) return String(f.name || f.params.library_id || 'Operacja');
    if (String(f?.type).toLowerCase() === 'groove') return String(f.name || 'Wpust');
    if (f?.type === 'fillet') return 'Zaokrąglenie';
    if (String(f?.type).toLowerCase() === 'hole' || f?.type === 'drill') return 'Otwór';
    return String(f?.name || f?.type || 'Operacja');
}

export function featureOperationDetails(f: any): string {
    if (isLibraryOperation(f)) {
        const frame = Math.round(Number(f.params?.insets?.l) || Number(f.params?.u) || 0);
        const depth = Math.round(Number(f.params?.depth) || 0);
        if (f.params?.through) {
            return f.params.placement === 'edge_dims'
                ? `${Math.round(f.params.width)}×${Math.round(f.params.length)} · na wylot`
                : `ramka ${frame} · na wylot`;
        }
        if (f.params.placement === 'edge_dims') {
            return `${Math.round(f.params.width)}×${Math.round(f.params.length)} · ${Math.round(f.params.u_ref || 0)}/${Math.round(f.params.v_ref || 0)}`;
        }
        return `ramka ${frame} · gł. ${depth}`;
    }
    if (String(f?.type).toLowerCase() === 'groove') {
        const w = Math.round(Number(f.params?.width) || 0);
        const d = Math.round(Number(f.params?.depth) || 0);
        return `${w}×${d}`;
    }
    const dia = f?.params?.diameter || f?.dim?.x || 5;
    const dep = f?.params?.depth || f?.dim?.z || 12;
    if (f?.type === 'fillet') return `R${f.params?.radius || 0}`;
    return `⌀${dia}x${dep}`;
}

export function mergeEngineAndLibraryFeatures(existing: any[] | null | undefined, engineFeatures: any[] | null | undefined): any[] {
    const library = (existing || []).filter(isLibraryOperation);
    const engine = (engineFeatures || []).filter((f) => !isLibraryOperation(f));
    return [...engine, ...library];
}

function writeFeatures(panel: PanelModel, features: any[]): void {
    if (typeof panel.setFeatures === 'function') {
        panel.setFeatures(features);
    } else {
        panel.features = features;
    }
}

export function refreshLibraryOperation(panel: PanelModel, feature: any): any {
    if (!isLibraryOperation(feature)) return feature;
    const recipe = getOperation(feature.params.library_id);
    if (!recipe) return feature;
    const live = recipeWithOverrides(recipe, null, feature);
    const rebuilt = buildOperationFeature(live, panel, feature.face, String(feature.id));
    return rebuilt || feature;
}

export function refreshLibraryOperationsOnPanel(panel: PanelModel | null | undefined): boolean {
    if (!panel?.features?.length) return false;
    let changed = false;
    const next = panel.features.map((f: any) => {
        if (!isLibraryOperation(f)) return f;
        const refreshed = refreshLibraryOperation(panel, f);
        if (
            refreshed.params.u !== f.params.u
            || refreshed.params.v !== f.params.v
            || refreshed.params.width !== f.params.width
            || refreshed.params.length !== f.params.length
            || refreshed.params.depth !== f.params.depth
        ) {
            changed = true;
        }
        return refreshed;
    });
    if (changed) writeFeatures(panel, next);
    return changed;
}

export function applyAllLibraryOperations(doc: any): void {
    if (!doc || typeof doc.getPanels !== 'function') return;
    let changed = false;
    for (const item of doc.getPanels()) {
        const panel = (item as any).domainData || item;
        if (refreshLibraryOperationsOnPanel(panel)) changed = true;
    }
    if (changed) {
        doc.emitChange?.('features');
        notifyPanelGeometry();
    }
}

export function resolveOperationFace(
    panel: PanelModel,
    recipe: OperationRecipe,
    explicitFace?: string | null,
): FaceName {
    if (explicitFace) return normalizeFaceName(explicitFace);
    const picker = ContextManager.instance?.facePicker as any;
    const sel = picker?.selectedFace;
    const pickedFace = sel?.metadata?.faceName;
    const pickedPanel = sel?.metadata?.panelModel;
    if (pickedFace && pickedPanel && (pickedPanel.id === panel.id || pickedPanel === panel)) {
        return normalizeFaceName(pickedFace);
    }
    return faceHintToFace(recipe.face_hint);
}

export function applyLibraryOperation(
    panel: PanelModel | null | undefined,
    libraryId: string,
    face?: string | null,
    overrides?: OperationApplyOverrides | null,
): OperationFeature | null {
    if (!panel) return null;
    const recipe = getOperation(libraryId);
    if (!recipe) return null;
    const faceName = resolveOperationFace(panel, recipe, face);
    const existing = (panel.features || []).find((f: any) => (
        isLibraryOperation(f)
        && f.params.library_id === libraryId
        && normalizeFaceName(f.face) === faceName
    ));
    const live = recipeWithOverrides(recipe, overrides, existing);
    const built = buildOperationFeature(live, panel, faceName, existing ? String(existing.id) : undefined);
    if (!built) return null;
    const rest = (panel.features || []).filter((f: any) => (
        !(isLibraryOperation(f) && f.params.library_id === libraryId && normalizeFaceName(f.face) === faceName)
    ));
    writeFeatures(panel, [...rest, built]);
    const doc = ContextManager.instance?.document;
    doc?.emitChange?.('features', [panel.id]);
    notifyPanelGeometry(panel);
    return built;
}

export function updateLibraryOperationsById(
    libraryId: string,
    overrides: OperationApplyOverrides,
): number {
    const doc = ContextManager.instance?.document;
    const panels = collectPanelsWithLibraryOperation(doc, libraryId);
    let count = 0;
    for (const panel of panels) {
        const feat = (panel.features || []).find((f: any) => (
            isLibraryOperation(f) && f.params.library_id === libraryId
        ));
        if (applyLibraryOperation(panel, libraryId, feat?.face, overrides)) count += 1;
    }
    return count;
}

export function updateLibraryOperationParams(
    panel: PanelModel | null | undefined,
    libraryId: string,
    overrides: OperationApplyOverrides,
    face?: string | null,
): OperationFeature | null {
    return applyLibraryOperation(panel, libraryId, face, overrides);
}

export function applyLibraryOperationFromPick(
    pick: any,
    libraryId: string,
    overrides?: OperationApplyOverrides | null,
): OperationFeature | null {
    const md = pick?.pickedMesh?.metadata;
    const panel = md?.panelModel as PanelModel | undefined;
    const face = md?.faceName || null;
    if (!panel) return null;
    return applyLibraryOperation(panel, libraryId, face, overrides);
}

export function bindOperationEdge(
    panel: PanelModel | null | undefined,
    libraryId: string,
    pickedFaceOrKey: string,
    slot?: 'u' | 'v' | 'auto',
    face?: string | null,
): OperationFeature | null {
    if (!panel) return null;
    const recipe = getOperation(libraryId);
    if (!recipe) return null;
    const faceName = resolveOperationFace(panel, recipe, face);
    const existing = (panel.features || []).find((f: any) => (
        isLibraryOperation(f)
        && f.params.library_id === libraryId
        && normalizeFaceName(f.face) === faceName
    ));
    if (!existing || existing.params.placement !== 'edge_dims') return null;

    const fromKey = edgeKeyToPanelFace(pickedFaceOrKey, slot || 'auto');
    const asFaceName = tryNormalizeFace(pickedFaceOrKey);
    const asFace = (isUEdge(asFaceName) || isVEdge(asFaceName)) ? asFaceName : fromKey;
    if (!asFace) return null;

    let axis = slot || 'auto';
    if (axis === 'auto') {
        if (isUEdge(asFace)) axis = 'u';
        else if (isVEdge(asFace)) axis = 'v';
        else return null;
    }

    const overrides: OperationApplyOverrides = {};
    if (axis === 'u' && isUEdge(asFace)) {
        overrides.uEdge = asFace;
        overrides.uMm = Number.isFinite(Number(existing.params.u_ref))
            ? Number(existing.params.u_ref)
            : Number(existing.params.u) || 0;
    } else if (axis === 'v' && isVEdge(asFace)) {
        overrides.vEdge = asFace;
        overrides.vMm = Number.isFinite(Number(existing.params.v_ref))
            ? Number(existing.params.v_ref)
            : Number(existing.params.v) || 0;
    } else {
        return null;
    }
    return applyLibraryOperation(panel, libraryId, faceName, overrides);
}
