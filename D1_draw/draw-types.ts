/**
 * D1_draw - draw-types.ts
 * Typy danych dla modułu dokumentacji 2D CAD (Draw) z SmartFrame i Sceny 3D.
 */

export type PaperFormat =
    | 'A4_LANDSCAPE'
    | 'A4_PORTRAIT'
    | 'A3_LANDSCAPE'
    | 'A3_PORTRAIT'
    | 'A2_LANDSCAPE'
    | 'A2_PORTRAIT';

export interface PaperDimensions {
    width: number;  // mm
    height: number; // mm
    label: string;
    description: string;
}

export const PAPER_FORMATS: Record<PaperFormat, PaperDimensions> = {
    'A4_LANDSCAPE': { width: 297, height: 210, label: 'A4 Poziomo', description: '297 × 210 mm' },
    'A4_PORTRAIT':  { width: 210, height: 297, label: 'A4 Pionowo', description: '210 × 297 mm' },
    'A3_LANDSCAPE': { width: 420, height: 297, label: 'A3 Poziomo', description: '420 × 297 mm' },
    'A3_PORTRAIT':  { width: 297, height: 420, label: 'A3 Pionowo', description: '297 × 420 mm' },
    'A2_LANDSCAPE': { width: 594, height: 420, label: 'A2 Poziomo', description: '594 × 420 mm' },
    'A2_PORTRAIT':  { width: 420, height: 594, label: 'A2 Pionowo', description: '420 × 594 mm' },
};

export const MARGIN_LEFT = 20;
export const MARGIN_RIGHT = 5;
export const MARGIN_TOP = 5;
export const MARGIN_BOTTOM = 5;

export const TITLE_BLOCK_WIDTH = 120;
export const TITLE_BLOCK_HEIGHT = 30;

export type DrawProjectionAngle = 'FRONT' | 'TOP' | 'LEFT' | 'RIGHT' | 'BACK' | 'BOTTOM' | 'ISO';

export interface Draw2DPoint {
    x: number;
    y: number;
}

export interface Draw2DHole {
    x: number;
    y: number;
    diameter: number;
    depth?: number;
}

export interface Draw2DGroove {
    x: number;
    y: number;
    width: number;
    height: number;
    depth?: number;
}

export interface Draw2DRect {
    id: string;
    name: string;
    role?: string;
    x: number;      // mm w lokalnym układzie rzutu
    y: number;      // mm w lokalnym układzie rzutu
    width: number;  // mm
    height: number; // mm
    thickness?: number;
    material?: string;
    isBack?: boolean;
    strokeColor?: string;
    fillColor?: string;
    dashArray?: string;
    holes?: Draw2DHole[];
    grooves?: Draw2DGroove[];
}

export interface Draw2DPolygon {
    id: string;
    name: string;
    role?: string;
    points: Draw2DPoint[];
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
}

export interface Draw2DDimension {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    valueMm: number;
    text: string;
    offsetMm: number;
    orientation: 'HORIZONTAL' | 'VERTICAL' | 'ALIGNED';
    isAuto?: boolean;
}

export interface Draw2DSegment {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isHidden: boolean; // false = linia ciągła widoczna (0.5mm), true = linia przerywana niewidoczna (0.35mm, dashArray)
    strokeColor?: string;
    strokeWidth?: number;
    dashArray?: string;
}

export interface Draw2DView {
    id: string;
    title: string;
    sourceNodeId?: string;
    sourceNodeName?: string;
    projection: DrawProjectionAngle;
    scale: number;        // współczynnik np. 0.1 = 1:10, 0.2 = 1:5, 1.0 = 1:1
    scaleText: string;    // "1:10", "1:5", "1:1"
    x: number;            // pozycja lewego górnego rogu ramki rzutu na arkuszu (mm)
    y: number;            // pozycja na arkuszu (mm)
    widthMm: number;      // rozmiar bounding box rzutu w skali 1:1 (mm)
    heightMm: number;
    rects: Draw2DRect[];
    segments?: Draw2DSegment[]; // Krawędzie HLR wygenerowane przez automatyczny algorytm usuwania linii niewidocznych
    polygons?: Draw2DPolygon[];
    dimensions: Draw2DDimension[];
    visible: boolean;
    /** Rzut rodzica — pochodny trzyma z nim wspólną oś (jak w SolidWorks / Inventor). */
    parentViewId?: string;
    /** Oś powiązania z rodzicem: pozioma (bok), pionowa (góra/dół) albo skośna (izometria). */
    alignment?: 'HORIZONTAL' | 'VERTICAL' | 'DIAGONAL';
}

export interface TitleBlockInfo {
    projectName: string;
    furnitureName: string;
    author: string;
    date: string;
    scale: string;
    sheetNumber: string;
    drawingNumber: string;
    remarks: string;
}

export interface BOMRow {
    name: string;
    material: string;
    length: number;
    width: number;
    thickness: number;
    qty: number;
}

export interface DrawModelItem {
    id: string;
    name: string;
    type: 'PROJECT' | 'CONTAINER' | 'ASSEMBLY' | 'PART';
    icon: string;
    width: number;
    height: number;
    depth: number;
    thickness?: number;
    material?: string;
    role?: string;
    partCount: number;
    children?: DrawModelItem[];
    rawNode?: any;
}
