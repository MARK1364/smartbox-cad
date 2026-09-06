/**
 * Pływające, swobodnie przeciągane okno edycji parametrów operacji oraz formatki na scenie 3D.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import { isPanelModel } from '../A1_core/domain-data.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { updateLibraryOperationParams, isLibraryOperation } from '../o1_operacji/operacje-apply.js';
import { edgeShortLabel } from '../o1_operacji/operacje-placement.js';
import { AssociativeDimInputs } from '../A4_smartpanel/associative-dim-ui.js';
import { nmToMm, mmToNm } from '../A1_core/cad-math/units.js';

export const CAD_OPEN_FLOATING_OPERATION = 'cad-open-floating-operation';
export const CAD_OPEN_FLOATING_PANEL_EDIT = 'cad-open-floating-panel-edit';
export const CAD_CLOSE_FLOATING_OPERATION = 'cad-close-floating-operation';

export interface FloatingOperationData {
    featureId: string;
    panelId: string;
    libraryId?: string;
    face?: string;
}

export interface FloatingPanelData {
    panelId: string;
}

const inputStyle: React.CSSProperties = {
    width: '74px',
    padding: '4px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '4px',
    textAlign: 'right',
    fontSize: '12px',
};

function formatFaceName(rawFace?: string): string {
    if (!rawFace) return 'Zewnętrzna';
    const f = String(rawFace).toUpperCase();
    if (f === 'FACE_Z_MINUS' || f === 'FRONT' || f === 'OUTER' || f === 'ZEWN') return 'Zewnętrzna';
    if (f === 'FACE_Z_PLUS' || f === 'BACK' || f === 'INNER' || f === 'WEWN') return 'Wewnętrzna';
    if (f === 'FACE_X_MINUS' || f === 'LEFT') return 'Bok L';
    if (f === 'FACE_X_PLUS' || f === 'RIGHT') return 'Bok P';
    if (f === 'FACE_Y_MINUS' || f === 'BOTTOM') return 'Dół';
    if (f === 'FACE_Y_PLUS' || f === 'TOP') return 'Góra';
    return rawFace;
}

export const FloatingOperationDialog: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [dialogMode, setDialogMode] = useState<'operation' | 'panel'>('operation');
    const [opData, setOpData] = useState<FloatingOperationData | null>(null);
    const [panelModel, setPanelModel] = useState<any | null>(null);
    const [panelName, setPanelName] = useState<string>('Formatka');
    const [opName, setOpName] = useState<string>('Przetłoczenie / Wycięcie');
    const [isEdgeDims, setIsEdgeDims] = useState(false);

    // Parametry formatki (panel mode)
    const [panelWidthMm, setPanelWidthMm] = useState<number>(600);
    const [panelHeightMm, setPanelHeightMm] = useState<number>(720);
    const [panelThicknessMm, setPanelThicknessMm] = useState<number>(18);

    // Parametry 4 marginesów (L, P, G, D)
    const [insetLMm, setInsetLMm] = useState<number>(60);
    const [insetRMm, setInsetRMm] = useState<number>(60);
    const [insetTMm, setInsetTMm] = useState<number>(60);
    const [insetBMm, setInsetBMm] = useState<number>(60);
    const [depthMm, setDepthMm] = useState<number>(3);

    // Parametry dla rewizji (od krawędzi)
    const [widthMm, setWidthMm] = useState<number>(120);
    const [heightMm, setHeightMm] = useState<number>(80);
    const [uMm, setUMm] = useState<number>(100);
    const [vMm, setVMm] = useState<number>(80);
    const [uEdgeLabel, setUEdgeLabel] = useState<string>('L');
    const [vEdgeLabel, setVEdgeLabel] = useState<string>('Dół');

    // Pozycja okna (domyślnie pod belką główną / widokową)
    const [pos, setPos] = useState<{ x: number; y: number }>(() => {
        const defaultX = typeof window !== 'undefined' ? Math.max(280, Math.round(window.innerWidth / 2 - 140)) : 300;
        return { x: defaultX, y: 96 };
    });
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const loadFeatureData = useCallback((data: FloatingOperationData) => {
        const doc = ContextManager.instance.document;
        if (!doc) return;
        const node = doc.findNode(data.panelId);
        const panel = node?.domainData;
        if (!panel || !isPanelModel(panel)) return;

        setPanelModel(panel);
        setPanelName(panel.name || 'Formatka');
        setPanelWidthMm(Math.round(nmToMm(panel.width) * 10) / 10);
        setPanelHeightMm(Math.round(nmToMm(panel.height) * 10) / 10);
        setPanelThicknessMm(Math.round(nmToMm(panel.thickness) * 10) / 10);

        let feat = (panel.features || []).find((f: any) => f.id === data.featureId);
        if (!feat && data.face) {
            feat = (panel.features || []).find((f: any) => isLibraryOperation(f) && f.face === data.face);
        }
        if (!feat) {
            feat = (panel.features || []).find((f: any) => isLibraryOperation(f));
        }

        if (feat) {
            setOpName(feat.name || 'Przetłoczenie / Wycięcie');
            const p = feat.params || {};
            const isEdge = p.placement === 'edge_dims';
            setIsEdgeDims(isEdge);

            if (isEdge) {
                setWidthMm(Number(p.width) || 120);
                setHeightMm(Number(p.length) || 80);
                setUMm(Number(p.u_ref) || 100);
                setVMm(Number(p.v_ref) || 80);
                setUEdgeLabel(edgeShortLabel(p.u_edge));
                setVEdgeLabel(edgeShortLabel(p.v_edge));
            } else {
                setInsetLMm(Number(p.insets?.l) || 60);
                setInsetRMm(Number(p.insets?.r) || 60);
                setInsetTMm(Number(p.insets?.t) || 60);
                setInsetBMm(Number(p.insets?.b) || 60);
                setDepthMm(Number(p.depth) || 3);
            }
        }
    }, []);

    const loadPanelData = useCallback((panelId: string) => {
        const doc = ContextManager.instance.document;
        if (!doc) return;
        const node = doc.findNode(panelId);
        const panel = node?.domainData;
        if (!panel || !isPanelModel(panel)) return;

        setPanelModel(panel);
        setPanelName(panel.name || 'Formatka');
        setPanelWidthMm(Math.round(nmToMm(panel.width) * 10) / 10);
        setPanelHeightMm(Math.round(nmToMm(panel.height) * 10) / 10);
        setPanelThicknessMm(Math.round(nmToMm(panel.thickness) * 10) / 10);
    }, []);

    useEffect(() => {
        const handleOpenOp = (e: any) => {
            const d = e.detail as FloatingOperationData;
            if (d && d.panelId) {
                setDialogMode('operation');
                setOpData(d);
                loadFeatureData(d);
                setVisible(true);
            }
        };

        const handleOpenPanel = (e: any) => {
            const d = e.detail as FloatingPanelData;
            if (d && d.panelId) {
                setDialogMode('panel');
                loadPanelData(d.panelId);
                setVisible(true);
            }
        };

        const handleClose = () => {
            setVisible(false);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && visible) {
                setVisible(false);
            }
        };

        window.addEventListener(CAD_OPEN_FLOATING_OPERATION, handleOpenOp as EventListener);
        window.addEventListener(CAD_OPEN_FLOATING_PANEL_EDIT, handleOpenPanel as EventListener);
        window.addEventListener(CAD_CLOSE_FLOATING_OPERATION, handleClose);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener(CAD_OPEN_FLOATING_OPERATION, handleOpenOp as EventListener);
            window.removeEventListener(CAD_OPEN_FLOATING_PANEL_EDIT, handleOpenPanel as EventListener);
            window.removeEventListener(CAD_CLOSE_FLOATING_OPERATION, handleClose);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [visible, loadFeatureData, loadPanelData]);

    // Live sync for panel dimensions if changed externally or via associative dims
    useEffect(() => {
        if (!visible || dialogMode !== 'panel' || !panelModel) return;
        const syncDims = () => {
            setPanelWidthMm(Math.round(nmToMm(panelModel.width) * 10) / 10);
            setPanelHeightMm(Math.round(nmToMm(panelModel.height) * 10) / 10);
            setPanelThicknessMm(Math.round(nmToMm(panelModel.thickness) * 10) / 10);
        };
        const doc = ContextManager.instance.document;
        const unsub = doc?.onDocumentChanged?.(syncDims);
        const handlePanelChanged = () => syncDims();
        window.addEventListener('smartbox-panel-changed', handlePanelChanged);
        return () => {
            if (typeof unsub === 'function') unsub();
            window.removeEventListener('smartbox-panel-changed', handlePanelChanged);
        };
    }, [visible, dialogMode, panelModel]);

    const commitOpOverrides = (overrides: any) => {
        if (!opData || !opData.panelId) return;
        const doc = ContextManager.instance.document;
        const node = doc?.findNode(opData.panelId);
        const panel = node?.domainData;
        if (!panel || !isPanelModel(panel)) return;

        const libId = opData.libraryId || (isEdgeDims ? 'rewizja' : 'przetloczenie');
        updateLibraryOperationParams(panel, libId, overrides, opData.face);
    };

    const handlePanelDimChange = (wMm: number, hMm: number, tMm: number) => {
        setPanelWidthMm(wMm);
        setPanelHeightMm(hMm);
        setPanelThicknessMm(tMm);
        if (!panelModel) return;
        panelModel.setDimensions(mmToNm(wMm), mmToNm(hMm), mmToNm(tMm));
        const doc = ContextManager.instance.document;
        doc?.emitChange?.('dimensions');
        window.document.dispatchEvent(new CustomEvent('smartbox-panel-changed', { detail: { panelModel } }));
        window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
        (window as any).__rebuildGeometry?.();
    };

    // Dragging logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT') return;
        isDraggingRef.current = true;
        dragOffsetRef.current = {
            x: e.clientX - pos.x,
            y: e.clientY - pos.y,
        };
        const handleMouseMove = (ev: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const newX = Math.max(10, Math.min(window.innerWidth - 280, ev.clientX - dragOffsetRef.current.x));
            const newY = Math.max(10, Math.min(window.innerHeight - 260, ev.clientY - dragOffsetRef.current.y));
            setPos({ x: newX, y: newY });
        };
        const handleMouseUp = () => {
            isDraggingRef.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    if (!visible) return null;
    if (dialogMode === 'operation' && !opData) return null;
    if (dialogMode === 'panel' && !panelModel) return null;

    return (
        <div
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: '280px',
                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '8px',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65), 0 0 16px rgba(59, 130, 246, 0.25)',
                zIndex: 10000,
                color: '#f4f4f5',
                fontSize: '12px',
                userSelect: 'none',
                overflow: 'hidden',
            }}
        >
            {/* Header (uchwyt do przeciągania) */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'grab',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span style={{ fontSize: '13px', color: '#60a5fa' }}>{dialogMode === 'panel' ? '🪵' : '⚙️'}</span>
                    <strong style={{ fontSize: '12px', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {dialogMode === 'panel' ? `Edycja formatki: ${panelName}` : opName}
                    </strong>
                </div>
                <button
                    type="button"
                    onClick={() => setVisible(false)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#a1a1aa',
                        fontSize: '16px',
                        lineHeight: 1,
                        cursor: 'pointer',
                        padding: '0 4px',
                        borderRadius: '3px',
                    }}
                    title="Zamknij (Esc)"
                >
                    ✕
                </button>
            </div>

            {/* Context Subtitle */}
            <div style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: '#94a3b8' }}>
                {dialogMode === 'panel' ? (
                    <>Formatka: <span style={{ color: '#60a5fa' }}>{panelName}</span> · Wymiary i asocjacje</>
                ) : (
                    <>Formatka: <span style={{ color: '#60a5fa' }}>{panelName}</span> · Strona: <span style={{ color: '#38bdf8' }}>{formatFaceName(opData?.face)}</span></>
                )}
            </div>

            {/* Content Fields */}
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dialogMode === 'panel' ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>Szerokość (W)</span>
                            <SmartNumericInput
                                value={panelWidthMm}
                                min={10}
                                max={3000}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => handlePanelDimChange(val, panelHeightMm, panelThicknessMm)}
                            />
                        </div>
                        {panelModel && (
                            <AssociativeDimInputs panel={panelModel} axis="width" />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ color: '#cbd5e1' }}>Wysokość (H)</span>
                            <SmartNumericInput
                                value={panelHeightMm}
                                min={10}
                                max={3000}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => handlePanelDimChange(panelWidthMm, val, panelThicknessMm)}
                            />
                        </div>
                        {panelModel && (
                            <AssociativeDimInputs panel={panelModel} axis="height" />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ color: '#cbd5e1' }}>Grubość (T)</span>
                            <SmartNumericInput
                                value={panelThicknessMm}
                                min={1}
                                max={100}
                                step={0.5}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => handlePanelDimChange(panelWidthMm, panelHeightMm, val)}
                            />
                        </div>
                    </>
                ) : isEdgeDims ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>Szerokość (W)</span>
                            <SmartNumericInput
                                value={widthMm}
                                min={1}
                                max={Math.max(10, panelWidthMm)}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setWidthMm(val);
                                    commitOpOverrides({ widthMm: val, heightMm, uMm, vMm, depthMm, through: true, fill: 'none' });
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>Wysokość (H)</span>
                            <SmartNumericInput
                                value={heightMm}
                                min={1}
                                max={Math.max(10, panelHeightMm)}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setHeightMm(val);
                                    commitOpOverrides({ widthMm, heightMm: val, uMm, vMm, depthMm, through: true, fill: 'none' });
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>Od {uEdgeLabel}</span>
                            <SmartNumericInput
                                value={uMm}
                                min={0}
                                max={Math.max(0, panelWidthMm - 1)}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setUMm(val);
                                    commitOpOverrides({ widthMm, heightMm, uMm: val, vMm, depthMm, through: true, fill: 'none' });
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>Od {vEdgeLabel}</span>
                            <SmartNumericInput
                                value={vMm}
                                min={0}
                                max={Math.max(0, panelHeightMm - 1)}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setVMm(val);
                                    commitOpOverrides({ widthMm, heightMm, uMm, vMm: val, depthMm, through: true, fill: 'none' });
                                }}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>Margines lewy (L)</span>
                            <SmartNumericInput
                                value={insetLMm}
                                min={0}
                                max={Math.max(0, panelWidthMm - insetRMm - 10)}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setInsetLMm(val);
                                    commitOpOverrides({ insetLMm: val, insetRMm, insetTMm, insetBMm, depthMm, through: false, fill: 'none' });
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>Margines prawy (P)</span>
                            <SmartNumericInput
                                value={insetRMm}
                                min={0}
                                max={Math.max(0, panelWidthMm - insetLMm - 10)}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setInsetRMm(val);
                                    commitOpOverrides({ insetLMm, insetRMm: val, insetTMm, insetBMm, depthMm, through: false, fill: 'none' });
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>Margines góra (G)</span>
                            <SmartNumericInput
                                value={insetTMm}
                                min={0}
                                max={Math.max(0, panelHeightMm - insetBMm - 10)}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setInsetTMm(val);
                                    commitOpOverrides({ insetLMm, insetRMm, insetTMm: val, insetBMm, depthMm, through: false, fill: 'none' });
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>Margines dół (D)</span>
                            <SmartNumericInput
                                value={insetBMm}
                                min={0}
                                max={Math.max(0, panelHeightMm - insetTMm - 10)}
                                step={1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    setInsetBMm(val);
                                    commitOpOverrides({ insetLMm, insetRMm, insetTMm, insetBMm: val, depthMm, through: false, fill: 'none' });
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>Głębokość</span>
                            <SmartNumericInput
                                value={depthMm}
                                min={0.1}
                                max={panelThicknessMm || 50}
                                step={0.1}
                                unit="mm"
                                style={inputStyle}
                                onChange={(val) => {
                                    const clamped = Math.min(val, panelThicknessMm || 50);
                                    setDepthMm(clamped);
                                    commitOpOverrides({ insetLMm, insetRMm, insetTMm, insetBMm, depthMm: clamped, through: false, fill: 'none' });
                                }}
                            />
                        </div>
                    </>
                )}

                {/* Validation Warnings */}
                {dialogMode === 'operation' && (
                    <>
                        {!isEdgeDims && (insetLMm + insetRMm >= panelWidthMm || insetTMm + insetBMm >= panelHeightMm) && (
                            <div style={{ padding: '6px 8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', color: '#fca5a5', fontSize: '11px' }}>
                                ⚠️ Marginesy przekraczają wymiar formatki ({panelWidthMm}×{panelHeightMm} mm)
                            </div>
                        )}
                        {isEdgeDims && (uMm + widthMm > panelWidthMm || vMm + heightMm > panelHeightMm) && (
                            <div style={{ padding: '6px 8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', color: '#fca5a5', fontSize: '11px' }}>
                                ⚠️ Wycięcie wykracza poza obrys formatki ({panelWidthMm}×{panelHeightMm} mm)
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

