/**
 * A2_bloki/plugins/flaps-plugin.tsx
 *
 * Wtyczka modułu KLAPY (FLAPS).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { FlapsPlanParams } from '../01_bloki-module-types.js';
import { buildFlapsPlan } from '../01_module-plans.js';
import { FlapsSubModule } from '../12_flaps-adapter.js';
import { SyncFlapsDrillingsCommand } from '../commands/sync-flaps-drillings-command.js';

export const flapsPlugin: SmartModulePlugin<FlapsPlanParams> = {
    id: 'FLAPS',
    meta: {
        label: 'Klapy',
        labelKey: 'bloki.flaps',
        description: 'Klapy uchylne podnośnikowe',
        category: 'internal',
        subCategory: 'FRONT',
        order: 80,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeOpacity="0.4" />
                <path d="M4 14l16-6" />
                <path d="M12 8l3-2-1 4" fill={c} />
                <circle cx="5" cy="14" r="1.5" fill={c} />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildFlapsPlan(params, dims),
    syncDrillings: (doc, cabinetId) => {
        new SyncFlapsDrillingsCommand(cabinetId).execute(doc);
    },
    getDefaultParams: () => ({
        kierunek_klapy: 'TOP',
        grubosc_frontu_mm: 18,
        szczelina_mm: 2
    }),
    UIComponent: FlapsSubModule
};
