/**
 * Gizmy krawędzi półek i przegród Bloki (A2).
 * Offsety zapisują się na korpusie-rodzicu — tak samo jak dotychczasowy push/pull.
 */

import {
    registerOffsetGizmoHandler,
    type OffsetGizmoHandler,
    type OffsetShiftSpec
} from '../A1_core/offset-gizmo-port.js';
import { findOwningKorpus, korpusOffsetGizmoHandler } from '../A3_smartframe/korpus-offset-gizmo.js';

/** Klucze to kanoniczne FaceName — `normalizeFaceName` nie przyjmuje aliasów. */
const FACE_MAPPING: Record<string, Record<string, string>> = {
    VERTICAL_DIVIDER: { FACE_Y_MINUS: '-Y', FACE_Y_PLUS: '+Y', FACE_X_PLUS: '+X', FACE_X_MINUS: '-X' },
    DIVIDER: { FACE_Y_MINUS: '-Y', FACE_Y_PLUS: '+Y', FACE_X_PLUS: '+X', FACE_X_MINUS: '-X' },
    SHELF_PANEL: { FACE_Y_MINUS: '+X', FACE_Y_PLUS: '-X', FACE_X_MINUS: '-Y', FACE_X_PLUS: '+Y' },
    SHELF: { FACE_Y_MINUS: '+X', FACE_Y_PLUS: '-X', FACE_X_MINUS: '-Y', FACE_X_PLUS: '+Y' }
};

const SHIFT: Record<string, OffsetShiftSpec> = {
    VERTICAL_DIVIDER: { paramSuffix: 'shiftX', cadAxis: 'X', sign: 1 },
    DIVIDER: { paramSuffix: 'shiftX', cadAxis: 'X', sign: 1 },
    SHELF_PANEL: { paramSuffix: 'shiftZ', cadAxis: 'Z', sign: 1 },
    SHELF: { paramSuffix: 'shiftZ', cadAxis: 'Z', sign: 1 }
};

export const blokiOffsetGizmoHandler: OffsetGizmoHandler = {
    id: 'A2_bloki',

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

export function registerBlokiOffsetGizmo(): void {
    registerOffsetGizmoHandler(blokiOffsetGizmoHandler);
}
