/**
 * Komenda zapisu offsetu krawędzi korpusu (gizmo czerwone/zielone/przesunięcie).
 * Undo przywraca poprzednią wartość i przebudowuje geometrię.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { rebuildSmartFrameContainer } from '../smartframe-adapter.js';

export class SetKorpusOffsetCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    constructor(
        readonly containerId: string,
        readonly paramName: string,
        readonly oldValue: number,
        readonly newValue: number
    ) {
        this.id = `cmd_korpus_offset_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = `Offset ${paramName}`;
        this.timestamp = Date.now();
        this.affectedNodeIds = [containerId];
    }

    execute(document: ProjectDocument): void {
        this._apply(document, this.newValue);
    }

    undo(document: ProjectDocument): void {
        this._apply(document, this.oldValue);
    }

    private _apply(document: ProjectDocument, value: number): void {
        const node = document.findNode(this.containerId);
        const data = node?.domainData as any;
        if (!data) return;
        if (!data.generatorParams) data.generatorParams = {};
        if (!data.generatorParams.offsets) data.generatorParams.offsets = {};
        data.generatorParams.offsets[this.paramName] = value;
        rebuildSmartFrameContainer(data);
    }
}
