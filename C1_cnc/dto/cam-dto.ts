/**
 * SmartPanel Web — C1_CNC DTO (Data Transfer Objects)
 * 
 * Typy i interfejsy przechowywania danych CAM dla operacji CNC.
 * Zgodne z architekturą C1_cnc z Blendera (dto_objects.py).
 */

export interface Vector3D {
    x: number;
    y: number;
    z: number;
}

/**
 * Alias dla Vec3 z cad-math — docelowo Vector3D będzie zastąpiony przez Vec3.
 * @see A1_core/cad-math/vec3.ts
 */
export type { Vec3 } from '../../A1_core/cad-math/vec3.js';

export interface HoleFeature {
    name?: string;
    /** Główna/początkowa pozycja w przestrzeni (mm) */
    position: Vector3D;
    /** Opcjonalna lista wszystkich pozycji dla grupy otworów (mm) */
    positions?: Vector3D[];
    /** Pozycja w układzie lokalnym formatki (PanelView root) przed transformacją WCS */
    panelPosition?: Vector3D;
    /** Wszystkie pozycje w układzie lokalnym formatki (PanelView root) przed transformacją WCS */
    panelPositions?: Vector3D[];
    /** Liczba otworów w grupie */
    holeCount?: number;
    /** Średnica otworu (mm) */
    diameter: number;
    /** Głębokość otworu (mm) */
    depth: number;
    /** Nazwa/ID obiektu źródłowego */
    objectName: string;
    /** Unikalny identyfikator cechy / grupy */
    featureId: string;
    /** Przypisane ID narzędzia */
    toolId?: string | null;
    /** Wektor kierunku wiercenia (np. [0, 0, -1]) */
    axis?: Vector3D | null;
    /** Wektor kierunku wiercenia w układzie lokalnym formatki (przed WCS) */
    panelAxis?: Vector3D | null;
    /** Ściana formatki (FACE_X_* = czoło wieńca, FACE_Z_* = płaszczyzna). */
    face?: string;
    /** Otwór na wylot (konfirmat w boczku). */
    through?: boolean;
    /** Odległość bezpiecznego wycofania R (mm) */
    retractR?: number;
    /** Identyfikatory składowych operacji CAD */
    childFeatureIds?: string[];
}

/**
 * Intencja obróbki rowka — DLACZEGO cięcie istnieje.
 * Nadawana u źródła (emiter CAD / extractor), nigdy zgadywana z nazwy.
 * - LED_CHANNEL: kanał pod profil LED (frez palcowy, nie piła)
 * - BACK_GROOVE: gniazdo pleców (rezerwa pod przyszłą regułę)
 * - GENERIC / brak: czysta geometria decyduje (szerokość)
 */
export type GroovePurpose = 'LED_CHANNEL' | 'BACK_GROOVE' | 'GENERIC';

export interface GrooveFeature {
    name?: string;
    purpose?: GroovePurpose;
    /** Punkt początkowy wpustu (mm) */
    startPoint: Vector3D;
    /** Punkt końcowy wpustu (mm) */
    endPoint: Vector3D;
    /** Punkt początkowy wpustu w układzie lokalnym formatki (przed WCS) */
    panelStartPoint?: Vector3D;
    /** Punkt końcowy wpustu w układzie lokalnym formatki (przed WCS) */
    panelEndPoint?: Vector3D;
    /** Wektor normalny ściany w przestrzeni WCS */
    normal?: Vector3D;
    /** Wektor normalny ściany w układzie lokalnym formatki */
    panelNormal?: Vector3D;
    /** Ściana formatki (np. FACE_Z_PLUS, FACE_Z_MINUS) */
    face?: string;
    /** Szerokość wpustu (mm) */
    width: number;
    /** Głębokość wpustu (mm) */
    depth: number;
    /** Nazwa/ID obiektu źródłowego */
    objectName: string;
    /** Unikalny identyfikator cechy */
    featureId: string;
    /** Przypisane ID narzędzia */
    toolId?: string | null;
    /** Wydłużenie wejścia (lead-in) (mm) */
    leadIn?: number;
    /** Wydłużenie wyjścia (lead-out) (mm) */
    leadOut?: number;
    /** Odwrócenie kierunku obróbki */
    reverseDirection?: boolean;
    /** Odwrócenie kierunku głębokości (np. od spodu) */
    flipDepthDirection?: boolean;
}

export type ContourSegment =
    | { type: 'LINE'; start: Vector3D; end: Vector3D }
    | {
          type: 'ARC';
          start: Vector3D;
          end: Vector3D;
          center: Vector3D;
          radius: number;
          direction: 'CW' | 'CCW';
          plane?: 'XY' | 'XZ' | 'YZ';
      };

export interface ContourFeature {
    name?: string;
    /** Punkty konturu frezowania (mm) */
    points: Vector3D[];
    /** Opcjonalne analityczne segmenty konturu (odcinki proste i łuki kołowe dla G02/G03) */
    segments?: ContourSegment[];
    /** Punkty konturu w układzie lokalnym formatki (przed WCS) */
    panelPoints?: Vector3D[];
    /** Segmenty konturu w układzie lokalnym formatki (przed WCS) */
    panelSegments?: ContourSegment[];
    /** Głębokość cięcia (mm) */
    depth: number;
    /** Nazwa/ID obiektu źródłowego */
    objectName: string;
    /** Unikalny identyfikator cechy */
    featureId: string;
    /** Przypisane ID narzędzia */
    toolId?: string | null;
    /** Wydłużenie wejścia (lead-in) (mm) */
    leadIn?: number;
    /** Wydłużenie wyjścia (lead-out) (mm) */
    leadOut?: number;
    /** Odwrócenie kierunku ścieżki */
    reverseDirection?: boolean;
    /** Kompensacja promienia narzędzia (G41/G42/G40) */
    compensation?: 'Left' | 'Right' | 'Center';
    /** Czy kontur jest wycięciem wewnętrznym (np. okno ramiaka / rewizja przelotowa) */
    isInnerContour?: boolean;
    /** Docelowy poziom Z cięcia w układzie lokalnym formatki (przed WCS) */
    panelDepth?: number;
    /** Wektor normalny ściany w przestrzeni WCS */
    normal?: Vector3D;
    /** Wektor normalny ściany w układzie lokalnym formatki */
    panelNormal?: Vector3D;
}

export interface PocketFeature {
    name?: string;
    /** Unikalny identyfikator cechy */
    featureId: string;
    /** Nazwa/ID formatki */
    objectName: string;
    /** Ściana formatki */
    face?: string;
    /** Szerokość kieszeni (mm) */
    width: number;
    /** Długość kieszeni (mm) */
    length: number;
    /** Głębokość wybrania (mm) */
    depth: number;
    /** 4 naroża obrysu kieszeni w przestrzeni WCS (mm) */
    boundaryPoints: Vector3D[];
    /** 4 naroża obrysu kieszeni w układzie lokalnym formatki (mm) */
    panelBoundaryPoints?: Vector3D[];
    /** Wektor normalny ściany w przestrzeni WCS */
    normal?: Vector3D;
    /** Wektor normalny ściany w układzie lokalnym formatki */
    panelNormal?: Vector3D;
    /** Przypisane ID narzędzia */
    toolId?: string | null;
    /** Promień zaokrąglenia narożników kieszeni (opcjonalny) */
    cornerFilletRadius?: number;
}

export type CAMFeature = HoleFeature | GrooveFeature | ContourFeature | PocketFeature;

export interface CAMStrategyParams {
    feedRate?: number;
    spindleRpm?: number;
    stepoverPercent?: number;
    stepdownMm?: number;
    leadInMm?: number;
    leadOutMm?: number;
    compensation?: 'OFF' | 'LEFT' | 'RIGHT';
    peckStepMm?: number;
    reverseDirection?: boolean;
}

export interface ToolParameters {
    feedRate: number;      // mm/min
    spindleRpm: number;    // RPM
    thickness?: number;    // mm (np. dla piły/frezu)
    [key: string]: any;
}

export interface Tool {
    id: string;
    name: string;
    diameter: number;     // mm
    type: 'drill' | 'mill' | 'groove';
    parameters: ToolParameters;
    allowedAxes?: string[];
}

export interface CAMProject {
    wcsOrigin: Vector3D;
    wcsName: string;       // np. "G55", "G54"
    features: CAMFeature[];
    toolAssignments: Record<string, string>; // featureId -> toolId
    projectName: string;
    postprocessor: string; // np. "Mach3", "Fanuc", "Biesse"
    strategyId?: string;
    strategyParams?: CAMStrategyParams;
    workpieceDimensions?: { width: number; height: number; thickness: number };
}

export interface CNCMove {
    type: 'line' | 'arc';
    endPoint: Vector3D;
    [key: string]: any;
}

export interface CNCOperationParameters {
    diameter?: number;
    depth: number;
    feedRate: number;
    spindleRpm: number;
    retractR?: number;
    width?: number;
    moves?: CNCMove[];
    approachPoint?: Vector3D;
    retractPoint?: Vector3D;
    axis?: Vector3D;
    face?: string;
    [key: string]: any;
}

export interface CNCOperation {
    type: 'drill' | 'contour' | 'groove' | 'pocket';
    toolId: string;
    position: Vector3D;
    parameters: CNCOperationParameters;
}

/**
 * Wycofane: `ProcessedCAMProject` był równoległą ścieżką do `CLDataProgram`
 * (ta sama matematyka, dwa formaty). Postprocessory przyjmują WYŁĄCZNIE
 * `CLDataProgram`; symulator 3D operuje na `CNCOperation[]`.
 * Wejście procesora: `CAMProcessor.processProject()` / `buildCLProgram()`.
 */

export interface CAMData {
    objectName: string;
    features: CAMFeature[];
    wcsOffset: Vector3D;
    isDirty: boolean;
}
