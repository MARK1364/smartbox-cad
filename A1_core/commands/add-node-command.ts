/**
 * SmartPanel Web — AddNodeCommand
 *
 * Komenda dodania węzła CAD (panelu lub korpusu) do drzewa dokumentu.
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';
import { CADNode } from '../cad-node/cad-node.js';

export class AddNodeCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    readonly parentId: string;
    readonly node: CADNode;
    readonly index?: number;

    constructor(parentId: string, node: CADNode, index?: number, label: string = 'Dodanie obiektu') {
        this.id = `cmd_add_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.parentId = parentId;
        this.node = node;
        this.index = index;
        this.label = label;
        this.timestamp = Date.now();
        this.affectedNodeIds = [node.id, parentId];
    }

    execute(document: ProjectDocument): void {
        document.addNode(this.parentId, this.node, this.index);
    }

    undo(document: ProjectDocument): void {
        document.removeNode(this.node.id);
    }
}
