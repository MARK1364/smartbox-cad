/**
 * Wiersz relacji w drzewie — pick A/B, offset, status. Lista nie wraca do panelu Solver.
 */

import React, { useEffect, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { ConstraintStore } from './constraint-store.js';
import { ConstraintHighlightOverlay } from './constraint-highlight.js';
import { beginConstraintSlotPick, expectedKindForBind, getActiveConstraintPick, SOLVER_PICK_EVENT } from './constraint-pick-flow.js';
import { anchorShortLabel } from './constraint-ui-labels.js';
import { ADD_BUTTONS, BIND_TYPE_ICON, GROUND_MODE_OPTIONS } from './solver-ui-config.js';
import type { AnchorKind, ConstraintAnchor, SolverConstraint } from './constraint-types.js';
import type { BindType, ConstraintResidual } from './core/contract.js';
import { residualExceedsTolerance, RESIDUAL_TOLERANCE } from './core/solver-core.js';
import type { ConstraintValidationIssue } from './constraint-validation.js';
import './solver-ui.css';

function typeLabel(c: SolverConstraint): string {
    return ADD_BUTTONS.find((b) => b.bindType === c.bindType)?.label || c.bindType;
}

function usesAngularResidual(bindType: BindType, groundKind?: AnchorKind): boolean {
    return bindType === 'COPLANAR' || bindType === 'FLUSH' || (bindType === 'GROUND' && groundKind === 'FACE');
}

function formatResidual(residual: ConstraintResidual, bindType: BindType, groundKind?: AnchorKind): string {
    const parts = [`pozycja ${residual.linearMm.toFixed(2)} mm`];
    if (usesAngularResidual(bindType, groundKind)) {
        const deg = residual.angularRad * (180 / Math.PI);
        parts.push(`kąt ${deg.toFixed(2)}°`);
    }
    return parts.join(', ');
}

function TrashIcon() {
    return (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
    if (hidden) {
        return (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
        );
    }
    return (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

interface Props {
    constraint: SolverConstraint;
    document: any;
    highlighted: boolean;
    issues: ConstraintValidationIssue[];
    onHighlight: () => void;
}

export function ConstraintTreeRow({ constraint: c, document, highlighted, issues, onHighlight }: Props) {
    const [groundMode, setGroundMode] = useState<AnchorKind>(c.anchorA?.kind ?? 'VERTEX');
    const [pickTick, setPickTick] = useState(0);
    useEffect(() => {
        const bump = () => setPickTick((t) => t + 1);
        window.addEventListener(SOLVER_PICK_EVENT, bump);
        return () => window.removeEventListener(SOLVER_PICK_EVENT, bump);
    }, []);
    void pickTick;
    const isPicking = getActiveConstraintPick()?.constraintId === c.id;

    const showConflict = c.conflict;
    const showUnsatisfied =
        !c.conflict &&
        c.enabled &&
        issues.length === 0 &&
        residualExceedsTolerance(c.residual, RESIDUAL_TOLERANCE);
    const residualLabel = formatResidual(c.residual, c.bindType, c.anchorA?.kind);

    const pick = (slot: 'A' | 'B') => {
        beginConstraintSlotPick({
            constraintId: c.id,
            slot,
            expectedKind: expectedKindForBind(c.bindType, groundMode),
        });
    };

    const classNames = [
        'solver-constraint',
        'drzewo-relacja',
        showConflict ? 'solver-constraint--conflict' : '',
        highlighted ? 'solver-constraint--highlight' : '',
        !c.enabled ? 'solver-constraint--disabled' : '',
    ]
        .filter(Boolean)
        .join(' ');

    const removeConstraint = () => {
        ConstraintStore.instance.remove(c.id);
        ConstraintHighlightOverlay.instance.setHighlighted([]);
    };

    const showOffset = c.enabled && (c.bindType === 'COPLANAR' || c.bindType === 'FLUSH');

    return (
        <div className={classNames}>
            <div className="solver-constraint__bar">
                <div className="solver-constraint__bar-group">
                    <button
                        type="button"
                        className={`solver-constraint__icon-btn${highlighted ? ' solver-constraint__icon-btn--active' : ''}`}
                        title={highlighted ? 'Wyłącz podświetlenie' : 'Podświetl więz'}
                        onClick={onHighlight}
                    >
                        {highlighted ? '◉' : '○'}
                    </button>
                    <button
                        type="button"
                        className="solver-constraint__icon-btn"
                        title={c.enabled ? 'Wyłącz relację' : 'Włącz relację'}
                        onClick={() => ConstraintStore.instance.update(c.id, { enabled: !c.enabled })}
                    >
                        <EyeIcon hidden={!c.enabled} />
                    </button>
                    <span className="solver-constraint__type-icon" title={typeLabel(c)}>
                        {BIND_TYPE_ICON[c.bindType]}
                    </span>
                    {!c.enabled && (
                        <button
                            type="button"
                            className="solver-constraint__icon-btn solver-constraint__icon-btn--danger"
                            title="Usuń relację"
                            onClick={removeConstraint}
                        >
                            <TrashIcon />
                        </button>
                    )}
                    {showOffset && (
                        <label className="solver-constraint__offset-inline" title="Offset [mm]">
                            <span>Offset</span>
                            <SmartNumericInput
                                className="solver-constraint__offset-input"
                                value={c.offsetMm}
                                step={0.1}
                                debounceMs={80}
                                onChange={(mm) => {
                                    if (Math.abs((c.offsetMm ?? 0) - mm) < 1e-9) return;
                                    ConstraintStore.instance.update(c.id, { offsetMm: mm });
                                    (ContextManager.instance as any).solverController?.solveNow?.();
                                    ConstraintHighlightOverlay.instance.refresh();
                                }}
                            />
                        </label>
                    )}
                </div>
            </div>

            {c.enabled && (
                <div className="solver-constraint__bar solver-constraint__bar--slots">
                    {c.bindType === 'GROUND' ? (
                        <GroundSlot
                            anchor={c.anchorA}
                            document={document}
                            groundMode={groundMode}
                            onPick={() => pick('A')}
                            onGroundModeChange={setGroundMode}
                        />
                    ) : (
                        <>
                            <ElementSlot
                                label="A"
                                anchor={c.anchorA}
                                document={document}
                                onPick={() => pick('A')}
                            />
                            <ElementSlot
                                label="B"
                                anchor={c.anchorB}
                                document={document}
                                onPick={() => pick('B')}
                            />
                        </>
                    )}
                    <button
                        type="button"
                        className="solver-constraint__icon-btn solver-constraint__icon-btn--danger"
                        title="Usuń relację"
                        onClick={removeConstraint}
                    >
                        <TrashIcon />
                    </button>
                </div>
            )}

            {c.enabled && issues.map((issue) => (
                <div
                    key={`${issue.code}:${issue.message}`}
                    className={`solver-constraint__alert solver-constraint__alert--${issue.severity === 'error' ? 'error' : 'warning'}`}
                >
                    <span>{issue.severity === 'error' ? '⚠' : 'ℹ'}</span>
                    <span>{issue.message}</span>
                </div>
            ))}

            {c.enabled && showConflict && (
                <div className="solver-constraint__alert solver-constraint__alert--error">
                    <span>⚠</span>
                    <span>Wygaszone – sprzeczne ({residualLabel})</span>
                </div>
            )}

            {c.enabled && showUnsatisfied && (
                <div className="solver-constraint__alert solver-constraint__alert--info">
                    <span>ℹ</span>
                    <span>Niespełnione ({residualLabel})</span>
                </div>
            )}

            {isPicking && (
                <div className="solver-constraint__picking-hint">
                    Kliknij element w oknie 3D (ESC — anuluj)
                </div>
            )}
        </div>
    );
}

function ElementSlot({
    label,
    anchor,
    document,
    onPick,
}: {
    label: string;
    anchor: ConstraintAnchor | null;
    document: any;
    onPick: () => void;
}) {
    if (anchor) {
        return (
            <button
                type="button"
                className="solver-constraint__slot solver-constraint__slot--filled"
                title="Kliknij, aby wskazać inną ścianę"
                onClick={onPick}
            >
                <span className="solver-constraint__slot-label">{label}</span>
                <span className="solver-constraint__slot-value" title={anchorShortLabel(anchor, document)}>
                    {anchorShortLabel(anchor, document)}
                </span>
            </button>
        );
    }

    return (
        <button type="button" className="solver-constraint__pick-btn" onClick={onPick}>
            <span>🎯</span>
            <span>Element {label}</span>
        </button>
    );
}

function GroundSlot({
    anchor,
    document,
    groundMode,
    onPick,
    onGroundModeChange,
}: {
    anchor: ConstraintAnchor | null;
    document: any;
    groundMode: AnchorKind;
    onPick: () => void;
    onGroundModeChange: (kind: AnchorKind) => void;
}) {
    if (anchor) {
        return (
            <div className="solver-constraint__ground-row">
                <button
                    type="button"
                    className="solver-constraint__slot solver-constraint__slot--filled"
                    title="Kliknij, aby wskazać inny element"
                    onClick={onPick}
                >
                    <span className="solver-constraint__slot-value" title={anchorShortLabel(anchor, document)}>
                        {anchorShortLabel(anchor, document)}
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className="solver-constraint__ground-row">
            <select
                className="solver-constraint__ground-mode"
                value={groundMode}
                onChange={(e) => onGroundModeChange(e.target.value as AnchorKind)}
                title="Tryb uziemienia"
            >
                {GROUND_MODE_OPTIONS.map((opt) => (
                    <option key={opt.kind} value={opt.kind}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <button type="button" className="solver-constraint__pick-btn" onClick={onPick}>
                <span>🎯</span>
            </button>
        </div>
    );
}
