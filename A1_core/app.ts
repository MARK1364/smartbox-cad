/**
 * SmartPanel Web — App (Orchestrator Entry Point)
 * 
 * Orkiestruje moduły sceny 3D, sterowania gizmo, menu kontekstowego oraz poleceń aplikacji.
 */

import { ContextManager } from './context-manager.js';
import { bootstrapScene, BootstrapContext } from './scene-bootstrap.js';
import { AppCommands } from './app-commands.js';
import { GizmoController } from './gizmo-controller.js';
import { ContextMenuHandler } from './context-menu-handler.js';
import { initializeSmartFrameEngine, rebuildSmartFrameContainer } from '../A3_smartframe/smartframe-adapter.js';
import { isManualPanel } from '../A4_smartpanel/panel-model.js';
import { SyncBackGroovesCommand } from './commands/sync-back-grooves-command.js';
import { update_smartbox_core } from '../A2_smartbox/smartbox-core.js';
import { ContainerView } from '../A3_smartframe/container-view.js';
import { PanelView } from '../A4_smartpanel/panel-view.js';
import { InteractionManager } from './interaction/interaction-manager.js';
import { StateMachine } from './interaction/state-machine.js';
import { SelectionTool } from './interaction/states/selection-tool.js';
import { DrawLineTool } from './interaction/states/draw-line-tool.js';
import { ExtrudeTool } from './interaction/states/extrude-tool.js';
import { SelectProfileTool } from '../C1_cnc/interaction/select-profile-tool.js';
import { NodeType } from './cad-node/node-type.js';
import { RemoveNodeCommand } from './commands/remove-node-command.js';
import { ClearSmartBoxDrillingsCommand, collectSmartBoxIds } from './commands/clear-smartbox-drillings-command.js';
import { RemoveFeatureCommand } from './commands/feature-commands.js';
import { DimensionTool } from '../A8_pmi/pmi-tool.js';
import { MeasureTool } from '../A8_pmi/pmi-measure-tool.js';
import { syncSelectionHighlights } from './selection-highlight.js';
import { PMIRenderer } from '../A8_pmi/pmi-renderer.js';
import { PMIStore } from '../A8_pmi/pmi-data.js';
import { PMIEditOffsetTool } from '../A8_pmi/pmi-edit-tool.js';
import { PMIViewportListener, PMI_EDIT_STATE } from '../A8_pmi/pmi-viewport-listener.js';
import { PMISyncController } from '../A8_pmi/pmi-sync.js';
import { ConstraintStore } from '../S2_solver/constraint-store.js';
import { SolverController } from '../S2_solver/solver-controller.js';
import { handleConstraintPickEvent } from '../S2_solver/constraint-picker.js';
import { attachConnectorsExtension } from '../C2_connectors/connector-controller.js';
import { attachOperacjeExtension } from '../o1_operacji/operacje-controller.js';
import { isConnectorPickActive } from '../C2_connectors/connector-picker.js';
import { attachViewportExtension } from '../S3_scena/viewport-document-extension.js';
import { attachMaterialsExtension } from '../A7_material/materials-document-extension.js';
import { attachDrawingsExtension } from './drawings-document-extension.js';
import { shouldPromoteSubgeometryToEntity } from './selection-mode.js';
import { DrawingProjectExtractor } from '../E3_export/drawing-project-extractor.js';
import { showCadTreeContextMenu } from '../src/module-data/tree-context-menu.js';
declare const BABYLON: any;

let ctx: BootstrapContext;
let gizmoCtrl: GizmoController;
let contextMenuHandler: ContextMenuHandler;
let sketchModeActive = false;

// ─── Helper functions ───
function getAllContainers(doc: any): any[] {
    if (!doc) return [];
    const document = doc.document || doc;
    const items = typeof document.getContainers === 'function' ? document.getContainers() : [];
    return items.map((item: any) => item.domainData || item).filter(Boolean);
}

function getAllPanels(doc: any): any[] {
    if (!doc) return [];
    const document = doc.document || doc;
    const items = typeof document.getPanels === 'function' ? document.getPanels() : [];
    return items.map((item: any) => item.domainData || item).filter(Boolean);
}

function rebuildGeometry(successMessage = 'Gotowy') {
    if (!ctx) return;
    const { document, viewport, panelViews, containerViews, panelBuilder, ui } = ctx;

    ui.setStatus('Aktualizowanie modelu...', true);
    try {
        const currentContainers = getAllContainers(document);
        
        for (const container of currentContainers) {
            if (container.generatorParams?.type === 'smartbox_shelves') {
                update_smartbox_core(container, document);
            }
        }

        const currentContainerIds = new Set(currentContainers.map(c => c.id));
        for (const [container, view] of containerViews) {
            if (!currentContainerIds.has(container.id)) {
                view.dispose();
                containerViews.delete(container);
            }
        }

        const currentPanels = getAllPanels(document);
        const currentPanelIds = new Set(currentPanels.map(p => p.smartId?.fullPath || p.id));

        for (const [panel, view] of panelViews) {
            const pid = panel.smartId?.fullPath || panel.id;
            if (pid && !currentPanelIds.has(pid)) {
                view.dispose();
                panelViews.delete(panel);
            }
        }

        const globalLcsVisible = ContextManager.instance.lcsVisible !== false;
        for (const panel of currentPanels) {
            if (typeof panel.setLcsVisible === 'function') {
                panel.setLcsVisible(globalLcsVisible);
            }
        }

        for (const container of currentContainers) {
            let view = containerViews.get(container);
            if (!view) {
                view = new ContainerView(viewport.scene, container);
                containerViews.set(container, view);
            }
            view.update();
            if (view.rootNode) {
                view.rootNode.setEnabled(container.visible !== false);
            }
        }

        for (const panel of currentPanels) {
            let view = panelViews.get(panel);
            if (!view) {
                view = new PanelView(viewport.scene, panel);
                panelViews.set(panel, view);
            }

            const cadNode = ctx.document.findNode(panel.id);
            const parentNode = cadNode?.parent;
            if (parentNode && parentNode.domainData) {
                const parentContainer = parentNode.domainData;
                const containerView = containerViews.get(parentContainer);

                // Warstwa wizualna — mesh Babylona podpinany pod rootNode kontenera (kompatybilność z ContainerView)
                if (containerView && containerView.rootNode && view.root) {
                    if (view.root.parent !== containerView.rootNode) {
                        view.root.setParent ? view.root.setParent(containerView.rootNode) : (view.root.parent = containerView.rootNode);
                    }
                }
                if (typeof view._updateTransform === 'function') view._updateTransform();
            } else {
                if (view.root && view.root.parent) view.root.parent = null;
            }

            const meshData = panelBuilder.build(panel);
            view.updateMesh(meshData);
            view.lastWidth = panel.width;
            view.lastHeight = panel.height;
            view.lastThickness = panel.thickness;

            if (typeof (view as any).renderFeatures === 'function') (view as any).renderFeatures();
            if (view._updateTransform) view._updateTransform();
            
            if (view.root) {
                view.root.setEnabled(panel.visible !== false);
            }
        }

        syncSelectionHighlights(ctx);

        ui.refreshFeatures();
        ui.setStatus(successMessage, true);
        if (gizmoCtrl) gizmoCtrl.updateFaceGizmo();

        // Siatki formatek zostały odtworzone — wymiary muszą ponownie rozwiązać kotwice.
        (ContextManager.instance as any).pmiSync?.refreshNow?.();

        // Egzekwowanie izolacji formatki w trybie CNC po przeliczeniu geometrii
        if ((ContextManager.instance as any).activeTab === 'tab-c1-cnc') {
            const activeEntity = ctx.document?.activeEntity;
            const lockedPanel = (activeEntity && activeEntity.type !== 'container') ? activeEntity : null;
            if (lockedPanel) {
                const isTarget = (m: any) => {
                    if (!m) return false;
                    if (m === lockedPanel) return true;
                    if (m.id && lockedPanel.id && m.id === lockedPanel.id) return true;
                    if ((m as any).smartId?.fullPath && (lockedPanel as any).smartId?.fullPath && (m as any).smartId.fullPath === (lockedPanel as any).smartId.fullPath) return true;
                    if ((m as any).smartId?.uid && (lockedPanel as any).smartId?.uid && (m as any).smartId.uid === (lockedPanel as any).smartId.uid) return true;
                    return false;
                };
                containerViews.forEach((cView) => {
                    if (cView.mesh) {
                        try {
                            cView.mesh.visibility = 0.0;
                            cView.mesh.isVisible = false;
                        } catch {}
                    }
                });
                panelViews.forEach((view, model) => {
                    const shouldShow = isTarget(model);
                    if (view.root) {
                        try { view.root.setEnabled(shouldShow); } catch {}
                    }
                });
            }
        }
        if (typeof (ContextManager.instance as any).notifyIsolationUpdate === 'function') {
            try { (ContextManager.instance as any).notifyIsolationUpdate(); } catch {}
        }
    } catch (e: any) {
        console.error(e);
        ui.setStatus('Błąd podczas przeliczania geometrii!', true);
    }
}

// ─── Main Startup ───
async function main() {
    ctx = await bootstrapScene();
    (window as any).__rebuildGeometry = rebuildGeometry;

    const commands = new AppCommands(ctx);
    commands.register();

    // ─── Inicjalizacja nowej maszyny stanów (FSM) ───
    const stateMachine = new StateMachine(ctx);
    stateMachine.registerState('SELECTION_TOOL', new SelectionTool(ctx, stateMachine));
    stateMachine.registerState('SelectionTool', new SelectionTool(ctx, stateMachine));
    stateMachine.registerState('DRAW_LINE_TOOL', new DrawLineTool(ctx, stateMachine));
    stateMachine.registerState('EXTRUDE_TOOL', new ExtrudeTool(ctx, stateMachine));
    stateMachine.registerState('SELECT_PROFILE_TOOL', new SelectProfileTool(ctx, stateMachine));

    // ─── PMI: wymiarowanie CAD ───
    const pmiRenderer = new PMIRenderer(ctx.viewport.scene);
    ContextManager.instance.pmiRenderer = pmiRenderer;

    // Kontroler synchronizacji rejestruje sekcję `pmi` w dokumencie (zapis/odczyt
    // projektu oraz snapshoty historii) i odświeża wymiary po ruchu formatek.
    const pmiSync = new PMISyncController(ctx.viewport.scene, pmiRenderer, PMIStore.instance);
    pmiSync.attach(ctx.document);
    (ContextManager.instance as any).pmiSync = pmiSync;

    const solverController = new SolverController(ConstraintStore.instance);
    solverController.attach(ctx.document, ContextManager.instance.commandHistory!);
    (ContextManager.instance as any).solverController = solverController;

    attachViewportExtension(ctx.document, ctx.viewport);
    attachMaterialsExtension(ctx.document);
    attachDrawingsExtension(ctx.document);
    attachConnectorsExtension(ctx.document);
    attachOperacjeExtension(ctx.document);

    const dimTool = new DimensionTool(ctx, stateMachine, pmiRenderer);
    stateMachine.registerState('DIMENSION_TOOL', dimTool);
    stateMachine.registerState('DimensionTool', dimTool);
    const measureTool = new MeasureTool(ctx, stateMachine, pmiRenderer);
    stateMachine.registerState('MEASURE_TOOL', measureTool);
    stateMachine.registerState('MeasureTool', measureTool);
    stateMachine.registerState(PMI_EDIT_STATE, new PMIEditOffsetTool(ctx, stateMachine, pmiRenderer, PMIStore.instance));

    const pmiViewportListener = new PMIViewportListener(ctx.viewport.scene, stateMachine, PMIStore.instance);
    pmiViewportListener.attach();

    stateMachine.changeState('SELECTION_TOOL');

    ContextManager.instance.stateMachine = stateMachine;
    if (ContextManager.instance.appAPI) {
        ContextManager.instance.appAPI.stateMachine = stateMachine;
    }

    const interactionManager = new InteractionManager(ctx.viewport.scene, (intent) => {
        if ((intent.type as any) === 'ZOOM_FIT') {
            const api = ContextManager.instance.appAPI;
            if (api && api.zoomFit) {
                api.zoomFit();
            }
            return;
        }
        stateMachine.handleIntent(intent);
    });
    // ───────────────────────────────────────────────

    gizmoCtrl = new GizmoController();
    gizmoCtrl.init();
    ContextManager.instance.gizmoController = gizmoCtrl;

    contextMenuHandler = new ContextMenuHandler();
    contextMenuHandler.init(
        ctx.canvas!,
        ctx.contextMenu,
        ctx.propertiesManager,
        () => getAllPanels(ctx.document),
        () => toggleSketchMode(),
        () => ContextManager.instance.appAPI?.undo?.(),
        () => ContextManager.instance.appAPI?.redo?.(),
        ctx.history
    );

    // ─── Rejestracja zdarzeń selekcji (FacePicker -> UI / Properties) ───
    ctx.facePicker.onPick((type: string, data: any) => {
        if (handleConstraintPickEvent(type, data)) {
            return;
        }
        if (isConnectorPickActive()) {
            return;
        }
        if (type === 'select') {
            if (ContextManager.instance.activeReferencePicker) {
                if (ContextManager.instance.activeReferencePicker.onSelect && data.panelModel) {
                    ContextManager.instance.activeReferencePicker.onSelect({
                        partKey: (data.panelModel as any).key || data.panelModel.name || data.panelModel.id,
                        face: data.face,
                        panelModel: data.panelModel,
                        nodeId: data.panelModel.id,
                    });
                }
                return;
            }
            ctx.ui.showSelectedFace(data.face, data.faceData, data.smartId);
            if (data.panelModel && shouldPromoteSubgeometryToEntity(ContextManager.instance.activeTab)) {
                ctx.document.setActiveEntity(data.panelModel);
                ctx.propertiesManager.inspectPanel(data.panelModel, ctx.panelViews, false);
            }
            if (gizmoCtrl) gizmoCtrl.updateFaceGizmo();
        } else if (type === 'select-edge') {
            const refPicker = ContextManager.instance.activeReferencePicker;
            if (refPicker?.onSelectEdge) {
                refPicker.onSelectEdge({
                    edgeKey: data.mesh?.metadata?.edgeKey,
                    panelModel: data.panelModel,
                    mesh: data.mesh,
                    smartId: data.smartId,
                });
                return;
            }
            ctx.ui.showSelectedFace('Krawędź', null, data.smartId);
            if (gizmoCtrl) gizmoCtrl.updateFaceGizmo();
        } else if (type === 'select-vertex') {
            ctx.ui.showSelectedFace(`Narożnik ${data.cornerIndex}`, null, data.smartId);
        } else if (type === 'select-feature') {
            ctx.ui.showSelectedFace('Cecha geometryczna', null, data.smartId);
            if (data.featureId) {
                ctx.propertiesManager.inspectFeature(
                    data.featureId,
                    ctx.document,
                    ctx.panelViews,
                    () => getAllPanels(ctx.document),
                    ctx.facePicker,
                    (msg: string) => ctx.ui.setStatus(msg),
                    false
                );
            }
        } else if (type === 'deselect') {
            ctx.ui.clearSelectedFace();
            if (gizmoCtrl) gizmoCtrl.updateFaceGizmo();
        } else if (type === 'hover') {
            ctx.ui.updateCursorCoords(data.uv);
        }
    });

    // ─── Rejestracja synchronizacji aktywnej encji ───
    ctx.document.onDocumentChanged(() => {
        const active = ctx.document.activeEntity;

        syncSelectionHighlights(ctx);

        if (active) {
            if (active.type === 'container') {
                ctx.propertiesManager.inspectContainer(active, false);
            } else {
                ctx.propertiesManager.inspectPanel(active, ctx.panelViews, false);
            }
        }
        if (gizmoCtrl) gizmoCtrl.updateFaceGizmo();
        try {
            DrawingProjectExtractor.instance.syncLiveSceneTree();
        } catch {}
    });

    // ─── Rejestracja nasłuchiwania na koniec transformacji (np. z Gizmo) ───
    ctx.document.on('transform-ended', (activeEntity: any) => {
        if (!activeEntity) return;
        
        let container = null;
        if (activeEntity.type === 'container') {
            container = activeEntity;
        } else if (activeEntity.type === 'panel') {
            const node = ctx.document.findNode(activeEntity.id);
            if (node && node.parent && (node.parent.domainData as any)?.type === 'container') {
                container = node.parent.domainData;
            }
        }
        
        if (container) {
            // Przelicz asocjatywne rowki (usunięto execute stąd, teraz robi to gizmo-controller grupując w MacroCommand)
            // Jednak wciąż potrzebujemy wywołać przebudowę siatek, bo transform-ended może nie mieć dostępu do pełnej listy węzłów zmienionych
            // Dla pewności możemy zostawić czysty event albo przebudować cały kontener:
            const containerNode = ctx.document.findNode(container.id);
            if (containerNode) {
                    for (const childNode of containerNode.children) {
                        const child = childNode.domainData as any;
                        if (child && (child.type === 'panel' || child.type === 'part')) {
                            const pv = ctx.panelViews.get(child.id);
                            if (pv) pv.rebuildGeometry();
                        }
                    }
                }
        }
    });

    // ─── Rejestracja akcji z drzewa obiektów ───
    ctx.ui.onTreeAction((action: string, data: any) => {
        if (action === 'select-part') {
            const panel = getAllPanels(ctx.document).find(
                (p: any) => p.id === data.id || p.smartId?.uid === data.uuid || p.smartId?.uid === data.id
            );
            if (panel) {
                ctx.document.setActiveEntity(panel);
                ctx.facePicker.clearSelection();
            }
        } else if (action === 'select-container') {
            const container = getAllContainers(ctx.document).find((c: any) => c.id === data.id);
            if (container) {
                ctx.document.setActiveEntity(container);
                ctx.facePicker.clearSelection();
            }
        } else if (action === 'select-feature') {
            const panels = getAllPanels(ctx.document);
            const parent = panels.find((p: any) => p.features?.some((f: any) => f.id === data.id));
            if (parent) ctx.document.setActiveEntity(parent);
            ctx.propertiesManager.inspectFeature(
                data.id,
                ctx.document,
                ctx.panelViews,
                () => getAllPanels(ctx.document),
                ctx.facePicker,
                (msg: string) => ctx.ui.setStatus(msg),
                true
            );
        } else if (action === 'toggle-part-visibility' || action === 'toggle-container-visibility') {
            const entity = data.panelRef || getAllPanels(ctx.document).find((p: any) => p.id === data.id || p.smartId?.uid === data.uuid) || getAllContainers(ctx.document).find((c: any) => c.id === data.id);
            if (entity) {
                entity.visible = entity.visible === false ? true : false;
                rebuildGeometry();
                ctx.document.emitChange('all');
            }
        } else if (action === 'toggle-visibility') {
            const panels = getAllPanels(ctx.document);
            for (const panel of panels) {
                if (panel.features) {
                    const feature = panel.features.find((f: any) => f.id === data.id);
                    if (feature) {
                        feature.visible = feature.visible === false ? true : false;
                        if (typeof panel.setFeatures === 'function') {
                            panel.setFeatures(panel.features);
                        } else if (typeof panel._emit === 'function') {
                            panel._emit('features', { features: panel.features });
                        }
                        rebuildGeometry();
                        ctx.document.emitChange('all');
                        break;
                    }
                }
            }
        } else if (action === 'toggle-freeze-feature') {
            const panels = getAllPanels(ctx.document);
            for (const panel of panels) {
                if (panel.features) {
                    const feature = panel.features.find((f: any) => f.id === data.id);
                    if (feature) {
                        const newFrozen = !(feature.frozen || feature.params?.frozen);
                        feature.frozen = newFrozen;
                        feature.visible = !newFrozen;
                        if (feature.params) feature.params.frozen = newFrozen;
                        if (typeof panel.setFeatures === 'function') {
                            panel.setFeatures(panel.features);
                        } else if (typeof panel._emit === 'function') {
                            panel._emit('features', { features: panel.features });
                        }
                        rebuildGeometry(newFrozen ? 'Zamrożono cechę geometryczną' : 'Odmrożono cechę geometryczną');
                        ctx.document.emitChange('all');
                        break;
                    }
                }
            }
        } else if (action === 'toggle-freeze-part') {
            const doc = ctx.document;
            const panel = getAllPanels(doc).find((p: any) => p.id === data.id || p.smartId?.uid === data.uuid);
            if (panel) {
                const newFrozen = !panel.frozen;
                panel.frozen = newFrozen;
                panel.visible = !newFrozen;
                rebuildGeometry(newFrozen ? 'Zamrożono formatkę' : 'Odmrożono formatkę');
                ctx.document.emitChange('all');
            }
        } else if (action === 'delete-container' || action === 'delete-part') {
            const doc = ctx.document;
            const cmdHist = ContextManager.instance.commandHistory;
            
            if (action === 'delete-container') {
                const container = getAllContainers(doc).find((c: any) => c.id === data.id);
                if (container) {
                    const cadNodeId = container.id;
                    if (cmdHist && doc && doc.findNode(cadNodeId)) {
                        cmdHist.execute(new RemoveNodeCommand(doc, cadNodeId, 'Usunięto kontener'));
                    } else if (doc) {
                        const node = doc.findNode(cadNodeId);
                        if (node) {
                            for (const smartBoxId of collectSmartBoxIds(node)) {
                                new ClearSmartBoxDrillingsCommand(smartBoxId).execute(doc);
                            }
                        }
                        doc.removeNode(cadNodeId);
                    }
                    rebuildGeometry('Usunięto kontener');
                    ctx.document.emitChange('all');
                }
            } else if (action === 'delete-part') {
                const panel = getAllPanels(doc).find((p: any) => p.id === data.id || p.smartId?.uid === data.uuid);
                const panelNode = panel ? doc.findNode(panel.id) : null;
                const isEngineChild = panelNode?.parent?.nodeType === NodeType.ASSEMBLY && !isManualPanel(panel);
                if (panel && panelNode && !isEngineChild) {
                    if (cmdHist) {
                        cmdHist.execute(new RemoveNodeCommand(doc, panel.id, 'Usunięto panel ręczny'));
                    } else {
                        doc.removeNode(panel.id);
                    }
                    rebuildGeometry('Usunięto panel ręczny');
                    ctx.document.emitChange('all');
                } else {
                    console.warn('[SmartFrame] Pojedyncze formatki wewnątrz zespołu SmartFrame nie mogą być usuwane indywidualnie. Aby usunąć mebel, usuń cały kontener SmartFrame.');
                }
            }
        } else if (action === 'delete-feature') {
            const panels = getAllPanels(ctx.document);
            for (const panel of panels) {
                if (panel.features) {
                    const idx = panel.features.findIndex((f: any) => f.id === data.id);
                    if (idx !== -1) {
                        const featureId = data.id;
                        if (typeof panel.removeFeature === 'function') {
                            panel.removeFeature(featureId);
                        } else {
                            panel.features.splice(idx, 1);
                            if (typeof panel.setFeatures === 'function') {
                                panel.setFeatures(panel.features);
                            }
                        }
                        rebuildGeometry('Usunięto cechę geometryczną');
                        ctx.document.emitChange('all');
                        break;
                    }
                }
            }
        } else if (action === 'rename-part' || action === 'rename-container' || action === 'rename-feature' || action === 'rename-project') {
            if (action === 'rename-project') {
                ctx.document.name = data.name;
                ctx.document.emitChange('all');
            } else if (action === 'rename-part') {
                const panel = getAllPanels(ctx.document).find((p: any) => p.id === data.id || p.smartId?.uid === data.uuid);
                if (panel) { panel.name = data.name; ctx.document.emitChange('all'); }
            } else if (action === 'rename-container') {
                const container = getAllContainers(ctx.document).find((c: any) => c.id === data.id);
                if (container) { container.name = data.name; ctx.document.emitChange('all'); }
            } else if (action === 'rename-feature') {
                for (const panel of getAllPanels(ctx.document)) {
                    const feature = panel.features?.find((f: any) => f.id === data.id);
                    if (feature) { feature.name = data.name; panel._notify('features'); break; }
                }
            }
        } else if (action === 'contextmenu-tree-node') {
            showCadTreeContextMenu(data);
        }
    });

    document.addEventListener('smartbox-project-changed', () => rebuildGeometry('Projekt zaktualizowany'));

    (window as any).toggleInspector = () => {
        if (ctx && ctx.viewport) {
            ctx.viewport.toggleInspector();
        }
    };

    (window as any).debugCADSceneTree = () => {
        if (ContextManager.instance?.sceneSyncAdapter) {
            return ContextManager.instance.sceneSyncAdapter.debugDumpTrees();
        }
        return 'ContextManager niezainicjalizowany.';
    };

    document.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement?.tagName;
        const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable;

        if (!isInputActive && (e.ctrlKey || e.metaKey)) {
            if (e.key === 'z' || e.key === 'Z') {
                e.preventDefault();
                const api = ContextManager.instance.appAPI;
                if (e.shiftKey) {
                    api?.redo?.();
                } else {
                    api?.undo?.();
                }
                return;
            } else if (e.key === 'y' || e.key === 'Y') {
                e.preventDefault();
                ContextManager.instance.appAPI?.redo?.();
                return;
            }
        }

        if ((e.ctrlKey || e.metaKey || e.altKey) && (e.key === 'I' || e.key === 'i')) {
            e.preventDefault();
            if (ctx && ctx.viewport) {
                ctx.viewport.toggleInspector();
            }
        }
    });

    try {
        ctx.ui.setStatus('Inicjalizacja silnika reguł...');
        await initializeSmartFrameEngine();

        ctx.viewport.camera.target = new BABYLON.Vector3(300, 600, 250);
        ctx.viewport.camera.radius = 1500;

        const { consumeCadRestoreFlag, readProjectSnapshot } = await import('../src/module-data/session.js');
        if (consumeCadRestoreFlag()) {
            const snapshot = readProjectSnapshot();
            if (snapshot) {
                try {
                    ctx.document.load(snapshot);
                    ctx.history.pushState(ctx.document.serialize({ snapshot: true }), 'Przywrócono projekt');
                    rebuildGeometry('Przywrócono projekt (powrót z modułu)');
                    console.log('SmartPanel Web — restored project after module return');
                } catch (restoreErr) {
                    console.error('Restore failed, empty scene:', restoreErr);
                    rebuildGeometry('Gotowy — pusta scena. Dodaj SmartPanel lub Korpus.');
                    ctx.history.pushState(ctx.document.serialize({ snapshot: true }), 'Pusta scena');
                }
            } else {
                rebuildGeometry('Gotowy — pusta scena. Dodaj SmartPanel lub Korpus.');
                ctx.history.pushState(ctx.document.serialize({ snapshot: true }), 'Pusta scena');
            }
        } else {
            rebuildGeometry('Gotowy — pusta scena. Dodaj SmartPanel lub Korpus.');
            ctx.history.pushState(ctx.document.serialize({ snapshot: true }), 'Pusta scena');
        }

        ctx.viewport.setRenderMode('edges');

        console.log('SmartPanel Web — application successfully modularized');
    } catch (e) {
        ctx.ui.setStatus('Błąd ładowania OCCT. Zobacz konsolę.');
        console.error(e);
    }
}

function toggleSketchMode() {
    sketchModeActive = !sketchModeActive;
    if (sketchModeActive) {
        ctx.facePicker.selectionMode = 'subgeometry';
        ctx.ui.setStatus('Sketch mode — kliknij ścianę', true);
        if (ctx.facePicker.selectedFace) {
            ctx.sketchPlane.activate(ctx.facePicker.selectedFace, true);
            ctx.ui.showSketchMode(ctx.facePicker.selectedFace);
        }
    } else {
        ctx.facePicker.selectionMode = 'object';
        ctx.sketchPlane.deactivate();
        ctx.ui.hideSketchMode();
        ctx.ui.setStatus('Sketch mode wyłączony');
    }
}

main().catch(err => console.error('Bootstrap error:', err));
