import type { DetectedBay } from './02_bloki-bay-detector.js';
import type { FaceName } from '../A4_smartpanel/panel-model.js';
import type { HandleParamsMm } from './handles/handle-types.js';

export type HandlePlanParams = Partial<HandleParamsMm>;

export type HingeIndex = 1 | 2 | 3 | 4 | 5 | 6;

export interface DoorsPlanParams {
    rodzaj_drzwi?: 'LEFT' | 'RIGHT' | 'DOUBLE';
    grubosc_frontu_mm?: number;
    szczelina_mm?: number;
    nalozenie_gora_mm?: number;
    nalozenie_dol_mm?: number;
    nalozenie_lewe_mm?: number;
    nalozenie_prawe_mm?: number;
    domyslny_zawias_id?: string;
    producent_zawiasow?: string;
    uzyj_zawias_1?: boolean;
    uzyj_zawias_2?: boolean;
    uzyj_zawias_3?: boolean;
    uzyj_zawias_4?: boolean;
    uzyj_zawias_5?: boolean;
    uzyj_zawias_6?: boolean;
    pozycja_zawias_1_mm?: number;
    pozycja_zawias_2_mm?: number;
    pozycja_zawias_3_mm?: number;
    pozycja_zawias_4_mm?: number;
    pozycja_zawias_5_mm?: number;
    pozycja_zawias_6_mm?: number;
    zawias_1_szablon?: string;
    zawias_2_szablon?: string;
    zawias_3_szablon?: string;
    zawias_4_szablon?: string;
    zawias_5_szablon?: string;
    zawias_6_szablon?: string;
}

export type SkosneDoorType = 'LEFT' | 'RIGHT' | 'DOUBLE';

/**
 * DRZWI SKOŚNE — front trapezowy (dół prosty, góra pochylona), jak korpus_skosny_lr.
 * Wysokości skośne są jawne: detektor wnęki zwraca jedną wartość, a dla
 * korpusu skośnego jest to średnia pochylonego wieńca — nie da się z niej
 * odtworzyć obu stron. `rodzaj_drzwi` = strona zawiasu ('LEFT' / 'RIGHT') lub 'DOUBLE'.
 */
export interface SkosneDoorsPlanParams {
    rodzaj_drzwi?: SkosneDoorType;
    grubosc_frontu_mm?: number;
    szczelina_mm?: number;
    /** Kąt nachylenia wieńca górnego (dachu) względem poziomu w stopniach [deg]. Odczytywany bezpośrednio z TOP_PANEL korpusu. */
    dach_kat_deg?: number;
    nalozenie_gora_mm?: number;
    nalozenie_dol_mm?: number;
    nalozenie_lewe_mm?: number;
    nalozenie_prawe_mm?: number;
    domyslny_zawias_id?: string;
    producent_zawiasow?: string;
    uzyj_zawias_1?: boolean;
    uzyj_zawias_2?: boolean;
    uzyj_zawias_3?: boolean;
    uzyj_zawias_4?: boolean;
    uzyj_zawias_5?: boolean;
    uzyj_zawias_6?: boolean;
    pozycja_zawias_1_mm?: number;
    pozycja_zawias_2_mm?: number;
    pozycja_zawias_3_mm?: number;
    pozycja_zawias_4_mm?: number;
    pozycja_zawias_5_mm?: number;
    pozycja_zawias_6_mm?: number;
    zawias_1_szablon?: string;
    zawias_2_szablon?: string;
    zawias_3_szablon?: string;
    zawias_4_szablon?: string;
    zawias_5_szablon?: string;
    zawias_6_szablon?: string;
    // Niezależne sterowanie zawiasami skrzydła lewego (rodzaj_drzwi: 'DOUBLE'):
    uzyj_zawias_lewy_1?: boolean;
    uzyj_zawias_lewy_2?: boolean;
    uzyj_zawias_lewy_3?: boolean;
    uzyj_zawias_lewy_4?: boolean;
    uzyj_zawias_lewy_5?: boolean;
    uzyj_zawias_lewy_6?: boolean;
    pozycja_zawias_lewy_1_mm?: number;
    pozycja_zawias_lewy_2_mm?: number;
    pozycja_zawias_lewy_3_mm?: number;
    pozycja_zawias_lewy_4_mm?: number;
    pozycja_zawias_lewy_5_mm?: number;
    pozycja_zawias_lewy_6_mm?: number;
    zawias_lewy_1_szablon?: string;
    zawias_lewy_2_szablon?: string;
    zawias_lewy_3_szablon?: string;
    zawias_lewy_4_szablon?: string;
    zawias_lewy_5_szablon?: string;
    zawias_lewy_6_szablon?: string;
    // Niezależne sterowanie zawiasami skrzydła prawego (rodzaj_drzwi: 'DOUBLE'):
    uzyj_zawias_prawy_1?: boolean;
    uzyj_zawias_prawy_2?: boolean;
    uzyj_zawias_prawy_3?: boolean;
    uzyj_zawias_prawy_4?: boolean;
    uzyj_zawias_prawy_5?: boolean;
    uzyj_zawias_prawy_6?: boolean;
    pozycja_zawias_prawy_1_mm?: number;
    pozycja_zawias_prawy_2_mm?: number;
    pozycja_zawias_prawy_3_mm?: number;
    pozycja_zawias_prawy_4_mm?: number;
    pozycja_zawias_prawy_5_mm?: number;
    pozycja_zawias_prawy_6_mm?: number;
    zawias_prawy_1_szablon?: string;
    zawias_prawy_2_szablon?: string;
    zawias_prawy_3_szablon?: string;
    zawias_prawy_4_szablon?: string;
    zawias_prawy_5_szablon?: string;
    zawias_prawy_6_szablon?: string;
}

export interface DrawerRailConfig {
    system?: string;
    length?: string;
}

export interface DrawersPlanParams {
    liczba_szuflad?: number;
    grubosc_frontu_mm?: number;
    nalozenie_gora_mm?: number;
    nalozenie_dol_mm?: number;
    nalozenie_lewe_mm?: number;
    nalozenie_prawe_mm?: number;
    dystans_lewy_mm?: number;
    dystans_prawy_mm?: number;
    auto_wysokosc_frontu?: boolean;
    szczelina_wspolna_mm?: number;
    wysokosci_frontow_mm?: number[];
    szczeliny_indywidualne_mm?: number[];
    domyslny_system_prowadnic_id?: string;
    producent_prowadnic?: string;
    konfiguracje_prowadnic?: Record<number, DrawerRailConfig>;
}

export interface FlapsPlanParams {
    kierunek_klapy?: 'TOP' | 'BOTTOM';
    grubosc_frontu_mm?: number;
    nalozenie_gora_mm?: number;
    nalozenie_dol_mm?: number;
    nalozenie_lewe_mm?: number;
    nalozenie_prawe_mm?: number;
    odsuniecie_zawiasu_lewe_mm?: number;
    odsuniecie_zawiasu_prawe_mm?: number;
    zawias_srodkowy?: boolean;
    producent_zawiasow?: string;
    szablon_zawiasu_domyslny?: string;
    szablon_zawiasu_lewy?: string;
    szablon_zawiasu_prawy?: string;
    szablon_zawiasu_srodkowy?: string;
}

export interface CornerDoorsPlanParams {
    grubosc_frontu_mm?: number;
    szczelina_srodkowa_mm?: number;
    nalozenie_gora_mm?: number;
    nalozenie_dol_mm?: number;
    nalozenie_prawe_mm?: number;
    nalozenie_lewe_mm?: number;
    otwieranie?: string;
    szablon_zawiasu_domyslny?: string;
    uzyj_zawias_1?: boolean;
    uzyj_zawias_2?: boolean;
    uzyj_zawias_3?: boolean;
    uzyj_zawias_4?: boolean;
    uzyj_zawias_5?: boolean;
    uzyj_zawias_6?: boolean;
    pozycja_zawias_1_mm?: number;
    pozycja_zawias_2_mm?: number;
    pozycja_zawias_3_mm?: number;
    pozycja_zawias_4_mm?: number;
    pozycja_zawias_5_mm?: number;
    pozycja_zawias_6_mm?: number;
    zawias_1_szablon?: string;
    zawias_2_szablon?: string;
    zawias_3_szablon?: string;
    zawias_4_szablon?: string;
    zawias_5_szablon?: string;
    zawias_6_szablon?: string;
    grubosc_boka_front?: number;
    grubosc_plecy_x?: number;
}

export type ShelfHolePattern = 'NONE' | 'SINGLE' | 'TRIPLE' | 'ROW' | 'SYSTEM_32';

export interface ShelvesPlanParams {
    liczba_polek?: number;
    grubosc_polki_mm?: number;
    odsuniecie_przod_mm?: number;
    luz_boczny_mm?: number;
    wzor_nawiercen?: ShelfHolePattern;
    odstep_otworow_przod_mm?: number;
    odstep_otworow_tyl_mm?: number;
    otwory_przod_aktywne?: boolean;
    przesuniecie_otworow_przod_x_mm?: number;
    otwory_tyl_aktywne?: boolean;
    przesuniecie_otworow_tyl_x_mm?: number;
    rozstaw_potrojny_z_mm?: number;
    rozstaw_system32_mm?: number;
    start_system32_z_mm?: number;
    liczba_otworow_system32?: number;
    podporka_id?: string;
}

export interface ShelfPlanParams {
    grubosc_wienca_mm?: number;
    odsuniecie_przod_mm?: number;
    odsuniecie_tyl_mm?: number;
    luz_boczny_mm?: number;
    baza_odniesienia?: 'top' | 'bottom';
    odstep_gora_mm?: number;
    odstep_dol_mm?: number;
}

export interface DividersPlanParams {
    liczba_przegrod?: number;
    grubosc_przegrody_mm?: number;
    tryb_rozstawu?: 'EQUAL' | 'CUSTOM';
    szerokosci_wnek_mm?: number[];
}

export type SidePanelMode = 'FULL' | 'KORPUS_BLENDA_G' | 'COKOL_KORPUS' | 'KORPUS';

export interface PanelsPlanParams {
    grubosc_blendy_mm?: number;
    tryb_paneli_bocznych?: SidePanelMode;
    wlacz_lewy?: boolean;
    wlacz_prawy?: boolean;
    wlacz_gorny?: boolean;
    wlacz_dolny?: boolean;
    auto_glebokosc_lewy?: boolean;
    auto_glebokosc_prawy?: boolean;
    auto_glebokosc_gorny?: boolean;
    glebokosc_blendy_lewa_mm?: number;
    glebokosc_blendy_prawa_mm?: number;
    glebokosc_blendy_gora_mm?: number;
    wysokosc_cokolu_mm?: number;
    szczelina_cokolu_mm?: number;
    cofniecie_cokolu_mm?: number;
    luz_lewy_mm?: number;
    luz_prawy_mm?: number;
    luz_gorny_mm?: number;
}

export interface TubesPlanParams {
    odstep_gora_mm?: number;
    pokaz_polke?: boolean;
    przestrzen_nad_polka_mm?: number;
    grubosc_polki_mm?: number;
    srednica_drazka_mm?: number;
}

export type LedInternalVariant =
    | 'VERTICAL_BOTH_SIDES'
    | 'VERTICAL_LEFT_SIDE'
    | 'VERTICAL_RIGHT_SIDE'
    | 'VERTICAL_BACK'
    | 'VERTICAL_SIDES_AND_BACK'
    | 'HORIZONTAL_TOP';

export interface LedInternalPlanParams {
    wariant_led?: LedInternalVariant;
    profil_lewy?: boolean;
    profil_prawy?: boolean;
    profil_tyl?: boolean;
    odsuniecie_od_przodu_lewe_mm?: number;
    odsuniecie_od_przodu_prawe_mm?: number;
    odsuniecie_tyl_od_srodka_mm?: number;
    odsuniecie_od_przodu_mm?: number;
    szerokosc_wpustu_mm?: number;
    glebokosc_wpustu_mm?: number;
    odstep_gora_mm?: number;
    odstep_dol_mm?: number;
}

export interface LedExternalPlanParams {
    odsuniecie_od_przodu_mm?: number;
    szerokosc_wpustu_mm?: number;
    glebokosc_wpustu_mm?: number;
    frezuj_boki?: boolean;
}

export type LedPlanParams =
    | (LedInternalPlanParams & {
        category?: 'internal';
        boxType?: 'LED_INTERNAL';
        type?: 'blok_led_internal';
        scope?: 'row' | 'single';
    })
    | (LedExternalPlanParams & {
        category?: 'external';
        boxType?: 'LED_EXTERNAL';
        type?: 'blok_led_external';
        scope?: 'row' | 'single';
    });

export type BlokiModuleId =
    | 'SHELVES'
    | 'DOORS'
    | 'SKOSNE_DOORS'
    | 'CORNER_DOORS'
    | 'DRAWERS'
    | 'FLAPS'
    | 'DIVIDERS'
    | 'TUBES'
    | 'SHELF'
    | 'LED_INTERNAL'
    | 'PANELS'
    | 'LED_EXTERNAL'
    | 'HANDLES'
    | 'HANGERS';

export interface BlokiModuleTypeById {
    SHELVES: 'blok_shelves';
    DOORS: 'blok_doors';
    SKOSNE_DOORS: 'blok_skosne_drzwi';
    CORNER_DOORS: 'blok_corner_doors';
    DRAWERS: 'blok_drawers';
    FLAPS: 'blok_flaps';
    DIVIDERS: 'blok_dividers';
    TUBES: 'blok_tubes';
    SHELF: 'blok_shelf';
    LED_INTERNAL: 'blok_led_internal';
    PANELS: 'blok_panels';
    LED_EXTERNAL: 'blok_led_external';
    HANDLES: 'blok_handle';
    HANGERS: 'smartpart_hangers';
}

export interface BlokiPanelReference {
    panelId?: string;
    nodeId?: string;
    partKey?: string;
    nodeName?: string;
    face?: FaceName;
    faceName?: FaceName;
}

export type BlokiReferenceSide = 'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax';

export interface BlokiGeneratorMetadata {
    parentContainerId?: string;
    boundary?: DetectedBay['boundary'];
    detectedBay?: DetectedBay;
    targetZone?: string;
    side_references_bloki?: 'INNER' | 'OUTER';
    customReferences?: Partial<Record<BlokiReferenceSide, BlokiPanelReference>>;
    disabledReferences?: Partial<Record<BlokiReferenceSide, boolean>>;
    cornerAt?: 'innerL_wieniec';
    offsets?: Record<string, number>;
    references?: Record<string, BlokiPanelReference>;
    width_mm?: number;
    depth_mm?: number;
    height_mm?: number;
    maxHeight?: number;
    scope?: 'row' | 'single';
}

export interface BlokiModuleParamsById {
    SHELVES: ShelvesPlanParams;
    DOORS: DoorsPlanParams;
    SKOSNE_DOORS: SkosneDoorsPlanParams;
    CORNER_DOORS: CornerDoorsPlanParams;
    DRAWERS: DrawersPlanParams;
    FLAPS: FlapsPlanParams;
    DIVIDERS: DividersPlanParams;
    TUBES: TubesPlanParams;
    SHELF: ShelfPlanParams;
    LED_INTERNAL: LedInternalPlanParams;
    PANELS: PanelsPlanParams;
    LED_EXTERNAL: LedExternalPlanParams;
    HANDLES: HandlePlanParams;
    HANGERS: Record<string, unknown>;
}

export type BlokiGeneratorParams = BlokiGeneratorMetadata &
    { boxType: 'EMPTY'; type: 'blok_empty' } |
    {
        [ModuleId in BlokiModuleId]: BlokiGeneratorMetadata &
            BlokiModuleParamsById[ModuleId] & {
                boxType: ModuleId;
                type: BlokiModuleTypeById[ModuleId];
            }
    }[BlokiModuleId];
export type BlokiGeneratorParamsPatch = Partial<BlokiGeneratorMetadata> & (
    | { boxType?: 'EMPTY'; type?: 'blok_empty' }
    | {
        [ModuleId in BlokiModuleId]: Partial<BlokiModuleParamsById[ModuleId]> & {
            boxType?: ModuleId;
            type?: BlokiModuleTypeById[ModuleId];
        }
    }[BlokiModuleId]
);

const BLOKI_TYPE_BY_ID: BlokiModuleTypeById = {
    SHELVES: 'blok_shelves',
    DOORS: 'blok_doors',
    SKOSNE_DOORS: 'blok_skosne_drzwi',
    CORNER_DOORS: 'blok_corner_doors',
    DRAWERS: 'blok_drawers',
    FLAPS: 'blok_flaps',
    DIVIDERS: 'blok_dividers',
    TUBES: 'blok_tubes',
    SHELF: 'blok_shelf',
    LED_INTERNAL: 'blok_led_internal',
    PANELS: 'blok_panels',
    LED_EXTERNAL: 'blok_led_external',
    HANDLES: 'blok_handle',
    HANGERS: 'smartpart_hangers'
};

export function isBlokiGeneratorParams(raw: unknown): raw is BlokiGeneratorParams {
    if (!raw || typeof raw !== 'object') return false;
    const params = raw as { boxType?: unknown; type?: unknown };
    if (params.boxType === 'EMPTY') return params.type === 'blok_empty';
    if (typeof params.boxType !== 'string' || !(params.boxType in BLOKI_TYPE_BY_ID)) return false;
    return params.type === BLOKI_TYPE_BY_ID[params.boxType as BlokiModuleId];
}