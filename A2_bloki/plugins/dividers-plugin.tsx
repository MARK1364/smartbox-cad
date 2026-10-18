/**
 * A2_bloki/plugins/dividers-plugin.tsx
 *
 * Wtyczka modułu PRZEGRODY (DIVIDERS).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { DividersPlanParams } from '../01_bloki-module-types.js';
import { buildDividersPlan } from '../01_module-plans.js';
import { DividersSubModule } from '../10_dividers-adapter.js';

export const dividersPlugin: SmartModulePlugin<DividersPlanParams> = {
    id: 'DIVIDERS',
    meta: {
        label: 'Przegrody',
        labelKey: 'bloki.dividers',
        description: 'Pionowe przegrody wnęki',
        category: 'internal',
        order: 60,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="10" y1="3" x2="10" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildDividersPlan(params, dims),
    getDefaultParams: () => ({
        liczba_przegrod: 1,
        grubosc_przegrody_mm: 18
    }),
    UIComponent: DividersSubModule
};
