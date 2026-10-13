/**
 * Stan sceny w kadrze eksportu: pozycja korpusów + widoczność obiektów.
 * Przywrócenie samej kamery nie wraca rzutu, jeśli użytkownik obrócił / ukrył mebel.
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

export interface ExportNodeVisibility {
    nodeId: string;
    visible: boolean;
}

function shouldCapturePose(node: CADNode): boolean {
    // Tylko ruchome korzenie sceny — dzieci korpusu trzymają lokalne TRS względem ASSEMBLY.
    if (node.nodeType === NodeType.ASSEMBLY) return true;
    if (node.parent?.nodeType !== NodeType.ROOM) return false;
    if (node.nodeType === NodeType.PART) return true;
    if (node.nodeType === NodeType.HARDWARE) return true;
    return false;
}

function shouldCaptureVisibility(node: CADNode): boolean {
    return (
        node.nodeType === NodeType.ASSEMBLY ||
        node.nodeType === NodeType.PART ||
        node.nodeType === NodeType.HARDWARE
    );
}

function readNodeVisible(node: CADNode): boolean {
    const data = node.domainData as { visible?: boolean } | null | undefined;
    if (!data) return true;
    return data.visible !== false;
}

function writeNodeVisible(node: CADNode, visible: boolean): void {
    if (!node.domainData) {
        (node as unknown as { domainData: { visible: boolean } }).domainData = { visible };
        return;
    }
    (node.domainData as unknown as { visible: boolean }).visible = visible;
}

/** Dopasowanie feature panelu do węzła okucia — jak w tree-action-handlers. */
function featureMatchesHardware(feat: any, hwNodeId: string): boolean {
    if (!feat) return false;
    const featId = String(feat.id || '').toLowerCase();
    const p = feat.params || {};
    const targetId = String(hwNodeId || '').toLowerCase();

    if (p.hardwareId && (targetId.endsWith(String(p.hardwareId).toLowerCase()) || targetId.includes(String(p.hardwareId).toLowerCase()))) {
        return true;
    }
    if (p.hardwareNodeId && String(p.hardwareNodeId).toLowerCase() === targetId) {
        return true;
    }

    const hwMatch = targetId.match(/hinge_([a-z]+)_(\d+)/i);
    if (hwMatch) {
        const side = hwMatch[1].toLowerCase();
        const idx = hwMatch[2];
        if (
            featId.includes(`_${side}_${idx}`) ||
            featId.includes(`${side}_${idx}`) ||
            (p.side && String(p.side).toLowerCase() === side && String(p.hingeIndex) === String(idx))
        ) {
            return true;
        }
    }
    return false;
}

function syncHardwareFeatureVisibility(document: ProjectDocument, hwNodeId: string, visible: boolean): void {
    const walk = (node: CADNode) => {
        if (node.nodeType === NodeType.PART) {
            const panel = node.domainData as { features?: any[] } | null | undefined;
            for (const feat of panel?.features || []) {
                if (!featureMatchesHardware(feat, hwNodeId)) continue;
                feat.visible = visible;
                if (feat.params) feat.params.visible = visible;
            }
        }
        for (const child of node.children) walk(child);
    };
    if (document.rootNode) {
        for (const child of document.rootNode.children) walk(child);
    }
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

export function collectExportNodeVisibility(
    document: ProjectDocument | null | undefined,
): ExportNodeVisibility[] {
    if (!document?.rootNode) return [];
    const items: ExportNodeVisibility[] = [];
    const walk = (node: CADNode) => {
        if (shouldCaptureVisibility(node)) {
            items.push({ nodeId: node.id, visible: readNodeVisible(node) });
        }
        for (const child of node.children) walk(child);
    };
    for (const child of document.rootNode.children) walk(child);
    return items;
}

export function cloneExportNodeVisibility(
    items: ExportNodeVisibility[] | undefined | null,
): ExportNodeVisibility[] {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
        nodeId: item.nodeId,
        visible: item.visible !== false,
    }));
}

export function restoreExportNodeVisibility(
    document: ProjectDocument | null | undefined,
    items: ExportNodeVisibility[] | undefined | null,
): string[] {
    if (!document || !Array.isArray(items) || items.length === 0) return [];
    const restored: string[] = [];
    for (const item of items) {
        const node = document.findNode(item.nodeId);
        if (!node) continue;
        const visible = item.visible !== false;
        writeNodeVisible(node, visible);
        if (node.nodeType === NodeType.HARDWARE) {
            syncHardwareFeatureVisibility(document, node.id, visible);
        }
        restored.push(node.id);
    }
    if (restored.length > 0 && typeof document.emitChange === 'function') {
        document.emitChange('all', restored);
    }
    return restored;
}

/** Po przywróceniu widoczności — synchronizacja meshów Babylon (hook z cad-app). */
export function notifyExportSceneRebuild(message = 'Przywrócono kadr eksportu'): void {
    const rebuild = (typeof window !== 'undefined' && (window as any).__rebuildGeometry) as
        | ((msg?: string) => void)
        | undefined;
    if (typeof rebuild === 'function') {
        try {
            rebuild(message);
        } catch (err) {
            console.warn('[export-view-state] rebuildGeometry failed:', err);
        }
    }
}
