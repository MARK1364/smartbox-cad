/**
 * A2_bloki/plugins/shelf-plugin.tsx
 *
 * Wtyczka modułu WIENIEC / PÓŁKA STAŁA (SHELF).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { ShelfPlanParams } from '../01_bloki-module-types.js';
import { buildShelfPlan } from '../01_module-plans.js';
import { ShelfSubModule } from '../03_shelf-adapter.js';

export const shelfPlugin: SmartModulePlugin<ShelfPlanParams> = {
    id: 'SHELF',
    meta: {
        label: 'Wieniec',
        labelKey: 'bloki.shelf',
        description: 'Pojedyncza półka / wieniec poziomy',
        category: 'internal',
        order: 20,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeOpacity="0.4" />
                <rect x="3" y="11" width="18" height="3" fill={c} fillOpacity="0.25" stroke={c} />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildShelfPlan(params, dims),
    getDefaultParams: () => ({
        grubosc_wienca_mm: 18,
        odsuniecie_przod_mm: 0
    }),
    UIComponent: ShelfSubModule
};
