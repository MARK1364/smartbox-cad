/**
 * Synchronizacja zielonego podświetlenia aktywnego korpusu / formatki.
 * W trybie PMI podświetlenie jest tymczasowo wyłączane, żeby nie kolidowało
 * z własnym hoverem geometrii w narzędziu wymiarowania.
 */

import { ContextManager } from './context-manager.js';
import type { CadModuleContext } from './cad-module-context.js';
import {
    getSelectionModeForTab,
    isConnectorsPlanePickActive,
    shouldSuppressEntitySelectionHighlight,
} from './selection-mode.js';

declare const BABYLON: any;

function setMeshSelectionOutline(mesh: any, isSelected: boolean, color: any, width: number, cascadeToChildren: boolean = true): void {
    if (!mesh || mesh.isDisposed?.()) return;
    if ('renderOutline' in mesh) {
        mesh.renderOutline = isSelected;
        if (isSelected) {
            if (color) mesh.outlineColor = color;
            mesh.outlineWidth = width;
        }
    }
    if (cascadeToChildren) {
        const children = typeof mesh.getChildMeshes === 'function' ? mesh.getChildMeshes() : [];
        for (const child of children) {
            if (!child || child.isDisposed?.()) continue;
            if ('renderOutline' in child) {
                child.renderOutline = isSelected;
                if (isSelected) {
                    if (color) child.outlineColor = color;
                    child.outlineWidth = width;
                }
            }
        }
    }
}

export function syncSelectionHighlights(ctx: CadModuleContext): void {
    const active = ctx.document.activeEntity;
    const suppressed = ContextManager.instance.suppressSelectionHighlight;

    for (const [container, view] of ctx.containerViews) {
        if (typeof view.setSelected === 'function') {
            const isMatch = !suppressed && !!active && (
                active === container ||
                (active.id && container.id && active.id === container.id) ||
                ((active as any).smartId?.uid && (container as any).smartId?.uid && (active as any).smartId.uid === (container as any).smartId.uid)
            );
            view.setSelected(isMatch);
        }
    }
    for (const [panel, view] of ctx.panelViews) {
        if (typeof view.setSelected === 'function') {
            const isMatch = !suppressed && !!active && (
                active === panel ||
                (active.id && panel.id && active.id === panel.id) ||
                ((active as any).smartId?.uid && (panel as any).smartId?.uid && (active as any).smartId.uid === (panel as any).smartId.uid)
            );
            view.setSelected(isMatch);
        }
    }

    const hwViews = (ctx as any).hardwareViews || ContextManager.instance.hardwareViews;
    if (hwViews) {
        const outlineColor = typeof BABYLON !== 'undefined' && BABYLON.Color3
            ? new BABYLON.Color3(0.2, 0.9, 1.0)
            : null;
        const activeSubtype = (active as any)?.subType;
        const activeSubId = (active as any)?.id;

        for (const [hwId, hwMesh] of hwViews) {
            if (!hwMesh || hwMesh.isDisposed?.()) continue;
            const hwNode = hwMesh.metadata?.cadNode;
            const hwModel = hwNode?.domainData ?? hwNode;
            const meshSubType = hwMesh.metadata?.subType;

            let isMatch = false;
            if (!suppressed && !!active) {
                if (activeSubtype) {
                    // Precyzyjne zaznaczenie sub-elementu okucia (boczek, mocowanie, prowadnica)
                    isMatch = (hwMesh.metadata?.id === activeSubId) ||
                              (hwId === activeSubId) ||
                              (meshSubType === activeSubtype && hwMesh.metadata?.parentId === (active as any).parentId);
                } else {
                    // Zaznaczenie całego okucia
                    isMatch = (
                        active === hwModel ||
                        active === hwNode ||
                        (active.id && (active.id === hwId || active.id === hwMesh.metadata?.id)) ||
                        ((active as any).nodeId && (active as any).nodeId === hwId)
                    );
                }
            }
            // Gdy aktywny jest sub-element lub operujemy na sub-siatce, nie kaskadujemy w dół
            const cascade = !activeSubtype && !meshSubType;
            setMeshSelectionOutline(hwMesh, isMatch, outlineColor, 0.04, cascade);
        }
    }
}

export function setSelectionHighlightSuppressed(suppressed: boolean, ctx: CadModuleContext): void {
    ContextManager.instance.suppressSelectionHighlight = suppressed;
    syncSelectionHighlights(ctx);
}

/**
 * Nakłada tryb selekcji, promocję formatki i zielony obrys wg aktywnej zakładki
 * (oraz stanu przycisku „Wstaw połączenia” w Złączach).
 */
export function applyTabSelectionPolicy(tabId?: string | null): void {
    const cm = ContextManager.instance;
    const tab = tabId ?? cm.activeTab;
    const facePicker = cm.facePicker;
    const mode = getSelectionModeForTab(tab);
    const planePick = tab === 'tab-c2-connectors' && isConnectorsPlanePickActive();

    if (facePicker) {
        if (planePick && typeof facePicker.clearSelection === 'function') {
            facePicker.clearSelection();
        }
        facePicker.selectionMode = mode;
        facePicker.enabled = !planePick;
    }
    cm.appAPI?.setSelectionMode?.(mode);

    const suppress = shouldSuppressEntitySelectionHighlight(tab);
    cm.suppressSelectionHighlight = suppress;
    const doc = cm.document;
    if (doc) {
        syncSelectionHighlights({
            document: doc,
            panelViews: cm.panelViews,
            containerViews: cm.containerViews,
        } as CadModuleContext);
    }
}
