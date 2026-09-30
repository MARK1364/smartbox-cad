/**
 * A2_bloki/plugins/led-external-plugin.tsx
 *
 * Wtyczka modułu LED ZEWNĘTRZNE (LED_EXTERNAL).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { LedExternalPlanParams } from '../bloki-module-types.js';
import { buildLedExternalPlan } from '../module-plans.js';
import { LedExternalSubModule } from '../led-external-adapter.js';
import { syncBlokiLedExternalGrooves } from '../led-external-engine.js';

export const ledExternalPlugin: SmartModulePlugin<LedExternalPlanParams> = {
    id: 'LED_EXTERNAL',
    meta: {
        label: 'Kanał LED',
        labelKey: 'bloki.led_external',
        description: 'Profil LED podszafkowy wpuszczany pod rzędem szafek',
        category: 'external',
        subCategory: 'LIGHTING',
        order: 100,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="13" rx="2" strokeOpacity="0.4" />
                <line x1="2" y1="19" x2="22" y2="19" strokeWidth="2.5" stroke="#60a5fa" />
                <circle cx="12" cy="19" r="2" fill="#fef08a" stroke="none" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildLedExternalPlan(params, dims),
    syncDrillings: (doc, _cabinetId, containerNode) => {
        if (containerNode) {
            syncBlokiLedExternalGrooves(containerNode, doc);
        }
    },
    getDefaultParams: () => ({
        szerokosc_wpustu_mm: 15,
        glebokosc_wpustu_mm: 10,
        odsuniecie_od_przodu_mm: 20
    }),
    UIComponent: LedExternalSubModule
};
