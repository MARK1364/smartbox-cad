/**
 * SmartPanel Web — Scene Bootstrap
 * 
 * Odpowiada za inicjalizację sceny 3D, viewportu Babylon.js, OCCT Wasm,
 * modelów domenowych oraz kontrolerów UI i historii.
 */

import { ProjectDocument } from './project-document.js';
import { registerProjectDomain } from './project-domain.js';
import { CommandHistory } from './commands/command-history.js';
import { Viewport } from '../S3_scena/viewport.js';
import { PanelView } from '../A4_smartpanel/panel-view.js';
import { FacePicker } from './face-picker.js';
import { SketchPlane } from '../S1_sketcher/sketch-plane.js';
import { UIController } from './ui-controller.js';
import { NativePanelBuilder } from '../A4_smartpanel/native-panel-builder.js';
import { HistoryManager } from './history-manager.js';
import { ContextMenu } from './context-menu.js';
import { PropertiesManager } from './properties.js';
import { ContextManager } from './context-manager.js';
import { initializeSmartFrameEngine } from '../A3_smartframe/smartframe-adapter.js';
import { ModalTransformManager } from './modal-transform.js';

export interface BootstrapContext {
    canvas: HTMLCanvasElement | null;
    document: ProjectDocument;
    viewport: Viewport;
    panelViews: Map<any, PanelView>;
    containerViews: Map<any, any>;
    facePicker: FacePicker;
    sketchPlane: SketchPlane;
    ui: UIController;
    panelBuilder: NativePanelBuilder;
    history: HistoryManager;
    contextMenu: ContextMenu;
    propertiesManager: PropertiesManager;
}

export async function bootstrapScene(): Promise<BootstrapContext> {
    let canvas = window.document.getElementById('renderCanvas') as HTMLCanvasElement;
    // Czekaj na zamontowanie canvasu w React.js (przydatne przy HMR)
    while (!canvas) {
        await new Promise(resolve => setTimeout(resolve, 50));
        canvas = window.document.getElementById('renderCanvas') as HTMLCanvasElement;
    }
    const document = new ProjectDocument();
    registerProjectDomain(document);
    const propertiesManager = PropertiesManager.instance;
    const viewport = await Viewport.create(canvas);

    const panelViews = new Map<any, PanelView>();
    const containerViews = new Map<any, any>();

    ContextManager.instance.panelViews = panelViews;
    ContextManager.instance.containerViews = containerViews;
    ContextManager.instance.document = document;

    const facePicker = new FacePicker(viewport.scene, canvas, panelViews, document);
    ContextManager.instance.facePicker = facePicker;

    const sketchPlane = new SketchPlane(viewport.scene, document, viewport);

    const ui = new UIController(document);
    (ui as any).viewport = viewport;

    ContextManager.instance.viewport = viewport;
    ContextManager.instance.babylonScene = viewport.scene;

    ModalTransformManager.instance.init();

    const commandHistory = new CommandHistory(document, { maxEntries: 100 });
    ContextManager.instance.commandHistory = commandHistory;

    const panelBuilder = new NativePanelBuilder();
    const history = new HistoryManager(100);
    const contextMenu = new ContextMenu();

    return {
        canvas,
        document,
        viewport,
        panelViews,
        containerViews,
        facePicker,
        sketchPlane,
        ui,
        panelBuilder,
        history,
        contextMenu,
        propertiesManager
    };
}
