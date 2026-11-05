import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { ProjectDocument } from '../A1_core/project-document.js';

interface BlokiNodeSnapshot {
    node: CADNode;
    parent: CADNode | null;
    index: number;
    name: string;
    localMatrix: ReturnType<CADNode['localMatrix']['clone']>;
    domainData: any;
    domainDataState?: any;
    children: BlokiNodeSnapshot[];
}

interface BlokiDomainSnapshot {
    model: any;
    state: any;
}

function cloneBlokiState(value: any): any {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function snapshotBlokiNode(node: CADNode): BlokiNodeSnapshot {
    const domainData = node.domainData;
    const domainDataState = typeof domainData?.toJSON === 'function'
        ? cloneBlokiState(domainData.toJSON())
        : undefined;
    return {
        node,
        parent: node.parent,
        index: node.parent ? node.parent.children.indexOf(node) : -1,
        name: node.name,
        localMatrix: node.localMatrix.clone(),
        domainData,
        domainDataState,
        children: node.children.map(snapshotBlokiNode),
    };
}

function collectBlokiSnapshotNodes(snapshot: BlokiNodeSnapshot, result: BlokiNodeSnapshot[] = []): BlokiNodeSnapshot[] {
    result.push(snapshot);
    for (const child of snapshot.children) collectBlokiSnapshotNodes(child, result);
    return result;
}

function restoreBlokiNodeSnapshot(
    document: ProjectDocument,
    snapshot: BlokiNodeSnapshot,
    documentNodes: Set<CADNode>
): void {
    const snapshots = collectBlokiSnapshotNodes(snapshot);
    const currentNode = document.findNode(snapshot.node.id);
    if (currentNode) document.removeNode(currentNode.id);

    for (const entry of snapshots) {
        for (const child of [...entry.node.children]) entry.node.removeChild(child);
    }

    for (const entry of snapshots) {
        const { node, domainData, domainDataState } = entry;
        node.name = entry.name;
        node.setLocalMatrix(entry.localMatrix.clone());
        node.domainData = domainData;
        if (domainData && domainDataState !== undefined) {
            if (typeof domainData.loadFromJSON === 'function') domainData.loadFromJSON(cloneBlokiState(domainDataState));
            else if (typeof domainData.fromJSON === 'function') domainData.fromJSON(cloneBlokiState(domainDataState));
        }
    }

    for (const entry of snapshots) {
        for (const childSnapshot of entry.children) {
            entry.node.addChild(childSnapshot.node);
        }
    }

    if (documentNodes.has(snapshot.node) && snapshot.parent) {
        document.addNode(snapshot.parent.id, snapshot.node, snapshot.index);
    }
}

function snapshotBlokiDomainModels(document: ProjectDocument, extraNode: CADNode): BlokiDomainSnapshot[] {
    const models = new Set<any>();
    for (const node of [...document.getPanels(), ...document.getContainers(), ...extraNode.findAll(), extraNode]) {
        if (node.domainData && typeof node.domainData.toJSON === 'function') models.add(node.domainData);
    }
    return [...models].map((model) => ({ model, state: cloneBlokiState(model.toJSON()) }));
}

function restoreBlokiDomainModels(snapshots: BlokiDomainSnapshot[]): void {
    for (const { model, state } of snapshots) {
        if (typeof model.loadFromJSON === 'function') model.loadFromJSON(cloneBlokiState(state));
        else if (typeof model.fromJSON === 'function') model.fromJSON(cloneBlokiState(state));
    }
}

export function withBlokiTransaction<T>(
    document: ProjectDocument,
    rootNode: CADNode,
    operation: () => T,
    onRollback?: () => void
): T {
    const nodeSnapshot = snapshotBlokiNode(rootNode);
    const documentNodes = new Set<CADNode>([
        document.rootNode,
        ...document.rootNode.findAll(),
    ]);
    const domainSnapshots = snapshotBlokiDomainModels(document, rootNode);
    const activeEntity = document.activeEntity;

    return document.transaction(operation, () => {
        restoreBlokiNodeSnapshot(document, nodeSnapshot, documentNodes);
        restoreBlokiDomainModels(domainSnapshots);
        document.setActiveEntity(activeEntity);
        onRollback?.();
    });
}

export function flushBlokiPreview(
    document: ProjectDocument,
    rootNode: CADNode,
    container: { generatorParams: Record<string, any> | null },
    pendingParams: Record<string, any>,
    update: () => void
): void {
    const updates = { ...pendingParams };
    if (Object.keys(updates).length === 0) return;

    withBlokiTransaction(document, rootNode, () => {
        container.generatorParams = {
            ...container.generatorParams,
            ...updates,
        };
        update();
    });

    for (const [key, value] of Object.entries(updates)) {
        if (pendingParams[key] === value) delete pendingParams[key];
    }
}

export function scheduleBlokiPreviewCommitBeforeRefresh(
    scheduleCommit: () => void,
    refreshGeometry: () => void
): void {
    scheduleCommit();
    try {
        refreshGeometry();
    } catch (error) {
        console.error('[Bloki preview] Geometry refresh failed after parameter update:', error);
    }
}
