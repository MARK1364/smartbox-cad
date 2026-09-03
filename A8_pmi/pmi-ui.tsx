import React, { useEffect, useState } from 'react';
import { PMIStore, UnitMode } from './pmi-data.js';
import {
    ClearDimensionsCommand,
    ClearMeasurementsCommand,
    executePMICommand,
} from './pmi-commands.js';
import { ContextManager } from '../A1_core/context-manager.js';
import {
    activateDimensionTool,
    activateMeasureTool,
    deactivateDimensionTool,
    getDimensionTool,
    isDimensionToolActive,
    isMeasureToolActive,
} from './pmi-tool-activate.js';
import { PMI_EDIT_STATE } from './pmi-viewport-listener.js';
import { DRZEWO_TAB_EVENT } from '../S2_solver/constraint-pick-flow.js';

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

function openDrzewoWymiaryTab() {
    window.dispatchEvent(new CustomEvent(DRZEWO_TAB_EVENT, { detail: { tab: 'wymiary' } }));
}

export function PMIUI() {
    const store = PMIStore.instance;
    const [, setTick] = useState(0);
    const [interactionMode, setInteractionMode] = useState<'idle' | 'create' | 'edit' | 'measure'>('idle');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [unitMode, setUnitMode] = useState<UnitMode>(store.unitMode);
    const [showUnits, setShowUnits] = useState<boolean>(store.showUnits);
    const [textSize, setTextSize] = useState<number>(store.textSizeMM);
    const [lineWidth, setLineWidth] = useState<number>(store.lineWidthMM);
    const [dimColor, setDimColor] = useState<string>(rgbaToHex(store.dimColor));
    const [selectedColor, setSelectedColor] = useState<string>(rgbaToHex(store.selectedColor));
    const [edgeSnapPx, setEdgeSnapPx] = useState<number>(store.edgeSnapPx);
    const [vertexSnapPx, setVertexSnapPx] = useState<number>(store.vertexSnapPx);

    const rerender = () => setTick(t => t + 1);

    // Zmiany kolekcji oraz wartości pochodnych (przeliczona długość) idą osobnymi
    // kanałami — panel nasłuchuje obu, żeby etykiety na liście były aktualne.
    useEffect(() => {
        const unsubscribeChange = store.onChange(rerender);
        const unsubscribeDerived = store.onDerivedChange(rerender);
        return () => {
            unsubscribeChange();
            unsubscribeDerived();
        };
    }, [store]);

    const getStateMachine = () => ContextManager.instance.stateMachine || ContextManager.instance.appAPI?.stateMachine;

    const isToolActive = interactionMode === 'create';

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const bind = () => {
            const sm = getStateMachine();
            if (!sm) {
                timer = setTimeout(bind, 100);
                return;
            }
            unsubscribe = sm.onStateChange((stateName: string) => {
                if (stateName === 'DIMENSION_TOOL' || stateName === 'DimensionTool') {
                    setInteractionMode('create');
                } else if (stateName === 'MEASURE_TOOL' || stateName === 'MeasureTool') {
                    setInteractionMode('measure');
                } else if (stateName === PMI_EDIT_STATE) {
                    setInteractionMode('edit');
                } else {
                    setInteractionMode('idle');
                }
            });
        };

        bind();
        return () => {
            unsubscribe?.();
            if (timer) clearTimeout(timer);
        };
    }, []);

    const handleModeClick = (mode: 'GLOBAL' | 'ALIGNED' | 'MEASURE') => {
        const sm = getStateMachine();
        if (!sm) {
            console.warn('[PMIUI] Brak maszyny stanów');
            return;
        }

        if (mode === 'MEASURE') {
            if (isMeasureToolActive(sm)) {
                deactivateDimensionTool(sm);
                return;
            }
            activateMeasureTool(sm);
            openDrzewoWymiaryTab();
            rerender();
            return;
        }

        const alreadyThisMode = isDimensionToolActive(sm) && (
            mode === 'ALIGNED'
                ? store.toolAxisSpace === 'ALIGNED'
                : store.toolAxisSpace !== 'ALIGNED'
        );

        if (alreadyThisMode) {
            deactivateDimensionTool(sm);
            return;
        }

        store.toolAxisSpace = mode;
        if (isDimensionToolActive(sm)) {
            getDimensionTool(sm)?.setAxisSpace(mode);
        } else {
            activateDimensionTool(sm);
        }
        openDrzewoWymiaryTab();
        rerender();
    };

    // ── Ustawienia (wygląd + chwytanie) ───────────────────────

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

    // ── Czułość chwytania (px na ekranie) ──────────────────────

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
    };

    const handleClearAll = () => {
        if (!store.annotations.length) return;
        if (confirm('Czy na pewno chcesz usunąć wszystkie wymiary ze sceny?')) {
            executePMICommand(new ClearDimensionsCommand(store));
        }
    };

    const handleClearMeasurements = () => {
        if (!store.measurements.length) return;
        if (confirm('Czy na pewno chcesz usunąć wszystkie pomiary ze sceny?')) {
            executePMICommand(new ClearMeasurementsCommand(store));
        }
    };

    // ── Style ──────────────────────────────────────────────────

    const sectionStyle: React.CSSProperties = {
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    };

    const sectionTitleStyle: React.CSSProperties = {
        fontSize: '11px',
        fontWeight: 600,
        color: '#a1a1aa',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
    };

    const labelStyle: React.CSSProperties = { color: '#d4d4d8', fontSize: '11px' };

    const PANEL_BTN_BLUE = '#3b82f6';
    const PANEL_BTN_BG = '#09090b';

    /** Główne tryby: czarna ramka niebieska; aktywny = niebieskie tło. */
    const modeButton = (active: boolean): React.CSSProperties => ({
        padding: '9px 6px',
        background: active ? PANEL_BTN_BLUE : PANEL_BTN_BG,
        border: `1px solid ${PANEL_BTN_BLUE}`,
        borderRadius: '8px',
        color: active ? '#ffffff' : '#93c5fd',
        fontWeight: active ? 600 : 500,
        fontSize: '12px',
        lineHeight: 1.2,
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
    });

    const segmentedButton = (active: boolean): React.CSSProperties => ({
        padding: '4px 8px',
        background: active ? '#3b82f6' : '#27272a',
        border: 'none',
        borderRadius: '4px',
        color: active ? '#ffffff' : '#a1a1aa',
        fontWeight: active ? 600 : 400,
        fontSize: '11px',
        cursor: 'pointer',
        transition: 'all 0.15s',
    });

    const orthogonalActive = isToolActive && store.toolAxisSpace !== 'ALIGNED';
    const alignedActive = isToolActive && store.toolAxisSpace === 'ALIGNED';
    const measureActive = interactionMode === 'measure';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflowY: 'auto', padding: '10px', color: '#f4f4f5', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', flex: 1 }}>
                    <button type="button" onClick={() => handleModeClick('GLOBAL')} style={modeButton(orthogonalActive)}>
                        Ortogonalny
                    </button>
                    <button type="button" onClick={() => handleModeClick('ALIGNED')} style={modeButton(alignedActive)}>
                        Równoległy
                    </button>
                    <button type="button" onClick={() => handleModeClick('MEASURE')} style={modeButton(measureActive)}>
                        Pomiar
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => setSettingsOpen(v => !v)}
                    title="Ustawienia"
                    aria-expanded={settingsOpen}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        flexShrink: 0,
                        background: settingsOpen ? '#27272a' : 'transparent',
                        border: settingsOpen ? '1px solid #3f3f46' : '1px solid transparent',
                        borderRadius: '8px',
                        color: settingsOpen ? '#e4e4e7' : '#71717a',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </button>
            </div>

            {settingsOpen && (
                <div style={sectionStyle}>
                    <span style={sectionTitleStyle}>Ustawienia</span>

                    <div style={rowStyle}>
                        <span style={labelStyle}>Jednostka:</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {UNIT_MODES.map(mode => (
                                <button key={mode} onClick={() => handleUnitChange(mode)} style={segmentedButton(unitMode === mode)}>
                                    {UNIT_LABEL[mode]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={rowStyle}>
                        <span style={labelStyle}>Pokaż jednostkę:</span>
                        <input
                            type="checkbox"
                            checked={showUnits}
                            onChange={(e) => handleShowUnitsChange(e.target.checked)}
                            style={{ accentColor: '#3b82f6', cursor: 'pointer', width: '14px', height: '14px' }}
                        />
                    </div>

                    <div style={rowStyle}>
                        <span style={labelStyle}>Wielkość tekstu:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                                type="range"
                                min="8"
                                max="30"
                                step="1"
                                value={textSize}
                                onChange={(e) => handleTextSizeChange(Number(e.target.value))}
                                style={{ width: '70px', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '11px', minWidth: '38px', textAlign: 'right' }}>{textSize} mm</span>
                        </div>
                    </div>

                    <div style={rowStyle}>
                        <span style={labelStyle}>Grubość linii:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                                type="range"
                                min="0.5"
                                max="6"
                                step="0.1"
                                value={lineWidth}
                                onChange={(e) => handleLineWidthChange(Number(e.target.value))}
                                style={{ width: '70px', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '11px', minWidth: '38px', textAlign: 'right' }}>{lineWidth.toFixed(1)}</span>
                        </div>
                    </div>

                    <div style={rowStyle}>
                        <span style={labelStyle}>Kolor wymiaru:</span>
                        <input
                            type="color"
                            value={dimColor}
                            onChange={(e) => handleDimColorChange(e.target.value)}
                            style={{ width: '48px', height: '22px', background: 'transparent', border: '1px solid #3f3f46', borderRadius: '4px', cursor: 'pointer' }}
                        />
                    </div>

                    <div style={rowStyle}>
                        <span style={labelStyle}>Kolor zaznaczenia:</span>
                        <input
                            type="color"
                            value={selectedColor}
                            onChange={(e) => handleSelectedColorChange(e.target.value)}
                            style={{ width: '48px', height: '22px', background: 'transparent', border: '1px solid #3f3f46', borderRadius: '4px', cursor: 'pointer' }}
                        />
                    </div>

                    <div style={{ height: '1px', background: '#27272a', margin: '2px 0' }} />

                    <span style={{ ...sectionTitleStyle, fontSize: '10px' }}>Czułość chwytania</span>

                    <div style={rowStyle}>
                        <span style={labelStyle}>Krawędź:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                                type="range"
                                min="4"
                                max="30"
                                step="1"
                                value={edgeSnapPx}
                                onChange={(e) => handleEdgeSnapChange(Number(e.target.value))}
                                style={{ width: '70px', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '11px', minWidth: '38px', textAlign: 'right' }}>{edgeSnapPx} px</span>
                        </div>
                    </div>

                    <div style={rowStyle}>
                        <span style={labelStyle}>Narożnik:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                                type="range"
                                min="0"
                                max="20"
                                step="1"
                                value={vertexSnapPx}
                                onChange={(e) => handleVertexSnapChange(Number(e.target.value))}
                                style={{ width: '70px', accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '11px', minWidth: '38px', textAlign: 'right' }}>{vertexSnapPx} px</span>
                        </div>
                    </div>
                </div>
            )}

            <p style={{ margin: '2px 0 0', fontSize: '11px', lineHeight: 1.4, color: '#71717a' }}>
                Wpisy lądują w drzewie obiektów — zakładka Wymiary.
            </p>

            {(store.annotations.length > 0 || store.measurements.length > 0) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {store.annotations.length > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={handleToggleAllVisibility}
                                title="Przełącz widoczność wszystkich wymiarów"
                                style={{ background: 'transparent', border: 'none', color: '#a1a1aa', padding: 0, fontSize: '11px', cursor: 'pointer' }}
                            >
                                Pokaż / ukryj wymiary
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                title="Usuń wszystkie wymiary"
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: 0, fontSize: '11px', cursor: 'pointer' }}
                            >
                                Wyczyść wymiary
                            </button>
                        </>
                    )}
                    {store.measurements.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearMeasurements}
                            title="Usuń wszystkie pomiary"
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: 0, fontSize: '11px', cursor: 'pointer' }}
                        >
                            Wyczyść pomiary
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
