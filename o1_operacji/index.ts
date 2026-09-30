/**
 * O1 — biblioteka operacji (wcięcia na formatce).
 */

export { OPERACJE_PANEL_TITLE, OPERACJE_DRAG_MIME, LIBRARY_SOURCE, CAD_EDIT_LIBRARY_OPERATION } from './operacje-types.js';
export type {
    OperationRecipe,
    OperationFeature,
    OperationKind,
    OperationFill,
    OperationFaceHint,
} from './operacje-types.js';
export { listOperations, getOperation } from './operacje-catalog.js';
export { buildOperationFeature, pocketRectMm, faceHintToFace, recipeWithOverrides } from './operacje-builder.js';
export {
    isLibraryOperation,
    isEngineGroove,
    featureOperationLabel,
    featureOperationDetails,
    mergeEngineAndLibraryFeatures,
    applyLibraryOperation,
    applyLibraryOperationFromPick,
    applyAllLibraryOperations,
    refreshLibraryOperationsOnPanel,
    updateLibraryOperationParams,
    updateLibraryOperationsById,
    collectPanelsWithLibraryOperation,
    bindOperationEdge,
} from './operacje-apply.js';
export { attachOperacjeExtension } from './operacje-controller.js';
export { OperacjeUI } from './operacje-ui.js';
// SmartParts — LED (re-export dla kompatybilności wstecznej → źródło: A5_smartparts)
export { LedChannelStore, startGuidedLedPick, stopGuidedLedPick, handleLedChannelDrop } from '../A5_smartparts/led/led-channel-store.js';
export { LedChannelUI } from '../A5_smartparts/led/led-channel-ui.js';
export { applyLedChannelToDocument, removeLedChannelFromDocument, computeLedChannelWorldBox, detectCabinetRow } from '../A5_smartparts/led/led-channel-engine.js';
export type { LedChannelDefinition } from '../A5_smartparts/led/led-channel-types.js';
