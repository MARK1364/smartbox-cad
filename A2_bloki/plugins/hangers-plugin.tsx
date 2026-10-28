/**
 * A2_bloki/plugins/hangers-plugin.tsx
 *
 * Wtyczka dedykowanego modułu ZAWIESZKI (HANGERS) w systemie Bloki.
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { HangersPlanParams } from '../17_hangers-types.js';
import { buildHangersPlan } from '../01_module-plans.js';
import { HangersSubModule } from '../17_hangers-adapter.js';
import { SyncHangersDrillingsCommand } from '../commands/sync-hangers-drillings-command.js';

export const hangersPlugin: SmartModulePlugin<HangersPlanParams> = {
    id: 'HANGERS',
    meta: {
        label: 'Zawieszki',
        labelKey: 'bloki.hangers',
        description: 'Zawieszki meblowe korpusu szafki ze Studia',
        category: 'internal',
        subCategory: 'ACCESSORY',
        order: 95,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="2 2" strokeOpacity="0.4" />
                <path d="M7 6v6h4V6" strokeWidth="2" />
                <circle cx="9" cy="9" r="1.5" fill={c} />
                <path d="M17 6v6h-4V6" strokeWidth="2" />
                <circle cx="15" cy="9" r="1.5" fill={c} />
            </svg>
        ),
    },
    buildPlan: (params, dims) => buildHangersPlan(params, dims),
    syncDrillings: (doc, cabinetId) => {
        new SyncHangersDrillingsCommand(cabinetId).execute(doc);
    },
    getDefaultParams: () => ({
        szablon_id: 'zawieszka_camaro',
        zestaw_id: '',
        odsuniecie_bok_mm: 0,
        odsuniecie_tyl_mm: 0,
        odsuniecie_gora_mm: 0,
        parametry_zestawu: {},
    }),
    UIComponent: HangersSubModule,
};
