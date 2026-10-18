/**
 * A2_bloki/plugins/shelves-plugin.tsx
 *
 * Wtyczka modułu PÓŁKI (SHELVES).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { ShelvesPlanParams } from '../01_bloki-module-types.js';
import { buildShelvesPlan } from '../01_module-plans.js';
import { ShelvesSubModule } from '../04_shelves-adapter.js';
import { SyncShelfDrillingsCommand } from '../commands/sync-shelf-drillings-command.js';

export const shelvesPlugin: SmartModulePlugin<ShelvesPlanParams> = {
    id: 'SHELVES',
    meta: {
        label: 'Półki',
        labelKey: 'bloki.shelves',
        description: 'Półki z podziałem równomiernym',
        category: 'internal',
        order: 10,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildShelvesPlan(params, dims),
    syncDrillings: (doc, cabinetId) => {
        new SyncShelfDrillingsCommand(cabinetId).execute(doc);
    },
    getDefaultParams: () => ({
        liczba_polek: 2,
        odsuniecie_przod_mm: 10,
        grubosc_polki_mm: 18
    }),
    UIComponent: ShelvesSubModule
};
