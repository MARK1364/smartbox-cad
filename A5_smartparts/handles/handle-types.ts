/**
 * A5_smartparts / handles — handle-types.ts
 * Typy domenowe i parametry uchwytów meblowych (SmartPart Handle).
 * Jednostki w UI i parametrach konfiguracyjnych: milimetry [mm].
 * Konwersja do jednostek domenowych CAD (nm) następuje na brzegu przez mmToNm.
 */

export const SMARTPART_HANDLE_TYPE = 'smartpart_handle';

export type HandleType = 'BAR' | 'EDGE' | 'KNOB' | 'PROFILE';

export type HandleOrientation = 'HORIZONTAL' | 'VERTICAL';

export type HandlePlacementPreset =
    | 'TOP_CENTER'
    | 'CENTER'
    | 'BOTTOM_CENTER'
    | 'TOP_LEFT'
    | 'TOP_RIGHT'
    | 'BOTTOM_LEFT'
    | 'BOTTOM_RIGHT'
    | 'CUSTOM';

export type EdgeU = 'FACE_X_MINUS' | 'FACE_X_PLUS';
export type EdgeV = 'FACE_Y_MINUS' | 'FACE_Y_PLUS';

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
    /** Preset bazowy położenia na formacie */
    placementPreset: HandlePlacementPreset;
    /** Wskazana płaszczyzna montażowa formatki (np. FACE_Z_PLUS) */
    face?: string;
    /** Odległość wzdłuż osi U od wskazanej krawędzi bazowej uEdge [mm] */
    uMm?: number;
    /** Odległość wzdłuż osi V od wskazanej krawędzi bazowej vEdge [mm] */
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
    /** Kolor uchwytu (jasny chrom / aluminium) */
    color: { r: number; g: number; b: number };
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
    totalLengthMm: number;
    holeDistanceMm: number;
    depthMm: number;
    thicknessMm: number;
    defaultOrientation: HandleOrientation;
    defaultPreset: HandlePlacementPreset;
    defaultOffsetYMm: number;
    glbModelPath?: string;
}

/** Domyślny zestaw popularnych standardów uchwytów meblowych */
export const DEFAULT_HANDLE_TEMPLATES: HandleTemplateItem[] = [
    {
        id: 'handle_reling_128',
        name: 'Reling 128 / 168 mm',
        type: 'BAR',
        totalLengthMm: 168,
        holeDistanceMm: 128,
        depthMm: 28,
        thicknessMm: 12,
        defaultOrientation: 'HORIZONTAL',
        defaultPreset: 'TOP_CENTER',
        defaultOffsetYMm: 35,
    },
    {
        id: 'handle_reling_160',
        name: 'Reling 160 / 200 mm',
        type: 'BAR',
        totalLengthMm: 200,
        holeDistanceMm: 160,
        depthMm: 28,
        thicknessMm: 12,
        defaultOrientation: 'HORIZONTAL',
        defaultPreset: 'TOP_CENTER',
        defaultOffsetYMm: 35,
    },
    {
        id: 'handle_reling_192',
        name: 'Reling 192 / 232 mm',
        type: 'BAR',
        totalLengthMm: 232,
        holeDistanceMm: 192,
        depthMm: 28,
        thicknessMm: 12,
        defaultOrientation: 'HORIZONTAL',
        defaultPreset: 'TOP_CENTER',
        defaultOffsetYMm: 35,
    },
    {
        id: 'handle_edge_200',
        name: 'Krawędziowy 200 mm',
        type: 'EDGE',
        totalLengthMm: 200,
        holeDistanceMm: 160,
        depthMm: 18,
        thicknessMm: 2,
        defaultOrientation: 'HORIZONTAL',
        defaultPreset: 'TOP_CENTER',
        defaultOffsetYMm: 0,
    },
    {
        id: 'handle_knob_30',
        name: 'Gałka fi 30 mm',
        type: 'KNOB',
        totalLengthMm: 30,
        holeDistanceMm: 0,
        depthMm: 25,
        thicknessMm: 30,
        defaultOrientation: 'HORIZONTAL',
        defaultPreset: 'TOP_RIGHT',
        defaultOffsetYMm: 40,
    },
];

export const DEFAULT_HANDLE_PARAMS: HandleParamsMm = {
    totalLengthMm: 200,
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
    color: { r: 0.88, g: 0.90, b: 0.93 }, // Jasny chrom / aluminium
};
