/**
 * module-plans.ts — SSOT dla budowania planów modułów Bloki.
 * Czysta logika domenowa, zero zależności od Reacta / JSX.
 */
import { type ModuleDims, toDimensionsMm } from './01_base-engine.js';
import type { BlokiPlanResult } from './01_bloki-types.js';
import type {
    CornerDoorsPlanParams,
    CornerShelvesPlanParams,
    DividersPlanParams,
    DoorsPlanParams,
    DrawersPlanParams,
    FlapsPlanParams,
    LedExternalPlanParams,
    LedInternalPlanParams,
    LedPlanParams,
    PanelsPlanParams,
    ShelfPlanParams,
    ShelvesPlanParams,
    SkosneDoorsPlanParams,
    TubesPlanParams
} from './01_bloki-module-types.js';

import { calculateShelvesPlan, normalizeShelvesParams } from './04_shelves-engine.js';
import { calculateShelfPlan, normalizeShelfParams } from './03_shelf-engine.js';
import { calculateDoorsPlan, normalizeDoorsParams } from './05_doors-engine.js';
import {
    calculateSkosneDoorsPlan,
    normalizeSkosneDoorsParams
} from './06_skosne-doors-engine.js';
import { calculateCornerDoorsPlan, normalizeCornerDoorsParams } from './07_corner-doors-engine.js';
import { calculateCornerShelvesPlan, normalizeCornerShelvesParams } from './18_corner-shelves-engine.js';
import { calculateTubesPlan, normalizeTubesParams } from './08_tubes-engine.js';
import { calculateDrawersPlan, normalizeDrawersParams } from './09_drawers-engine.js';
import { calculateDividersPlan, normalizeDividersParams } from './10_dividers-engine.js';
import { calculatePanelsPlan, normalizePanelsParams } from './11_panels-engine.js';
import { calculateFlapsPlan, normalizeFlapsParams } from './12_flaps-engine.js';
import {
    calculateLedPlan,
    calculateLedInternalPlan,
    normalizeLedInternalParams,
    calculateLedExternalPlan,
    normalizeLedExternalParams
} from './16_led-engine.js';
import type { HangersPlanParams } from './17_hangers-types.js';
import { calculateHangersPlan, normalizeHangersParams } from './17_hangers-engine.js';

export function buildShelvesPlan(params: ShelvesPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeShelvesParams(params, dims_mm);
    return calculateShelvesPlan(dims_mm, normalized);
}

export function buildShelfPlan(params: ShelfPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeShelfParams(params, dims_mm);
    return calculateShelfPlan(dims_mm, normalized);
}

export function buildDoorsPlan(params: DoorsPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeDoorsParams(params, dims_mm);
    return calculateDoorsPlan(dims_mm, normalized);
}

export function buildSkosneDoorsPlan(params: SkosneDoorsPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeSkosneDoorsParams(params, dims_mm);
    if (!normalized) return { parts: [], hardware: [] };
    return calculateSkosneDoorsPlan(dims_mm, normalized);
}

export function buildCornerDoorsPlan(params: CornerDoorsPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeCornerDoorsParams(params, dims_mm);
    if (!normalized) return { parts: [], hardware: [] };
    return calculateCornerDoorsPlan(dims_mm, normalized);
}

export function buildCornerShelvesPlan(params: CornerShelvesPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeCornerShelvesParams(params, dims_mm);
    return calculateCornerShelvesPlan(dims_mm, normalized);
}

export function buildTubesPlan(params: TubesPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeTubesParams(params, dims_mm);
    return calculateTubesPlan(dims_mm, normalized);
}

export function buildDrawersPlan(params: DrawersPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeDrawersParams(params, dims_mm);
    return calculateDrawersPlan(dims_mm, normalized);
}

export function buildDividersPlan(params: DividersPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeDividersParams(params, dims_mm);
    return calculateDividersPlan(dims_mm, normalized);
}

export function buildPanelsPlan(params: PanelsPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizePanelsParams(params, dims_mm);
    return calculatePanelsPlan(dims_mm, normalized);
}

export function buildFlapsPlan(params: FlapsPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeFlapsParams(params, dims_mm);
    return calculateFlapsPlan(dims_mm, normalized);
}

export function buildLedInternalPlan(params: LedInternalPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeLedInternalParams(params, dims_mm);
    return calculateLedInternalPlan(dims_mm, normalized);
}

export function buildLedExternalPlan(params: LedExternalPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeLedExternalParams(params, dims_mm);
    return calculateLedExternalPlan(dims_mm, normalized);
}

export function buildLedPlan(params: LedPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    return calculateLedPlan(dims_mm, params);
}

export function buildHangersPlan(params: HangersPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeHangersParams(params, dims_mm);
    return calculateHangersPlan(dims_mm, normalized);
}
