/**
 * A5_smartparts / handles — handle-types.ts
 * Typy domenowe i parametry uchwytów meblowych (SmartPart Handle).
 * Jednostki w UI i parametrach konfiguracyjnych: milimetry [mm].
 * Konwersja do jednostek domenowych CAD (nm) następuje na brzegu przez mmToNm.
 */

export const SMARTPART_HANDLE_TYPE = 'smartpart_handle';

/** PPM / drzewo → otwórz edycję SmartPart (zakładka A5). */
export const CAD_EDIT_SMARTPART = 'cad-edit-smartpart';

export type HandleType = 'BAR' | 'EDGE' | 'KNOB' | 'PROFILE';

export type HandleProducerId = 'rejs';

export type HandleOrientation = 'HORIZONTAL' | 'VERTICAL';

export type HandlePlacementPreset =
    | 'TOP_CENTER'
    | 'CENTER'
    | 'CENTER_HORIZONTAL'
    | 'CENTER_VERTICAL'
    | 'BOTTOM_CENTER'
    | 'TOP_LEFT'
    | 'TOP_RIGHT'
    | 'BOTTOM_LEFT'
    | 'BOTTOM_RIGHT'
    | 'CUSTOM';

export type EdgeU = 'FACE_X_MINUS' | 'FACE_X_PLUS';
export type EdgeV = 'FACE_Y_MINUS' | 'FACE_Y_PLUS';

export type HandleColorId =
    | 'black'
    | 'anthracite'
    | 'chrome'
    | 'steel'
    | 'gold'
    | 'white';

export interface HandleParamsMm {
    /** Całkowita długość / szerokość uchwytu [mm] (np. 200 mm) */
    totalLengthMm: number;
    /** Rozstaw śrub montażowych C-C [mm] (np. 160 mm; 0 dla gałki 1-punktowej) */
    holeDistanceMm: number;
    /** Wysunięcie uchwytu od lica formatki [mm] (np. 28 mm) */
    depthMm: number;
    /** Grubość pręta / profilu uchwytu [mm] (np. 12 mm) */
    thicknessMm: number;
    /** Średnica stopek montażowych [mm] (np. 10 mm) */
    footDiameterMm: number;
    /** Odsunięcie od wybranej krawędzi X [mm] */
    offsetEdgeXMm: number;
    /** Odsunięcie od wybranej krawędzi Y [mm] */
    offsetEdgeYMm: number;
    /** Orientacja uchwytu: pozioma lub pionowa */
    orientation: HandleOrientation;
    /**
     * Flaga UI: który check środka jest aktywny (CENTER / HORIZONTAL / VERTICAL).
     * NIE jest źródłem geometrii — pozycja na scenie to zawsze uMm/vMm.
     * Przy lock=true zmiana C-C / orientacji tylko nadpisuje zablokowane dystanse UV.
     */
    placementPreset: HandlePlacementPreset;
    /** Wskazana płaszczyzna montażowa formatki (np. FACE_Z_PLUS) */
    face?: string;
    /** Odległość wzdłuż osi U od wskazanej krawędzi bazowej uEdge [mm] — SSOT pozycji X */
    uMm?: number;
    /** Odległość wzdłuż osi V od wskazanej krawędzi bazowej vEdge [mm] — SSOT pozycji Y */
    vMm?: number;
    /** Krawędź bazowa dla osi U (lewa: FACE_X_MINUS, prawa: FACE_X_PLUS) */
    uEdge?: EdgeU;
    /** Krawędź bazowa dla osi V (dół: FACE_Y_MINUS, góra: FACE_Y_PLUS) */
    vEdge?: EdgeV;
    /** Czy generować nawierty pod śruby na formacie (np. fi 4 mm) */
    drillingEnabled: boolean;
    /** Średnica nawiertu [mm] (domyślnie 4.0 mm pod śrubę M4) */
    drillDiameterMm: number;
    /** Opcjonalna ścieżka do pliku GLB z B1_biblioteka/uchwyty/ */
    glbModelPath?: string;
    /** Typ uchwytu (klasyczny / gałka / krawędziowy) */
    handleType?: HandleType;
    /** Producent katalogu (np. REJS) */
    producerId?: HandleProducerId;
    /** Seria modelu REJS (Easy / Tytano / Stilo) — tylko dla BAR */
    seriesId?: string;
    /**
     * true = check środka aktywny: zablokowane osie trzymają środek przez nadpisanie uMm/vMm;
     * false = ręczne UV.
     */
    placementLocked?: boolean;
    /** Id koloru z HANDLE_COLOR_OPTIONS */
    colorId?: HandleColorId;
    /** Kolor uchwytu (0–1 RGB) — SSOT wizualizacji */
    color: { r: number; g: number; b: number };
}

export const HANDLE_COLOR_OPTIONS: { id: HandleColorId; label: string; color: { r: number; g: number; b: number } }[] = [
    { id: 'black', label: 'Czarny', color: { r: 0.06, g: 0.06, b: 0.07 } },
    { id: 'anthracite', label: 'Antracyt', color: { r: 0.22, g: 0.23, b: 0.25 } },
    { id: 'chrome', label: 'Chrom', color: { r: 0.78, g: 0.80, b: 0.84 } },
    { id: 'steel', label: 'Stal', color: { r: 0.62, g: 0.64, b: 0.67 } },
    { id: 'gold', label: 'Złoty', color: { r: 0.72, g: 0.58, b: 0.32 } },
    { id: 'white', label: 'Biały', color: { r: 0.92, g: 0.92, b: 0.93 } },
];

export const DEFAULT_HANDLE_COLOR_ID: HandleColorId = 'black';

export function resolveHandleColor(colorId?: HandleColorId | null): { id: HandleColorId; color: { r: number; g: number; b: number } } {
    const hit = HANDLE_COLOR_OPTIONS.find((c) => c.id === colorId) || HANDLE_COLOR_OPTIONS[0];
    return { id: hit.id, color: { ...hit.color } };
}

/**
 * Oblicza ile mm uchwyt wystaje poza osie otworów z każdej strony.
 * Przykład: długość 200 mm, rozstaw 160 mm -> wystaje 20 mm z lewej i 20 mm z prawej.
 */
export function computeHandleOverhang(params: Pick<HandleParamsMm, 'totalLengthMm' | 'holeDistanceMm'>): number {
    const total = Math.max(0, params.totalLengthMm || 0);
    const dist = Math.max(0, params.holeDistanceMm || 0);
    if (dist <= 0) return total / 2; // Dla gałki: promień
    return Math.max(0, (total - dist) / 2);
}

export interface HandleTemplateItem {
    id: string;
    name: string;
    type: HandleType;
    producerId: HandleProducerId;
    totalLengthMm: number;
    holeDistanceMm: number;
    depthMm: number;
    thicknessMm: number;
    defaultOrientation: HandleOrientation;
    defaultPreset: HandlePlacementPreset;
    defaultOffsetYMm: number;
    glbModelPath?: string;
    /** Domyślna seria REJS dla klasycznych */
    defaultSeriesId?: string;
    /** Kolor z wstępnego filtra katalogu / drop */
    colorId?: HandleColorId;
    color?: { r: number; g: number; b: number };
}

/** Filtr typu — REJS ma klasyczne, gałki i krawędziowe. */
export const HANDLE_TYPE_OPTIONS: { id: HandleType; label: string }[] = [
    { id: 'BAR', label: 'Klasyczny' },
    { id: 'KNOB', label: 'Gałka' },
    { id: 'EDGE', label: 'Krawędziowy' },
];

export const HANDLE_PRODUCER_OPTIONS: { id: HandleProducerId; label: string }[] = [
    { id: 'rejs', label: 'REJS' },
];

/** Katalog uchwytów — typ × producent (nie „Rejs vs Gałka”). */
export const DEFAULT_HANDLE_TEMPLATES: HandleTemplateItem[] = [
    {
        id: 'rejs_bar',
        name: 'Klasyczny',
        type: 'BAR',
        producerId: 'rejs',
        totalLengthMm: 192,
        holeDistanceMm: 160,
        depthMm: 28,
        thicknessMm: 12,
        defaultOrientation: 'HORIZONTAL',
        defaultPreset: 'TOP_CENTER',
        defaultOffsetYMm: 35,
        defaultSeriesId: 'easy',
    },
    {
        id: 'rejs_knob',
        name: 'Gałka',
        type: 'KNOB',
        producerId: 'rejs',
        totalLengthMm: 30,
        holeDistanceMm: 0,
        depthMm: 25,
        thicknessMm: 30,
        defaultOrientation: 'HORIZONTAL',
        defaultPreset: 'TOP_RIGHT',
        defaultOffsetYMm: 40,
    },
    {
        id: 'rejs_edge',
        name: 'Krawędziowy',
        type: 'EDGE',
        producerId: 'rejs',
        totalLengthMm: 200,
        holeDistanceMm: 160,
        depthMm: 18,
        thicknessMm: 2,
        defaultOrientation: 'HORIZONTAL',
        defaultPreset: 'TOP_CENTER',
        defaultOffsetYMm: 0,
    },
];

/**
 * Serie uchwytów REJS (klasyczne) — A = rozstaw C-C, B = długość całkowita.
 * Źródło: katalog REJS „Uchwyty meblowe” (Easy / Stilo / Tytano).
 */
export interface RejsHandleSize {
    holeDistanceMm: number;
    totalLengthMm: number;
}

export interface RejsHandleSeries {
    id: string;
    name: string;
    sizes: RejsHandleSize[];
}

function sizesFromCc(ccs: number[], overhangMm = 34): RejsHandleSize[] {
    return ccs.map((holeDistanceMm) => ({
        holeDistanceMm,
        totalLengthMm: holeDistanceMm + overhangMm,
    }));
}

export const REJS_BAR_SERIES: RejsHandleSeries[] = [
    {
        id: 'easy',
        name: 'Easy',
        sizes: [
            { holeDistanceMm: 96, totalLengthMm: 130 },
            { holeDistanceMm: 128, totalLengthMm: 161 },
            { holeDistanceMm: 160, totalLengthMm: 192 },
            { holeDistanceMm: 192, totalLengthMm: 225 },
            { holeDistanceMm: 224, totalLengthMm: 257 },
            { holeDistanceMm: 256, totalLengthMm: 290 },
            { holeDistanceMm: 288, totalLengthMm: 322 },
            { holeDistanceMm: 320, totalLengthMm: 354 },
            { holeDistanceMm: 352, totalLengthMm: 386 },
            { holeDistanceMm: 384, totalLengthMm: 418 },
            { holeDistanceMm: 416, totalLengthMm: 450 },
        ],
    },
    {
        id: 'tytano',
        name: 'Tytano',
        sizes: [
            { holeDistanceMm: 128, totalLengthMm: 141 },
            { holeDistanceMm: 160, totalLengthMm: 173 },
            { holeDistanceMm: 192, totalLengthMm: 205 },
            { holeDistanceMm: 224, totalLengthMm: 237 },
            { holeDistanceMm: 256, totalLengthMm: 269 },
            { holeDistanceMm: 288, totalLengthMm: 301 },
            { holeDistanceMm: 320, totalLengthMm: 333 },
            { holeDistanceMm: 352, totalLengthMm: 365 },
            { holeDistanceMm: 384, totalLengthMm: 397 },
            { holeDistanceMm: 416, totalLengthMm: 429 },
        ],
    },
    {
        id: 'stilo',
        name: 'Stilo',
        sizes: [
            { holeDistanceMm: 128, totalLengthMm: 154 },
            { holeDistanceMm: 160, totalLengthMm: 185 },
            { holeDistanceMm: 192, totalLengthMm: 218 },
            { holeDistanceMm: 224, totalLengthMm: 250 },
            { holeDistanceMm: 256, totalLengthMm: 281 },
            { holeDistanceMm: 288, totalLengthMm: 313 },
            { holeDistanceMm: 320, totalLengthMm: 346 },
            { holeDistanceMm: 352, totalLengthMm: 378 },
            { holeDistanceMm: 384, totalLengthMm: 410 },
            { holeDistanceMm: 416, totalLengthMm: 442 },
        ],
    },
    { id: 'as01', name: 'AS01', sizes: sizesFromCc([96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416]) },
    { id: 'aster', name: 'Aster', sizes: sizesFromCc([96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416]) },
    { id: 'linea', name: 'Linea', sizes: sizesFromCc([96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416]) },
    { id: 'reling', name: 'Reling', sizes: sizesFromCc([96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416]) },
];

/** Nazwa pliku GLB w B1_biblioteka/uchwyty/Rejs/models (bez ścieżki). */
export function resolveHandleGlbFile(
    seriesId: string | undefined | null,
    holeDistanceMm: number,
    handleType?: HandleType,
): string | undefined {
    if (handleType === 'KNOB') {
        const sid = (seriesId || '').toLowerCase();
        if (sid === 'niro') return 'Niro.glb';
        if (sid === 'vito') return 'Vito.glb';
        return undefined;
    }
    const series = getRejsSeries(seriesId);
    if (!series?.name || !(holeDistanceMm > 0)) return undefined;
    return `${series.name}-${holeDistanceMm}.glb`;
}

export const DEFAULT_REJS_SERIES_ID = 'easy';

export function getRejsSeries(seriesId: string | undefined | null): RejsHandleSeries {
    return REJS_BAR_SERIES.find((s) => s.id === seriesId) || REJS_BAR_SERIES[0];
}

export function resolveRejsSize(
    seriesId: string | undefined | null,
    holeDistanceMm: number,
): RejsHandleSize {
    const series = getRejsSeries(seriesId);
    const exact = series.sizes.find((s) => s.holeDistanceMm === holeDistanceMm);
    if (exact) return exact;
    return series.sizes[0];
}

/** @deprecated używaj resolveRejsSize — zostawione dla kompatybilności testów overhang */
export function totalLengthFromCcMm(holeDistanceMm: number, seriesId?: string): number {
    if (holeDistanceMm <= 0) return 30;
    return resolveRejsSize(seriesId ?? DEFAULT_REJS_SERIES_ID, holeDistanceMm).totalLengthMm;
}

/** @deprecated używaj resolveHandleTemplate — zostawione dla kompatybilności */
export function listStandardHandleTemplates(): HandleTemplateItem[] {
    return DEFAULT_HANDLE_TEMPLATES.slice();
}

export function getHandleTemplateById(id: string): HandleTemplateItem | undefined {
    return DEFAULT_HANDLE_TEMPLATES.find((t) => t.id === id)
        // stare id z poprzedniego UI
        || (id === 'handle_rejs' ? DEFAULT_HANDLE_TEMPLATES.find((t) => t.id === 'rejs_bar') : undefined)
        || (id === 'handle_knob' ? DEFAULT_HANDLE_TEMPLATES.find((t) => t.id === 'rejs_knob') : undefined)
        || (id === 'handle_edge_200' ? DEFAULT_HANDLE_TEMPLATES.find((t) => t.id === 'rejs_edge') : undefined);
}

export function resolveHandleTemplate(
    type: HandleType,
    producerId: HandleProducerId,
): HandleTemplateItem | undefined {
    return DEFAULT_HANDLE_TEMPLATES.find((t) => t.type === type && t.producerId === producerId);
}

export function listProducersForType(type: HandleType): typeof HANDLE_PRODUCER_OPTIONS {
    const ids = new Set(
        DEFAULT_HANDLE_TEMPLATES.filter((t) => t.type === type).map((t) => t.producerId),
    );
    return HANDLE_PRODUCER_OPTIONS.filter((p) => ids.has(p.id));
}

/** Checki UI — tylko środki; geometria = nadpisanie uMm/vMm (bez osobnego silnika pozycji). */
export const HANDLE_PLACEMENT_OPTIONS: { id: HandlePlacementPreset; label: string }[] = [
    { id: 'CENTER', label: 'Środek' },
    { id: 'CENTER_HORIZONTAL', label: 'Środek poziomy' },
    { id: 'CENTER_VERTICAL', label: 'Środek pionowy' },
];

/** Presety checków — flaga UI, które osie UV nadpisać do środka. */
export function isCenterLockPreset(preset: HandlePlacementPreset | undefined | null): boolean {
    return preset === 'CENTER'
        || preset === 'CENTER_HORIZONTAL'
        || preset === 'CENTER_VERTICAL';
}

export function getCenterLockAxes(preset: HandlePlacementPreset | undefined | null): { lockU: boolean; lockV: boolean } {
    switch (preset) {
        case 'CENTER':
            return { lockU: true, lockV: true };
        case 'CENTER_HORIZONTAL':
            return { lockU: true, lockV: false }; // środek szerokości (oś U)
        case 'CENTER_VERTICAL':
            return { lockU: false, lockV: true }; // środek wysokości (oś V)
        default:
            return { lockU: false, lockV: false };
    }
}

export const DEFAULT_HANDLE_PARAMS: HandleParamsMm = {
    totalLengthMm: 192,
    holeDistanceMm: 160,
    depthMm: 28,
    thicknessMm: 12,
    footDiameterMm: 10,
    offsetEdgeXMm: 0,
    offsetEdgeYMm: 35,
    orientation: 'HORIZONTAL',
    placementPreset: 'TOP_CENTER',
    face: 'FACE_Z_PLUS',
    uEdge: 'FACE_X_MINUS',
    vEdge: 'FACE_Y_PLUS',
    drillingEnabled: true,
    drillDiameterMm: 4.0,
    handleType: 'BAR',
    producerId: 'rejs',
    seriesId: DEFAULT_REJS_SERIES_ID,
    placementLocked: false,
    colorId: DEFAULT_HANDLE_COLOR_ID,
    color: resolveHandleColor(DEFAULT_HANDLE_COLOR_ID).color,
};
