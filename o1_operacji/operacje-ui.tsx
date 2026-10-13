/**
 * Zakładka O1 — katalog wcięć i przetłoczeń.
 * Czysta modułowa formuła: rozwijane sekcje (domyślnie zwinięte), 4 niezależne marginesy, autozapis zmian.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import { isPanelModel } from '../A4_smartpanel/panel-model.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { listOperations, getOperation } from './operacje-catalog.js';
import {
    collectPanelsWithLibraryOperation,
    isLibraryOperation,
    updateLibraryOperationParams,
} from './operacje-apply.js';
import { edgeShortLabel } from './operacje-placement.js';
import { OPERACJE_DRAG_MIME, CAD_EDIT_LIBRARY_OPERATION, type OperationRecipe } from './operacje-types.js';
import './operacje-ui.css';

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

function instanceOnPanel(panel: any, libraryId: string, featureId?: string | null, face?: string | null) {
    if (featureId) {
        const byId = panel?.features?.find((f: any) => f.id === featureId);
        if (byId) return byId;
    }
    if (face) {
        const byFace = panel?.features?.find((f: any) => isLibraryOperation(f) && f.params.library_id === libraryId && f.face === face);
        if (byFace) return byFace;
    }
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
    width: '68px',
    padding: '3px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '3px',
    textAlign: 'right',
    fontSize: '12px',
};

/** Proste ikony narzędzi — ten sam język co AGD (stroke + lekki fill). */
function renderOperationIcon(id: string) {
    if (id === 'rewizja') {
        // Duża formatka + mały otwór rewizyjny w rogu (~1/4)
        return (
            <svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="1" y="1" width="16" height="14" rx="1.5" />
                <rect x="10" y="8" width="5.5" height="5" rx="0.6" fill="currentColor" fillOpacity="0.2" />
            </svg>
        );
    }

    // przetloczenie — formatka z wgłębieniem
    return (
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="1" y="1" width="16" height="12" rx="1.5" />
            <rect x="4" y="3.5" width="10" height="7" rx="0.8" fill="currentColor" fillOpacity="0.15" />
            <path d="M4 5.5h10M4 8.5h10" strokeWidth="1" opacity="0.55" />
        </svg>
    );
}

export function OperacjeUI() {
    const recipes = useMemo(() => listOperations(), []);
    // Domyślnie wszystkie sekcje są zwinięte (null)
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string>(recipes[0]?.id || 'przetloczenie');
    const [editPanelId, setEditPanelId] = useState<string | null>(null);
    const [editFeatureId, setEditFeatureId] = useState<string | null>(null);
    const [editFace, setEditFace] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    // Parametry 4 marginesów (L, P, G, D)
    const [insetLMm, setInsetLMm] = useState<number>(60);
    const [insetRMm, setInsetRMm] = useState<number>(60);
    const [insetTMm, setInsetTMm] = useState<number>(60);
    const [insetBMm, setInsetBMm] = useState<number>(60);

    // Głębokość frezowania
    const [depthMm, setDepthMm] = useState<number>(3);

    // Wymiary prostokąta od krawędzi (rewizja)
    const [widthMm, setWidthMm] = useState<number>(120);
    const [heightMm, setHeightMm] = useState<number>(80);
    const [uMm, setUMm] = useState<number>(100);
    const [vMm, setVMm] = useState<number>(80);

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
            if (d.library_id) {
                setSelectedId(String(d.library_id));
                setExpandedId(String(d.library_id));
            }
            if (d.panelId) setEditPanelId(String(d.panelId));
            if (d.featureId) setEditFeatureId(String(d.featureId));
            if (d.face) setEditFace(String(d.face));
        };
        window.addEventListener(CAD_EDIT_LIBRARY_OPERATION, onEdit);
        return () => window.removeEventListener(CAD_EDIT_LIBRARY_OPERATION, onEdit);
    }, []);

    const currentRecipe = recipes.find((r) => r.id === selectedId) || recipes[0];
    const panel = resolveTargetPanel(selectedId, editPanelId);
    const instance = instanceOnPanel(panel, selectedId, editFeatureId, editFace);

    // Synchronizuj stan po zmianie wybranej operacji
    useEffect(() => {
        const target = resolveTargetPanel(selectedId, editPanelId);
        const feat = instanceOnPanel(target, selectedId, editFeatureId, editFace);
        const r = recipes.find((item) => item.id === selectedId);
        if (feat) {
            if (feat.face) setEditFace(feat.face);
            setInsetLMm(Number(feat.params.insets?.l) || 60);
            setInsetRMm(Number(feat.params.insets?.r) || 60);
            setInsetTMm(Number(feat.params.insets?.t) || 60);
            setInsetBMm(Number(feat.params.insets?.b) || 60);
            setDepthMm(Number(feat.params.depth) || 3);
            setWidthMm(Number(feat.params.width) || 120);
            setHeightMm(Number(feat.params.length) || 80);
            setUMm(Number(feat.params.u_ref) || 100);
            setVMm(Number(feat.params.v_ref) || 80);
            return;
        }
        if (r) {
            setInsetLMm(r.insets.l);
            setInsetRMm(r.insets.r);
            setInsetTMm(r.insets.t);
            setInsetBMm(r.insets.b);
            setDepthMm(r.depthMm || 3);
            setWidthMm(r.sizeMm.w);
            setHeightMm(r.sizeMm.h);
            setUMm(r.edge.uMm);
            setVMm(r.edge.vMm);
        }
    }, [selectedId, recipes, editPanelId, editFeatureId, editFace, tick]);

    const getOverrides = (targetRecipe: OperationRecipe) => {
        if (targetRecipe.placement === 'edge_dims') {
            return { widthMm, heightMm, uMm, vMm, depthMm, through: true, fill: 'none' as const };
        }
        return {
            insetLMm,
            insetRMm,
            insetTMm,
            insetBMm,
            depthMm,
            through: targetRecipe.through ?? false,
            fill: (targetRecipe.fill || 'none') as 'none' | 'glass',
        };
    };

    const commit = (next: ReturnType<typeof getOverrides>, targetId = selectedId) => {
        const target = panel || firstInstance(targetId).panel;
        if (!target || !targetId) return;
        const currentFeat = instanceOnPanel(target, targetId, editFeatureId, editFace);
        const targetFace = currentFeat?.face || editFace;
        updateLibraryOperationParams(target, targetId, next, targetFace);
    };

    const toggleAccordion = (id: string) => {
        setSelectedId(id);
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const onDragStart = (e: React.DragEvent, item: OperationRecipe) => {
        const defaultRecipe = getOperation(item.id) || item;
        const dragOverrides = defaultRecipe.placement === 'edge_dims'
            ? {
                widthMm: defaultRecipe.sizeMm.w,
                heightMm: defaultRecipe.sizeMm.h,
                uMm: defaultRecipe.edge.uMm,
                vMm: defaultRecipe.edge.vMm,
                depthMm: defaultRecipe.depthMm,
                through: defaultRecipe.through,
                fill: defaultRecipe.fill,
            }
            : {
                insetLMm: defaultRecipe.insets.l,
                insetRMm: defaultRecipe.insets.r,
                insetTMm: defaultRecipe.insets.t,
                insetBMm: defaultRecipe.insets.b,
                depthMm: defaultRecipe.depthMm,
                through: defaultRecipe.through,
                fill: defaultRecipe.fill,
            };
        const payload = JSON.stringify({ library_id: item.id, ...dragOverrides });
        e.dataTransfer.setData(OPERACJE_DRAG_MIME, payload);
        e.dataTransfer.effectAllowed = 'copy';
        (window as any).__draggedCadOperation = { library_id: item.id, ...dragOverrides };
        setSelectedId(item.id);
    };

    const onDragEnd = () => {
        (window as any).__draggedCadOperation = null;
    };

    return (
        <div className="o1-panel">
            <p className="o1-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                </svg>
                <span>Przeciągnij operację na formatkę 3D lub kliknij, aby edytować parametry.</span>
            </p>

            <div className="o1-tools-row">
                {recipes.map((item) => {
                    const isExpanded = expandedId === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`o1-tool-btn${isExpanded ? ' is-active' : ''}`}
                            draggable
                            onDragStart={(e) => onDragStart(e, item)}
                            onDragEnd={onDragEnd}
                            onClick={() => toggleAccordion(item.id)}
                            title="Przeciągnij na formatkę 3D lub kliknij, aby edytować"
                        >
                            <span className="o1-tool-btn__icon" aria-hidden="true">
                                {renderOperationIcon(item.id)}
                            </span>
                            <span className="o1-tool-btn__name">{item.name}</span>
                        </button>
                    );
                })}
            </div>

            {expandedId && currentRecipe && expandedId === currentRecipe.id && (
                <div className="o1-tool-params">
                    {currentRecipe.placement === 'edge_dims' ? (
                        <>
                            <label className="o1-field">
                                <span>Szerokość (W)</span>
                                <SmartNumericInput
                                    value={widthMm}
                                    min={1}
                                    max={2000}
                                    step={1}
                                    unit="mm"
                                    style={inputStyle}
                                    onChange={(val) => {
                                        setWidthMm(val);
                                        commit({ widthMm: val, heightMm, uMm, vMm, depthMm, through: true, fill: 'none' }, currentRecipe.id);
                                    }}
                                />
                            </label>
                            <label className="o1-field">
                                <span>Wysokość (H)</span>
                                <SmartNumericInput
                                    value={heightMm}
                                    min={1}
                                    max={2000}
                                    step={1}
                                    unit="mm"
                                    style={inputStyle}
                                    onChange={(val) => {
                                        setHeightMm(val);
                                        commit({ widthMm, heightMm: val, uMm, vMm, depthMm, through: true, fill: 'none' }, currentRecipe.id);
                                    }}
                                />
                            </label>
                            <label className="o1-field">
                                <span>Od {edgeShortLabel(instance?.params.u_edge || currentRecipe.edge.uEdge)}</span>
                                <SmartNumericInput
                                    value={uMm}
                                    min={0}
                                    max={2000}
                                    step={1}
                                    unit="mm"
                                    style={inputStyle}
                                    onChange={(val) => {
                                        setUMm(val);
                                        commit({ widthMm, heightMm, uMm: val, vMm, depthMm, through: true, fill: 'none' }, currentRecipe.id);
                                    }}
                                />
                            </label>
                            <label className="o1-field">
                                <span>Od {edgeShortLabel(instance?.params.v_edge || currentRecipe.edge.vEdge)}</span>
                                <SmartNumericInput
                                    value={vMm}
                                    min={0}
                                    max={2000}
                                    step={1}
                                    unit="mm"
                                    style={inputStyle}
                                    onChange={(val) => {
                                        setVMm(val);
                                        commit({ widthMm, heightMm, uMm, vMm: val, depthMm, through: true, fill: 'none' }, currentRecipe.id);
                                    }}
                                />
                            </label>
                        </>
                    ) : (
                        <>
                            <label className="o1-field">
                                <span>Margines lewy (L)</span>
                                <SmartNumericInput
                                    value={insetLMm}
                                    min={0}
                                    max={500}
                                    step={1}
                                    unit="mm"
                                    style={inputStyle}
                                    onChange={(val) => {
                                        setInsetLMm(val);
                                        commit({ insetLMm: val, insetRMm, insetTMm, insetBMm, depthMm, through: currentRecipe.through ?? false, fill: currentRecipe.fill ?? 'none' }, currentRecipe.id);
                                    }}
                                />
                            </label>
                            <label className="o1-field">
                                <span>Margines prawy (P)</span>
                                <SmartNumericInput
                                    value={insetRMm}
                                    min={0}
                                    max={500}
                                    step={1}
                                    unit="mm"
                                    style={inputStyle}
                                    onChange={(val) => {
                                        setInsetRMm(val);
                                        commit({ insetLMm, insetRMm: val, insetTMm, insetBMm, depthMm, through: currentRecipe.through ?? false, fill: currentRecipe.fill ?? 'none' }, currentRecipe.id);
                                    }}
                                />
                            </label>
                            <label className="o1-field">
                                <span>Margines góra (G)</span>
                                <SmartNumericInput
                                    value={insetTMm}
                                    min={0}
                                    max={500}
                                    step={1}
                                    unit="mm"
                                    style={inputStyle}
                                    onChange={(val) => {
                                        setInsetTMm(val);
                                        commit({ insetLMm, insetRMm, insetTMm: val, insetBMm, depthMm, through: currentRecipe.through ?? false, fill: currentRecipe.fill ?? 'none' }, currentRecipe.id);
                                    }}
                                />
                            </label>
                            <label className="o1-field">
                                <span>Margines dół (D)</span>
                                <SmartNumericInput
                                    value={insetBMm}
                                    min={0}
                                    max={500}
                                    step={1}
                                    unit="mm"
                                    style={inputStyle}
                                    onChange={(val) => {
                                        setInsetBMm(val);
                                        commit({ insetLMm, insetRMm, insetTMm, insetBMm: val, depthMm, through: currentRecipe.through ?? false, fill: currentRecipe.fill ?? 'none' }, currentRecipe.id);
                                    }}
                                />
                            </label>
                            <label className="o1-field">
                                <span>Głębokość</span>
                                <SmartNumericInput
                                    value={depthMm}
                                    min={0.1}
                                    max={50}
                                    step={0.1}
                                    unit="mm"
                                    style={inputStyle}
                                    onChange={(val) => {
                                        setDepthMm(val);
                                        commit({ insetLMm, insetRMm, insetTMm, insetBMm, depthMm: val, through: currentRecipe.through ?? false, fill: currentRecipe.fill ?? 'none' }, currentRecipe.id);
                                    }}
                                />
                            </label>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
