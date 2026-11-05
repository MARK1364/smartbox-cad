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
import { findHiddenEntityAlongRay } from '../../A1_core/quick-pick/quick-pick-detector.js';
import { createRebuildGeometry } from './geometry-rebuild.js';
import { applyAllAssociativeDims } from '../../A4_smartpanel/associative-dim.js';
import { generate10CabinetsRow, expandCabinet, generateWardrobeDemo } from '../../S2_solver/demo-row.js';
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

    // Opcjonalny, lokalny podgląd demonstracyjny bez systemowego okna wyboru pliku.
    // Aktywuje się wyłącznie dla /?demo=kuchnia i pobiera plik z tego samego localhost.
    if (new URLSearchParams(window.location.search).get('demo') === 'kuchnia') {
        try {
            const response = await fetch('/__demo/kuchnia', { cache: 'no-store' });
            if (!response.ok) throw new Error(`Nie udało się pobrać projektu kuchni (${response.status}).`);
            const project = await response.json();
            if (project?.format !== 'smartpanel-project' || !project?.rootNode) {
                throw new Error('Plik demonstracyjny ma nieprawidłowy format projektu.');
            }
            ctx.document.load(project);
            rebuildGeometry('Wczytano demonstracyjną kuchnię');
            ctx.viewport.zoomToFit();
        } catch (error) {
            console.error('[Crevo] Nie udało się wczytać demonstracyjnej kuchni:', error);
            ctx.ui.setStatus('Nie udało się wczytać demonstracyjnej kuchni', true, 'error');
        }
    }

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
                        partKey: (panelModel as any).key || panelModel.id,
                        face: data.face,
                        outlineEdgeKey: data.mesh?.metadata?.outlineEdgeKey ?? data.mesh?.metadata?.edgeKey ?? null,
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
                ctx.propertiesManager.inspectPanel(data.panelModel, ctx.panelViews, true);
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cad-close-floating-operation'));
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
    ctx.document.onDocumentChanged((evt: any) => {
        if (evt?.type === 'dimensions' || evt?.type === 'transform' || evt?.type === 'all') {
            applyAllAssociativeDims(ctx.document);
        }
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

    (window as any).generate10CabinetsRow = generate10CabinetsRow;
    (window as any).expandCabinet = expandCabinet;
    (window as any).generateWardrobeDemo = generateWardrobeDemo;

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

        // SolidWorks Tab (Ukryj pod kursorem) / Shift+Tab (Pokaż ukryty pod kursorem)
        if (!isInputActive && e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();

            const scene = ctx?.viewport?.scene;
            if (!scene) return;

            if (e.shiftKey) {
                // Shift+Tab: Pokaż ukryty komponent pod kursorem
                const hiddenHit = findHiddenEntityAlongRay(
                    scene,
                    scene.pointerX,
                    scene.pointerY,
                    ctx.document,
                    ctx.panelViews,
                    ContextManager.instance.hardwareViews
                );
                if (hiddenHit) {
                    if (hiddenHit.entity.frozen || hiddenHit.entity.params?.frozen) {
                        ctx.ui?.setStatus?.('Element jest zamrożony. Odmroź go, aby pokazać.', true);
                        return;
                    }
                    hiddenHit.entity.visible = true;
                    const node = ctx.document.findNode(hiddenHit.id);
                    let curr = node?.parent;
                    while (curr && curr !== ctx.document.rootNode) {
                        if (curr.domainData && (curr.domainData as any).visible === false) {
                            (curr.domainData as any).visible = true;
                        }
                        curr = curr.parent;
                    }
                    rebuildGeometry('Pokazano element');
                    ctx.document.emitChange('all');
                    ctx.ui?.setStatus?.(`Pokazano: ${hiddenHit.name} (Shift+Tab)`, true);
                }
            } else {
                // Tab: Ukryj widoczny komponent pod kursorem
                const pick = scene.pick(
                    scene.pointerX,
                    scene.pointerY,
                    (m: any) => m.isPickable && m.isVisible && !m.name?.includes('ground') && !m.name?.includes('grid') && !m.name?.includes('blok_bay') && !m.name?.includes('blok_plane')
                );
                if (pick && pick.hit && pick.pickedMesh) {
                    const m = pick.pickedMesh;
                    const meta = m.metadata;
                    const panel = meta?.panelModel
                        || (meta?.panelId ? ctx.document.findNode?.(meta.panelId)?.domainData : null)
                        || (meta?.id ? ctx.document.findNode?.(meta.id)?.domainData : null);

                    if (panel) {
                        panel.visible = false;
                        rebuildGeometry('Ukryto formatkę');
                        ctx.document.emitChange('all');
                        ctx.ui?.setStatus?.(`Ukryto: ${panel.name || 'formatka'} (Shift+Tab aby przywrócić)`, true);
                    } else if (meta?.type === 'hardware' || meta?.hardwareId) {
                        const hwId = meta.id || meta.hardwareId;
                        const hwNode = ctx.document.findNode?.(hwId);
                        if (hwNode?.domainData) {
                            (hwNode.domainData as any).visible = false;
                            rebuildGeometry('Ukryto okucie');
                            ctx.document.emitChange('all');
                            ctx.ui?.setStatus?.(`Ukryto: ${hwNode.name || 'okucie'} (Shift+Tab aby przywrócić)`, true);
                        }
                    } else if (meta?.containerId || meta?.model?.type === 'container') {
                        const cId = meta.containerId || meta.model?.id;
                        const cNode = ctx.document.findNode?.(cId);
                        if (cNode?.domainData) {
                            (cNode.domainData as any).visible = false;
                            rebuildGeometry('Ukryto korpus');
                            ctx.document.emitChange('all');
                            ctx.ui?.setStatus?.(`Ukryto: ${cNode.name || 'korpus'} (Shift+Tab aby przywrócić)`, true);
                        }
                    }
                }
            }
        }
    });

    try {
        const { consumeCadRestoreFlag, readProjectSnapshot } = await import('../module-data/session.js');
        // Restore sesji ≠ krok Undo. Historia edycji = CommandHistory (pusta po starcie/load).
        ContextManager.instance.commandHistory?.clear();
        if (consumeCadRestoreFlag()) {
            let snapshot = readProjectSnapshot();
            if (snapshot) {
                try {
                    const isInstructionMode = typeof window !== 'undefined' && (
                        window.name === 'SmartPanelInstrukcja' ||
                        window.location.pathname.includes('instrukcja') ||
                        (window as any).__CAD_MODE === 'instrukcja' ||
                        sessionStorage.getItem('CAD_MODE') === 'instrukcja'
                    );
                    if (isInstructionMode) {
                        const { readModuleSession } = await import('../module-data/session.js');
                        const session = readModuleSession<any>('instrukcja');
                        if (session?.snapshot) {
                            snapshot = session.snapshot;
                        } else {
                            const targetContainerId = session?.scope?.type === 'CONTAINER' || session?.scope?.type === 'BLOKI'
                                ? session.scope.id
                                : (session?.scope?.id && session.scope.id !== 'ALL' && session.scope.id !== 'project'
                                    ? session.scope.id
                                    : null);

                            if (targetContainerId) {
                                const { isolateContainerInSnapshot } = await import('../../I1_instrukcja/assembly-scene-adapter.js');
                                snapshot = isolateContainerInSnapshot(snapshot, targetContainerId);
                            }
                        }
                    }
                    ctx.document.load(snapshot);
                    ContextManager.instance.commandHistory?.clear();
                    rebuildGeometry(tx(srcTekst, 'cadapp.project_restored_back', TX_NS));
                    if (isInstructionMode) {
                        try {
                            ctx.viewport?.zoomToFit?.();
                        } catch { /* ignore */ }

                        // Nasłuchiwanie na zmianę korpusu z CAD gdy okno instrukcji jest już otwarte
                        try {
                            const { CAD_BRIDGE_CHANNEL, MODULE_SESSION_UPDATED_MSG, readModuleSession } = await import('../module-data/session.js');
                            const channel = new BroadcastChannel(CAD_BRIDGE_CHANNEL);
                            channel.onmessage = async (ev) => {
                                if (ev.data?.type === MODULE_SESSION_UPDATED_MSG && ev.data?.module === 'instrukcja') {
                                    const sess = readModuleSession<any>('instrukcja');
                                    let newSnap = sess?.snapshot;
                                    if (!newSnap && sess?.scope?.id) {
                                        const { readProjectSnapshot } = await import('../module-data/session.js');
                                        const full = readProjectSnapshot();
                                        if (full) {
                                            const { isolateContainerInSnapshot } = await import('../../I1_instrukcja/assembly-scene-adapter.js');
                                            newSnap = isolateContainerInSnapshot(full, sess.scope.id);
                                        }
                                    }
                                    if (newSnap) {
                                        ctx.document.load(newSnap);
                                        ContextManager.instance.commandHistory?.clear();
                                        rebuildGeometry(tx(srcTekst, 'cadapp.project_restored_back', TX_NS));
                                        try {
                                            ctx.viewport?.zoomToFit?.();
                                        } catch { /* ignore */ }
                                    }
                                }
                            };
                        } catch { /* ignore */ }
                    }
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



if (typeof window !== 'undefined' && (window as any).__cadAppStarted) {
    console.log('[cad-app] Application already running — skipping duplicate bootstrap (HMR)');
} else {
    if (typeof window !== 'undefined') {
        (window as any).__cadAppStarted = true;
    }
    main().catch(err => console.error('Bootstrap error:', err));
}
