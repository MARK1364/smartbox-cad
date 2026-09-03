/**
 * Poza kamery arkusza eksportu: pozycja korpusów na scenie w chwili kadru.
 * Przywrócenie samego alpha/beta nie wraca rzutu, jeśli użytkownik obrócił mebel gizmo.
 */

import { NodeType } from '../A1_core/cad-node/node-type.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import type { ProjectDocument } from '../A1_core/project-document.js';

export interface ExportNodePose {
    nodeId: string;
    translationNm: [number, number, number];
    rotationQuat: [number, number, number, number];
    scale?: [number, number, number];
}

function shouldCapturePose(node: CADNode): boolean {
    if (node.nodeType === NodeType.ASSEMBLY) return true;
    if (node.nodeType === NodeType.PART && node.parent?.nodeType === NodeType.ROOM) return true;
    return false;
}

function poseOf(node: CADNode): ExportNodePose {
    const { translation, rotation, scale } = node.localMatrix.decompose();
    return {
        nodeId: node.id,
        translationNm: [translation.x, translation.y, translation.z],
        rotationQuat: [rotation.x, rotation.y, rotation.z, rotation.w],
        scale: [scale.x, scale.y, scale.z],
    };
}

export function collectExportNodePoses(document: ProjectDocument | null | undefined): ExportNodePose[] {
    if (!document?.rootNode) return [];
    const poses: ExportNodePose[] = [];
    const walk = (node: CADNode) => {
        if (shouldCapturePose(node)) poses.push(poseOf(node));
        for (const child of node.children) walk(child);
    };
    for (const child of document.rootNode.children) walk(child);
    return poses;
}

export function cloneExportNodePoses(poses: ExportNodePose[] | undefined | null): ExportNodePose[] {
    if (!Array.isArray(poses)) return [];
    return poses.map((pose) => ({
        nodeId: pose.nodeId,
        translationNm: [...pose.translationNm] as [number, number, number],
        rotationQuat: [...pose.rotationQuat] as [number, number, number, number],
        scale: pose.scale ? [...pose.scale] as [number, number, number] : undefined,
    }));
}

export function restoreExportNodePoses(
    document: ProjectDocument | null | undefined,
    poses: ExportNodePose[] | undefined | null,
): string[] {
    if (!document || !Array.isArray(poses) || poses.length === 0) return [];
    const restored: string[] = [];
    for (const pose of poses) {
        const node = document.findNode(pose.nodeId);
        if (!node) continue;
        const { scale: currentScale } = node.localMatrix.decompose();
        const scale = pose.scale
            ? new Vec3(pose.scale[0], pose.scale[1], pose.scale[2])
            : currentScale;
        node.setLocalTransform(
            new Vec3(pose.translationNm[0], pose.translationNm[1], pose.translationNm[2]),
            new Quat(pose.rotationQuat[0], pose.rotationQuat[1], pose.rotationQuat[2], pose.rotationQuat[3]),
            scale,
        );
        restored.push(node.id);
    }
    if (restored.length > 0 && typeof document.emitChange === 'function') {
        document.emitChange('transform', restored);
    }
    return restored;
}
