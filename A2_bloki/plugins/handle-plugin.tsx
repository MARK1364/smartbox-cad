/**
 * A2_bloki/plugins/handle-plugin.tsx
 *
 * Wtyczka UCHWYTY (HANDLES) — silnik w A2_bloki/handles/ (jak drawers-engine).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { HandlePlanParams } from '../bloki-module-types.js';
import { HandleEditPanel } from '../handles/handle-edit-panel.js';

export const handlePlugin: SmartModulePlugin<HandlePlanParams> = {
    id: 'HANDLES',
    meta: {
        label: 'Uchwyty',
        labelKey: 'bloki.handles',
        description: 'Uchwyt meblowy na płycie frontu',
        category: 'panel',
        order: 90,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" strokeDasharray="3 3" strokeOpacity="0.4" />
                <path d="M7 12h10" strokeWidth="2.4" />
                <circle cx="7" cy="12" r="1.5" fill={c} />
                <circle cx="17" cy="12" r="1.5" fill={c} />
            </svg>
        )
    },
    buildPlan: (_params, _dims) => ({ parts: [], hardware: [] }),
    getDefaultParams: () => ({
        totalLengthMm: 160,
        holeDistanceMm: 128,
        orientation: 'HORIZONTAL'
    }),
    UIComponent: ({ container }) => <HandleEditPanel container={container} />
};
