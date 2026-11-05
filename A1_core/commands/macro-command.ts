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
    private isApplied = false;

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
        if (this.isApplied) {
            throw new Error(`MacroCommand "${this.label}" has already been executed.`);
        }
        const initialAffectedNodeIds = [...this.affectedNodeIds];
        const executed: Command[] = [];
        document.transaction(() => {
            for (const cmd of this.commands) {
                cmd.execute(document);
                executed.push(cmd);
                for (const id of cmd.affectedNodeIds) {
                    if (!this.affectedNodeIds.includes(id)) {
                        this.affectedNodeIds.push(id);
                    }
                }
            }
        }, (error) => {
            this.rollbackCompletedSteps(document, error, executed, (cmd) => cmd.undo(document), 'execute');
            this.affectedNodeIds.splice(0, this.affectedNodeIds.length, ...initialAffectedNodeIds);
            this.isApplied = false;
        });
        this.isApplied = true;
    }

    undo(document: ProjectDocument): void {
        if (!this.isApplied) return;
        const undone: Command[] = [];
        document.transaction(() => {
            for (let i = this.commands.length - 1; i >= 0; i--) {
                this.commands[i].undo(document);
                undone.push(this.commands[i]);
            }
        }, (error) => {
            this.rollbackCompletedSteps(
                document,
                error,
                undone,
                (cmd) => typeof cmd.redo === 'function' ? cmd.redo(document) : cmd.execute(document),
                'undo'
            );
            this.isApplied = true;
        });
        this.isApplied = false;
    }

    redo(document: ProjectDocument): void {
        if (this.isApplied) return;
        const executed: Command[] = [];
        document.transaction(() => {
            for (const cmd of this.commands) {
                if (typeof cmd.redo === 'function') cmd.redo(document);
                else cmd.execute(document);
                executed.push(cmd);
            }
        }, (error) => {
            this.rollbackCompletedSteps(document, error, executed, (cmd) => cmd.undo(document), 'redo');
            this.isApplied = false;
        });
        this.isApplied = true;
    }

    private rollbackCompletedSteps(
        document: ProjectDocument,
        originalError: unknown,
        completed: Command[],
        compensate: (command: Command) => void,
        operation: string
    ): void {
        const rollbackErrors: unknown[] = [];
        for (let i = completed.length - 1; i >= 0; i--) {
            try {
                compensate(completed[i]);
            } catch (rollbackError) {
                rollbackErrors.push(rollbackError);
            }
        }
        if (rollbackErrors.length > 0) {
            const originalMessage = originalError instanceof Error ? originalError.message : String(originalError);
            const rollbackMessage = rollbackErrors
                .map((failure) => failure instanceof Error ? failure.message : String(failure))
                .join('; ');
            throw new Error(`MacroCommand ${operation} failed: ${originalMessage}. Rollback failed: ${rollbackMessage}`);
        }
    }
}
