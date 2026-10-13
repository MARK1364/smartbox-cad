/**
 * SmartPanel Web — Application entry (composition root)
 *
 * Orkiestruje moduły sceny 3D, sterowania gizmo, menu kontekstowego oraz poleceń aplikacji.
 * Nie należy do A1_core — to warstwa składania produktu.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { bootstrapScene, BootstrapContext } from './scene-bootstrap.js';
import { AppCommands } from './cad-app-commands.js';
import { GizmoController } from '../../A1_core/gizmo-controller.js';
import { ContextMenuHandler } from '../../A1_core/context-menu-handler.js';
import { startModules } from '../bootstrap/modules.js';
import { InteractionManager } from '../../A1_core/interaction/interaction-manager.js';
import { StateMachine } from '../../A1_core/interaction/state-machine.js';
import { SelectionTool } from '../../A1_core/interaction/states/selection-tool.js';
import { DrawLineTool } from '../../A1_core/interaction/states/draw-line-tool.js';
import { ExtrudeTool } from '../../A1_core/interaction/states/extrude-tool.js';
import { syncSelectionHighlights } from '../../A1_core/selection-highlight.js';
import { handleConstraintPickEvent } from '../../S2_solver/constraint-picker.js';
import { isConnectorPickActive } from '../../C2_connectors/connector-picker.js';
import { shouldPromoteSubgeometryToEntity } from '../../A1_core/selection-mode.js';
import { DrawingProjectExtractor } from '../../R2_rys/drawing-project-extractor.js';
import { openCncFromCad, openReportFromCad, openNestingFromCad, openSmartPartsStudioFromCad } from '../module-data/open-modules.js';
import { registerModuleOpenHandler } from '../../A1_core/module-open-port.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';
import { getAllPanels } from './document-queries.js';
import { createRebuildGeometry } from './geometry-rebuild.js';
import { registerTreeActionHandlers } from './tree-action-handlers.js';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';
declare const BABYLON: any;

let ctx: BootstrapContext;
let gizmoCtrl: GizmoController;
let contextMenuHandler: ContextMenuHandler;

const rebuildGeometry = createRebuildGeometry({
    getContext: () => ctx,
    getGizmoController: () => gizmoCtrl,
});

// ─── Main Startup ───
async function main() {
    ctx = await bootstrapScene();
    (window as any).__rebuildGeometry = rebuildGeometry;

    const commands = new AppCommands(ctx);
    commands.register();

    registerModuleOpenHandler({
        openCnc: openCncFromCad,
        openReport: openReportFromCad,
        openNesting: openNestingFromCad,
        openSmartPartsStudio: openSmartPartsStudioFromCad,
    });

    // ─── Inicjalizacja nowej maszyny stanów (FSM) ───
    const stateMachine = new StateMachine(ctx);
    stateMachine.registerState('SELECTION_TOOL', new SelectionTool(ctx, stateMachine));
    stateMachine.registerState('SelectionTool', new SelectionTool(ctx, stateMachine));
    stateMachine.registerState('DRAW_LINE_TOOL', new DrawLineTool(ctx, stateMachine));
    stateMachine.registerState('EXTRUDE_TOOL', new ExtrudeTool(ctx, stateMachine));
    // ─── Start modułów CAD (PMI, Solver, CNC, Rozszerzenia, A2, A3, A4) ───
    await startModules(ctx, stateMachine);

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
        () => ContextManager.instance.appAPI?.undo?.(),
        () => ContextManager.instance.appAPI?.redo?.(),
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
                const refPicker = ContextManager.instance.activeReferencePicker;
                const panelModel = data.panelModel || data.mesh?.metadata?.panelModel || null;
                if (panelModel && data.face) {
                    const payload = {
                        partKey: (panelModel as any).key || panelModel.name || panelModel.id,
                        face: data.face,
                        panelModel,
                        nodeId: panelModel.id,
                        panelId: panelModel.id,
                        worldNormal: data.worldNormal || null,
                        uv: data.uv || null,
                    };
                    // Bloki UI → onSelect; FloatingWindow (legacy) → onPick
                    if (typeof refPicker.onSelect === 'function') {
                        try {
                            refPicker.onSelect(payload);
                        } catch (err: any) {
                            ctx.ui.setStatus(`⛔ Odniesienie: ${err?.message || err}`, true);
                        }
                    } else if (typeof refPicker.onPick === 'function') {
                        refPicker.onPick(panelModel.id, data.face, {
                            centerWorld: data.worldPoint || null,
                            panelModel,
                        });
                    }
                }
                return;
            }
            ctx.ui.showSelectedFace(data.face, data.faceData, data.smartId, 'face');
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
            ctx.ui.showSelectedFace('Krawędź', null, data.smartId, 'edge');
            if (gizmoCtrl) gizmoCtrl.updateFaceGizmo();
        } else if (type === 'select-vertex') {
            ctx.ui.showSelectedFace(`Narożnik ${data.cornerIndex}`, null, data.smartId, 'corner');
        } else if (type === 'select-feature') {
            ctx.ui.showSelectedFace('Cecha geometryczna', null, data.smartId, 'feature');
            const featureId = data.featureId || data.mesh?.metadata?.featureId || null;
            let panelModel = data.panelModel || data.mesh?.metadata?.panelModel || null;
            if (!panelModel && featureId) {
                panelModel = getAllPanels(ctx.document).find(
                    (p: any) => p.features?.some((f: any) => f.id === featureId)
                ) || null;
            }
            // Hierarchia wymaga panelu jako activeEntity (także na zakładce Korpus / object)
            if (panelModel) {
                ctx.document.setActiveEntity(panelModel);
            }
            if (featureId) {
                ctx.propertiesManager.inspectFeature(
                    featureId,
                    ctx.document,
                    ctx.panelViews,
                    () => getAllPanels(ctx.document),
                    ctx.facePicker,
                    (msg: string) => ctx.ui.setStatus(msg),
                    true
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
        // Tylko odświeżenie siatek — rowki asocjacyjne przelicza już SyncBackGroovesCommand
        // w MacroCommand gizmo-controllera. Gizmo panelu zarządzanego rusza korpusem
        // (getTransformableTarget), więc kontener jest tu jedynym sensownym wejściem.
        if (activeEntity?.type !== 'container') return;

        const containerNode = ctx.document.findNode(activeEntity.id);
        if (!containerNode) return;

        for (const childNode of containerNode.children) {
            const child = childNode.domainData as any;
            if (child && (child.type === 'panel' || child.type === 'part')) {
                ctx.panelViews.get(child.id)?.rebuildGeometry();
            }
        }
    });

    // ─── Rejestracja akcji z drzewa obiektów ───
    registerTreeActionHandlers(ctx, rebuildGeometry);

    let rebuildRafId: any = null;
    const debouncedRebuild = () => {
        if (typeof requestAnimationFrame !== 'undefined') {
            if (rebuildRafId != null) return;
            rebuildRafId = requestAnimationFrame(() => {
                rebuildRafId = null;
                rebuildGeometry('Projekt zaktualizowany');
            });
        } else {
            rebuildGeometry('Projekt zaktualizowany');
        }
    };
    document.addEventListener('bloki-project-changed', debouncedRebuild);
    window.addEventListener('bloki-project-changed', debouncedRebuild);

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
        const { consumeCadRestoreFlag, readProjectSnapshot } = await import('../module-data/session.js');
        // Restore sesji ≠ krok Undo. Historia edycji = CommandHistory (pusta po starcie/load).
        ContextManager.instance.commandHistory?.clear();
        if (consumeCadRestoreFlag()) {
            const snapshot = readProjectSnapshot();
            if (snapshot) {
                try {
                    ctx.document.load(snapshot);
                    ContextManager.instance.commandHistory?.clear();
                    rebuildGeometry(tx(srcTekst, 'cadapp.project_restored_back', TX_NS));
                    console.log('SmartPanel Web — restored project after module return');
                } catch (restoreErr) {
                    console.error('Restore failed, empty scene:', restoreErr);
                    rebuildGeometry('Gotowy — pusta scena. Dodaj SmartPanel lub Korpus.');
                }
            } else {
                rebuildGeometry('Gotowy — pusta scena. Dodaj SmartPanel lub Korpus.');
            }
        } else {
            rebuildGeometry('Gotowy — pusta scena. Dodaj SmartPanel lub Korpus.');
        }

        ctx.viewport.setRenderMode('edges');

        console.log('SmartPanel Web — application successfully modularized');
    } catch (e) {
        ctx.ui.setStatus(tx(srcTekst, 'cadapp.start_error', TX_NS));
        console.error(e);
    }
}



main().catch(err => console.error('Bootstrap error:', err));
