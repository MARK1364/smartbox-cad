/**
 * Asocjacyjny wymiar płyty (jak SWOOD): dwie płaszczyzny → odległość → szerokość / wysokość.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { mmToNm } from '../A1_core/cad-math/units.js';
import { localMmToWorldMm, namedFaceFromPick } from '../S2_solver/constraint-geometry.js';
import type { PanelModel } from './panel-model.js';

function resyncSolver(): void {
    (ContextManager.instance as any)?.solverController?.solveNow?.();
}

export type AssocAxis = 'width' | 'height';

export interface AssocPlaneRef {
    nodeId: string;
    face: string;
    label?: string;
}

export interface AssociativeDim {
    planeA: AssocPlaneRef | null;
    planeB: AssocPlaneRef | null;
    offsetMm: number;
}

export type AssociativeDims = {
    width?: AssociativeDim | null;
    height?: AssociativeDim | null;
};

export function emptyAssocDim(): AssociativeDim {
    return { planeA: null, planeB: null, offsetMm: 0 };
}

export function isAssocComplete(dim?: AssociativeDim | null): boolean {
    return !!(dim?.planeA?.nodeId && dim.planeA.face && dim.planeB?.nodeId && dim.planeB.face);
}

export function faceShortLabel(face: string): string {
    const key = String(face || '').toUpperCase();
    if (key.includes('X_MINUS') || key === 'LEFT' || key === '-X') return 'Lewa';
    if (key.includes('X_PLUS') || key === 'RIGHT' || key === '+X') return 'Prawa';
    if (key.includes('Y_PLUS') || key === 'TOP' || key === '+Y') return 'Góra';
    if (key.includes('Y_MINUS') || key === 'BOTTOM' || key === '-Y') return 'Dół';
    if (key.includes('Z_PLUS') || key === 'FRONT' || key === '+Z') return 'Przód';
    if (key.includes('Z_MINUS') || key === 'BACK' || key === '-Z') return 'Tył';
    return face || 'ściana';
}

export function planeRefLabel(ref: AssocPlaneRef | null): string {
    if (!ref) return 'Wskaż płaszczyznę';
    const name = ref.label || ref.nodeId;
    return `${name} · ${faceShortLabel(ref.face)}`;
}

function resolvePlaneWorld(doc: any, ref: AssocPlaneRef | null): { point: Vec3; normal: Vec3 } | null {
    if (!doc || !ref?.nodeId || !ref.face) return null;
    const node = doc.findNode(ref.nodeId);
    if (!node) return null;
    const face = namedFaceFromPick(node, ref.face);
    if (!face) return null;
    const point = localMmToWorldMm(node, face.localPointMm);
    const { rotation } = node.getWorldMatrix().decompose();
    const normal = rotation.rotateVec3(new Vec3(
        face.localNormalMm[0],
        face.localNormalMm[1],
        face.localNormalMm[2],
    )).normalize();
    if (!Number.isFinite(normal.x + normal.y + normal.z)) return null;
    return { point, normal };
}

/** Odległość między dwiema płaszczyznami [mm] (rzut na normalną A). */
export function distanceBetweenPlanesMm(doc: any, a: AssocPlaneRef | null, b: AssocPlaneRef | null): number | null {
    const planeA = resolvePlaneWorld(doc, a);
    const planeB = resolvePlaneWorld(doc, b);
    if (!planeA || !planeB) return null;
    if (a && b && a.nodeId === b.nodeId && a.face === b.face) return null;
    const delta = planeB.point.sub(planeA.point);
    const dist = Math.abs(delta.x * planeA.normal.x + delta.y * planeA.normal.y + delta.z * planeA.normal.z);
    if (!Number.isFinite(dist)) return null;
    return dist;
}

export function measureAssocDimMm(doc: any, dim?: AssociativeDim | null): number | null {
    if (!isAssocComplete(dim)) return null;
    const dist = distanceBetweenPlanesMm(doc, dim!.planeA, dim!.planeB);
    if (dist == null) return null;
    return dist + (Number(dim!.offsetMm) || 0);
}

export function applyAssociativeDim(doc: any, panel: PanelModel, axis: AssocAxis): boolean {
    const dim = panel.associativeDims?.[axis];
    const mm = measureAssocDimMm(doc, dim);
    if (mm == null || mm < 0.1) return false;
    const nm = mmToNm(mm);
    if (axis === 'width') {
        if (panel.width === nm) return false;
        panel.setDimensions(nm, panel.height, panel.thickness);
    } else {
        if (panel.height === nm) return false;
        panel.setDimensions(panel.width, nm, panel.thickness);
    }
    return true;
}

export function applyAllAssociativeDims(doc: any): void {
    if (!doc || typeof doc.getPanels !== 'function') return;
    let changed = false;
    for (const item of doc.getPanels()) {
        const panel = (item as any).domainData || item;
        if (!panel?.associativeDims) continue;
        if (applyAssociativeDim(doc, panel, 'width')) changed = true;
        if (applyAssociativeDim(doc, panel, 'height')) changed = true;
    }
    if (changed) {
        doc.emitChange?.('dimensions');
        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('smartbox-panel-changed'));
        }
        resyncSolver();
    }
}
