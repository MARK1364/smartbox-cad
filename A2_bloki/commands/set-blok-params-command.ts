/**
 * Zapis parametrów Bloku (UI). Undo przywraca poprzedni generatorParams i przebudowuje.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { update_bloki_core } from '../01_bloki-core.js';

function cloneParams(params: any): Record<string, any> {
    return JSON.parse(JSON.stringify(params || {}));
}

export class SetBlokiParamsCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    constructor(
        readonly containerId: string,
        readonly oldParams: Record<string, any>,
        readonly newParams: Record<string, any>
    ) {
        this.id = `cmd_bloki_params_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = 'Parametry Bloki';
        this.timestamp = Date.now();
        this.affectedNodeIds = [containerId];
    }

    execute(document: ProjectDocument): void {
        this._apply(document, this.newParams);
    }

    undo(document: ProjectDocument): void {
        this._apply(document, this.oldParams);
    }

    private _apply(document: ProjectDocument, params: Record<string, any>): void {
        const node = document.findNode(this.containerId);
        const data = node?.domainData as any;
        if (!data) return;
        data.generatorParams = cloneParams(params);
        update_bloki_core(data, document);
    }
}
