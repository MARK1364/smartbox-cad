/**
 * Zmiana wymiarów SmartFloor + rebuild (jedna komenda undo).
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { rebuildSmartFloor } from '../smartfloor-core.js';
import type { SmartFloorParamsMm } from '../smartfloor-types.js';

export type SmartFloorParamsSnapshotMm = SmartFloorParamsMm;

function readSnapshotMm(container: any): SmartFloorParamsSnapshotMm {
    const gp = container.generatorParams || {};
    // gp.floor* zapisuje writeSnapshotNm przez mmToNm → nm. Jawnie, bez progu.
    const nmVal = (v: number | undefined, fb: number) =>
        (v == null || !Number.isFinite(v) ? fb : nmToMm(v));
    return {
        floorWidth: nmVal(gp.floorWidth ?? container.width, 4000),
        floorDepth: nmVal(gp.floorDepth ?? container.depth, 3000),
        floorThickness: nmVal(gp.floorThickness ?? container.height, 50),
    };
}

function writeSnapshotNm(container: any, snap: SmartFloorParamsSnapshotMm): void {
    if (!container.generatorParams) container.generatorParams = {};
    const gp = container.generatorParams;
    gp.floorWidth = mmToNm(snap.floorWidth);
    gp.floorDepth = mmToNm(snap.floorDepth);
    gp.floorThickness = mmToNm(snap.floorThickness);
    container.width = gp.floorWidth;
    container.depth = gp.floorDepth;
    container.height = gp.floorThickness;
}

function cloneValue<T>(value: T): T {
    if (Array.isArray(value)) return value.map(cloneValue) as T;
    if (!value || typeof value !== 'object') return value;
    const copy = Object.create(Object.getPrototypeOf(value));
    for (const key of Reflect.ownKeys(value)) {
        copy[key] = cloneValue((value as any)[key]);
    }
    return copy;
}

const PANEL_FIELDS = [
    'name', 'role', 'key', 'width', 'height', 'thickness',
    'edgeBanding', 'color', 'visible', 'custom_properties',
] as const;

interface SmartFloorStateSnapshot {
    container: {
        width: number;
        height: number;
        depth: number;
        generatorParams: any;
    };
    children: Array<{
        node: CADNode;
        name: string;
        localMatrix: ReturnType<CADNode['localMatrix']['clone']>;
        domainData: Record<(typeof PANEL_FIELDS)[number], unknown>;
    }>;
}

function captureSmartFloorState(container: any, containerNode: CADNode): SmartFloorStateSnapshot {
    return {
        container: {
            width: container.width,
            height: container.height,
            depth: container.depth,
            generatorParams: cloneValue(container.generatorParams),
        },
        children: containerNode.children.map((node) => {
            const domainData = {} as Record<(typeof PANEL_FIELDS)[number], unknown>;
            for (const field of PANEL_FIELDS) {
                domainData[field] = cloneValue((node.domainData as any)?.[field]);
            }
            return {
                node,
                name: node.name,
                localMatrix: node.localMatrix.clone(),
                domainData,
            };
        }),
    };
}

function restoreSmartFloorState(
    document: ProjectDocument,
    container: any,
    containerNode: CADNode,
    snapshot: SmartFloorStateSnapshot,
): void {
    const originalNodes = new Set(snapshot.children.map(({ node }) => node));
    for (const child of [...containerNode.children]) {
        if (!originalNodes.has(child)) document.removeNode(child.id);
    }

    snapshot.children.forEach(({ node }, index) => {
        if (document.findNode(node.id) !== node) {
            document.addNode(containerNode.id, node, index);
        }
    });

    container.width = snapshot.container.width;
    container.height = snapshot.container.height;
    container.depth = snapshot.container.depth;
    container.generatorParams = cloneValue(snapshot.container.generatorParams);

    for (const { node, name, localMatrix, domainData } of snapshot.children) {
        node.name = name;
        node.setLocalMatrix(localMatrix.clone());
        if (node.domainData) {
            Object.assign(node.domainData, cloneValue(domainData));
            (node.domainData as any)._emit?.('dimensions', {
                width: (node.domainData as any).width,
                height: (node.domainData as any).height,
                thickness: (node.domainData as any).thickness,
            });
        }
    }
}

export class SetSmartFloorParamsCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly containerId: string;
    private readonly before: SmartFloorParamsSnapshotMm;
    private readonly after: SmartFloorParamsSnapshotMm;

    constructor(containerId: string, before: SmartFloorParamsSnapshotMm, after: SmartFloorParamsSnapshotMm) {
        this.containerId = containerId;
        this.before = before;
        this.after = after;
        this.id = `cmd_set_smartfloor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = 'Wymiary podłogi';
        this.timestamp = Date.now();
        this.affectedNodeIds = [containerId];
    }

    static snapshotFrom(container: any): SmartFloorParamsSnapshotMm {
        return readSnapshotMm(container);
    }

    private apply(document: ProjectDocument, snap: SmartFloorParamsSnapshotMm): void {
        const node = document.findNode(this.containerId);
        if (!node?.domainData) return;
        const container = node.domainData as any;
        const snapshot = captureSmartFloorState(container, node);
        document.transaction(() => {
            writeSnapshotNm(container, snap);
            if (!rebuildSmartFloor(container, document)) {
                throw new Error(`SetSmartFloorParamsCommand: failed to rebuild SmartFloor "${this.containerId}".`);
            }
            document.afterCommit(() => {
                if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
                    window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
                }
            });
        }, () => restoreSmartFloorState(document, container, node, snapshot));
    }

    execute(document: ProjectDocument): void {
        this.apply(document, this.after);
    }

    undo(document: ProjectDocument): void {
        this.apply(document, this.before);
    }
}
