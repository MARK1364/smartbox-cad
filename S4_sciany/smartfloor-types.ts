/**
 * S4 SmartFloor — podłoga pomieszczenia (osobny kontener pod ROOM,
 * NA ZEWNĄTRZ SmartWall). Jedna płyta pozioma, góra na Z=0.
 */

export const SMARTFLOOR_TYPE = 'smartfloor' as const;

/** MIME drag&drop ikony podłogi na canvas 3D. */
export const SMARTFLOOR_DRAG_MIME = 'application/cad-smartfloor' as const;

export type FloorPartRole = 'FLOOR';

/** Wymiary podłogi [mm]. */
export interface SmartFloorParamsMm {
    floorWidth: number;
    floorDepth: number;
    floorThickness: number;
}

/** Payload karty drag&drop podłogi. */
export interface SmartFloorDragPayload {
    name?: string;
    floorWidth?: number;
    floorDepth?: number;
    floorThickness?: number;
}

/** Beton / jastrych — odróżnia podłogę od ścian i mebli. */
export const FLOOR_DEFAULT_COLOR = { r: 0.58, g: 0.58, b: 0.56 };

export function isSmartFloorContainer(container: any): boolean {
    return container?.generatorParams?.type === SMARTFLOOR_TYPE;
}

export function isFloorPart(panel: any): boolean {
    if (!panel) return false;
    if (String(panel?.role || '').toUpperCase() === 'FLOOR') return true;
    const domain = panel?.custom_properties?.domain || panel?.customProperties?.domain;
    return domain === 'floor_segment';
}
