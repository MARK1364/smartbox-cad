/**
 * Podstrona cnc.html — ten sam shell co CAD (pasek menu + belka widokowa + panel edycji),
 * bez drzewa obiektów, Inspectora i SceneTree. Siatka w menu Widok. Bez Fit.
 */

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CncPanel } from '../C1_cnc/ui/CncPanel';
import { ContextManager } from '../A1_core/context-manager';
import { readModuleSession, returnToCad, installModulePageLifecycle } from './module-data/session';
import type { CncModulePayload, CncWorkpiece } from './module-data/types';
import { bootstrapCncPage, mountCncWorkpiece, clearMountedPanels } from './module-data/cnc-scene';
import type { CadModuleContext } from '../A1_core/cad-module-context.js';
import { useUiRegionEdgeHint } from './use-ui-region-edge-hint';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from './src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';
import { BelkaDisplayModeMenu, BelkaProjectionMenu } from './BelkaDisplayModeMenu';
import { importDxfToWorkpiece, inspectDxf, DxfMetadataSummary } from '../C1_cnc/inputs/dxf-importer';
import { DxfImportModal, DxfImportSettings } from './DxfImportModal';

installModulePageLifecycle('cnc');

function workpieceFromJson(data: any, fileName: string): CncModulePayload {
    const workpiece: CncWorkpiece = data.workpiece || data;
    if (!workpiece || typeof workpiece.width !== 'number') {
        throw new Error(tx(srcTekst, 'entry.cnc_workpiece', TX_NS));
    }
    return {
        meta: {
            module: 'cnc',
            sourceId: 'json',
            loadedAt: new Date().toISOString(),
            originLabel: `JSON · ${fileName}`,
        },
        scope: data.scope || { type: 'PANEL', id: workpiece.id, name: workpiece.name || fileName },
        workpiece,
    };
}

function callAPI(name: string, ...args: any[]) {
    const api = ContextManager.instance.appAPI as any;
    if (api && typeof api[name] === 'function') api[name](...args);
}

const eyeIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

function CncStandaloneApp() {
    const isStandaloneMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('standalone');
    const [payload, setPayload] = useState<CncModulePayload | null>(() => {
        if (isStandaloneMode) return null;
        return readModuleSession<CncModulePayload>('cnc');
    });
    const [error, setError] = useState<string | null>(null);
    const [livePanel, setLivePanel] = useState<any>(null);
    const [scene, setScene] = useState<any>(null);
    const [sceneError, setSceneError] = useState<string | null>(null);
    const [renderMode, setRenderMode] = useState<'shaded' | 'edges' | 'wireframe' | 'xray'>('edges');
    const [gridVisible, setGridVisible] = useState(false);
    const [lcsVisible, setLcsVisible] = useState(true);
    const [viewMenuOpen, setViewMenuOpen] = useState(false);
    const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
    const [projMenuOpen, setProjMenuOpen] = useState(false);
    const [projection, setProjection] = useState<'ortho' | 'perspective'>('ortho');
    const [isPanActive, setIsPanActive] = useState(false);
    const [statusText, setStatusText] = useState('CNC — gotowy');
    const [isDragging, setIsDragging] = useState(false);
    const [pendingDxf, setPendingDxf] = useState<{ text: string; fileName: string; summary: DxfMetadataSummary } | null>(null);
    const uiRegionHint = useUiRegionEdgeHint();
    useLocale();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileJsonRef = useRef<HTMLInputElement>(null);
    const fileDxfRef = useRef<HTMLInputElement>(null);
    const viewMenuRef = useRef<HTMLDivElement>(null);
    const ctxRef = useRef<CadModuleContext | null>(null);
    const bootOnce = useRef<Promise<CadModuleContext> | null>(null);

    const workpiece = payload?.workpiece;
    const originLabel = payload?.meta.originLabel || workpiece?.name;

    const handleClearWorkpiece = () => {
        setPayload(null);
        setLivePanel(null);
        if (ctxRef.current) {
            clearMountedPanels(ctxRef.current);
            ctxRef.current.ui?.setStatus?.(tx(srcTekst, 'entry.cleared', TX_NS), false);
        }
        setError(null);
        setStatusText('CNC — gotowy (brak formatki)');
    };

    const handleJson = (text: string, fileName: string) => {
        try {
            setPayload(workpieceFromJson(JSON.parse(text), fileName));
            setError(null);
        } catch (e: any) {
            setError(e?.message || 'Niepoprawny JSON CNC');
        }
    };

    const handleDxf = (text: string, fileName: string) => {
        try {
            console.log('[CNC] Analiza DXF przed importem:', fileName, 'Długość:', text.length);
            const summary = inspectDxf(text);
            setPendingDxf({ text, fileName, summary });
            setError(null);
        } catch (e: any) {
            console.error('[CNC] Błąd parsowania DXF:', e);
            const msg = e?.message || tx(srcTekst, 'entry.dxf_parse', TX_NS);
            setError(msg);
            alert(`Błąd otwierania DXF:\n\n${msg}`);
        }
    };

    const handleConfirmDxf = (settings: DxfImportSettings) => {
        if (!pendingDxf) return;
        try {
            const imported = importDxfToWorkpiece(pendingDxf.text, pendingDxf.fileName, {
                defaultThicknessMm: settings.thicknessMm,
                defaultDrillDepthMm: settings.drillDepthMm
            });
            if (settings.workpieceName) {
                imported.workpiece.name = settings.workpieceName;
                imported.scope.name = settings.workpieceName;
            }
            setPayload(imported);
            setPendingDxf(null);
            setError(null);
            setStatusText(`Wczytano DXF · ${settings.workpieceName} (${settings.thicknessMm} mm)`);
        } catch (e: any) {
            console.error('[CNC] Błąd importu formatki z DXF:', e);
            setError(e?.message || 'Błąd importu DXF');
            setPendingDxf(null);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        const name = file.name.toLowerCase();
        if (name.endsWith('.dxf')) {
            file.text().then((text) => handleDxf(text, file.name));
        } else if (name.endsWith('.json')) {
            file.text().then((text) => handleJson(text, file.name));
        } else {
            setError(tx(srcTekst, 'entry.drag_files', TX_NS));
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (!bootOnce.current) {
            bootOnce.current = bootstrapCncPage(canvas);
        }

        let cancelled = false;
        bootOnce.current
            .then((ctx) => {
                if (cancelled) return;
                ctxRef.current = ctx;
                setScene(ctx.viewport.scene);
                setStatusText(ctx.ui.state.statusText || 'CNC — gotowy');
                ctx.viewport.toggleGrid(false);
                callAPI('setLcsVisible', true);
                if (workpiece) {
                    const panel = mountCncWorkpiece(ctx, workpiece);
                    setLivePanel(panel);
                    setSceneError(null);
                    setStatusText(`CNC · ${panel.name || 'Formatka'}`);
                }
            })
            .catch((e: any) => {
                if (!cancelled) setSceneError(e?.message || tx(srcTekst, 'entry.cnc_scene', TX_NS));
            });

        return () => {
            cancelled = true;
        };
    }, [workpiece]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ro = new ResizeObserver(() => {
            try {
                ctxRef.current?.viewport.engine.resize();
            } catch { /* ignore */ }
        });
        ro.observe(canvas);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (!viewMenuOpen) return;
        const onDown = (e: MouseEvent) => {
            if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
                setViewMenuOpen(false);
            }
        };
        window.addEventListener('mousedown', onDown);
        return () => window.removeEventListener('mousedown', onDown);
    }, [viewMenuOpen]);

    const setMode = (mode: typeof renderMode) => {
        setRenderMode(mode);
        callAPI('setRenderMode', mode);
    };

    return (
        <div
            style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(30, 58, 138, 0.55)',
                        backdropFilter: 'blur(6px)',
                        border: '3px dashed #60a5fa',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        color: '#fff',
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        textShadow: '0 2px 4px rgba(0,0,0,0.6)',
                    }}
                >
                    <span style={{ fontSize: '2.5rem', marginBottom: 12 }}>📥</span>
                    {tx(srcTekst, 'entry.drop_dxf', TX_NS)}
                </div>
            )}

            {/* Belka górna — jak CAD, powrót oraz ładowanie plików DXF i JSON */}
            <div id="pasek-menu" className="pasek-menu">
                <div className="menu-left" style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <button
                        type="button"
                        className="menu-btn"
                        onClick={() => returnToCad('cnc')}
                        style={{
                            padding: '6px 12px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: 'rgba(37, 99, 235, 0.85)',
                            color: '#fff',
                            border: '1px solid rgba(59, 130, 246, 0.5)',
                            borderRadius: 4,
                            cursor: 'pointer',
                        }}
                        title={tx(srcTekst, 'entry.back_cad', TX_NS)}
                    >
                        ← {tx(srcTekst, 'entry.back_cad_btn', TX_NS)}
                    </button>
                    <button
                        type="button"
                        className="menu-btn"
                        onClick={() => fileDxfRef.current?.click()}
                        style={{
                            padding: '6px 12px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: 'rgba(16, 185, 129, 0.25)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.45)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            marginLeft: 10,
                        }}
                        title={tx(srcTekst, 'entry.open_dxf', TX_NS)}
                    >
{tx(srcTekst, 'entry.open_dxf_btn', TX_NS)}
                    </button>
                    <button
                        type="button"
                        className="menu-btn"
                        onClick={() => fileJsonRef.current?.click()}
                        style={{
                            padding: '6px 12px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(255, 255, 255, 0.16)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            marginLeft: 8,
                        }}
                        title="Wczytaj zapisany plik formatki JSON"
                    >
                        {tx(srcTekst, 'entry.open_json_btn', TX_NS)}
                    </button>
                    <button
                        type="button"
                        className="menu-btn"
                        onClick={handleClearWorkpiece}
                        style={{
                            padding: '6px 12px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#fca5a5',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            marginLeft: 8,
                        }}
                        title={tx(srcTekst, 'entry.clear_title', TX_NS)}
                    >
                        {tx(srcTekst, 'entry.clear_btn', TX_NS)}
                    </button>
                    <div className="menu-brand" style={{ marginLeft: 14 }}>CNC</div>
                    {(livePanel?.name || workpiece?.name || originLabel) && (
                        <div
                            style={{
                                marginLeft: 14,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(30, 58, 138, 0.45))',
                                border: '1px solid #3b82f6',
                                borderRadius: 5,
                                padding: '4px 10px',
                                color: '#ffffff',
                                fontSize: '0.88rem',
                                fontWeight: 600,
                            }}
                            title={originLabel || livePanel?.name}
                        >
                            <span style={{ color: '#93c5fd', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nazwa:</span>
                            <span style={{ color: '#60a5fa', fontWeight: 700 }}>
                                {livePanel?.name || workpiece?.name || originLabel}
                            </span>
                        </div>
                    )}
                    <input
                        ref={fileDxfRef}
                        type="file"
                        accept=".dxf,.DXF,application/dxf,image/vnd.dxf,text/plain,*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            file.text().then((text) => handleDxf(text, file.name));
                            e.target.value = '';
                        }}
                    />
                    <input
                        ref={fileJsonRef}
                        type="file"
                        accept="application/json,.json"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            file.text().then((text) => handleJson(text, file.name));
                            e.target.value = '';
                        }}
                    />
                </div>
            </div>

            {/* Belka widokowa — jak CAD, bez Fit / Inspector / SceneTree / Wymiaruj */}
            <div
                id="belka-widokowa"
                className="belka-widokowa"
                aria-label="Belka widokowa"
                data-ui-name="Belka widokowa"
            >
                <BelkaDisplayModeMenu
                    mode={renderMode}
                    open={displayMenuOpen}
                    onOpenChange={(next) => {
                        setDisplayMenuOpen(next);
                        if (next) {
                            setViewMenuOpen(false);
                            setProjMenuOpen(false);
                        }
                    }}
                    onChange={setMode}
                />
                <span className="tool-separator" />
                <div ref={viewMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                        type="button"
                        className={`tool-btn ${viewMenuOpen ? 'active' : ''}`}
                        onClick={() => {
                            setViewMenuOpen(!viewMenuOpen);
                            setDisplayMenuOpen(false);
                            setProjMenuOpen(false);
                        }}
                        title={tx(srcTekst, 'app.view.preview_title', TX_NS)}
                    >
                        {eyeIcon}
                        <span>{tx(srcTekst, 'app.view.preview', TX_NS)}</span>
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: 2, opacity: 0.8 }}>
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </button>
                    {viewMenuOpen && (
                        <div
                            className="view-dropdown-content"
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: 4,
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: 6,
                                padding: '8px 12px',
                                minWidth: 150,
                                zIndex: 100,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            }}
                        >
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem', userSelect: 'none' }}>
                                <input
                                    type="checkbox"
                                    checked={gridVisible}
                                    onChange={() => {
                                        const next = !gridVisible;
                                        setGridVisible(next);
                                        callAPI('toggleGrid', next);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                                {tx(srcTekst, 'app.view.grid', TX_NS)}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem', userSelect: 'none' }}>
                                <input
                                    type="checkbox"
                                    checked={lcsVisible}
                                    onChange={() => {
                                        const next = !lcsVisible;
                                        setLcsVisible(next);
                                        callAPI('setLcsVisible', next);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                                LCS
                            </label>
                        </div>
                    )}
                </div>
                <BelkaProjectionMenu
                    mode={projection}
                    open={projMenuOpen}
                    onOpenChange={(next) => {
                        setProjMenuOpen(next);
                        if (next) {
                            setViewMenuOpen(false);
                            setDisplayMenuOpen(false);
                        }
                    }}
                    onChange={(next) => {
                        if (next === projection) return;
                        setProjection(next);
                        callAPI('toggleProjection');
                    }}
                />
                <button
                    type="button"
                    className={`tool-btn ${isPanActive ? 'active' : ''}`}
                    onClick={() => {
                        const vp = ctxRef.current?.viewport;
                        const next = vp?.togglePanTool?.() ?? !isPanActive;
                        setIsPanActive(!!next);
                    }}
                    title="Przesuwanie widoku (Pan)"
                >
                    ✋ Przesuń
                </button>
            </div>

            <div id="view-cube-container" className="view-cube-container">
                <div id="view-cube-wrapper" className="view-cube-wrapper">
                    <div className="cube-face face-front" onClick={() => callAPI('setView', 'front')}>{tx(srcTekst, 'app.cube.front', TX_NS)}</div>
                    <div className="cube-face face-back" onClick={() => callAPI('setView', 'back')}>{tx(srcTekst, 'app.cube.back', TX_NS)}</div>
                    <div className="cube-face face-left" onClick={() => callAPI('setView', 'left')}>LEWY</div>
                    <div className="cube-face face-right" onClick={() => callAPI('setView', 'right')}>PRAWY</div>
                    <div className="cube-face face-top" onClick={() => callAPI('setView', 'top')}>{tx(srcTekst, 'app.cube.top', TX_NS)}</div>
                    <div className="cube-face face-bottom" onClick={() => callAPI('setView', 'bottom')}>{tx(srcTekst, 'app.cube.bottom', TX_NS)}</div>
                </div>
            </div>

            <div
                id="panel-edycji"
                className="panel-edycji cnc-panel-edycji"
                aria-label="Panel edycji"
                data-ui-name="Panel edycji"
            >
                <div className="panel-header" style={{ padding: '16px 20px 12px', flexShrink: 0 }}>
                    <h2>CNC</h2>
                    <p className="subtitle">
                        {livePanel?.name || workpiece?.name || tx(srcTekst, 'entry.machining', TX_NS)}
                    </p>
                </div>
                <div className="cnc-panel-edycji-body">
                    {error && (
                        <div
                            style={{
                                margin: '8px 16px',
                                padding: '10px 14px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.5)',
                                borderRadius: 6,
                                color: '#fca5a5',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 8,
                            }}
                        >
                            <span>⚠️ {error}</span>
                            <button
                                type="button"
                                onClick={() => setError(null)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#fca5a5',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    lineHeight: 1,
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    )}
                    {sceneError && !livePanel && (
                        <div className="panel-section" style={{ color: '#fbbf24' }}>
                            {sceneError}
                        </div>
                    )}
                    {livePanel ? (
                        <CncPanel isEmbedded activePanel={livePanel} scene={scene} />
                    ) : (
                        !sceneError && (
                            <div className="panel-section" style={{ textAlign: 'center', padding: '24px 16px' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📐</div>
                                <h3 style={{ margin: '0 0 8px', color: '#e2e8f0', fontSize: '1.05rem' }}>Brak aktywnej formatki</h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 16px' }}>
                                    {tx(srcTekst, 'entry.hint_dxf', TX_NS)} <code>.dxf</code> {tx(srcTekst, 'entry.hint_cad', TX_NS)}
                                </p>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                    <button
                                        type="button"
                                        className="menu-btn"
                                        onClick={() => fileDxfRef.current?.click()}
                                        style={{
                                            padding: '8px 16px',
                                            fontWeight: 600,
                                            backgroundColor: 'rgba(16, 185, 129, 0.25)',
                                            color: '#34d399',
                                            border: '1px solid rgba(16, 185, 129, 0.5)',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {tx(srcTekst, 'entry.open_dxf_btn', TX_NS)}
                                    </button>
                                    <button
                                        type="button"
                                        className="menu-btn"
                                        onClick={() => fileJsonRef.current?.click()}
                                        style={{
                                            padding: '8px 16px',
                                            fontWeight: 600,
                                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                            color: '#cbd5e1',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {tx(srcTekst, 'entry.open_json_btn', TX_NS)}
                                    </button>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>

            <div className={`status-bar ${statusText ? 'active' : ''}`} id="statusBar">
                <span className="status-dot" />
                <span>{sceneError || statusText}</span>
            </div>

            {uiRegionHint && (
                <div className="scene-ui-region-hint" role="status">
                    {uiRegionHint}
                </div>
            )}

            <canvas
                id="renderCanvas"
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block' }}
            />

            {pendingDxf && (
                <DxfImportModal
                    isOpen={Boolean(pendingDxf)}
                    fileName={pendingDxf.fileName}
                    summary={pendingDxf.summary}
                    onConfirm={handleConfirmDxf}
                    onCancel={() => setPendingDxf(null)}
                />
            )}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('cnc-root')!).render(<CncStandaloneApp />);
