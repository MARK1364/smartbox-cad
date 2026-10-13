/**
 * A2_bloki Barrel Export — Public API
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
 * Wspólne: base-engine (dims), bloki-core, bloki-ui.
 */

export { update_bloki_core } from './bloki-core.js';
export { BlokiUI } from './bloki-ui';
export { toDimensionsMm, type ModuleDims } from './base-engine.js';

export { calculateShelvesPlan, normalizeShelvesParams, assertCanonicalShelvesParams } from './shelves-engine.js';
export { calculateShelfPlan, normalizeShelfParams, assertCanonicalShelfParams } from './shelf-engine.js';
export { calculateDoorsPlan, normalizeDoorsParams } from './doors-engine.js';
export {
    calculateSkosneDoorsPlan,
    normalizeSkosneDoorsParams,
    assertCanonicalSkosneDoorsParams,
    LEGACY_SKOSNE_DOORS_PARAM_ALIASES,
    skosneDoorHeightAt
} from './skosne-doors-engine.js';
export {
    calculateCornerDoorsPlan,
    normalizeCornerDoorsParams,
    assertCanonicalCornerDoorsParams,
    LEGACY_CORNER_DOORS_PARAM_ALIASES,
    type CornerDoorsParams
} from './corner-doors-engine.js';
export { calculateTubesPlan, normalizeTubesParams, assertCanonicalTubesParams } from './tubes-engine.js';
export { calculateDrawersPlan, normalizeDrawersParams } from './drawers-engine.js';
export { calculateDividersPlan, normalizeDividersParams, assertCanonicalDividersParams } from './dividers-engine.js';
export { calculatePanelsPlan, normalizePanelsParams, assertCanonicalPanelsParams } from './panels-engine.js';
export { calculateFlapsPlan, normalizeFlapsParams } from './flaps-engine.js';
export {
    calculateLedInternalPlan,
    normalizeLedInternalParams,
    assertCanonicalLedInternalParams
} from './led-internal-engine.js';
export {
    calculateLedExternalPlan,
    normalizeLedExternalParams,
    assertCanonicalLedExternalParams
} from './led-external-engine.js';
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
} from './bloki-module-types.js';
export { isBlokiGeneratorParams } from './bloki-module-types.js';
export { calculateLedPlan } from './led-engine.js';

export { ShelvesSubModule, buildShelvesPlan } from './shelves-adapter.js';
export { ShelfSubModule, buildShelfPlan } from './shelf-adapter.js';
export { DoorsSubModule, buildDoorsPlan } from './doors-adapter.js';
export { SkosneDoorsSubModule, buildSkosneDoorsPlan } from './skosne-doors-adapter.js';
export { CornerDoorsSubModule, buildCornerDoorsPlan, normalizeCornerOtwieranie } from './corner-doors-adapter.js';
export type { CornerOtwieranie } from './corner-doors-adapter.js';
export { TubesSubModule, buildTubesPlan } from './tubes-adapter.js';
export { DrawersSubModule, buildDrawersPlan } from './drawers-adapter.js';
export { DividersSubModule, buildDividersPlan } from './dividers-adapter.js';
export { PanelsSubModule, buildPanelsPlan } from './panels-adapter.js';
export { FlapsSubModule, buildFlapsPlan } from './flaps-adapter.js';
export { LedSubModule, buildLedPlan, LedInternalSubModule, buildLedInternalPlan, LedExternalSubModule, buildLedExternalPlan } from './led-adapter.js';

export { buildShelvesDrillings } from './shelves-drilling-builder.js';
export { buildDoorsDrillings } from './doors-drilling-builder.js';
export { buildSkosneDoorsDrillings } from './skosne-doors-drilling-builder.js';
export { buildDrawersDrillings } from './drawers-drilling-builder.js';
export { buildFlapsDrillings } from './flaps-drilling-builder.js';
export { buildTubesDrillings } from './tubes-drilling-builder.js';
