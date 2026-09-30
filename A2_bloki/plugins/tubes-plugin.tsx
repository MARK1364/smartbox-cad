/**
 * A2_bloki/plugins/tubes-plugin.tsx
 *
 * Wtyczka modułu DRĄŻEK (TUBES).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { TubesPlanParams } from '../bloki-module-types.js';
import { buildTubesPlan } from '../module-plans.js';
import { TubesSubModule } from '../tubes-adapter.js';
import { SyncTubesDrillingsCommand } from '../commands/sync-tubes-drillings-command.js';

export const tubesPlugin: SmartModulePlugin<TubesPlanParams> = {
    id: 'TUBES',
    meta: {
        label: 'Drążek',
        labelKey: 'bloki.tubes',
        description: 'Drążek ubraniowy z rozetami',
        category: 'internal',
        subCategory: 'ACCESSORY',
        order: 40,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeOpacity="0.4" />
                <line x1="3" y1="8" x2="21" y2="8" strokeWidth="2.5" />
                <path d="M12 8v3l-4 6h8l-4-6" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildTubesPlan(params, dims),
    syncDrillings: (doc, cabinetId) => {
        new SyncTubesDrillingsCommand(cabinetId).execute(doc);
    },
    getDefaultParams: () => ({
        srednica_drazka_mm: 25,
        odstep_gora_mm: 50
    }),
    UIComponent: TubesSubModule
};
