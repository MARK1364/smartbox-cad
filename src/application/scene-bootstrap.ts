/**
 * SmartPanel Web — Scene Bootstrap (infrastruktura aplikacyjna)
 *
 * Inicjalizuje scenę 3D Babylon.js, viewport, modele domenowe
 * oraz kontrolery UI i CommandHistory.
 *
 * Ten plik należy do warstwy aplikacyjnej (src/application/).
 * Importuje swobodnie: Babylon.js, DOM, warstwy widoku, ContextManager.
 *
 * Moduły domenowe (A1_core, A8_pmi, interaction itd.) importują wyłącznie
 * interfejs CadModuleContext z A1_core/cad-module-context.ts.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { registerProjectDomain } from './project-domain.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { Viewport } from '../../S3_scena/viewport.js';
import type { PanelView } from '../../A4_smartpanel/panel-view.js';
import { FacePicker } from '../../A1_core/face-picker.js';
import { SketchPlane } from '../../S1_sketcher/sketch-plane.js';
import { UIController } from '../../A1_core/ui-controller.js';
import { NativePanelBuilder } from '../../A4_smartpanel/native-panel-builder.js';
import { ContextMenu } from '../../A1_core/context-menu.js';
import { PropertiesManager } from '../../A1_core/properties.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { ModalTransformManager } from '../../A1_core/modal-transform.js';
import type { CadModuleContext } from '../../A1_core/cad-module-context.js';
import { ensureDoorsWasmInitialized } from '../../A2_bloki/doors-wasm-bridge.js';
import { ensureDrawersWasmInitialized } from '../../A2_bloki/drawers-wasm-bridge.js';
import { ensureShelvesWasmInitialized } from '../../A2_bloki/shelves-wasm-bridge.js';
import { ensureFlapsWasmInitialized } from '../../A2_bloki/flaps-wasm-bridge.js';
import { ensureDividersWasmInitialized } from '../../A2_bloki/dividers-wasm-bridge.js';
import { ensureTubesWasmInitialized } from '../../A2_bloki/tubes-wasm-bridge.js';
import { ensureShelfWasmInitialized } from '../../A2_bloki/shelf-wasm-bridge.js';
import { ensurePanelsWasmInitialized } from '../../A2_bloki/panels-wasm-bridge.js';
import { ensureSkosneDoorsWasmInitialized } from '../../A2_bloki/skosne-doors-wasm-bridge.js';
import { ensureCornerDoorsWasmInitialized } from '../../A2_bloki/corner-doors-wasm-bridge.js';
import { ensureCornerShelvesWasmInitialized } from '../../A2_bloki/corner-shelves-wasm-bridge.js';
import { ensureSlidingDoorsWasmInitialized } from '../../A2_bloki/sliding-doors-wasm-bridge.js';
import { ensureLedWasmInitialized } from '../../A2_bloki/led-wasm-bridge.js';
import { ensureHangersWasmInitialized } from '../../A2_bloki/hangers-wasm-bridge.js';
import { ensureHandlesWasmInitialized } from '../../A2_bloki/handles/handles-wasm-bridge.js';
import { ensureSmartFrameWasmInitialized } from '../../A3_smartframe/smartframe-wasm-bridge.js';
import { ensurePanelBrepWasmInitialized } from '../../A4_smartpanel/panel-brep-wasm-bridge.js';

/** Konkretna implementacja CadModuleContext z dokładnymi typami Babylona. */
export interface BootstrapContext extends CadModuleContext {
    viewport: Viewport;
    panelViews: Map<any, PanelView>;
    sketchPlane: SketchPlane;
    panelBuilder: NativePanelBuilder;
}

export async function bootstrapScene(): Promise<BootstrapContext> {
    // Inicjalizacja binarnych silników WASM w tle przy starcie sceny
    void ensureDoorsWasmInitialized();
    void ensureDrawersWasmInitialized();
    void ensureShelvesWasmInitialized();
    void ensureFlapsWasmInitialized();
    void ensureDividersWasmInitialized();
    void ensureTubesWasmInitialized();
    void ensureShelfWasmInitialized();
    void ensurePanelsWasmInitialized();
    void ensureSkosneDoorsWasmInitialized();
    void ensureCornerDoorsWasmInitialized();
    void ensureCornerShelvesWasmInitialized();
    void ensureSlidingDoorsWasmInitialized();
    void ensureLedWasmInitialized();
    void ensureHangersWasmInitialized();
    void ensureHandlesWasmInitialized();
    void ensureSmartFrameWasmInitialized();
    void ensurePanelBrepWasmInitialized();

    let canvas = window.document.getElementById('renderCanvas') as HTMLCanvasElement;
    // Czekaj na zamontowanie canvasu w React.js (przydatne przy HMR)
    while (!canvas) {
        await new Promise(resolve => setTimeout(resolve, 50));
        canvas = window.document.getElementById('renderCanvas') as HTMLCanvasElement;
    }

    const document = new ProjectDocument();
    registerProjectDomain(document);
    const propertiesManager = PropertiesManager.instance;

    // Bezpieczne zwolnienie poprzedniego silnika w przypadku ponownego uruchomienia (HMR)
    if (ContextManager.instance?.viewport?.engine) {
        try {
            ContextManager.instance.viewport.engine.stopRenderLoop();
            ContextManager.instance.viewport.scene?.dispose();
            ContextManager.instance.viewport.engine.dispose();
        } catch (e) {
            console.warn('[scene-bootstrap] Błąd podczas zwalniania poprzedniego silnika Viewport:', e);
        }
    }

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

    document.onDocumentChanged(() => {
        viewport.requestRender(3);
    });

    ModalTransformManager.instance.init();

    const commandHistory = new CommandHistory(document, { maxEntries: 100 });
    ContextManager.instance.commandHistory = commandHistory;

    const panelBuilder = new NativePanelBuilder();
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
        contextMenu,
        propertiesManager
    };
}
