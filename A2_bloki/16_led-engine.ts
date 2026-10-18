/**
 * led-engine.ts — fasada wstecznej kompatybilności dla modułów KANAŁ LED.
 * Przekierowuje do wyspecjalizowanych silników:
   */
import {
    syncBlokiLedInternalGrooves,
    normalizeLedInternalParams,
    calculateLedInternalPlan
} from './13_led-internal-engine.js';
import {
    syncBlokiLedExternalGrooves,
    normalizeLedExternalParams,
    calculateLedExternalPlan
} from './14_led-external-engine.js';
import type { BlokiDimensions_mm, BlokiPlanResult } from './01_bloki-types.js';
import type { LedPlanParams } from './01_bloki-module-types.js';

export {
    syncBlokiLedInternalGrooves,
    normalizeLedInternalParams,
    calculateLedInternalPlan
} from './13_led-internal-engine.js';
export {
    syncBlokiLedExternalGrooves,
    normalizeLedExternalParams,
    calculateLedExternalPlan
} from './14_led-external-engine.js';

export type LedModuleParams = LedPlanParams;

export function calculateLedPlan(dims_mm: BlokiDimensions_mm, params: LedPlanParams): BlokiPlanResult {
    const metadata = params as { category?: string; boxType?: string; type?: string };
    const isExternal = metadata.category === 'external' || metadata.boxType === 'LED_EXTERNAL' || metadata.type === 'blok_led_external';
    if (isExternal) {
        const norm = normalizeLedExternalParams(params, dims_mm);
        return calculateLedExternalPlan(dims_mm, norm);
    }
    const norm = normalizeLedInternalParams(params, dims_mm);
    return calculateLedInternalPlan(dims_mm, norm);
}


export function syncBlokiLedGrooves(containerNode: any, doc: any): void {
    if (!containerNode || !doc) return;
    const container = containerNode.domainData || containerNode;
    const p = container.generatorParams || {};
    const isExternal = p.boxType === 'LED_EXTERNAL' || p.category === 'external' || p.type === 'blok_led_external';

    if (isExternal) {
        syncBlokiLedExternalGrooves(containerNode, doc);
    } else {
        syncBlokiLedInternalGrooves(containerNode, doc);
    }
}
