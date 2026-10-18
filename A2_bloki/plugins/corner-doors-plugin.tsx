/**
 * A2_bloki/plugins/corner-doors-plugin.tsx
 *
 * Wtyczka modułu DRZWI NAROŻNE (CORNER_DOORS).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { CornerDoorsPlanParams } from '../01_bloki-module-types.js';
import { buildCornerDoorsPlan } from '../01_module-plans.js';
import { CornerDoorsSubModule } from '../07_corner-doors-adapter.js';

export const cornerDoorsPlugin: SmartModulePlugin<CornerDoorsPlanParams> = {
    id: 'CORNER_DOORS',
    meta: {
        label: 'Drzwi narożne',
        labelKey: 'bloki.corner_doors',
        description: 'Dwa skrzydła L 90° — zawiasy w fudze',
        category: 'internal',
        subCategory: 'FRONT',
        order: 35,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h8v16H4z" />
                <path d="M12 12h8v8H12z" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildCornerDoorsPlan(params, dims),
    getDefaultParams: () => ({
        grubosc_frontu_mm: 18,
        szczelina_srodkowa_mm: 2
    }),
    UIComponent: CornerDoorsSubModule
};
