import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PMISyncController, PMI_DOCUMENT_SECTION } from '../pmi-sync.js';
import { PMIStore } from '../pmi-data.js';
import { v3 } from '../dimension-solver.js';
import { ContextManager } from '../../A1_core/context-manager.js';

describe('PMISyncController', () => {
    let store: PMIStore;
    let mockScene: any;
    let mockRenderer: any;
    let mockDoc: any;
    let renderCallback: (() => void) | null = null;

    beforeEach(() => {
        store = PMIStore.instance;
        store.clearAll();
        store.clearAllMeasurements();
        ContextManager.instance.panelViews = null as any;
        ContextManager.instance.containerViews = null as any;

        renderCallback = null;
        mockScene = {
            meshes: [
                {
                    metadata: { panelModel: { id: 'panel_alive' } },
                    getChildMeshes: () => [],
                    getWorldMatrix: () => ({
                        _m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1],
                    }),
                },
            ],
            onBeforeRenderObservable: {
                add: (cb: () => void) => {
                    renderCallback = cb;
                    return { cb };
                },
                remove: vi.fn((obs: any) => {
                    if (renderCallback === obs?.cb) renderCallback = null;
                }),
            },
        };

        mockRenderer = {
            renderAll: vi.fn(),
            dispose: vi.fn(),
        };

        mockDoc = {
            registerExtension: vi.fn(() => vi.fn()),
            onDocumentChanged: vi.fn(() => vi.fn()),
            emitChange: vi.fn(),
        };
    });

    afterEach(() => {
        store.clearAll();
        store.clearAllMeasurements();
        vi.restoreAllMocks();
    });

    it('attach rejestruje rozszerzenie pmi w dokumencie i subskrypcje', () => {
        const controller = new PMISyncController(mockScene, mockRenderer, store);
        controller.attach(mockDoc);

        expect(mockDoc.registerExtension).toHaveBeenCalledWith(
            PMI_DOCUMENT_SECTION,
            expect.objectContaining({
                serialize: expect.any(Function),
                load: expect.any(Function),
            }),
        );
        expect(mockDoc.onDocumentChanged).toHaveBeenCalled();
        expect(renderCallback).not.toBeNull();

        // Ponowny attach nie duplikuje subskrypcji
        controller.attach(mockDoc);
        expect(mockDoc.registerExtension).toHaveBeenCalledTimes(1);

        controller.dispose();
        expect(mockScene.onBeforeRenderObservable.remove).toHaveBeenCalled();
    });

    it('usuwa osierocone adnotacje (pruneOrphanedAnnotations) gdy węzeł nie istnieje na scenie', () => {
        // Dodaj poprawną adnotację dla istniejącego panel_alive
        const annAlive = store.addAnnotation({
            axisSpace: 'ALIGNED',
            measureAxisKey: 'AUTO',
            offset: v3(0, 30, 0),
            offsetSpace: 'WORLD',
            anchor1: {
                nodeId: 'panel_alive',
                smartIdPath: '',
                kind: 'VERTEX',
                subKey: '0',
                subIndex: 0,
                pointLocal: v3(0, 0, 0),
                pointWorldFallback: v3(0, 0, 0),
            },
            anchor2: {
                nodeId: 'panel_alive',
                smartIdPath: '',
                kind: 'VERTEX',
                subKey: '1',
                subIndex: 1,
                pointLocal: v3(100, 0, 0),
                pointWorldFallback: v3(100, 0, 0),
            },
        });

        // Dodaj osieroconą adnotację dla nieistniejącego panel_deleted
        const annOrphan = store.addAnnotation({
            axisSpace: 'ALIGNED',
            measureAxisKey: 'AUTO',
            offset: v3(0, 30, 0),
            offsetSpace: 'WORLD',
            anchor1: {
                nodeId: 'panel_deleted',
                smartIdPath: '',
                kind: 'VERTEX',
                subKey: '0',
                subIndex: 0,
                pointLocal: v3(0, 0, 0),
                pointWorldFallback: v3(0, 0, 0),
            },
            anchor2: {
                nodeId: 'panel_alive',
                smartIdPath: '',
                kind: 'VERTEX',
                subKey: '1',
                subIndex: 1,
                pointLocal: v3(100, 0, 0),
                pointWorldFallback: v3(100, 0, 0),
            },
        });

        // Dodaj osierocony pomiar (ephemeral)
        const measOrphan = store.addMeasurement({
            anchor1: {
                nodeId: 'panel_deleted',
                smartIdPath: '',
                kind: 'FREE',
                subKey: '',
                subIndex: -1,
                pointLocal: v3(0, 0, 0),
                pointWorldFallback: v3(0, 0, 0),
            },
            anchor2: {
                nodeId: 'panel_alive',
                smartIdPath: '',
                kind: 'FREE',
                subKey: '',
                subIndex: -1,
                pointLocal: v3(50, 0, 0),
                pointWorldFallback: v3(50, 0, 0),
            },
        });

        expect(store.annotations).toHaveLength(2);
        expect(store.measurements).toHaveLength(1);

        const controller = new PMISyncController(mockScene, mockRenderer, store);
        controller.attach(mockDoc);

        // Wywołanie odświeżenia / przycięcia
        controller.refreshNow();

        // annOrphan i measOrphan powinny zostać usunięte
        expect(store.annotations).toHaveLength(1);
        expect(store.annotations[0].id).toBe(annAlive.id);
        expect(store.measurements).toHaveLength(0);
        expect(mockRenderer.renderAll).toHaveBeenCalledWith(store);

        controller.dispose();
    });

    it('flaga isPruning zabezpiecza przed reentrancy — zagnieżdżone wywołanie wraca natychmiast', () => {
        const controller = new PMISyncController(mockScene, mockRenderer, store);
        controller.attach(mockDoc);

        // Dodajemy DWIE osierocone adnotacje
        store.addAnnotation({
            axisSpace: 'ALIGNED',
            measureAxisKey: 'AUTO',
            offset: v3(0, 30, 0),
            offsetSpace: 'WORLD',
            anchor1: {
                nodeId: 'panel_deleted_1',
                smartIdPath: '',
                kind: 'VERTEX',
                subKey: '0',
                subIndex: 0,
                pointLocal: v3(0, 0, 0),
                pointWorldFallback: v3(0, 0, 0),
            },
            anchor2: {
                nodeId: 'panel_alive',
                smartIdPath: '',
                kind: 'VERTEX',
                subKey: '1',
                subIndex: 1,
                pointLocal: v3(100, 0, 0),
                pointWorldFallback: v3(100, 0, 0),
            },
        });

        store.addAnnotation({
            axisSpace: 'ALIGNED',
            measureAxisKey: 'AUTO',
            offset: v3(0, 30, 0),
            offsetSpace: 'WORLD',
            anchor1: {
                nodeId: 'panel_deleted_2',
                smartIdPath: '',
                kind: 'VERTEX',
                subKey: '0',
                subIndex: 0,
                pointLocal: v3(0, 0, 0),
                pointWorldFallback: v3(0, 0, 0),
            },
            anchor2: {
                nodeId: 'panel_alive',
                smartIdPath: '',
                kind: 'VERTEX',
                subKey: '1',
                subIndex: 1,
                pointLocal: v3(100, 0, 0),
                pointWorldFallback: v3(100, 0, 0),
            },
        });

        expect(store.annotations).toHaveLength(2);

        let nestedCallsAttempted = 0;
        let removeCount = 0;

        const originalRemoveAnnotation = store.removeAnnotation.bind(store);
        vi.spyOn(store, 'removeAnnotation').mockImplementation((id: string) => {
            removeCount++;
            // Reentrancy trigger: w trakcie usuwania pierwszej adnotacji odpalamy refreshNow()
            if (nestedCallsAttempted === 0) {
                nestedCallsAttempted++;
                controller.refreshNow();
            }
            return originalRemoveAnnotation(id);
        });

        controller.refreshNow();

        // Zagnieżdżona próba wywołania miała miejsce:
        expect(nestedCallsAttempted).toBe(1);
        // Z flagą isPruning zagnieżdżone wywołanie wraca natychmiast (early return),
        // więc każde usunięcie adnotacji wykonuje się dokładnie raz:
        expect(removeCount).toBe(2);
        expect(store.annotations).toHaveLength(0);

        controller.dispose();
    });

    it('wykrywa zmianę transformacji w klatce renderu i przerysowuje scenę', () => {
        const controller = new PMISyncController(mockScene, mockRenderer, store);
        controller.attach(mockDoc);

        store.addAnnotation({
            axisSpace: 'ALIGNED',
            measureAxisKey: 'AUTO',
            offset: v3(0, 30, 0),
            offsetSpace: 'WORLD',
            anchor1: {
                nodeId: 'panel_alive',
                smartIdPath: '',
                kind: 'VERTEX',
                subKey: '0',
                subIndex: 0,
                pointLocal: v3(0, 0, 0),
                pointWorldFallback: v3(0, 0, 0),
            },
            anchor2: {
                nodeId: 'panel_alive',
                smartIdPath: '',
                kind: 'VERTEX',
                subKey: '1',
                subIndex: 1,
                pointLocal: v3(100, 0, 0),
                pointWorldFallback: v3(100, 0, 0),
            },
        });

        mockRenderer.renderAll.mockClear();

        // Pierwszy tick — zapamiętuje sygnaturę
        renderCallback!();
        expect(mockRenderer.renderAll).toHaveBeenCalledTimes(1);
        mockRenderer.renderAll.mockClear();

        // Drugi tick bez zmian macierzy — nie powinien przerysowywać
        renderCallback!();
        expect(mockRenderer.renderAll).not.toHaveBeenCalled();

        // Zmiana macierzy świata (przesunięcie X z 10 na 999)
        mockScene.meshes[0].getWorldMatrix = () => ({
            _m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 999, 20, 30, 1],
        });

        // Trzeci tick — wykrywa ruch i przerysowuje
        renderCallback!();
        expect(mockRenderer.renderAll).toHaveBeenCalledTimes(1);

        controller.dispose();
    });
});
