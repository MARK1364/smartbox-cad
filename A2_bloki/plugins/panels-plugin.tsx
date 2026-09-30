/**
 * A2_bloki/plugins/panels-plugin.tsx
 *
 * Wtyczka modułu BLENDY / PANELE (PANELS).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { PanelsPlanParams } from '../bloki-module-types.js';
import { buildPanelsPlan } from '../module-plans.js';
import { PanelsSubModule } from '../panels-adapter.js';

export const panelsPlugin: SmartModulePlugin<PanelsPlanParams> = {
    id: 'PANELS',
    meta: {
        label: 'Blendy',
        labelKey: 'bloki.panels',
        description: 'Blendy i panele obudowy korpusu',
        category: 'external',
        order: 70,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="1" strokeDasharray="2 2" strokeOpacity="0.5" />
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <line x1="2" y1="2" x2="6" y2="6" />
                <line x1="22" y1="2" x2="18" y2="6" />
                <line x1="2" y1="22" x2="6" y2="18" />
                <line x1="22" y1="22" x2="18" y2="18" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildPanelsPlan(params, dims),
    getDefaultParams: () => ({
        grubosc_blendy_mm: 18,
        wlacz_lewy: true,
        wlacz_prawy: true
    }),
    UIComponent: PanelsSubModule
};
