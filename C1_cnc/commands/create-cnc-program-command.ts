/**
 * SmartPanel Web — C1_CNC Create Program Command
 *
 * Dodaje nowy program CNC do formatki przez historię komend, dzięki czemu
 * operację można cofnąć i ponowić standardowym Undo/Redo.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import type { CNCProgramState } from '../core/cam-state-store.js';

export interface CreateCncProgramCommandOptions {
    label?: string;
    /** Wywoływane po każdej zmianie listy programów (execute/undo), po zatwierdzeniu transakcji. */
    onProgramsChanged?: (panel: any) => void;
}

export class CreateCncProgramCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly panelId: string;
    private readonly targetPanel: any;
    private readonly program: CNCProgramState;
    private readonly onProgramsChanged?: (panel: any) => void;
    private inserted = false;
    private previousActiveStates: Array<{ program: any; isActive: any }> = [];

    constructor(targetPanel: any, program: CNCProgramState, options: CreateCncProgramCommandOptions = {}) {
        this.id = `cmd_create_cnc_program_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = options.label ?? 'Utworzenie programu CNC';
        this.timestamp = Date.now();
        this.panelId = String(targetPanel?.id ?? program?.targetPanelId ?? '');
        this.targetPanel = targetPanel;
        this.program = program;
        this.onProgramsChanged = options.onProgramsChanged;
        this.affectedNodeIds = this.panelId ? [this.panelId] : [];
    }

    execute(document: ProjectDocument): void {
        const panel = this.resolvePanel(document);
        if (!panel) return;

        if (!Array.isArray(panel.cncPrograms)) {
            panel.cncPrograms = [];
        }

        const programs = panel.cncPrograms as any[];
        const existingIndex = programs.findIndex((p: any) => p?.id === this.program.id);
        let insertedNow = false;
        if (existingIndex === -1) {
            insertedNow = true;
            this.inserted = true;
            this.previousActiveStates = programs.map((p: any) => ({
                program: p,
                isActive: p?.isActive
            }));
            for (const p of programs) {
                if (p) p.isActive = false;
            }
            this.program.isActive = true;
            this.program.targetPanel = panel;
            programs.push(this.program);
        }

        if (insertedNow) {
            this.publish(document, panel);
        }
    }

    undo(document: ProjectDocument): void {
        if (!this.inserted) return;

        const panel = this.resolvePanel(document);
        if (!panel || !Array.isArray(panel.cncPrograms)) return;

        const index = panel.cncPrograms.findIndex((p: any) => p?.id === this.program.id);
        if (index !== -1) {
            panel.cncPrograms.splice(index, 1);
        }
        for (const state of this.previousActiveStates) {
            if (state.program && state.program.id !== this.program.id) {
                state.program.isActive = state.isActive;
            }
        }
        this.previousActiveStates = [];
        this.inserted = false;

        this.publish(document, panel);
    }

    redo(document: ProjectDocument): void {
        this.execute(document);
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
