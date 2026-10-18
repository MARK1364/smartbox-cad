/**
 * smartframe-types.ts
 *
 * Wspólne typy i kontrakty DTO dla modułu SmartFrame (korpusy mebli).
 * Architektura funkcyjna, jawne jednostki fizyczne w nazwach (_mm, _deg, _count).
 * Zgodność z .agents/AGENTS.md:
 *  - role ('BODY', 'LEFT_SIDE_PANEL', 'RIGHT_SIDE_PANEL', 'BOTTOM_PANEL', 'TOP_PANEL', 'BACK_PANEL')
 *  - formatki w milimetrach na poziomie planowania korpusu
 */

export type CabinetType =
    | 'korpus3'
    | 'korpus_rogowy1'
    | 'korpus_rogowy90'
    | 'korpus_skosny'
    | 'korpus_skosny_dach'
    | 'korpus_skosny_lr'
    | 'korpus_skosny_lr_uc';

export interface CabinetDimensions_mm {
    szerokosc_mm: number;
    wysokosc_mm: number;
    glebokosc_mm: number;
}

export interface CabinetEdgeBandingRule {
    active?: boolean;
    type_id?: string;
    cutAngle?: number;
    cutAnchor?: 'Z_PLUS' | 'Z_MINUS' | string;
}

export interface CabinetLcsDefinition {
    mapping?: { X: string; Y: string; Z: string };
    rotation?: number[];
    faces?: { INNER: string; OUTER: string };
}

export interface CabinetGeometryPart {
    key: string;
    name: string;
    role: string;
    material: string;
    materialName?: string;
    materialCode?: string;
    thickness: number;
    dim: { x: number; y: number; z: number }; // wymiary formatki w mm
    loc: { x: number; y: number; z: number }; // pozycja lokalna środka formatki w mm
    zonePrefix: string;
    zoneId: string;
    customProperties: Record<string, any>;
    lcs?: CabinetLcsDefinition;
    edge_banding?: Record<string, CabinetEdgeBandingRule>;
}

export interface ZoneLayout {
    zoneKey: string;
    size: number;
    baseOffset: number;
}

export interface CabinetPlanResult {
    parts: CabinetGeometryPart[];
    zones: ZoneLayout[];
}

export interface NormalizedCabinetParams {
    typ_korpusu: CabinetType;
    szerokosc_mm: number;
    wysokosc_mm: number;
    glebokosc_mm: number;
    liczba_stref: 1 | 2 | 3;
    wysokosc_strefy_dolnej_mm?: number;
    wysokosc_strefy_srodkowej_mm?: number;
    cofniecie_plecow_mm: number;
    grubosc_plecow_mm: number;
    wpuszczenie_plecow_mm: number;
    tryb_wienca_gornego: 'FULL' | 'TRAVERSE_H' | 'TRAVERSE_V';
    szerokosc_trawersu_mm: number;
    szerokosc_blendy_mm?: number;
    strona_blendy: 'LEFT' | 'RIGHT';
    glebokosc_boku_lewego_mm?: number;
    glebokosc_boku_prawego_mm?: number;
    wysokosc_przod_mm?: number;
    wysokosc_tyl_mm?: number;
    wysokosc_lewy_mm?: number;
    wysokosc_prawy_mm?: number;
    offsets?: Record<string, number>;
    container?: any;
}

/**
 * Kanoniczne wejście silnika korpusu.
 *
 * TYLKO pola z jawną jednostką fizyczną. Świadomie brak: `width`/`height`/`depth`,
 * `zoneCount`, `bottomHeight`, `middleHeight`, `backOffsetMm`, `topPanelMode`,
 * `traverseWidth`, `blindWidth`, `blindSide`, `armDepth`, `bokLewy`, `bokPrawy`,
 * `heightFront/Back/Left/Right`, `kat_skosu_deg` oraz polskie aliasy
 * (`wysokosc_dolu_mm`, `szerokosc_zaslepki_mm`, `wysokosc_lewa_mm`, …).
 * Zob. .agents/AGENTS.md oraz LEGACY_CABINET_PARAM_ALIASES.
 */
export interface CabinetPlanParams {
    szerokosc_mm?: number;
    wysokosc_mm?: number;
    glebokosc_mm?: number;
    liczba_stref?: 1 | 2 | 3;
    wysokosc_strefy_dolnej_mm?: number;
    wysokosc_strefy_srodkowej_mm?: number;
    cofniecie_plecow_mm?: number;
    grubosc_plecow_mm?: number;
    wpuszczenie_plecow_mm?: number;
    tryb_wienca_gornego?: 'FULL' | 'TRAVERSE_H' | 'TRAVERSE_V';
    szerokosc_trawersu_mm?: number;
    szerokosc_blendy_mm?: number;
    strona_blendy?: 'LEFT' | 'RIGHT';
    glebokosc_boku_lewego_mm?: number;
    glebokosc_boku_prawego_mm?: number;
    wysokosc_przod_mm?: number;
    wysokosc_tyl_mm?: number;
    wysokosc_lewy_mm?: number;
    wysokosc_prawy_mm?: number;
    typ_korpusu?: CabinetType;
    offsets?: Record<string, number>;
    container?: any;
}

/**
 * Wycofane nazwy parametrów korpusu → nazwa kanoniczna.
 *
 * SSOT strażnika: gdy na wejściu pojawi się wycofany klucz, `assertCanonicalCabinetParams`
 * rzuca czytelnym błędem zamiast po cichu zgadywać wartość. Ten sam słownik obsługuje
 * skrypt audytu CI (`scripts/audit-display-name-logic.mjs`).
 *
 * Wyjątek celowy: patrz `GIZMO_EXCEPTED_CABINET_PARAM_KEYS`.
 */
export const GIZMO_EXCEPTED_CABINET_PARAM_KEYS: readonly string[] = [
    'backOffset', 'topPanelMode', 'traverseWidth'
];

export const LEGACY_CABINET_PARAM_ALIASES: Readonly<Record<string, string>> = {
    width: 'szerokosc_mm',
    height: 'wysokosc_mm',
    depth: 'glebokosc_mm',
    width_mm: 'szerokosc_mm',
    height_mm: 'wysokosc_mm',
    depth_mm: 'glebokosc_mm',
    zoneCount: 'liczba_stref',
    zone_count: 'liczba_stref',
    bottomHeight: 'wysokosc_strefy_dolnej_mm',
    bottom_height: 'wysokosc_strefy_dolnej_mm',
    wysokosc_dolu_mm: 'wysokosc_strefy_dolnej_mm',
    middleHeight: 'wysokosc_strefy_srodkowej_mm',
    middle_height: 'wysokosc_strefy_srodkowej_mm',
    wysokosc_srodka_mm: 'wysokosc_strefy_srodkowej_mm',
    backOffsetMm: 'cofniecie_plecow_mm',
    back_offset_mm: 'cofniecie_plecow_mm',
    backThickness: 'grubosc_plecow_mm',
    back_thickness: 'grubosc_plecow_mm',
    backOverlap: 'wpuszczenie_plecow_mm',
    back_overlap: 'wpuszczenie_plecow_mm',
    topPanelMode: 'tryb_wienca_gornego',
    top_panel_mode: 'tryb_wienca_gornego',
    traverseWidth: 'szerokosc_trawersu_mm',
    traverse_width: 'szerokosc_trawersu_mm',
    blindWidth: 'szerokosc_blendy_mm',
    blind_width: 'szerokosc_blendy_mm',
    szerokosc_zaslepki_mm: 'szerokosc_blendy_mm',
    blindSide: 'strona_blendy',
    blind_side: 'strona_blendy',
    strona_zaslepki: 'strona_blendy',
    armDepth: 'glebokosc_boku_lewego_mm',
    arm_depth: 'glebokosc_boku_lewego_mm',
    armDepthX: 'glebokosc_boku_lewego_mm',
    bokLewy: 'glebokosc_boku_lewego_mm',
    bok_lewy: 'glebokosc_boku_lewego_mm',
    armDepthY: 'glebokosc_boku_prawego_mm',
    bokPrawy: 'glebokosc_boku_prawego_mm',
    bok_prawy: 'glebokosc_boku_prawego_mm',
    heightFront: 'wysokosc_przod_mm',
    height_front: 'wysokosc_przod_mm',
    heightBack: 'wysokosc_tyl_mm',
    height_back: 'wysokosc_tyl_mm',
    heightLeft: 'wysokosc_lewy_mm',
    height_left: 'wysokosc_lewy_mm',
    wysokosc_lewa_mm: 'wysokosc_lewy_mm',
    heightRight: 'wysokosc_prawy_mm',
    height_right: 'wysokosc_prawy_mm',
    wysokosc_prawa_mm: 'wysokosc_prawy_mm',
    // `kat_skosu_deg` / `cutAngle` celowo NIE mają tu wpisu: to był martwy parametr
    // wejściowy (normalizowany, mostkowany, nigdy nieczytany przez geometrię) i został usunięty.
    // Kąt cięcia obrzeża nadal istnieje, ale jako pole WYJŚCIOWE edge_banding[].cutAngle.
    cabinetType: 'typ_korpusu'
};

/** Kanoniczne klucze korpusu — SSOT dla strażnika CI i dla typów. */
export const CANONICAL_CABINET_PARAM_KEYS: readonly string[] = [
    'szerokosc_mm', 'wysokosc_mm', 'glebokosc_mm', 'liczba_stref',
    'wysokosc_strefy_dolnej_mm', 'wysokosc_strefy_srodkowej_mm',
    'cofniecie_plecow_mm', 'grubosc_plecow_mm', 'wpuszczenie_plecow_mm',
    'tryb_wienca_gornego', 'szerokosc_trawersu_mm',
    'szerokosc_blendy_mm', 'strona_blendy',
    'glebokosc_boku_lewego_mm', 'glebokosc_boku_prawego_mm',
    'wysokosc_przod_mm', 'wysokosc_tyl_mm', 'wysokosc_lewy_mm', 'wysokosc_prawy_mm',
    'typ_korpusu', 'offsets', 'container'
];

/**
 * Fail-fast: odrzuca wejście z wycofanymi nazwami kluczy.
 * Zamiast cicho nadpisać wartość domenową błędną (albo zgadywać), mówi wprost co poprawić.
 *
 * Klucze gizma (`GIZMO_EXCEPTED_CABINET_PARAM_KEYS`) są świadomie pomijane — należą do
 * A1_core/gizmo-controller, są zapisywane w generatorParams i mapowane na brzegu A3.
 */
export function assertCanonicalCabinetParams(raw: Record<string, any> | null | undefined): void {
    if (!raw) return;
    const found: string[] = [];
    for (const key of Object.keys(raw)) {
        if (raw[key] === undefined) continue;
        if (GIZMO_EXCEPTED_CABINET_PARAM_KEYS.includes(key)) continue;
        const canonical = LEGACY_CABINET_PARAM_ALIASES[key];
        if (canonical && canonical !== key) found.push(`${key} → ${canonical}`);
    }
    if (found.length === 0) return;
    throw new Error(
        `SmartFrame: wycofane nazwy parametrów korpusu (${found.join(', ')}). ` +
        `Użyj wyłącznie kanonicznych kluczy *_mm. Zero kompatybilności wstecznej — porada: .agents/AGENTS.md`
    );
}
