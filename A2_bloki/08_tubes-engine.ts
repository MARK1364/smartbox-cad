/**
 * tubes-engine.ts — moduł DRĄŻEK (blok_tubes)
 *
 * Czysta architektura funkcyjna (Functional Core) sprzyjająca agentom AI:
 *  - Wyraźne typy DTO ze sprecyzowanymi jednostkami fizycznymi (_mm).
 *  - Czyste funkcje kalkulacji geometrii bez ukrytego stanu (pure functions).
 *  - Zgodność z .agents/AGENTS.md:
 *      * Formatki wytwarzane (płyta nad drążkiem) -> nodeType 'PART', rola 'SHELF_PANEL'.
 *      * Elementy kupowane (drążek, rozetki) -> BlokiHardware, hardwareType 'TUBE'.
 *  - SSOT parametrów: A2_bloki/01_BLOKI_PARAMETERS.md oraz B1_biblioteka/drazki/
 */

import tubesRules from './08_tubes_3_rules_V1.json';
import { resolveRuleThicknessMm } from './01_bloki-rules-helper.js';
import { type ModuleDims } from './01_base-engine.js';
import { CYLINDER_SHAPE } from '../A1_core/cad-node/part-shape.js';
import { getTubeSocketOrDefault } from '../B1_biblioteka/index.js';
import type {
    BlokiDimensions_mm,
    BlokiPlanResult,
    BlokiPart,
    BlokiHardware
} from './01_bloki-types.js';
import type { TubesPlanParams } from './01_bloki-module-types.js';
import {
    assertCanonicalTubesParams,
    readOptionalNumber
} from './01_bloki-module-param-guards.js';

export { assertCanonicalTubesParams, LEGACY_TUBES_PARAM_ALIASES } from './01_bloki-module-param-guards.js';

// ─── Typy Domenowe Drążka ──────────────────────────────────────────────────────

export interface NormalizedTubesParams {
    odstep_gora_mm: number;
    pokaz_polke: boolean;
    przestrzen_nad_polka_mm: number;
    grubosc_polki_mm: number;
    srednica_drazka_mm: number;
}

// ─── Czyste Funkcje Pomocnicze ────────────────────────────────────────────────

/**
 * Normalizuje parametry wejściowe do spójnego DTO. Tylko klucze kanoniczne.
 */
export function normalizeTubesParams(
    raw: TubesPlanParams = {},
    _dims?: BlokiDimensions_mm | ModuleDims
): NormalizedTubesParams {
    assertCanonicalTubesParams(raw);
    const input = raw as Record<string, unknown>;

    const defaultShelfThick = resolveRuleThicknessMm(tubesRules, ['SHELF', 'TOP_SHELF'], 'thickness', 'tubes');
    const defaultRodDia = 25;

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
    const hardware: BlokiHardware[] = [];

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

    // ─── Okucia (Drążek i Rozetki) z B1_biblioteka ────────────────────────────
    const socketHw = getTubeSocketOrDefault();
    const socketDim = (socketHw.definition as any)?.dimensions || {};
    const srednica_uchwytu_mm = Number(socketDim.diameter ?? 45);
    const grubosc_uchwytu_mm = Number(socketDim.thickness ?? 5);

    const dlugosc_drazka_mm = Math.max(10, szerokosc_strefy_mm - 2);

    hardware.push({
        id: `tube_rod_${szerokosc_strefy_mm}`,
        name: `Drazek_fi${srednica_drazka_mm}`,
        role: 'TUBE_ROD',
        hardwareType: 'TUBE',
        hardwareId: 'DRAZEK_FI25',
        dim: { x: dlugosc_drazka_mm, y: srednica_drazka_mm, z: srednica_drazka_mm },
        loc: { x: 0, y: 0, z: srodek_drazka_z_mm },
        params: {
            diameter_mm: srednica_drazka_mm,
            length_mm: dlugosc_drazka_mm
        },
        customProperties: {
            shape: CYLINDER_SHAPE,
            material: 'Aluminium_Chrome'
        }
    });

    hardware.push({
        id: 'tube_holder_left',
        name: 'Uchwyt_Lewy',
        role: 'HOLDER',
        hardwareType: 'TUBE',
        hardwareId: socketHw.id || 'ROZETA_FI25',
        side: 'left',
        dim: { x: grubosc_uchwytu_mm, y: srednica_uchwytu_mm, z: srednica_uchwytu_mm },
        loc: { x: -szerokosc_strefy_mm / 2 + grubosc_uchwytu_mm / 2, y: 0, z: srodek_drazka_z_mm },
        params: {
            diameter_mm: srednica_uchwytu_mm,
            thickness_mm: grubosc_uchwytu_mm
        },
        customProperties: {
            shape: CYLINDER_SHAPE,
            material: 'Aluminium_Chrome'
        }
    });

    hardware.push({
        id: 'tube_holder_right',
        name: 'Uchwyt_Prawy',
        role: 'HOLDER',
        hardwareType: 'TUBE',
        hardwareId: socketHw.id || 'ROZETA_FI25',
        side: 'right',
        dim: { x: grubosc_uchwytu_mm, y: srednica_uchwytu_mm, z: srednica_uchwytu_mm },
        loc: { x: szerokosc_strefy_mm / 2 - grubosc_uchwytu_mm / 2, y: 0, z: srodek_drazka_z_mm },
        params: {
            diameter_mm: srednica_uchwytu_mm,
            thickness_mm: grubosc_uchwytu_mm
        },
        customProperties: {
            shape: CYLINDER_SHAPE,
            material: 'Aluminium_Chrome'
        }
    });

    return { parts, hardware };
}
