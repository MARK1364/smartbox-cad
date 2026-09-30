/**
 * A2_bloki/plugins/led-internal-plugin.tsx
 *
 * Wtyczka modułu LED WEWNĘTRZNE (LED_INTERNAL).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { LedInternalPlanParams } from '../bloki-module-types.js';
import { buildLedInternalPlan } from '../module-plans.js';
import { LedInternalSubModule } from '../led-internal-adapter.js';
import { syncBlokiLedInternalGrooves } from '../led-internal-engine.js';

export const ledInternalPlugin: SmartModulePlugin<LedInternalPlanParams> = {
    id: 'LED_INTERNAL',
    meta: {
        label: 'Kanał LED (wewn)',
        labelKey: 'bloki.led_internal',
        description: 'Profil LED pionowy/poziomy we wnęce',
        category: 'internal',
        subCategory: 'LIGHTING',
        order: 90,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeOpacity="0.4" />
                <line x1="12" y1="3" x2="12" y2="21" strokeWidth="2.5" stroke="#60a5fa" />
                <circle cx="12" cy="12" r="2" fill="#fef08a" stroke="none" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildLedInternalPlan(params, dims),
    syncDrillings: (doc, _cabinetId, containerNode) => {
        if (containerNode) {
            syncBlokiLedInternalGrooves(containerNode, doc);
        }
    },
    getDefaultParams: () => ({
        szerokosc_wpustu_mm: 15,
        glebokosc_wpustu_mm: 10,
        odsuniecie_od_przodu_mm: 20
    }),
    UIComponent: LedInternalSubModule
};
