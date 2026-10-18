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
// LED zewnętrzny (kanał) — re-eksport z A2_bloki/led (system kanałów podszafkowych).
// UWAGA: to NIE ten sam system co LED wewnętrzny (A2_bloki/13_led-internal-engine, source 'BLOKI_LED')
// — różne mechanizmy wykrywania geometrii i różne role montażowe; silniki nie są wymienne.
export { LedChannelStore, startGuidedLedPick, stopGuidedLedPick, handleLedChannelDrop } from '../A2_bloki/15_led-external-channel-store.js';
export { LedChannelUI } from '../A2_bloki/15_led-external-channel-ui.js';
export { applyLedChannelToDocument, removeLedChannelFromDocument, computeLedChannelWorldBox, detectCabinetRow } from '../A2_bloki/15_led-external-channel-engine.js';
export type { LedChannelDefinition } from '../A2_bloki/15_led-external-channel-types.js';
