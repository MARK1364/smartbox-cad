/**
 * shelf-engine.ts — moduł WIENIEC (blok_shelf)
 *
 * Czysta architektura funkcyjna (Functional Core) sprzyjająca agentom AI:
 *  - Wyraźne typy DTO ze sprecyzowanymi jednostkami fizycznymi (_mm).
 *  - Czyste funkcje kalkulacji geometrii bez ukrytego stanu (pure functions).
 *  - Zgodność z .agents/AGENTS.md (role 'SHELF_BOARD', nodeType 'PART', jednostki mm w planowaniu).
 *  - SSOT parametrów: A2_bloki/01_BLOKI_PARAMETERS.md
 */

import shelfRules from './03_shelf_3_rules_V1.json';
import { resolveRuleThicknessMm } from './01_bloki-rules-helper.js';
import { type ModuleDims } from './01_base-engine.js';
import type {
    BlokiDimensions_mm,
    BlokiPlanResult,
    BlokiPart
} from './01_bloki-types.js';
import type { ShelfPlanParams } from './01_bloki-module-types.js';
import {
    assertCanonicalShelfParams,
    readOptionalNumber
} from './01_bloki-module-param-guards.js';

export { assertCanonicalShelfParams, LEGACY_SHELF_PARAM_ALIASES } from './01_bloki-module-param-guards.js';

// ─── Typy Domenowe Wieńca ──────────────────────────────────────────────────────

export interface NormalizedShelfParams {
    grubosc_wienca_mm: number;
    odsuniecie_przod_mm: number;
    odsuniecie_tyl_mm: number;
    luz_boczny_mm: number;
    baza_odniesienia: 'top' | 'bottom';
    odstep_gora_mm: number;
    odstep_dol_mm: number;
}

// ─── Czyste Funkcje Pomocnicze ────────────────────────────────────────────────

/**
 * Normalizuje parametry wejściowe do spójnego DTO. Tylko klucze kanoniczne.
 */
export function normalizeShelfParams(
    raw: ShelfPlanParams = {},
    dims?: BlokiDimensions_mm
): NormalizedShelfParams {
    assertCanonicalShelfParams(raw);
    const input = raw as Record<string, unknown>;
    const defaultThickness_mm = resolveRuleThicknessMm(shelfRules, ['SHELF', 'SHELF_BOARD'], 'thickness', 'shelf');

    const grubosc_wienca_mm = readOptionalNumber(input, 'grubosc_wienca_mm') ?? defaultThickness_mm;
    const odsuniecie_przod_mm = readOptionalNumber(input, 'odsuniecie_przod_mm') ?? 0;
    const odsuniecie_tyl_mm = readOptionalNumber(input, 'odsuniecie_tyl_mm') ?? 0;
    const luz_boczny_mm = readOptionalNumber(input, 'luz_boczny_mm') ?? 0;

    const isRefTop = input.baza_odniesienia === 'top' || (
        input.odstep_gora_mm !== undefined && input.odstep_dol_mm === undefined
    );
    const baza_odniesienia: 'top' | 'bottom' = isRefTop ? 'top' : 'bottom';

    const odstep_gora_mm = readOptionalNumber(input, 'odstep_gora_mm') ?? 100;
    const odstep_dol_mm = readOptionalNumber(input, 'odstep_dol_mm') ?? 100;

    return {
        grubosc_wienca_mm,
        odsuniecie_przod_mm,
        odsuniecie_tyl_mm,
        luz_boczny_mm,
        baza_odniesienia,
        odstep_gora_mm,
        odstep_dol_mm
    };
}

// ─── Czysta Funkcja Kalkulacji Planu Wieńca ───────────────────────────────────

/**
 * Czysta funkcja matematyczna generująca formatkę wieńca.
 * Zero stanu, zero zależności od sceny/DOM/Babylon.
 */
export function calculateShelfPlan(
    dims: BlokiDimensions_mm,
    params: NormalizedShelfParams
): BlokiPlanResult {
    const parts: BlokiPart[] = [];
    const shelfRule = (shelfRules as any).model_tree?.root_assembly?.subcomponents?.SHELF;

    const {
        width_mm: szerokosc_strefy_mm,
        height_mm: wysokosc_strefy_mm,
        depth_mm: glebokosc_strefy_mm
    } = dims;

    const {
        grubosc_wienca_mm,
        odsuniecie_przod_mm,
        odsuniecie_tyl_mm,
        luz_boczny_mm,
        baza_odniesienia,
        odstep_gora_mm,
        odstep_dol_mm
    } = params;

    // Matematyka pozycjonowania Z:
    // 'top' -> przestrzeń od górnego sufitu kontenera (height) do górnego lica wieńca
    // 'bottom' (domyślnie) -> przestrzeń od dolnego dna kontenera (0) do dolnego lica wieńca
    let srodek_z_mm: number;
    if (baza_odniesienia === 'top') {
        srodek_z_mm = wysokosc_strefy_mm - odstep_gora_mm - grubosc_wienca_mm / 2.0;
    } else {
        srodek_z_mm = odstep_dol_mm + grubosc_wienca_mm / 2.0;
    }

    const efektywna_szerokosc_mm = Math.max(10, szerokosc_strefy_mm - 2 * luz_boczny_mm);
    const efektywna_glebokosc_mm = Math.max(10, glebokosc_strefy_mm - (odsuniecie_przod_mm + odsuniecie_tyl_mm));
    const srodek_y_mm = (odsuniecie_przod_mm - odsuniecie_tyl_mm) / 2.0;

    const roleOverride = (shelfRules as any).parameters?.smart_panel_integration?.role_overrides?.SHELF_BOARD;
    const edgeBanding = roleOverride?.edge_banding || {
        '+Y': { active: true, type_id: '0.008x0.022' },
        '-Y': { active: false, type_id: 'none' },
        '+X': { active: false, type_id: 'none' },
        '-X': { active: false, type_id: 'none' }
    };

    parts.push({
        name: shelfRule?.name || 'Wieniec',
        role: shelfRule?.role || 'SHELF_BOARD',
        nodeType: 'PART',
        dim: { x: efektywna_szerokosc_mm, y: efektywna_glebokosc_mm, z: grubosc_wienca_mm },
        loc: {
            x: 0,
            y: srodek_y_mm,
            z: srodek_z_mm
        },
        lcs: shelfRule?.lcs || {
            mapping: { X: 'x', Y: 'y', Z: 'z' },
            rotation: [90, 0, 0],
            faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
        },
        edge_banding: edgeBanding,
        features: []
    });

    return { parts };
}

