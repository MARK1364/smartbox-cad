/**
 * Port widoków i przebudowy geometrii — Core nie zna bezpośrednio
 * implementacji ContainerView ani PanelView ani modułów A2/A3/A4/S4.
 */

export interface ContainerViewAdapter {
    createView(scene: any, container: any): any;
}

export interface PanelViewAdapter {
    createView(scene: any, panel: any): any;
}

export interface GeometryUpdateHandler {
    updateBeforeRebuild(doc: any, containers: any[]): void;
}

export type ContainerViewMatch = (container: any) => boolean;

interface RegisteredContainerView {
    adapter: ContainerViewAdapter;
    match?: ContainerViewMatch;
}

const containerViewAdapters: RegisteredContainerView[] = [];
let panelViewAdapter: PanelViewAdapter | null = null;
const geometryUpdateHandlers: GeometryUpdateHandler[] = [];

/**
 * Rejestruje adapter widoku kontenera.
 * Bez `match` — domyślny (korpus / Bloki). Z `match` — np. wall_solid (S4).
 */
export function registerContainerViewAdapter(
    adapter: ContainerViewAdapter,
    options?: { match?: ContainerViewMatch },
): void {
    if (options?.match) {
        containerViewAdapters.push({ adapter, match: options.match });
        return;
    }
    const idx = containerViewAdapters.findIndex((e) => !e.match);
    if (idx >= 0) {
        containerViewAdapters[idx] = { adapter };
    } else {
        containerViewAdapters.push({ adapter });
    }
}

export function registerPanelViewAdapter(adapter: PanelViewAdapter): void {
    panelViewAdapter = adapter;
}

export function registerGeometryUpdateHandler(handler: GeometryUpdateHandler): () => void {
    geometryUpdateHandlers.push(handler);
    return () => {
        const idx = geometryUpdateHandlers.indexOf(handler);
        if (idx !== -1) {
            geometryUpdateHandlers.splice(idx, 1);
        }
    };
}

export function resetViewPort(): void {
    containerViewAdapters.length = 0;
    panelViewAdapter = null;
    geometryUpdateHandlers.length = 0;
}

export function getGeometryUpdateHandlersCount(): number {
    return geometryUpdateHandlers.length;
}

export function createContainerView(scene: any, container: any): any {
    for (const entry of containerViewAdapters) {
        if (entry.match?.(container)) {
            return entry.adapter.createView(scene, container);
        }
    }
    const fallback = containerViewAdapters.find((e) => !e.match);
    if (!fallback) {
        throw new Error('[ViewPort] Brak zarejestrowanego ContainerViewAdapter.');
    }
    return fallback.adapter.createView(scene, container);
}

export function createPanelView(scene: any, panel: any): any {
    if (!panelViewAdapter) {
        throw new Error('[ViewPort] Brak zarejestrowanego PanelViewAdapter.');
    }
    return panelViewAdapter.createView(scene, panel);
}

export function notifyBeforeRebuildGeometry(doc: any, containers: any[]): void {
    for (const h of geometryUpdateHandlers) {
        try {
            h.updateBeforeRebuild(doc, containers);
        } catch (e) {
            console.warn('[ViewPort] Błąd w geometry update handler:', e);
        }
    }
}
