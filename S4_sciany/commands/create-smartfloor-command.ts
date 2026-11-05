/**
 * Tworzy SmartFloor (ASSEMBLY) bezpośrednio pod ROOM + rebuild PART.
 * Obok SmartWall — NIGDY w środku (osobny kontener).
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { SMARTFLOOR_TYPE, type SmartFloorDragPayload } from '../smartfloor-types.js';
import type { SmartWallPlacementMm } from '../smartwall-types.js';
import { rebuildSmartFloor } from '../smartfloor-core.js';

export interface CreateSmartFloorParamsMm extends SmartFloorDragPayload {
    /** Pozycja upuszczenia na scenie [mm] — z drag&drop; bez = (0,0,0). */
    position?: SmartWallPlacementMm;
}

export class CreateSmartFloorCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly params: CreateSmartFloorParamsMm;

    private createdNode: CADNode | null = null;
    private previousActiveEntity: ProjectDocument['activeEntity'] = null;

    constructor(params: CreateSmartFloorParamsMm) {
        this.params = params;
        this.id = `cmd_create_smartfloor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = 'Utwórz podłogę';
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        const existing = typeof document.getContainers === 'function' ? document.getContainers().length : 0;
        const w = this.params.floorWidth ?? 4000;
        const d = this.params.floorDepth ?? 3000;
        const t = this.params.floorThickness ?? 50;

        const model = new ContainerModel({
            width: mmToNm(w),
            height: mmToNm(t),
            depth: mmToNm(d),
            name: this.params.name || `Podłoga ${existing + 1}`,
        });
        model.generatorParams = {
            type: SMARTFLOOR_TYPE,
            floorWidth: mmToNm(w),
            floorDepth: mmToNm(d),
            floorThickness: mmToNm(t),
        };

        const node = CADNode.create(NodeType.ASSEMBLY, model.name, model.id);
        node.domainData = model;
        if (this.params.position) {
            node.setLocalTransform(
                new Vec3(
                    mmToNm(this.params.position.x),
                    mmToNm(this.params.position.y),
                    mmToNm(this.params.position.z || 0),
                ),
                Quat.IDENTITY,
            );
        }
        const previousActiveEntity = document.activeEntity;
        document.transaction(() => {
            // Bezpośrednio pod ROOM (root) — obok SmartWall.
            document.addNode(document.rootNode.id, node);
            rebuildSmartFloor(model, document);
            document.setActiveEntity(model);
            document.afterCommit(() => this.dispatchProjectChanged());
        }, () => {
            if (document.findNode(model.id)) document.removeNode(model.id);
            document.setActiveEntity(previousActiveEntity);
        });

        this.createdNode = node;
        this.previousActiveEntity = previousActiveEntity;
        this.affectedNodeIds.splice(0, this.affectedNodeIds.length, model.id);
    }

    redo(document: ProjectDocument): void {
        const node = this.createdNode;
        if (!node) {
            this.execute(document);
            return;
        }
        const model = node.domainData;
        if (!model) throw new Error(`CreateSmartFloorCommand: missing domain data for "${node.id}".`);
        const previousActiveEntity = document.activeEntity;
        document.transaction(() => {
            document.addNode(document.rootNode.id, node);
            document.setActiveEntity(model);
            document.afterCommit(() => this.dispatchProjectChanged());
        }, () => {
            if (document.findNode(node.id)) document.removeNode(node.id);
            document.setActiveEntity(previousActiveEntity);
        });
    }

    undo(document: ProjectDocument): void {
        const node = this.createdNode;
        if (!node || document.findNode(node.id) !== node) return;
        const activeEntity = document.activeEntity;
        document.transaction(() => {
            document.removeNode(node.id);
            document.setActiveEntity(this.previousActiveEntity);
            document.afterCommit(() => this.dispatchProjectChanged());
        }, () => {
            if (!document.findNode(node.id)) document.addNode(document.rootNode.id, node);
            document.setActiveEntity(activeEntity);
        });
    }

    private dispatchProjectChanged(): void {
        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    }
}
