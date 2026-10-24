/**
 * shelves-engine.ts — moduł PÓŁKI (blok_shelves)
 *
 * Czysta architektura funkcyjna (Functional Core) sprzyjająca agentom AI:
 *  - Wyraźne typy DTO ze sprecyzowanymi jednostkami fizycznymi (_mm).
 *  - Czyste funkcje kalkulacji geometrii bez ukrytego stanu (pure functions).
 *  - Zgodność z .agents/AGENTS.md (role 'SHELF_PANEL', nodeType 'PART', jednostki mm w planowaniu).
 *  - SSOT parametrów: A2_bloki/01_BLOKI_PARAMETERS.md
 */

import shelvesRules from './04_shelves_3_rules_V1.json';
import { resolveRuleThicknessMm } from './01_bloki-rules-helper.js';
import type {
    BlokiDimensions_mm,
    BlokiPlanResult,
    BlokiPart,
    BlokiHardware
} from './01_bloki-types.js';
import { DEFAULT_SHELF_PIN_ID, getShelfPinOrDefault } from '../B1_biblioteka/index.js';
import type { ShelvesPlanParams } from './01_bloki-module-types.js';
import {
    assertCanonicalShelvesParams,
    readOptionalNumber
} from './01_bloki-module-param-guards.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';

export { assertCanonicalShelvesParams, LEGACY_SHELVES_PARAM_ALIASES } from './01_bloki-module-param-guards.js';

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
    podporka_id: string;
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
    const odstep_otworow_przod_mm = readOptionalNumber(input, 'odstep_otworow_przod_mm') ?? 40;
    const odstep_otworow_tyl_mm = readOptionalNumber(input, 'odstep_otworow_tyl_mm') ?? 40;

    const otwory_przod_aktywne = input.otwory_przod_aktywne === true;
    const przesuniecie_otworow_przod_x_mm = readOptionalNumber(input, 'przesuniecie_otworow_przod_x_mm') ?? 0;

    const otwory_tyl_aktywne = input.otwory_tyl_aktywne === true;
    const przesuniecie_otworow_tyl_x_mm = readOptionalNumber(input, 'przesuniecie_otworow_tyl_x_mm') ?? 0;

    const rozstaw_potrojny_z_mm = readOptionalNumber(input, 'rozstaw_potrojny_z_mm') ?? 32;
    const rozstaw_system32_mm = readOptionalNumber(input, 'rozstaw_system32_mm') ?? 32;
    const start_system32_z_mm = readOptionalNumber(input, 'start_system32_z_mm') ?? 150;
    const liczba_otworow_system32 = readOptionalNumber(input, 'liczba_otworow_system32') ?? 10;
    const podporka_id = typeof input.podporka_id === 'string' && input.podporka_id ? input.podporka_id : DEFAULT_SHELF_PIN_ID;

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
        liczba_otworow_system32,
        podporka_id
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
    const hardware: BlokiHardware[] = [];

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
        podporka_id
    } = params;

    const efektywna_szerokosc_mm = szerokosc_strefy_mm - 2 * luz_boczny_mm;
    const efektywna_glebokosc_mm = glebokosc_strefy_mm - odsuniecie_przod_mm;

    const pinItem = getShelfPinOrDefault(podporka_id);
    const firstCorpusHole = pinItem.machining?.corpus_holes?.[0];
    const srednica_otworu_mm = firstCorpusHole?.dia ?? 5;
    const glebokosc_otworu_mm = firstCorpusHole?.depth ?? 11;
    const promien_otworu_mm = srednica_otworu_mm / 2;

    const pozycja_otworu_tyl_v_mm = odstep_otworow_tyl_mm;
    const pozycja_otworu_przod_v_mm = Math.max(odstep_otworow_tyl_mm, efektywna_glebokosc_mm - odstep_otworow_przod_mm);

    /** Otwory podpórek pod pojedynczą półką. */
    const buildShelfSupportHoles = (indeks_polki: number, srodek_z_mm: number): any[] => {
        if (wzor_nawiercen !== 'SINGLE' && wzor_nawiercen !== 'TRIPLE') return [];

        const features: any[] = [];
        const holeZ_mm = srodek_z_mm - grubosc_polki_mm / 2 - promien_otworu_mm;

        const addHole = (id: string, name: string, face: string, u: number, v: number, clearance = 0, pinSuffix?: string) => {
            const hwId = pinSuffix ? `shelf_${indeks_polki}_pin_${pinSuffix}` : undefined;
            const intent = buildHoleMachiningIntent({
                id,
                name,
                face: face as any,
                u_mm: u,
                v_mm: v,
                diameter_mm: srednica_otworu_mm,
                depth_mm: glebokosc_otworu_mm,
                rule: 'shelf_pin',
                ownerTag: 'isShelfDrilling',
                drivenBy: hwId ? { nodeId: hwId, role: 'HARDWARE', hardwareType: 'SHELF_PIN' } : undefined,
                sourcePartId: hwId,
                generatedBy: 'blok_shelves',
                extraParams: {
                    template_id: 'SINGLE',
                    clearance,
                    shelfZ: srodek_z_mm,
                    holeZ: holeZ_mm,
                    is_assembly_drilling: true
                }
            });
            const feat = intent.feature as any;
            feat.is_assembly_drilling = true;
            feat.visible = false;
            features.push(feat);
        };

        const uUnderLeft = -promien_otworu_mm;
        const uUnderRight = grubosc_polki_mm + promien_otworu_mm;

        addHole(`hole_shelf_${indeks_polki}_left_front`, 'Lewy przód', 'FACE_X_MINUS', uUnderLeft, pozycja_otworu_przod_v_mm, luz_boczny_mm, 'LF');
        addHole(`hole_shelf_${indeks_polki}_left_back`, 'Lewy tył', 'FACE_X_MINUS', uUnderLeft, pozycja_otworu_tyl_v_mm, luz_boczny_mm, 'LB');
        addHole(`hole_shelf_${indeks_polki}_right_front`, 'Prawy przód', 'FACE_X_PLUS', uUnderRight, pozycja_otworu_przod_v_mm, luz_boczny_mm, 'RF');
        addHole(`hole_shelf_${indeks_polki}_right_back`, 'Prawy tył', 'FACE_X_PLUS', uUnderRight, pozycja_otworu_tyl_v_mm, luz_boczny_mm, 'RB');

        if (wzor_nawiercen === 'TRIPLE') {
            addHole(`hole_shelf_${indeks_polki}_left_front_top`, 'Lewy przód góra', 'FACE_X_MINUS', uUnderLeft + rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, luz_boczny_mm, 'LF');
            addHole(`hole_shelf_${indeks_polki}_left_front_bottom`, 'Lewy przód dół', 'FACE_X_MINUS', uUnderLeft - rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, luz_boczny_mm, 'LF');
            addHole(`hole_shelf_${indeks_polki}_left_back_top`, 'Lewy tył góra', 'FACE_X_MINUS', uUnderLeft + rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, luz_boczny_mm, 'LB');
            addHole(`hole_shelf_${indeks_polki}_left_back_bottom`, 'Lewy tył dół', 'FACE_X_MINUS', uUnderLeft - rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, luz_boczny_mm, 'LB');
            addHole(`hole_shelf_${indeks_polki}_right_front_top`, 'Prawy przód góra', 'FACE_X_PLUS', uUnderRight - rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, luz_boczny_mm, 'RF');
            addHole(`hole_shelf_${indeks_polki}_right_front_bottom`, 'Prawy przód dół', 'FACE_X_PLUS', uUnderRight + rozstaw_potrojny_z_mm, pozycja_otworu_przod_v_mm, luz_boczny_mm, 'RF');
            addHole(`hole_shelf_${indeks_polki}_right_back_top`, 'Prawy tył góra', 'FACE_X_PLUS', uUnderRight - rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, luz_boczny_mm, 'RB');
            addHole(`hole_shelf_${indeks_polki}_right_back_bottom`, 'Prawy tył dół', 'FACE_X_PLUS', uUnderRight + rozstaw_potrojny_z_mm, pozycja_otworu_tyl_v_mm, luz_boczny_mm, 'RB');
        }

        if (otwory_przod_aktywne) {
            const uCenterFront = (efektywna_szerokosc_mm / 2) + przesuniecie_otworow_przod_x_mm;
            const vUnderFront = grubosc_polki_mm + promien_otworu_mm;
            // FACE_Y: U = szerokość (poziom), V = grubość/pion — TRIPLE tylko po V
            addHole(`hole_shelf_${indeks_polki}_center_front`, 'Środek przód', 'FACE_Y_PLUS', uCenterFront, vUnderFront, odsuniecie_przod_mm);
            if (wzor_nawiercen === 'TRIPLE') {
                addHole(`hole_shelf_${indeks_polki}_center_front_top`, 'Środek przód góra', 'FACE_Y_PLUS', uCenterFront, vUnderFront - rozstaw_potrojny_z_mm, odsuniecie_przod_mm);
                addHole(`hole_shelf_${indeks_polki}_center_front_bottom`, 'Środek przód dół', 'FACE_Y_PLUS', uCenterFront, vUnderFront + rozstaw_potrojny_z_mm, odsuniecie_przod_mm);
            }
        }

        if (otwory_tyl_aktywne) {
            const uCenterBack = (efektywna_szerokosc_mm / 2) + przesuniecie_otworow_tyl_x_mm;
            const vUnderBack = -promien_otworu_mm;
            addHole(`hole_shelf_${indeks_polki}_center_back`, 'Środek tył', 'FACE_Y_MINUS', uCenterBack, vUnderBack, 0);
            if (wzor_nawiercen === 'TRIPLE') {
                addHole(`hole_shelf_${indeks_polki}_center_back_top`, 'Środek tył góra', 'FACE_Y_MINUS', uCenterBack, vUnderBack + rozstaw_potrojny_z_mm, 0);
                addHole(`hole_shelf_${indeks_polki}_center_back_bottom`, 'Środek tył dół', 'FACE_Y_MINUS', uCenterBack, vUnderBack - rozstaw_potrojny_z_mm, 0);
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
                    material: 'W1100_ST9_18',
                    materialName: 'Biały Alpejski',
                    materialCode: 'W1100 ST9',
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

                // Tworzenie 4 podpórek dla i-tej półki (bloki hardware)
                const shelfBottomZ = srodek_z_mm - grubosc_polki_mm / 2;
                const pinCenterZ = shelfBottomZ - promien_otworu_mm;
                const yCenter = odsuniecie_przod_mm / 2;
                const yFront = yCenter - efektywna_glebokosc_mm / 2 + pozycja_otworu_przod_v_mm;
                const yBack = yCenter - efektywna_glebokosc_mm / 2 + pozycja_otworu_tyl_v_mm;
                const xLeft = -efektywna_szerokosc_mm / 2;
                const xRight = efektywna_szerokosc_mm / 2;

                hardware.push(
                    {
                        id: `shelf_${i}_pin_LF`,
                        name: `Podpórka ${i} (Lewy Przód)`,
                        hardwareType: 'SHELF_PIN',
                        hardwareId: podporka_id,
                        side: 'left',
                        loc: { x: xLeft, y: yFront, z: pinCenterZ },
                        params: { shelfIndex: i, position: 'LF', side: 'left' }
                    },
                    {
                        id: `shelf_${i}_pin_LB`,
                        name: `Podpórka ${i} (Lewy Tył)`,
                        hardwareType: 'SHELF_PIN',
                        hardwareId: podporka_id,
                        side: 'left',
                        loc: { x: xLeft, y: yBack, z: pinCenterZ },
                        params: { shelfIndex: i, position: 'LB', side: 'left' }
                    },
                    {
                        id: `shelf_${i}_pin_RF`,
                        name: `Podpórka ${i} (Prawy Przód)`,
                        hardwareType: 'SHELF_PIN',
                        hardwareId: podporka_id,
                        side: 'right',
                        loc: { x: xRight, y: yFront, z: pinCenterZ },
                        params: { shelfIndex: i, position: 'RF', side: 'right' }
                    },
                    {
                        id: `shelf_${i}_pin_RB`,
                        name: `Podpórka ${i} (Prawy Tył)`,
                        hardwareType: 'SHELF_PIN',
                        hardwareId: podporka_id,
                        side: 'right',
                        loc: { x: xRight, y: yBack, z: pinCenterZ },
                        params: { shelfIndex: i, position: 'RB', side: 'right' }
                    }
                );
            }
        }
    }

    return { parts, hardware };
}

