import React, { useState, useEffect, useCallback } from 'react';
import {
    getActiveContainer,
    calcTopHeight,
    applyRealtimeUpdate
} from './smartframe-adapter.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { SmartFrameDragController } from './smartframe-drag-controller.js';

interface Props {
    projectModel: any;
}

export function SmartFrameUI({ projectModel }: Props) {
    const [width,        setWidth]        = useState(1000);
    const [height,       setHeight]       = useState(2200);
    const [depth,        setDepth]        = useState(600);
    const [zoneCount,    setZoneCount]    = useState<1|2|3>(3);
    const [bottomHeight, setBottomHeight] = useState(500);
    const [middleHeight, setMiddleHeight] = useState(1200);
    const [backOffset,   setBackOffset]   = useState(3);

    const topHeight = calcTopHeight(height, zoneCount, bottomHeight, middleHeight);

    const getDragController = (): SmartFrameDragController => {
        if (!ContextManager.instance.smartFrameDragController) {
            ContextManager.instance.smartFrameDragController = new SmartFrameDragController();
        }
        return ContextManager.instance.smartFrameDragController;
    };

    const getSensibleHeights = (zc: 1 | 2 | 3, curH: number, curHB: number, curHM: number) => {
        let bH = curHB;
        let mH = curHM;
        if (zc === 1) {
            bH = curH;
            mH = 0;
        } else if (zc === 2) {
            if (bH >= curH || bH <= 0) {
                bH = Math.round(curH / 2);
            }
            mH = 0;
        } else if (zc === 3) {
            if (bH + mH >= curH || bH <= 0 || mH <= 0 || bH >= curH) {
                bH = 500;
                mH = 1200;
                if (bH + mH >= curH) {
                    bH = Math.round(curH * 0.25);
                    mH = Math.round(curH * 0.55);
                }
            }
        }
        return { bH, mH };
    };

    const handleDragStart = (zc: 1 | 2 | 3, e: React.DragEvent) => {
        const { bH, mH } = getSensibleHeights(zc, height, bottomHeight, middleHeight);
        const dragCtrl = getDragController();
        dragCtrl.startDrag(zc, {
            width,
            height,
            depth,
            bottomHeight: bH,
            middleHeight: mH,
            backOffset
        });
        try {
            e.dataTransfer.setData('application/cad-korpus', JSON.stringify({ zoneCount: zc }));
            e.dataTransfer.effectAllowed = 'copy';
        } catch { /* ignoruj */ }
    };

    const handleDragEnd = () => {
        const dragCtrl = getDragController();
        dragCtrl.endDrag();
    };

    // ── Sync formularza gdy zmienia się activeEntity ──────────────────────
    useEffect(() => {
        if (!projectModel) return;

        const sync = () => {
            const container = getActiveContainer(projectModel);
            if (!container) return;

            const w = Math.round(nmToMm(container.width));
            const h = Math.round(nmToMm(container.height));
            const d = Math.round(nmToMm(container.depth));
            setWidth(w);
            setHeight(h);
            setDepth(d);

            const p = container.generatorParams || {};
            const zc = p.zoneCount !== undefined ? (Number(p.zoneCount) as 1|2|3) : 3;
            setZoneCount(zc);
            if (zc >= 2 && p.bottomHeight !== undefined && p.bottomHeight < h) {
                setBottomHeight(p.bottomHeight);
            }
            if (zc === 3 && p.middleHeight !== undefined && p.middleHeight > 0) {
                setMiddleHeight(p.middleHeight);
            }
            if (p.backOffset   !== undefined) setBackOffset(p.backOffset);
        };

        const unsub = projectModel?.onDocumentChanged ? projectModel.onDocumentChanged(sync) : (projectModel?.onChange ? projectModel.onChange(sync) : null);
        sync(); // pierwsze uruchomienie

        return () => {
            if (typeof unsub === 'function') unsub();
            else if (projectModel?.offChange) projectModel.offChange(sync);
        };
    }, [projectModel]);

    // ── Pomocnik do wywoływania update w czasie rzeczywistym ───────────────
    const triggerRealtime = useCallback((
        w: number, h: number, d: number,
        zc: 1|2|3, hB: number, hM: number, po: number
    ) => {
        applyRealtimeUpdate(projectModel, {
            width: w,
            height: h,
            depth: d,
            zoneCount: zc,
            bottomHeight: hB,
            middleHeight: hM,
            backOffset: po
        });
    }, [projectModel]);

    // ── Handlery inputów (update realtime + state) ────────────────────────
    const onWidth  = (v: number) => { setWidth(v);  triggerRealtime(v, height, depth, zoneCount, bottomHeight, middleHeight, backOffset); };
    const onHeight = (v: number) => { setHeight(v); triggerRealtime(width, v, depth, zoneCount, bottomHeight, middleHeight, backOffset); };
    const onDepth  = (v: number) => { setDepth(v);  triggerRealtime(width, height, v, zoneCount, bottomHeight, middleHeight, backOffset); };
    const onZone   = (v: 1|2|3) => {
        const { bH, mH } = getSensibleHeights(v, height, bottomHeight, middleHeight);
        setZoneCount(v);
        if (v !== 1) {
            setBottomHeight(bH);
            setMiddleHeight(mH);
        }
        triggerRealtime(width, height, depth, v, bH, mH, backOffset);
    };
    const onHB     = (v: number) => { setBottomHeight(v); triggerRealtime(width, height, depth, zoneCount, v, middleHeight, backOffset); };
    const onHM     = (v: number) => { setMiddleHeight(v); triggerRealtime(width, height, depth, zoneCount, bottomHeight, v, backOffset); };

    // ── JSX ───────────────────────────────────────────────────────────────
    return (
        <div>
            <div className="panel-header">
                <h2>SmartFrame</h2>
                <p className="subtitle">Korpus mebla</p>
            </div>

            {/* Trzy ikony przeciągania na scenę (1 strefa, 2 strefy, 3 strefy) */}
            <div className="panel-section" style={{ borderBottom: '1px solid var(--border-color, #333)', paddingBottom: '12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary, #ddd)' }}>
                    Wstaw Korpus (Przeciągnij na scenę)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {/* Karta 1: 1 Strefa */}
                    <div
                        className="zone-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(1, e)}
                        onDragEnd={handleDragEnd}
                        title="Przeciągnij na scenę 3D, aby wstawić korpus 1-strefowy"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px',
                            background: 'var(--bg-secondary, #252528)',
                            border: '1px solid var(--border-color, #3a3a3e)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                        }}
                    >
                        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                            <rect x="2" y="2" width="28" height="38" rx="1" stroke="currentColor" />
                            <rect x="5" y="5" width="22" height="32" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                            <span className="hand-icon" title="Chwyć i przeciągnij na scenę 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                1 Strefa
                            </span>
                        </div>
                    </div>

                    {/* Karta 2: 2 Strefy */}
                    <div
                        className="zone-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(2, e)}
                        onDragEnd={handleDragEnd}
                        title="Przeciągnij na scenę 3D, aby wstawić korpus 2-strefowy"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px',
                            background: 'var(--bg-secondary, #252528)',
                            border: '1px solid var(--border-color, #3a3a3e)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                        }}
                    >
                        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                            <rect x="2" y="2" width="28" height="38" rx="1" stroke="currentColor" />
                            <line x1="2" y1="21" x2="30" y2="21" stroke="currentColor" strokeWidth="2.5" />
                            <rect x="5" y="24" width="22" height="13" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
                            <rect x="5" y="5" width="22" height="13" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                            <span className="hand-icon" title="Chwyć i przeciągnij na scenę 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                2 Strefy
                            </span>
                        </div>
                    </div>

                    {/* Karta 3: 3 Strefy */}
                    <div
                        className="zone-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(3, e)}
                        onDragEnd={handleDragEnd}
                        title="Przeciągnij na scenę 3D, aby wstawić korpus 3-strefowy"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px',
                            background: 'var(--bg-secondary, #252528)',
                            border: '1px solid var(--border-color, #3a3a3e)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                        }}
                    >
                        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                            <rect x="2" y="2" width="28" height="38" rx="1" stroke="currentColor" />
                            <line x1="2" y1="27" x2="30" y2="27" stroke="currentColor" strokeWidth="2.5" />
                            <line x1="2" y1="15" x2="30" y2="15" stroke="currentColor" strokeWidth="2.5" />
                            <rect x="5" y="30" width="22" height="7" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
                            <rect x="5" y="18" width="22" height="7" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
                            <rect x="5" y="5" width="22" height="7" rx="0.5" fill="currentColor" fillOpacity="0.08" stroke="none" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                            <span className="hand-icon" title="Chwyć i przeciągnij na scenę 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                3 Strefy
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Parametry główne */}
            <div className="panel-section">
                <h3>Parametry Korpusu</h3>

                <div className="input-row">
                    <label>Typ mebla</label>
                    <select defaultValue="KORPUS3">
                        <option value="KORPUS3">Korpus 3</option>
                    </select>
                </div>

                <div className="input-row">
                    <label>Liczba stref</label>
                    <select
                        value={zoneCount}
                        onChange={e => onZone(Number(e.target.value) as 1|2|3)}
                    >
                        <option value={1}>1 (pojedynczy)</option>
                        <option value={2}>2 (podwójny)</option>
                        <option value={3}>3 (potrójny)</option>
                    </select>
                </div>

                <InputRow label="Szerokość"    value={width}      min={150} max={4000} onChange={onWidth}  />
                <InputRow label="Wysokość"     value={height}     min={150} max={4000} onChange={onHeight} />
                <InputRow label="Głębokość"    value={depth}      min={150} max={4000} onChange={onDepth}  />
            </div>

            {/* Wysokości stref — widoczne tylko gdy zoneCount >= 2 */}
            {zoneCount >= 2 && (
                <div className="panel-section">
                    <h3>Wysokości Stref</h3>
                    <InputRow label="Wysokość dołu"   value={bottomHeight} min={50} max={3000} onChange={onHB} />
                    {zoneCount === 3 && (
                        <InputRow label="Wysokość środka" value={middleHeight} min={50} max={3000} onChange={onHM} />
                    )}
                    <div className="input-row">
                        <label>Wysokość góry</label>
                        <input
                            type="number"
                            value={topHeight}
                            readOnly
                            disabled
                        />
                        <span className="unit">mm</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Pomocniczy komponent InputRow z użyciem uniwersalnego SmartNumericInput ──────
interface InputRowProps {
    label: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (v: number) => void;
}

function InputRow({ label, value, min = 0, max = 5000, onChange }: InputRowProps) {
    return (
        <div className="input-row">
            <label>{label}</label>
            <SmartNumericInput
                value={value}
                min={min}
                max={max}
                step={1}
                onChange={onChange}
            />
            <span className="unit">mm</span>
        </div>
    );
}
