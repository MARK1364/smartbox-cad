/**
 * Synchronizacja zielonego podświetlenia aktywnego korpusu / formatki.
 * W trybie PMI podświetlenie jest tymczasowo wyłączane, żeby nie kolidowało
 * z własnym hoverem geometrii w narzędziu wymiarowania.
 */

import { ContextManager } from './context-manager.js';
import type { BootstrapContext } from './scene-bootstrap.js';
import {
    getSelectionModeForTab,
    isConnectorsPlanePickActive,
    shouldSuppressEntitySelectionHighlight,
} from './selection-mode.js';

export function syncSelectionHighlights(ctx: BootstrapContext): void {
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
}

export function setSelectionHighlightSuppressed(suppressed: boolean, ctx: BootstrapContext): void {
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
        } as BootstrapContext);
    }
}
