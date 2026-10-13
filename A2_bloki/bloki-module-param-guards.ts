/**
 * Strażniki kanonicznych parametrów modułów Bloki.
 * SSOT dla audytu CI — wycofane klucze rzucają czytelnym błędem zamiast cichego mapowania.
 */

const SHARED_FRONT_MM: Readonly<Record<string, string>> = {
    thickness: 'grubosc_frontu_mm',
    front_thickness: 'grubosc_frontu_mm',
    ov_top: 'nalozenie_gora_mm',
    ov_bottom: 'nalozenie_dol_mm',
    ov_left: 'nalozenie_lewe_mm',
    ov_right: 'nalozenie_prawe_mm',
    ovTop: 'nalozenie_gora_mm',
    ovBottom: 'nalozenie_dol_mm',
    ovLeft: 'nalozenie_lewe_mm',
    ovRight: 'nalozenie_prawe_mm',
    overlap_top: 'nalozenie_gora_mm',
    overlap_bottom: 'nalozenie_dol_mm',
    overlap_left: 'nalozenie_lewe_mm',
    overlap_right: 'nalozenie_prawe_mm',
};

const HINGE_LEGACY: Readonly<Record<string, string>> = {
    use_hinge_1: 'uzyj_zawias_1',
    use_hinge_2: 'uzyj_zawias_2',
    use_hinge_3: 'uzyj_zawias_3',
    use_hinge_4: 'uzyj_zawias_4',
    use_hinge_5: 'uzyj_zawias_5',
    use_hinge_6: 'uzyj_zawias_6',
    hinge_1_pos: 'pozycja_zawias_1_mm',
    hinge_2_pos: 'pozycja_zawias_2_mm',
    hinge_3_pos: 'pozycja_zawias_3_mm',
    hinge_4_pos: 'pozycja_zawias_4_mm',
    hinge_5_pos: 'pozycja_zawias_5_mm',
    hinge_6_pos: 'pozycja_zawias_6_mm',
    hinge_1_template: 'zawias_1_szablon',
    hinge_2_template: 'zawias_2_szablon',
    hinge_3_template: 'zawias_3_szablon',
    hinge_4_template: 'zawias_4_szablon',
    hinge_5_template: 'zawias_5_szablon',
    hinge_6_template: 'zawias_6_szablon',
    hinge_template: 'domyslny_zawias_id',
    hingeTemplate: 'domyslny_zawias_id',
    nalozenie_zawias_1_mm: 'pozycja_zawias_1_mm',
    nalozenie_zawias_2_mm: 'pozycja_zawias_2_mm',
    nalozenie_zawias_3_mm: 'pozycja_zawias_3_mm',
    nalozenie_zawias_4_mm: 'pozycja_zawias_4_mm',
    nalozenie_zawias_5_mm: 'pozycja_zawias_5_mm',
    nalozenie_zawias_6_mm: 'pozycja_zawias_6_mm',
};

export const LEGACY_DOORS_PARAM_ALIASES: Readonly<Record<string, string>> = {
    ...SHARED_FRONT_MM,
    ...HINGE_LEGACY,
    door_type: 'rodzaj_drzwi',
    doorType: 'rodzaj_drzwi',
    gap: 'szczelina_mm',
};

export const LEGACY_SKOSNE_DOORS_PARAM_ALIASES: Readonly<Record<string, string>> = {
    ...SHARED_FRONT_MM,
    ...HINGE_LEGACY,
    door_type: 'rodzaj_drzwi',
    doorType: 'rodzaj_drzwi',
    heightLeft: 'dach_kat_deg',
    heightRight: 'dach_kat_deg',
    height_left: 'dach_kat_deg',
    height_right: 'dach_kat_deg',
    skos_lewa: 'dach_kat_deg',
    skos_prawa: 'dach_kat_deg',
    wysokosc_lewy_mm: 'dach_kat_deg',
    wysokosc_prawy_mm: 'dach_kat_deg',
    grubosc_wience_dolnego_mm: 'dach_kat_deg',
    grubosc_wience_gornego_mm: 'dach_kat_deg',
};

export const LEGACY_DRAWERS_PARAM_ALIASES: Readonly<Record<string, string>> = {
    ...SHARED_FRONT_MM,
    count: 'liczba_szuflad',
    drawerCount: 'liczba_szuflad',
    frontHeightAuto: 'auto_wysokosc_frontu',
    front_height_auto: 'auto_wysokosc_frontu',
    commonGap: 'szczelina_wspolna_mm',
    common_gap: 'szczelina_wspolna_mm',
    frontHeights: 'wysokosci_frontow_mm',
    front_heights: 'wysokosci_frontow_mm',
    individualGaps: 'szczeliny_indywidualne_mm',
    individual_gaps: 'szczeliny_indywidualne_mm',
    spacerL: 'dystans_lewy_mm',
    spacerR: 'dystans_prawy_mm',
    enable_spacer_L: 'dystans_lewy_mm',
    enable_spacer_R: 'dystans_prawy_mm',
    railSystem: 'domyslny_system_prowadnic_id',
    rail_system: 'domyslny_system_prowadnic_id',
    railConfigs: 'konfiguracje_prowadnic',
    rail_configs: 'konfiguracje_prowadnic',
    railManufacturer: 'producent_prowadnic',
    rail_manufacturer: 'producent_prowadnic',
};

export const LEGACY_FLAPS_PARAM_ALIASES: Readonly<Record<string, string>> = {
    ...SHARED_FRONT_MM,
    flap_type: 'kierunek_klapy',
    hinge_left_offset: 'odsuniecie_zawiasu_lewe_mm',
    hinge_right_offset: 'odsuniecie_zawiasu_prawe_mm',
    hingeLeftOffset: 'odsuniecie_zawiasu_lewe_mm',
    hingeRightOffset: 'odsuniecie_zawiasu_prawe_mm',
    use_center_hinge: 'zawias_srodkowy',
    useCenterHinge: 'zawias_srodkowy',
    hinge_template: 'szablon_zawiasu_domyslny',
    hingeTemplate: 'szablon_zawiasu_domyslny',
    library_id: 'szablon_zawiasu_domyslny',
    hinge_left_template: 'szablon_zawiasu_lewy',
    hinge_right_template: 'szablon_zawiasu_prawy',
    hinge_center_template: 'szablon_zawiasu_srodkowy',
    hingeLeftTemplate: 'szablon_zawiasu_lewy',
    hingeRightTemplate: 'szablon_zawiasu_prawy',
    hingeCenterTemplate: 'szablon_zawiasu_srodkowy',
};

function assertNoLegacyKeys(
    raw: object | null | undefined,
    aliases: Readonly<Record<string, string>>,
    label: string
): void {
    if (!raw) return;
    const found: string[] = [];
    for (const key of Object.keys(raw)) {
        if ((raw as Record<string, unknown>)[key] === undefined) continue;
        const canonical = aliases[key];
        if (canonical && canonical !== key) found.push(`${key} → ${canonical}`);
    }
    if (found.length === 0) return;
    throw new Error(
        `Bloki ${label}: wycofane nazwy parametrów (${found.join(', ')}). ` +
        `Użyj wyłącznie kanonicznych kluczy *_mm.`
    );
}

export const LEGACY_SHELVES_PARAM_ALIASES: Readonly<Record<string, string>> = {
    shelfCount: 'liczba_polek',
    thickness: 'grubosc_polki_mm',
    shelfOffsetFront: 'odsuniecie_przod_mm',
    offset_front: 'odsuniecie_przod_mm',
    shelfOffsetSide: 'luz_boczny_mm',
    offset_side: 'luz_boczny_mm',
    holePattern: 'wzor_nawiercen',
    hole_pattern: 'wzor_nawiercen',
    frontInset: 'odstep_otworow_przod_mm',
    hole_offset_front: 'odstep_otworow_przod_mm',
    backInset: 'odstep_otworow_tyl_mm',
    hole_offset_back: 'odstep_otworow_tyl_mm',
    frontHoles: 'otwory_przod_aktywne',
    front_holes_enabled: 'otwory_przod_aktywne',
    frontOffsetX: 'przesuniecie_otworow_przod_x_mm',
    front_holes_offset_x: 'przesuniecie_otworow_przod_x_mm',
    backHoles: 'otwory_tyl_aktywne',
    back_holes_enabled: 'otwory_tyl_aktywne',
    backOffsetX: 'przesuniecie_otworow_tyl_x_mm',
    back_holes_offset_x: 'przesuniecie_otworow_tyl_x_mm',
    tripleZOffset: 'rozstaw_potrojny_z_mm',
    triple_z_offset: 'rozstaw_potrojny_z_mm',
    system32Spacing: 'rozstaw_system32_mm',
    system_32_spacing: 'rozstaw_system32_mm',
    system32StartOffset: 'start_system32_z_mm',
    system_32_start_offset: 'start_system32_z_mm',
    system32HoleCount: 'liczba_otworow_system32',
    system_32_hole_count: 'liczba_otworow_system32',
};

export const LEGACY_SHELF_PARAM_ALIASES: Readonly<Record<string, string>> = {
    thickness: 'grubosc_wienca_mm',
    offsetFront: 'odsuniecie_przod_mm',
    offset_front: 'odsuniecie_przod_mm',
    shelfOffsetFront: 'odsuniecie_przod_mm',
    offsetBack: 'odsuniecie_tyl_mm',
    offset_back: 'odsuniecie_tyl_mm',
    offsetSide: 'luz_boczny_mm',
    offset_side: 'luz_boczny_mm',
    referenceFrom: 'baza_odniesienia',
    offsetBottom: 'odstep_dol_mm',
    offset_bottom: 'odstep_dol_mm',
    offsetTop: 'odstep_gora_mm',
    offset_top: 'odstep_gora_mm',
};

export const LEGACY_DIVIDERS_PARAM_ALIASES: Readonly<Record<string, string>> = {
    count: 'liczba_przegrod',
    dividerCount: 'liczba_przegrod',
    thickness: 'grubosc_przegrody_mm',
    spacingMode: 'tryb_rozstawu',
    spacing_mode: 'tryb_rozstawu',
    sectionWidths: 'szerokosci_wnek_mm',
    section_widths: 'szerokosci_wnek_mm',
};

export const LEGACY_PANELS_PARAM_ALIASES: Readonly<Record<string, string>> = {
    thickness: 'grubosc_blendy_mm',
    sidePanelMode: 'tryb_paneli_bocznych',
    side_panel_mode: 'tryb_paneli_bocznych',
    enableLeft: 'wlacz_lewy',
    enable_left: 'wlacz_lewy',
    enableRight: 'wlacz_prawy',
    enable_right: 'wlacz_prawy',
    enableTop: 'wlacz_gorny',
    enable_top: 'wlacz_gorny',
    enableBottom: 'wlacz_dolny',
    enable_bottom: 'wlacz_dolny',
    autoDepthLeft: 'auto_glebokosc_lewy',
    override_rear_left: 'auto_glebokosc_lewy',
    autoDepthRight: 'auto_glebokosc_prawy',
    override_rear_right: 'auto_glebokosc_prawy',
    autoDepthTop: 'auto_glebokosc_gorny',
    override_rear_top: 'auto_glebokosc_gorny',
    panelDepthLeft: 'glebokosc_blendy_lewa_mm',
    panel_depth_left: 'glebokosc_blendy_lewa_mm',
    panelDepthRight: 'glebokosc_blendy_prawa_mm',
    panel_depth_right: 'glebokosc_blendy_prawa_mm',
    panelDepthTop: 'glebokosc_blendy_gora_mm',
    panel_depth_top: 'glebokosc_blendy_gora_mm',
    plinthHeight: 'wysokosc_cokolu_mm',
    plinth_height: 'wysokosc_cokolu_mm',
    plinthGap: 'szczelina_cokolu_mm',
    plinth_gap: 'szczelina_cokolu_mm',
    plinthRecess: 'cofniecie_cokolu_mm',
    plinth_recess: 'cofniecie_cokolu_mm',
    clearanceLeft: 'luz_lewy_mm',
    clearance_left: 'luz_lewy_mm',
    clearanceRight: 'luz_prawy_mm',
    clearance_right: 'luz_prawy_mm',
    clearanceTop: 'luz_gorny_mm',
    clearance_top: 'luz_gorny_mm',
};

export const LEGACY_TUBES_PARAM_ALIASES: Readonly<Record<string, string>> = {
    offsetTop: 'odstep_gora_mm',
    offset_top: 'odstep_gora_mm',
    showShelf: 'pokaz_polke',
    show_shelf: 'pokaz_polke',
    spaceAboveShelf: 'przestrzen_nad_polka_mm',
    space_above_shelf: 'przestrzen_nad_polka_mm',
    shelfThickness: 'grubosc_polki_mm',
    shelf_thickness: 'grubosc_polki_mm',
    rodDiameter: 'srednica_drazka_mm',
};

export const LEGACY_LED_INTERNAL_PARAM_ALIASES: Readonly<Record<string, string>> = {
    variant: 'wariant_led',
    hasLeft: 'profil_lewy',
    hasRight: 'profil_prawy',
    hasBack: 'profil_tyl',
    offsetFromFrontLeftMm: 'odsuniecie_od_przodu_lewe_mm',
    offset_from_front_left_mm: 'odsuniecie_od_przodu_lewe_mm',
    offsetFromFrontRightMm: 'odsuniecie_od_przodu_prawe_mm',
    offset_from_front_right_mm: 'odsuniecie_od_przodu_prawe_mm',
    offsetBackFromCenterMm: 'odsuniecie_tyl_od_srodka_mm',
    offset_back_from_center_mm: 'odsuniecie_tyl_od_srodka_mm',
    offsetFromFrontMm: 'odsuniecie_od_przodu_mm',
    offset_from_front_mm: 'odsuniecie_od_przodu_mm',
    grooveWidthMm: 'szerokosc_wpustu_mm',
    groove_width_mm: 'szerokosc_wpustu_mm',
    grooveDepthMm: 'glebokosc_wpustu_mm',
    groove_depth_mm: 'glebokosc_wpustu_mm',
    insetTopMm: 'odstep_gora_mm',
    inset_top_mm: 'odstep_gora_mm',
    insetBottomMm: 'odstep_dol_mm',
    inset_bottom_mm: 'odstep_dol_mm',
};

export const LEGACY_LED_EXTERNAL_PARAM_ALIASES: Readonly<Record<string, string>> = {
    offsetFromFrontMm: 'odsuniecie_od_przodu_mm',
    offset_from_front_mm: 'odsuniecie_od_przodu_mm',
    grooveWidthMm: 'szerokosc_wpustu_mm',
    groove_width_mm: 'szerokosc_wpustu_mm',
    grooveDepthMm: 'glebokosc_wpustu_mm',
    groove_depth_mm: 'glebokosc_wpustu_mm',
    cutSides: 'frezuj_boki',
    cut_sides: 'frezuj_boki',
};

export function assertCanonicalDoorsParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_DOORS_PARAM_ALIASES, 'doors');
}

export function assertCanonicalSkosneDoorsParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_SKOSNE_DOORS_PARAM_ALIASES, 'skosne_doors');
}

export function assertCanonicalDrawersParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_DRAWERS_PARAM_ALIASES, 'drawers');
}

export function assertCanonicalFlapsParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_FLAPS_PARAM_ALIASES, 'flaps');
}

export function assertCanonicalShelvesParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_SHELVES_PARAM_ALIASES, 'shelves');
}

export function assertCanonicalShelfParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_SHELF_PARAM_ALIASES, 'shelf');
}

export function assertCanonicalDividersParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_DIVIDERS_PARAM_ALIASES, 'dividers');
}

export function assertCanonicalPanelsParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_PANELS_PARAM_ALIASES, 'panels');
}

export function assertCanonicalTubesParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_TUBES_PARAM_ALIASES, 'tubes');
}

export function assertCanonicalLedInternalParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_LED_INTERNAL_PARAM_ALIASES, 'led_internal');
}

export function assertCanonicalLedExternalParams(raw: object | null | undefined): void {
    assertNoLegacyKeys(raw, LEGACY_LED_EXTERNAL_PARAM_ALIASES, 'led_external');
}

export function readOptionalNumber(raw: object, key: string): number | undefined {
    const v = (raw as Record<string, unknown>)[key];
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

export function isHingeEnabled(raw: object, index: number, defaultEnabled: boolean): boolean {
    const key = `uzyj_zawias_${index}`;
    const value = (raw as Record<string, unknown>)[key];
    if (value === undefined) return defaultEnabled;
    return value !== false;
}
