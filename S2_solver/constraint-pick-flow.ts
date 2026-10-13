/**
 * Pipeta więzów — dodawanie z panelu narzędzi i ponowny pick z drzewa.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { ConstraintStore } from './constraint-store.js';
import { startConstraintPick, stopConstraintPick } from './constraint-picker.js';
import { constraintHasGeometry, type AnchorKind, type SolverConstraint } from './constraint-types.js';
import { ConstraintHighlightOverlay } from './constraint-highlight.js';
import { BIND_TYPE_ICON, CONFLICT_REJECT_MESSAGE } from './solver-ui-config.js';
import type { BindType } from './core/contract.js';
import { AddConstraintCommand } from './constraint-commands.js';
import type { NodeTransformDelta } from './solve-constraints-command.js';

export const DRZEWO_TAB_EVENT = 'cad-drzewo-tab';
export const SOLVER_PICK_EVENT = 'solver-pick-changed';

function notifyPickChanged(): void {
    window.dispatchEvent(new Event(SOLVER_PICK_EVENT));
}

export type ActiveConstraintPick = { constraintId: string; slot: 'A' | 'B' };
let activePick: ActiveConstraintPick | null = null;

export function getActiveConstraintPick(): ActiveConstraintPick | null {
    return activePick;
}

export function openDrzewoRelacjeTab(constraintId?: string): void {
    window.dispatchEvent(
        new CustomEvent(DRZEWO_TAB_EVENT, { detail: { tab: 'relacje', constraintId } }),
    );
}

export function expectedKindForBind(bindType: BindType, groundKind: AnchorKind = 'VERTEX'): AnchorKind {
    if (bindType === 'VERTEX') return 'VERTEX';
    if (bindType === 'GROUND') return groundKind;
    return 'FACE';
}

function warnConflict(): void {
    ContextManager.instance.appAPI?.setStatus?.(CONFLICT_REJECT_MESSAGE, true, 'error');
    window.dispatchEvent(
        new CustomEvent('solver-conflict', { detail: { message: CONFLICT_REJECT_MESSAGE } }),
    );
}

export function beginConstraintSlotPick(opts: {
    constraintId: string;
    slot: 'A' | 'B';
    expectedKind: AnchorKind;
    thenPickB?: boolean;
}): void {
    const store = ConstraintStore.instance;
    const constraint = store.get(opts.constraintId);
    if (!constraint) {
        return;
    }

    const stepLabel = opts.slot === 'A'
        ? (opts.thenPickB ? 'Krok 1/2: wskaż pierwszą ścianę w 3D' : 'Wskaż ścianę (A) w 3D')
        : 'Krok 2/2: wskaż drugą ścianę w 3D';
    const kindHint =
        opts.expectedKind === 'VERTEX'
            ? 'narożnik'
            : opts.expectedKind === 'FACE'
              ? 'ścianę'
              : 'obiekt';

    activePick = { constraintId: opts.constraintId, slot: opts.slot };
    ConstraintHighlightOverlay.instance.setHighlighted([opts.constraintId]);
    notifyPickChanged();
    startConstraintPick({
        label: `Więz ${BIND_TYPE_ICON[constraint.bindType]}: ${stepLabel} (${kindHint}) — kliknij bezpośrednio w scenie, ESC anuluje`,
        expectedKind: opts.expectedKind,
        onPick: (anchor) => {
            ConstraintHighlightOverlay.instance.stopVertexRubberBand();
            activePick = null;
            notifyPickChanged();
            const live = store.get(opts.constraintId);
            if (!live) {
                return;
            }
            if (live.bindType !== 'GROUND' && opts.slot === 'B') {
                const other = live.anchorA;
                if (
                    other &&
                    other.nodeId === anchor.nodeId &&
                    other.kind !== 'DATUM' &&
                    anchor.kind !== 'DATUM'
                ) {
                    ContextManager.instance.appAPI?.setStatus?.(
                        'Nie można wiązać korpusu z samym sobą.',
                        true,
                    );
                    return;
                }
            }

            const previous = {
                anchorA: live.anchorA,
                anchorB: live.anchorB,
                groundPosMm: live.groundPosMm,
                groundNormal: live.groundNormal,
            };
            const wasReady = constraintHasGeometry(live);

            const patch: Partial<SolverConstraint> =
                opts.slot === 'A' ? { anchorA: anchor } : { anchorB: anchor };

            if (live.bindType === 'GROUND' && opts.slot === 'A') {
                patch.groundPosMm = null;
                patch.groundNormal = null;
            }

            store.update(opts.constraintId, patch);

            const isFinalSlot = (live.bindType === 'GROUND' && opts.slot === 'A') || opts.slot === 'B';
            const solverCtrl = (ContextManager.instance as any).solverController;

            if (isFinalSlot) {
                solverCtrl?.solveNow?.({
                    onCommand: (deltas: NodeTransformDelta[]) => {
                        const finalC = store.get(opts.constraintId);
                        if (!finalC || finalC.conflict) return null;
                        return new AddConstraintCommand(finalC, deltas);
                    },
                });
                ContextManager.instance.appAPI?.setStatus?.(
                    `Relacja ${BIND_TYPE_ICON[live.bindType]} została pomyślnie złączona i przeliczona.`,
                    false,
                );
            } else {
                solverCtrl?.solveNow?.();
            }

            const after = store.get(opts.constraintId);
            if (after && constraintHasGeometry(after) && after.conflict) {
                if (!wasReady) {
                    store.remove(opts.constraintId);
                    warnConflict();
                } else {
                    store.update(opts.constraintId, {
                        ...previous,
                        conflict: false,
                    });
                    (ContextManager.instance as any).solverController?.solveNow?.();
                    warnConflict();
                }
            }

            if (isFinalSlot) {
                ConstraintHighlightOverlay.instance.clear();
            } else {
                ConstraintHighlightOverlay.instance.refresh();
            }

            if (
                opts.thenPickB &&
                opts.slot === 'A' &&
                live.bindType !== 'GROUND' &&
                store.get(opts.constraintId)
            ) {
                beginConstraintSlotPick({
                    constraintId: opts.constraintId,
                    slot: 'B',
                    expectedKind: opts.expectedKind,
                });
            }
        },
        onCancel: () => {
            ConstraintHighlightOverlay.instance.stopVertexRubberBand();
            ConstraintHighlightOverlay.instance.clear();
            activePick = null;
            notifyPickChanged();
        },
    });

    if (opts.slot === 'B' && constraint.bindType === 'VERTEX' && constraint.anchorA) {
        ConstraintHighlightOverlay.instance.startVertexRubberBand(opts.constraintId);
    } else {
        ConstraintHighlightOverlay.instance.stopVertexRubberBand();
    }
}

/**
 * Kasuje niedokończone więzy (brak pełnej geometrii A/B) — np. po przełączeniu
 * „Połącz narożnikami” → „Wyrównaj ściany” nie zostają zepsute inputy.
 */
export function removeIncompleteConstraintDrafts(): string[] {
    const store = ConstraintStore.instance;
    const removed: string[] = [];
    for (const c of [...store.constraints]) {
        if (constraintHasGeometry(c)) continue;
        store.remove(c.id);
        removed.push(c.id);
    }
    if (removed.length > 0) {
        ConstraintHighlightOverlay.instance.stopVertexRubberBand();
        ConstraintHighlightOverlay.instance.setHighlighted([]);
        notifyPickChanged();
    }
    return removed;
}

/**
 * Tworzy relację. Przy autoPick=true od razu przechodzi do wskazywania ściany A w 3D.
 */
export function addConstraintDraft(bindType: BindType, autoPick: boolean = false): SolverConstraint {
    stopConstraintPick();
    ConstraintHighlightOverlay.instance.stopVertexRubberBand();
    removeIncompleteConstraintDrafts();
    const store = ConstraintStore.instance;
    const draft = store.add({ bindType, anchorA: null, anchorB: null });
    openDrzewoRelacjeTab(draft.id);
    notifyPickChanged();
    if (autoPick) {
        beginConstraintSlotPick({
            constraintId: draft.id,
            slot: 'A',
            expectedKind: expectedKindForBind(bindType, bindType === 'GROUND' ? 'VERTEX' : 'FACE'),
            thenPickB: bindType !== 'GROUND',
        });
    } else {
        ContextManager.instance.appAPI?.setStatus?.(
            `Relacja ${BIND_TYPE_ICON[bindType]}: wskaż płaszczyznę lub naroże w 3D`,
            true,
        );
    }
    return draft;
}

/** @deprecated Używaj addConstraintDraft — bez automatycznego startu pipety. */
export function addConstraintWithPick(bindType: BindType, _groundKind: AnchorKind = 'VERTEX'): SolverConstraint {
    return addConstraintDraft(bindType, true);
}
