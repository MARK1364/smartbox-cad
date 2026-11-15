/**
 * SmartPanel Web — C1_CNC Remove Program Command
 *
 * Usuwa program CNC z formatki przez historię komend. Undo przywraca program
 * na pierwotną pozycję wraz z poprzednimi flagami isActive.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';

export interface RemoveCncProgramCommandOptions {
    label?: string;
    /** Wywoływane po każdej zmianie listy programów (execute/undo), po zatwierdzeniu transakcji. */
    onProgramsChanged?: (panel: any) => void;
}

export class RemoveCncProgramCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly panelId: string;
    private readonly targetPanel: any;
    private readonly programId: string;
    private readonly onProgramsChanged?: (panel: any) => void;

    private removedProgram: any = null;
    private removedIndex = -1;
    private previousActiveStates: Array<{ program: any; isActive: any }> = [];
    private removed = false;

    constructor(targetPanel: any, programId: string, options: RemoveCncProgramCommandOptions = {}) {
        this.id = `cmd_remove_cnc_program_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = options.label ?? 'Usunięcie programu CNC';
        this.timestamp = Date.now();
        this.panelId = String(targetPanel?.id ?? '');
        this.targetPanel = targetPanel;
        this.programId = programId;
        this.onProgramsChanged = options.onProgramsChanged;
        this.affectedNodeIds = this.panelId ? [this.panelId] : [];
    }

    execute(document: ProjectDocument): void {
        const panel = this.resolvePanel(document);
        if (!panel || !Array.isArray(panel.cncPrograms)) return;

        const index = panel.cncPrograms.findIndex((p: any) => p?.id === this.programId);
        if (index === -1) return;

        this.removedProgram = panel.cncPrograms[index];
        this.removedIndex = index;
        this.previousActiveStates = panel.cncPrograms.map((p: any) => ({
            program: p,
            isActive: p?.isActive
        }));

        panel.cncPrograms.splice(index, 1);
        this.ensureSingleActive(panel.cncPrograms);
        this.removed = true;

        this.publish(document, panel);
    }

    undo(document: ProjectDocument): void {
        if (!this.removed || !this.removedProgram) return;

        const panel = this.resolvePanel(document);
        if (!panel) return;
        if (!Array.isArray(panel.cncPrograms)) {
            panel.cncPrograms = [];
        }

        const exists = panel.cncPrograms.some((p: any) => p?.id === this.programId);
        if (!exists) {
            const insertAt = Math.max(0, Math.min(this.removedIndex, panel.cncPrograms.length));
            panel.cncPrograms.splice(insertAt, 0, this.removedProgram);
        }

        for (const state of this.previousActiveStates) {
            if (state.program) {
                state.program.isActive = state.isActive;
            }
        }
        this.removed = false;

        this.publish(document, panel);
    }

    redo(document: ProjectDocument): void {
        this.execute(document);
    }

    /**
     * Po usunięciu dokładnie jeden program ma pozostać aktywny.
     * - zero aktywnych: aktywujemy pierwszy program,
     * - jeden aktywny: zachowujemy go bez zmian,
     * - kilka aktywnych: deterministycznie zachowujemy pierwszy na liście,
     *   pozostałym ustawiamy isActive = false.
     */
    private ensureSingleActive(programs: any[]): void {
        if (programs.length === 0) return;

        const active = programs.filter((p: any) => p?.isActive);
        if (active.length === 0) {
            programs[0].isActive = true;
            return;
        }

        const keeper = active[0];
        for (const program of programs) {
            if (program) {
                program.isActive = program === keeper;
            }
        }
    }

    private resolvePanel(document: ProjectDocument): any | null {
        if (document && this.panelId && typeof document.findNode === 'function') {
            const node = document.findNode(this.panelId);
            if (node?.domainData) return node.domainData;
        }
        return this.targetPanel || null;
    }

    private publish(document: ProjectDocument, panel: any): void {
        if (document && typeof (document as any).emitChange === 'function') {
            document.emitChange('all', this.affectedNodeIds);
        }
        if (this.onProgramsChanged) {
            // Poza transakcją afterCommit wykonuje efekt od razu; w makrze dopiero
            // po zatwierdzeniu, więc rollback nie publikuje stanu pośredniego.
            const notify = this.onProgramsChanged;
            if (document && typeof document.afterCommit === 'function') {
                document.afterCommit(() => notify(panel));
            } else {
                notify(panel);
            }
        }
    }
}
