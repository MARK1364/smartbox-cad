/**
 * constraint-commands.ts — komendy CommandHistory dla dodawania i usuwania więzów.
 *
 * Zapewnia pełną obsługę Undo/Redo (Ctrl+Z / Ctrl+Y) dla relacji:
 * - AddConstraintCommand: wycofanie więzu (Undo) usuwa go z ConstraintStore i cofa ruchy brył.
 * - RemoveConstraintCommand: wycofanie usunięcia (Undo) przywraca więz do ConstraintStore.
 */

import type { Command } from '../A1_core/commands/command.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { ConstraintStore } from './constraint-store.js';
import { ConstraintHighlightOverlay } from './constraint-highlight.js';
import type { SolverConstraint } from './constraint-types.js';
import type { NodeTransformDelta } from './solve-constraints-command.js';
import { ContextManager } from '../A1_core/context-manager.js';

export class AddConstraintCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly _constraint: SolverConstraint;
    private readonly _deltas: NodeTransformDelta[];

    constructor(
        constraint: SolverConstraint,
        deltas: NodeTransformDelta[] = [],
        label: string = 'Dodanie relacji',
    ) {
        this.id = `cmd_add_cst_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = label;
        this.timestamp = Date.now();
        this._constraint = { ...constraint };
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
        ConstraintStore.instance.add(this._constraint);
        this._applyTransforms(document, 'localAfter');
        ConstraintHighlightOverlay.instance.refresh();
    }

    undo(document: ProjectDocument): void {
        ConstraintStore.instance.remove(this._constraint.id);
        this._applyTransforms(document, 'localBefore');
        ConstraintHighlightOverlay.instance.refresh();
        ContextManager.instance.viewport?.requestRender?.(2);
    }

    redo(document: ProjectDocument): void {
        ConstraintStore.instance.add(this._constraint);
        this._applyTransforms(document, 'localAfter');
        ConstraintHighlightOverlay.instance.refresh();
        ContextManager.instance.viewport?.requestRender?.(2);
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

    private readonly _constraint: SolverConstraint;

    constructor(constraint: SolverConstraint, label: string = 'Usunięcie relacji') {
        this.id = `cmd_rm_cst_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = label;
        this.timestamp = Date.now();
        this._constraint = { ...constraint };
        const nodes = new Set<string>();
        if (constraint.anchorA?.nodeId) nodes.add(constraint.anchorA.nodeId);
        if (constraint.anchorB?.nodeId) nodes.add(constraint.anchorB.nodeId);
        this.affectedNodeIds = Array.from(nodes);
    }

    execute(_document: ProjectDocument): void {
        ConstraintStore.instance.remove(this._constraint.id);
        ConstraintHighlightOverlay.instance.refresh();
    }

    undo(_document: ProjectDocument): void {
        ConstraintStore.instance.add(this._constraint);
        ConstraintHighlightOverlay.instance.refresh();
        ContextManager.instance.viewport?.requestRender?.(2);
    }

    redo(_document: ProjectDocument): void {
        ConstraintStore.instance.remove(this._constraint.id);
        ConstraintHighlightOverlay.instance.refresh();
        ContextManager.instance.viewport?.requestRender?.(2);
    }
}
