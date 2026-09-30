/**
 * Rejestracja S4 (SmartWall + SmartFloor) — geometry handler (bez WallView).
 */

import { registerGeometryUpdateHandler } from '../A1_core/view-port.js';
import { syncAllSmartWalls } from './smartwall-core.js';
import { syncAllSmartFloors } from './smartfloor-core.js';

let unregisterHandler: (() => void) | null = null;

export function registerScianyModule(): void {
    if (unregisterHandler) {
        unregisterHandler();
        unregisterHandler = null;
    }
    unregisterHandler = registerGeometryUpdateHandler({
        updateBeforeRebuild(doc, containers) {
            syncAllSmartWalls(doc, containers);
            syncAllSmartFloors(doc, containers);
        },
    });
}

export function unregisterScianyModule(): void {
    if (unregisterHandler) {
        unregisterHandler();
        unregisterHandler = null;
    }
}
