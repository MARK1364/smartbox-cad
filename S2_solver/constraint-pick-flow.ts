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
    ContextManager.instance.appAPI?.setStatus?.(CONFLICT_REJECT_MESSAGE, true);
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

    const slotLabel = opts.slot === 'A' ? 'A' : 'B';
    const kindHint =
        opts.expectedKind === 'VERTEX'
            ? 'narożnik'
            : opts.expectedKind === 'FACE'
              ? 'ścianę formatki lub krawędź'
              : 'korpus';

    activePick = { constraintId: opts.constraintId, slot: opts.slot };
    notifyPickChanged();
    startConstraintPick({
        label: `Więz ${BIND_TYPE_ICON[constraint.bindType]}: wskaż ${kindHint} (${slotLabel}) w 3D — ESC anuluje`,
        expectedKind: opts.expectedKind,
        onPick: (anchor) => {
            activePick = null;
            notifyPickChanged();
            const live = store.get(opts.constraintId);
            if (!live) {
                return;
            }
            if (live.bindType !== 'GROUND' && opts.slot === 'B') {
                const other = live.anchorA;
                if (other && other.nodeId === anchor.nodeId) {
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
            (ContextManager.instance as any).solverController?.solveNow?.();

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

            ConstraintHighlightOverlay.instance.refresh();

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
            activePick = null;
            notifyPickChanged();
        },
    });
}

export function addConstraintWithPick(bindType: BindType, groundKind: AnchorKind = 'VERTEX'): SolverConstraint {
    stopConstraintPick();
    const store = ConstraintStore.instance;
    const draft = store.add({ bindType, anchorA: null, anchorB: null });
    openDrzewoRelacjeTab(draft.id);
    beginConstraintSlotPick({
        constraintId: draft.id,
        slot: 'A',
        expectedKind: expectedKindForBind(bindType, groundKind),
        thenPickB: bindType !== 'GROUND',
    });
    return draft;
}
