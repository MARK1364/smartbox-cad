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
    private isApplied = false;

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
        if (this.isApplied) {
            throw new Error(`RemoveNodeCommand: node "${this.nodeId}" has already been removed.`);
        }
        const cleanupCmds = collectNodeCleanupCommands(this.node);
        const executed: Command[] = [];
        document.transaction(() => {
            for (const cmd of cleanupCmds) {
                cmd.execute(document);
                executed.push(cmd);
            }
            document.removeNode(this.nodeId);
        }, () => {
            const rollbackErrors: unknown[] = [];
            for (let i = executed.length - 1; i >= 0; i--) {
                try {
                    executed[i].undo(document);
                } catch (rollbackError) {
                    rollbackErrors.push(rollbackError);
                }
            }
            if (!document.findNode(this.nodeId)) {
                try {
                    document.addNode(this.previousParentId, this.node, this.previousIndex);
                } catch (rollbackError) {
                    rollbackErrors.push(rollbackError);
                }
            }
            this.isApplied = false;
            if (rollbackErrors.length > 0) {
                const rollbackMessage = rollbackErrors
                    .map((failure) => failure instanceof Error ? failure.message : String(failure))
                    .join('; ');
                throw new Error(`RemoveNodeCommand rollback failed: ${rollbackMessage}`);
            }
        });
        this.cleanupCmds = cleanupCmds;
        this.isApplied = true;
    }

    undo(document: ProjectDocument): void {
        if (!this.isApplied) return;
        const undone: Command[] = [];
        document.transaction(() => {
            document.addNode(this.previousParentId, this.node, this.previousIndex);
            for (let i = this.cleanupCmds.length - 1; i >= 0; i--) {
                this.cleanupCmds[i].undo(document);
                undone.push(this.cleanupCmds[i]);
            }
        }, () => {
            const rollbackErrors: unknown[] = [];
            for (let i = undone.length - 1; i >= 0; i--) {
                try {
                    const cmd = undone[i];
                    if (typeof cmd.redo === 'function') cmd.redo(document);
                    else cmd.execute(document);
                } catch (rollbackError) {
                    rollbackErrors.push(rollbackError);
                }
            }
            try {
                if (document.findNode(this.nodeId)) document.removeNode(this.nodeId);
            } catch (rollbackError) {
                rollbackErrors.push(rollbackError);
            }
            this.isApplied = true;
            if (rollbackErrors.length > 0) {
                const rollbackMessage = rollbackErrors
                    .map((failure) => failure instanceof Error ? failure.message : String(failure))
                    .join('; ');
                throw new Error(`RemoveNodeCommand undo rollback failed: ${rollbackMessage}`);
            }
        });
        this.isApplied = false;
    }

    redo(document: ProjectDocument): void {
        if (!this.isApplied) this.execute(document);
    }
}
