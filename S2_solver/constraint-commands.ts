/**
 * constraint-commands.ts — komendy CommandHistory dla zmian więzów.
 *
 * Zapewnia pełną obsługę Undo/Redo (Ctrl+Z / Ctrl+Y) dla relacji:
 * - AddConstraintCommand: Undo usuwa więz z wstrzykniętego ConstraintStore i cofa ruchy brył.
 * - RemoveConstraintCommand: wycofanie usunięcia (Undo) przywraca więz do ConstraintStore.
 * - UpdateConstraintCommand: Undo przywraca poprzedni stan więzu i pozycje brył.
 */

import type { Command } from '../A1_core/commands/command.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { ConstraintStore } from './constraint-store.js';
import { ConstraintHighlightOverlay } from './constraint-highlight.js';
import { cloneSolverConstraint, type SolverConstraint } from './constraint-types.js';
import type { NodeTransformDelta } from './solve-constraints-command.js';
import { ContextManager } from '../A1_core/context-manager.js';

export class AddConstraintCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly _constraint: SolverConstraint;
    private readonly _deltas: NodeTransformDelta[];
    private readonly _store: ConstraintStore;

    constructor(
        constraint: SolverConstraint,
        deltas: NodeTransformDelta[] = [],
        label: string = 'Dodanie relacji',
        store: ConstraintStore = ConstraintStore.instance,
    ) {
        this.id = `cmd_add_cst_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = label;
        this.timestamp = Date.now();
        this._constraint = { ...constraint };
        this._store = store;
        this._deltas = deltas.map((d) => ({
            nodeId: d.nodeId,
            localBefore: d.localBefore.clone(),
            localAfter: d.localAfter.clone(),
        }));
        const nodes = new Set<string>();
        if (constraint.anchorA?.nodeId) nodes.add(constraint.anchorA.nodeId);
        if (constraint.anchorB?.nodeId) nodes.add(constraint.anchorB.nodeId);
        for (const d of this._deltas) nodes.add(d.nodeId);
        this.affectedNodeIds = Array.from(nodes);
    }

    execute(document: ProjectDocument): void {
        this._store.add(this._constraint);
        this._applyTransforms(document, 'localAfter');
        this._scheduleVisualRefresh(document, false);
    }

    undo(document: ProjectDocument): void {
        this._store.remove(this._constraint.id);
        this._applyTransforms(document, 'localBefore');
        this._scheduleVisualRefresh(document, true);
    }

    redo(document: ProjectDocument): void {
        this._store.add(this._constraint);
        this._applyTransforms(document, 'localAfter');
        this._scheduleVisualRefresh(document, true);
    }

    private _scheduleVisualRefresh(document: ProjectDocument, requestRender: boolean): void {
        document.afterCommit(() => {
            ConstraintHighlightOverlay.instance.refresh();
            if (requestRender) {
                ContextManager.instance.viewport?.requestRender?.(2);
            }
        });
    }

    private _applyTransforms(document: ProjectDocument, field: 'localBefore' | 'localAfter'): void {
        const touched: string[] = [];
        for (const delta of this._deltas) {
            const node = document.findNode(delta.nodeId);
            if (!node) continue;
            node.setLocalMatrix(delta[field].clone());
            touched.push(delta.nodeId);
        }
        if (touched.length > 0) {
            document.emitChange('transform', touched);
        }
    }
}

export class RemoveConstraintCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly suppressConstraintAutoSolve: boolean;

    private readonly _constraint: SolverConstraint;
    private readonly _store: ConstraintStore;

    constructor(
        constraint: SolverConstraint,
        label: string = 'Usunięcie relacji',
        store: ConstraintStore = ConstraintStore.instance,
    ) {
        this.id = `cmd_rm_cst_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = label;
        this.timestamp = Date.now();
        this._constraint = { ...constraint };
        this._store = store;
        this.suppressConstraintAutoSolve = !constraint.anchorA || (
            constraint.bindType !== 'GROUND' && !constraint.anchorB
        );
        const nodes = new Set<string>();
        if (constraint.anchorA?.nodeId) nodes.add(constraint.anchorA.nodeId);
        if (constraint.anchorB?.nodeId) nodes.add(constraint.anchorB.nodeId);
        this.affectedNodeIds = Array.from(nodes);
    }

    execute(document: ProjectDocument): void {
        this._store.remove(this._constraint.id);
        this._scheduleVisualRefresh(document, false);
    }

    undo(document: ProjectDocument): void {
        this._store.add(this._constraint);
        this._scheduleVisualRefresh(document, true);
    }

    redo(document: ProjectDocument): void {
        this._store.remove(this._constraint.id);
        this._scheduleVisualRefresh(document, true);
    }

    private _scheduleVisualRefresh(document: ProjectDocument, requestRender: boolean): void {
        document.afterCommit(() => {
            ConstraintHighlightOverlay.instance.refresh();
            if (requestRender) {
                ContextManager.instance.viewport?.requestRender?.(2);
            }
        });
    }
}

export class UpdateConstraintCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly suppressConstraintAutoSolve = true;

    private readonly _before: SolverConstraint;
    private readonly _after: SolverConstraint;
    private readonly _deltas: NodeTransformDelta[];
    private readonly _store: ConstraintStore;

    constructor(
        before: SolverConstraint,
        after: SolverConstraint,
        deltas: NodeTransformDelta[] = [],
        label: string = 'Edycja relacji',
        store: ConstraintStore = ConstraintStore.instance,
    ) {
        this.id = `cmd_update_cst_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = label;
        this.timestamp = Date.now();
        this._before = cloneSolverConstraint(before);
        this._after = cloneSolverConstraint(after);
        this._store = store;
        this._deltas = deltas.map((delta) => ({
            nodeId: delta.nodeId,
            localBefore: delta.localBefore.clone(),
            localAfter: delta.localAfter.clone(),
        }));
        const nodes = new Set<string>();
        for (const constraint of [before, after]) {
            if (constraint.anchorA?.nodeId) nodes.add(constraint.anchorA.nodeId);
            if (constraint.anchorB?.nodeId) nodes.add(constraint.anchorB.nodeId);
        }
        for (const delta of this._deltas) nodes.add(delta.nodeId);
        this.affectedNodeIds = Array.from(nodes);
    }

    execute(document: ProjectDocument): void {
        this._apply(document, this._after, 'localAfter', false);
    }

    undo(document: ProjectDocument): void {
        this._apply(document, this._before, 'localBefore', true);
    }

    redo(document: ProjectDocument): void {
        this._apply(document, this._after, 'localAfter', true);
    }

    private _apply(
        document: ProjectDocument,
        constraint: SolverConstraint,
        transformField: 'localBefore' | 'localAfter',
        requestRender: boolean,
    ): void {
        this._store.update(constraint.id, cloneSolverConstraint(constraint));
        const touched: string[] = [];
        for (const delta of this._deltas) {
            const node = document.findNode(delta.nodeId);
            if (!node) continue;
            node.setLocalMatrix(delta[transformField].clone());
            touched.push(delta.nodeId);
        }
        if (touched.length > 0) {
            document.emitChange('transform', touched);
        }
        document.afterCommit(() => {
            ConstraintHighlightOverlay.instance.refresh();
            if (requestRender) {
                ContextManager.instance.viewport?.requestRender?.(2);
            }
        });
    }
}
