/**
 * solver-controller.ts — uruchamianie solvera i synchronizacja z dokumentem.
 *
 * Odpowiednik pythonowego `solve_all_constraints` + handlera depsgraph,
 * ale z debounce i blokadą pętli sprzężenia zwrotnego (solve → transform
 * → onDocumentChanged → solve).
 */

import type { ProjectDocument } from '../A1_core/project-document.js';
import type { CommandHistory } from '../A1_core/commands/command-history.js';
import type { DocumentChangeEvent } from '../A1_core/project-document.js';
import { ConstraintGraph } from './core/graph.js';
import { RESIDUAL_TOLERANCE, solveWithConflictResolution } from './core/solver-core.js';
import { ConstraintDragGroup } from './constraint-drag-group.js';
import type { ConstraintStore } from './constraint-store.js';
import { buildSolverInput, collectTransformDeltas } from './solver-bridge.js';
import { SolveConstraintsCommand } from './solve-constraints-command.js';
import type { SolverConstraint } from './constraint-types.js';
import { constraintNodeIds } from './constraint-types.js';
import { validateConstraints, type ConstraintValidationIssue } from './constraint-validation.js';

const DEBOUNCE_MS = 150;

export class SolverController {
    private readonly _store: ConstraintStore;
    private _document: ProjectDocument | null = null;
    private _history: CommandHistory | null = null;
    private _disposers: Array<() => void> = [];

    private _solving = false;
    private _suppressAutoSolve = false;
    private _interactiveTransformDepth = 0;
    private _pendingSolve = false;
    private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(store: ConstraintStore) {
        this._store = store;
    }

    attach(document: ProjectDocument, history: CommandHistory): () => void {
        this.detach();
        this._document = document;
        this._history = history;

        this._disposers.push(this._store.attachTo(document));
        this._disposers.push(
            document.onDocumentChanged((event) => this._onDocumentChanged(event)),
        );
        this._disposers.push(
            this._store.onChange(() => this.requestSolve()),
        );

        return () => this.detach();
    }

    detach(): void {
        if (this._debounceTimer !== null) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
        for (const off of this._disposers) {
            off();
        }
        this._disposers = [];
        this._document = null;
        this._history = null;
    }

    /** Wstrzymuje auto-solve podczas przeciągania gizmo / modal G. */
    beginInteractiveTransform(): void {
        this._interactiveTransformDepth++;
        if (this._debounceTimer !== null) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
    }

    /** Po puszczeniu myszy — jeden przebieg solvera (jak depsgraph debounce w Blenderze). */
    endInteractiveTransform(): void {
        if (this._interactiveTransformDepth <= 0) {
            return;
        }
        this._interactiveTransformDepth--;
        if (this._interactiveTransformDepth === 0) {
            if (this._debounceTimer !== null) {
                clearTimeout(this._debounceTimer);
                this._debounceTimer = null;
            }
            this._pendingSolve = false;
            const component = ConstraintDragGroup.instance.lastComponentIds;
            this.solveNow(component.size > 0 ? { nodeIds: component } : undefined);
        }
    }

    requestSolve(): void {
        if (this._suppressAutoSolve || this._solving || this._interactiveTransformDepth > 0) {
            if (this._interactiveTransformDepth > 0 && !this._suppressAutoSolve) {
                this._pendingSolve = true;
            }
            return;
        }
        if (this._debounceTimer !== null) {
            clearTimeout(this._debounceTimer);
        }
        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this.solveNow();
        }, DEBOUNCE_MS);
    }

    /**
     * Natychmiastowy przebieg solvera. Zwraca true, gdy coś zostało przesunięte.
     * `nodeIds` zawęża solve do spójnego komponentu (po gizmo); brak = cały dokument.
     */
    solveNow(scope?: { nodeIds?: Set<string> }): boolean {
        if (this._debounceTimer !== null) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
        const document = this._document;
        const history = this._history;
        if (!document || !history || this._solving) {
            return false;
        }

        const enabledAll = this._store.constraints.filter((c) => c.enabled);
        if (enabledAll.length === 0) {
            this._store.setValidationIssues([]);
            this._store.resetSolveResults();
            return false;
        }

        this._solving = true;
        this._suppressAutoSolve = true;
        try {
            this._pruneDeadConstraints(document);

            const scoped = this._filterConstraintsToComponent(enabledAll, scope?.nodeIds);
            const validation = validateConstraints(scoped, document);
            this._store.setValidationIssues(validation.issues);
            const enabled = scoped.filter((c) => !validation.skipIds.has(c.id));
            if (enabled.length === 0) {
                this._store.resetSolveResults();
                return false;
            }

            const input = buildSolverInput(document, enabled);
            if (input.warnings.length > 0) {
                this._store.setValidationIssues([
                    ...validation.issues,
                    ...issuesFromBridgeWarnings(input.warnings),
                ]);
            }
            if (input.contract.constraints.length === 0) {
                this._store.resetSolveResults();
                return false;
            }

            input.contract.groundDistanceMap = this._computeGroundDistances(enabled);

            this._store.resetSolveResults();
            const [converged, conflictCount] = solveWithConflictResolution(
                input.contract,
                input.states,
                80,
                RESIDUAL_TOLERANCE,
            );

            this._syncResultsToStore(input);

            for (const cap of input.captured) {
                const c = this._store.get(cap.constraintId);
                if (!c) {
                    continue;
                }
                c.groundPosMm = [...cap.groundPosMm];
                if (cap.groundNormal) {
                    c.groundNormal = [...cap.groundNormal];
                }
            }

            const deltas = collectTransformDeltas(input);
            if (deltas.length > 0) {
                const command = new SolveConstraintsCommand(deltas);
                if (!command.isEmpty) {
                    history.execute(command);
                }
            }

            if (!converged && deltas.length > 0) {
                console.warn('[S2_solver] Solver nie osiągnął pełnej zbieżności.');
            }
            if (conflictCount > 0) {
                console.warn(`[S2_solver] ${conflictCount} więz(ów) wygaszonych jako sprzeczne.`);
            }

            this._store.notifyChanged();
            return deltas.length > 0;
        } finally {
            this._solving = false;
            this._suppressAutoSolve = false;
        }
    }

    private _onDocumentChanged(event: DocumentChangeEvent): void {
        if (this._suppressAutoSolve || this._solving || this._interactiveTransformDepth > 0) {
            return;
        }
        if (event.type === 'structure') {
            const document = this._document;
            if (document) {
                this._pruneDeadConstraints(document);
            }
            this.requestSolve();
            return;
        }
        if (event.type === 'transform' || event.type === 'dimensions') {
            this.requestSolve();
        }
    }

    private _pruneDeadConstraints(document: ProjectDocument): void {
        const ids = new Set<string>();
        for (const node of document.rootNode.findAll()) {
            ids.add(node.id);
        }
        ids.add(document.rootNode.id);
        this._store.pruneMissingNodes(ids);
    }

    private _filterConstraintsToComponent(
        constraints: SolverConstraint[],
        nodeIds: Set<string> | undefined,
    ): SolverConstraint[] {
        if (!nodeIds || nodeIds.size === 0) {
            return constraints;
        }
        return constraints.filter((c) => constraintNodeIds(c).some((id) => nodeIds.has(id)));
    }

    private _computeGroundDistances(constraints: SolverConstraint[]): Record<string, number> {
        const groundIds = new Set<string>();
        const edges: Record<string, string[]> = {};

        for (const c of constraints) {
            if (!c.enabled || c.bindType !== 'GROUND' || !c.anchorA) {
                continue;
            }
            groundIds.add(c.anchorA.nodeId);
        }

        for (const c of constraints) {
            if (!c.enabled || c.bindType === 'GROUND') {
                continue;
            }
            const ids = constraintNodeIds(c);
            if (ids.length !== 2) {
                continue;
            }
            const [a, b] = ids;
            if (!edges[a]) edges[a] = [];
            if (!edges[b]) edges[b] = [];
            if (!edges[a].includes(b)) edges[a].push(b);
            if (!edges[b].includes(a)) edges[b].push(a);
        }

        if (groundIds.size === 0) {
            // Brak GROUND — element A więzu jest odniesieniem (jak pierwszy
            // komponent w złożeniu SW/Creo): B podciąga się do A, a nie oba
            // rozjeżdżają się na pół.
            const usedAsB = new Set<string>();
            for (const c of constraints) {
                if (!c.enabled || c.bindType === 'GROUND' || !c.anchorB) {
                    continue;
                }
                usedAsB.add(c.anchorB.nodeId);
            }
            const seeds = new Set<string>();
            for (const c of constraints) {
                if (!c.enabled || c.bindType === 'GROUND' || !c.anchorA) {
                    continue;
                }
                if (!usedAsB.has(c.anchorA.nodeId)) {
                    seeds.add(c.anchorA.nodeId);
                }
            }
            if (seeds.size === 0) {
                for (const c of constraints) {
                    if (c.enabled && c.bindType !== 'GROUND' && c.anchorA) {
                        seeds.add(c.anchorA.nodeId);
                    }
                }
            }
            if (seeds.size === 0) {
                return {};
            }
            return new ConstraintGraph().computeGroundDistances(seeds, edges);
        }

        const graph = new ConstraintGraph();
        return graph.computeGroundDistances(groundIds, edges);
    }

    private _syncResultsToStore(input: ReturnType<typeof buildSolverInput>): void {
        for (const item of input.contract.constraints) {
            const stored = this._store.get(item.constraintId);
            if (!stored) {
                continue;
            }
            stored.conflict = item.conflict;
            stored.residual = { ...item.residual };
        }
    }
}

function issuesFromBridgeWarnings(warnings: string[]): ConstraintValidationIssue[] {
    const issues: ConstraintValidationIssue[] = [];
    for (const message of warnings) {
        const match = message.match(/^Więz (\S+):/);
        if (!match) {
            continue;
        }
        issues.push({
            constraintId: match[1],
            severity: 'warning',
            code: 'BRIDGE_WARNING',
            message,
        });
    }
    return issues;
}
