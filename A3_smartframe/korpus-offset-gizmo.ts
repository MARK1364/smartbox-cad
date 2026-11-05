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
import {
    rebuildSmartFrameContainer,
    planKorpusPartsForOffsets,
    withSmartFrameContainerTransaction
} from './smartframe-adapter.js';
import { SetKorpusOffsetCommand } from './commands/set-korpus-offset-command.js';
import { readOffsetMm, applyKorpusOffsetWithBackMarginSync } from './back-overlap.js';

/** Klucze to kanoniczne FaceName — `normalizeFaceName` nie przyjmuje aliasów. */
const FACE_MAPPING: Record<string, Record<string, string>> = {
    LEFT_SIDE_PANEL: { FACE_Y_PLUS: '+Y', FACE_Y_MINUS: '-Y', FACE_X_MINUS: '+X', FACE_X_PLUS: '-X' },
    SIDE_LEFT: { FACE_Y_PLUS: '+Y', FACE_Y_MINUS: '-Y', FACE_X_MINUS: '+X', FACE_X_PLUS: '-X' },
    RIGHT_SIDE_PANEL: { FACE_Y_MINUS: '-Y', FACE_Y_PLUS: '+Y', FACE_X_PLUS: '+X', FACE_X_MINUS: '-X' },
    SIDE_RIGHT: { FACE_Y_MINUS: '-Y', FACE_Y_PLUS: '+Y', FACE_X_PLUS: '+X', FACE_X_MINUS: '-X' },
    // [90,180,0]: Ry=180 lustrzy lokalne ±X względem starego [90,0,0]
    BOTTOM_PANEL: { FACE_Y_MINUS: '-X', FACE_Y_PLUS: '+X', FACE_X_MINUS: '+Y', FACE_X_PLUS: '-Y' },
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
        const gp = data?.generatorParams;
        const t = String(gp?.typ_korpusu || gp?.type || '');
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

/** Minimalny wymiar formatki [mm], poniżej którego offset krawędzi z gizma jest obcinany. */
export const MIN_PANEL_DIM_MM = 1;

const EDGE_PARAM_RE = /_(\+X|-X|\+Y|-Y)$/;
const PROBE_MM = 10000;

/**
 * Ogranicza wartość offsetu krawędzi tak, aby żadna formatka nie spadła poniżej MIN_PANEL_DIM_MM.
 *
 * Wymiar formatki jest liniowy względem offsetu krawędzi (nachylenie ±1) poza obcięciem silnika,
 * więc granice wyznaczamy z dwóch sond poza zakresem obcięcia — bez dopasowywania po nazwach
 * formatek (wpływ offsetu odczytujemy z samej zmiany wymiarów planu).
 */
export function clampEdgeOffsetMm(container: any, paramName: string, value: number): number {
    if (!Number.isFinite(value) || !EDGE_PARAM_RE.test(paramName)) return value;
    const base = container?.generatorParams?.offsets || {};

    const dimsAt = (v: number): number[] => {
        const parts = planKorpusPartsForOffsets(container, { ...base, [paramName]: v });
        return parts.flatMap((p: any) => [p.dim?.x, p.dim?.y, p.dim?.z].map(Number));
    };

    let lower = -Infinity;
    let upper = Infinity;
    try {
        // Offset rośnie → formatka rośnie (nachylenie +1): dolna granica wartości.
        const hi0 = dimsAt(PROBE_MM);
        const hi1 = dimsAt(2 * PROBE_MM);
        // Offset maleje → formatka rośnie (nachylenie -1, np. krawędzie pleców): górna granica wartości.
        const lo0 = dimsAt(-PROBE_MM);
        const lo1 = dimsAt(-2 * PROBE_MM);
        if (hi0.length !== hi1.length || lo0.length !== lo1.length) return value;

        for (let i = 0; i < hi0.length; i++) {
            const slope = (hi1[i] - hi0[i]) / PROBE_MM;
            if (Math.abs(slope - 1) < 1e-6) {
                lower = Math.max(lower, PROBE_MM - (hi0[i] - MIN_PANEL_DIM_MM));
            }
        }
        for (let i = 0; i < lo0.length; i++) {
            const slope = (lo1[i] - lo0[i]) / -PROBE_MM;
            if (Math.abs(slope + 1) < 1e-6) {
                upper = Math.min(upper, lo0[i] - MIN_PANEL_DIM_MM - PROBE_MM);
            }
        }
    } catch {
        return value;
    }

    if (lower > upper) return value;
    const lo = Math.ceil(lower * 100) / 100;
    const up = Math.floor(upper * 100) / 100;
    return Math.min(Math.max(value, lo), up);
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
        const isBackShift = paramName.endsWith('_shiftY') || paramName.endsWith('_shiftX');
        if (isBackShift && (role === 'BACK_PANEL' || paramName.toLowerCase().includes('plecy') || paramName.toLowerCase().includes('back'))) {
            const offsets = container?.generatorParams?.offsets;
            const cleanKey = paramName.replace(/\.\d+(_shift[XY])$/, '$1').replace(/_\d+(_shift[XY])$/, '$1');
            const customVal = offsets?.[paramName] ?? offsets?.[cleanKey];
            if (customVal !== undefined && customVal !== null && !Number.isNaN(Number(customVal))) {
                return Number(customVal);
            }
            const gp = container?.generatorParams;
            return gp?.cofniecie_plecow_mm ?? gp?.backOffset ?? gp?.offsets?.backOffset ?? 3;
        }
        return readOffsetMm(
            container?.generatorParams?.offsets,
            paramName,
            role,
            undefined,
            container?.generatorParams?.typ_korpusu || container?.generatorParams?.type
        );
    },

    clampOffset(container: any, paramName: string, value: number): number {
        return clampEdgeOffsetMm(container, paramName, value);
    },

    previewOffset(container: any, paramName: string, value: number) {
        const effective = clampEdgeOffsetMm(container, paramName, value);
        withSmartFrameContainerTransaction(container, () => {
            const committedParams = container.generatorParams || {};
            container.generatorParams = {
                ...committedParams,
                offsets: { ...(committedParams.offsets || {}) }
            };
            try {
                if (paramName === 'backOffset' || paramName === 'cofniecie_plecow_mm') {
                    container.generatorParams.cofniecie_plecow_mm = effective;
                    container.generatorParams.backOffset = effective;
                }
                applyKorpusOffsetWithBackMarginSync(
                    ensureOffsets(container),
                    paramName,
                    effective,
                    undefined,
                    container?.generatorParams?.typ_korpusu || container?.generatorParams?.type
                );
                rebuildSmartFrameContainer(container);
            } finally {
                container.generatorParams = committedParams;
            }
        });
    },

    commitOffset(container: any, paramName: string, oldValue: number, newValue: number) {
        const effective = clampEdgeOffsetMm(container, paramName, newValue);
        const history = ContextManager.instance.commandHistory;
        const document = ContextManager.instance.document;
        if (!document) {
            if (!container.generatorParams) container.generatorParams = {};
            if (paramName === 'backOffset' || paramName === 'cofniecie_plecow_mm') {
                container.generatorParams.cofniecie_plecow_mm = effective;
                container.generatorParams.backOffset = effective;
            }
            applyKorpusOffsetWithBackMarginSync(
                ensureOffsets(container),
                paramName,
                effective,
                undefined,
                container?.generatorParams?.typ_korpusu || container?.generatorParams?.type
            );
            rebuildSmartFrameContainer(container);
            return;
        }
        const command = new SetKorpusOffsetCommand(container.id, paramName, oldValue, effective, container);
        if (oldValue === effective) return;
        if (history) history.execute(command);
        else command.execute(document);
    }
};

export function registerKorpusOffsetGizmo(): void {
    registerOffsetGizmoHandler(korpusOffsetGizmoHandler);
}
