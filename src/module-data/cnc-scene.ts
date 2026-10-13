/**
 * Mini-scena CAD na podstronie cnc.html:
 * jedna formatka, FacePicker w trybie podgeometrii, narzędzie profilu.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { registerProjectDomain } from '../application/project-domain.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { Viewport } from '../../S3_scena/viewport.js';
import { PanelView } from '../../A4_smartpanel/panel-view.js';
import { FacePicker } from '../../A1_core/face-picker.js';
import { SketchPlane } from '../../S1_sketcher/sketch-plane.js';
import { UIController } from '../../A1_core/ui-controller.js';
import { NativePanelBuilder } from '../../A4_smartpanel/native-panel-builder.js';
import { ContextMenu } from '../../A1_core/context-menu.js';
import { PropertiesManager } from '../../A1_core/properties.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { StateMachine } from '../../A1_core/interaction/state-machine.js';
import { InteractionManager } from '../../A1_core/interaction/interaction-manager.js';
import { IntentType } from '../../A1_core/interaction/interaction-types.js';
import { SelectionTool } from '../../A1_core/interaction/states/selection-tool.js';
import { SelectProfileTool } from '../../C1_cnc/interaction/select-profile-tool.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';
import { CNCEngine } from '../../C1_cnc/core/cnc-engine.js';
import type { CadModuleContext } from '../../A1_core/cad-module-context.js';
import type { CncWorkpiece } from './types';
import { hydrateCncWorkpiece } from './cad-extract';
import { namedCameraView } from '../../S3_scena/named-camera-view.js';
import { createArcballCameraFactory } from '../../C1_cnc/interaction/arcball-camera-session.js';

declare const BABYLON: any;

export async function bootstrapCncPage(canvas: HTMLCanvasElement): Promise<CadModuleContext> {
    if (typeof BABYLON === 'undefined') {
        throw new Error(tx(srcTekst, 'entry.no_babylon', TX_NS));
    }

    const document = new ProjectDocument();
    registerProjectDomain(document);
    const propertiesManager = PropertiesManager.instance;
    const viewport = await Viewport.create(canvas);
    viewport.toggleGrid(false);
    // Test CNC: arcball obraca FORMATKĘ (jak workbench), nie kamerę. ŚPM / Alt+LPM.
    viewport.rotationFactory = createArcballCameraFactory(() => {
        const panel = ContextManager.instance.activePanel
            || ContextManager.instance.document?.activeEntity;
        if (!panel) return null;
        return ContextManager.instance.panelViews?.get(panel) ?? null;
    });
    if (viewport.camera?.upVector?.set) {
        viewport.camera.upVector.set(0, 1, 0);
    }

    const panelViews = new Map<any, PanelView>();
    const containerViews = new Map<any, any>();

    const cm = ContextManager.instance;
    cm.panelViews = panelViews;
    cm.containerViews = containerViews;
    cm.document = document;
    cm.viewport = viewport;
    cm.babylonScene = viewport.scene;
    cm.activeTab = 'tab-c1-cnc';
    cm.lcsVisible = true;
    cm.activePanel = null;
    cm.hideGizmos = () => {};
    cm.showGizmos = () => {};

    const facePicker = new FacePicker(viewport.scene, canvas, panelViews, document);
    facePicker.selectionMode = 'subgeometry';
    cm.facePicker = facePicker;

    const sketchPlane = new SketchPlane(viewport.scene, document, viewport);
    const ui = new UIController(document);
    (ui as any).viewport = viewport;

    const commandHistory = new CommandHistory(document, { maxEntries: 50 });
    cm.commandHistory = commandHistory;

    const panelBuilder = new NativePanelBuilder();
    const contextMenu = new ContextMenu();

    const ctx: CadModuleContext = {
        canvas,
        document,
        viewport,
        panelViews,
        containerViews,
        facePicker,
        sketchPlane,
        ui,
        panelBuilder,
        contextMenu,
        propertiesManager,
    };

    const stateMachine = new StateMachine(ctx);
    stateMachine.registerState('SELECTION_TOOL', new SelectionTool(ctx, stateMachine));
    stateMachine.registerState('SelectionTool', new SelectionTool(ctx, stateMachine));
    stateMachine.registerState('SELECT_PROFILE_TOOL', new SelectProfileTool(ctx, stateMachine));
    stateMachine.changeState('SELECTION_TOOL');

    cm.stateMachine = stateMachine;
    cm.appAPI = {
        stateMachine,
        setStatus: (status: string, highlight?: boolean) => ui.setStatus(status, highlight),
        zoomFit: () => {
            const panel = document.activeEntity;
            if (panel) frameCameraOnPanel(ctx, panel);
        },
        setView: (viewName: string) => applyNamedView(ctx, viewName),
        setRenderMode: (mode: string) => {
            if (mode === 'shaded' || mode === 'edges' || mode === 'wireframe' || mode === 'xray') {
                viewport.setRenderMode(mode);
            }
        },
        toggleGrid: (visible?: boolean) => {
            if (typeof visible === 'boolean') {
                viewport.toggleGrid(visible);
                return;
            }
            const lines = viewport.gridLines as any;
            const currentlyOn = Array.isArray(lines)
                ? lines.some((l: any) => l?.isEnabled?.() !== false)
                : lines?.isEnabled?.() !== false;
            viewport.toggleGrid(!currentlyOn);
        },
        toggleProjection: () => viewport.toggleCameraProjection(),
        setLcsVisible: (visible: boolean) => {
            ContextManager.instance.lcsVisible = visible;
            for (const panel of ctx.panelViews.keys()) {
                if (typeof (panel as any).setLcsVisible === 'function') {
                    (panel as any).setLcsVisible(visible);
                }
            }
            for (const view of ctx.panelViews.values()) {
                if (typeof (view as any).setLcsVisible === 'function') {
                    (view as any).setLcsVisible(visible);
                }
            }
        },
        setSelectionMode: (mode: 'object' | 'subgeometry') => {
            facePicker.selectionMode = mode;
        },
        hideGizmos: () => {},
        showGizmos: () => {},
    };

    new InteractionManager(viewport.scene, (intent) => {
        // CAM: bez Fit (F / ZOOM_FIT)
        if ((intent.type as string) === 'ZOOM_FIT') return;
        if (intent.type === IntentType.CONTEXT_MENU) return;
        stateMachine.handleIntent(intent);
    });

    CNCEngine.getInstance().initializeIfNeeded(viewport.scene);
    ui.setStatus(tx(srcTekst, 'moddata.cnc_scene', TX_NS), false);

    return ctx;
}

export function mountCncWorkpiece(ctx: CadModuleContext, workpiece: CncWorkpiece): any {
    clearMountedPanels(ctx);

    const panel = hydrateCncWorkpiece(ctx.document, workpiece);
    const view = new PanelView(ctx.viewport.scene, panel);
    ctx.panelViews.set(panel, view);

    const meshData = ctx.panelBuilder.build(panel);
    view.updateMesh(meshData);
    if (typeof (view as any)._updateMaterialAppearance === 'function') {
        (view as any)._updateMaterialAppearance();
    }
    view.lastWidth = panel.width;
    view.lastHeight = panel.height;
    view.lastThickness = panel.thickness;
    if (typeof (view as any).renderFeatures === 'function') {
        (view as any).renderFeatures();
    }
    if (typeof view._updateTransform === 'function') {
        view._updateTransform();
    }
    if (view.root) view.root.setEnabled(true);

    const lcsOn = ContextManager.instance.lcsVisible ?? true;
    if (typeof (panel as any).setLcsVisible === 'function') {
        (panel as any).setLcsVisible(lcsOn);
    }
    if (typeof (view as any).setLcsVisible === 'function') {
        (view as any).setLcsVisible(lcsOn);
    }

    ContextManager.instance.activePanel = panel;
    ContextManager.instance.selectedPanel = panel;
    ctx.document.setActiveEntity(panel);
    ctx.facePicker.selectionMode = 'subgeometry';

    requestAnimationFrame(() => {
        try {
            ctx.viewport.engine.resize();
        } catch { /* canvas może być jeszcze 0×0 */ }
        frameCameraOnPanel(ctx, panel);
    });

    return panel;
}

export function clearMountedPanels(ctx: CadModuleContext): void {
    for (const [panel, view] of [...ctx.panelViews.entries()]) {
        try {
            view.dispose();
        } catch { /* ignore */ }
        ctx.panelViews.delete(panel);
        try {
            ctx.document.removeNode(panel.id);
        } catch { /* ignore */ }
    }
}

export function frameCameraOnPanel(ctx: CadModuleContext, panel: any): void {
    const view = ctx.panelViews.get(panel);
    const camera = ctx.viewport?.camera;
    if (!view?.root || !camera) return;

    const bbox = view.root.getHierarchyBoundingVectors(true);
    const min = bbox.min;
    const max = bbox.max;
    const center = max.add(min).scale(0.5);
    const size = max.subtract(min);
    const extent = Math.max(size.x, size.y, size.z, 50);

    camera.setTarget(center);
    camera.radius = Math.min(Math.max(extent * 1.8, 120), 18000);
    if (camera.alpha == null) camera.alpha = Math.PI / 4;
    if (camera.beta == null || camera.beta === 0) camera.beta = Math.PI / 3;
}

function applyNamedView(ctx: CadModuleContext, viewName: string): void {
    const viewport = ctx.viewport;
    const camera = viewport?.camera;
    if (!camera) return;

    const key = String(viewName || '').toLowerCase();
    let namedKey: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' = 'front';
    if (key.includes('z_plus') || key === 'front' || key === 'top_face') namedKey = 'front';
    else if (key.includes('z_minus') || key === 'back') namedKey = 'back';
    else if (key.includes('y_plus') || key === 'top') namedKey = 'top';
    else if (key.includes('y_minus') || key === 'bottom') namedKey = 'bottom';
    else if (key.includes('x_minus') || key === 'left') namedKey = 'left';
    else if (key.includes('x_plus') || key === 'right') namedKey = 'right';

    const panel = ContextManager.instance.activePanel || ctx.document?.activeEntity;
    const pView = panel ? ctx.panelViews.get(panel) : null;
    let target = camera.target;
    if (pView?.root) {
        try {
            pView.root.computeWorldMatrix(true);
            const bbox = pView.root.getHierarchyBoundingVectors(true);
            target = bbox.max.add(bbox.min).scale(0.5);
        } catch { /* ignore */ }
    }

    const named = namedCameraView(namedKey);
    viewport.clearViewCubeOverride?.();
    (viewport as any).__cncCubeQuat = null;
    viewport.animateCameraTo(named.alpha, named.beta, camera.radius, target, named.up);
}
