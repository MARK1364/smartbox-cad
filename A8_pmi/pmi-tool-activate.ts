/**
 * Wspólna aktywacja narzędzia wymiarowania — panel PMI i pasek narzędzi
 * korzystają z tego samego źródła ustawień (PMIStore).
 */

import type { StateMachine } from '../A1_core/interaction/state-machine.js';
import { PMIStore } from './pmi-data.js';
import type { DimensionTool } from './pmi-tool.js';

export const DIMENSION_TOOL_STATE = 'DIMENSION_TOOL';
export const MEASURE_TOOL_STATE = 'MEASURE_TOOL';
export const DIMENSION_EDIT_TOOL_STATE = 'DIMENSION_EDIT_TOOL';
export const DIMENSION_TEXT_SHIFT_TOOL_STATE = 'DIMENSION_TEXT_SHIFT_TOOL';

const PMI_CANONICAL_STATES = new Set<string>([
    DIMENSION_TOOL_STATE,
    MEASURE_TOOL_STATE,
    DIMENSION_EDIT_TOOL_STATE,
    DIMENSION_TEXT_SHIFT_TOOL_STATE,
    'PMI_EDIT_TOOL',
    'PMI_TEXT_SHIFT_TOOL',
]);

export function getDimensionTool(sm: StateMachine): DimensionTool | null {
    return (sm.getState(DIMENSION_TOOL_STATE) as DimensionTool) ?? null;
}

export function isDimensionToolActive(sm: StateMachine): boolean {
    return sm.getCurrentStateName() === DIMENSION_TOOL_STATE;
}

export function isMeasureToolActive(sm: StateMachine): boolean {
    return sm.getCurrentStateName() === MEASURE_TOOL_STATE;
}

/** Włącza narzędzie z ustawieniami z PMIStore (axisSpace, measureAxis). */
export function activateDimensionTool(sm: StateMachine): void {
    const store = PMIStore.instance;
    const tool = getDimensionTool(sm);
    tool?.setAxisSpace(store.toolAxisSpace);
    tool?.setMeasureAxis(store.toolMeasureAxis);
    sm.changeState(DIMENSION_TOOL_STATE);
}

export function activateMeasureTool(sm: StateMachine): void {
    sm.changeState(MEASURE_TOOL_STATE);
}

export function isPmiToolActive(sm?: StateMachine | null): boolean {
    if (!sm) return false;
    const name = sm.getCurrentStateName?.() || '';
    return PMI_CANONICAL_STATES.has(name);
}

/** Wyłącza narzędzie tworzenia wymiaru / pomiaru. */
export function deactivateDimensionTool(sm: StateMachine): void {
    PMIStore.instance.clearAllMeasurements();
    sm.changeState('SELECTION_TOOL');
}

/** Uniwersalne wyłączenie wszelkich aktywnych narzędzi PMI i powrót do SELECTION_TOOL. */
export function deactivateAllPmiTools(sm?: StateMachine | null): void {
    PMIStore.instance.clearAllMeasurements();
    if (!sm) return;
    if (isPmiToolActive(sm)) {
        sm.changeState('SELECTION_TOOL');
    }
}

/** Przełącza narzędzie tworzenia wymiaru. */
export function toggleDimensionTool(sm: StateMachine): void {
    if (isDimensionToolActive(sm)) {
        deactivateDimensionTool(sm);
    } else {
        activateDimensionTool(sm);
    }
}

