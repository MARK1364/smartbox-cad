/**
 * Wspólna konfiguracja trybu selekcji per zakładka modułu.
 *
 * Dwa poziomy:
 *   - object       — klik aktywuje całą formatkę / korpus (activeEntity)
 *   - subgeometry  — klik wybiera krawędź / naroże / płaszczyznę
 *
 * Złącza (tab-c2-connectors) mają dwa tryby sterowane przyciskiem
 * „Wstaw połączenia”:
 *   - wyłączony → object (zaznaczanie formatek, wejście do CNC)
 *   - włączony  → subgeometry (pick płaszczyzn styku, bez promocji formatki)
 */

export type SelectionMode = 'object' | 'subgeometry';

export const MODULE_SELECTION_MODES: Record<string, SelectionMode> = {
    'tab-c1-cnc': 'subgeometry',
    'tab-n1-nesting': 'object',
    'tab-a4-smartpanel': 'subgeometry',
    'tab-a2-smartbox': 'subgeometry',
    'tab-a3-smartframe': 'object',
    'tab-a7-material': 'object',
    'tab-a8-pmi': 'subgeometry',
    'tab-s2-solver': 'subgeometry',
    'tab-c2-connectors': 'object',
    'tab-o1-operacji': 'subgeometry',
    'tab-e1-export': 'object',
};

/** Przycisk „Wstaw połączenia” w zakładce Złącza — pick płaszczyzn. */
let _connectorsPlanePickActive = false;

export function setConnectorsPlanePickActive(active: boolean): void {
    _connectorsPlanePickActive = active;
}

export function isConnectorsPlanePickActive(): boolean {
    return _connectorsPlanePickActive;
}

export function getSelectionModeForTab(tabId: string | null | undefined): SelectionMode {
    if (!tabId) {
        return 'subgeometry';
    }
    if (tabId === 'tab-c2-connectors' && _connectorsPlanePickActive) {
        return 'subgeometry';
    }
    return MODULE_SELECTION_MODES[tabId] ?? 'subgeometry';
}

/** Zakładki, w których klik podgeometrii nie aktywuje całej formatki/korpusu w drzewie. */
export function shouldPromoteSubgeometryToEntity(tabId: string | null | undefined): boolean {
    if (tabId === 'tab-s2-solver') {
        return false;
    }
    if (tabId === 'tab-c2-connectors' && _connectorsPlanePickActive) {
        return false;
    }
    return true;
}

/** Zakładki bez zielonego obrysu całego komponentu (podświetlenie zostaje na wybranej podgeometrii). */
export function shouldSuppressEntitySelectionHighlight(tabId: string | null | undefined): boolean {
    if (tabId === 'tab-s2-solver') {
        return true;
    }
    if (tabId === 'tab-c2-connectors' && _connectorsPlanePickActive) {
        return true;
    }
    return false;
}
