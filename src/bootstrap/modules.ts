/**
 * Centralny rejestr i orkiestrator modułów CAD.
 * Jedyna lista i kolejność startu modułów domenowych i rozszerzeń w aplikacji.
 */

import type { CadModule, CadModuleRuntime } from './cad-module.js';
import type { CadModuleContext } from '../../A1_core/cad-module-context.js';
import type { StateMachine } from '../../A1_core/interaction/state-machine.js';
import { ContextManager } from '../../A1_core/context-manager.js';

// Moduły domenowe
import { registerSmartFrameModule, smartFrameCabinetModule } from '../../A3_smartframe/register.js';
import { registerBlokiModule } from '../../A2_bloki/register.js';
import { registerScianyModule, unregisterScianyModule } from '../../S4_sciany/register.js';
import { registerSmartPartsModule } from '../../A5_smartparts/register.js';
import {
    syncHangerDefinitionFromParams,
    updateSmartPartHangersGroup,
} from '../../A5_smartparts/hangers/hanger-apply.js';
import { SMARTPART_HANGERS_GROUP_TYPE } from '../../A5_smartparts/hangers/hanger-types.js';

// Rozszerzenia dokumentu
import { attachViewportExtension } from '../../S3_scena/viewport-document-extension.js';
import { attachMaterialsExtension } from '../../A7_material/materials-document-extension.js';
import { attachDrawingsExtension } from '../application/drawings-document-extension.js';
import { attachConnectorsExtension } from '../../C2_connectors/connector-controller.js';
import { attachOperacjeExtension } from '../../o1_operacji/operacje-controller.js';

// PMI
import { PMIRenderer } from '../../A8_pmi/pmi-renderer.js';
import { PMIStore } from '../../A8_pmi/pmi-data.js';
import { PMISyncController } from '../../A8_pmi/pmi-sync.js';
import { DimensionTool } from '../../A8_pmi/pmi-tool.js';
import { MeasureTool } from '../../A8_pmi/pmi-measure-tool.js';
import { PMIEditOffsetTool } from '../../A8_pmi/pmi-edit-tool.js';
import { PMIViewportListener, PMI_EDIT_STATE } from '../../A8_pmi/pmi-viewport-listener.js';
import { PMITextShiftTool, PMI_TEXT_SHIFT_STATE } from '../../A8_pmi/pmi-text-shift-tool.js';
import { DIMENSION_TOOL_STATE, MEASURE_TOOL_STATE } from '../../A8_pmi/pmi-tool-activate.js';

// Solver
import { ConstraintStore } from '../../S2_solver/constraint-store.js';
import { SolverController } from '../../S2_solver/solver-controller.js';
import { getActiveConstraintPicker, stopConstraintPick } from '../../S2_solver/constraint-picker.js';
import { ConstraintDragGroup } from '../../S2_solver/constraint-drag-group.js';
import { registerConstraintDragPort, resetConstraintDragPortForTests } from '../../A1_core/constraint-drag-port.js';

// PMI commands (SelectionTool hooks)
import { deleteActiveDimension } from '../../A8_pmi/pmi-commands.js';
import {
    registerSelectionToolHooks,
    resetSelectionToolHooksForTests,
} from '../../A1_core/selection-tool-hooks-port.js';

// CNC Tools
import { SelectProfileTool } from '../../C1_cnc/interaction/select-profile-tool.js';

// Porty widoków
import { 
    registerContainerViewAdapter, 
    registerPanelViewAdapter, 
    registerGeometryUpdateHandler,
    resetViewPort
} from '../../A1_core/view-port.js';
import { ContainerView } from '../../A3_smartframe/container-view.js';
import { PanelView } from '../../A4_smartpanel/panel-view.js';
import { update_bloki_core } from '../../A2_bloki/bloki-core.js';
import { initializeSmartFrameEngine } from '../../A3_smartframe/smartframe-adapter.js';

/**
 * Moduł A3 SmartFrame (korpus)
 */
const smartFrameModule: CadModule = {
    id: 'A3_smartframe',
    async registerDomain() {
        registerSmartFrameModule();
        await initializeSmartFrameEngine();
        registerContainerViewAdapter({
            createView: (scene, container) => new ContainerView(scene, container)
        });
    }
};

/**
 * Moduł A2 Bloki (wnętrza szafek, akcesoria)
 */
let unregisterBlokiGeometryHandler: (() => void) | null = null;
const blokiModule: CadModule = {
    id: 'A2_bloki',
    registerDomain() {
        registerBlokiModule();
        unregisterBlokiGeometryHandler = registerGeometryUpdateHandler({
            updateBeforeRebuild(doc, containers) {
                for (const container of containers) {
                    const isBloki =
                        !!container.generatorParams?.boxType ||
                        (typeof container.generatorParams?.type === 'string' && container.generatorParams.type.startsWith('blok_')) ||
                        (container as any).is_blok === true;
                    if (isBloki) {
                        update_bloki_core(container, doc);
                    }
                }
            }
        });
    },
    dispose() {
        if (unregisterBlokiGeometryHandler) {
            unregisterBlokiGeometryHandler();
            unregisterBlokiGeometryHandler = null;
        }
        if (ContextManager.instance.blokiBayController?.dispose) {
            ContextManager.instance.blokiBayController.dispose();
        }
    }
};

/**
 * Moduł A4 SmartPanel (formatki)
 */
const smartPanelModule: CadModule = {
    id: 'A4_smartpanel',
    registerDomain() {
        registerPanelViewAdapter({
            createView: (scene, panel) => new PanelView(scene, panel)
        });
    }
};

/**
 * Moduł S4 SmartWall (kontener pod ROOM + PART WALL / WALL_PILLAR)
 */
const scianyModule: CadModule = {
    id: 'S4_sciany',
    registerDomain() {
        registerScianyModule();
    },
    dispose() {
        unregisterScianyModule();
    }
};

/**
 * Moduł A5 SmartParts (uchwyty, kanały LED, akcesoria meblowe)
 */
let unregisterSmartPartsGeometryHandler: (() => void) | null = null;
const smartPartsModule: CadModule = {
    id: 'A5_smartparts',
    registerDomain({ ctx }) {
        registerSmartPartsModule(ctx.document);
        unregisterSmartPartsGeometryHandler = registerGeometryUpdateHandler({
            updateBeforeRebuild(doc, containers) {
                for (const container of containers) {
                    if (container.generatorParams?.type === SMARTPART_HANGERS_GROUP_TYPE) {
                        // Najpierw resolve parametrów (offsety z panelu), potem pozycje we wnęce
                        syncHangerDefinitionFromParams(container);
                        const node = doc.findNode?.(container.id);
                        if (node) {
                            updateSmartPartHangersGroup(node, doc);
                        }
                    }
                }
            }
        });
    },
    dispose() {
        if (unregisterSmartPartsGeometryHandler) {
            unregisterSmartPartsGeometryHandler();
            unregisterSmartPartsGeometryHandler = null;
        }
    }
};

/**
 * Moduł S3 Viewport
 */
const viewportModule: CadModule = {
    id: 'S3_viewport',
    registerProjectExtension({ ctx }) {
        attachViewportExtension(ctx.document, ctx.viewport);
    }
};

/**
 * Moduł A7 Materiały
 */
const materialsModule: CadModule = {
    id: 'A7_material',
    registerProjectExtension({ ctx }) {
        attachMaterialsExtension(ctx.document);
    }
};

/**
 * Moduł Rysunków technicznych
 */
const drawingsModule: CadModule = {
    id: 'R2_drawings',
    registerProjectExtension({ ctx }) {
        attachDrawingsExtension(ctx.document);
    }
};

/**
 * Moduł C2 Złącza
 */
const connectorsModule: CadModule = {
    id: 'C2_connectors',
    registerProjectExtension({ ctx }) {
        attachConnectorsExtension(ctx.document);
    }
};

/**
 * Moduł O1 Operacje
 */
const operacjeModule: CadModule = {
    id: 'o1_operacji',
    registerProjectExtension({ ctx }) {
        attachOperacjeExtension(ctx.document);
    }
};

/**
 * Moduł S2 Solver
 */
const solverModule: CadModule = {
    id: 'S2_solver',
    registerProjectExtension({ ctx }) {
        registerConstraintDragPort({
            begin(document, nodeId) {
                ConstraintDragGroup.instance.begin(document, nodeId, ConstraintStore.instance.constraints);
            },
            propagateTransform(document, draggedNodeId) {
                ConstraintDragGroup.instance.propagateTransform(document, draggedNodeId);
            },
            buildTransformCommands(document, label) {
                return ConstraintDragGroup.instance.buildTransformCommands(document, label);
            },
            restoreInitial(document) {
                ConstraintDragGroup.instance.restoreInitial(document);
            },
            end() {
                ConstraintDragGroup.instance.end();
            },
            getAffectedNodeIds() {
                return ConstraintDragGroup.instance.lastComponentIds;
            },
        });

        const history = ContextManager.instance.commandHistory;
        if (!history) {
            console.warn('[S2_solver] Brak CommandHistory — solver bez Undo.');
            return;
        }
        const solverController = new SolverController(ConstraintStore.instance);
        solverController.attach(ctx.document, history);
        (ContextManager.instance as any).solverController = solverController;
    }
};

/**
 * Moduł A8 PMI (Wymiarowanie)
 */
let pmiViewportListenerRef: PMIViewportListener | null = null;
let pmiSyncRef: PMISyncController | null = null;
let pmiRendererRef: PMIRenderer | null = null;
const pmiModule: CadModule = {
    id: 'A8_pmi',
    registerProjectExtension({ ctx }) {
        const pmiRenderer = new PMIRenderer(ctx.viewport.scene);
        ContextManager.instance.pmiRenderer = pmiRenderer;
        pmiRendererRef = pmiRenderer;

        const pmiSync = new PMISyncController(ctx.viewport.scene, pmiRenderer, PMIStore.instance);
        pmiSync.attach(ctx.document);
        (ContextManager.instance as any).pmiSync = pmiSync;
        pmiSyncRef = pmiSync;
    },
    registerTools({ ctx, stateMachine }) {
        const pmiRenderer = ContextManager.instance.pmiRenderer;
        if (!pmiRenderer) return;

        const dimTool = new DimensionTool(ctx, stateMachine, pmiRenderer);
        stateMachine.registerState(DIMENSION_TOOL_STATE, dimTool);

        const measureTool = new MeasureTool(ctx, stateMachine, pmiRenderer);
        stateMachine.registerState(MEASURE_TOOL_STATE, measureTool);

        stateMachine.registerState(PMI_EDIT_STATE, new PMIEditOffsetTool(ctx, stateMachine, pmiRenderer, PMIStore.instance));
        stateMachine.registerState(PMI_TEXT_SHIFT_STATE, new PMITextShiftTool(ctx, stateMachine, pmiRenderer, PMIStore.instance));

        pmiViewportListenerRef = new PMIViewportListener(ctx.viewport.scene, stateMachine, PMIStore.instance);
        pmiViewportListenerRef.attach();
    },
    dispose() {
        if (pmiViewportListenerRef) {
            pmiViewportListenerRef.dispose();
            pmiViewportListenerRef = null;
        }
        if (pmiSyncRef) {
            pmiSyncRef.dispose();
            pmiSyncRef = null;
        }
        if (pmiRendererRef) {
            pmiRendererRef.dispose();
            pmiRendererRef = null;
        }
        ContextManager.instance.pmiRenderer = null as any;
        delete (ContextManager.instance as any).pmiSync;
    }
};

/**
 * Moduł C1 CNC
 */
const cncModule: CadModule = {
    id: 'C1_cnc',
    registerTools({ ctx, stateMachine }) {
        stateMachine.registerState('SELECT_PROFILE_TOOL', new SelectProfileTool(ctx, stateMachine));
    }
};

/**
 * Główna uporządkowana lista wszystkich modułów CAD
 */
export const CAD_MODULES: CadModule[] = [
    smartPanelModule,
    smartFrameModule,
    blokiModule,
    smartPartsModule,
    scianyModule,
    viewportModule,
    materialsModule,
    drawingsModule,
    connectorsModule,
    operacjeModule,
    solverModule,
    pmiModule,
    cncModule
];

let activeModules: CadModule[] = [];

/**
 * Uruchamia wszystkie zarejestrowane moduły CAD w zdefiniowanej kolejności.
 */
export async function startModules(ctx: CadModuleContext, stateMachine: StateMachine): Promise<CadModule[]> {
    disposeModules();

    registerSelectionToolHooks({
        deleteActiveAnnotation: () => {
            deleteActiveDimension();
        },
        cancelActivePick: () => {
            const picker = getActiveConstraintPicker();
            if (!picker) return false;
            picker.onCancel?.();
            stopConstraintPick();
            return true;
        },
    });

    const moduleContext: CadModuleRuntime = { ctx, stateMachine };

    for (const mod of CAD_MODULES) {
        if (mod.registerDomain) {
            await mod.registerDomain(moduleContext);
        }
        if (mod.registerProjectExtension) {
            mod.registerProjectExtension(moduleContext);
        }
        if (mod.registerTools) {
            mod.registerTools(moduleContext);
        }
        if (mod.registerUi) {
            mod.registerUi(moduleContext);
        }
        activeModules.push(mod);
    }

    return activeModules;
}

/**
 * Sprząta stan zarejestrowanych modułów.
 */
export function disposeModules(): void {
    for (let i = activeModules.length - 1; i >= 0; i--) {
        const mod = activeModules[i];
        try {
            mod.dispose?.();
        } catch (e) {
            console.warn(`[CadModule] Błąd podczas dispose modułu ${mod.id}:`, e);
        }
    }
    activeModules = [];
    resetSelectionToolHooksForTests();
    resetConstraintDragPortForTests();
    resetViewPort();
}
