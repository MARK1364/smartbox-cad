/**
 * Tworzy SmartWall (ASSEMBLY) bezpośrednio pod ROOM + rebuild PART.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { SMARTWALL_TYPE, type SmartWallFillMm, type SmartWallPlacementMm, type SmartWallPreset } from '../smartwall-types.js';
import { rebuildSmartWall } from '../smartwall-core.js';

export interface CreateSmartWallParamsMm {
    name?: string;
    preset: SmartWallPreset;
    roomWidth?: number;
    roomDepth?: number;
    wallHeight?: number;
    wallThickness?: number;
    singleLength?: number;
    uskokGapStart?: number;
    uskokGapEnd?: number;
    skosLength?: number;
    skosHeightLeft?: number;
    skosHeightRight?: number;
    skosSlant?: 'top' | 'bottom';
    fills?: SmartWallFillMm[];
    /** Pozycja upuszczenia na scenie [mm] — z drag&drop; bez = (0,0,0). */
    position?: SmartWallPlacementMm;
}

export class CreateSmartWallCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly params: CreateSmartWallParamsMm;

    private createdId: string | null = null;

    constructor(params: CreateSmartWallParamsMm) {
        this.params = params;
        this.id = `cmd_create_smartwall_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = 'Utwórz SmartWall';
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        const existing = typeof document.getContainers === 'function' ? document.getContainers().length : 0;
        const isSkos = this.params.preset === 'skos';
        const w = this.params.skosLength ?? this.params.roomWidth ?? (isSkos ? 2000 : 4000);
        const d = this.params.roomDepth ?? 3000;
        const h = Math.max(
            this.params.skosHeightLeft ?? 0,
            this.params.skosHeightRight ?? 0,
            this.params.wallHeight ?? (isSkos ? 1800 : 2700),
        );
        const t = this.params.wallThickness ?? (isSkos ? 500 : 100);

        const model = new ContainerModel({
            width: mmToNm(w),
            height: mmToNm(h),
            depth: mmToNm(d),
            name: this.params.name || (isSkos ? `Skos ${existing + 1}` : `SmartWall ${existing + 1}`),
        });
        model.generatorParams = {
            type: SMARTWALL_TYPE,
            preset: this.params.preset,
            roomWidth: mmToNm(w),
            roomDepth: mmToNm(d),
            wallHeight: mmToNm(h),
            wallThickness: mmToNm(t),
            fills: this.params.fills ? this.params.fills.map((f) => ({ ...f })) : [],
        };
        if (this.params.singleLength != null) {
            model.generatorParams.singleLength = mmToNm(this.params.singleLength);
        }
        if (this.params.uskokGapStart != null) {
            model.generatorParams.uskokGapStart = mmToNm(this.params.uskokGapStart);
        }
        if (this.params.uskokGapEnd != null) {
            model.generatorParams.uskokGapEnd = mmToNm(this.params.uskokGapEnd);
        }
        if (this.params.skosLength != null) {
            model.generatorParams.skosLength = mmToNm(this.params.skosLength);
        }
        if (this.params.skosHeightLeft != null) {
            model.generatorParams.skosHeightLeft = mmToNm(this.params.skosHeightLeft);
        }
        if (this.params.skosHeightRight != null) {
            model.generatorParams.skosHeightRight = mmToNm(this.params.skosHeightRight);
        }
        if (this.params.skosSlant === 'top' || this.params.skosSlant === 'bottom') {
            model.generatorParams.skosSlant = this.params.skosSlant;
        }

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
        // Bezpośrednio pod ROOM (root)
        document.addNode(document.rootNode.id, node);
        this.createdId = model.id;
        this.affectedNodeIds.splice(0, this.affectedNodeIds.length, model.id);

        rebuildSmartWall(model, document);
        document.setActiveEntity(model);

        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    }

    undo(document: ProjectDocument): void {
        if (this.createdId) document.removeNode(this.createdId);
        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    }
}
