/**
 * Sekcja „Ściany odniesienia” w oknie edycji formatki — ten sam shell co Bloki/AGD/LED,
 * treść = więzy (naroża / ściany), bez auto-picku.
 */

import React, { useEffect, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import { ConstraintStore } from './constraint-store.js';
import { ConstraintTreeRow } from './constraint-tree-row.js';
import { addConstraintDraft, beginConstraintSlotPick, expectedKindForBind, SOLVER_PICK_EVENT } from './constraint-pick-flow.js';
import { ConstraintHighlightOverlay } from './constraint-highlight.js';
import { ADD_BUTTONS, CONFLICT_REJECT_MESSAGE } from './solver-ui-config.js';
import type { SolverConstraint } from './constraint-types.js';
import './solver-ui.css';

function anchorTouchesPanel(anchor: SolverConstraint['anchorA'], panelId: string): boolean {
    if (!anchor) return false;
    return anchor.nodeId === panelId || anchor.sourceNodeId === panelId;
}

function constraintTouchesPanel(c: SolverConstraint, panelId: string): boolean {
    return anchorTouchesPanel(c.anchorA, panelId) || anchorTouchesPanel(c.anchorB, panelId);
}

interface Props {
    panelId: string;
}

export function PanelRelationsEdit({ panelId }: Props): React.JSX.Element {
    const doc = ContextManager.instance.document;
    const [isRefsOpen, setIsRefsOpen] = useState(true);
    const [tick, setTick] = useState(0);
    const [sessionIds, setSessionIds] = useState<string[]>([]);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);

    useEffect(() => {
        setSessionIds([]);
        setHighlightedId(null);
        setConflictWarning(null);
        setIsRefsOpen(true);
    }, [panelId]);

    useEffect(() => {
        const bump = () => setTick((n) => n + 1);
        const onConflict = (e: Event) => {
            setConflictWarning((e as CustomEvent).detail?.message || CONFLICT_REJECT_MESSAGE);
        };
        const unsub = ConstraintStore.instance.onChange(bump);
        window.addEventListener(SOLVER_PICK_EVENT, bump);
        window.addEventListener('solver-conflict', onConflict);
        window.addEventListener('cad-document-changed', bump);
        return () => {
            unsub();
            window.removeEventListener(SOLVER_PICK_EVENT, bump);
            window.removeEventListener('solver-conflict', onConflict);
            window.removeEventListener('cad-document-changed', bump);
            ConstraintHighlightOverlay.instance.clear();
        };
    }, []);

    void tick;

    const store = ConstraintStore.instance;
    const related = store.constraints.filter(
        (c) => constraintTouchesPanel(c, panelId) || sessionIds.includes(c.id),
    );

    const addRel = (bindType: (typeof ADD_BUTTONS)[number]['bindType']) => {
        setConflictWarning(null);
        const draft = addConstraintDraft(bindType);
        // Tylko bieżący draft — niekompletne poprzednie kasuje addConstraintDraft
        setSessionIds([draft.id]);
        setHighlightedId(draft.id);
        ConstraintHighlightOverlay.instance.setHighlighted([draft.id]);
        if (bindType !== 'GROUND') {
            beginConstraintSlotPick({
                constraintId: draft.id,
                slot: 'A',
                expectedKind: expectedKindForBind(bindType, 'FACE'),
                thenPickB: true,
            });
        }
    };

    return (
        <div
            className={`panel-relations-edit ref-walls-accordion ${isRefsOpen ? 'is-open' : ''}`}
            style={{
                borderRadius: '6px',
                overflow: 'hidden',
                ...(isRefsOpen ? { borderColor: 'rgba(59, 130, 246, 0.55)', boxShadow: '0 0 10px rgba(59, 130, 246, 0.15)' } : {}),
            }}
        >
            <div
                id="sb-accordion-refs"
                onClick={() => setIsRefsOpen(!isRefsOpen)}
                style={{
                    background: '#3b82f6',
                    padding: '8px 10px',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    userSelect: 'none',
                }}
            >
                <span>Ściany odniesienia</span>
                <span style={{ fontSize: '12px', color: '#93c5fd' }}>
                    {isRefsOpen ? '▲' : '▼'}
                </span>
            </div>

            {isRefsOpen && (
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="solver-panel__add-row">
                        {ADD_BUTTONS.filter((btn) => btn.bindType !== 'GROUND').map((btn) => (
                            <button
                                key={btn.bindType}
                                type="button"
                                className="solver-panel__add-btn"
                                title={btn.title}
                                onClick={() => addRel(btn.bindType)}
                            >
                                <span className="solver-panel__add-btn-icon">{btn.icon}</span>
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa' }}>
                        Lista relacji
                    </div>

                    {conflictWarning && (
                        <div className="solver-panel__conflict-alert" role="alert">
                            <span className="solver-panel__conflict-alert-icon" aria-hidden="true">
                                ⚠
                            </span>
                            <span className="solver-panel__conflict-alert-text">{conflictWarning}</span>
                            <button
                                type="button"
                                className="solver-panel__conflict-alert-close"
                                aria-label="Zamknij ostrzeżenie"
                                onClick={() => setConflictWarning(null)}
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {related.length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#71717a', padding: '4px 0' }}>
                            Brak relacji dla tej formatki.
                        </div>
                    ) : (
                        <div className="solver-panel__list" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                            {related.map((c) => (
                                <ConstraintTreeRow
                                    key={c.id}
                                    constraint={c}
                                    document={doc}
                                    highlighted={highlightedId === c.id}
                                    issues={store.getIssues(c.id)}
                                    onHighlight={() => {
                                        const next = highlightedId === c.id ? null : c.id;
                                        setHighlightedId(next);
                                        ConstraintHighlightOverlay.instance.setHighlighted(next ? [next] : []);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
