/**
 * SmartPanel Web — ReparentNodeCommand
 *
 * Komenda przeniesienia węzła między rodzicami w drzewie dokumentu (np. dołączenie formatki do szafy).
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';

export class ReparentNodeCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    readonly nodeId: string;
    readonly oldParentId: string;
    readonly oldIndex: number;
    readonly newParentId: string;
    readonly newIndex?: number;
    readonly mode: 'keepLocal' | 'keepWorld';

    constructor(
        document: ProjectDocument,
        nodeId: string,
        newParentId: string,
        options: { mode?: 'keepLocal' | 'keepWorld'; newIndex?: number; label?: string } = {}
    ) {
        this.id = `cmd_reparent_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const targetNode = document.findNode(nodeId);
        if (!targetNode || !targetNode.parent) {
            throw new Error(`ReparentNodeCommand: node "${nodeId}" or its parent not found.`);
        }
        this.nodeId = nodeId;
        this.oldParentId = targetNode.parent.id;
        this.oldIndex = targetNode.parent.children.indexOf(targetNode);
        this.newParentId = newParentId;
        this.newIndex = options.newIndex;
        this.mode = options.mode ?? 'keepWorld';
        this.label = options.label ?? 'Przeniesienie obiektu w drzewie';
        this.timestamp = Date.now();
        this.affectedNodeIds = [nodeId, this.oldParentId, newParentId];
    }

    execute(document: ProjectDocument): void {
        document.reparentNode(this.nodeId, this.newParentId, { mode: this.mode, index: this.newIndex });
    }

    undo(document: ProjectDocument): void {
        document.reparentNode(this.nodeId, this.oldParentId, { mode: this.mode, index: this.oldIndex });
    }
}
