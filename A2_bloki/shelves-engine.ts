/**
 * shelves-engine.ts — moduł PÓŁKI (blok_shelves)
 *
 * Czysta architektura funkcyjna (Functional Core) sprzyjająca agentom AI:
 *  - Wyraźne typy DTO ze sprecyzowanymi jednostkami fizycznymi (_mm).
 *  - Czyste funkcje kalkulacji geometrii bez ukrytego stanu (pure functions).
 *  - Zgodność z .agents/AGENTS.md (role 'SHELF_PANEL', nodeType 'PART', jednostki mm w planowaniu).
 *  - SSOT parametrów: A2_bloki/BLOKI_PARAMETERS.md
 */

import shelvesRules from './shelves_3_rules_V1.json';
import { resolveRuleThicknessMm } from './bloki-rules-helper.js';
import type {
    BlokiDimensions_mm,
    BlokiPlanResult,
    BlokiPart
} from './bloki-types.js';
import type { ShelvesPlanParams } from './bloki-module-types.js';
import {
    assertCanonicalShelvesParams,
    readOptionalNumber
} from './bloki-module-param-guards.js';

export { assertCanonicalShelvesParams, LEGACY_SHELVES_PARAM_ALIASES } from './bloki-module-param-guards.js';

// ─── Typy Domenowe Półek ───────────────────────────────────────────────────────

export type HolePatternType = 'NONE' | 'SINGLE' | 'TRIPLE' | 'ROW' | 'SYSTEM_32';

export interface NormalizedShelvesParams {
    liczba_polek: number;
    grubosc_polki_mm: number;
    odsuniecie_przod_mm: number;
    luz_boczny_mm: number;
    wzor_nawiercen: HolePatternType;
    odstep_otworow_przod_mm: number;
    odstep_otworow_tyl_mm: number;
    otwory_przod_aktywne: boolean;
    przesuniecie_otworow_przod_x_mm: number;
    otwory_tyl_aktywne: boolean;
    przesuniecie_otworow_tyl_x_mm: number;
    rozstaw_potrojny_z_mm: number;
    rozstaw_system32_mm: number;
    start_system32_z_mm: number;
    liczba_otworow_system32: number;
}

// ─── Czyste Funkcje Matematyczne ──────────────────────────────────────────────

/** Równe wnęki wewnętrzne: (H − n×grubość) / (n+1). */
export function equalShelfBay(
    wysokosc_strefy_mm: number,
    liczba_polek: number,
    grubosc_polki_mm: number
): number {
    if (liczba_polek <= 0) return wysokosc_strefy_mm;
    return (wysokosc_strefy_mm - liczba_polek * grubosc_polki_mm) / (liczba_polek + 1);
}

/** Środek i-tej półki (1-based), Z=0 to spód strefy Bloku. */
export function equalShelfCenterZ(
    wysokosc_strefy_mm: number,
    liczba_polek: number,
    grubosc_polki_mm: number,
    indeks_polki: number
): number {
    const bay_mm = equalShelfBay(wysokosc_strefy_mm, liczba_polek, grubosc_polki_mm);
    return indeks_polki * bay_mm + (indeks_polki - 1) * grubosc_polki_mm + grubosc_polki_mm / 2;
}

/**
 * Normalizuje parametry wejściowe do spójnego DTO. Tylko klucze kanoniczne.
 */
export function normalizeShelvesParams(
    raw: ShelvesPlanParams = {},
    dims?: BlokiDimensions_mm
): NormalizedShelvesParams {
    assertCanonicalShelvesParams(raw);
    const input = raw as Record<string, unknown>;
    const liczba_polek = Math.round(readOptionalNumber(input, 'liczba_polek') ?? 3);
    const defThick = resolveRuleThicknessMm(shelvesRules, ['POLKA_1', 'SHELF', 'SHELF_PANEL'], 'thickness', 'shelves');
    const grubosc_polki_mm = readOptionalNumber(input, 'grubosc_polki_mm') ?? defThick;
    const odsuniecie_przod_mm = readOptionalNumber(input, 'odsuniecie_przod_mm') ?? 10;
    const luz_boczny_mm = readOptionalNumber(input, 'luz_boczny_mm') ?? 0.5;

    const wzor_nawiercen = String(input.wzor_nawiercen || 'SINGLE').toUpperCase() as HolePatternType;
    const odstep_otworow_przod_mm = readOptionalNumber(input, 'odstep_otworow_przod_mm') ?? 37;
    const odstep_otworow_tyl_mm = readOptionalNumber(input, 'odstep_otworow_tyl_mm') ?? 37;

    const otwory_przod_aktywne = input.otwory_przod_aktywne === true;
    const przesuniecie_otworow_przod_x_mm = readOptionalNumber(input, 'przesuniecie_otworow_przod_x_mm') ?? 0;

    const otwory_tyl_aktywne = input.otwory_tyl_aktywne === true;
    const przesuniecie_otworow_tyl_x_mm = readOptionalNumber(input, 'przesuniecie_otworow_tyl_x_mm') ?? 0;

    const rozstaw_potrojny_z_mm = readOptionalNumber(input, 'rozstaw_potrojny_z_mm') ?? 32;
    const rozstaw_system32_mm = readOptionalNumber(input, 'rozstaw_system32_mm') ?? 32;
    const start_system32_z_mm = readOptionalNumber(input, 'start_system32_z_mm') ?? 150;
    const liczba_otworow_system32 = readOptionalNumber(input, 'liczba_otworow_system32') ?? 10;

    return {
        liczba_polek,
        grubosc_polki_mm,
        odsuniecie_przod_mm,
        luz_boczny_mm,
        wzor_nawiercen,
        odstep_otworow_przod_mm,
        odstep_otworow_tyl_mm,
        otwory_przod_aktywne,
        przesuniecie_otworow_przod_x_mm,
        otwory_tyl_aktywne,
        przesuniecie_otworow_tyl_x_mm,
        rozstaw_potrojny_z_mm,
        rozstaw_system32_mm,
        start_system32_z_mm,
        liczba_otworow_system32
    };
}

// ─── Czysta Funkcja Kalkulacji Planu Półek ────────────────────────────────────

/**
 * Czysta funkcja matematyczna generująca formatki i nawiercenia dla modułu Półki.
 * Zero stanu, zero zależności od sceny/DOM/Babylon.
 */
export function calculateShelvesPlan(
    dims: BlokiDimensions_mm,
    params: NormalizedShelvesParams
): BlokiPlanResult {
    const parts: BlokiPart[] = [];

    const {
        width_mm: szerokosc_strefy_mm,
        height_mm: wysokosc_strefy_mm,
        depth_mm: glebokosc_strefy_mm
    } = dims;

    const {
        liczba_polek,
        grubosc_polki_mm,
        odsuniecie_przod_mm,
        luz_boczny_mm,
        wzor_nawiercen,
        odstep_otworow_przod_mm,
        odstep_otworow_tyl_mm,
        otwory_przod_aktywne,
        przesuniecie_otworow_przod_x_mm,
        otwory_tyl_aktywne,
        przesuniecie_otworow_tyl_x_mm,
        rozstaw_potrojny_z_mm,
        rozstaw_system32_mm,
        start_system32_z_mm,
        liczba_otworow_system32
    } = params;

    const efektywna_szerokosc_mm = szerokosc_strefy_mm - 2 * luz_boczny_mm;
    const efektywna_glebokosc_mm = glebokosc_strefy_mm - odsuniecie_przod_mm;

    const srednica_otworu_mm = 5;
    const glebokosc_otworu_mm = 12;
    const promien_otworu_mm = srednica_otworu_mm / 2;

    const pozycja_otworu_tyl_v_mm = odstep_otworow_tyl_mm;
    const pozycja_otworu_przod_v_mm = Math.max(odstep_otworow_tyl_mm, efektywna_glebokosc_mm - odstep_otworow_przod_mm);

    /** Otwory podpórek pod pojedynczą półką. */
    const buildShelfSupportHoles = (indeks_polki: number, srodek_z_mm: number): any[] => {
        if (wzor_nawiercen !== 'SINGLE' && wzor_nawiercen !== 'TRIPLE') return [];

        const features: any[] = [];
        const holeZ_mm = srodek_z_mm - grubosc_polki_mm / 2 - promien_otworu_mm;

        const addHole = (id: string, name: string, face: string, u: number, v: number, clearance = 0) => {
            features.push({
                id,
                name,
                type: 'hole',
                face,
                side: face,
                is_assembly_drilling: true,
                visible: false,
                params: {
                    template_id: 'SINGLE',
                    // Kanoniczne *_mm; legacy u/v/diameter/depth dla downstream CAM/testów
                    u_mm: u,
                    v_mm: v,
                    diameter_mm: srednica_otworu_mm,
                    depth_mm: glebokosc_otworu_mm,
                    u,
                    v,
                    diameter: srednica_otworu_mm,
                    depth: glebokosc_otworu_mm,
                    clearance,
                    shelfZ: srodek_z_mm,
                    holeZ: holeZ_mm,
                    is_assembly_drilling: true
                }
            });
        };

        const uUnderLeft = -promien_otworu_mm;
        const uUnderRight = grubosc_polki_mm + promien_otworu_mm;

        addHole(`hole_shelf_${indeks_polki}_left_front`, 'Lewy przód', 'FACE_X_MINUS', uUnderLeft, pozycja_otworu_przod_v_mm, luz_boczny_mm);
        addHole(`hole_shelf_${indeks_polki}_left_back`, 'Lewy tył', 'FACE_X_MINUS', uUnderLeft, pozycja_otworu_tyl_v_mm, luz_boczny_mm);
        addHole(`hole_shelf_${indeks_polki}_right_front`, 'Prawy przód', 'FACE_X_PLUS', uUnderRight, pozycja_otworu_przod_v_mm, luz_boczny_mm);
        addHole(`hole_shelf_${indeks_polki}_right_back`, 'Prawy tył', 'FACE_X_PLUS', uUnderRight, pozycja_otworu_tyl_v_mm, luz_boczny_mm);

        if (wzor_nawiercen === 'TRIPLE') {
            addHole(`hole_shelf_${indeks_polki}_left_front_top`, 'Lewy przód góra', 'FACE_X_MINUS', uUnderLeft + rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, luz_boczny_mm);
            addHole(`hole_shelf_${indeks_polki}_left_front_bottom`, 'Lewy przód dół', 'FACE_X_MINUS', uUnderLeft - rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, luz_boczny_mm);
            addHole(`hole_shelf_${indeks_polki}_left_back_top`, 'Lewy tył góra', 'FACE_X_MINUS', uUnderLeft + rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, luz_boczny_mm);
            addHole(`hole_shelf_${indeks_polki}_left_back_bottom`, 'Lewy tył dół', 'FACE_X_MINUS', uUnderLeft - rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, luz_boczny_mm);
            addHole(`hole_shelf_${indeks_polki}_right_front_top`, 'Prawy przód góra', 'FACE_X_PLUS', uUnderRight - rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, luz_boczny_mm);
            addHole(`hole_shelf_${indeks_polki}_right_front_bottom`, 'Prawy przód dół', 'FACE_X_PLUS', uUnderRight + rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, luz_boczny_mm);
            addHole(`hole_shelf_${indeks_polki}_right_back_top`, 'Prawy tył góra', 'FACE_X_PLUS', uUnderRight - rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, luz_boczny_mm);
            addHole(`hole_shelf_${indeks_polki}_right_back_bottom`, 'Prawy tył dół', 'FACE_X_PLUS', uUnderRight + rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, luz_boczny_mm);
        }

        if (otwory_przod_aktywne) {
            const uCenterFront = (efektywna_szerokosc_mm / 2) + przesuniecie_otworow_przod_x_mm;
            const vUnderFront = grubosc_polki_mm + promien_otworu_mm;
            addHole(`hole_shelf_${indeks_polki}_center_front`, 'Środek przód', 'FACE_Y_PLUS', uCenterFront, vUnderFront, odsuniecie_przod_mm);
            if (wzor_nawiercen === 'TRIPLE') {
                addHole(`hole_shelf_${indeks_polki}_center_front_top`, 'Środek przód góra', 'FACE_Y_PLUS', uCenterFront + rozstaw_potrojny_z_mm, vUnderFront, odsuniecie_przod_mm);
                addHole(`hole_shelf_${indeks_polki}_center_front_bottom`, 'Środek przód dół', 'FACE_Y_PLUS', uCenterFront - rozstaw_potrojny_z_mm, vUnderFront, odsuniecie_przod_mm);
            }
        }

        if (otwory_tyl_aktywne) {
            const uCenterBack = (efektywna_szerokosc_mm / 2) + przesuniecie_otworow_tyl_x_mm;
            const vUnderBack = -promien_otworu_mm;
            addHole(`hole_shelf_${indeks_polki}_center_back`, 'Środek tył', 'FACE_Y_MINUS', uCenterBack, vUnderBack, 0);
            if (wzor_nawiercen === 'TRIPLE') {
                addHole(`hole_shelf_${indeks_polki}_center_back_top`, 'Środek tył góra', 'FACE_Y_MINUS', uCenterBack + rozstaw_potrojny_z_mm, vUnderBack, 0);
                addHole(`hole_shelf_${indeks_polki}_center_back_bottom`, 'Środek tył dół', 'FACE_Y_MINUS', uCenterBack - rozstaw_potrojny_z_mm, vUnderBack, 0);
            }
        }

        return features;
    };

    if (wysokosc_strefy_mm > 0) {
        const shelfOverride = (shelvesRules as any).parameters?.smart_panel_integration?.role_overrides?.SHELF_PANEL ||
                              (shelvesRules as any).parameters?.smart_panel_integration?.role_overrides?.SHELF;
        const edgeBanding = shelfOverride?.edge_banding || {
            "+Y": { active: true, type_id: "0.008x0.022" },
            "-Y": { active: false, type_id: "none" },
            "+X": { active: false, type_id: "none" },
            "-X": { active: false, type_id: "none" }
        };

        if (liczba_polek > 0) {
            for (let i = 1; i <= liczba_polek; i++) {
                const srodek_z_mm = equalShelfCenterZ(wysokosc_strefy_mm, liczba_polek, grubosc_polki_mm, i);

                let shelfRule = (shelvesRules as any).model_tree?.root_assembly?.subcomponents?.[`SHELF_${i}`];
                if (!shelfRule) {
                    shelfRule = (shelvesRules as any).model_tree?.root_assembly?.subcomponents?.[`SHELF_1`];
                }

                parts.push({
                    name: `Polka_${i}`,
                    role: 'SHELF_PANEL',
                    nodeType: 'PART',
                    dim: { x: efektywna_szerokosc_mm, y: efektywna_glebokosc_mm, z: grubosc_polki_mm },
                    loc: {
                        x: 0,
                        y: odsuniecie_przod_mm / 2,
                        z: srodek_z_mm
                    },
                    lcs: shelfRule?.lcs,
                    edge_banding: edgeBanding,
                    features: buildShelfSupportHoles(i, srodek_z_mm)
                });
            }
        }

        // Siatka otworów System 32 / ROW wzdłuż wysokości korpusu
        if (wzor_nawiercen === 'ROW' || wzor_nawiercen === 'SYSTEM_32') {
            const sys32Features: any[] = [];
            const calkowita_liczba_otworow = liczba_otworow_system32 > 0 ? liczba_otworow_system32 : 10;

            const addSys32Hole = (id: string, name: string, face: string, u: number, zPos: number, clearance = 0) => {
                sys32Features.push({
                    id,
                    name,
                    type: 'hole',
                    face,
                    side: face,
                    is_assembly_drilling: true,
                    visible: false,
                    params: {
                        template_id: 'SINGLE',
                        u_mm: u,
                        v_mm: zPos,
                        diameter_mm: srednica_otworu_mm,
                        depth_mm: glebokosc_otworu_mm,
                        u,
                        v: zPos,
                        diameter: srednica_otworu_mm,
                        depth: glebokosc_otworu_mm,
                        clearance,
                        holeZ: zPos,
                        is_assembly_drilling: true
                    }
                });
            };

            for (let k = 0; k < calkowita_liczba_otworow; k++) {
                const zPos_mm = start_system32_z_mm + k * rozstaw_system32_mm;
                if (zPos_mm > wysokosc_strefy_mm - 10) break;

                addSys32Hole(`sys32_left_front_${k}`, `Sys32 LF ${k + 1}`, 'FACE_X_MINUS', odstep_otworow_przod_mm, zPos_mm, luz_boczny_mm);
                addSys32Hole(`sys32_left_back_${k}`, `Sys32 LB ${k + 1}`, 'FACE_X_MINUS', Math.max(odstep_otworow_przod_mm, efektywna_glebokosc_mm - odstep_otworow_tyl_mm), zPos_mm, luz_boczny_mm);
                addSys32Hole(`sys32_right_front_${k}`, `Sys32 RF ${k + 1}`, 'FACE_X_PLUS', Math.max(0, efektywna_glebokosc_mm - odstep_otworow_przod_mm), zPos_mm, luz_boczny_mm);
                addSys32Hole(`sys32_right_back_${k}`, `Sys32 RB ${k + 1}`, 'FACE_X_PLUS', odstep_otworow_tyl_mm, zPos_mm, luz_boczny_mm);

                if (otwory_przod_aktywne) {
                    addSys32Hole(`sys32_front_${k}`, `Sys32 Front ${k + 1}`, 'FACE_Z_PLUS', (efektywna_szerokosc_mm / 2) + przesuniecie_otworow_przod_x_mm, zPos_mm, odsuniecie_przod_mm);
                }
                if (otwory_tyl_aktywne) {
                    addSys32Hole(`sys32_back_${k}`, `Sys32 Back ${k + 1}`, 'FACE_Z_MINUS', (efektywna_szerokosc_mm / 2) - przesuniecie_otworow_tyl_x_mm, zPos_mm, 0);
                }
            }

            parts.push({
                name: 'System_32',
                role: 'OTHER',
                nodeType: 'PART',
                dim: { x: efektywna_szerokosc_mm, y: wysokosc_strefy_mm, z: efektywna_glebokosc_mm },
                loc: {
                    x: 0,
                    y: odsuniecie_przod_mm / 2,
                    z: wysokosc_strefy_mm / 2
                },
                lcs: {
                    mapping: { X: 'x', Y: 'y', Z: 'z' },
                    rotation: [0, 0, 0],
                    faces: {
                        INNER: 'FACE_Z_PLUS',
                        OUTER: 'FACE_Z_MINUS'
                    }
                },
                features: sys32Features
            });
        }
    }

    return { parts };
}

