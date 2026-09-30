/**
 * SmartPanel Web — RemoveNodeCommand
 *
 * Komenda usunięcia węzła CAD z drzewa dokumentu (z możliwością przywrócenia w Undo).
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';
import { CADNode } from '../cad-node/cad-node.js';
import { collectNodeCleanupCommands } from '../node-cleanup-port.js';

export class RemoveNodeCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    readonly nodeId: string;
    readonly previousParentId: string;
    readonly previousIndex: number;
    readonly node: CADNode;

    /** Czyszczenie podpiętych zasobów / otworów (z portu NodeCleanupPort), odtwarzane przy Undo. */
    private cleanupCmds: Command[] = [];

    constructor(document: ProjectDocument, nodeId: string, label: string = 'Usunięcie obiektu') {
        this.id = `cmd_remove_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.nodeId = nodeId;
        const targetNode = document.findNode(nodeId);
        if (!targetNode || !targetNode.parent) {
            throw new Error(`RemoveNodeCommand: node "${nodeId}" or its parent not found.`);
        }
        this.node = targetNode;
        this.previousParentId = targetNode.parent.id;
        this.previousIndex = targetNode.parent.children.indexOf(targetNode);
        this.label = label;
        this.timestamp = Date.now();
        this.affectedNodeIds = [nodeId, this.previousParentId];
    }

    execute(document: ProjectDocument): void {
        this.cleanupCmds = collectNodeCleanupCommands(this.node);
        for (const cmd of this.cleanupCmds) {
            cmd.execute(document);
        }
        document.removeNode(this.nodeId);
    }

    undo(document: ProjectDocument): void {
        document.addNode(this.previousParentId, this.node, this.previousIndex);
        for (let i = this.cleanupCmds.length - 1; i >= 0; i--) {
            this.cleanupCmds[i].undo(document);
        }
    }
}
