/**
 * E3_export - E3Studio.tsx
 * Studio Rysunków Technicznych CAD 3D (Eksport 3)
 * Zawiera pełną kopię natywnego drzewa mebla (Biblioteka), płótno 3D Babylon.js z arkuszem CAD,
 * Kostkę Widoków (ViewCube), górną belkę rzutów i niezależny obrót każdego modelu z wymiarami PMI 3D.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { E3LibraryExtractor } from './e3-library-extractor';
import { E3SceneEngine } from './e3-3d-scene-engine';
import { E3LibraryItem, E3ProjectionAngle, E3PaperFormat, E3_PAPER_FORMATS } from './e3-library-types';

export const E3Studio: React.FC = () => {
    const sceneEngine = useMemo(() => E3SceneEngine.instance, []);
    const extractor = useMemo(() => E3LibraryExtractor.instance, []);

    const [libraryItems, setLibraryItems] = useState<E3LibraryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
    const [, setTick] = useState(0);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Inicjalizacja sceny 3D i wczytanie drzewa
    useEffect(() => {
        const items = extractor.loadLibrary();
        setLibraryItems(items);

        if (canvasRef.current) {
            sceneEngine.init(canvasRef.current);
        }

        const unsubscribe = sceneEngine.subscribe(() => {
            setTick((t) => t + 1);
        });

        return () => {
            unsubscribe();
        };
    }, [sceneEngine, extractor]);

    const toggleFolder = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCanvasDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleCanvasDrop = (e: React.DragEvent) => {
        e.preventDefault();
        try {
            const rawData = e.dataTransfer.getData('application/e3-library-item');
            if (rawData) {
                const item: E3LibraryItem = JSON.parse(rawData);
                sceneEngine.addModel3DFromItem(item, 'front');
            }
        } catch (err) {
            console.warn('Błąd upuszczania modelu 3D:', err);
        }
    };

    const activeModel = sceneEngine.placedModels.find((m) => m.id === sceneEngine.activeModelId);

    return (
        <div
            style={{
                display: 'flex',
                width: '100vw',
                height: '100vh',
                backgroundColor: '#0b0f19',
                color: '#f1f5f9',
                fontFamily: "'Inter', sans-serif",
                overflow: 'hidden',
                userSelect: 'none',
                position: 'relative',
            }}
        >
            {/* ─── LEWY PANEL: DOKŁADNE DRZEWO OBIEKTÓW (BIBLIOTEKA) ─── */}
            <div
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
                {/* Nagłówek drzewa */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #1f2937' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>🌳</span> Drzewo Obiektów
                        </h2>
                        <button
                            onClick={() => setLibraryItems(extractor.syncLibrary())}
                            title="Odśwież z aktywnej sceny CAD"
                            style={{
                                background: 'transparent',
                                border: '1px solid #374151',
                                color: '#9ca3af',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                cursor: 'pointer',
                                fontSize: '11px',
                            }}
                        >
                            🔄 Odśwież
                        </button>
                    </div>
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', marginBottom: '8px' }}>
                        Przeciągnij dowolny element na scenę 3D
                    </p>

                    {/* Wyszukiwarka */}
                    <input
                        type="text"
                        placeholder="Szukaj w drzewie..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '6px 10px',
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '5px',
                            color: '#ffffff',
                            fontSize: '12px',
                            outline: 'none',
                        }}
                    />
                </div>

                {/* Drzewo komponentów */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {libraryItems.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#6b7280', padding: '30px 10px', fontSize: '12px' }}>
                            Brak obiektów w projekcie.<br />
                            Zbuduj mebel w scenie głównej i kliknij „Odśwież”.
                        </div>
                    ) : (
                        libraryItems.map((item) => {
                            const isCollapsed = !!collapsedFolders[item.id];
                            return (
                                <div key={item.id} style={{ marginBottom: '6px' }}>
                                    {/* Węzeł główny (Korpus / Kontener) */}
                                    <div
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('application/e3-library-item', JSON.stringify(item));
                                            e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        style={{
                                            backgroundColor: '#1e293b',
                                            border: '1px solid #334155',
                                            borderRadius: '6px',
                                            padding: '8px 10px',
                                            cursor: 'grab',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                            {item.children && item.children.length > 0 && (
                                                <span
                                                    onClick={(e) => toggleFolder(item.id, e)}
                                                    style={{ cursor: 'pointer', fontSize: '10px', color: '#94a3b8' }}
                                                >
                                                    {isCollapsed ? '▶' : '▼'}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '14px' }}>{item.type === 'CONTAINER' ? '🗄️' : '🪵'}</span>
                                            <div style={{ minWidth: 0 }}>
                                                <strong style={{ fontSize: '12px', color: '#f8fafc', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                    {item.name}
                                                </strong>
                                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                                    ({item.width} × {item.height} × {item.depth} mm)
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => sceneEngine.addModel3DFromItem(item, 'front')}
                                            style={{
                                                backgroundColor: '#2563eb',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '3px 8px',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                            title="Wstaw model 3D na arkusz"
                                        >
                                            + 3D
                                        </button>
                                    </div>

                                    {/* Dzieci węzła (Formatki w korpusie) */}
                                    {!isCollapsed && item.children && item.children.length > 0 && (
                                        <div style={{ paddingLeft: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            {item.children.map((child) => (
                                                <div
                                                    key={child.id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('application/e3-library-item', JSON.stringify(child));
                                                        e.dataTransfer.effectAllowed = 'copy';
                                                    }}
                                                    style={{
                                                        backgroundColor: '#0f172a',
                                                        border: '1px solid #1e293b',
                                                        borderRadius: '4px',
                                                        padding: '6px 8px',
                                                        cursor: 'grab',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                    }}
                                                >
                                                    <div style={{ minWidth: 0 }}>
                                                        <span style={{ fontSize: '11px', color: '#e2e8f0', display: 'block' }}>
                                                            📄 {child.name}
                                                        </span>
                                                        <span style={{ fontSize: '9px', color: '#64748b' }}>
                                                            {child.width}×{child.height}×{child.depth} mm
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => sceneEngine.addModel3DFromItem(child, 'front')}
                                                        style={{
                                                            backgroundColor: '#334155',
                                                            color: '#ffffff',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            padding: '2px 6px',
                                                            fontSize: '10px',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ─── CENTRALNA SCENA 3D Z PŁÓTNEM BABYLON.JS ─── */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#ffffff',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* ─── GÓRNA BELKA WIDOKÓW / RZUTÓW ─── */}
                <div
                    style={{
                        position: 'absolute',
                        top: '12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(17, 24, 39, 0.92)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        zIndex: 20,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    }}
                >
                    <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600, marginRight: '4px' }}>
                        {activeModel ? `Rzut [${activeModel.name}]:` : 'Rzut aktywnego modelu:'}
                    </span>

                    {(['front', 'top', 'right', 'left', 'back', 'isometric'] as E3ProjectionAngle[]).map((ang) => {
                        const labels: Record<string, string> = {
                            front: 'Przód',
                            top: 'Góra',
                            right: 'Bok Prawy',
                            left: 'Bok Lewy',
                            back: 'Tył',
                            isometric: 'Izometria 3D',
                        };
                        const isCurrent = activeModel?.angle === ang;
                        return (
                            <button
                                key={ang}
                                onClick={() => sceneEngine.rotateActiveModel(ang)}
                                style={{
                                    backgroundColor: isCurrent ? '#2563eb' : 'transparent',
                                    color: isCurrent ? '#ffffff' : '#cbd5e1',
                                    border: isCurrent ? '1px solid #3b82f6' : '1px solid transparent',
                                    borderRadius: '5px',
                                    padding: '4px 9px',
                                    fontSize: '11px',
                                    fontWeight: isCurrent ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {labels[ang]}
                            </button>
                        );
                    })}
                </div>

                {/* ─── INTERAKTYWNA KOSTKA WIDOKÓW (VIEWCUBE) ─── */}
                <div id="view-cube-container" className="view-cube-container" style={{ position: 'absolute', top: '12px', right: '16px', zIndex: 20 }}>
                    <div id="view-cube-wrapper" className="view-cube-wrapper">
                        <div className="cube-face face-front" onClick={() => sceneEngine.rotateActiveModel('front')}>PRZÓD</div>
                        <div className="cube-face face-back" onClick={() => sceneEngine.rotateActiveModel('back')}>TYŁ</div>
                        <div className="cube-face face-left" onClick={() => sceneEngine.rotateActiveModel('left')}>LEWY</div>
                        <div className="cube-face face-right" onClick={() => sceneEngine.rotateActiveModel('right')}>PRAWY</div>
                        <div className="cube-face face-top" onClick={() => sceneEngine.rotateActiveModel('top')}>GÓRA</div>
                        <div className="cube-face face-bottom" onClick={() => sceneEngine.rotateActiveModel('top')}>DÓŁ</div>
                    </div>
                </div>

                {/* ─── GŁÓWNY CANVAS BABYLON.JS ─── */}
                <canvas
                    id="e3RenderCanvas"
                    ref={canvasRef}
                    onDragOver={handleCanvasDragOver}
                    onDrop={handleCanvasDrop}
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        outline: 'none',
                    }}
                />

                {/* ─── DOLNY PASEK NARZĘDZI I EKSPORTU ─── */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(17, 24, 39, 0.92)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        zIndex: 20,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    }}
                >
                    {/* Format Papieru */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>Format:</span>
                        <select
                            value={sceneEngine.paperFormat}
                            onChange={(e) => sceneEngine.setPaperFormat(e.target.value as E3PaperFormat)}
                            style={{
                                backgroundColor: '#1f2937',
                                border: '1px solid #374151',
                                color: '#ffffff',
                                borderRadius: '4px',
                                padding: '3px 6px',
                                fontSize: '11px',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            {(Object.keys(E3_PAPER_FORMATS) as E3PaperFormat[]).map((fmt) => (
                                <option key={fmt} value={fmt}>
                                    {E3_PAPER_FORMATS[fmt].label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <span style={{ height: '14px', width: '1px', backgroundColor: '#374151' }}></span>

                    {/* Liczba rzutów */}
                    <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                        Modele na arkuszu: <strong>{sceneEngine.placedModels.length}</strong>
                    </span>

                    {sceneEngine.placedModels.length > 0 && (
                        <button
                            onClick={() => {
                                if (confirm('Wyczyścić wszystkie modele z arkusza?')) {
                                    sceneEngine.clearAllModels();
                                }
                            }}
                            style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                            }}
                        >
                            ✕ Wyczyść
                        </button>
                    )}

                    <span style={{ height: '14px', width: '1px', backgroundColor: '#374151' }}></span>

                    {/* Przyciski Eksportu */}
                    <button
                        onClick={() => sceneEngine.printSheet()}
                        style={{
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '5px',
                            padding: '5px 12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        🖨️ Drukuj / PDF
                    </button>

                    <button
                        onClick={() => sceneEngine.downloadJpgScreenshot()}
                        style={{
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '5px',
                            padding: '5px 12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        🖼️ Pobierz JPG
                    </button>
                </div>
            </div>
        </div>
    );
};
