/**
 * A2_bloki/plugins/corner-shelves-plugin.tsx
 *
 * Wtyczka modułu PÓŁKI NAROŻNE (CORNER_SHELVES).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { CornerShelvesPlanParams } from '../01_bloki-module-types.js';
import { buildCornerShelvesPlan } from '../01_module-plans.js';
import { CornerShelvesSubModule } from '../18_corner-shelves-adapter.js';
import { SyncShelfDrillingsCommand } from '../commands/sync-shelf-drillings-command.js';

export const cornerShelvesPlugin: SmartModulePlugin<CornerShelvesPlanParams> = {
    id: 'CORNER_SHELVES',
    meta: {
        label: 'Półki narożne',
        labelKey: 'bloki.corner_shelves',
        description: 'Półki L z podziałem równomiernym',
        category: 'internal',
        order: 12,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h7v16H4z" />
                <path d="M11 13h9v7h-9z" />
                <line x1="4" y1="12" x2="11" y2="12" />
                <line x1="11" y1="16" x2="20" y2="16" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildCornerShelvesPlan(params, dims),
    syncDrillings: (doc, cabinetId) => {
        new SyncShelfDrillingsCommand(cabinetId).execute(doc);
    },
    getDefaultParams: () => ({
        liczba_polek: 1,
        odsuniecie_przod_mm: 0,
        grubosc_polki_mm: 18,
        luz_boczny_mm: 0,
        wzor_nawiercen: 'SINGLE',
        odstep_otworow_przod_mm: 40,
        odstep_otworow_tyl_mm: 40,
        rozstaw_potrojny_z_mm: 32,
        rozstaw_system32_mm: 32,
        start_system32_z_mm: 150,
        liczba_otworow_system32: 10,
        wyciecie_listwa_narozna: true,
        listwa_narozna_szerokosc_mm: 100,
        listwa_narozna_grubosc_mm: 18,
        listwa_narozna_luz_mm: 1
    }),
    UIComponent: CornerShelvesSubModule
};
