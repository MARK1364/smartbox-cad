/**
 * constraint-picker.ts — pipeta więzów w widoku 3D.
 *
 * Geometria: kliknięta ściana / krawędź / naroże formatki (albo korpusu).
 * Bryła sztywna: rodzic SmartFrame, gdy formatka w nim siedzi — solver
 * rusza cały korpus, płyty nie odrywa.
 */

import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { getSelectionModeForTab } from '../A1_core/selection-mode.js';
import { notifySolverVisibilityChanged } from './solver-visibility.js';
import { renderToCAD } from '../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { isManualPanel, normalizeFaceName } from '../A4_smartpanel/panel-model.js';
import {
    babylonPickToLocalMm,
    getLocalBoxMm,
    mapLocalDirToNode,
    mapLocalMmToNode,
    namedFaceFromPick,
    resolveFaceQuadMm,
    snapPickToSmartFrame,
} from './constraint-geometry.js';
import { makeAnchor, type AnchorKind, type ConstraintAnchor } from './constraint-types.js';
import type { Vec3 as SolverVec3 } from './core/math3d.js';

export interface ActiveConstraintPicker {
    label: string;
    expectedKind: AnchorKind;
    onPick: (anchor: ConstraintAnchor) => void;
    onCancel?: () => void;
}

export function getActiveConstraintPicker(): ActiveConstraintPicker | null {
    return ContextManager.instance.activeConstraintPicker ?? null;
}

/** Formatka (PART) albo korpus (ASSEMBLY) — to, z czego bierzemy geometrię. */
export function resolveBindingTarget(node: CADNode | null): CADNode | null {
    let current: CADNode | null = node;
    while (current) {
        if (current.nodeType === NodeType.PART || current.nodeType === NodeType.ASSEMBLY) {
            return current;
        }
        current = current.parent;
    }
    return null;
}

/** Bryła sztywna: korpus SmartFrame, gdy formatka jest jego dzieckiem. */
export function resolveRigidBody(node: CADNode | null): CADNode | null {
    const component = resolveBindingTarget(node);
    if (!component) {
        return null;
    }
    if (component.nodeType === NodeType.PART) {
        if (isManualPanel(component.domainData)) {
            return component;
        }
        let current: CADNode | null = component.parent;
        while (current) {
            if (current.nodeType === NodeType.ASSEMBLY) {
                return current;
            }
            current = current.parent;
        }
    }
    return component;
}

export function bindAnchorToRigidBody(geomNode: CADNode, anchor: ConstraintAnchor): ConstraintAnchor {
    const body = resolveRigidBody(geomNode) ?? geomNode;
    if (body.id === geomNode.id) {
        return makeAnchor({ ...anchor, nodeId: geomNode.id, sourceNodeId: undefined });
    }
    const mapped = mapLocalMmToNode(
        geomNode,
        body,
        anchor.localPointMm ?? [0, 0, 0],
        anchor.localNormalMm ?? null,
    );
    return makeAnchor({
        ...anchor,
        nodeId: body.id,
        sourceNodeId: geomNode.id,
        localPointMm: mapped.localPointMm,
        localNormalMm: mapped.localNormalMm ?? undefined,
        localUAxisMm: anchor.localUAxisMm
            ? mapLocalDirToNode(geomNode, body, anchor.localUAxisMm)
            : undefined,
        localVAxisMm: anchor.localVAxisMm
            ? mapLocalDirToNode(geomNode, body, anchor.localVAxisMm)
            : undefined,
        quadCenterMm: anchor.quadCenterMm
            ? mapLocalMmToNode(geomNode, body, anchor.quadCenterMm).localPointMm
            : undefined,
    });
}

function cameraViewDirCad(): [number, number, number] | null {
    const camera = ContextManager.instance.viewport?.camera;
    const fwd = camera?.getForwardRay?.()?.direction;
    if (!fwd) {
        return null;
    }
    const cad = renderToCAD(new Vec3(fwd.x, fwd.y, fwd.z)).normalize();
    return [cad.x, cad.y, cad.z];
}

function matrixNormal(m: number[], x: number, y: number, z: number): { x: number; y: number; z: number } {
    return {
        x: m[0] * x + m[4] * y + m[8] * z,
        y: m[1] * x + m[5] * y + m[9] * z,
        z: m[2] * x + m[6] * y + m[10] * z,
    };
}

function quadFromPickMesh(
    node: CADNode,
    mesh: any,
): Pick<
    ConstraintAnchor,
    'localUAxisMm' | 'localVAxisMm' | 'quadCenterMm' | 'quadWidthMm' | 'quadHeightMm'
> | null {
    if (!mesh) {
        return null;
    }
    const wm = mesh.getWorldMatrix?.();
    const m: number[] | null = wm?.m ?? wm?.asArray?.() ?? (Array.isArray(wm) ? wm : null);
    if (!m || m.length < 12) {
        return null;
    }
    const uWorld = matrixNormal(m, 1, 0, 0);
    const vWorld = matrixNormal(m, 0, 1, 0);
    const uAxis = babylonPickToLocalMm(node, { x: 0, y: 0, z: 0 }, uWorld).localNormalMm;
    const vAxis = babylonPickToLocalMm(node, { x: 0, y: 0, z: 0 }, vWorld).localNormalMm;
    if (!uAxis || !vAxis) {
        return null;
    }
    const ext = mesh.getBoundingInfo?.()?.boundingBox?.extendSize;
    const width = ext ? Math.abs(ext.x) * 2 : 0;
    const height = ext ? Math.abs(ext.y) * 2 : 0;
    if (!(width > 1) || !(height > 1)) {
        return null;
    }
    const abs = mesh.getAbsolutePosition?.() ?? mesh.absolutePosition;
    const quadCenterMm = abs
        ? babylonPickToLocalMm(node, { x: abs.x, y: abs.y, z: abs.z }).localPointMm
        : undefined;
    return {
        localUAxisMm: uAxis,
        localVAxisMm: vAxis,
        quadCenterMm,
        quadWidthMm: width,
        quadHeightMm: height,
    };
}

function quadFromNamedFace(
    node: CADNode,
    faceName: string,
): Pick<
    ConstraintAnchor,
    'localUAxisMm' | 'localVAxisMm' | 'quadCenterMm' | 'quadWidthMm' | 'quadHeightMm'
> | null {
    const named = resolveFaceQuadMm(node, faceName);
    if (!named) {
        return null;
    }
    return {
        localUAxisMm: named.uAxis,
        localVAxisMm: named.vAxis,
        quadCenterMm: named.center,
        quadWidthMm: named.width,
        quadHeightMm: named.height,
    };
}

function buildFaceAnchor(targetNode: CADNode, data: any): ConstraintAnchor | null {
    if (!data?.worldPoint) {
        return null;
    }
    const wp = data.worldPoint;
    const wn = data.worldNormal ?? null;
    const { localPointMm, localNormalMm } = babylonPickToLocalMm(
        targetNode,
        { x: wp.x, y: wp.y, z: wp.z },
        wn ? { x: wn.x, y: wn.y, z: wn.z } : null,
    );

    let faceName = '';
    if (data.face) {
        faceName = String(data.face);
        try {
            faceName = normalizeFaceName(faceName);
        } catch {
            /* zostaw alias (front/left/…) */
        }
    }

    // Nazwa z podświetlonego mesha wygrywa z getNormal(): front/back formatki
    // mają geometryczną normalną do środka płyty, więc raycast odwraca INNER/OUTER.
    const named = faceName ? namedFaceFromPick(targetNode, faceName, localPointMm) : null;
    if (named) {
        const quad =
            quadFromPickMesh(targetNode, data.mesh) ?? quadFromNamedFace(targetNode, faceName);
        return bindAnchorToRigidBody(
            targetNode,
            makeAnchor({
                nodeId: targetNode.id,
                kind: 'FACE',
                faceName,
                localPointMm: named.localPointMm,
                localNormalMm: named.localNormalMm,
                ...quad,
            }),
        );
    }

    const hasNormal =
        Boolean(localNormalMm) && Math.hypot(localNormalMm![0], localNormalMm![1], localNormalMm![2]) > 0.5;

    // Trafienie w mesh ściany: punkt i normalna z raya, nie środek AABB.
    if (hasNormal) {
        const quad =
            quadFromPickMesh(targetNode, data.mesh) ??
            (faceName ? quadFromNamedFace(targetNode, faceName) : null);
        return bindAnchorToRigidBody(
            targetNode,
            makeAnchor({
                nodeId: targetNode.id,
                kind: 'FACE',
                faceName,
                localPointMm,
                localNormalMm: localNormalMm as SolverVec3,
                ...quad,
            }),
        );
    }

    // Krawędź / gabaryt bez normalnej — ściana TEGO węzła (formatka albo korpus).
    if (!getLocalBoxMm(targetNode)) {
        return null;
    }
    const snapped = snapPickToSmartFrame(
        targetNode,
        'FACE',
        localPointMm,
        cameraViewDirCad(),
        localNormalMm,
    );
    if (!snapped) {
        return null;
    }
    const quad = quadFromNamedFace(targetNode, snapped.faceName);
    return bindAnchorToRigidBody(
        targetNode,
        makeAnchor({
            nodeId: targetNode.id,
            kind: 'FACE',
            faceName: snapped.faceName,
            localPointMm: snapped.localPointMm,
            localNormalMm: snapped.localNormalMm,
            ...quad,
        }),
    );
}

function buildVertexAnchor(targetNode: CADNode, data: any): ConstraintAnchor | null {
    if (!data?.worldPoint) {
        return null;
    }
    const wp = data.worldPoint;
    const { localPointMm } = babylonPickToLocalMm(targetNode, { x: wp.x, y: wp.y, z: wp.z });
    const snapped = snapPickToSmartFrame(targetNode, 'VERTEX', localPointMm);
    if (!snapped) {
        return null;
    }
    return bindAnchorToRigidBody(
        targetNode,
        makeAnchor({
            nodeId: targetNode.id,
            kind: 'VERTEX',
            cornerIndex: snapped.cornerIndex,
            localPointMm: snapped.localPointMm,
        }),
    );
}

function nodeFromPickData(data: any): CADNode | null {
    const doc = ContextManager.instance.document;
    const model = data?.panelModel ?? data?.mesh?.metadata?.panelModel ?? data?.mesh?.metadata?.model;
    if (!doc || !model?.id) {
        return null;
    }
    return doc.findNode(model.id);
}

function clearPickerHighlights(): void {
    const picker = ContextManager.instance.facePicker;
    if (!picker) {
        return;
    }
    if (typeof picker.resetAllFaceHighlights === 'function') {
        picker.resetAllFaceHighlights();
    } else {
        picker.clearSelection();
    }
}

export function stopConstraintPick(restoreSelectionMode: boolean = true): void {
    ContextManager.instance.activeConstraintPicker = null;
    clearPickerHighlights();

    const facePicker = ContextManager.instance.facePicker;
    if (facePicker) {
        facePicker.targetSubgeometryType = null;
        if (typeof facePicker.setVertexPickPreview === 'function') {
            facePicker.setVertexPickPreview(false);
        }
    }

    if (restoreSelectionMode) {
        const mode = getSelectionModeForTab(ContextManager.instance.activeTab);
        ContextManager.instance.appAPI?.setSelectionMode?.(mode);
    }
    ContextManager.instance.appAPI?.setStatus?.('Gotowy', false);
    notifySolverVisibilityChanged();
}

export function startConstraintPick(picker: ActiveConstraintPicker): void {
    stopConstraintPick(false);

    const appApi = ContextManager.instance.appAPI;
    const facePicker = ContextManager.instance.facePicker;

    clearPickerHighlights();
    ContextManager.instance.activeConstraintPicker = picker;

    appApi?.setSelectionMode?.(picker.expectedKind === 'OBJECT' ? 'object' : 'subgeometry');

    if (facePicker && picker.expectedKind === 'VERTEX') {
        facePicker.targetSubgeometryType = 'vertex';
        facePicker.setVertexPickPreview(true);
    } else if (facePicker && picker.expectedKind === 'FACE') {
        // Ściana formatki albo krawędź — kotwica na klikniętym komponencie.
        facePicker.targetSubgeometryType = null;
        facePicker.setVertexPickPreview(false);
    } else if (facePicker) {
        facePicker.targetSubgeometryType = null;
        facePicker.setVertexPickPreview(false);
    }

    notifySolverVisibilityChanged();
    if (facePicker && picker.expectedKind === 'VERTEX') {
        facePicker.setVertexPickPreview(true);
    }

    appApi?.setStatus?.(picker.label, true);
}

/** Przypisz aktywny korpus/formatkę bez klikania w scenie. */
export function pickActiveObjectAnchor(): ConstraintAnchor | null {
    const doc = ContextManager.instance.document;
    const active = doc?.activeEntity;
    if (!active?.id) {
        return null;
    }
    const node = doc!.findNode(active.id);
    const geom = resolveBindingTarget(node);
    if (!geom) {
        return null;
    }
    return bindAnchorToRigidBody(geom, makeAnchor({ nodeId: geom.id, kind: 'OBJECT' }));
}

/**
 * Obsługuje zdarzenie z FacePicker. Zwraca true, gdy zdarzenie zostało
 * przechwycone przez pipetę więzów (reszta handlera w app.ts ma pominąć).
 */
export function handleConstraintPickEvent(type: string, data: any): boolean {
    const picker = getActiveConstraintPicker();
    if (!picker) {
        return false;
    }

    const finish = (anchor: ConstraintAnchor | null) => {
        stopConstraintPick();
        if (anchor) {
            picker.onPick(anchor);
        } else {
            picker.onCancel?.();
        }
    };

    if (picker.expectedKind === 'OBJECT') {
        if (type !== 'select') {
            return false;
        }
        const node = nodeFromPickData(data);
        const geom = resolveBindingTarget(node);
        if (!geom) {
            ContextManager.instance.appAPI?.setStatus?.('Wskaż korpus albo formatkę.', true);
            return true;
        }
        finish(bindAnchorToRigidBody(geom, makeAnchor({ nodeId: geom.id, kind: 'OBJECT' })));
        return true;
    }

    if (picker.expectedKind === 'FACE') {
        const isFace = type === 'select' && (data?.face || data?.worldPoint);
        const isEdge = type === 'select-edge' && data?.worldPoint;
        if (!isFace && !isEdge) {
            return false;
        }
        const node = nodeFromPickData(data);
        const target = resolveBindingTarget(node);
        if (!target) {
            ContextManager.instance.appAPI?.setStatus?.(
                'Wskaż ścianę formatki albo krawędź korpusu.',
                true,
            );
            return true;
        }
        const anchor = buildFaceAnchor(target, data);
        if (!anchor) {
            ContextManager.instance.appAPI?.setStatus?.('Nie udało się odczytać ściany.', true);
            return true;
        }
        finish(anchor);
        return true;
    }

    if (picker.expectedKind === 'VERTEX') {
        if (type !== 'select-vertex' || !data?.worldPoint) {
            return false;
        }
        const node = nodeFromPickData(data);
        const target = resolveBindingTarget(node);
        if (!target) {
            ContextManager.instance.appAPI?.setStatus?.('Wskaż narożnik formatki albo korpusu.', true);
            return true;
        }
        const anchor = buildVertexAnchor(target, data);
        if (!anchor) {
            return true;
        }
        finish(anchor);
        return true;
    }

    return false;
}
