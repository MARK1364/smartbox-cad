/**
 * E3_export - E3MultiStudio.tsx
 * Kompletne Studio Multi-Kamera 3D (Eksport 3)
 * Architektura Jednego Wspólnego Płótna (Single Unified Canvas)
 * z Interaktywną Ramką Graniczną (Dashed Bounding Frame),
 * 8 Uchwytami Rozciągania oraz Paskiem Przesuwania Kadru.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { E3MultiViewportEngine, E3SheetModel } from './e3-multi-viewport-engine';
import { E3LibraryItem, E3PaperFormat, E3_PAPER_FORMATS } from './e3-library-types';
import { SceneTree } from '../src/SceneTree';
import { ContextManager } from '../A1_core/context-manager';
import { NodeType } from '../A1_core/cad-node/node-type';
import { toMm } from './e3-library-extractor';
import { resolveGeometrySnapshot } from './e3-geometry-snapshot';

export const E3MultiStudio: React.FC = () => {
    const engine = useMemo(() => E3MultiViewportEngine.instance, []);
    const [, setTick] = useState(0);

    const sheetCanvasRef = useRef<HTMLCanvasElement>(null);
    const sheetContainerRef = useRef<HTMLDivElement>(null);

    // Stan przeciągania / rozciągania ramki
    const [saveMsg, setSaveMsg] = useState('');
    const [dragState, setDragState] = useState<{
        mode: 'move' | 'resize';
        handle?: string;
        modelId: string;
        startX: number;
        startY: number;
        initialSheetX: number;
        initialSheetY: number;
        initialWidth: number;
        initialHeight: number;
    } | null>(null);

    useEffect(() => {
        if (sheetCanvasRef.current) {
            engine.initSheetScene(sheetCanvasRef.current);
            requestAnimationFrame(() => {
                engine.engine?.resize();
                engine.setPaperFormat(engine.paperFormat);
            });
        }

        const unsubscribe = engine.subscribe(() => {
            setTick((t) => t + 1);
        });

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const tag = (document.activeElement as HTMLElement)?.tagName;
                if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
                    engine.deleteActiveModel();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            unsubscribe();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [engine]);

    const activeModel = engine.activeModel;
    const paperDims = E3_PAPER_FORMATS[engine.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
    const scalePx = 2.7; // 1 mm = 2.7 px na arkuszu

    // Obsługa przesuwania / rozciągania ramki granicznej
    const handleStartDrag = (model: E3SheetModel, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        engine.setActiveModel(model.id);
        setDragState({
            mode: 'move',
            modelId: model.id,
            startX: e.clientX,
            startY: e.clientY,
            initialSheetX: model.sheetX,
            initialSheetY: model.sheetY,
            initialWidth: model.frameWidth,
            initialHeight: model.frameHeight,
        });
    };

    const handleStartResize = (model: E3SheetModel, handle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        engine.setActiveModel(model.id);
        setDragState({
            mode: 'resize',
            handle,
            modelId: model.id,
            startX: e.clientX,
            startY: e.clientY,
            initialSheetX: model.sheetX,
            initialSheetY: model.sheetY,
            initialWidth: model.frameWidth,
            initialHeight: model.frameHeight,
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragState) return;

        const deltaMmX = (e.clientX - dragState.startX) / scalePx;
        const deltaMmY = (dragState.startY - e.clientY) / scalePx; // Y rośnie w górę w CAD

        if (dragState.mode === 'move') {
            const newX = dragState.initialSheetX + deltaMmX;
            const newY = dragState.initialSheetY + deltaMmY;
            engine.updateModelPosition(dragState.modelId, newX, newY);
        } else if (dragState.mode === 'resize' && dragState.handle) {
            let newW = dragState.initialWidth;
            let newH = dragState.initialHeight;
            let newX = dragState.initialSheetX;
            let newY = dragState.initialSheetY;

            const h = dragState.handle;
            if (h.includes('e')) {
                newW = Math.max(40, dragState.initialWidth + deltaMmX);
                newX = dragState.initialSheetX + deltaMmX / 2;
            }
            if (h.includes('w')) {
                newW = Math.max(40, dragState.initialWidth - deltaMmX);
                newX = dragState.initialSheetX + deltaMmX / 2;
            }
            if (h.includes('n')) {
                newH = Math.max(30, dragState.initialHeight + deltaMmY);
                newY = dragState.initialSheetY + deltaMmY / 2;
            }
            if (h.includes('s')) {
                newH = Math.max(30, dragState.initialHeight - deltaMmY);
                newY = dragState.initialSheetY + deltaMmY / 2;
            }

            engine.resizeModelFrame(dragState.modelId, newW, newH, newX, newY);
        }
    };

    const handleMouseUp = () => {
        if (dragState) {
            setDragState(null);
        }
    };

    const handleSheetDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleSheetDrop = (e: React.DragEvent) => {
        e.preventDefault();
        try {
            const rawCadNode = e.dataTransfer.getData('application/cad-node');
            const rawE3 = e.dataTransfer.getData('application/e3-library-item');
            const dragged = (window as any).__draggedCadNode || (rawCadNode ? JSON.parse(rawCadNode) : (rawE3 ? JSON.parse(rawE3) : null));

            if (dragged && (dragged.id || dragged.nodeId)) {
                const id = dragged.id || dragged.nodeId;
                const doc = ContextManager.instance.document;
                const node = doc ? doc.findNode(id) : null;
                const domainData = (node?.domainData || dragged.raw || dragged) as any;

                const isContainer =
                    node?.nodeType === NodeType.ASSEMBLY ||
                    domainData?.type === 'container' ||
                    dragged.type === 'CONTAINER' ||
                    dragged.type === 'SMARTBOX' ||
                    dragged.type === 'ASSEMBLY';

                const snap = resolveGeometrySnapshot(id);
                const children: any[] = [];
                if (snap && snap.parts.length > 0) {
                    for (const part of snap.parts) {
                        children.push({
                            id: part.id,
                            name: part.name,
                            width: part.width,
                            height: part.height,
                            depth: part.thickness,
                            role: part.role || part.name,
                            pos: part.pos,
                            rotq: part.rotq,
                        });
                    }
                } else if (node && node.children && node.children.length > 0) {
                    for (const ch of node.children) {
                        const cd = ch.domainData as any;
                        if (cd) {
                            children.push({
                                id: ch.id,
                                name: cd.name || ch.name,
                                width: toMm(cd.width, 600),
                                height: toMm(cd.height, 720),
                                depth: toMm(cd.thickness || cd.depth, 18),
                                role: cd.role || cd.name,
                                raw: cd,
                            });
                        }
                    }
                } else {
                    const source = (dragged.raw || dragged) as any;
                    const rawChildren = source.children || dragged.children || [];
                    if (rawChildren && rawChildren.length > 0) {
                        for (const ch of rawChildren) {
                            children.push({
                                id: ch.id,
                                name: ch.name,
                                width: toMm(ch.width, 600),
                                height: toMm(ch.height, 720),
                                depth: toMm(ch.thickness || ch.depth, 18),
                                thickness: toMm(ch.thickness || ch.depth, 18),
                                role: ch.role || ch.name,
                                holes: ch.holes || [],
                                grooves: ch.grooves || [],
                                raw: ch,
                            });
                        }
                    }
                }

                const item: E3LibraryItem = {
                    id: id,
                    uid: id,
                    name: snap?.name || domainData?.name || node?.name || dragged.name || (isContainer ? 'Szafa / Korpus' : 'Formatka'),
                    type: (snap?.type === 'PANEL' || (!snap && !isContainer)) ? 'PANEL' : 'CONTAINER',
                    width: snap?.width || toMm(domainData?.width || dragged.width, 800),
                    height: snap?.height || toMm(domainData?.height || dragged.height, 720),
                    depth: snap?.depth || toMm(domainData?.depth || domainData?.thickness || dragged.depth || dragged.thickness, 560),
                    childCount: children.length,
                    children,
                    raw: domainData,
                };

                const rect = sheetCanvasRef.current?.getBoundingClientRect();
                let dropMmX = paperDims.width / 2;
                let dropMmY = paperDims.height / 2;

                if (rect && rect.width > 0 && rect.height > 0) {
                    const normX = (e.clientX - rect.left) / rect.width;
                    const normY = (e.clientY - rect.top) / rect.height;
                    dropMmX = normX * paperDims.width;
                    dropMmY = (1 - normY) * paperDims.height;
                }

                engine.addModelFromItem(item, dropMmX, dropMmY, 'front');
            }
        } catch (err) {
            console.warn('Błąd upuszczania na arkusz:', err);
        }
    };

    const handleSaveSheet = () => {
        engine.saveCurrentSheet();
        setSaveMsg('Zapisano');
        window.setTimeout(() => setSaveMsg(''), 2000);
    };

    const handleNewSheet = () => {
        if (engine.models.length > 0) {
            const saved = !!engine.currentSheetId;
            const ok = window.confirm(
                saved
                    ? 'Zacząć nowy pusty arkusz? Ten pozostanie na liście zapisanych.'
                    : 'Bieżący arkusz nie jest zapisany. Nowy wyczyści pulpit. Kontynuować?'
            );
            if (!ok) return;
        }
        engine.newSheet();
        setSaveMsg('');
    };

    const handleOpenSheet = (sheetId: string) => {
        if (!sheetId) return;
        if (sheetId === engine.currentSheetId) return;
        if (engine.models.length > 0 && !engine.currentSheetId) {
            const ok = window.confirm('Bieżący arkusz nie jest zapisany. Wczytać inny i porzucić układ na pulpicie?');
            if (!ok) return;
        }
        engine.loadSheet(sheetId);
    };

    const handleStyle: React.CSSProperties = {
        position: 'absolute',
        width: '8px',
        height: '8px',
        backgroundColor: '#2563eb',
        border: '1px solid #ffffff',
        borderRadius: '0',
        zIndex: 50,
        pointerEvents: 'auto',
    };

    return (
        <div
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
                display: 'flex',
                width: '100vw',
                height: '100vh',
                backgroundColor: '#0b0f19',
                color: '#f1f5f9',
                fontFamily: "'Inter', sans-serif",
                overflow: 'hidden',
                userSelect: 'none',
            }}
        >
            {/* ─── Drzewo obiektów (to samo co na scenie głównej) ─── */}
            <div
                id="drzewo-obiektow"
                className="drzewo-obiektow"
                aria-label="Drzewo obiektów"
                style={{
                    width: '320px',
                    backgroundColor: '#111827',
                    borderRight: '1px solid #1f2937',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                    zIndex: 10,
                }}
            >
                <div
                    className="panel-header"
                    style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <h2
                        style={{ fontSize: '0.95rem', margin: 0, color: '#e2e8f0', fontWeight: 600 }}
                        title="Upuść wielokrotnie na arkusz — każdy egzemplarz ma własny kąt, pan i zakres"
                    >
                        Drzewo obiektów
                    </h2>
                </div>
                <div style={{ padding: '6px 12px 0', fontSize: '10px', color: '#64748b', lineHeight: 1.4 }}>
                    Upuść wielokrotnie na arkusz. Każdy egzemplarz ma własny kąt.
                </div>
                <div
                    className="panel-section"
                    style={{
                        padding: '6px',
                        overflowY: 'auto',
                        height: 'calc(100% - 44px)',
                        flex: 1,
                    }}
                >
                    <SceneTree />
                </div>
            </div>

            {/* ─── OBSZAR GŁÓWNY Z GÓRNĄ BELKĄ I ARKUSZEM ─── */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#0f172a',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* ─── GÓRNA BELKA WIDOKÓW (VIEWPORT TOOLBAR) ─── */}
                <div
                    style={{
                        height: '46px',
                        backgroundColor: '#111827',
                        borderBottom: '1px solid #1f2937',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 14px',
                        zIndex: 20,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            onClick={() => engine.fitActiveViewToFrame()}
                            disabled={!activeModel}
                            style={{
                                backgroundColor: '#1f2937',
                                color: activeModel ? '#ffffff' : '#6b7280',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                cursor: activeModel ? 'pointer' : 'default',
                                fontWeight: 600,
                            }}
                            title="Owiń ramkę wokół modelu (4 mm zapasu)"
                        >
                            Dopasuj
                        </button>
                        <button
                            onClick={() => engine.toggleActiveModelPMI()}
                            disabled={!activeModel}
                            style={{
                                backgroundColor: activeModel?.showPMI ? '#2563eb' : '#1f2937',
                                color: activeModel ? '#ffffff' : '#6b7280',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                cursor: activeModel ? 'pointer' : 'default',
                                fontWeight: activeModel?.showPMI ? 600 : 400,
                            }}
                            title="Pokaż / ukryj wymiary PMI ze sceny 3D na aktywnej ramce"
                        >
                            PMI
                        </button>

                        <span style={{ width: '1px', height: '18px', backgroundColor: '#374151', margin: '0 4px' }} />

                        {/* Style wyświetlania */}
                        <button
                            onClick={() => engine.setActiveModelRenderMode('shaded')}
                            style={{
                                backgroundColor: activeModel?.renderMode === 'shaded' ? '#2563eb' : '#1f2937',
                                color: '#ffffff',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: activeModel?.renderMode === 'shaded' ? 600 : 400,
                            }}
                            title="Kolor / Materiały dla zaznaczonego modelu"
                        >
                            Shaded
                        </button>
                        <button
                            onClick={() => engine.setActiveModelRenderMode('edges')}
                            style={{
                                backgroundColor: activeModel?.renderMode === 'edges' ? '#2563eb' : '#1f2937',
                                color: '#ffffff',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: activeModel?.renderMode === 'edges' ? 600 : 400,
                            }}
                            title="Krawędziowy CAD (czarny tusz) dla zaznaczonego modelu"
                        >
                            Edges
                        </button>
                        <button
                            onClick={() => engine.setActiveModelRenderMode('wireframe')}
                            style={{
                                backgroundColor: activeModel?.renderMode === 'wireframe' ? '#2563eb' : '#1f2937',
                                color: '#ffffff',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: activeModel?.renderMode === 'wireframe' ? 600 : 400,
                            }}
                            title="Siatka krawędzi"
                        >
                            Wire
                        </button>
                        <button
                            onClick={() => engine.setActiveModelRenderMode('xray')}
                            style={{
                                backgroundColor: activeModel?.renderMode === 'xray' ? '#2563eb' : '#1f2937',
                                color: '#ffffff',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: activeModel?.renderMode === 'xray' ? 600 : 400,
                            }}
                            title="Półprzezroczyste bryły"
                        >
                            Półprzezroczyste
                        </button>

                        <span style={{ width: '1px', height: '18px', backgroundColor: '#374151', margin: '0 4px' }} />

                        {activeModel && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
                                <span>Zakres:</span>
                                <input
                                    type="range"
                                    min="0.01"
                                    max="1"
                                    step="0.01"
                                    value={Math.min(1, Math.max(0.01, activeModel.scale))}
                                    onChange={(e) => engine.setModelScale(activeModel.id, parseFloat(e.target.value))}
                                    style={{ width: '90px', cursor: 'pointer' }}
                                    title="Zakres rysunkowy aktywnej ramki (kółko myszy robi to samo)"
                                />
                                <span style={{ color: '#ffffff', fontWeight: 600 }}>{Math.round(activeModel.scale * 100)}%</span>
                            </div>
                        )}
                    </div>

                    {/* Format papieru i Drukuj/Eksport */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                            value={engine.paperFormat}
                            onChange={(e) => engine.setPaperFormat(e.target.value as E3PaperFormat)}
                            style={{
                                backgroundColor: '#1f2937',
                                border: '1px solid #374151',
                                color: '#ffffff',
                                borderRadius: '4px',
                                padding: '5px 8px',
                                fontSize: '11px',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            {(Object.keys(E3_PAPER_FORMATS) as E3PaperFormat[]).map((fmt) => (
                                <option key={fmt} value={fmt}>
                                    {E3_PAPER_FORMATS[fmt].label} ({E3_PAPER_FORMATS[fmt].description})
                                </option>
                            ))}
                        </select>

                        {engine.models.length > 0 && (
                            <button
                                onClick={() => {
                                    if (confirm('Wyczyścić wszystkie modele z arkusza?')) {
                                        engine.clearAllModels();
                                    }
                                }}
                                style={{
                                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    borderRadius: '4px',
                                    padding: '5px 10px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                }}
                            >
                                ✕ Wyczyść
                            </button>
                        )}

                        <button
                            onClick={() => engine.printSheet()}
                            style={{
                                backgroundColor: '#059669',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '5px 12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            🖨️ Drukuj / PDF
                        </button>
                    </div>
                </div>

                {/* ─── KOSTKA WIDOKÓW (VIEWCUBE) ─── */}
                <div
                    style={{
                        position: 'absolute',
                        top: '56px',
                        right: '18px',
                        width: '70px',
                        zIndex: 30,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <div
                        style={{
                            width: '70px',
                            height: '70px',
                            perspective: '300px',
                        }}
                    >
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                            transformStyle: 'preserve-3d',
                            transform: 'rotateX(-20deg) rotateY(-35deg)',
                        }}
                    >
                        <CubeFace title="PRZÓD" transform="translateZ(35px)" onClick={() => engine.setActiveModelAngle('front')} />
                        <CubeFace title="TYŁ" transform="rotateY(180deg) translateZ(35px)" onClick={() => engine.setActiveModelAngle('back')} />
                        <CubeFace title="LEWY" transform="rotateY(-90deg) translateZ(35px)" onClick={() => engine.setActiveModelAngle('left')} />
                        <CubeFace title="PRAWY" transform="rotateY(90deg) translateZ(35px)" onClick={() => engine.setActiveModelAngle('right')} />
                        <CubeFace title="GÓRA" transform="rotateX(90deg) translateZ(35px)" onClick={() => engine.setActiveModelAngle('top')} />
                        <CubeFace title="DÓŁ" transform="rotateX(-90deg) translateZ(35px)" onClick={() => engine.setActiveModelAngle('bottom')} />
                    </div>
                    </div>
                    <button
                        onClick={() => engine.setActiveModelAngle('isometric')}
                        style={{
                            backgroundColor: '#1f2937',
                            color: '#e2e8f0',
                            border: '1px solid #374151',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                        title="Izometria aktywnej ramki"
                    >
                        ISO
                    </button>
                </div>

                {/* ─── CENTRALNE PŁÓTNO ARKUSZA (JEDNO WSPÓLNE PŁÓTNO 3D) ─── */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '14px 20px 20px',
                        overflow: 'auto',
                        gap: '10px',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: `${paperDims.width * scalePx}px`,
                            maxWidth: '100%',
                            flexShrink: 0,
                        }}
                    >
                        <button
                            onClick={handleSaveSheet}
                            style={{
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                            title="Zapisz ten arkusz (widoki, kąty, format papieru)"
                        >
                            Zapisz
                        </button>
                        <button
                            onClick={handleNewSheet}
                            style={{
                                backgroundColor: '#1f2937',
                                color: '#e2e8f0',
                                border: '1px solid #374151',
                                borderRadius: '4px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                            title="Pusty nowy arkusz — zapisane zostają na liście"
                        >
                            Nowy
                        </button>
                        <input
                            value={engine.currentSheetName}
                            onChange={(e) => engine.setSheetName(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder="Nazwa arkusza"
                            style={{
                                flex: 1,
                                minWidth: '120px',
                                backgroundColor: '#111827',
                                border: '1px solid #374151',
                                color: '#f8fafc',
                                borderRadius: '4px',
                                padding: '6px 10px',
                                fontSize: '12px',
                                outline: 'none',
                                userSelect: 'text',
                            }}
                        />
                        <select
                            value={engine.currentSheetId || ''}
                            onChange={(e) => handleOpenSheet(e.target.value)}
                            style={{
                                backgroundColor: '#111827',
                                border: '1px solid #374151',
                                color: '#e2e8f0',
                                borderRadius: '4px',
                                padding: '6px 8px',
                                fontSize: '12px',
                                maxWidth: '220px',
                                cursor: 'pointer',
                            }}
                            title="Wczytaj zapisany arkusz"
                        >
                            <option value="">
                                {engine.savedSheets.length === 0 ? 'Brak zapisanych arkuszy' : 'Otwórz zapisany…'}
                            </option>
                            {engine.savedSheets.map((sheet) => (
                                <option key={sheet.id} value={sheet.id}>
                                    {sheet.name}
                                </option>
                            ))}
                        </select>
                        {engine.currentSheetId && (
                            <button
                                onClick={() => {
                                    if (window.confirm('Usunąć ten arkusz z listy zapisanych?')) {
                                        engine.deleteSavedSheet(engine.currentSheetId as string);
                                    }
                                }}
                                style={{
                                    backgroundColor: 'transparent',
                                    color: '#94a3b8',
                                    border: '1px solid #374151',
                                    borderRadius: '4px',
                                    padding: '6px 8px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                }}
                                title="Usuń z listy zapisanych"
                            >
                                Usuń
                            </button>
                        )}
                        {saveMsg && (
                            <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>{saveMsg}</span>
                        )}
                    </div>
                    <div
                        ref={sheetContainerRef}
                        onDrop={handleSheetDrop}
                        onDragOver={handleSheetDragOver}
                        style={{
                            width: `${paperDims.width * scalePx}px`,
                            height: `${paperDims.height * scalePx}px`,
                            backgroundColor: '#ffffff',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                            position: 'relative',
                            color: '#000000',
                            borderRadius: '2px',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Pojedyncze Płótno Canvas Silnika 3D */}
                        <canvas
                            ref={sheetCanvasRef}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                display: 'block',
                                outline: 'none',
                                zIndex: 5,
                            }}
                        />

                        {/* Podwójna Ramka CAD i Stempel ISO 7200 (Nakładka SVG) */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
                            <svg width="100%" height="100%" viewBox={`0 0 ${paperDims.width} ${paperDims.height}`}>
                                <rect x="20" y="5" width={paperDims.width - 25} height={paperDims.height - 10} fill="none" stroke="#000000" strokeWidth="0.7" />
                                <rect x="21" y="6" width={paperDims.width - 27} height={paperDims.height - 12} fill="none" stroke="#000000" strokeWidth="0.25" />

                                <g transform={`translate(${paperDims.width - 125}, ${paperDims.height - 35})`}>
                                    <rect width="120" height="30" fill="#ffffff" stroke="#000000" strokeWidth="0.7" />
                                    <line x1="0" y1="12" x2="120" y2="12" stroke="#000000" strokeWidth="0.35" />
                                    <line x1="80" y1="0" x2="80" y2="30" stroke="#000000" strokeWidth="0.35" />
                                    <text x="3" y="4" fontSize="1.6" fill="#666666">Nazwa mebla / szafy</text>
                                    <text x="3" y="9" fontSize="3.2" fontWeight="bold" fill="#000000">{engine.titleBlock.furnitureName}</text>
                                    <text x="82" y="4" fontSize="1.6" fill="#666666">Nr rysunku</text>
                                    <text x="82" y="9" fontSize="3.0" fontWeight="bold" fill="#000000">{engine.titleBlock.drawingNumber}</text>
                                    <text x="3" y="18" fontSize="1.4" fill="#666666">Wykonał: {engine.titleBlock.author}</text>
                                    <text x="82" y="18" fontSize="1.4" fill="#666666">Data: {engine.titleBlock.date}</text>
                                </g>
                            </svg>
                        </div>

                        {/* Ramka widoku: prostokąt z linią przerywaną, tylko po aktywacji (jak SolidWorks Draw) */}
                        {engine.models.map((model) => {
                            const isSelected = engine.activeModelId === model.id;
                            if (!isSelected || engine.frameSuppressed) return null;

                            const widthPx = model.frameWidth * scalePx;
                            const heightPx = model.frameHeight * scalePx;
                            const leftPx = (model.sheetX - model.frameWidth / 2) * scalePx;
                            const topPx = (paperDims.height - model.sheetY - model.frameHeight / 2) * scalePx;

                            return (
                                <div
                                    key={model.id}
                                    style={{
                                        position: 'absolute',
                                        left: `${leftPx}px`,
                                        top: `${topPx}px`,
                                        width: `${widthPx}px`,
                                        height: `${heightPx}px`,
                                        zIndex: 30,
                                        pointerEvents: 'none',
                                    }}
                                >
                                    <svg
                                        width="100%"
                                        height="100%"
                                        viewBox={`0 0 ${model.frameWidth} ${model.frameHeight}`}
                                        preserveAspectRatio="none"
                                        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
                                    >
                                        <rect
                                            x="0.4"
                                            y="0.4"
                                            width={Math.max(1, model.frameWidth - 0.8)}
                                            height={Math.max(1, model.frameHeight - 0.8)}
                                            fill="none"
                                            stroke="#2563eb"
                                            strokeWidth="0.6"
                                            strokeDasharray="3 2"
                                            rx="0"
                                            ry="0"
                                        />
                                    </svg>

                                    <div
                                        onMouseDown={(e) => handleStartDrag(model, e)}
                                        style={{
                                            position: 'absolute',
                                            top: '-18px',
                                            left: '0px',
                                            backgroundColor: '#2563eb',
                                            color: '#ffffff',
                                            padding: '1px 8px',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            cursor: 'move',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            zIndex: 45,
                                            pointerEvents: 'auto',
                                            userSelect: 'none',
                                        }}
                                        title="Przeciągnij, aby przesunąć widok po arkuszu"
                                    >
                                        <span>{model.name}</span>
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                engine.removeModel(model.id);
                                            }}
                                            style={{ cursor: 'pointer', fontWeight: 700 }}
                                            title="Usuń widok"
                                        >
                                            ×
                                        </span>
                                    </div>

                                    <div
                                        onMouseDown={(e) => handleStartDrag(model, e)}
                                        style={{
                                            position: 'absolute',
                                            top: '-4px',
                                            left: '8px',
                                            right: '8px',
                                            height: '8px',
                                            cursor: 'move',
                                            pointerEvents: 'auto',
                                        }}
                                        title="Przeciągnij prostokąt widoku"
                                    />
                                    <div
                                        onMouseDown={(e) => handleStartDrag(model, e)}
                                        style={{
                                            position: 'absolute',
                                            bottom: '-4px',
                                            left: '8px',
                                            right: '8px',
                                            height: '8px',
                                            cursor: 'move',
                                            pointerEvents: 'auto',
                                        }}
                                        title="Przeciągnij prostokąt widoku"
                                    />
                                    <div
                                        onMouseDown={(e) => handleStartDrag(model, e)}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            bottom: '8px',
                                            left: '-4px',
                                            width: '8px',
                                            cursor: 'move',
                                            pointerEvents: 'auto',
                                        }}
                                        title="Przeciągnij prostokąt widoku"
                                    />
                                    <div
                                        onMouseDown={(e) => handleStartDrag(model, e)}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            bottom: '8px',
                                            right: '-4px',
                                            width: '8px',
                                            cursor: 'move',
                                            pointerEvents: 'auto',
                                        }}
                                        title="Przeciągnij prostokąt widoku"
                                    />

                                    <div
                                        style={{ ...handleStyle, top: '-4px', left: '-4px', cursor: 'nwse-resize' }}
                                        onMouseDown={(e) => handleStartResize(model, 'nw', e)}
                                    />
                                    <div
                                        style={{ ...handleStyle, top: '-4px', left: `calc(50% - 4px)`, cursor: 'ns-resize' }}
                                        onMouseDown={(e) => handleStartResize(model, 'n', e)}
                                    />
                                    <div
                                        style={{ ...handleStyle, top: '-4px', right: '-4px', cursor: 'nesw-resize' }}
                                        onMouseDown={(e) => handleStartResize(model, 'ne', e)}
                                    />
                                    <div
                                        style={{ ...handleStyle, top: `calc(50% - 4px)`, right: '-4px', cursor: 'ew-resize' }}
                                        onMouseDown={(e) => handleStartResize(model, 'e', e)}
                                    />
                                    <div
                                        style={{ ...handleStyle, bottom: '-4px', right: '-4px', cursor: 'nwse-resize' }}
                                        onMouseDown={(e) => handleStartResize(model, 'se', e)}
                                    />
                                    <div
                                        style={{ ...handleStyle, bottom: '-4px', left: `calc(50% - 4px)`, cursor: 'ns-resize' }}
                                        onMouseDown={(e) => handleStartResize(model, 's', e)}
                                    />
                                    <div
                                        style={{ ...handleStyle, bottom: '-4px', left: '-4px', cursor: 'nesw-resize' }}
                                        onMouseDown={(e) => handleStartResize(model, 'sw', e)}
                                    />
                                    <div
                                        style={{ ...handleStyle, top: `calc(50% - 4px)`, left: '-4px', cursor: 'ew-resize' }}
                                        onMouseDown={(e) => handleStartResize(model, 'w', e)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface CubeFaceProps {
    title: string;
    transform: string;
    onClick: () => void;
}

const CubeFace: React.FC<CubeFaceProps> = ({ title, transform, onClick }) => (
    <div
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        style={{
            position: 'absolute',
            width: '70px',
            height: '70px',
            backgroundColor: 'rgba(30, 41, 59, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transform,
            transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.9)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.85)')}
    >
        {title}
    </div>
);
