/**
 * Dodaje filar (fill) do aktywnego SmartWall i rebuild.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { defaultPillarFillMm } from '../pillars-engine.js';
import { SetSmartWallParamsCommand, type SmartWallParamsSnapshotMm } from './set-smartwall-params-command.js';
import type { SmartWallFillMm } from '../smartwall-types.js';

export class AddWallPillarCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly inner: SetSmartWallParamsCommand;

    constructor(containerId: string, before: SmartWallParamsSnapshotMm, fill?: SmartWallFillMm) {
        const fills = [...before.fills];
        const key = fill?.key || `PILLAR_${fills.length + 1}`;
        const nextFill = fill || defaultPillarFillMm(key);
        if (!fill) nextFill.key = key;
        fills.push({ ...nextFill, key });
        const after: SmartWallParamsSnapshotMm = { ...before, fills };
        this.inner = new SetSmartWallParamsCommand(containerId, before, after);
        this.id = `cmd_add_wall_pillar_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = 'Dodaj filar';
        this.timestamp = Date.now();
        this.affectedNodeIds = [containerId];
    }

    execute(document: ProjectDocument): void {
        this.inner.execute(document);
    }

    undo(document: ProjectDocument): void {
        this.inner.undo(document);
    }
}
