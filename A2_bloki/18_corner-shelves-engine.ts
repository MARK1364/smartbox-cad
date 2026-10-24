/**
 * 18_corner-shelves-engine.ts — Bloki PÓŁKI NAROŻNE (blok_corner_shelves)
 *
 * Czysta architektura funkcyjna (Functional Core):
 *  - Wyraźne typy DTO ze sprecyzowanymi jednostkami fizycznymi (_mm).
 *  - Formatki półki w kształcie litery L z obrysem outline2d.
 *  - Równomierny rozkład półek w pionie (equalShelfCenterZ).
 *  - Otwory pod podpórki półek generowane przez buildHoleMachiningIntent (SSOT).
 *  - Zgodność z .agents/AGENTS.md (role 'SHELF_PANEL', nodeType 'PART').
 */

import type {
    BlokiDimensions_mm,
    BlokiPlanResult,
    BlokiPart,
    BlokiHardware
} from './01_bloki-types.js';
import { DEFAULT_SHELF_PIN_ID, getShelfPinOrDefault } from '../B1_biblioteka/index.js';
import type { CornerShelvesPlanParams, ShelfHolePattern } from './01_bloki-module-types.js';
import {
    assertCanonicalCornerShelvesParams,
    readOptionalNumber
} from './01_bloki-module-param-guards.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import { equalShelfCenterZ, equalShelfBay } from './04_shelves-engine.js';
import { UIController } from '../A1_core/ui-controller.js';

export { assertCanonicalCornerShelvesParams, LEGACY_CORNER_SHELVES_PARAM_ALIASES } from './01_bloki-module-param-guards.js';

// ─── Typy Domenowe Półek Narożnych ──────────────────────────────────────────

export interface NormalizedCornerShelvesParams {
    liczba_polek: number;
    grubosc_polki_mm: number;
    odsuniecie_przod_mm: number;
    luz_boczny_mm: number;
    bok_lewy_mm: number;
    bok_prawy_mm: number;
    wzor_nawiercen: ShelfHolePattern;
    rozstaw_potrojny_z_mm: number;
    odstep_otworow_przod_mm: number;
    odstep_otworow_tyl_mm: number;
    rozstaw_system32_mm: number;
    start_system32_z_mm: number;
    liczba_otworow_system32: number;
    plecy_odsuniecie_x_mm: number;
    plecy_odsuniecie_y_mm: number;
    wyciecie_listwa_narozna: boolean;
    listwa_narozna_szerokosc_mm: number;
    listwa_narozna_grubosc_mm: number;
    listwa_narozna_luz_mm: number;
    podporka_id: string;
}

// ─── Normalizacja Parametrów ────────────────────────────────────────────────

export function normalizeCornerShelvesParams(
    raw: CornerShelvesPlanParams = {},
    dims?: BlokiDimensions_mm
): NormalizedCornerShelvesParams {
    assertCanonicalCornerShelvesParams(raw);
    const input = raw as Record<string, unknown>;

    const liczba_polek = Math.max(1, Math.round(readOptionalNumber(input, 'liczba_polek') ?? 1));
    const grubosc_polki_mm = readOptionalNumber(input, 'grubosc_polki_mm') ?? 18;
    const odsuniecie_przod_mm = readOptionalNumber(input, 'odsuniecie_przod_mm') ?? 0;
    const luz_boczny_mm = readOptionalNumber(input, 'luz_boczny_mm') ?? 0;

    // Głębokości skrzydeł narożnych (domyślnie z wymiarów wnęki lub standard 600 mm)
    const defArmL = dims?.depth_mm ? Math.min(dims.depth_mm, 600) : 600;
    const defArmP = dims?.width_mm ? Math.min(dims.width_mm, 600) : 600;
    const bok_lewy_mm = readOptionalNumber(input, 'bok_lewy_mm') ?? defArmL;
    const bok_prawy_mm = readOptionalNumber(input, 'bok_prawy_mm') ?? defArmP;

    const wzor_nawiercen = String(input.wzor_nawiercen || 'SINGLE').toUpperCase() as ShelfHolePattern;
    const rozstaw_potrojny_z_mm = readOptionalNumber(input, 'rozstaw_potrojny_z_mm') ?? 32;
    const odstep_otworow_przod_mm = readOptionalNumber(input, 'odstep_otworow_przod_mm') ?? 40;
    const odstep_otworow_tyl_mm = readOptionalNumber(input, 'odstep_otworow_tyl_mm') ?? 40;
    const rozstaw_system32_mm = readOptionalNumber(input, 'rozstaw_system32_mm') ?? 32;
    const start_system32_z_mm = readOptionalNumber(input, 'start_system32_z_mm') ?? 150;
    const liczba_otworow_system32 = readOptionalNumber(input, 'liczba_otworow_system32') ?? 10;
    const plecy_odsuniecie_x_mm = readOptionalNumber(input, 'plecy_odsuniecie_x_mm') ?? 0;
    const plecy_odsuniecie_y_mm = readOptionalNumber(input, 'plecy_odsuniecie_y_mm') ?? 0;
    const wyciecie_listwa_narozna = input.wyciecie_listwa_narozna !== false;
    const listwa_narozna_szerokosc_mm = Math.max(0, readOptionalNumber(input, 'listwa_narozna_szerokosc_mm') ?? 100);
    const listwa_narozna_grubosc_mm = Math.max(0, readOptionalNumber(input, 'listwa_narozna_grubosc_mm') ?? 18);
    const listwa_narozna_luz_mm = Math.max(0, readOptionalNumber(input, 'listwa_narozna_luz_mm') ?? 1);
    const podporka_id = typeof input.podporka_id === 'string' && input.podporka_id.trim()
        ? input.podporka_id.trim()
        : DEFAULT_SHELF_PIN_ID;

    return {
        liczba_polek,
        grubosc_polki_mm,
        odsuniecie_przod_mm,
        luz_boczny_mm,
        bok_lewy_mm,
        bok_prawy_mm,
        wzor_nawiercen,
        rozstaw_potrojny_z_mm,
        odstep_otworow_przod_mm,
        odstep_otworow_tyl_mm,
        rozstaw_system32_mm,
        start_system32_z_mm,
        liczba_otworow_system32,
        plecy_odsuniecie_x_mm,
        plecy_odsuniecie_y_mm,
        wyciecie_listwa_narozna,
        listwa_narozna_szerokosc_mm,
        listwa_narozna_grubosc_mm,
        listwa_narozna_luz_mm,
        podporka_id
    };
}

// ─── Kalkulacja Geometrii Półek Narożnych L ──────────────────────────────────

export function calculateCornerShelvesPlan(
    dims: BlokiDimensions_mm,
    params: NormalizedCornerShelvesParams
): BlokiPlanResult {
    const parts: BlokiPart[] = [];
    const hardware: BlokiHardware[] = [];

    const {
        width_mm: W,
        height_mm: H,
        depth_mm: D
    } = dims;

    const {
        liczba_polek,
        grubosc_polki_mm,
        odsuniecie_przod_mm,
        luz_boczny_mm,
        bok_lewy_mm,
        bok_prawy_mm,
        wzor_nawiercen,
        podporka_id,
        wyciecie_listwa_narozna,
        listwa_narozna_szerokosc_mm,
        listwa_narozna_grubosc_mm,
        listwa_narozna_luz_mm
    } = params;

    if (H <= 0 || W <= 0 || D <= 0 || liczba_polek <= 0) {
        return { parts, hardware };
    }

    const pinItem = getShelfPinOrDefault(podporka_id);
    const firstHole = pinItem.machining?.corpus_holes?.[0];
    const srednica_otworu_mm = firstHole?.dia ?? 5;
    const glebokosc_otworu_mm = firstHole?.depth ?? 11;
    const promien_otworu_mm = srednica_otworu_mm / 2;

    // Grubość boczku lewego i prawego korpusu (w 100% jak wieniec narożny w corner90-geometry.ts)
    const bokLTh = 18;
    const bokPTh = 18;

    // Formatka obejmująca: W × D (w 100% gabaryt wieńca)
    const plateW = W;
    const plateD = D;

    // Granice korpusu w układzie wyśrodkowanym
    const x0 = -W / 2;
    const x1 = W / 2;
    const y0 = -D / 2;
    const y1 = D / 2;

    const safePlecyX = Math.max(0, params.plecy_odsuniecie_x_mm ?? 0);
    const safePlecyY = Math.max(0, params.plecy_odsuniecie_y_mm ?? 0);
    const effectiveX0 = x0 + safePlecyX;
    const effectiveY1 = y1 - safePlecyY;

    // Clamping długości ramion w 100% zgodny z corner90-geometry.ts (WIENIEC_D: Math.min(ctx.bok_lewy || 600, W - 10))
    const minBok = 10;
    const maxBokL = W - 10;
    const maxBokP = D - 10;
    const effBokL = Math.max(minBok, Math.min(bok_lewy_mm, maxBokL));
    const effBokP = Math.max(minBok, Math.min(bok_prawy_mm, maxBokP));

    if (bok_lewy_mm > maxBokL || bok_lewy_mm < minBok || bok_prawy_mm > maxBokP || bok_prawy_mm < minBok) {
        const msg = bok_lewy_mm > maxBokL
            ? `⚠️ Ramię półki lewej (${bok_lewy_mm} mm) przekracza gabaryt szafki — zredukowano do ${effBokL} mm`
            : bok_prawy_mm > maxBokP
            ? `⚠️ Ramię półki prawej (${bok_prawy_mm} mm) przekracza gabaryt szafki — zredukowano do ${effBokP} mm`
            : `⚠️ Ramię półki narożnej mniejsze niż minimalne ${minBok} mm — ustawiono ${minBok} mm`;
        UIController.instance?.setStatus(msg, true, 'warning');
    }

    // Odsunięcie od frontu: cofnięcie wcięcia L w głąb korpusu (obie krawędzie frontowe cofają się w stronę pleców)
    const safeOffsetFront = Math.max(0, Math.min(odsuniecie_przod_mm, effBokL - minBok, effBokP - minBok));
    const xFrontL = x0 + effBokL - safeOffsetFront;
    const yFrontP = y1 - effBokP + safeOffsetFront;

    // Luz boczny: odsunięcie krawędzi półki od boków korpusu (BOK_L i BOK_P)
    const safeLuzBoczny = Math.max(0, luz_boczny_mm);
    const yBokL = y0 + bokLTh + safeLuzBoczny;
    const xBokP = x1 - bokPTh - safeLuzBoczny;

    // Wycięcie pod listwę narożną (LISTWA_NAROZNA łączącą plecy X i Y)
    // Listwa narożna leży w narożniku [effectiveX0, effectiveY1]:
    // X w zakresie [effectiveX0, effectiveX0 + cutTh], Y w zakresie [effectiveY1 - cutW, effectiveY1]
    const hasNailerCutout = wyciecie_listwa_narozna && listwa_narozna_szerokosc_mm > 0 && listwa_narozna_grubosc_mm > 0;
    const cutW = hasNailerCutout
        ? Math.min(listwa_narozna_szerokosc_mm + listwa_narozna_luz_mm, Math.max(0, effectiveY1 - yBokL - 10))
        : 0;
    const cutTh = hasNailerCutout
        ? Math.min(listwa_narozna_grubosc_mm + listwa_narozna_luz_mm, Math.max(0, xBokP - effectiveX0 - 10))
        : 0;

    const cornerVertices: [number, number][] = (hasNailerCutout && cutW > 0 && cutTh > 0)
        ? [
            [effectiveX0 + cutTh, effectiveY1],
            [effectiveX0 + cutTh, effectiveY1 - cutW],
            [effectiveX0, effectiveY1 - cutW]
        ]
        : [
            [effectiveX0, effectiveY1]
        ];

    // Wierzchołki L (zgodne z orientacją WIENIEC_D w corner90-geometry.ts, z uwzględnieniem odsunięcia frontu, luzu bocznego i wycięcia pod listwę narożną):
    const worldL: [number, number][] = [
        [effectiveX0, yBokL],
        [xFrontL, yBokL],
        [xFrontL, yFrontP],
        [xBokP, yFrontP],
        [xBokP, effectiveY1],
        ...cornerVertices
    ];

    // Rzutowanie do UV formatki zgodnie z orientacją wieńca dolnego [90, 180, 0]
    // (rotX=90, rotY=180 -> flipU = true, flipV = false, kolejność punktów reverse)
    const outlineUv = worldL.map(([wx, wy]) => [
        Math.round((plateW / 2 - wx) * 100) / 100,
        Math.round((wy + plateD / 2) * 100) / 100
    ]);
    const outline2d = outlineUv.slice().reverse();

    // Obrzeża formatki półki L: tak jak wieniec narożny — krawędzie przednie i notch oklejone
    const edgeBanding = {
        "+X": { active: false, type_id: "none" },
        "-X": { active: false, type_id: "none" },
        "+Y": { active: false, type_id: "none" },
        "-Y": { active: true, type_id: "0.008x0.022" },
        "NOTCH": { active: true, type_id: "0.008x0.022" }
    };

    const frontInset = params.odstep_otworow_przod_mm ?? 40;
    const backInset = params.odstep_otworow_tyl_mm ?? 40;

    for (let i = 1; i <= liczba_polek; i++) {
        const srodek_z_mm = equalShelfCenterZ(H, liczba_polek, grubosc_polki_mm, i);
        const pinCenterZ = srodek_z_mm - grubosc_polki_mm / 2 - promien_otworu_mm;

        const xFrontHole = xFrontL - frontInset;
        const xBackHole = effectiveX0 + backInset;
        const yFrontHole = yFrontP + frontInset;
        const yBackHole = effectiveY1 - backInset;

        const buildCornerShelfSupportHoles = (): any[] => {
            if (wzor_nawiercen !== 'SINGLE' && wzor_nawiercen !== 'TRIPLE') return [];

            const feats: any[] = [];
            const holeZ_mm = srodek_z_mm - grubosc_polki_mm / 2 - promien_otworu_mm;

            const addHole = (id: string, name: string, face: string, u: number, v: number, pinSuffix: string) => {
                const hwId = `corner_shelf_${i}_pin_${pinSuffix}`;
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
                    drivenBy: { nodeId: hwId, role: 'HARDWARE', hardwareType: 'SHELF_PIN' },
                    sourcePartId: hwId,
                    generatedBy: 'blok_corner_shelves',
                    extraParams: {
                        template_id: wzor_nawiercen,
                        clearance: luz_boczny_mm,
                        shelfZ: srodek_z_mm,
                        holeZ: holeZ_mm,
                        is_assembly_drilling: true
                    }
                });
                const feat = intent.feature as any;
                feat.is_assembly_drilling = true;
                feat.visible = false;
                feats.push(feat);
            };

            const uUnderLeft = -promien_otworu_mm;
            const uUnderRight = grubosc_polki_mm + promien_otworu_mm;

            addHole(`hole_corner_shelf_${i}_left_front`, 'Lewy przód', 'FACE_X_MINUS', uUnderLeft, xFrontHole - x0, 'LF');
            addHole(`hole_corner_shelf_${i}_left_back`, 'Lewy tył', 'FACE_X_MINUS', uUnderLeft, xBackHole - x0, 'LB');
            addHole(`hole_corner_shelf_${i}_right_front`, 'Prawy przód', 'FACE_X_PLUS', uUnderRight, y1 - yFrontHole, 'RF');
            addHole(`hole_corner_shelf_${i}_right_back`, 'Prawy tył', 'FACE_X_PLUS', uUnderRight, y1 - yBackHole, 'RB');

            if (wzor_nawiercen === 'TRIPLE') {
                const dz = params.rozstaw_potrojny_z_mm ?? 32;
                addHole(`hole_corner_shelf_${i}_left_front_top`, 'Lewy przód góra', 'FACE_X_MINUS', uUnderLeft + dz, xFrontHole - x0, 'LF');
                addHole(`hole_corner_shelf_${i}_left_front_bottom`, 'Lewy przód dół', 'FACE_X_MINUS', uUnderLeft - dz, xFrontHole - x0, 'LF');
                addHole(`hole_corner_shelf_${i}_left_back_top`, 'Lewy tył góra', 'FACE_X_MINUS', uUnderLeft + dz, xBackHole - x0, 'LB');
                addHole(`hole_corner_shelf_${i}_left_back_bottom`, 'Lewy tył dół', 'FACE_X_MINUS', uUnderLeft - dz, xBackHole - x0, 'LB');

                addHole(`hole_corner_shelf_${i}_right_front_top`, 'Prawy przód góra', 'FACE_X_PLUS', uUnderRight - dz, y1 - yFrontHole, 'RF');
                addHole(`hole_corner_shelf_${i}_right_front_bottom`, 'Prawy przód dół', 'FACE_X_PLUS', uUnderRight + dz, y1 - yFrontHole, 'RF');
                addHole(`hole_corner_shelf_${i}_right_back_top`, 'Prawy tył góra', 'FACE_X_PLUS', uUnderRight - dz, y1 - yBackHole, 'RB');
                addHole(`hole_corner_shelf_${i}_right_back_bottom`, 'Prawy tył dół', 'FACE_X_PLUS', uUnderRight + dz, y1 - yBackHole, 'RB');
            }

            return feats;
        };

        const features = buildCornerShelfSupportHoles();

        // Podpórki fizyczne (HARDWARE w 3D pod półką na ściankach bocznych korpusu)
        if (wzor_nawiercen !== 'NONE') {
            hardware.push(
                {
                    id: `corner_shelf_${i}_pin_LF`,
                    name: `Podpórka ${i} (Lewy Przód)`,
                    hardwareType: 'SHELF_PIN',
                    hardwareId: podporka_id || 'PODPORKA_FI5',
                    side: 'left',
                    loc: { x: xFrontHole, y: y0 + bokLTh, z: pinCenterZ },
                    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
                    params: { shelfIndex: i, position: 'LF', side: 'left' }
                },
                {
                    id: `corner_shelf_${i}_pin_LB`,
                    name: `Podpórka ${i} (Lewy Tył)`,
                    hardwareType: 'SHELF_PIN',
                    hardwareId: podporka_id || 'PODPORKA_FI5',
                    side: 'left',
                    loc: { x: xBackHole, y: y0 + bokLTh, z: pinCenterZ },
                    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
                    params: { shelfIndex: i, position: 'LB', side: 'left' }
                },
                {
                    id: `corner_shelf_${i}_pin_RF`,
                    name: `Podpórka ${i} (Prawy Przód)`,
                    hardwareType: 'SHELF_PIN',
                    hardwareId: podporka_id || 'PODPORKA_FI5',
                    side: 'right',
                    loc: { x: x1 - bokPTh, y: yFrontHole, z: pinCenterZ },
                    rotation: { x: 0, y: 0, z: Math.PI / 2 },
                    params: { shelfIndex: i, position: 'RF', side: 'right' }
                },
                {
                    id: `corner_shelf_${i}_pin_RB`,
                    name: `Podpórka ${i} (Prawy Tył)`,
                    hardwareType: 'SHELF_PIN',
                    hardwareId: podporka_id || 'PODPORKA_FI5',
                    side: 'right',
                    loc: { x: x1 - bokPTh, y: yBackHole, z: pinCenterZ },
                    rotation: { x: 0, y: 0, z: Math.PI / 2 },
                    params: { shelfIndex: i, position: 'RB', side: 'right' }
                }
            );
        }

        parts.push({
            name: `Polka_${i}`,
            role: 'SHELF',
            report_type: 'SHELF',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: plateW, y: plateD, z: grubosc_polki_mm },
            loc: {
                x: 0,
                y: 0,
                z: srodek_z_mm
            },
            lcs: {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [90, 180, 0],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            },
            edge_banding: edgeBanding,
            customProperties: {
                shape: 'L_NOTCH',
                outline2d,
                is_corner_shelf: true
            },
            features
        });
    }

    return { parts, hardware };
}
