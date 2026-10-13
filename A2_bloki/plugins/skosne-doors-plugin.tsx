/**
 * A2_bloki/plugins/skosne-doors-plugin.tsx
 *
 * Wtyczka modułu DRZWI SKOŚNE (SKOSNE_DOORS).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { SkosneDoorsPlanParams } from '../bloki-module-types.js';
import { buildSkosneDoorsPlan } from '../module-plans.js';
import { SkosneDoorsSubModule } from '../skosne-doors-adapter.js';
import { SyncSkosneDoorsDrillingsCommand } from '../commands/sync-skosne-doors-drillings-command.js';

export const skosneDoorsPlugin: SmartModulePlugin<SkosneDoorsPlanParams> = {
    id: 'SKOSNE_DOORS',
    meta: {
        label: 'Drzwi skośne',
        labelKey: 'bloki.skosne_doors',
        description: 'Front trapezowy — dół prosty, góra pochylona',
        category: 'internal',
        subCategory: 'FRONT',
        order: 32,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16v4H4z" />
                <path d="M4 10l8 10h8" />
                <path d="M7 10v10" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildSkosneDoorsPlan(params, dims),
    syncDrillings: (doc, cabinetId) => {
        new SyncSkosneDoorsDrillingsCommand(cabinetId).execute(doc);
    },
    getDefaultParams: () => ({
        rodzaj_drzwi: 'LEFT',
        grubosc_frontu_mm: 18
    }),
    UIComponent: SkosneDoorsSubModule
};