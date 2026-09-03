/**
 * Zapis wymiarów i stref korpusu (undo przywraca poprzednie parametry).
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import type { KorpusCreateParams } from '../../A1_core/cabinet-port.js';
import { rebuildSmartFrameContainer } from '../smartframe-adapter.js';

interface StoredKorpus {
    width: number;
    height: number;
    depth: number;
    generatorParams: any;
}

export class SetKorpusDimsCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    constructor(
        readonly containerId: string,
        readonly oldState: StoredKorpus,
        readonly newParams: KorpusCreateParams
    ) {
        this.id = `cmd_korpus_dims_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = 'Wymiary korpusu';
        this.timestamp = Date.now();
        this.affectedNodeIds = [containerId];
    }

    execute(document: ProjectDocument): void {
        this._applyParams(document, this.newParams);
    }

    undo(document: ProjectDocument): void {
        const node = document.findNode(this.containerId);
        const data = node?.domainData as any;
        if (!data) return;
        data.width = this.oldState.width;
        data.height = this.oldState.height;
        data.depth = this.oldState.depth;
        data.generatorParams = JSON.parse(JSON.stringify(this.oldState.generatorParams || {}));
        rebuildSmartFrameContainer(data);
    }

    private _applyParams(document: ProjectDocument, params: KorpusCreateParams): void {
        const node = document.findNode(this.containerId);
        const data = node?.domainData as any;
        if (!data) return;
        data.width = mmToNm(params.width);
        data.height = mmToNm(params.height);
        data.depth = mmToNm(params.depth);
        if (!data.generatorParams) data.generatorParams = {};
        Object.assign(data.generatorParams, {
            type: 'korpus3_2',
            zoneCount: params.zoneCount,
            bottomHeight: params.bottomHeight,
            middleHeight: params.middleHeight,
            offsets: params.offsets ?? data.generatorParams.offsets ?? {}
        });
        delete data.generatorParams.backOffset;
        rebuildSmartFrameContainer(data);
    }
}
