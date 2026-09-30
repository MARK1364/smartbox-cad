/**
 * led-adapter.tsx — fasada wstecznej kompatybilności dla adapterów UI modułów KANAŁ LED.
 * Przekierowuje do:
 * - LedInternalSubModule / buildLedInternalPlan (w ./led-internal-adapter.js)
 * - LedExternalSubModule / buildLedExternalPlan (w ./led-external-adapter.js)
 */

import React from 'react';
import { calculateLedPlan, type LedModuleParams } from './led-engine.js';
import type { ModuleDims } from './base-engine.js';
import { LedInternalSubModule, buildLedInternalPlan } from './led-internal-adapter.js';
import { LedExternalSubModule, buildLedExternalPlan } from './led-external-adapter.js';
import type { LedExternalPlanParams, LedInternalPlanParams } from './bloki-module-types.js';

export { LedInternalSubModule, buildLedInternalPlan } from './led-internal-adapter.js';
export { LedExternalSubModule, buildLedExternalPlan } from './led-external-adapter.js';

export { buildLedPlan } from './module-plans.js';

import type { ContainerModel } from '../A1_core/container-model.js';

export function LedSubModule({ container, triggerUpdate }: { container: ContainerModel; triggerUpdate: (params: Partial<LedInternalPlanParams> | Partial<LedExternalPlanParams>) => void }) {
    const p = container?.generatorParams || {};
    const isExternal = p.category === 'external' || p.boxType === 'LED_EXTERNAL' || p.type === 'blok_led_external';

    if (isExternal) {
        return <LedExternalSubModule container={container} triggerUpdate={triggerUpdate} />;
    }
    return <LedInternalSubModule container={container} triggerUpdate={triggerUpdate} />;
}
