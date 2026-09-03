/**
 * A3_smartframe Barrel Export — Public API
 */

export {
    initializeSmartFrameEngine,
    rebuildSmartFrameContainer,
    updateContainerPosition,
    applyRealtimeUpdate,
    createNewKorpus,
    getActiveContainer,
    calcTopHeight
} from './smartframe-adapter.js';

export { ContainerView } from './container-view.js';
export { SmartFrameUI } from './smartframe-ui';
