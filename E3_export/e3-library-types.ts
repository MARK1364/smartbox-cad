/**
 * E3_export - e3-library-types.ts
 * Definicje typów danych dla Biblioteki Obiektów i Wielowidokowego Studia Rysunków E3.
 */

export type E3ProjectionAngle = 'front' | 'top' | 'right' | 'left' | 'back' | 'bottom' | 'isometric';

export type E3PaperFormat = 
    | 'A4_LANDSCAPE'
    | 'A4_PORTRAIT'
    | 'A3_LANDSCAPE'
    | 'A3_PORTRAIT'
    | 'A2_LANDSCAPE'
    | 'A2_PORTRAIT';

export interface E3PaperDimensions {
    width: number;  // mm
    height: number; // mm
    label: string;
    description: string;
}

export const E3_PAPER_FORMATS: Record<E3PaperFormat, E3PaperDimensions> = {
    'A4_LANDSCAPE': { width: 297, height: 210, label: 'A4 Poziomo', description: '297 × 210 mm' },
    'A4_PORTRAIT':  { width: 210, height: 297, label: 'A4 Pionowo', description: '210 × 297 mm' },
    'A3_LANDSCAPE': { width: 420, height: 297, label: 'A3 Poziomo', description: '420 × 297 mm' },
    'A3_PORTRAIT':  { width: 297, height: 420, label: 'A3 Pionowo', description: '297 × 420 mm' },
    'A2_LANDSCAPE': { width: 594, height: 420, label: 'A2 Poziomo', description: '594 × 420 mm' },
    'A2_PORTRAIT':  { width: 420, height: 594, label: 'A2 Pionowo', description: '420 × 594 mm' },
};

export interface E3LibraryItem {
    id: string;
    uid: string;
    name: string;
    type: 'CONTAINER' | 'PANEL' | 'SMARTBOX' | 'ASSEMBLY';
    width: number;      // mm (X)
    height: number;     // mm (Y / Długość)
    depth: number;      // mm (Z / Grubość / Głębokość)
    materialName?: string;
    colorHex?: string;
    childCount?: number;
    cncCount?: number;
    role?: string;
    pos?: [number, number, number];
    rotq?: [number, number, number, number];
    children?: E3LibraryItem[];
    raw?: any;
}

export interface E3PlacedView {
    id: string;
    sourceItemId: string;
    sourceItemName: string;
    itemType: 'CONTAINER' | 'PANEL' | 'SMARTBOX' | 'ASSEMBLY';
    
    // Wymiary rzeczywiste modelu w mm
    dimX: number;
    dimY: number;
    dimZ: number;

    // Położenie na arkuszu roboczym (mm)
    sheetX: number;
    sheetY: number;

    // Kąt rzutu
    angle: E3ProjectionAngle;

    // Skala rzutu (np. 0.1 = 1:10, 0.2 = 1:5)
    scale: number;

    // Opcje wyświetlania
    showPMI: boolean;
    showCNC: boolean;
    showHiddenEdges: boolean;
    colorHex?: string;
    materialName?: string;
}

export interface E3TitleBlock {
    projectName: string;
    furnitureName: string;
    author: string;
    date: string;
    scale: string;
    sheetNumber: string;
    drawingNumber: string;
    remarks: string;
}

export interface E3SavedModelSnapshot {
    id: string;
    item: E3LibraryItem;
    name: string;
    type: 'CONTAINER' | 'PANEL';
    sheetX: number;
    sheetY: number;
    frameWidth: number;
    frameHeight: number;
    viewOffsetX: number;
    viewOffsetY: number;
    scale: number;
    angle: E3ProjectionAngle;
    rotX: number;
    rotY: number;
    rotZ: number;
    renderMode: 'shaded' | 'edges' | 'wireframe' | 'xray';
    showPMI: boolean;
}

export interface E3SavedSheet {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    paperFormat: E3PaperFormat;
    titleBlock: {
        furnitureName: string;
        drawingNumber: string;
        author: string;
        date: string;
    };
    models: E3SavedModelSnapshot[];
    activeModelId: string | null;
}
