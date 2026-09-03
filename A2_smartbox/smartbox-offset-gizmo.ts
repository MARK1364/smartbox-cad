/**
 * Gizmy krawędzi półek i przegród SmartBox (A2).
 * Offsety zapisują się na korpusie-rodzicu — tak samo jak dotychczasowy push/pull.
 */

import {
    registerOffsetGizmoHandler,
    type OffsetGizmoHandler,
    type OffsetShiftSpec
} from '../A1_core/offset-gizmo-port.js';
import { findOwningKorpus, korpusOffsetGizmoHandler } from '../A3_smartframe/korpus-offset-gizmo.js';

const FACE_MAPPING: Record<string, Record<string, string>> = {
    VERTICAL_DIVIDER: { bottom: '-Y', top: '+Y', right: '+X', left: '-X' },
    DIVIDER: { bottom: '-Y', top: '+Y', right: '+X', left: '-X' },
    SHELF_PANEL: { bottom: '+X', top: '-X', left: '-Y', right: '+Y' },
    SHELF: { bottom: '+X', top: '-X', left: '-Y', right: '+Y' }
};

const SHIFT: Record<string, OffsetShiftSpec> = {
    VERTICAL_DIVIDER: { paramSuffix: 'shiftX', cadAxis: 'X', sign: 1 },
    DIVIDER: { paramSuffix: 'shiftX', cadAxis: 'X', sign: 1 },
    SHELF_PANEL: { paramSuffix: 'shiftZ', cadAxis: 'Z', sign: 1 },
    SHELF: { paramSuffix: 'shiftZ', cadAxis: 'Z', sign: 1 }
};

export const smartBoxOffsetGizmoHandler: OffsetGizmoHandler = {
    id: 'A2_smartbox',

    getFaceMapping(role: string) {
        return FACE_MAPPING[role] || null;
    },

    getShift(role: string) {
        return SHIFT[role] || null;
    },

    resolveContainer(doc: any, panel: any) {
        return findOwningKorpus(doc, panel?.id);
    },

    readOffsetMm(container, paramName, role) {
        return korpusOffsetGizmoHandler.readOffsetMm(container, paramName, role);
    },

    previewOffset(container, paramName, value) {
        korpusOffsetGizmoHandler.previewOffset(container, paramName, value);
    },

    commitOffset(container, paramName, oldValue, newValue) {
        korpusOffsetGizmoHandler.commitOffset(container, paramName, oldValue, newValue);
    }
};

export function registerSmartBoxOffsetGizmo(): void {
    registerOffsetGizmoHandler(smartBoxOffsetGizmoHandler);
}
