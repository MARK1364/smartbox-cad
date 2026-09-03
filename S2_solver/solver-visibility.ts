/**
 * Widoczność sceny dla zakładki Wiązania — odpowiednik
 * `solver_show_only_smartframe` w Blenderze.
 *
 * W Babylon.js siatki z isVisible=false / setEnabled(false) nie biorą udziału
 * w picku — dlatego panele muszą pozostać włączone i pickowalne na zakładce więzów.
 */

import { ContextManager } from '../A1_core/context-manager.js';

const CTX_KEY = 'solverShowOnlySmartFrame';

export function getSolverShowOnlySmartFrame(): boolean {
    return Boolean((ContextManager.instance as any)[CTX_KEY]);
}

export function setSolverShowOnlySmartFrame(value: boolean): void {
    (ContextManager.instance as any)[CTX_KEY] = value;
    notifySolverVisibilityChanged();
}

export function isSolverTabActive(): boolean {
    return ContextManager.instance.activeTab === 'tab-s2-solver';
}

export function isSolverPickActive(): boolean {
    return Boolean(ContextManager.instance.activeConstraintPicker);
}

/** Czy aktywna izolacja „tylko korpus” (SmartFrame widoczny, panele przyciemnione). */
export function isSolverSmartFrameIsolationActive(): boolean {
    return isSolverTabActive() && getSolverShowOnlySmartFrame();
}

export function notifySolverVisibilityChanged(): void {
    window.dispatchEvent(new CustomEvent('solver-visibility-changed', { detail: { value: getSolverShowOnlySmartFrame() } }));
    const fn = (ContextManager.instance as any).notifyIsolationUpdate;
    if (typeof fn === 'function') {
        fn();
    }
}

/**
 * Ustawienia widoczności/picku siatek panelu na zakładce więzów.
 * Panele nigdy nie są całkowicie wyłączane — tylko przyciemniane w trybie SmartFrame.
 */
export function resolveSolverPanelVisibility(options: {
    modelVisible: boolean;
    smartFrameOnly: boolean;
    faceVis: number;
    wireframe: boolean;
}): { enabled: boolean; visibility: number; isVisible: boolean; isPickable: boolean } {
    const { modelVisible, smartFrameOnly, faceVis, wireframe } = options;

    if (!isSolverTabActive()) {
        const enabled = modelVisible;
        return {
            enabled,
            visibility: enabled ? faceVis : 0,
            isVisible: enabled && !wireframe,
            isPickable: enabled && !wireframe,
        };
    }

    const enabled = modelVisible;
    const pickBoost = isSolverPickActive();
    const dimmed = smartFrameOnly && !pickBoost;
    const visibility = enabled ? (dimmed ? Math.min(faceVis, 0.4) : faceVis) : 0;

    return {
        enabled,
        visibility,
        isVisible: enabled && !wireframe,
        isPickable: enabled && !wireframe,
    };
}

export function applyMeshSolverVisibility(mesh: any, state: ReturnType<typeof resolveSolverPanelVisibility>): void {
    if (!mesh) {
        return;
    }
    try {
        mesh.setEnabled(state.enabled);
        mesh.visibility = state.visibility;
        mesh.isVisible = state.isVisible;
        mesh.isPickable = state.isPickable;
    } catch {
        /* mesh mógł zostać usunięty */
    }
}

/** Wszystkie siatki podgeometrii panelu (ściany, krawędzie, naroża, cechy). */
export function applyPanelViewSolverVisibility(
    view: any,
    model: any,
    options: { smartFrameOnly: boolean; faceVis: number; wireframe: boolean },
): void {
    const modelVisible = model?.visible !== false;
    const state = resolveSolverPanelVisibility({
        modelVisible,
        smartFrameOnly: options.smartFrameOnly,
        faceVis: options.faceVis,
        wireframe: options.wireframe,
    });

    if (view.root) {
        try {
            view.root.setEnabled(state.enabled);
        } catch {}
    }

    if (view.faceMeshes) {
        for (const mesh of Object.values(view.faceMeshes) as any[]) {
            applyMeshSolverVisibility(mesh, state);
        }
    }
    if (view._edgeMeshes && Array.isArray(view._edgeMeshes)) {
        for (const mesh of view._edgeMeshes) {
            const edgeState = { ...state, isVisible: state.enabled, isPickable: state.enabled };
            applyMeshSolverVisibility(mesh, edgeState);
        }
    }
    if (view._vertexSpheres && Array.isArray(view._vertexSpheres)) {
        for (const mesh of view._vertexSpheres) {
            const vertexState = {
                ...state,
                visibility: state.enabled ? 1 : 0,
                isVisible: state.enabled,
                isPickable: state.enabled,
            };
            applyMeshSolverVisibility(mesh, vertexState);
        }
    }
    if (view._featureMarkers && Array.isArray(view._featureMarkers)) {
        for (const mesh of view._featureMarkers) {
            applyMeshSolverVisibility(mesh, state);
        }
    }
}
