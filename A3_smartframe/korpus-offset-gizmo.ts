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

/** Klucze to kanoniczne FaceName — `normalizeFaceName` nie przyjmuje aliasów. */
const FACE_MAPPING: Record<string, Record<string, string>> = {
    LEFT_SIDE_PANEL: { FACE_Y_PLUS: '+Y', FACE_Y_MINUS: '-Y', FACE_X_MINUS: '+X', FACE_X_PLUS: '-X' },
    SIDE_LEFT: { FACE_Y_PLUS: '+Y', FACE_Y_MINUS: '-Y', FACE_X_MINUS: '+X', FACE_X_PLUS: '-X' },
    RIGHT_SIDE_PANEL: { FACE_Y_MINUS: '-Y', FACE_Y_PLUS: '+Y', FACE_X_PLUS: '+X', FACE_X_MINUS: '-X' },
    SIDE_RIGHT: { FACE_Y_MINUS: '-Y', FACE_Y_PLUS: '+Y', FACE_X_PLUS: '+X', FACE_X_MINUS: '-X' },
    // [90,180,0]: Ry=180 lustrzy lokalne ±X względem starego [90,0,0]
    BOTTOM_PANEL: { FACE_Y_MINUS: '-X', FACE_Y_PLUS: '+X', FACE_X_MINUS: '-Y', FACE_X_PLUS: '+Y' },
    TOP_PANEL: { FACE_Y_MINUS: '-X', FACE_Y_PLUS: '+X', FACE_X_MINUS: '-Y', FACE_X_PLUS: '+Y' },
    BACK_PANEL: { FACE_Y_PLUS: '-Y', FACE_Y_MINUS: '+Y', FACE_X_MINUS: '-X', FACE_X_PLUS: '+X', FACE_Z_PLUS: 'shiftY' }
};

/** PLECY_X (Rogowy90): LCS jak bok — pełne odbicie mapowania względem zwykłych pleców. */
const BACK_PANEL_PLECY_X_MAPPING: Record<string, string> = {
    FACE_Y_PLUS: '+Y',
    FACE_Y_MINUS: '-Y',
    FACE_X_MINUS: '+X',
    FACE_X_PLUS: '-X',
    FACE_Z_PLUS: 'shiftX'
};

/** TRAVERSE_V (wieniec górny na sztorc [180, 0, 0]): -Y to góra (+CAD Z / +X), +Y to dół (-CAD Z / -X). */
const TOP_PANEL_TRAVERSE_V_MAPPING: Record<string, string> = {
    FACE_Y_MINUS: '+X',
    FACE_Y_PLUS: '-X',
    FACE_X_MINUS: '-Y',
    FACE_X_PLUS: '+Y'
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

/**
 * Strict: PLECY_X wykrywamy po key / corner_arm nadawanych przez silnik.
 * Celowo BEZ panel.name — użytkownik może zmienić nazwę w drzewie (rename-part),
 * a key i corner_arm są rename-proof.
 */
function isPlecyXPanel(panel: any): boolean {
    const key = String(panel?.key || '');
    const arm = String(
        panel?.custom_properties?.corner_arm ||
        panel?.customProperties?.corner_arm ||
        ''
    ).toUpperCase();
    const tag = `${key}|${arm}`.toUpperCase();
    return tag.includes('PLECY_X') || tag.includes('BACK_X') || arm === 'X';
}

/**
 * Mapowanie krawędzi gizmo → offset dla BACK_PANEL.
 * PLECY_X (kątownik, orientacja boku) ma odwrócone top/bottom i left/right.
 */
export function resolveBackPanelFaceMapping(panel?: any): Record<string, string> {
    if (panel && isPlecyXPanel(panel)) {
        return { ...BACK_PANEL_PLECY_X_MAPPING };
    }
    return { ...FACE_MAPPING.BACK_PANEL };
}

/**
 * Strict: TRAVERSE_V wykrywamy po rotacji LCS [180, 0, 0] / mappingu Y<->z,
 * lub konfiguracji topPanelMode kontenera rodzica.
 */
export function isTraverseVPanel(panel?: any): boolean {
    if (!panel) return false;
    const rot = panel.lcs?.rotation;
    const mapping = panel.lcs?.mapping;
    if (Array.isArray(rot) && rot[0] === 180 && rot[1] === 0 && rot[2] === 0 && mapping?.Y === 'z') {
        return true;
    }
    const doc = ContextManager.instance.document;
    const container = findOwningKorpus(doc, panel.id);
    const topMode = container?.generatorParams?.topPanelMode || container?.generatorParams?.tryb_wienca_gornego;
    return topMode === 'TRAVERSE_V';
}

/**
 * Mapowanie krawędzi gizmo → offset dla TOP_PANEL.
 * TRAVERSE_V (stojący pionowo na sztorc) ma odwrócone góra (+X) / dół (-X) względem pełnego wieńca.
 */
export function resolveTopPanelFaceMapping(panel?: any): Record<string, string> {
    if (panel && isTraverseVPanel(panel)) {
        return { ...TOP_PANEL_TRAVERSE_V_MAPPING };
    }
    return { ...FACE_MAPPING.TOP_PANEL };
}

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

/**
 * Parametr gizmo „front” dla BACK_PANEL:
 * - Korpus3 (jedne plecy) → globalny backOffset
 * - Rogowy90 PLECY_Y → shiftY (oś CAD Y)
 * - Rogowy90 PLECY_X → shiftX (oś CAD X)
 */
export function resolveBackPanelFrontParam(panel: any): {
    kind: 'backOffset' | 'shiftX' | 'shiftY';
    paramName: string;
} {
    // Strict: stem klucza offsetu z key (rename-proof), nie z display name.
    // rename-part w drzewie zmienia panel.name i stary `${name}_shiftX` sierocił zapis.
    const stem = String(panel?.key || panel?.role || 'BACK_PANEL');
    if (isPlecyXPanel(panel)) {
        return { kind: 'shiftX', paramName: `${stem}_shiftX` };
    }
    const key = String((panel as any)?.key || '');
    const arm = String(
        panel?.custom_properties?.corner_arm ||
        panel?.customProperties?.corner_arm ||
        ''
    ).toUpperCase();
    const tag = `${key}|${arm}`.toUpperCase();
    if (tag.includes('PLECY_Y') || tag.includes('BACK_Y') || arm === 'Y') {
        return { kind: 'shiftY', paramName: `${stem}_shiftY` };
    }
    return { kind: 'backOffset', paramName: 'backOffset' };
}

function ensureOffsets(container: any): Record<string, number> {
    if (!container.generatorParams) container.generatorParams = {};
    if (!container.generatorParams.offsets) container.generatorParams.offsets = {};
    return container.generatorParams.offsets;
}

export const korpusOffsetGizmoHandler: OffsetGizmoHandler = {
    id: 'A3_korpus',

    getFaceMapping(role: string, panel?: any) {
        if (role === 'BACK_PANEL') {
            return resolveBackPanelFaceMapping(panel);
        }
        if (role === 'TOP_PANEL') {
            return resolveTopPanelFaceMapping(panel);
        }
        return FACE_MAPPING[role] || null;
    },

    getShift(role: string, panel?: any) {
        if (role === 'TOP_PANEL' && panel && isTraverseVPanel(panel)) {
            return { paramSuffix: 'shiftY', cadAxis: 'Y', sign: 1 };
        }
        return SHIFT[role] || null;
    },

    resolveContainer(doc: any, panel: any) {
        return findOwningKorpus(doc, panel?.id);
    },

    resolveFrontParam(panel: any) {
        return resolveBackPanelFrontParam(panel);
    },

    readOffsetMm(container: any, paramName: string, role?: string) {
        if (paramName === 'backOffset' || paramName === 'cofniecie_plecow_mm') {
            const gp = container?.generatorParams;
            return gp?.cofniecie_plecow_mm ?? gp?.backOffset ?? gp?.offsets?.backOffset ?? 3;
        }
        return readOffsetMm(
            container?.generatorParams?.offsets,
            paramName,
            role,
            undefined,
            container?.generatorParams?.type
        );
    },

    previewOffset(container: any, paramName: string, value: number) {
        if (paramName === 'backOffset' || paramName === 'cofniecie_plecow_mm') {
            if (!container.generatorParams) container.generatorParams = {};
            container.generatorParams.cofniecie_plecow_mm = value;
            container.generatorParams.backOffset = value;
        }
        ensureOffsets(container)[paramName] = value;
        rebuildSmartFrameContainer(container);
    },

    commitOffset(container: any, paramName: string, oldValue: number, newValue: number) {
        if (oldValue === newValue) return;
        if (paramName === 'backOffset' || paramName === 'cofniecie_plecow_mm') {
            if (!container.generatorParams) container.generatorParams = {};
            container.generatorParams.cofniecie_plecow_mm = newValue;
            container.generatorParams.backOffset = newValue;
        }
        ensureOffsets(container)[paramName] = newValue;
        const history = ContextManager.instance.commandHistory;
        if (!history) {
            rebuildSmartFrameContainer(container);
            return;
        }
        history.execute(new SetKorpusOffsetCommand(container.id, paramName, oldValue, newValue));
    }
};

export function registerKorpusOffsetGizmo(): void {
    registerOffsetGizmoHandler(korpusOffsetGizmoHandler);
}
