/**
 * SmartPanel Web — MacroCommand
 *
 * Komenda grupująca inne komendy w pojedynczy krok historii (Undo/Redo).
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';

export class MacroCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private commands: Command[];

    constructor(commands: Command[], label: string = 'Makro operacja') {
        this.id = `cmd_macro_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.commands = commands;
        this.label = label;
        this.timestamp = Date.now();
        
        const ids = new Set<string>();
        for (const cmd of commands) {
            if (cmd.affectedNodeIds) {
                for (const nodeId of cmd.affectedNodeIds) {
                    ids.add(nodeId);
                }
            }
        }
        this.affectedNodeIds = Array.from(ids);
    }

    execute(document: ProjectDocument): void {
        for (const cmd of this.commands) {
            cmd.execute(document);
            // Collect any new affected nodes that might be discovered during execute (like SyncBackGroovesCommand does)
            for (const id of cmd.affectedNodeIds) {
                if (!this.affectedNodeIds.includes(id)) {
                    this.affectedNodeIds.push(id);
                }
            }
        }
    }

    undo(document: ProjectDocument): void {
        // Undo w odwrotnej kolejności
        for (let i = this.commands.length - 1; i >= 0; i--) {
            this.commands[i].undo(document);
        }
    }

    redo(document: ProjectDocument): void {
        for (const cmd of this.commands) {
            if (typeof cmd.redo === 'function') {
                cmd.redo(document);
            } else {
                cmd.execute(document);
            }
        }
    }
}
