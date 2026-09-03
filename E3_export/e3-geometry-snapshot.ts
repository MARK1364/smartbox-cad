/**
 * Snapshot geometrii korpusu dla E3: prawdziwe formatki z pozycją/obrotem
 * względem upuszczonego węzła, już w układzie Babylon (mm, Y-up).
 */

import { CADNode } from '../A1_core/cad-node/cad-node';
import { NodeType } from '../A1_core/cad-node/node-type';
import { Mat4 } from '../A1_core/cad-math/mat4';
import { Quat } from '../A1_core/cad-math/quat';
import { Vec3 } from '../A1_core/cad-math/vec3';
import { cadToRender, cadMatrixToRenderMatrix } from '../A1_core/cad-math/coord-system';
import { nmToMm } from '../A1_core/cad-math/units';
import { ContextManager } from '../A1_core/context-manager';
import { toMm } from '../E2_export/drawing-project-extractor';

export const E3_GEOMETRY_STORAGE_KEY = 'smartbox_cad_e3_geometry_v1';
const PROJECT_STORAGE_KEY = 'smartpanel_project_current_v3';

export interface E3PartPose {
    id: string;
    name: string;
    role?: string;
    width: number;
    height: number;
    thickness: number;
    pos: [number, number, number];
    rotq: [number, number, number, number];
}

export interface E3GeometrySnapshot {
    id: string;
    name: string;
    type: 'CONTAINER' | 'PANEL';
    width: number;
    height: number;
    depth: number;
    parts: E3PartPose[];
}

function cadMatrixToBabylonPose(localCad: Mat4): { pos: [number, number, number]; rotq: [number, number, number, number] } {
    const { translation, rotation } = localCad.decompose();
    const mm = new Vec3(nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z));
    const pos = cadToRender(mm);
    const rotMat = cadMatrixToRenderMatrix(Mat4.fromQuaternion(rotation));
    const { rotation: bRot } = rotMat.decompose();
    return {
        pos: [pos.x, pos.y, pos.z],
        rotq: [bRot.x, bRot.y, bRot.z, bRot.w],
    };
}

function matrixFromSerializedNode(json: any): Mat4 {
    const t = json?.translationNm || [0, 0, 0];
    const q = json?.rotationQuat || [0, 0, 0, 1];
    const s = json?.scale || [1, 1, 1];
    return Mat4.fromTRS(
        new Vec3(t[0] || 0, t[1] || 0, t[2] || 0),
        new Quat(q[0] || 0, q[1] || 0, q[2] || 0, q[3] ?? 1),
        new Vec3(s[0] ?? 1, s[1] ?? 1, s[2] ?? 1),
    );
}

function dimsFromDomain(domain: any, isPanel: boolean): { width: number; height: number; depth: number; thickness: number } {
    const width = toMm(domain?.width, isPanel ? 600 : 800);
    const height = toMm(domain?.height, isPanel ? 720 : 720);
    const depth = toMm(domain?.depth, isPanel ? 18 : 560);
    const thickness = toMm(domain?.thickness ?? domain?.depth, 18);
    return { width, height, depth, thickness };
}

function collectCadParts(node: CADNode, acc: CADNode[]): void {
    const domain = node.domainData as any;
    if (node.nodeType === NodeType.PART || domain?.type === 'panel') acc.push(node);
    for (const child of node.children || []) {
        collectCadParts(child, acc);
    }
}

function snapshotFromCadNode(root: CADNode): E3GeometrySnapshot {
    const domain = (root.domainData || {}) as any;
    const isPanel = root.nodeType === NodeType.PART;
    const dims = dimsFromDomain(domain, isPanel);
    const parts: E3PartPose[] = [];
    const partNodes: CADNode[] = [];
    collectCadParts(root, partNodes);

    const rootWorld = root.getWorldMatrix();
    const rootInv = rootWorld.invert();

    const sources = partNodes.length > 0 ? partNodes : (isPanel ? [root] : []);
    for (const part of sources) {
        const pd = (part.domainData || {}) as any;
        const pdims = dimsFromDomain(pd, true);
        const relative = part === root ? Mat4.identity() : rootInv.multiply(part.getWorldMatrix());
        const pose = cadMatrixToBabylonPose(relative);
        parts.push({
            id: part.id,
            name: pd.name || part.name || 'Formatka',
            role: pd.role || part.name,
            width: pdims.width,
            height: pdims.height,
            thickness: pdims.thickness,
            pos: pose.pos,
            rotq: pose.rotq,
        });
    }

    return {
        id: root.id,
        name: domain.name || root.name || 'Korpus',
        type: isPanel ? 'PANEL' : 'CONTAINER',
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        parts,
    };
}

function findSerializedNode(json: any, id: string): any | null {
    if (!json) return null;
    if (json.id === id) return json;
    for (const child of json.children || []) {
        const found = findSerializedNode(child, id);
        if (found) return found;
    }
    return null;
}

function collectSerializedParts(json: any, acc: any[]): void {
    const type = json?.nodeType;
    const domainType = json?.domainData?.type;
    if (type === NodeType.PART || type === 'PART' || domainType === 'panel') acc.push(json);
    for (const child of json?.children || []) {
        collectSerializedParts(child, acc);
    }
}

function worldMatrixOfSerialized(json: any, ancestors: any[]): Mat4 {
    let m = Mat4.identity();
    for (const node of [...ancestors, json]) {
        m = m.multiply(matrixFromSerializedNode(node));
    }
    return m;
}

function snapshotFromSerialized(rootJson: any): E3GeometrySnapshot {
    const domain = rootJson.domainData || {};
    const isPanel = rootJson.nodeType === NodeType.PART || rootJson.nodeType === 'PART';
    const dims = dimsFromDomain(domain, isPanel);

    const partsJson: any[] = [];
    collectSerializedParts(rootJson, partsJson);
    const sources = partsJson.length > 0 ? partsJson : (isPanel ? [rootJson] : []);

    const rootWorld = matrixFromSerializedNode(rootJson);
    const rootInv = rootWorld.invert();

    function walk(node: any, ancestors: any[], visit: (n: any, a: any[]) => void): void {
        visit(node, ancestors);
        for (const child of node.children || []) {
            walk(child, [...ancestors, node], visit);
        }
    }

    const worldById = new Map<string, Mat4>();
    walk(rootJson, [], (n, a) => {
        if (n?.id) worldById.set(n.id, worldMatrixOfSerialized(n, a));
    });

    const parts: E3PartPose[] = [];
    for (const part of sources) {
        const pd = part.domainData || {};
        const pdims = dimsFromDomain(pd, true);
        const childWorld = worldById.get(part.id) || matrixFromSerializedNode(part);
        const relative = part.id === rootJson.id ? Mat4.identity() : rootInv.multiply(childWorld);
        const pose = cadMatrixToBabylonPose(relative);
        parts.push({
            id: part.id,
            name: pd.name || part.name || 'Formatka',
            role: pd.role || part.name,
            width: pdims.width,
            height: pdims.height,
            thickness: pdims.thickness,
            pos: pose.pos,
            rotq: pose.rotq,
        });
    }

    return {
        id: rootJson.id,
        name: domain.name || rootJson.name || 'Korpus',
        type: isPanel ? 'PANEL' : 'CONTAINER',
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        parts,
    };
}

export function extractAllGeometrySnapshots(): Record<string, E3GeometrySnapshot> {
    const map: Record<string, E3GeometrySnapshot> = {};
    const doc = ContextManager.instance?.document;
    if (doc?.rootNode) {
        const walk = (node: CADNode) => {
            if (node.nodeType === NodeType.ASSEMBLY || node.nodeType === NodeType.PART) {
                map[node.id] = snapshotFromCadNode(node);
            }
            for (const child of node.children || []) walk(child);
        };
        walk(doc.rootNode);
        return map;
    }

    try {
        const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
        if (!raw) return map;
        const parsed = JSON.parse(raw);
        const root = parsed?.rootNode || parsed;
        const walk = (json: any) => {
            if (!json) return;
            const type = json.nodeType;
            if (type === NodeType.ASSEMBLY || type === 'ASSEMBLY' || type === NodeType.PART || type === 'PART') {
                map[json.id] = snapshotFromSerialized(json);
            }
            for (const child of json.children || []) walk(child);
        };
        walk(root);
    } catch {}
    return map;
}

export function syncGeometrySnapshots(): Record<string, E3GeometrySnapshot> {
    const map = extractAllGeometrySnapshots();
    try {
        localStorage.setItem(E3_GEOMETRY_STORAGE_KEY, JSON.stringify(map));
    } catch {}
    return map;
}

export function loadGeometrySnapshots(): Record<string, E3GeometrySnapshot> {
    const live = extractAllGeometrySnapshots();
    if (Object.keys(live).length > 0) return live;
    try {
        const raw = localStorage.getItem(E3_GEOMETRY_STORAGE_KEY);
        if (raw) return JSON.parse(raw) || {};
    } catch {}
    return {};
}

export function resolveGeometrySnapshot(nodeId: string): E3GeometrySnapshot | null {
    const map = loadGeometrySnapshots();
    if (map[nodeId]) return map[nodeId];

    const doc = ContextManager.instance?.document;
    const cad = doc?.findNode?.(nodeId);
    if (cad) return snapshotFromCadNode(cad);

    try {
        const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const found = findSerializedNode(parsed?.rootNode || parsed, nodeId);
        if (found) return snapshotFromSerialized(found);
    } catch {}
    return null;
}
