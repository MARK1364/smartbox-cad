/**
 * 19_sliding-doors-engine.ts — Bloki DRZWI PRZESUWNE (blok_sliding_doors)
 *
 * System drzwi przesuwnych w standardzie Sevroll (np. Gemini / Elegant / Alfa).
 * Skrzydła mijają się w dwóch torach (przednim i tylnym), posiadają profile rączek
 * na pełnej wysokości po lewej i prawej stronie każdego skrzydła, tor górny i dolny
 * oraz wózki prowadzące i toczne.
 *
 * Faza 1: wszystkie elementy (skrzydła, tor, rolki, rączki) są boxami (placeholder).
 * Faza 2: rolki/rączki → GLB (hardware-loader), tor/profile → parametryczna ekstruzja
 * przekroju 2D (polygon-extrusion / alu-frame-profile).
 *
 * Konwencja osi (jak moduł DOORS, CAD Z-up):
 *   X = szerokość (lewo ↔ prawo), środek = 0
 *   Y = głębokość (przód = -Y, tył = +Y)
 *   Z = wysokość (dół = 0 / -Z, góra = +Z)
 *
 * LCS skrzydła (jak front drzwiowy): mapping {X:'x', Y:'z', Z:'y'}
 *   → dim.x = szerokość, dim.z = wysokość, dim.y = grubość.
 *
 * Jednostki: mm (zgodnie z .agents/AGENTS.md — planowanie Bloki w milimetrach).
 */

import type {
    BlokiDimensions_mm,
    BlokiPart,
    BlokiPlanResult
} from './01_bloki-types.js';
import type { SlidingDoorsPlanParams, SlidingRollerType } from './01_bloki-module-types.js';
import {
    assertCanonicalSlidingDoorsParams
} from './01_bloki-module-param-guards.js';

export { assertCanonicalSlidingDoorsParams, LEGACY_SLIDING_DOORS_PARAM_ALIASES }
    from './01_bloki-module-param-guards.js';

// ─── Typy domenowe ────────────────────────────────────────────────────────────

export interface NormalizedSlidingDoorsParams {
    liczba_skrzydel: number;
    grubosc_frontu_mm: number;
    szczelina_mm: number;
    zaklad: number;
    zakladka_mm: number;
    nalozenie_gora_mm: number;
    nalozenie_dol_mm: number;
    nalozenie_lewe_mm: number;
    nalozenie_prawe_mm: number;
    typ_rolki: SlidingRollerType;
    producent_rolek: string;
    roller_id: string;
    handle_id: string;
    tor_gorny_wysokosc_mm: number;
    tor_gorny_glebokosc_mm: number;
    tor_gorny_cofniecie_mm: number;
    tor_dolny_wysokosc_mm: number;
    tor_dolny_glebokosc_mm: number;
    tor_dolny_cofniecie_mm: number;
    rozstaw_torow_mm: number;
    szerokosc_raczki_mm: number;
    grubosc_raczki_mm: number;
    pokaz_rolki: boolean;
    pokaz_raczki: boolean;
}

/** LCS frontu (jak moduł DOORS): dim.x→szerokość, dim.z→wysokość, dim.y→grubość. */
const FRONT_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' },
    rotation: [0, 0, 0] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

/** Obrzeża frontu (kanoniczne dla wszystkich skrzydeł). */
const FRONT_EDGE_BANDING = {
    "+X": { active: true, type_id: "0.008x0.022" },
    "-X": { active: true, type_id: "0.008x0.022" },
    "+Y": { active: true, type_id: "0.008x0.022" },
    "-Y": { active: true, type_id: "0.008x0.022" }
};

/** Minimalny rozmiar elementu, żeby nie powstała degeneracja geometryczna. */
const MIN_DIM_MM = 1;

function clamp(v: number, min: number, max: number): number {
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
}

/**
 * Wylicza rekomendowaną / domyślną liczbę skrzydeł w zależności od szerokości wnęki
 * wg wytycznych projektowych systemów Sevroll (optymalna szerokość skrzydła: 600–900 mm).
 */
export function calculateDefaultSlidingDoorsCount(width_mm: number): number {
    if (!Number.isFinite(width_mm) || width_mm <= 0) return 2;
    if (width_mm < 1800) return 2;
    if (width_mm < 2700) return 3;
    if (width_mm < 3600) return 4;
    return 5;
}

// ─── Normalizacja (czysta funkcja, fail-fast) ─────────────────────────────────

/**
 * Kanoniczne wejście modułu drzwi przesuwnych (generatorParams / plan).
 * Zero fallbacków ukrytych — brakujące wartości dostają jawne domyślne.
 */
export function normalizeSlidingDoorsParams(
    raw: SlidingDoorsPlanParams = {},
    dims: BlokiDimensions_mm
): NormalizedSlidingDoorsParams {
    assertCanonicalSlidingDoorsParams(raw);

    const defaultLeaves = calculateDefaultSlidingDoorsCount(dims.width_mm);
    const liczba_skrzydel = clamp(Math.floor(Number(raw.liczba_skrzydel ?? defaultLeaves)), 1, 6);
    const grubosc_frontu_mm = Number(raw.grubosc_frontu_mm ?? 18);
    const szczelina_mm = Number(raw.szczelina_mm ?? 4);
    const zaklad = Number(raw.zaklad ?? 1.0);
    // Standardowy zakład (overlap) Sevroll = 30 mm (szerokość profilu rączki)
    const zakladka_mm = Number(raw.zakladka_mm ?? 30);

    const nalozenie_gora_mm = Number(raw.nalozenie_gora_mm ?? 0);
    const nalozenie_dol_mm = Number(raw.nalozenie_dol_mm ?? 0);
    const nalozenie_lewe_mm = Number(raw.nalozenie_lewe_mm ?? 0);
    const nalozenie_prawe_mm = Number(raw.nalozenie_prawe_mm ?? 0);

    const rawRollerType = String(raw.typ_rolki ?? 'BOTTOM').toUpperCase();
    const typ_rolki: SlidingRollerType =
        rawRollerType === 'TOP' ? 'TOP' :
        rawRollerType === 'BOTH' ? 'BOTH' : 'BOTTOM';

    const producent_rolek = String(raw.producent_rolek ?? 'SEVROLL');
    const roller_id = String(raw.roller_id ?? 'SEVROLL_GEMINI_ROLLER');
    const handle_id = String(raw.handle_id ?? 'SEVROLL_ALFA_HANDLE');

    // Wymiary toru górnego i dolnego wg standardu Sevroll (np. Gemini / Elegant)
    const tor_gorny_wysokosc_mm = Number(raw.tor_gorny_wysokosc_mm ?? 40);
    const tor_gorny_glebokosc_mm = Number(raw.tor_gorny_glebokosc_mm ?? 75);
    const tor_gorny_cofniecie_mm = Number(raw.tor_gorny_cofniecie_mm ?? 0);

    const tor_dolny_wysokosc_mm = Number(raw.tor_dolny_wysokosc_mm ?? raw.prowadnica_dolna_wysokosc_mm ?? 10);
    const tor_dolny_glebokosc_mm = Number(raw.tor_dolny_glebokosc_mm ?? raw.prowadnica_dolna_glebokosc_mm ?? 60);
    const tor_dolny_cofniecie_mm = Number(raw.tor_dolny_cofniecie_mm ?? raw.prowadnica_dolna_cofniecie_mm ?? 0);

    const rozstaw_torow_mm = Number(raw.rozstaw_torow_mm ?? 35);
    const szerokosc_raczki_mm = Number(raw.szerokosc_raczki_mm ?? 25);
    const grubosc_raczki_mm = Number(raw.grubosc_raczki_mm ?? 28);

    const pokaz_rolki = raw.pokaz_rolki !== false;
    const pokaz_raczki = raw.pokaz_raczki !== false;

    return {
        liczba_skrzydel,
        grubosc_frontu_mm,
        szczelina_mm,
        zaklad,
        zakladka_mm,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm,
        typ_rolki,
        producent_rolek,
        roller_id,
        handle_id,
        tor_gorny_wysokosc_mm,
        tor_gorny_glebokosc_mm,
        tor_gorny_cofniecie_mm,
        tor_dolny_wysokosc_mm,
        tor_dolny_glebokosc_mm,
        tor_dolny_cofniecie_mm,
        rozstaw_torow_mm,
        szerokosc_raczki_mm,
        grubosc_raczki_mm,
        pokaz_rolki,
        pokaz_raczki
    };
}

// ─── Czysta Funkcja Kalkulacji Planu Drzwi Przesuwnych ─────────────────────────

/**
 * Czysta funkcja matematyczna generująca formatki (boxy placeholder) dla
 * modułu Drzwi Przesuwne w standardzie Sevroll. Zero stanu, zero zależności od sceny/DOM/Babylon.
 *
 * Cechy geometrii:
 * 1. Skrzydła mijają się w osi Y dzięki rozstawowi torów przedniego i tylnego.
 * 2. Każde skrzydło ma na lewym i prawym boku profile rączek biegnące po całej wysokości.
 * 3. Tor górny i tor dolny podwójny spinają system od góry i od dołu.
 * 4. Szerokość skrzydła wyliczana jest ze wzoru Sevroll: (W + (n - 1) * Z) / n.
 */
export function calculateSlidingDoorsPlan(
    dims: BlokiDimensions_mm,
    params: NormalizedSlidingDoorsParams
): BlokiPlanResult {
    const parts: BlokiPart[] = [];

    const {
        width_mm: szerokosc_strefy_mm,
        height_mm: wysokosc_strefy_mm,
        depth_mm: glebokosc_strefy_mm
    } = dims;

    const {
        liczba_skrzydel,
        grubosc_frontu_mm,
        zakladka_mm,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm,
        typ_rolki,
        roller_id,
        handle_id,
        tor_gorny_wysokosc_mm,
        tor_gorny_glebokosc_mm,
        tor_gorny_cofniecie_mm,
        tor_dolny_wysokosc_mm,
        tor_dolny_glebokosc_mm,
        tor_dolny_cofniecie_mm,
        rozstaw_torow_mm,
        szerokosc_raczki_mm,
        grubosc_raczki_mm,
        pokaz_rolki,
        pokaz_raczki
    } = params;

    const n = Math.max(1, liczba_skrzydel);
    const szerokosc_calkowita_mm = szerokosc_strefy_mm + nalozenie_lewe_mm + nalozenie_prawe_mm;

    // ─── Wzór Sevroll na szerokość pojedynczego skrzydła ─────────────────────────
    // Sd = (W + (n - 1) * Z) / n
    const szerokosc_skrzydla_mm = Math.max(
        MIN_DIM_MM,
        (szerokosc_calkowita_mm + (n - 1) * zakladka_mm) / n
    );

    // ─── Wysokość skrzydła wg Sevroll (ubytek wysokości = 40 mm) ────────────────
    // H_drzwi = H_wneki - 40 mm
    const ubytek_wysokosci_sevroll_mm = 40;
    const calkowita_wysokosc_drzwi_mm = Math.max(
        MIN_DIM_MM,
        wysokosc_strefy_mm - ubytek_wysokosci_sevroll_mm + nalozenie_gora_mm + nalozenie_dol_mm
    );

    // Pozycja w pionie Z:
    // Dolna krawędź skrzydła uniesiona 12 mm nad spód (regulacja wózka dolnego Sevroll 10-15 mm)
    const z_dol_skrzydla_mm = -nalozenie_dol_mm + 12;
    const pozycja_z_mm = z_dol_skrzydla_mm + calkowita_wysokosc_drzwi_mm / 2;

    // ─── Pozycjonowanie w osi Y (mijanie się skrzydeł) ──────────────────────────
    // Przód korpusu / wnęki to -depth / 2.
    // Tor jest montowany przy przedniej krawędzi (z uwzględnieniem cofnięcia).
    const tor_y_center_mm =
        -(glebokosc_strefy_mm / 2) + tor_gorny_cofniecie_mm + tor_gorny_glebokosc_mm / 2;

    // Dwa tory: przedni (zewnętrzny) i tylny (wewnętrzny) o zadanym rozstawie
    const track_front_y_mm = tor_y_center_mm - rozstaw_torow_mm / 2;
    const track_rear_y_mm = tor_y_center_mm + rozstaw_torow_mm / 2;

    // ─── Tor górny podwójny (box placeholder) ───────────────────────────────────
    const tor_gorny_z_mm =
        (wysokosc_strefy_mm + nalozenie_gora_mm) - tor_gorny_wysokosc_mm / 2;

    parts.push({
        name: 'Tor_Gorny',
        role: 'SLIDING_TRACK',
        nodeType: 'PART',
        material: 'ALU_NATURAL',
        materialName: 'Aluminium',
        materialCode: 'ALU',
        dim: {
            x: szerokosc_strefy_mm,
            y: tor_gorny_glebokosc_mm,
            z: tor_gorny_wysokosc_mm
        },
        loc: { x: 0, y: tor_y_center_mm, z: tor_gorny_z_mm },
        lcs: FRONT_LCS,
        meta: {
            sliding: true,
            track: 'TOP',
            hardwareId: 'SEVROLL_TOP_TRACK',
            phase: 1,
            phase2: 'profile-extrusion'
        }
    });

    // ─── Tor dolny podwójny (box placeholder) ───────────────────────────────────
    const tor_dolny_y_center_mm =
        -(glebokosc_strefy_mm / 2) + tor_dolny_cofniecie_mm + tor_dolny_glebokosc_mm / 2;
    const tor_dolny_z_mm = -nalozenie_dol_mm + tor_dolny_wysokosc_mm / 2;

    parts.push({
        name: 'Tor_Dolny',
        role: 'SLIDING_TRACK',
        nodeType: 'PART',
        material: 'ALU_NATURAL',
        materialName: 'Aluminium',
        materialCode: 'ALU',
        dim: {
            x: szerokosc_strefy_mm,
            y: tor_dolny_glebokosc_mm,
            z: tor_dolny_wysokosc_mm
        },
        loc: { x: 0, y: tor_dolny_y_center_mm, z: tor_dolny_z_mm },
        lcs: FRONT_LCS,
        meta: {
            sliding: true,
            track: 'BOTTOM',
            hardwareId: 'SEVROLL_BOTTOM_TRACK',
            phase: 1,
            phase2: 'profile-extrusion'
        }
    });

    // ─── Skrzydła z profilami rączek po bokach i rolkami ────────────────────────
    const x_start_mm = -szerokosc_strefy_mm / 2 - nalozenie_lewe_mm;

    for (let i = 0; i < n; i++) {
        // Skrzydła mijają się w Y: naprzemiennie tor tylny i przedni
        const isFrontTrack = (i % 2 === 1);
        const leaf_y_mm = isFrontTrack ? track_front_y_mm : track_rear_y_mm;

        // Krawędzie i środek skrzydła w X
        const leaf_left_x_mm = x_start_mm + i * (szerokosc_skrzydla_mm - zakladka_mm);
        const leaf_right_x_mm = leaf_left_x_mm + szerokosc_skrzydla_mm;
        const leaf_center_x_mm = leaf_left_x_mm + szerokosc_skrzydla_mm / 2;

        // Rączki po całości na lewym i prawym boku skrzydła (standard Sevroll)
        if (pokaz_raczki) {
            // Rączka lewa
            parts.push({
                name: `Raczka_Lewa_${i + 1}`,
                role: 'SLIDING_TRACK',
                nodeType: 'PART',
                material: 'ALU_NATURAL',
                materialName: 'Aluminium',
                materialCode: 'ALU',
                dim: {
                    x: szerokosc_raczki_mm,
                    y: grubosc_raczki_mm,
                    z: calkowita_wysokosc_drzwi_mm
                },
                loc: {
                    x: leaf_left_x_mm + szerokosc_raczki_mm / 2,
                    y: leaf_y_mm,
                    z: pozycja_z_mm
                },
                lcs: FRONT_LCS,
                meta: {
                    sliding: true,
                    handle: true,
                    side: 'left',
                    leafIndex: i,
                    hardwareId: handle_id,
                    phase: 1
                }
            });

            // Rączka prawa
            parts.push({
                name: `Raczka_Prawa_${i + 1}`,
                role: 'SLIDING_TRACK',
                nodeType: 'PART',
                material: 'ALU_NATURAL',
                materialName: 'Aluminium',
                materialCode: 'ALU',
                dim: {
                    x: szerokosc_raczki_mm,
                    y: grubosc_raczki_mm,
                    z: calkowita_wysokosc_drzwi_mm
                },
                loc: {
                    x: leaf_right_x_mm - szerokosc_raczki_mm / 2,
                    y: leaf_y_mm,
                    z: pozycja_z_mm
                },
                lcs: FRONT_LCS,
                meta: {
                    sliding: true,
                    handle: true,
                    side: 'right',
                    leafIndex: i,
                    hardwareId: handle_id,
                    phase: 1
                }
            });
        }

        // Płyta wypełniająca (front)
        const szerokosc_plyty_mm = Math.max(
            MIN_DIM_MM,
            szerokosc_skrzydla_mm - (pokaz_raczki ? 2 * szerokosc_raczki_mm : 0)
        );

        const leafName = n === 1 ? 'Drzwi_Przesuwne' : `Drzwi_Przesuwne_${i + 1}`;
        parts.push({
            name: leafName,
            role: 'SLIDING_DOOR',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: {
                x: szerokosc_plyty_mm,
                y: grubosc_frontu_mm,
                z: calkowita_wysokosc_drzwi_mm
            },
            loc: { x: leaf_center_x_mm, y: leaf_y_mm, z: pozycja_z_mm },
            lcs: FRONT_LCS,
            edge_banding: FRONT_EDGE_BANDING,
            meta: {
                sliding: true,
                leafIndex: i,
                leafCount: n,
                track: isFrontTrack ? 'FRONT' : 'REAR',
                phase: 1
            }
        });

        // Rolki (wózki górne i toczne dolne w torach)
        if (pokaz_rolki) {
            const roller_w_mm = 24;
            const roller_d_mm = 18;
            const roller_h_mm = 24;
            const roller_inset_mm = Math.min(szerokosc_skrzydla_mm / 4, 70);

            const placeRoller = (x: number, z: number, suffix: string, side: 'L' | 'R') => {
                parts.push({
                    name: `Rolka_${suffix}_${side}`,
                    role: 'SLIDING_TRACK',
                    nodeType: 'PART',
                    material: 'ALU_NATURAL',
                    materialName: 'Aluminium',
                    materialCode: 'ALU',
                    dim: { x: roller_w_mm, y: roller_d_mm, z: roller_h_mm },
                    loc: { x, y: leaf_y_mm, z },
                    lcs: FRONT_LCS,
                    meta: {
                        sliding: true,
                        roller: true,
                        leafIndex: i,
                        track: isFrontTrack ? 'FRONT' : 'REAR',
                        hardwareId: roller_id,
                        phase: 1,
                        phase2: 'hardware-glb'
                    }
                });
            };

            const rxL = leaf_left_x_mm + roller_inset_mm;
            const rxR = leaf_right_x_mm - roller_inset_mm;

            // Rolki górne (w torze górnym na pozycji Y skrzydła)
            if (typ_rolki === 'TOP' || typ_rolki === 'BOTH') {
                placeRoller(rxL, tor_gorny_z_mm, `TG_${i + 1}`, 'L');
                placeRoller(rxR, tor_gorny_z_mm, `TG_${i + 1}`, 'R');
            }

            // Wózki dolne (w torze dolnym na pozycji Y skrzydła)
            if (typ_rolki === 'BOTTOM' || typ_rolki === 'BOTH') {
                placeRoller(rxL, tor_dolny_z_mm, `TD_${i + 1}`, 'L');
                placeRoller(rxR, tor_dolny_z_mm, `TD_${i + 1}`, 'R');
            }
        }
    }

    return { parts };
}
