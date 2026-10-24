/**
 * A2_bloki Barrel Export — Public API
 *
 * Nazwy plików w A2_bloki mają prefiks numeryczny = rodzina (patrz .agents/AGENTS.md):
 *   01_*  rdzeń współdzielony (base-engine, bloki-core, bloki-ui, module-plans, machining-* …)
 *   02_*  wykrywanie i umieszczanie we wnęce (bay)
 *   03_shelf 04_shelves 05_doors 06_skosne-doors 07_corner-doors 08_tubes 09_drawers
 *   10_dividers 11_panels 12_flaps 13_led-internal 14_led-external 15_led-external-channel
 *   16_led 17_hangers
 *
 * 1 moduł = adapter + silnik + rules JSON, opcjonalnie drilling:
 *   shelf     — wieniec
 *   shelves   — półki + shelves-drilling-*
 *   doors     — drzwi + doors-drilling-*
 *   skosne-doors — drzwi skośne (trapez) + skosne-doors-drilling-*
 *   corner-doors — drzwi narożne L (fuga)
 *   tubes     — drążek
 *   drawers   — szuflady + drawers-drilling-*
 *   dividers  — przegrody
 *   panels    — blendy (OUTER)
 *   flaps     — klapy + flaps-drilling-*
 *
 * Wspólne: 01_base-engine (dims), 01_bloki-core, 01_bloki-ui.
 * Wyjątek: `index.ts` (barrel — bez numeru; importy katalogowe `../A2_bloki`).
 */

export { update_bloki_core } from './01_bloki-core.js';
export { BlokiUI } from './01_bloki-ui';
export { toDimensionsMm, type ModuleDims } from './01_base-engine.js';

export { calculateShelvesPlan, normalizeShelvesParams, assertCanonicalShelvesParams } from './04_shelves-engine.js';
export { calculateShelfPlan, normalizeShelfParams, assertCanonicalShelfParams } from './03_shelf-engine.js';
export { calculateDoorsPlan, normalizeDoorsParams } from './05_doors-engine.js';
export {
    calculateSkosneDoorsPlan,
    normalizeSkosneDoorsParams,
    assertCanonicalSkosneDoorsParams,
    LEGACY_SKOSNE_DOORS_PARAM_ALIASES,
    skosneDoorHeightAt
} from './06_skosne-doors-engine.js';
export {
    calculateCornerDoorsPlan,
    normalizeCornerDoorsParams,
    assertCanonicalCornerDoorsParams,
    LEGACY_CORNER_DOORS_PARAM_ALIASES,
    type CornerDoorsParams
} from './07_corner-doors-engine.js';
export {
    calculateCornerShelvesPlan,
    normalizeCornerShelvesParams,
    assertCanonicalCornerShelvesParams,
    LEGACY_CORNER_SHELVES_PARAM_ALIASES,
    type NormalizedCornerShelvesParams
} from './18_corner-shelves-engine.js';
export { calculateTubesPlan, normalizeTubesParams, assertCanonicalTubesParams } from './08_tubes-engine.js';
export { calculateDrawersPlan, normalizeDrawersParams } from './09_drawers-engine.js';
export { calculateDividersPlan, normalizeDividersParams, assertCanonicalDividersParams } from './10_dividers-engine.js';
export { calculatePanelsPlan, normalizePanelsParams, assertCanonicalPanelsParams } from './11_panels-engine.js';
export { calculateFlapsPlan, normalizeFlapsParams } from './12_flaps-engine.js';
export {
    calculateLedInternalPlan,
    normalizeLedInternalParams,
    assertCanonicalLedInternalParams
} from './13_led-internal-engine.js';
export {
    calculateLedExternalPlan,
    normalizeLedExternalParams,
    assertCanonicalLedExternalParams
} from './14_led-external-engine.js';
export type {
    CornerDoorsPlanParams,
    DoorsPlanParams,
    DividersPlanParams,
    DrawerRailConfig,
    DrawersPlanParams,
    FlapsPlanParams,
    HingeIndex,
    LedExternalPlanParams,
    LedInternalPlanParams,
    LedInternalVariant,
    LedPlanParams,
    PanelsPlanParams,
    ShelfHolePattern,
    ShelfPlanParams,
    ShelvesPlanParams,
    SkosneDoorType,
    SkosneDoorsPlanParams,
    BlokiGeneratorMetadata,
    BlokiGeneratorParams,
    BlokiGeneratorParamsPatch,
    BlokiModuleId,
    BlokiModuleParamsById,
    BlokiModuleTypeById,
    BlokiPanelReference,
    BlokiReferenceSide,
    SidePanelMode,
    TubesPlanParams
} from './01_bloki-module-types.js';
export { isBlokiGeneratorParams } from './01_bloki-module-types.js';
export { calculateLedPlan } from './16_led-engine.js';

export { ShelvesSubModule, buildShelvesPlan } from './04_shelves-adapter.js';
export { ShelfSubModule, buildShelfPlan } from './03_shelf-adapter.js';
export { DoorsSubModule, buildDoorsPlan } from './05_doors-adapter.js';
export { SkosneDoorsSubModule, buildSkosneDoorsPlan } from './06_skosne-doors-adapter.js';
export { CornerDoorsSubModule, buildCornerDoorsPlan, normalizeCornerOtwieranie } from './07_corner-doors-adapter.js';
export type { CornerOtwieranie } from './07_corner-doors-adapter.js';
export { CornerShelvesSubModule, buildCornerShelvesPlan } from './18_corner-shelves-adapter.js';
export { TubesSubModule, buildTubesPlan } from './08_tubes-adapter.js';
export { DrawersSubModule, buildDrawersPlan } from './09_drawers-adapter.js';
export { DividersSubModule, buildDividersPlan } from './10_dividers-adapter.js';
export { PanelsSubModule, buildPanelsPlan } from './11_panels-adapter.js';
export { FlapsSubModule, buildFlapsPlan } from './12_flaps-adapter.js';
export { LedSubModule, buildLedPlan, LedInternalSubModule, buildLedInternalPlan, LedExternalSubModule, buildLedExternalPlan } from './16_led-adapter.js';

export { buildShelvesDrillings } from './04_shelves-drilling-builder.js';
export { buildCornerShelvesDrillings } from './18_corner-shelves-drilling-builder.js';
export { buildDoorsDrillings } from './05_doors-drilling-builder.js';
export { buildSkosneDoorsDrillings } from './06_skosne-doors-drilling-builder.js';
export { buildDrawersDrillings } from './09_drawers-drilling-builder.js';
export { buildFlapsDrillings } from './12_flaps-drilling-builder.js';
export { buildTubesDrillings } from './08_tubes-drilling-builder.js';

// Hangers (Zawieszki)
export * from './hangers/hanger-types.js';
export { computeHangerCornerPoses, createSmartPartHangersInBay, updateSmartPartHangersGroup, syncHangerDefinitionFromParams, resolveHangersReferenceBoxMm } from './hangers/hanger-apply.js';
export { buildHangerGlbMesh, syncHangerMeshesFromDocument } from './hangers/hanger-mesh.js';
export { HangerDragController } from './hangers/hanger-controller.js';

// LED Channel
export {
    LedChannelStore,
    startGuidedLedPick,
    stopGuidedLedPick,
    handleLedChannelDrop,
} from './15_led-external-channel-store.js';
export { LedChannelUI } from './15_led-external-channel-ui.js';
export { applyLedChannelToDocument, removeLedChannelFromDocument, computeLedChannelWorldBox, detectCabinetRow } from './15_led-external-channel-engine.js';
export type { LedChannelDefinition } from './15_led-external-channel-types.js';
