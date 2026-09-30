/**
 * A2_bloki/plugins/doors-plugin.tsx
 *
 * Wtyczka modułu DRZWI / FRONTY (DOORS).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { DoorsPlanParams } from '../bloki-module-types.js';
import { buildDoorsPlan } from '../module-plans.js';
import { DoorsSubModule } from '../doors-adapter.js';
import { SyncDoorDrillingsCommand } from '../commands/sync-door-drillings-command.js';

export const doorsPlugin: SmartModulePlugin<DoorsPlanParams> = {
    id: 'DOORS',
    meta: {
        label: 'Drzwi',
        labelKey: 'bloki.doors',
        description: 'Fronty pojedyncze lub podwójne',
        category: 'internal',
        subCategory: 'FRONT',
        order: 30,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2 2" />
                <circle cx="8" cy="12" r="1.2" fill={c} />
                <circle cx="16" cy="12" r="1.2" fill={c} />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildDoorsPlan(params, dims),
    syncDrillings: (doc, cabinetId) => {
        new SyncDoorDrillingsCommand(cabinetId).execute(doc);
    },
    getDefaultParams: () => ({
        rodzaj_drzwi: 'LEFT',
        grubosc_frontu_mm: 18,
        szczelina_mm: 2
    }),
    UIComponent: DoorsSubModule
};
