/**
 * constraint-drag-group.ts — względne stopnie swobody podczas dragu.
 *
 * Więz bez GROUND nie kotwiczy osi do świata. Przeciągany korpus zachowuje
 * pełną deltę gizma; sąsiad dostaje wyłącznie składową związaną (np. Z po
 * wyrównaniu gór). GROUND na sąsiedzie dopiero klamruje przeciąganego.
 */

import { Mat4 } from '../A1_core/cad-math/mat4.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import { TransformNodeCommand } from '../A1_core/commands/transform-node-command.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { ConstraintGraph } from './core/graph.js';
import {
    applyWorldRotation,
    buildConstraintFrames,
    buildGroundLocks,
    localPointOn,
    otherNodeId,
    projectOntoConstrainedSpace,
    projectOntoFreeSpace,
    rotationConstrainedDelta,
    swingTwistDecompose,
    worldDeltaRotation,
    type ConstraintFrame,
    type GroundLock,
} from './constraint-dof.js';
import type { SolverConstraint } from './constraint-types.js';
import { constraintNodeIds } from './constraint-types.js';
import { validateConstraints } from './constraint-validation.js';

export interface WorldPose {
    translation: Vec3;
    rotation: Quat;
    scale: Vec3;
    matrix: Mat4;
}

/** Węzły uziemione GROUND — nie biorą udziału w grupowym dragu. */
export function getGroundFixedNodeIds(constraints: SolverConstraint[]): Set<string> {
    const fixed = new Set<string>();
    for (const c of constraints) {
        if (!c.enabled || c.bindType !== 'GROUND' || !c.anchorA) {
            continue;
        }
        fixed.add(c.anchorA.nodeId);
    }
    return fixed;
}

/** Krawędzie grafu więzów (tylko relacje między korpusami, bez GROUND). */
export function buildNonGroundConstraintEdges(constraints: SolverConstraint[]): Record<string, string[]> {
    const edges: Record<string, string[]> = {};

    const link = (a: string, b: string) => {
        if (!edges[a]) edges[a] = [];
        if (!edges[b]) edges[b] = [];
        if (!edges[a].includes(b)) edges[a].push(b);
        if (!edges[b].includes(a)) edges[b].push(a);
    };

    for (const c of constraints) {
        if (!c.enabled || c.bindType === 'GROUND' || c.conflict) {
            continue;
        }
        const ids = constraintNodeIds(c);
        if (ids.length !== 2) {
            continue;
        }
        link(ids[0], ids[1]);
    }

    return edges;
}

export function getConstraintDragGroup(
    nodeId: string,
    constraints: SolverConstraint[],
): Set<string> {
    const fixed = getGroundFixedNodeIds(constraints);
    const edges = buildNonGroundConstraintEdges(constraints);
    return ConstraintGraph.getConnectedComponent(nodeId, edges, fixed);
}

export function projectTranslationDelta(delta: Vec3, blockedAxes: Vec3[]): Vec3 {
    return projectOntoFreeSpace(delta, blockedAxes);
}

export function constrainedTranslationDelta(delta: Vec3, constrainedAxes: Vec3[]): Vec3 {
    return projectOntoConstrainedSpace(delta, constrainedAxes);
}

function poseFromTRS(translation: Vec3, rotation: Quat, scale: Vec3): WorldPose {
    const matrix = Mat4.fromTRS(translation, rotation, scale);
    return { translation, rotation, scale, matrix };
}

function poseFromMatrix(m: Mat4): WorldPose {
    const { translation, rotation, scale } = m.decompose();
    return { translation, rotation, scale, matrix: m.clone() };
}

function setWorldPose(node: CADNode, pose: WorldPose): void {
    const parent = node.parent;
    const localAfter = parent
        ? parent.getWorldMatrix().invert().multiply(pose.matrix)
        : pose.matrix;
    node.setLocalMatrix(localAfter);
}

function worldPoint(pose: WorldPose, localNm: Vec3): Vec3 {
    return pose.matrix.transformPoint(localNm);
}

function transferredPose(
    frame: ConstraintFrame,
    sourceId: string,
    sourceInitial: WorldPose,
    sourceCurrent: WorldPose,
    targetInitial: WorldPose,
    targetId: string,
): WorldPose {
    if (frame.kind === 'point') {
        const srcLocal = localPointOn(frame, sourceId);
        const tgtLocal = localPointOn(frame, targetId);
        const sourceNow = worldPoint(sourceCurrent, srcLocal);
        const offset = Mat4.fromTRS(Vec3.ZERO, targetInitial.rotation, targetInitial.scale).transformPoint(
            tgtLocal,
        );
        return poseFromTRS(sourceNow.sub(offset), targetInitial.rotation, targetInitial.scale);
    }

    const deltaT = sourceCurrent.translation.sub(sourceInitial.translation);
    const pointLocal = localPointOn(frame, sourceId);
    const planeDelta = worldPoint(sourceCurrent, pointLocal).sub(worldPoint(sourceInitial, pointLocal));
    const transferredT = projectOntoConstrainedSpace(
        planeDelta.lengthSquared() > 1e-18 ? planeDelta : deltaT,
        frame.translationConstrainedBasis,
    );

    const deltaR = worldDeltaRotation(sourceInitial.rotation, sourceCurrent.rotation);
    const swing = rotationConstrainedDelta(deltaR, frame.twistAxis);

    return poseFromTRS(
        targetInitial.translation.add(transferredT),
        applyWorldRotation(targetInitial.rotation, swing),
        targetInitial.scale,
    );
}

function applyGroundLock(lock: GroundLock, initial: WorldPose, current: WorldPose): WorldPose {
    if (lock.mode === 'OBJECT') {
        return initial;
    }
    if (lock.mode === 'VERTEX') {
        const initialPt = worldPoint(initial, lock.localPointNm);
        const currentPt = worldPoint(current, lock.localPointNm);
        return poseFromTRS(
            current.translation.add(initialPt.sub(currentPt)),
            current.rotation,
            current.scale,
        );
    }
    const twistAxis = lock.twistAxis ?? Vec3.UNIT_Z;
    const deltaR = worldDeltaRotation(initial.rotation, current.rotation);
    const { twist } = swingTwistDecompose(deltaR, twistAxis);
    const rotation = applyWorldRotation(initial.rotation, twist);
    const rotated = poseFromTRS(current.translation, rotation, current.scale);
    const initialPt = worldPoint(initial, lock.localPointNm);
    const currentPt = worldPoint(rotated, lock.localPointNm);
    return poseFromTRS(
        rotated.translation.add(initialPt.sub(currentPt)),
        rotation,
        current.scale,
    );
}

function clampDraggedAgainstFrame(
    frame: ConstraintFrame,
    draggedId: string,
    initialDragged: WorldPose,
    draggedPose: WorldPose,
    otherInitial: WorldPose,
): WorldPose {
    const otherId = otherNodeId(frame, draggedId);
    if (!otherId) {
        return draggedPose;
    }

    if (frame.kind === 'point') {
        const srcLocal = localPointOn(frame, draggedId);
        const tgtLocal = localPointOn(frame, otherId);
        const otherPt = worldPoint(otherInitial, tgtLocal);
        const currentPt = worldPoint(draggedPose, srcLocal);
        return poseFromTRS(
            draggedPose.translation.add(otherPt.sub(currentPt)),
            draggedPose.rotation,
            draggedPose.scale,
        );
    }

    const requiredOther = transferredPose(
        frame,
        draggedId,
        initialDragged,
        draggedPose,
        otherInitial,
        otherId,
    );
    const driftT = requiredOther.translation.sub(otherInitial.translation);
    let result = poseFromTRS(
        draggedPose.translation.sub(driftT),
        draggedPose.rotation,
        draggedPose.scale,
    );

    if (frame.twistAxis) {
        const deltaR = worldDeltaRotation(initialDragged.rotation, result.rotation);
        const { twist } = swingTwistDecompose(deltaR, frame.twistAxis);
        result = poseFromTRS(
            result.translation,
            applyWorldRotation(initialDragged.rotation, twist),
            result.scale,
        );
    }
    return result;
}

function accumulateTransfers(
    frames: ConstraintFrame[],
    sourceId: string,
    sourceInitial: WorldPose,
    sourceCurrent: WorldPose,
    targetId: string,
    targetInitial: WorldPose,
): WorldPose {
    let translation = targetInitial.translation;
    let rotation = targetInitial.rotation;
    for (const frame of frames) {
        const next = transferredPose(
            frame,
            sourceId,
            sourceInitial,
            sourceCurrent,
            targetInitial,
            targetId,
        );
        translation = translation.add(next.translation.sub(targetInitial.translation));
        rotation = next.rotation;
    }
    return poseFromTRS(translation, rotation, targetInitial.scale);
}

export class ConstraintDragGroup {
    private static _instance: ConstraintDragGroup | null = null;

    static get instance(): ConstraintDragGroup {
        if (!ConstraintDragGroup._instance) {
            ConstraintDragGroup._instance = new ConstraintDragGroup();
        }
        return ConstraintDragGroup._instance;
    }

    private _groupIds = new Set<string>();
    private _lastComponentIds = new Set<string>();
    private _matricesBefore = new Map<string, Mat4>();
    private _initialWorld = new Map<string, WorldPose>();
    private _frames: ConstraintFrame[] = [];
    private _groundLocks: GroundLock[] = [];
    private _groundedIds = new Set<string>();
    private _draggedNodeId: string | null = null;
    private _conflictIds = new Set<string>();

    get isActive(): boolean {
        return this._groupIds.size > 0;
    }

    get groupIds(): Set<string> {
        return new Set(this._groupIds);
    }

    /** Komponent z ostatniego dragu — do lokalnego solve po puszczeniu. */
    get lastComponentIds(): Set<string> {
        return new Set(this._lastComponentIds);
    }

    get lastDraggedNodeId(): string | null {
        return this._draggedNodeId;
    }

    get conflictIds(): Set<string> {
        return new Set(this._conflictIds);
    }

    begin(document: ProjectDocument, nodeId: string, constraints: SolverConstraint[]): void {
        this.end();
        this._draggedNodeId = nodeId;
        const validation = validateConstraints(constraints, document);
        const active = constraints.filter((c) => !validation.skipIds.has(c.id));
        this._groundedIds = getGroundFixedNodeIds(active);
        let group = getConstraintDragGroup(nodeId, active);
        if (group.size === 0) {
            group = new Set([nodeId]);
        }
        this._groupIds = group;
        this._lastComponentIds = new Set(group);
        this._frames = buildConstraintFrames(document, active);
        this._groundLocks = buildGroundLocks(document, active);
        for (const frame of this._frames) {
            if (this._lastComponentIds.has(frame.aId) || this._groupIds.has(frame.aId)) {
                this._lastComponentIds.add(frame.bId);
            }
            if (this._lastComponentIds.has(frame.bId) || this._groupIds.has(frame.bId)) {
                this._lastComponentIds.add(frame.aId);
            }
        }
        for (const lock of this._groundLocks) {
            if (this._groupIds.has(lock.nodeId) || this._lastComponentIds.has(lock.nodeId)) {
                this._lastComponentIds.add(lock.nodeId);
            }
        }

        const involved = new Set(group);
        for (const lock of this._groundLocks) {
            involved.add(lock.nodeId);
        }
        for (const frame of this._frames) {
            involved.add(frame.aId);
            involved.add(frame.bId);
        }

        for (const id of involved) {
            const node = document.findNode(id);
            if (!node) {
                continue;
            }
            if (group.has(id)) {
                this._matricesBefore.set(id, node.localMatrix.clone());
            }
            this._initialWorld.set(id, poseFromMatrix(node.getWorldMatrix()));
        }
    }

    /**
     * Po ruchu gizma: przeciągany zostaje z deltą, składowa związana idzie
     * na nieuziemionych sąsiadów. GROUND klamruje przeciąganego.
     */
    propagateTranslation(document: ProjectDocument, draggedNodeId: string): void {
        this.propagateTransform(document, draggedNodeId);
    }

    propagateTransform(document: ProjectDocument, draggedNodeId: string): void {
        if (!this._groupIds.has(draggedNodeId) && draggedNodeId !== this._draggedNodeId) {
            return;
        }

        const draggedNode = document.findNode(draggedNodeId);
        const initialDragged = this._initialWorld.get(draggedNodeId);
        if (!draggedNode || !initialDragged) {
            return;
        }

        this._conflictIds.clear();
        let draggedPose = poseFromMatrix(draggedNode.getWorldMatrix());

        for (const lock of this._groundLocks) {
            if (lock.nodeId === draggedNodeId) {
                draggedPose = applyGroundLock(lock, initialDragged, draggedPose);
            }
        }

        for (let pass = 0; pass < 3; pass++) {
            let changed = false;
            for (const frame of this._frames) {
                const other = otherNodeId(frame, draggedNodeId);
                if (!other || !this._groundedIds.has(other)) {
                    continue;
                }
                const otherInitial = this._initialWorld.get(other);
                if (!otherInitial) {
                    continue;
                }
                const before = draggedPose.translation;
                draggedPose = clampDraggedAgainstFrame(
                    frame,
                    draggedNodeId,
                    initialDragged,
                    draggedPose,
                    otherInitial,
                );
                if (draggedPose.translation.sub(before).length() > 1.0) {
                    changed = true;
                }
            }
            if (!changed) {
                break;
            }
        }

        const poses = new Map<string, WorldPose>();
        for (const [id, initial] of this._initialWorld) {
            poses.set(id, initial);
        }
        poses.set(draggedNodeId, draggedPose);

        const visited = new Set<string>([draggedNodeId]);
        const queue = [draggedNodeId];
        while (queue.length > 0) {
            const sourceId = queue.shift()!;
            const sourceCurrent = poses.get(sourceId);
            const sourceInitial = this._initialWorld.get(sourceId);
            if (!sourceCurrent || !sourceInitial) {
                continue;
            }

            const framesByNeighbor = new Map<string, ConstraintFrame[]>();
            for (const frame of this._frames) {
                const dst = otherNodeId(frame, sourceId);
                if (!dst || this._groundedIds.has(dst) || visited.has(dst)) {
                    continue;
                }
                const list = framesByNeighbor.get(dst) ?? [];
                list.push(frame);
                framesByNeighbor.set(dst, list);
            }

            for (const [dst, dstFrames] of framesByNeighbor) {
                const dstInitial = this._initialWorld.get(dst);
                if (!dstInitial) {
                    continue;
                }
                poses.set(
                    dst,
                    accumulateTransfers(
                        dstFrames,
                        sourceId,
                        sourceInitial,
                        sourceCurrent,
                        dst,
                        dstInitial,
                    ),
                );
                visited.add(dst);
                queue.push(dst);
            }
        }

        for (const [id, pose] of poses) {
            if (this._groundedIds.has(id)) {
                const initial = this._initialWorld.get(id);
                const node = document.findNode(id);
                if (node && initial) {
                    setWorldPose(node, initial);
                }
                continue;
            }
            const node = document.findNode(id);
            if (node) {
                setWorldPose(node, pose);
            }
        }
    }

    buildTransformCommands(document: ProjectDocument, label: string): TransformNodeCommand[] {
        const commands: TransformNodeCommand[] = [];
        for (const [id, before] of this._matricesBefore) {
            const node = document.findNode(id);
            if (!node) {
                continue;
            }
            const after = node.localMatrix;
            if (!before.equals(after)) {
                commands.push(new TransformNodeCommand(id, before, after.clone(), label));
            }
        }
        return commands;
    }

    restoreInitial(document: ProjectDocument): void {
        for (const [id, matrix] of this._matricesBefore) {
            const node = document.findNode(id);
            node?.setLocalMatrix(matrix.clone());
        }
    }

    end(): void {
        this._groupIds.clear();
        this._matricesBefore.clear();
        this._initialWorld.clear();
        this._frames = [];
        this._groundLocks = [];
        this._groundedIds.clear();
        this._conflictIds.clear();
    }
}
