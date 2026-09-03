/**
 * solver-ui.tsx — narzędzia więzów. Lista relacji jest w drzewie (zakładka Relacje).
 */

import React, { useEffect, useState } from 'react';
import { addConstraintWithPick } from './constraint-pick-flow.js';
import { stopConstraintPick } from './constraint-picker.js';
import { ConstraintHighlightOverlay } from './constraint-highlight.js';
import {
    ADD_BUTTONS,
    CONFLICT_REJECT_MESSAGE,
    SOLVER_PANEL_TITLE,
} from './solver-ui-config.js';
import {
    getSolverShowOnlySmartFrame,
    setSolverShowOnlySmartFrame,
} from './solver-visibility.js';
import './solver-ui.css';

interface Props {
    projectModel: any;
}

export function SolverUI({ projectModel }: Props) {
    void projectModel;
    const [showOnlySmartFrame, setShowOnlySmartFrame] = useState(getSolverShowOnlySmartFrame);
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);

    useEffect(() => {
        const onVis = () => setShowOnlySmartFrame(getSolverShowOnlySmartFrame());
        const onConflict = (e: Event) => {
            const message = (e as CustomEvent).detail?.message || CONFLICT_REJECT_MESSAGE;
            setConflictWarning(message);
        };
        window.addEventListener('solver-visibility-changed', onVis);
        window.addEventListener('solver-conflict', onConflict);
        return () => {
            window.removeEventListener('solver-visibility-changed', onVis);
            window.removeEventListener('solver-conflict', onConflict);
            stopConstraintPick();
            ConstraintHighlightOverlay.instance.clear();
        };
    }, []);

    const toggleSmartFrameOnly = (checked: boolean) => {
        setShowOnlySmartFrame(checked);
        setSolverShowOnlySmartFrame(checked);
        window.dispatchEvent(new Event('cad-document-changed'));
    };

    return (
        <div className="solver-panel">
            <div className="solver-panel__toolbar">
                <label className="solver-panel__checkbox">
                    <input
                        type="checkbox"
                        checked={showOnlySmartFrame}
                        onChange={(e) => toggleSmartFrameOnly(e.target.checked)}
                    />
                    Pokaż tylko SmartFrame
                    <span className="solver-panel__checkbox-hint" title="Przyciemnia panele; podczas pipety 🎯 panele wracają na pełną widoczność">
                        (panele zostają klikalne)
                    </span>
                </label>

                <div className="solver-panel__add-row">
                    {ADD_BUTTONS.map((btn) => (
                        <button
                            key={btn.bindType}
                            type="button"
                            className="solver-panel__add-btn"
                            title={btn.title}
                            onClick={() => {
                                setConflictWarning(null);
                                addConstraintWithPick(btn.bindType);
                            }}
                        >
                            <span className="solver-panel__add-btn-icon">{btn.icon}</span>
                            {btn.label}
                        </button>
                    ))}
                </div>

                <p className="solver-panel__tools-hint">
                    Relacje lądują w drzewie obiektów — zakładka Relacje. Po dodaniu wskaż elementy w 3D.
                </p>
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
        </div>
    );
}

export { SOLVER_PANEL_TITLE };
