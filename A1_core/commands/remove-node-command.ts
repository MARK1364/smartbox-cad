/**
 * SmartPanel Web — RemoveNodeCommand
 *
 * Komenda usunięcia węzła CAD z drzewa dokumentu (z możliwością przywrócenia w Undo).
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';
import { CADNode } from '../cad-node/cad-node.js';
import { ClearSmartBoxDrillingsCommand, collectSmartBoxIds } from './clear-smartbox-drillings-command.js';

export class RemoveNodeCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    readonly nodeId: string;
    readonly previousParentId: string;
    readonly previousIndex: number;
    readonly node: CADNode;

    /** Czyszczenie otworów SmartBoxa, odtwarzane przy Undo razem z węzłem. */
    private drillingsClears: ClearSmartBoxDrillingsCommand[] = [];

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
        // Najpierw zdejmij z korpusu otwory, które ten SmartBox (lub SmartBoxy w poddrzewie)
        // nawiercił — po usunięciu węzła nikt już ich nie posprząta.
        this.drillingsClears = [];
        for (const smartBoxId of collectSmartBoxIds(this.node)) {
            const clearCmd = new ClearSmartBoxDrillingsCommand(smartBoxId);
            clearCmd.execute(document);
            this.drillingsClears.push(clearCmd);
        }
        document.removeNode(this.nodeId);
    }

    undo(document: ProjectDocument): void {
        // Najpierw przywróć węzeł (reregistracja w indeksie), potem otwory na formatkach korpusu.
        document.addNode(this.previousParentId, this.node, this.previousIndex);
        for (let i = this.drillingsClears.length - 1; i >= 0; i--) {
            this.drillingsClears[i].undo(document);
        }
    }
}
