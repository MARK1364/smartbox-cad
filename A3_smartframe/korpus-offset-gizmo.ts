/**
 * Kontrakt gizm krawędzi Korpusu 3 (A3).
 * Mapping ścian i zapis offsetu — poza GizmoController (Core tylko rysuje kule).
 */

import { ContextManager } from '../A1_core/context-manager.js';
import {
    registerOffsetGizmoHandler,
    type OffsetGizmoHandler,
    type OffsetShiftSpec
} from '../A1_core/offset-gizmo-port.js';
import { rebuildSmartFrameContainer } from './smartframe-adapter.js';
import { SetKorpusOffsetCommand } from './commands/set-korpus-offset-command.js';
import { readOffsetMm } from './back-overlap.js';

const FACE_MAPPING: Record<string, Record<string, string>> = {
    LEFT_SIDE_PANEL: { top: '-Y', bottom: '+Y', left: '+X', right: '-X' },
    SIDE_LEFT: { top: '-Y', bottom: '+Y', left: '+X', right: '-X' },
    RIGHT_SIDE_PANEL: { bottom: '-Y', top: '+Y', right: '+X', left: '-X' },
    SIDE_RIGHT: { bottom: '-Y', top: '+Y', right: '+X', left: '-X' },
    BOTTOM_PANEL: { bottom: '+X', top: '-X', left: '-Y', right: '+Y' },
    TOP_PANEL: { bottom: '-X', top: '+X', left: '-Y', right: '+Y' },
    BACK_PANEL: { top: '+Y', bottom: '-Y', left: '-X', right: '+X', front: 'shiftY' }
};

const SHIFT: Record<string, OffsetShiftSpec> = {
    LEFT_SIDE_PANEL: { paramSuffix: 'shiftX', cadAxis: 'X', sign: -1 },
    SIDE_LEFT: { paramSuffix: 'shiftX', cadAxis: 'X', sign: -1 },
    RIGHT_SIDE_PANEL: { paramSuffix: 'shiftX', cadAxis: 'X', sign: 1 },
    SIDE_RIGHT: { paramSuffix: 'shiftX', cadAxis: 'X', sign: 1 },
    BOTTOM_PANEL: { paramSuffix: 'shiftZ', cadAxis: 'Z', sign: -1 },
    TOP_PANEL: { paramSuffix: 'shiftZ', cadAxis: 'Z', sign: 1 },
    BACK_PANEL: { paramSuffix: 'shiftY', cadAxis: 'Y', sign: 1 }
};

export function findOwningKorpus(doc: any, entityId: string): any | null {
    if (!doc || !entityId) return null;
    let node = doc.findNode(entityId);
    while (node) {
        const data = node.domainData as any;
        const t = String(data?.generatorParams?.type || '');
        if (data?.type === 'container' && (t.startsWith('korpus') || t === 'smartframe' || t.startsWith('KORPUS'))) {
            return data;
        }
        node = node.parent;
    }
    return null;
}

function ensureOffsets(container: any): Record<string, number> {
    if (!container.generatorParams) container.generatorParams = {};
    if (!container.generatorParams.offsets) container.generatorParams.offsets = {};
    return container.generatorParams.offsets;
}

export const korpusOffsetGizmoHandler: OffsetGizmoHandler = {
    id: 'A3_korpus',

    getFaceMapping(role: string) {
        return FACE_MAPPING[role] || null;
    },

    getShift(role: string) {
        return SHIFT[role] || null;
    },

    resolveContainer(doc: any, panel: any) {
        return findOwningKorpus(doc, panel?.id);
    },

    readOffsetMm(container: any, paramName: string, role?: string) {
        return readOffsetMm(container?.generatorParams?.offsets, paramName, role);
    },

    previewOffset(container: any, paramName: string, value: number) {
        ensureOffsets(container)[paramName] = value;
        rebuildSmartFrameContainer(container);
    },

    commitOffset(container: any, paramName: string, oldValue: number, newValue: number) {
        if (oldValue === newValue) return;
        ensureOffsets(container)[paramName] = newValue;
        const history = ContextManager.instance.commandHistory;
        if (!history) {
            rebuildSmartFrameContainer(container);
            return;
        }
        history.record(new SetKorpusOffsetCommand(container.id, paramName, oldValue, newValue));
    }
};

export function registerKorpusOffsetGizmo(): void {
    registerOffsetGizmoHandler(korpusOffsetGizmoHandler);
}
