/**
 * A3_smartframe Barrel Export — Public API
 */

export {
    initializeSmartFrameEngine,
    rebuildSmartFrameContainer,
    updateContainerPosition,
    applyRealtimeUpdate,
    getActiveContainer,
    calcTopHeight,
    resolveCabinetType,
    type KorpusParams
} from './smartframe-adapter.js';

export { ContainerView } from './container-view.js';
export { SmartFrameUI } from './smartframe-ui';
export { SmartFrameDragController } from './smartframe-drag-controller.js';

export * from './smartframe-types.js';
export {
    planCabinet,
    normalizeCabinetParams,
    calculateCabinetPlan,
    calculateStandardCabinetPlan,
    calculateRogowy1CabinetPlan,
    calculateRogowy90CabinetPlan,
    calculateSkosnyCabinetPlan,
    computeCabinetZoneLayout,
    collectCabinetGeometry,
    selectCabinetBaseRules
} from './smartframe-engine.js';

