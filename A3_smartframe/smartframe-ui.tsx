import React, { useState, useEffect, useCallback } from 'react';
import {
    getActiveContainer,
    calcTopHeight,
    createNewKorpus,
    applyRealtimeUpdate
} from './smartframe-adapter.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { nmToMm } from '../A1_core/cad-math/units.js';

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
    const [backOffset,   setBackOffset]   = useState(10);

    const topHeight = calcTopHeight(height, zoneCount, bottomHeight, middleHeight);

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
            if (p.zoneCount    !== undefined) setZoneCount(Number(p.zoneCount) as 1|2|3);
            if (p.bottomHeight !== undefined) setBottomHeight(p.bottomHeight);
            if (p.middleHeight !== undefined) setMiddleHeight(p.middleHeight);
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
    const onZone   = (v: 1|2|3) => { setZoneCount(v); triggerRealtime(width, height, depth, v, bottomHeight, middleHeight, backOffset); };
    const onHB     = (v: number) => { setBottomHeight(v); triggerRealtime(width, height, depth, zoneCount, v, middleHeight, backOffset); };
    const onHM     = (v: number) => { setMiddleHeight(v); triggerRealtime(width, height, depth, zoneCount, bottomHeight, v, backOffset); };
    const onPO     = (v: number) => { setBackOffset(v);   triggerRealtime(width, height, depth, zoneCount, bottomHeight, middleHeight, v); };

    const handleGenerate = () => {
        createNewKorpus(projectModel, {
            width,
            height,
            depth,
            zoneCount,
            bottomHeight,
            middleHeight,
            backOffset
        });
    };

    // ── JSX ───────────────────────────────────────────────────────────────
    return (
        <div>
            <div className="panel-header">
                <h2>SmartFrame</h2>
                <p className="subtitle">Korpus mebla</p>
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
                <InputRow label="Offset Pleców" value={backOffset} min={0}   max={500}  onChange={onPO}    />
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

            {/* Przycisk */}
            <div className="panel-section">
                <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={handleGenerate}
                >
                    <svg style={{ marginRight: 8 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    </svg>
                    Utwórz Korpus
                </button>
            </div>
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
