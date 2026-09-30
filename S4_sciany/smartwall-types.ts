/**
 * S4 SmartWall — wspólne typy / flagi (bez Babylon).
 */

export const SMARTWALL_TYPE = 'smartwall' as const;

/** MIME drag&drop kart SmartWall na canvas 3D (jak application/cad-korpus). */
export const SMARTWALL_DRAG_MIME = 'application/cad-smartwall' as const;

export type SmartWallPreset = 'rect' | 'empty' | 'single' | 'uskok' | 'skos';

export type WallPartRole = 'WALL' | 'WALL_PILLAR' | 'FLOOR' | 'SKOS';

/** Wypełnienie (filar) w generatorParams.fills — mm. */
export interface SmartWallFillMm {
    key: string;
    name?: string;
    x: number;
    y: number;
    z?: number;
    length: number;
    thickness: number;
    height?: number;
    yawDeg?: number;
}

/** Pozycja kontenera SmartWall na scenie [mm], CAD Z-up. */
export interface SmartWallPlacementMm {
    x: number;
    y: number;
    z?: number;
}

/** Gotowy payload karty drag&drop (ikona → scena). */
export interface SmartWallDragPayload {
    preset: SmartWallPreset;
    name?: string;
    roomWidth?: number;
    roomDepth?: number;
    wallHeight?: number;
    wallThickness?: number;
    singleLength?: number;
    uskokGapStart?: number;
    uskokGapEnd?: number;
    skosLength?: number;
    skosHeightLeft?: number;
    skosHeightRight?: number;
    skosSlant?: 'top' | 'bottom';
    fills?: SmartWallFillMm[];
}

export interface SmartWallPartPlanMm {
    key: string;
    name: string;
    role: WallPartRole;
    /** Środek panelu w LCS kontenera [mm], CAD Z-up (jak SmartFrame). */
    loc: { x: number; y: number; z: number };
    /** Wymiary przed mappingiem LCS [mm] (jak A2: dim + lcs.mapping). */
    dim: { x: number; y: number; z: number };
    /** Euler XYZ [deg] — zwykle z lcs.rotation. */
    rotationDeg?: [number, number, number];
    /** Jak Bloki/SmartFrame — mapping osi dim → width/height/thickness panelu. */
    lcs?: {
        mapping: { X: 'x' | 'y' | 'z'; Y: 'x' | 'y' | 'z'; Z: 'x' | 'y' | 'z' };
        rotation?: [number, number, number];
    };
    /** Obrzeża (ściany: wykończenie, bez ciemnego rdzenia). */
    edge_banding?: Record<string, any>;
    /** Kolor podglądu (RGB 0..1). */
    color?: { r: number; g: number; b: number };
    custom_properties?: Record<string, any>;
}

export function isSmartWallContainer(container: any): boolean {
    return container?.generatorParams?.type === SMARTWALL_TYPE;
}

export function isWallPart(panel: any): boolean {
    const role = String(panel?.role || '').toUpperCase();
    // FLOOR: tymczasowo 5. element pokoju (docelowo osobny komponent SmartFloor).
    // SKOS: parametryczny klin pod schody (osobny kontener-preset).
    return role === 'WALL' || role === 'WALL_PILLAR' || role === 'FLOOR' || role === 'SKOS';
}

/** Ściana / filar / podłoga — poza nest / wyceną płyt / CNC. */
export function isExcludedFromProduction(panel: any): boolean {
    if (!panel) return false;
    if (panel.custom_properties?.excludeFromProduction === true) return true;
    if (panel.customProperties?.excludeFromProduction === true) return true;
    if (isWallPart(panel)) return true;
    if (String(panel?.role || '').toUpperCase() === 'FLOOR') return true;
    const domain = panel?.custom_properties?.domain || panel?.customProperties?.domain;
    return domain === 'floor_segment';
}
