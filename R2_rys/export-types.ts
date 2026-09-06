/**
 * E3_export - export-types.ts
 * Definicje formatów papieru, rzutowania, stempla ISO 7200 i zapisanych arkuszy dla Eksportu 3.
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

// Marginesy ramki rysunkowej (mm)
export const MARGIN_LEFT = 20;   // większy margines na oprawę/bindowanie
export const MARGIN_RIGHT = 5;
export const MARGIN_TOP = 5;
export const MARGIN_BOTTOM = 5;

// Wymiary tabelki rysunkowej ISO 7200 (mm)
export const TITLE_BLOCK_WIDTH = 120;
export const TITLE_BLOCK_HEIGHT = 30;

export type ProjectionType = 'ORTHO' | 'PERSP';
export type ExportRenderStyle = 'technical' | 'shaded' | 'mono' | 'wireframe';

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

export interface SavedExportView {
    id: string;
    name: string;
    createdAt: string;
    paperFormat: PaperFormat;
    projectionType: ProjectionType;
    renderStyle?: ExportRenderStyle;
    showGrid?: boolean;
    cameraAlpha: number;
    cameraBeta: number;
    cameraRadius: number;
    cameraTarget: [number, number, number];
    orthoScale?: number;
    notes: string;
    description?: string;
    thumbnail?: string;
    includeBOM: boolean;
    includePMI: boolean;
    titleBlock: Partial<TitleBlockInfo>;
}

export interface BOMRow {
    name: string;
    material: string;
    length: number;
    width: number;
    thickness: number;
    qty: number;
    edge_config?: Record<string, any>;
}

export interface ExportConfig {
    paperFormat: PaperFormat;
    projectionType: ProjectionType;
    showBounds: boolean;
    includeBOM: boolean;
    includePMI: boolean;
    notes: string;
    titleBlock: TitleBlockInfo;
}
