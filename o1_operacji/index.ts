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
export { pocketFromEdgeDims, edgeShortLabel, edgeKeyToPanelFace, snapDimHandleToEdge, isEdgeDimHandleMesh } from './operacje-placement.js';
export { attachOperacjeExtension } from './operacje-controller.js';
export { OperacjeUI } from './operacje-ui.js';
