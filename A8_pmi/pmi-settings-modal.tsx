import React, { useEffect, useState } from 'react';
import { PMIStore, UnitMode } from './pmi-data.js';
import { ClearDimensionsCommand, executePMICommand } from './pmi-commands.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import pmiTekst from './pmi_tekst.json';

const UNIT_MODES: UnitMode[] = ['METRIC_MM', 'METRIC_M', 'IMPERIAL'];

const UNIT_LABEL: Record<UnitMode, string> = {
    METRIC_MM: 'mm',
    METRIC_M: 'm',
    IMPERIAL: 'cal',
    AUTO: 'auto',
};

function rgbaToHex(rgba: [number, number, number, number]): string {
    const channel = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
    return `#${channel(rgba[0])}${channel(rgba[1])}${channel(rgba[2])}`;
}

function hexToRgba(hex: string, alpha = 1): [number, number, number, number] {
    const value = hex.replace('#', '');
    const toUnit = (offset: number) => parseInt(value.substring(offset, offset + 2), 16) / 255;
    return [toUnit(0), toUnit(2), toUnit(4), alpha];
}

interface PmiSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PmiSettingsModal({ isOpen, onClose }: PmiSettingsModalProps) {
    useLocale();
    const store = PMIStore.instance;
    const [, setTick] = useState(0);
    const [unitMode, setUnitMode] = useState<UnitMode>(store.unitMode);
    const [showUnits, setShowUnits] = useState<boolean>(store.showUnits);
    const [textSize, setTextSize] = useState<number>(store.textSizeMM);
    const [lineWidth, setLineWidth] = useState<number>(store.lineWidthMM);
    const [alignTextToLine, setAlignTextToLine] = useState<boolean>(store.alignTextToLine);
    const [dimColor, setDimColor] = useState<string>(rgbaToHex(store.dimColor));
    const [selectedColor, setSelectedColor] = useState<string>(rgbaToHex(store.selectedColor));
    const [edgeSnapPx, setEdgeSnapPx] = useState<number>(store.edgeSnapPx);
    const [vertexSnapPx, setVertexSnapPx] = useState<number>(store.vertexSnapPx);

    const rerender = () => setTick(t => t + 1);

    useEffect(() => {
        if (!isOpen) return;
        setUnitMode(store.unitMode);
        setShowUnits(store.showUnits);
        setTextSize(store.textSizeMM);
        setLineWidth(store.lineWidthMM);
        setAlignTextToLine(store.alignTextToLine);
        setDimColor(rgbaToHex(store.dimColor));
        setSelectedColor(rgbaToHex(store.selectedColor));
        setEdgeSnapPx(store.edgeSnapPx);
        setVertexSnapPx(store.vertexSnapPx);
    }, [isOpen, store]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleUnitChange = (mode: UnitMode) => {
        setUnitMode(mode);
        store.unitMode = mode;
        store.updateAllTexts();
    };

    const handleShowUnitsChange = (value: boolean) => {
        setShowUnits(value);
        store.showUnits = value;
        store.updateAllTexts();
    };

    const handleAlignTextToLineChange = (val: boolean) => {
        setAlignTextToLine(val);
        store.alignTextToLine = val;
        store.notifyChanged();
    };

    const handleTextSizeChange = (val: number) => {
        setTextSize(val);
        store.textSizeMM = val;
        store.notifyChanged();
    };

    const handleLineWidthChange = (val: number) => {
        setLineWidth(val);
        store.lineWidthMM = val;
        store.notifyChanged();
    };

    const handleDimColorChange = (hex: string) => {
        setDimColor(hex);
        store.dimColor = hexToRgba(hex);
        store.notifyChanged();
    };

    const handleSelectedColorChange = (hex: string) => {
        setSelectedColor(hex);
        store.selectedColor = hexToRgba(hex);
        store.notifyChanged();
    };

    const handleEdgeSnapChange = (val: number) => {
        setEdgeSnapPx(val);
        store.edgeSnapPx = val;
    };

    const handleVertexSnapChange = (val: number) => {
        setVertexSnapPx(val);
        store.vertexSnapPx = val;
    };

    const handleToggleAllVisibility = () => {
        store.toggleAllVisibility();
        rerender();
    };

    const handleClearAll = () => {
        if (!store.annotations.length) return;
        if (confirm('Czy na pewno chcesz usunąć wszystkie wymiary ze sceny?')) {
            executePMICommand(new ClearDimensionsCommand(store));
            rerender();
        }
    };



    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: '8px',
                    width: '380px',
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    color: '#f4f4f5',
                    fontSize: '13px',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                >
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#f4f4f5' }}>
                        {tx(pmiTekst, 'modal.title')}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#a1a1aa',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: 1,
                            padding: '4px',
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Jednostka */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#d4d4d8' }}>{tx(pmiTekst, 'modal.unit_mode')}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {UNIT_MODES.map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => handleUnitChange(mode)}
                                    style={{
                                        padding: '4px 10px',
                                        background: unitMode === mode ? '#2563eb' : '#27272a',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: unitMode === mode ? '#ffffff' : '#a1a1aa',
                                        fontWeight: unitMode === mode ? 600 : 400,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {UNIT_LABEL[mode]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pokaż jednostkę */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#d4d4d8' }}>{tx(pmiTekst, 'modal.show_units')}</span>
                        <input
                            type="checkbox"
                            checked={showUnits}
                            onChange={(e) => handleShowUnitsChange(e.target.checked)}
                            style={{ accentColor: '#3b82f6', cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                    </div>

                    {/* Tekst wzdłuż linii */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#d4d4d8' }}>{tx(pmiTekst, 'modal.align_to_line')}</span>
                        <input
                            type="checkbox"
                            checked={alignTextToLine}
                            onChange={(e) => handleAlignTextToLineChange(e.target.checked)}
                            style={{ accentColor: '#3b82f6', cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                    </div>

                    {/* Wielkość tekstu */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#d4d4d8' }}>{tx(pmiTekst, 'modal.text_size')}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="range"
                                min="10"
                                max="300"
                                step="1"
                                value={textSize}
                                onChange={(e) => handleTextSizeChange(Number(e.target.value))}
                                style={{ width: '90px', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            <span style={{ color: '#60a5fa', fontWeight: 600, minWidth: '50px', textAlign: 'right' }}>
                                {textSize} mm
                            </span>
                        </div>
                    </div>

                    {/* Grubość linii */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#d4d4d8' }}>{tx(pmiTekst, 'modal.line_width')}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="range"
                                min="0.5"
                                max="6"
                                step="0.1"
                                value={lineWidth}
                                onChange={(e) => handleLineWidthChange(Number(e.target.value))}
                                style={{ width: '90px', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            <span style={{ color: '#60a5fa', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                                {lineWidth.toFixed(1)}
                            </span>
                        </div>
                    </div>

                    {/* Kolor wymiaru */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#d4d4d8' }}>{tx(pmiTekst, 'modal.dim_color')}</span>
                        <input
                            type="color"
                            value={dimColor}
                            onChange={(e) => handleDimColorChange(e.target.value)}
                            style={{ width: '48px', height: '24px', background: 'transparent', border: '1px solid #3f3f46', borderRadius: '4px', cursor: 'pointer' }}
                        />
                    </div>

                    {/* Kolor zaznaczenia */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#d4d4d8' }}>{tx(pmiTekst, 'modal.selected_color')}</span>
                        <input
                            type="color"
                            value={selectedColor}
                            onChange={(e) => handleSelectedColorChange(e.target.value)}
                            style={{ width: '48px', height: '24px', background: 'transparent', border: '1px solid #3f3f46', borderRadius: '4px', cursor: 'pointer' }}
                        />
                    </div>

                    <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

                    {/* Przyciąganie */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#d4d4d8' }}>{tx(pmiTekst, 'modal.edge_snap')}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="range"
                                min="4"
                                max="30"
                                step="1"
                                value={edgeSnapPx}
                                onChange={(e) => handleEdgeSnapChange(Number(e.target.value))}
                                style={{ width: '90px', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            <span style={{ color: '#60a5fa', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                                {edgeSnapPx} px
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#d4d4d8' }}>{tx(pmiTekst, 'modal.vertex_snap')}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="range"
                                min="0"
                                max="20"
                                step="1"
                                value={vertexSnapPx}
                                onChange={(e) => handleVertexSnapChange(Number(e.target.value))}
                                style={{ width: '90px', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            <span style={{ color: '#60a5fa', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                                {vertexSnapPx} px
                            </span>
                        </div>
                    </div>

                    <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

                    {/* Operacje zbiorcze */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={handleToggleAllVisibility}
                            style={{
                                padding: '6px 12px',
                                background: '#27272a',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                color: '#e4e4e7',
                                cursor: 'pointer',
                                textAlign: 'center',
                            }}
                        >
                            {tx(pmiTekst, 'modal.toggle_all_visibility')}
                        </button>

                        <button
                            type="button"
                            onClick={handleClearAll}
                            disabled={store.annotations.length === 0}
                            style={{
                                padding: '6px 12px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '4px',
                                color: store.annotations.length === 0 ? '#71717a' : '#fca5a5',
                                cursor: store.annotations.length === 0 ? 'not-allowed' : 'pointer',
                                textAlign: 'center',
                            }}
                        >
                            {tx(pmiTekst, 'modal.clear_all')}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '12px 16px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                    }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '6px 16px',
                            background: '#27272a',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        {tx(pmiTekst, 'modal.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
