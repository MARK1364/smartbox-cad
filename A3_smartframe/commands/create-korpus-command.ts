/**
 * Tworzy korpus SmartFrame (jedna komenda, undo usuwa węzeł).
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import type { KorpusCreateParams } from '../../A1_core/cabinet-port.js';
import { runEngineAndApply } from '../smartframe-adapter.js';

export class CreateKorpusCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly params: KorpusCreateParams;

    private createdId: string | null = null;

    constructor(params: KorpusCreateParams) {
        this.params = params;
        this.id = `cmd_create_korpus_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = 'Utwórz Korpus';
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        const existingCount = typeof document.getContainers === 'function' ? document.getContainers().length : 0;
        const nc = new ContainerModel({
            width: mmToNm(this.params.width),
            height: mmToNm(this.params.height),
            depth: mmToNm(this.params.depth),
            name: `Korpus (SmartFrame) ${existingCount + 1}`
        });
        nc.generatorParams = {
            type: 'korpus3_2',
            zoneCount: this.params.zoneCount,
            bottomHeight: this.params.bottomHeight,
            middleHeight: this.params.middleHeight,
            offsets: this.params.offsets || {}
        };

        const ncNode = CADNode.create(NodeType.ASSEMBLY, nc.name, nc.id);
        ncNode.domainData = nc;
        document.addNode(document.rootNode.id, ncNode);
        this.createdId = nc.id;
        this.affectedNodeIds.splice(0, this.affectedNodeIds.length, nc.id);

        runEngineAndApply(
            nc,
            mmToNm(this.params.width),
            mmToNm(this.params.height),
            mmToNm(this.params.depth),
            this.params.zoneCount,
            mmToNm(this.params.bottomHeight),
            mmToNm(this.params.middleHeight),
            this.params.offsets || {}
        );

        document.setActiveEntity(nc);
    }

    undo(document: ProjectDocument): void {
        if (this.createdId) document.removeNode(this.createdId);
    }
}
