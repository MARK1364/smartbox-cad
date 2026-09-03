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
    /** Ściana formatki (FACE_X_* = czoło wieńca, FACE_Z_* = płaszczyzna). */
    face?: string;
    /** Otwór na wylot (konfirmat w boczku). */
    through?: boolean;
    /** Odległość bezpiecznego wycofania R (mm) */
    retractR?: number;
    /** Identyfikatory składowych operacji CAD */
    childFeatureIds?: string[];
}

export interface GrooveFeature {
    name?: string;
    /** Punkt początkowy wpustu (mm) */
    startPoint: Vector3D;
    /** Punkt końcowy wpustu (mm) */
    endPoint: Vector3D;
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

export interface ContourFeature {
    name?: string;
    /** Punkty konturu frezowania (mm) */
    points: Vector3D[];
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
}

export type CAMFeature = HoleFeature | GrooveFeature | ContourFeature;

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
    [key: string]: any;
}

export interface CNCOperation {
    type: 'drill' | 'contour' | 'groove';
    toolId: string;
    position: Vector3D;
    parameters: CNCOperationParameters;
}

export interface ProcessedCAMProject {
    projectName: string;
    wcsOrigin: Vector3D;
    wcsName: string;
    operations: CNCOperation[];
    postprocessor: string;
}

export interface CAMData {
    objectName: string;
    features: CAMFeature[];
    wcsOffset: Vector3D;
    isDirty: boolean;
}
