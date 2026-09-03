/**
 * constraint-dof.ts — analityczne stopnie swobody więzów 3D.
 *
 * Ograniczenia są bazami w układzie świata (nie bitami XYZ), bo korpusy
 * mogą być obrócone. Brak Jacobiego: projekcja Gram–Schmidta + swing–twist.
 */

import { Quat } from '../A1_core/cad-math/quat.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { mmToNm } from '../A1_core/cad-math/units.js';
import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { resolveAnchor } from './constraint-geometry.js';
import type { ConstraintAnchor, SolverConstraint } from './constraint-types.js';

export const AXIS_EPS = 1e-12;
const AXIS_LEN_SQ = 1e-12;

export type MateKind = 'plane' | 'point' | 'full';

export interface ConstrainedSpace {
    translationConstrainedBasis: Vec3[];
    rotationConstrainedBasis: Vec3[];
}

export interface ConstraintFrame {
    constraintId: string;
    bindType: SolverConstraint['bindType'];
    kind: MateKind;
    aId: string;
    bId: string;
    /** Zamrożona normalna świata (płaszczyzna). */
    worldNormal: Vec3 | null;
    /** Punkt kotwicy w LCS A [nm]. */
    localPointANm: Vec3;
    /** Punkt kotwicy w LCS B [nm]. */
    localPointBNm: Vec3;
    translationConstrainedBasis: Vec3[];
    /** Oś twista — obrót wokół niej jest wolny (płaszczyzna). Null = brak wolnego obrotu. */
    twistAxis: Vec3 | null;
}

export interface GroundLock {
    nodeId: string;
    mode: 'OBJECT' | 'VERTEX' | 'FACE';
    localPointNm: Vec3;
    worldNormal: Vec3 | null;
    twistAxis: Vec3 | null;
    translationConstrainedBasis: Vec3[];
}

export function orthonormalize(axes: Vec3[], eps: number = AXIS_EPS): Vec3[] {
    const basis: Vec3[] = [];
    for (const axis of axes) {
        if (axis.lengthSquared() < AXIS_LEN_SQ) {
            continue;
        }
        let independent = axis.normalize();
        for (const existing of basis) {
            independent = independent.sub(existing.scale(independent.dot(existing)));
        }
        if (independent.lengthSquared() > eps) {
            basis.push(independent.normalize());
        }
    }
    return basis;
}

export function mergeAxes(a: Vec3[], b: Vec3[]): Vec3[] {
    return orthonormalize([...a, ...b]);
}

/** Składowa w przestrzeni wolnej (poza zadanymi osiami). */
export function projectOntoFreeSpace(delta: Vec3, constrained: Vec3[]): Vec3 {
    const basis = orthonormalize(constrained);
    let projected = delta;
    for (const axis of basis) {
        projected = projected.sub(axis.scale(projected.dot(axis)));
    }
    return projected;
}

/** Składowa w przestrzeni związanej (wzdłuż zadanych osi). */
export function projectOntoConstrainedSpace(delta: Vec3, constrained: Vec3[]): Vec3 {
    return delta.sub(projectOntoFreeSpace(delta, constrained));
}

export function rotationBetween(from: Vec3, to: Vec3): Quat {
    const f = from.lengthSquared() < AXIS_LEN_SQ ? Vec3.UNIT_Z : from.normalize();
    const t = to.lengthSquared() < AXIS_LEN_SQ ? Vec3.UNIT_Z : to.normalize();
    const dot = Math.max(-1, Math.min(1, f.dot(t)));
    if (dot > 0.9999999) {
        return Quat.IDENTITY;
    }
    if (dot < -0.9999999) {
        return Quat.fromAxisAngle(perpendicular(f), Math.PI);
    }
    const axis = f.cross(t);
    const angle = Math.acos(dot);
    if (axis.lengthSquared() < AXIS_LEN_SQ) {
        return Quat.IDENTITY;
    }
    return Quat.fromAxisAngle(axis, angle);
}

export function perpendicular(v: Vec3): Vec3 {
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    const az = Math.abs(v.z);
    let perp: Vec3;
    if (ax <= ay && ax <= az) {
        perp = new Vec3(0, -v.z, v.y);
    } else if (ay <= ax && ay <= az) {
        perp = new Vec3(-v.z, 0, v.x);
    } else {
        perp = new Vec3(-v.y, v.x, 0);
    }
    return perp.lengthSquared() < AXIS_LEN_SQ ? Vec3.UNIT_X : perp.normalize();
}

export function worldDeltaRotation(from: Quat, to: Quat): Quat {
    return to.multiply(from.inverse()).normalize();
}

/**
 * Rozkład obrotu na swing (zmienia oś) i twist (wokół osi).
 * `q = swing * twist` w przestrzeni świata, twist jest wokół `axis`.
 */
export function swingTwistDecompose(q: Quat, axis: Vec3): { swing: Quat; twist: Quat } {
    const n = axis.lengthSquared() < AXIS_LEN_SQ ? Vec3.UNIT_Z : axis.normalize();
    const rotated = q.rotateVec3(n);
    const swing = rotationBetween(n, rotated);
    const twist = swing.inverse().multiply(q).normalize();
    return { swing, twist };
}

export function applyWorldRotation(base: Quat, worldDelta: Quat): Quat {
    return worldDelta.multiply(base).normalize();
}

function localMmToNm(localMm: readonly [number, number, number] | undefined): Vec3 {
    const mm = localMm ?? ([0, 0, 0] as const);
    return new Vec3(mmToNm(mm[0]), mmToNm(mm[1]), mmToNm(mm[2]));
}

function worldNormalOf(node: CADNode, localNormal: readonly [number, number, number]): Vec3 {
    const n = node.getWorldMatrix().transformDirection(new Vec3(localNormal[0], localNormal[1], localNormal[2]));
    return n.lengthSquared() < AXIS_LEN_SQ ? Vec3.UNIT_Z : n.normalize();
}

function resolveOnNode(
    document: ProjectDocument,
    node: CADNode,
    anchor: ConstraintAnchor,
) {
    const geom = anchor.sourceNodeId ? document.findNode(anchor.sourceNodeId) : null;
    return resolveAnchor(node, anchor, geom);
}

export function buildGroundLocks(
    document: ProjectDocument,
    constraints: SolverConstraint[],
): GroundLock[] {
    const locks: GroundLock[] = [];
    for (const c of constraints) {
        if (!c.enabled || c.conflict || c.bindType !== 'GROUND' || !c.anchorA) {
            continue;
        }
        const node = document.findNode(c.anchorA.nodeId);
        if (!node) {
            continue;
        }
        const resolved = resolveOnNode(document, node, c.anchorA);
        const mode = c.anchorA.kind;
        if (mode === 'OBJECT') {
            locks.push({
                nodeId: node.id,
                mode,
                localPointNm: Vec3.ZERO,
                worldNormal: null,
                twistAxis: null,
                translationConstrainedBasis: [Vec3.UNIT_X, Vec3.UNIT_Y, Vec3.UNIT_Z],
            });
            continue;
        }
        if (mode === 'VERTEX') {
            locks.push({
                nodeId: node.id,
                mode,
                localPointNm: localMmToNm(resolved?.localPointMm),
                worldNormal: null,
                twistAxis: null,
                translationConstrainedBasis: [Vec3.UNIT_X, Vec3.UNIT_Y, Vec3.UNIT_Z],
            });
            continue;
        }
        if (mode === 'FACE') {
            const normal = resolved?.localNormal
                ? worldNormalOf(node, resolved.localNormal)
                : Vec3.UNIT_Z;
            locks.push({
                nodeId: node.id,
                mode,
                localPointNm: localMmToNm(resolved?.localPointMm),
                worldNormal: normal,
                twistAxis: normal,
                translationConstrainedBasis: [Vec3.UNIT_X, Vec3.UNIT_Y, Vec3.UNIT_Z],
            });
        }
    }
    return locks;
}

export function buildConstraintFrames(
    document: ProjectDocument,
    constraints: SolverConstraint[],
): ConstraintFrame[] {
    const frames: ConstraintFrame[] = [];
    for (const c of constraints) {
        if (!c.enabled || c.conflict || c.bindType === 'GROUND') {
            continue;
        }
        if (!c.anchorA || !c.anchorB) {
            continue;
        }
        const nodeA = document.findNode(c.anchorA.nodeId);
        const nodeB = document.findNode(c.anchorB.nodeId);
        if (!nodeA || !nodeB) {
            continue;
        }
        const resA = resolveOnNode(document, nodeA, c.anchorA);
        const resB = resolveOnNode(document, nodeB, c.anchorB);
        if (!resA || !resB) {
            continue;
        }

        if (c.bindType === 'VERTEX') {
            frames.push({
                constraintId: c.id,
                bindType: c.bindType,
                kind: 'point',
                aId: nodeA.id,
                bId: nodeB.id,
                worldNormal: null,
                localPointANm: localMmToNm(resA.localPointMm),
                localPointBNm: localMmToNm(resB.localPointMm),
                translationConstrainedBasis: [Vec3.UNIT_X, Vec3.UNIT_Y, Vec3.UNIT_Z],
                twistAxis: null,
            });
            continue;
        }

        if (c.bindType !== 'COPLANAR' && c.bindType !== 'FLUSH') {
            continue;
        }
        if (!resA.localNormal) {
            continue;
        }
        const worldNormal = worldNormalOf(nodeA, resA.localNormal);
        frames.push({
            constraintId: c.id,
            bindType: c.bindType,
            kind: 'plane',
            aId: nodeA.id,
            bId: nodeB.id,
            worldNormal,
            localPointANm: localMmToNm(resA.localPointMm),
            localPointBNm: localMmToNm(resB.localPointMm),
            translationConstrainedBasis: [worldNormal],
            twistAxis: worldNormal,
        });
    }
    return frames;
}

export function otherNodeId(frame: ConstraintFrame, nodeId: string): string | null {
    if (frame.aId === nodeId) {
        return frame.bId;
    }
    if (frame.bId === nodeId) {
        return frame.aId;
    }
    return null;
}

export function localPointOn(frame: ConstraintFrame, nodeId: string): Vec3 {
    return nodeId === frame.aId ? frame.localPointANm : frame.localPointBNm;
}

export function rotationConstrainedDelta(deltaRot: Quat, twistAxis: Vec3 | null): Quat {
    if (!twistAxis) {
        return deltaRot;
    }
    return swingTwistDecompose(deltaRot, twistAxis).swing;
}
