/**
 * Zakładka O1 — katalog wcięć. Przeciągnij na ścianę płyty albo zastosuj do aktywnej formatki.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import { isPanelModel } from '../A1_core/domain-data.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { listOperations } from './operacje-catalog.js';
import {
    applyLibraryOperation,
    collectPanelsWithLibraryOperation,
    isLibraryOperation,
    updateLibraryOperationParams,
} from './operacje-apply.js';
import { OPERACJE_DRAG_MIME, CAD_EDIT_LIBRARY_OPERATION } from './operacje-types.js';
import { edgeShortLabel } from './operacje-placement.js';
import type { OperationRecipe } from './operacje-types.js';
import './operacje-ui.css';

function kindLabel(recipe: OperationRecipe): string {
    if (recipe.placement === 'edge_dims') {
        return `Prostokąt ${Math.round(recipe.sizeMm.w)}×${Math.round(recipe.sizeMm.h)} · od krawędzi`;
    }
    if (recipe.fill === 'glass') return 'Na wylot · szkło';
    if (recipe.through) return 'Na wylot';
    const frame = Math.round(recipe.insets.l);
    return `Ramka ${frame} mm · gł. ${recipe.depthMm} mm`;
}

function resolveActivePanel() {
    const ae = ContextManager.instance.document?.activeEntity;
    if (ae && isPanelModel(ae)) return ae;
    return null;
}

function resolveTargetPanel(libraryId: string, editPanelId?: string | null) {
    const doc = ContextManager.instance.document;
    if (editPanelId && doc?.findNode) {
        const node = doc.findNode(editPanelId);
        const fromId = node?.domainData;
        if (fromId && isPanelModel(fromId)) return fromId;
    }
    const ae = resolveActivePanel();
    if (ae) return ae;
    return firstInstance(libraryId).panel || null;
}

function instanceOnPanel(panel: any, libraryId: string) {
    return panel?.features?.find((f: any) => isLibraryOperation(f) && f.params.library_id === libraryId) || null;
}

function firstInstance(libraryId: string) {
    const doc = ContextManager.instance.document;
    const panels = collectPanelsWithLibraryOperation(doc, libraryId);
    const panel = panels[0];
    const feat = panel?.features?.find((f: any) => isLibraryOperation(f) && f.params.library_id === libraryId);
    return { panel, feat };
}

const inputStyle: React.CSSProperties = {
    width: '72px',
    padding: '3px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '3px',
    textAlign: 'right',
};

export function OperacjeUI() {
    const recipes = useMemo(() => listOperations(), []);
    const [selectedId, setSelectedId] = useState<string>(recipes[0]?.id || '');
    const [frameMm, setFrameMm] = useState<number>(recipes[0]?.insets.l ?? 60);
    const [frameHMm, setFrameHMm] = useState<number>(recipes[0]?.insets.b ?? 60);
    const [depthMm, setDepthMm] = useState<number>(recipes[0]?.depthMm ?? 6);
    const [widthMm, setWidthMm] = useState<number>(120);
    const [heightMm, setHeightMm] = useState<number>(80);
    const [uMm, setUMm] = useState<number>(100);
    const [vMm, setVMm] = useState<number>(80);
    const [editPanelId, setEditPanelId] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const doc = ContextManager.instance.document;
        const bump = () => setTick((t) => t + 1);
        const off = doc?.onDocumentChanged?.(bump);
        return () => {
            if (typeof off === 'function') off();
        };
    }, []);

    useEffect(() => {
        const onEdit = (e: Event) => {
            const d = (e as CustomEvent).detail || {};
            if (d.library_id) setSelectedId(String(d.library_id));
            if (d.panelId) setEditPanelId(String(d.panelId));
        };
        window.addEventListener(CAD_EDIT_LIBRARY_OPERATION, onEdit);
        return () => window.removeEventListener(CAD_EDIT_LIBRARY_OPERATION, onEdit);
    }, []);

    const recipe = recipes.find((r) => r.id === selectedId) || recipes[0];
    const isEdgeDims = recipe?.placement === 'edge_dims';
    const panel = resolveTargetPanel(selectedId, editPanelId);
    const instance = instanceOnPanel(panel, selectedId);
    const through = !!(instance?.params.through ?? recipe?.through);

    useEffect(() => {
        const target = resolveTargetPanel(selectedId, editPanelId);
        const feat = instanceOnPanel(target, selectedId);
        const r = recipes.find((item) => item.id === selectedId);
        if (feat) {
            setFrameMm(Number(feat.params.insets?.l) || 60);
            setFrameHMm(Number(feat.params.insets?.b) || Number(feat.params.insets?.t) || 60);
            setDepthMm(Number(feat.params.depth) || 6);
            setWidthMm(Number(feat.params.width) || 120);
            setHeightMm(Number(feat.params.length) || 80);
            setUMm(Number(feat.params.u_ref) || 100);
            setVMm(Number(feat.params.v_ref) || 80);
            return;
        }
        if (r) {
            setFrameMm(r.insets.l);
            setFrameHMm(r.insets.b);
            setDepthMm(r.depthMm || 6);
            setWidthMm(r.sizeMm.w);
            setHeightMm(r.sizeMm.h);
            setUMm(r.edge.uMm);
            setVMm(r.edge.vMm);
        }
    }, [selectedId, recipes, editPanelId, tick]);

    const overrides = isEdgeDims
        ? { widthMm, heightMm, uMm, vMm, depthMm }
        : { frameWMm: frameMm, frameHMm, depthMm };

    const commit = (next: typeof overrides) => {
        const target = panel || firstInstance(selectedId).panel;
        if (!target || !selectedId) return;
        updateLibraryOperationParams(target, selectedId, next, instance?.face);
    };

    const onDragStart = (e: React.DragEvent, item: OperationRecipe) => {
        const dragOverrides = item.id === selectedId
            ? overrides
            : item.placement === 'edge_dims'
                ? { widthMm: item.sizeMm.w, heightMm: item.sizeMm.h, uMm: item.edge.uMm, vMm: item.edge.vMm, depthMm: item.depthMm }
                : { frameWMm: item.insets.l, frameHMm: item.insets.b, depthMm: item.depthMm };
        const payload = JSON.stringify({ library_id: item.id, ...dragOverrides });
        e.dataTransfer.setData(OPERACJE_DRAG_MIME, payload);
        e.dataTransfer.effectAllowed = 'copy';
        (window as any).__draggedCadOperation = { library_id: item.id, ...dragOverrides };
        setSelectedId(item.id);
    };

    const onDragEnd = () => {
        (window as any).__draggedCadOperation = null;
    };

    const onApply = () => {
        const target = panel || firstInstance(selectedId).panel;
        if (!target || !selectedId) return;
        applyLibraryOperation(target, selectedId, instance?.face, overrides);
        setEditPanelId(target.id);
    };

    const onFrameChange = (val: number) => {
        setFrameMm(val);
        commit({ frameWMm: val, frameHMm, depthMm });
    };

    const onFrameHChange = (val: number) => {
        setFrameHMm(val);
        commit({ frameWMm: frameMm, frameHMm: val, depthMm });
    };

    const onDepthChange = (val: number) => {
        setDepthMm(val);
        if (through) return;
        if (isEdgeDims) commit({ widthMm, heightMm, uMm, vMm, depthMm: val });
        else commit({ frameWMm: frameMm, frameHMm, depthMm: val });
    };

    return (
        <div className="o1-panel">
            <p className="o1-hint">
                {isEdgeDims
                    ? 'Rewizja: przeciągnij kółko na końcu linii do krawędzi formatki. Wymiar liczy się do środka.'
                    : 'Przeciągnij na ścianę płyty. W drzewie ramka jest operacją Smart; wpust silnika jest wyszarzony.'}
            </p>
            <div className="o1-list">
                {recipes.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        draggable
                        className={`o1-item${selectedId === item.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedId(item.id)}
                        onDragStart={(e) => onDragStart(e, item)}
                        onDragEnd={onDragEnd}
                    >
                        <span className="o1-item__name">{item.name}</span>
                        <span className="o1-item__meta">{kindLabel(item)}</span>
                    </button>
                ))}
            </div>

            <div className="o1-box">
                <div className="o1-box__title">Parametry wcięcia</div>
                {isEdgeDims ? (
                    <>
                        <label className="o1-field">
                            <span>Szerokość</span>
                            <SmartNumericInput
                                value={widthMm}
                                min={1}
                                max={2000}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setWidthMm(val);
                                    commit({ widthMm: val, heightMm, uMm, vMm, depthMm });
                                }}
                            />
                        </label>
                        <label className="o1-field">
                            <span>Wysokość</span>
                            <SmartNumericInput
                                value={heightMm}
                                min={1}
                                max={2000}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setHeightMm(val);
                                    commit({ widthMm, heightMm: val, uMm, vMm, depthMm });
                                }}
                            />
                        </label>
                        <label className="o1-field">
                            <span>Od {edgeShortLabel(instance?.params.u_edge || recipe.edge.uEdge)}</span>
                            <SmartNumericInput
                                value={uMm}
                                min={0}
                                max={2000}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setUMm(val);
                                    commit({ widthMm, heightMm, uMm: val, vMm, depthMm });
                                }}
                            />
                        </label>
                        <label className="o1-field">
                            <span>Od {edgeShortLabel(instance?.params.v_edge || recipe.edge.vEdge)}</span>
                            <SmartNumericInput
                                value={vMm}
                                min={0}
                                max={2000}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setVMm(val);
                                    commit({ widthMm, heightMm, uMm, vMm: val, depthMm });
                                }}
                            />
                        </label>
                    </>
                ) : (
                    <>
                        <label className="o1-field">
                            <span>Szerokość ramki</span>
                            <SmartNumericInput
                                value={frameMm}
                                min={1}
                                max={500}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={onFrameChange}
                            />
                        </label>
                        <label className="o1-field">
                            <span>Wysokość ramki</span>
                            <SmartNumericInput
                                value={frameHMm}
                                min={1}
                                max={500}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={onFrameHChange}
                            />
                        </label>
                    </>
                )}
                <label className="o1-field">
                    <span>Głębokość</span>
                    <SmartNumericInput
                        value={depthMm}
                        min={0.1}
                        max={50}
                        step={0.1}
                        unit="mm"
                        disabled={through}
                        style={inputStyle}
                        onChange={onDepthChange}
                    />
                </label>
                {through && (
                    <p className="o1-hint">Na wylot — głębokość = grubość płyty.</p>
                )}
            </div>

            {!panel && !instance && (
                <p className="o1-empty">Zaznacz formatkę w scenie lub drzewie.</p>
            )}
            <button
                type="button"
                className="o1-btn"
                disabled={!panel && !instance}
                onClick={onApply}
            >
                Zastosuj do aktywnej płyty
            </button>
        </div>
    );
}
