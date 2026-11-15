/**
 * Zapisuje zmianę programu CNC w dokumencie przez CommandHistory.
 * Snapshot obejmuje dane programu, ale zachowuje referencję do panelu CAD.
 */
import type { Command } from '../../A1_core/commands/command.js';
import type { ProjectDocument } from '../../A1_core/project-document.js';
import type { CNCProgramState } from '../core/cam-state-store.js';

export interface UpdateCncProgramCommandOptions {
    label?: string;
    onProgramsChanged?: (panel: any) => void;
}

function cloneValue<T>(value: T, seen = new WeakMap<object, any>()): T {
    if (value === null || typeof value !== 'object') return value;
    const object = value as unknown as object;
    const cached = seen.get(object);
    if (cached) return cached;
    if (Array.isArray(value)) {
        const result: any[] = [];
        seen.set(object, result);
        for (const item of value) result.push(cloneValue(item, seen));
        return result as T;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    const result: Record<string, unknown> = {};
    seen.set(object, result);
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        result[key] = cloneValue(item, seen);
    }
    return result as T;
}

function snapshotProgram(program: CNCProgramState): CNCProgramState {
    return {
        ...program,
        targetPanel: program.targetPanel,
        features: cloneValue(program.features),
        toolAssignments: { ...program.toolAssignments },
        strategyParams: program.strategyParams ? cloneValue(program.strategyParams) : program.strategyParams,
        clDataProgram: program.clDataProgram ? cloneValue(program.clDataProgram) : program.clDataProgram,
    };
}

export class UpdateCncProgramCommand implements Command {
    readonly id = `cmd_update_cnc_program_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];

    private readonly panelId: string;
    private readonly targetPanel: any;
    private readonly programId: string;
    private readonly before: CNCProgramState;
    private readonly after: CNCProgramState;
    private readonly onProgramsChanged?: (panel: any) => void;

    constructor(
        panel: any,
        before: CNCProgramState,
        after: CNCProgramState,
        options: UpdateCncProgramCommandOptions = {},
    ) {
        this.panelId = String(panel?.id ?? before.targetPanelId ?? '');
        this.targetPanel = panel;
        this.programId = before.id;
        this.before = snapshotProgram(before);
        this.after = snapshotProgram(after);
        this.label = options.label ?? 'Edycja operacji CNC';
        this.onProgramsChanged = options.onProgramsChanged;
        this.affectedNodeIds = this.panelId ? [this.panelId] : [];
    }

    execute(document: ProjectDocument): void {
        this.apply(document, this.after);
    }

    undo(document: ProjectDocument): void {
        this.apply(document, this.before);
    }

    redo(document: ProjectDocument): void {
        this.apply(document, this.after);
    }

    private apply(document: ProjectDocument, snapshot: CNCProgramState): void {
        const panel = this.resolvePanel(document);
        if (!panel || !Array.isArray(panel.cncPrograms)) {
            throw new Error(`Nie znaleziono formatki programu CNC ${this.programId}.`);
        }
        const index = panel.cncPrograms.findIndex((program: any) => program?.id === this.programId);
        if (index < 0) throw new Error(`Nie znaleziono programu CNC ${this.programId}.`);

        const next = snapshotProgram(snapshot);
        next.targetPanel = panel;
        panel.cncPrograms[index] = next;
        document.notifyDocumentChanged(this.affectedNodeIds);

        if (this.onProgramsChanged) {
            const notify = this.onProgramsChanged;
            document.afterCommit(() => notify(panel));
        }
    }

    private resolvePanel(document: ProjectDocument): any | null {
        if (this.panelId && typeof document.findNode === 'function') {
            const node = document.findNode(this.panelId);
            if (node?.domainData) return node.domainData;
        }
        return this.targetPanel || null;
    }
}
