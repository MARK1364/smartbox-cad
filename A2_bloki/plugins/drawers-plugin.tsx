/**
 * A2_bloki/plugins/drawers-plugin.tsx
 *
 * Wtyczka modułu SZUFLADY (DRAWERS).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { DrawersPlanParams } from '../01_bloki-module-types.js';
import { buildDrawersPlan } from '../01_module-plans.js';
import { DrawersSubModule } from '../09_drawers-adapter.js';
import { SyncDrawerDrillingsCommand } from '../commands/sync-drawer-drillings-command.js';

export const drawersPlugin: SmartModulePlugin<DrawersPlanParams> = {
    id: 'DRAWERS',
    meta: {
        label: 'Szuflady',
        labelKey: 'bloki.drawers',
        description: 'Zestaw szuflad z prowadnicami',
        category: 'internal',
        subCategory: 'FRONT',
        order: 50,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="6" x2="15" y2="6" strokeWidth="2" />
                <line x1="9" y1="12" x2="15" y2="12" strokeWidth="2" />
                <line x1="9" y1="18" x2="15" y2="18" strokeWidth="2" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildDrawersPlan(params, dims),
    syncDrillings: (doc, cabinetId) => {
        new SyncDrawerDrillingsCommand(cabinetId).execute(doc);
    },
    getDefaultParams: () => ({
        liczba_szuflad: 3,
        grubosc_frontu_mm: 18,
        szczelina_wspolna_mm: 2
    }),
    UIComponent: DrawersSubModule
};
