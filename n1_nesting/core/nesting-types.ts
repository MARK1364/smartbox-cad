/**
 * Interfejsy i typy danych dla modułu Nestingu (Rozkroju Płyt i CNC)
 */

export type GrainDirection = 'horizontal' | 'vertical' | 'none';
export type RotationRule = 'any' | 'none' | 'prefer_length';
export type MachineType = 'saw' | 'cnc';
export type NestingScope = 'PROJECT' | 'CONTAINER' | 'SMARTBOX';

export interface ContainerScopeInfo {
    id: string;
    name: string;
    type: 'furniture' | 'smartbox';
    partsCount: number;
}

export interface NestingPart {
    id: string;
    name: string;
    width: number;          // Długość / Wymiar X w mm
    height: number;         // Szerokość / Wymiar Y w mm
    thickness?: number;     // Grubość materiału w mm (np. 18, 3, 16)
    width_nm?: number;      // Wymiar X w nanometrach
    height_nm?: number;     // Wymiar Y w nanometrach
    thickness_nm?: number;  // Grubość materiału w nanometrach
    quantity: number;
    canRotate: boolean;     // Czy dopuszczalny jest obrót o 90 stopni
    material?: string;      // Nazwa materiału (np. "Biel Alpejska", "HDF Biały")
    grain?: GrainDirection;
    containerId?: string;   // ID szafki / korpusu nadrzędnego
    smartboxId?: string;    // ID SmartBoxa
    furnitureName?: string; // Nazwa mebla (np. "Szafka Dolna")
    sourceNodeId?: string;  // Powiązanie z węzłem CAD
    metadata?: Record<string, any>;
}

export interface SheetConfig {
    width: number;               // Wymiar płyty X (np. 2800 mm)
    height: number;              // Wymiar płyty Y (np. 2070 mm)
    thickness?: number;          // Grubość płyty (np. 18 mm)
    width_nm?: number;           // Wymiar płyty X w nanometrach
    height_nm?: number;          // Wymiar płyty Y w nanometrach
    thickness_nm?: number;       // Grubość płyty w nanometrach
    kerf: number;                // Rzaz piły (3.2-4.4 mm) lub średnica frezu CNC (8-12 mm)
    trimMargin?: number;         // Margines na obcięcie krawędzi płyty (np. 10-15 mm)
    material?: string;
    machineType?: MachineType;   // 'saw' (piła) lub 'cnc' (frezarka nestingowa)
    toolDiameter?: number;       // Średnica frezu CNC (np. 10 mm)
    onionSkinThickness?: number; // Grubość mostka/skóry w mm (np. 0.5 mm)
}

export interface Rect2D {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface PackedPart {
    partId: string;
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    realW: number;
    realH: number;
    x_nm?: number;          // Pozycja X w nanometrach
    y_nm?: number;          // Pozycja Y w nanometrach
    w_nm?: number;          // Wymiar X w nanometrach
    h_nm?: number;          // Wymiar Y w nanometrach
    realW_nm?: number;      // Rzeczywisty wymiar X w nanometrach
    realH_nm?: number;      // Rzeczywisty wymiar Y w nanometrach
    rotated: boolean;
    rotationAngle?: number; // Kąt obrotu w stopniach (0, 15, 30, 45, 90...)
    material?: string;
    thickness?: number;
    thickness_nm?: number;
    containerId?: string;
    smartboxId?: string;
    furnitureName?: string;
    sourceNodeId?: string;
}

/** Dwa wiersze etykiety: nazwa mebla/projektu + nazwa formatki. */
export function getPartLabelLines(part: { name: string; furnitureName?: string }): { project: string; panel: string } {
    const rawName = (part.name || '').trim();
    const furniture = (part.furnitureName || '').trim();

    if (furniture) {
        let panel = rawName;
        if (panel.toLowerCase().startsWith(furniture.toLowerCase())) {
            panel = panel.slice(furniture.length).replace(/^\s*[-–—:|/]\s*/, '').trim();
        }
        return { project: furniture, panel: panel || rawName || 'Formatka' };
    }

    const split = rawName.match(/^(.+?)\s*[-–—|/]\s*(.+)$/);
    if (split) {
        return { project: split[1].trim(), panel: split[2].trim() };
    }

    return { project: '', panel: rawName || 'Formatka' };
}

export interface PackedBoard {
    boardIndex: number;
    boardIndexInGroup?: number;
    material?: string;
    thickness?: number;
    thickness_nm?: number;
    materialLabel?: string;
    machineType?: MachineType;
    width: number;
    height: number;
    width_nm?: number;      // Wymiar arkusza X w nanometrach
    height_nm?: number;     // Wymiar arkusza Y w nanometrach
    layout: PackedPart[];
    usedArea: number;
    totalArea: number;
    wasteArea: number;
    utilizationPercent: number; // 0 - 100%
    wastePercent: number;       // 0 - 100%
}

export type NestingMode = 'fast' | 'pro';

export interface NestingOptions {
    mode: NestingMode;
    iterations?: number;
    allowRotation?: boolean;
    stopOnFirstFit?: boolean;
    selectedMaterial?: string;      // 'ALL' lub klucz materiału
    machineType?: MachineType;      // 'saw' lub 'cnc'
    scope?: NestingScope;           // 'PROJECT' | 'CONTAINER' | 'SMARTBOX'
    targetContainerId?: string;     // Konkretny ID szafki lub SmartBoxa
    targetContainerIds?: string[];   // Lista ID wybranych korpusów / SmartBoxów (Multi-wybór z Ctrl)
}

export interface MaterialGroupSummary {
    materialKey: string;
    materialName: string;
    thickness: number;
    materialLabel: string;
    partsCount: number;
    boardsCount: number;
    totalUsedArea: number;
    totalBoardArea: number;
    utilizationPercent: number;
    wastePercent: number;
    boards: PackedBoard[];
}

export interface NestingResult {
    boards: PackedBoard[];
    materialGroups: MaterialGroupSummary[];
    unplacedParts: NestingPart[];
    machineType: MachineType;
    scope: NestingScope;
    totalPartsPlaced: number;
    totalPartsCount: number;
    totalBoardsCount: number;
    totalUsedArea: number;
    totalBoardArea: number;
    avgUtilizationPercent: number;
    avgWastePercent: number;
    executionTimeMs: number;
}
