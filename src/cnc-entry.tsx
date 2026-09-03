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
import { bootstrapCncPage, mountCncWorkpiece } from './module-data/cnc-scene';
import type { BootstrapContext } from '../A1_core/scene-bootstrap';
import { useUiRegionEdgeHint } from './use-ui-region-edge-hint';
import { BelkaDisplayModeMenu, BelkaProjectionMenu } from './BelkaDisplayModeMenu';

installModulePageLifecycle('cnc');

function workpieceFromJson(data: any, fileName: string): CncModulePayload {
    const workpiece: CncWorkpiece = data.workpiece || data;
    if (!workpiece || typeof workpiece.width !== 'number') {
        throw new Error('JSON CNC musi zawierać workpiece (width/height/thickness w nm, features).');
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
    const [payload, setPayload] = useState<CncModulePayload | null>(
        () => readModuleSession<CncModulePayload>('cnc')
    );
    const [error, setError] = useState<string | null>(
        payload ? null : 'Brak formatki. PPM na formatce w CAD → CNC, albo wczytaj JSON.'
    );
    const [livePanel, setLivePanel] = useState<any>(null);
    const [scene, setScene] = useState<any>(null);
    const [sceneError, setSceneError] = useState<string | null>(null);
    const [renderMode, setRenderMode] = useState<'shaded' | 'edges' | 'wireframe' | 'xray'>('edges');
    const [gridVisible, setGridVisible] = useState(true);
    const [lcsVisible, setLcsVisible] = useState(false);
    const [viewMenuOpen, setViewMenuOpen] = useState(false);
    const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
    const [projMenuOpen, setProjMenuOpen] = useState(false);
    const [projection, setProjection] = useState<'ortho' | 'perspective'>('ortho');
    const [isPanActive, setIsPanActive] = useState(false);
    const [statusText, setStatusText] = useState('CNC — gotowy');
    const uiRegionHint = useUiRegionEdgeHint();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileJsonRef = useRef<HTMLInputElement>(null);
    const viewMenuRef = useRef<HTMLDivElement>(null);
    const ctxRef = useRef<BootstrapContext | null>(null);
    const bootOnce = useRef<Promise<BootstrapContext> | null>(null);

    const workpiece = payload?.workpiece;
    const originLabel = payload?.meta.originLabel || workpiece?.name;

    const handleJson = (text: string, fileName: string) => {
        try {
            setPayload(workpieceFromJson(JSON.parse(text), fileName));
            setError(null);
        } catch (e: any) {
            setError(e?.message || 'Niepoprawny JSON CNC');
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
                if (workpiece) {
                    const panel = mountCncWorkpiece(ctx, workpiece);
                    setLivePanel(panel);
                    setSceneError(null);
                    setStatusText(`CNC · ${panel.name || 'Formatka'}`);
                }
            })
            .catch((e: any) => {
                if (!cancelled) setSceneError(e?.message || 'Nie udało się uruchomić sceny CNC');
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
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
            {/* Belka górna — jak CAD, tylko Wróć (bez menu Plik) */}
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
                        title="Wróć do projektu CAD i zamknij CNC"
                    >
                        ← Wróć do CAD
                    </button>
                    <div className="menu-brand" style={{ marginLeft: 12 }}>SmartPanel CNC</div>
                    {originLabel && (
                        <span
                            style={{
                                marginLeft: 12,
                                color: '#94a3b8',
                                fontSize: '0.85rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 420,
                            }}
                            title={originLabel}
                        >
                            {originLabel}
                        </span>
                    )}
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
                        title="Widok — włącz/wyłącz elementy graficzne"
                    >
                        {eyeIcon}
                        <span>Widok</span>
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
                                Siatka i płaszczyzny
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
                    <div className="cube-face face-front" onClick={() => callAPI('setView', 'front')}>PRZÓD</div>
                    <div className="cube-face face-back" onClick={() => callAPI('setView', 'back')}>TYŁ</div>
                    <div className="cube-face face-left" onClick={() => callAPI('setView', 'left')}>LEWY</div>
                    <div className="cube-face face-right" onClick={() => callAPI('setView', 'right')}>PRAWY</div>
                    <div className="cube-face face-top" onClick={() => callAPI('setView', 'top')}>GÓRA</div>
                    <div className="cube-face face-bottom" onClick={() => callAPI('setView', 'bottom')}>DÓŁ</div>
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
                        {livePanel?.name || workpiece?.name || 'Obróbka formatki'}
                    </p>
                </div>
                <div className="cnc-panel-edycji-body">
                    {(error || sceneError) && !livePanel && (
                        <div className="panel-section" style={{ color: '#fbbf24' }}>
                            {sceneError || error}
                        </div>
                    )}
                    {livePanel ? (
                        <CncPanel isEmbedded activePanel={livePanel} scene={scene} />
                    ) : (
                        !error && !sceneError && (
                            <div className="panel-section">
                                <p className="feature-empty">Wskaż formatkę w CAD (PPM → CNC).</p>
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
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('cnc-root')!).render(<CncStandaloneApp />);
