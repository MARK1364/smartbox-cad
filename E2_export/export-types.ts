/**
 * E2_export - export-types.ts
 * Typy danych dla modułu Eksportu 2 z obsługą wielu rzutów na jednym arkuszu (Multiview CAD).
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
export const MARGIN_LEFT = 20;   // margines na oprawę
export const MARGIN_RIGHT = 5;
export const MARGIN_TOP = 5;
export const MARGIN_BOTTOM = 5;

// Wymiary tabelki rysunkowej ISO 7200 (mm)
export const TITLE_BLOCK_WIDTH = 120;
export const TITLE_BLOCK_HEIGHT = 30;

export type CameraAnglePreset = 'front' | 'top' | 'left' | 'right' | 'back' | 'isometric' | 'custom';

export type MultiViewLayout =
    | 'SINGLE'           // 1 rzut na pełen arkusz
    | 'DUAL_HORIZONTAL'  // 2 rzuty poziomo (Przód + Bok)
    | 'DUAL_VERTICAL'    // 2 rzuty pionowo (Góra + Przód)
    | 'TRIPLE_ISO'       // 3 rzuty standard ISO (Przód, Góra, Bok)
    | 'QUAD_CAD';        // 4 rzuty (Przód, Góra, Bok + Izometria CAD)

export interface MultiViewLayoutMeta {
    id: MultiViewLayout;
    label: string;
    description: string;
    slotCount: number;
    defaultPresets: { label: string; preset: CameraAnglePreset }[];
}

export const MULTI_VIEW_LAYOUTS: Record<MultiViewLayout, MultiViewLayoutMeta> = {
    'SINGLE': {
        id: 'SINGLE',
        label: '1 Kadr (Pojedynczy)',
        description: 'Bieżący widok lub wybrany kadr na całym arkuszu',
        slotCount: 1,
        defaultPresets: [{ label: 'Widok Główny', preset: 'custom' }],
    },
    'DUAL_HORIZONTAL': {
        id: 'DUAL_HORIZONTAL',
        label: '2 Rzuty (Poziomo)',
        description: 'Przód + Bok lewy obok siebie',
        slotCount: 2,
        defaultPresets: [
            { label: 'Widok z przodu', preset: 'front' },
            { label: 'Widok z boku', preset: 'left' },
        ],
    },
    'DUAL_VERTICAL': {
        id: 'DUAL_VERTICAL',
        label: '2 Rzuty (Pionowo)',
        description: 'Rzut z góry + Widok z przodu',
        slotCount: 2,
        defaultPresets: [
            { label: 'Rzut z góry (+Z)', preset: 'top' },
            { label: 'Widok z przodu', preset: 'front' },
        ],
    },
    'TRIPLE_ISO': {
        id: 'TRIPLE_ISO',
        label: '3 Rzuty (Standard ISO)',
        description: 'Standard Europejski: Rzut z góry, Przód, Bok lewy',
        slotCount: 3,
        defaultPresets: [
            { label: 'Rzut z góry (+Z)', preset: 'top' },
            { label: 'Widok z przodu', preset: 'front' },
            { label: 'Widok z boku (lewy)', preset: 'left' },
        ],
    },
    'QUAD_CAD': {
        id: 'QUAD_CAD',
        label: '4 Rzuty (CAD + Izometria)',
        description: 'Góra, Przód, Bok + Aksonometria 3D',
        slotCount: 4,
        defaultPresets: [
            { label: 'Rzut z góry (+Z)', preset: 'top' },
            { label: 'Widok z przodu', preset: 'front' },
            { label: 'Widok z boku', preset: 'left' },
            { label: 'Izometria CAD 3D', preset: 'isometric' },
        ],
    },
};

export interface ViewSlotConfig {
    id: string;
    label: string;
    cameraPreset: CameraAnglePreset;
    cameraAlpha?: number;
    cameraBeta?: number;
    cameraRadius?: number;
    cameraTarget?: [number, number, number];
    imagePng?: string; // base64 zrzut
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
    edge_config?: Record<string, any>;
}

export interface SavedMultiViewSheet {
    id: string;
    name: string;
    createdAt: string;
    paperFormat: PaperFormat;
    layout: MultiViewLayout;
    slots: ViewSlotConfig[];
    thumbnail?: string;
    includeBOM: boolean;
    includePMI: boolean;
    titleBlock: Partial<TitleBlockInfo>;
}
