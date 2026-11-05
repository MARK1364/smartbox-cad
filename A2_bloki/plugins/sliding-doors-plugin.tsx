/**
 * A2_bloki/plugins/sliding-doors-plugin.tsx
 *
 * Wtyczka modułu DRZWI PRZESUWNE (SLIDING_DOORS).
 * Standard Sevroll: tor górny i dolny podwójny, profile rączek aluminiowych na pełną
 * wysokość po lewej i prawej stronie każdego skrzydła, mijanie się w osi Y,
 * wyliczanie domyślnej liczby skrzydeł z szerokości wnęki.
 *
 * Faza 1: wszystkie elementy (skrzydła, tor, rolki, rączki) są boxami (placeholder).
 * Faza 2: rolki/rączki → HARDWARE + GLB (hardware-loader), tor/profile →
 * parametryczna ekstruzja przekroju 2D (polygon-extrusion / alu-frame-profile).
 */

import React from 'react';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import type { SlidingDoorsPlanParams } from '../01_bloki-module-types.js';
import { buildSlidingDoorsPlan } from '../01_module-plans.js';
import { SlidingDoorsSubModule } from '../19_sliding-doors-adapter.js';
import { calculateDefaultSlidingDoorsCount } from '../19_sliding-doors-engine.js';
import { toDimensionsMm } from '../01_base-engine.js';

export const slidingDoorsPlugin: SmartModulePlugin<SlidingDoorsPlanParams> = {
    id: 'SLIDING_DOORS',
    meta: {
        label: 'Drzwi przesuwne',
        labelKey: 'bloki.sliding_doors',
        description: 'Skrzydła przesuwne w torze górnym/dolnym (standard Sevroll)',
        category: 'internal',
        subCategory: 'FRONT',
        order: 33,
        renderIcon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                {/* Tor górny */}
                <line x1="3" y1="6.5" x2="21" y2="6.5" />
                {/* Tor dolny */}
                <line x1="3" y1="17.5" x2="21" y2="17.5" />
                {/* Skrzydła mijające się */}
                <line x1="8" y1="6.5" x2="8" y2="17.5" />
                <line x1="16" y1="6.5" x2="16" y2="17.5" />
                {/* Profile rączek po bokach */}
                <line x1="4.5" y1="6.5" x2="4.5" y2="17.5" strokeWidth="1" />
                <line x1="11.5" y1="6.5" x2="11.5" y2="17.5" strokeWidth="1" />
                <line x1="12.5" y1="6.5" x2="12.5" y2="17.5" strokeWidth="1" />
                <line x1="19.5" y1="6.5" x2="19.5" y2="17.5" strokeWidth="1" />
            </svg>
        )
    },
    buildPlan: (params, dims) => buildSlidingDoorsPlan(params, dims),
    // Faza 1: brak nawierceń (rolki tylko wizualne + raport materiałowy).
    // Faza 2: SyncSlidingDoorsDrillingsCommand (otwory montażowe toru w ścianie/wieńcu).
    // syncDrillings: (doc, cabinetId) => { new SyncSlidingDoorsDrillingsCommand(cabinetId).execute(doc); },
    getDefaultParams: (dims) => {
        const dims_mm = dims ? toDimensionsMm(dims) : undefined;
        const defaultLeaves = dims_mm ? calculateDefaultSlidingDoorsCount(dims_mm.width_mm) : 2;
        return {
            liczba_skrzydel: defaultLeaves,
            grubosc_frontu_mm: 18,
            szczelina_mm: 4,
            zaklad: 1,
            zakladka_mm: 30,
            nalozenie_gora_mm: 0,
            nalozenie_dol_mm: 0,
            nalozenie_lewe_mm: 0,
            nalozenie_prawe_mm: 0,
            typ_rolki: 'BOTTOM',
            producent_rolek: 'SEVROLL',
            roller_id: 'SEVROLL_GEMINI_ROLLER',
            handle_id: 'SEVROLL_ALFA_HANDLE',
            tor_gorny_wysokosc_mm: 40,
            tor_gorny_glebokosc_mm: 75,
            tor_gorny_cofniecie_mm: 0,
            tor_dolny_wysokosc_mm: 10,
            tor_dolny_glebokosc_mm: 60,
            tor_dolny_cofniecie_mm: 0,
            rozstaw_torow_mm: 35,
            szerokosc_raczki_mm: 25,
            grubosc_raczki_mm: 28,
            pokaz_rolki: true,
            pokaz_raczki: true
        };
    },
    UIComponent: SlidingDoorsSubModule
};
