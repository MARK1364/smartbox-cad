/**
 * module-plans.ts — SSOT dla budowania planów modułów Bloki.
 * Czysta logika domenowa, zero zależności od Reacta / JSX.
 */
import { type ModuleDims, toDimensionsMm } from './base-engine.js';
import type { BlokiPlanResult } from './bloki-types.js';
import type {
    CornerDoorsPlanParams,
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
    TubesPlanParams
} from './bloki-module-types.js';

import { calculateShelvesPlan, normalizeShelvesParams } from './shelves-engine.js';
import { calculateShelfPlan, normalizeShelfParams } from './shelf-engine.js';
import { calculateDoorsPlan, normalizeDoorsParams } from './doors-engine.js';
import { calculateCornerDoorsPlan, normalizeCornerDoorsParams } from './corner-doors-engine.js';
import { calculateTubesPlan, normalizeTubesParams } from './tubes-engine.js';
import { calculateDrawersPlan, normalizeDrawersParams } from './drawers-engine.js';
import { calculateDividersPlan, normalizeDividersParams } from './dividers-engine.js';
import { calculatePanelsPlan, normalizePanelsParams } from './panels-engine.js';
import { calculateFlapsPlan, normalizeFlapsParams } from './flaps-engine.js';
import {
    calculateLedPlan,
    calculateLedInternalPlan,
    normalizeLedInternalParams,
    calculateLedExternalPlan,
    normalizeLedExternalParams
} from './led-engine.js';

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

export function buildCornerDoorsPlan(params: CornerDoorsPlanParams, dims: ModuleDims): BlokiPlanResult {
    const dims_mm = toDimensionsMm(dims);
    const normalized = normalizeCornerDoorsParams(params, dims_mm);
    if (!normalized) return { parts: [], hardware: [] };
    return calculateCornerDoorsPlan(dims_mm, normalized);
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
