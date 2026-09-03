import React, { useEffect, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import {
    applyAssociativeDim,
    emptyAssocDim,
    isAssocComplete,
    measureAssocDimMm,
    planeRefLabel,
    type AssocAxis,
    type AssociativeDim,
    type AssocPlaneRef,
} from './associative-dim.js';
import type { PanelModel } from './panel-model.js';

interface Props {
    panel: PanelModel;
    axis: AssocAxis;
}

function persist(panel: PanelModel, axis: AssocAxis, next: AssociativeDim | null) {
    panel.associativeDims = {
        ...(panel.associativeDims || {}),
        [axis]: next,
    };
    const doc = ContextManager.instance.document;
    let resized = false;
    if (doc && isAssocComplete(next)) {
        resized = applyAssociativeDim(doc, panel, axis);
    }
    doc?.emitChange?.('dimensions');
    window.document.dispatchEvent(new CustomEvent('smartbox-panel-changed', { detail: { panelModel: panel } }));
    if (resized) {
        (ContextManager.instance as any)?.solverController?.solveNow?.();
    }
}

export function AssociativeDimInputs({ panel, axis }: Props) {
    const [tick, setTick] = useState(0);
    const [pickingSlot, setPickingSlot] = useState<'A' | 'B' | null>(null);
    const dim: AssociativeDim = panel.associativeDims?.[axis] || emptyAssocDim();
    const doc = ContextManager.instance.document;
    const distanceMm = measureAssocDimMm(doc, dim);
    const axisLabel = axis === 'width' ? 'szerokości' : 'wysokości';
    const rootId = axis === 'width' ? 'plaszczyzny-szerokosci' : 'plaszczyzny-wysokosci';

    useEffect(() => {
        const unsub = doc?.onDocumentChanged?.(() => setTick((n) => n + 1));
        return () => {
            if (typeof unsub === 'function') unsub();
            if (ContextManager.instance.activeReferencePicker?.source === `assoc-${panel.id}-${axis}`) {
                delete ContextManager.instance.activeReferencePicker;
            }
        };
    }, [doc, panel.id, axis]);

    void tick;

    const stopPick = () => {
        setPickingSlot(null);
        delete ContextManager.instance.activeReferencePicker;
        const picker = ContextManager.instance.facePicker as any;
        if (picker?.resetAllFaceHighlights) picker.resetAllFaceHighlights();
        else if (picker?.clearSelection) picker.clearSelection();
        ContextManager.instance.appAPI?.setSelectionMode?.('object');
        ContextManager.instance.appAPI?.setStatus?.('Gotowy');
    };

    const startPick = (slot: 'A' | 'B') => {
        if (pickingSlot === slot) {
            stopPick();
            return;
        }
        const picker = ContextManager.instance.facePicker as any;
        if (picker?.resetAllFaceHighlights) picker.resetAllFaceHighlights();
        else if (picker?.clearSelection) picker.clearSelection();
        setPickingSlot(slot);
        ContextManager.instance.appAPI?.setSelectionMode?.('subgeometry');
        ContextManager.instance.appAPI?.setStatus?.(
            `Wskaż płaszczyznę ${slot} dla ${axisLabel}…`,
            true,
        );
        ContextManager.instance.activeReferencePicker = {
            source: `assoc-${panel.id}-${axis}`,
            onSelect: (refData: { nodeId?: string; face?: string; panelModel?: any; partKey?: string }) => {
                const nodeId = refData.nodeId || refData.panelModel?.id;
                const face = refData.face;
                if (!nodeId || !face) return;
                const ref: AssocPlaneRef = {
                    nodeId,
                    face,
                    label: refData.panelModel?.name || refData.partKey || nodeId,
                };
                const current = panel.associativeDims?.[axis] || emptyAssocDim();
                const next: AssociativeDim = {
                    ...current,
                    [slot === 'A' ? 'planeA' : 'planeB']: ref,
                };
                persist(panel, axis, next);
                stopPick();
                if (!isAssocComplete(next)) {
                    startPick(slot === 'A' ? 'B' : 'A');
                } else {
                    const mm = measureAssocDimMm(ContextManager.instance.document, next);
                    ContextManager.instance.appAPI?.setStatus?.(
                        `Przypisano ${axisLabel}: ${mm != null ? `${mm.toFixed(1)} mm` : 'brak odległości'}`,
                    );
                }
            },
        };
    };

    const clear = () => {
        stopPick();
        persist(panel, axis, emptyAssocDim());
    };

    const setOffset = (raw: string) => {
        const current = panel.associativeDims?.[axis] || emptyAssocDim();
        const offsetMm = raw === '-' || raw === '' || raw === '.' ? current.offsetMm : (parseFloat(raw) || 0);
        persist(panel, axis, { ...current, offsetMm });
    };

    const renderSlot = (slot: 'A' | 'B', ref: AssocPlaneRef | null) => {
        const picking = pickingSlot === slot;
        return (
            <button
                type="button"
                className={`assoc-dim-plane${picking ? ' assoc-dim-plane--picking' : ''}${ref ? ' assoc-dim-plane--set' : ''}`}
                onClick={() => startPick(slot)}
                title={picking ? 'Kliknij ścianę w 3D (Esc anuluje)' : `Płaszczyzna ${slot} — wskaż w 3D`}
            >
                {picking ? `Wskaż ${slot}…` : planeRefLabel(ref)}
            </button>
        );
    };

    return (
        <div id={rootId} className="assoc-dim" data-ui-name={`Płaszczyzny ${axisLabel}`}>
            <div className="assoc-dim-planes">
                {renderSlot('A', dim.planeA)}
                {renderSlot('B', dim.planeB)}
                <button
                    type="button"
                    className="assoc-dim-clear"
                    title="Wyczyść płaszczyzny"
                    onClick={clear}
                    disabled={!dim.planeA && !dim.planeB}
                >
                    ✕
                </button>
            </div>
            <div className="assoc-dim-length">
                {distanceMm != null ? (
                    <>
                        <span>Odległość: <strong>{distanceMm.toFixed(1)} mm</strong></span>
                        <label className="assoc-dim-offset">
                            Offset
                            <input
                                type="number"
                                step="0.1"
                                value={dim.offsetMm || 0}
                                onChange={(e) => setOffset(e.target.value)}
                            />
                            <span>mm</span>
                        </label>
                    </>
                ) : (
                    <span className="assoc-dim-hint">Wskaż dwie płaszczyzny — odległość stanie się {axisLabel}ą płyty</span>
                )}
            </div>
        </div>
    );
}
