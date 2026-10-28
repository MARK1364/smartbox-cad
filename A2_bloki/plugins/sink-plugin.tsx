/**
 * A2_bloki/plugins/sink-plugin.tsx
 *
 * Wtyczka ZLEW (SINKS) — moduł montowany na formatce (blacie) z wycięciem w płycie (kategoria 'panel').
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import { SinkEditPanel } from '../sinks/sink-edit-panel.js';
import { DEFAULT_SINK_PARAMS } from '../sinks/sink-types.js';

export const sinkPlugin: SmartModulePlugin<any> = {
    id: 'SINKS',
    meta: {
        label: 'Zlew',
        labelKey: 'bloki.sinks',
        description: 'Zlew nakładany na blacie z wycięciem w płycie',
        category: 'panel',
        order: 95,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <rect x="5" y="7" width="14" height="10" rx="1" fill={c} fillOpacity="0.15" />
                <circle cx="12" cy="12" r="1.5" fill={c} />
            </svg>
        )
    },
    buildPlan: (_params, _dims) => ({ parts: [], hardware: [] }),
    getDefaultParams: () => DEFAULT_SINK_PARAMS,
    UIComponent: ({ container }) => <SinkEditPanel container={container} />
};
