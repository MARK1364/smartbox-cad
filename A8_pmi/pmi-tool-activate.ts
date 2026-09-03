/**
 * Wspólna aktywacja narzędzia wymiarowania — panel PMI i pasek narzędzi
 * korzystają z tego samego źródła ustawień (PMIStore).
 */

import type { StateMachine } from '../A1_core/interaction/state-machine.js';
import { PMIStore } from './pmi-data.js';
import type { DimensionTool } from './pmi-tool.js';

const DIMENSION_STATE_NAMES = ['DIMENSION_TOOL', 'DimensionTool'] as const;

export function getDimensionTool(sm: StateMachine): DimensionTool | null {
    for (const name of DIMENSION_STATE_NAMES) {
        const tool = sm.getState(name);
        if (tool) return tool as DimensionTool;
    }
    return null;
}

export function isDimensionToolActive(sm: StateMachine): boolean {
    const name = sm.getCurrentStateName();
    return name === 'DIMENSION_TOOL' || name === 'DimensionTool';
}

export function isMeasureToolActive(sm: StateMachine): boolean {
    const name = sm.getCurrentStateName();
    return name === 'MEASURE_TOOL' || name === 'MeasureTool';
}

/** Włącza narzędzie z ustawieniami z PMIStore (axisSpace, measureAxis). */
export function activateDimensionTool(sm: StateMachine): void {
    const store = PMIStore.instance;
    const tool = getDimensionTool(sm);
    tool?.setAxisSpace(store.toolAxisSpace);
    tool?.setMeasureAxis(store.toolMeasureAxis);
    sm.changeState('DIMENSION_TOOL');
}

export function activateMeasureTool(sm: StateMachine): void {
    sm.changeState('MEASURE_TOOL');
}

/** Wyłącza narzędzie tworzenia wymiaru / pomiaru. */
export function deactivateDimensionTool(sm: StateMachine): void {
    sm.changeState('SELECTION_TOOL');
}

/** Przełącza narzędzie tworzenia wymiaru. */
export function toggleDimensionTool(sm: StateMachine): void {
    if (isDimensionToolActive(sm)) {
        deactivateDimensionTool(sm);
    } else {
        activateDimensionTool(sm);
    }
}
