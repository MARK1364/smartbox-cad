/**
 * tubes-engine.ts — moduł DRĄŻEK (blok_tubes)
 *
 * Czysta architektura funkcyjna (Functional Core) sprzyjająca agentom AI:
 *  - Wyraźne typy DTO ze sprecyzowanymi jednostkami fizycznymi (_mm).
 *  - Czyste funkcje kalkulacji geometrii bez ukrytego stanu (pure functions).
 *  - Zgodność z .agents/AGENTS.md (role 'TUBE_ROD', 'HOLDER', 'SHELF_PANEL', nodeType 'PART').
 *  - SSOT parametrów: A2_bloki/BLOKI_PARAMETERS.md
 */

import tubesRules from './tubes_3_rules_V1.json';
import { resolveRuleThicknessMm } from './bloki-rules-helper.js';
import { type ModuleDims } from './base-engine.js';
import { rulesMToMm } from '../A1_core/cad-math/units.js';
import { CYLINDER_SHAPE } from '../A1_core/cad-node/part-shape.js';
import type {
    BlokiDimensions_mm,
    BlokiPlanResult,
    BlokiPart
} from './bloki-types.js';
import type { TubesPlanParams } from './bloki-module-types.js';
import {
    assertCanonicalTubesParams,
    readOptionalNumber
} from './bloki-module-param-guards.js';

export { assertCanonicalTubesParams, LEGACY_TUBES_PARAM_ALIASES } from './bloki-module-param-guards.js';

// ─── Typy Domenowe Drążka ──────────────────────────────────────────────────────

export interface NormalizedTubesParams {
    odstep_gora_mm: number;
    pokaz_polke: boolean;
    przestrzen_nad_polka_mm: number;
    grubosc_polki_mm: number;
    srednica_drazka_mm: number;
}

// ─── Czyste Funkcje Pomocnicze ────────────────────────────────────────────────

/** Kod obiektu CAD w katalogu reguł oznaczający bryłę walcową. */
const CYLINDER_OBJECT = 'CYLINDER';

/** Reguła JSON opisująca bryłę (obiekt walcowy) w katalogu Bloki. */
interface CylinderRule {
    object?: string;
    custom_properties?: Record<string, any>;
}

/**
 * Buduje jawne custom_properties dla bryły walcowej.
 * Źródło: `object`/`custom_properties.shape` z reguł JSON — NIE nazwa elementu.
 */
function cylinderCustomProperties(rule: CylinderRule | undefined): Record<string, any> {
    const fromRule = { ...(rule?.custom_properties || {}) };
    const shape = String(fromRule.shape || '').toUpperCase()
        || (String(rule?.object || '').toUpperCase() === CYLINDER_OBJECT ? CYLINDER_SHAPE : '');
    return { ...fromRule, ...(shape ? { shape } : {}) };
}

/**
 * Normalizuje parametry wejściowe do spójnego DTO. Tylko klucze kanoniczne.
 */
export function normalizeTubesParams(
    raw: TubesPlanParams = {},
    dims?: BlokiDimensions_mm | ModuleDims
): NormalizedTubesParams {
    assertCanonicalTubesParams(raw);
    const input = raw as Record<string, unknown>;
    const tree = (tubesRules as any).model_tree?.root_assembly?.subcomponents || {};
    const rodSys = tree.ROD_SYSTEM?.subcomponents || {};
    const rodRule = rodSys.ROD || {};

    const defaultShelfThick = resolveRuleThicknessMm(tubesRules, ['SHELF', 'TOP_SHELF'], 'thickness', 'tubes');
    const defaultRodDia = rodRule.diameter !== undefined ? rulesMToMm(rodRule.diameter, 25) : 25;

    const odstep_gora_mm = readOptionalNumber(input, 'odstep_gora_mm') ?? 70;
    const pokaz_polke = input.pokaz_polke !== undefined ? Boolean(input.pokaz_polke) : false;
    const przestrzen_nad_polka_mm = readOptionalNumber(input, 'przestrzen_nad_polka_mm') ?? 100;
    const grubosc_polki_mm = readOptionalNumber(input, 'grubosc_polki_mm') ?? defaultShelfThick;
    const srednica_drazka_mm = readOptionalNumber(input, 'srednica_drazka_mm') ?? defaultRodDia;

    return {
        odstep_gora_mm,
        pokaz_polke,
        przestrzen_nad_polka_mm,
        grubosc_polki_mm,
        srednica_drazka_mm
    };
}

// ─── Czysta Funkcja Kalkulacji Planu Drążka ────────────────────────────────────

/**
 * Czysta funkcja matematyczna generująca formatki drążka, uchwytów i opcjonalnej półki.
 * Zero stanu, zero zależności od sceny/DOM/Babylon.
 */
export function calculateTubesPlan(
    dims: BlokiDimensions_mm,
    params: NormalizedTubesParams
): BlokiPlanResult {
    const parts: BlokiPart[] = [];

    const {
        width_mm: szerokosc_strefy_mm,
        height_mm: wysokosc_strefy_mm,
        depth_mm: glebokosc_strefy_mm
    } = dims;

    const {
        odstep_gora_mm,
        pokaz_polke,
        przestrzen_nad_polka_mm,
        grubosc_polki_mm,
        srednica_drazka_mm
    } = params;

    const tree = (tubesRules as any).model_tree?.root_assembly?.subcomponents || {};
    const rodSys = tree.ROD_SYSTEM?.subcomponents || {};
    const rodRule = rodSys.ROD || {};
    const leftRule = rodSys.HOLDER_LEFT || {};
    const rightRule = rodSys.HOLDER_RIGHT || {};
    const shelfRule = tree.SHELF || {};
    const shelfOverride = (tubesRules as any).parameters?.smart_panel_integration?.role_overrides?.TOP_SHELF;

    let srodek_drazka_z_mm: number;

    if (pokaz_polke) {
        const srodek_polki_z_mm = wysokosc_strefy_mm - przestrzen_nad_polka_mm - (grubosc_polki_mm / 2.0);
        srodek_drazka_z_mm = srodek_polki_z_mm - (grubosc_polki_mm / 2.0) - odstep_gora_mm;

        const szerokosc_polki_mm = Math.max(10, szerokosc_strefy_mm - 4);
        const glebokosc_polki_mm = Math.max(10, glebokosc_strefy_mm - 10);

        parts.push({
            name: shelfRule.name || 'Polka_Nad_Drazkiem',
            role: shelfRule.role || 'SHELF_PANEL',
            nodeType: 'PART',
            dim: { x: szerokosc_polki_mm, y: glebokosc_polki_mm, z: grubosc_polki_mm },
            loc: { x: 0, y: 5, z: srodek_polki_z_mm },
            lcs: shelfRule.lcs || {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [90, 0, 0],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            },
            edge_banding: shelfOverride?.edge_banding || {
                "-Y": { active: true, type_id: "0.008x0.022" },
                "+Y": { active: false, type_id: "none" },
                "+X": { active: false, type_id: "none" },
                "-X": { active: false, type_id: "none" }
            },
            features: []
        });
    } else {
        srodek_drazka_z_mm = wysokosc_strefy_mm - odstep_gora_mm;
    }

    const dlugosc_drazka_mm = Math.max(10, szerokosc_strefy_mm - 2);
    parts.push({
        name: rodRule.name || 'Drazek_fi25',
        role: rodRule.role || 'TUBE_ROD',
        nodeType: 'PART',
        report_type: rodRule.report_type || 'akcesoria',
        dim: { x: dlugosc_drazka_mm, y: srednica_drazka_mm, z: srednica_drazka_mm },
        loc: { x: 0, y: 0, z: srodek_drazka_z_mm },
        // Bryła z JSON-a (object/shape) — jawna flaga, bez zgadywania po nazwie.
        customProperties: cylinderCustomProperties(rodRule),
        features: []
    });

    const grubosc_uchwytu_mm = leftRule.thickness !== undefined ? rulesMToMm(leftRule.thickness, 5) : 5;
    const srednica_uchwytu_mm = leftRule.diameter !== undefined ? rulesMToMm(leftRule.diameter, 45) : 45;

    parts.push({
        name: leftRule.name || 'Uchwyt_Lewy',
        role: leftRule.role || 'HOLDER',
        nodeType: 'PART',
        report_type: leftRule.report_type || 'akcesoria',
        library_id: leftRule.features?.[0]?.library_id || leftRule.library_id,
        dim: { x: grubosc_uchwytu_mm, y: srednica_uchwytu_mm, z: srednica_uchwytu_mm },
        loc: { x: -szerokosc_strefy_mm / 2 + grubosc_uchwytu_mm / 2, y: 0, z: srodek_drazka_z_mm },
        customProperties: cylinderCustomProperties(leftRule),
        features: []
    });

    parts.push({
        name: rightRule.name || 'Uchwyt_Prawy',
        role: rightRule.role || 'HOLDER',
        nodeType: 'PART',
        report_type: rightRule.report_type || 'akcesoria',
        library_id: rightRule.features?.[0]?.library_id || rightRule.library_id,
        dim: { x: grubosc_uchwytu_mm, y: srednica_uchwytu_mm, z: srednica_uchwytu_mm },
        loc: { x: szerokosc_strefy_mm / 2 - grubosc_uchwytu_mm / 2, y: 0, z: srodek_drazka_z_mm },
        customProperties: cylinderCustomProperties(rightRule),
        features: []
    });

    return { parts };
}

