/**
 * PMI Sync Controller — TypeScript
 *
 * Odpowiednik `pmi_handlers.py`. Utrzymuje wymiary w zgodzie z modelem:
 * przy zmianie dokumentu, przebudowie geometrii i przeciąganiu gizmem.
 *
 * Bez tego `renderAll()` byłoby wołane wyłącznie przy zmianie kolekcji wymiarów,
 * więc po przesunięciu formatki wymiar zostawałby w starym miejscu aż do
 * następnej edycji listy.
 *
 * Rejestruje też sekcję `pmi` w serializacji dokumentu, dzięki czemu wymiary
 * trafiają do pliku projektu oraz do snapshotów historii.
 */

import { ProjectDocument } from '../A1_core/project-document';
import { PMIStore } from './pmi-data';
import { PMIRenderer } from './pmi-renderer';
import { findNodeRoot, unregisterDimensionSmartId } from './pmi-id-bridge';

/** Klucz sekcji PMI w `extensions` pliku projektu (`.spp.json`). */
export const PMI_DOCUMENT_SECTION = 'pmi';

/**
 * Sygnatura położenia i orientacji węzła. Zmiana wartości oznacza, że wymiary
 * do niego przypięte trzeba przerysować.
 *
 * Porównujemy same liczby, a nie `Matrix.updateFlag` — ten ostatni rośnie także
 * przy przeliczeniu macierzy do identycznej wartości, co kazałoby nam rysować
 * wymiary w każdej klatce.
 */
function nodeTransformSignature(scene: any, nodeId: string): string {
    const root = findNodeRoot(scene, nodeId);
    if (!root) return 'missing';

    const matrix = root.getWorldMatrix?.();
    const m = matrix?._m || matrix?.m;
    if (!m) return 'no-matrix';

    // Skala i obrót (kolumny bazy) plus translacja; ostatni wiersz jest stały.
    return `${m[0]},${m[1]},${m[2]},${m[4]},${m[5]},${m[6]},${m[8]},${m[9]},${m[10]},${m[12]},${m[13]},${m[14]}`;
}

export class PMISyncController {
    private readonly scene: any;
    private readonly renderer: PMIRenderer;
    private readonly store: PMIStore;

    private disposers: Array<() => void> = [];
    private beforeRenderObserver: any = null;
    private signatures: Map<string, string> = new Map();
    private refreshQueued = false;
    private attached = false;

    constructor(scene: any, renderer: PMIRenderer, store: PMIStore = PMIStore.instance) {
        this.scene = scene;
        this.renderer = renderer;
        this.store = store;
    }

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    public attach(document: ProjectDocument | null): void {
        if (this.attached) return;
        this.attached = true;

        this.disposers.push(this.store.onChange(() => this.requestRefresh()));

        if (document) {
            this.disposers.push(document.registerExtension(PMI_DOCUMENT_SECTION, {
                serialize: () => this.store.toJSON(),
                load: (data) => this.store.fromJSON(data),
            }));
            this.disposers.push(document.onDocumentChanged(() => this.requestRefresh()));
        }

        if (this.scene?.onBeforeRenderObservable) {
            this.beforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => this.tick());
        }
    }

    public dispose(): void {
        for (const dispose of this.disposers) {
            try { dispose(); } catch (err) { console.error('[PMISync] błąd przy odpinaniu:', err); }
        }
        this.disposers = [];

        if (this.beforeRenderObserver && this.scene?.onBeforeRenderObservable) {
            this.scene.onBeforeRenderObservable.remove(this.beforeRenderObserver);
        }
        this.beforeRenderObserver = null;
        this.attached = false;
    }

    // ========================================================================
    // REFRESH
    // ========================================================================

    /** Zleca przerysowanie w najbliższej klatce; wielokrotne wywołania łączą się w jedno. */
    public requestRefresh(): void {
        this.refreshQueued = true;
    }

    public refreshNow(): void {
        this.refreshQueued = false;
        this.pruneOrphanedAnnotations();
        this.renderer.renderAll(this.store);
    }

    /**
     * Wywoływane co klatkę: wykrywa ruch formatek, do których przypięte są wymiary.
     * Porównanie sygnatur jest tanie, bo obejmuje wyłącznie węzły faktycznie użyte
     * przez adnotacje — zwykle jeden lub dwa.
     */
    private tick(): void {
        if (this.hasTransformChanged()) {
            this.refreshQueued = true;
        }
        if (this.refreshQueued) {
            this.refreshNow();
        }
    }

    private hasTransformChanged(): boolean {
        const nodeIds = new Set<string>();
        for (const ann of this.store.annotations) {
            if (!ann.visible) continue;
            if (ann.anchor1.nodeId) nodeIds.add(ann.anchor1.nodeId);
            if (ann.anchor2.nodeId) nodeIds.add(ann.anchor2.nodeId);
        }
        for (const item of this.store.measurements) {
            if (!item.visible) continue;
            if (item.anchor1.nodeId) nodeIds.add(item.anchor1.nodeId);
            if (item.anchor2.nodeId) nodeIds.add(item.anchor2.nodeId);
        }

        let changed = false;

        for (const nodeId of nodeIds) {
            const signature = nodeTransformSignature(this.scene, nodeId);
            if (this.signatures.get(nodeId) !== signature) {
                this.signatures.set(nodeId, signature);
                changed = true;
            }
        }

        // Węzły, które przestały być używane, nie powinny zatrzymywać pamięci.
        for (const nodeId of this.signatures.keys()) {
            if (!nodeIds.has(nodeId)) this.signatures.delete(nodeId);
        }

        return changed;
    }

    /**
     * Gdy komponent znika z dokumentu/sceny, wymiary do niego przypięte także
     * powinny zniknąć (zamiast "wisieć" na fallbacku świata).
     */
    private pruneOrphanedAnnotations(): void {
        const toRemove: string[] = [];

        for (const ann of this.store.annotations) {
            const node1Missing = !!ann.anchor1.nodeId && !findNodeRoot(this.scene, ann.anchor1.nodeId);
            const node2Missing = !!ann.anchor2.nodeId && !findNodeRoot(this.scene, ann.anchor2.nodeId);
            if (node1Missing || node2Missing) {
                toRemove.push(ann.id);
            }
        }

        for (const id of toRemove) {
            const removed = this.store.removeAnnotation(id);
            if (removed?.annotation?.smartIdPath) {
                unregisterDimensionSmartId(removed.annotation.smartIdPath);
            }
        }

        const toRemoveM: string[] = [];
        for (const item of this.store.measurements) {
            const node1Missing = !!item.anchor1.nodeId && !findNodeRoot(this.scene, item.anchor1.nodeId);
            const node2Missing = !!item.anchor2.nodeId && !findNodeRoot(this.scene, item.anchor2.nodeId);
            if (node1Missing || node2Missing) toRemoveM.push(item.id);
        }
        for (const id of toRemoveM) this.store.removeMeasurement(id);
    }
}
