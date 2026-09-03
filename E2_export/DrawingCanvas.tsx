/**
 * E2_export - DrawingCanvas.tsx
 * Interaktywny arkusz roboczy 2D (Multi-Kadry 3D + PMI):
 * Obsługa wielokrotnego przeciągania tego samego modelu (komody, szafki, formatki),
 * bezpośrednia zmiana perspektywy kamery kadru (Przód, Góra, Bok, Izometria),
 * asocjatywne wymiary PMI, Zoom & Pan i czyste renderowanie CAD.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    DrawingSheetModel,
    DrawingView2D,
    CADTreeNode,
    ProjectionAngle,
    PAPER_FORMATS,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    MARGIN_TOP,
    MARGIN_BOTTOM,
    TITLE_BLOCK_WIDTH,
    TITLE_BLOCK_HEIGHT,
} from './drawing-types';

interface DrawingCanvasProps {
    sheet: DrawingSheetModel;
    onUpdateViewPosition: (viewId: string, x: number, y: number) => void;
    onUpdateViewProjection: (viewId: string, projection: ProjectionAngle) => void;
    onUpdateViewScale: (viewId: string, scale: number, scaleText: string) => void;
    onToggleViewPMI: (viewId: string) => void;
    onDeleteView: (viewId: string) => void;
    onSelectView: (viewId: string | null) => void;
    selectedViewId: string | null;
    onDropNodeOnCanvas: (node: CADTreeNode, sheetX: number, sheetY: number) => void;
}

const CAMERA_ANGLES: { key: ProjectionAngle; label: string; icon: string }[] = [
    { key: 'FRONT', label: 'Przód', icon: '⏹' },
    { key: 'TOP', label: 'Góra', icon: '⬆' },
    { key: 'LEFT', label: 'Bok L', icon: '⬅' },
    { key: 'RIGHT', label: 'Bok P', icon: '➡' },
    { key: 'ISOMETRIC', label: 'Izometria', icon: '🧊' },
];

const SCALES = [
    { text: '1:5', value: 0.2 },
    { text: '1:10', value: 0.1 },
    { text: '1:15', value: 0.0667 },
    { text: '1:20', value: 0.05 },
    { text: '1:1', value: 1.0 },
];

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
    sheet,
    onUpdateViewPosition,
    onUpdateViewProjection,
    onUpdateViewScale,
    onToggleViewPMI,
    onDeleteView,
    onSelectView,
    selectedViewId,
    onDropNodeOnCanvas,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Stan transformacji widoku (Zoom & Pan)
    const [zoom, setZoom] = useState(1.2); // piksele na mm
    const [pan, setPan] = useState({ x: 100, y: 60 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });

    // Stan przeciągania rzutu po arkuszu
    const [draggingViewId, setDraggingViewId] = useState<string | null>(null);
    const [dragOffsetMm, setDragOffsetMm] = useState({ x: 0, y: 0 });
    const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

    const paperDims = PAPER_FORMATS[sheet.paperFormat] || PAPER_FORMATS['A4_LANDSCAPE'];
    const paperW = paperDims.width;
    const paperH = paperDims.height;

    // Centrowanie arkusza na starcie
    useEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const z = Math.min((rect.width - 80) / paperW, (rect.height - 80) / paperH);
            setZoom(z);
            setPan({
                x: (rect.width - paperW * z) / 2,
                y: (rect.height - paperH * z) / 2,
            });
        }
    }, [sheet.paperFormat, paperW, paperH]);

    // Zoom kółkiem myszy
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        const newZoom = Math.max(0.3, Math.min(4.0, zoom * factor));

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            setPan((prev) => ({
                x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
                y: mouseY - (mouseY - prev.y) * (newZoom / zoom),
            }));
            setZoom(newZoom);
        }
    };

    // Pan arkusza
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || e.button === 2 || (e.button === 0 && e.target === containerRef.current)) {
            setIsPanning(true);
            setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            onSelectView(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan({
                x: e.clientX - startPan.x,
                y: e.clientY - startPan.y,
            });
        } else if (draggingViewId) {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const sheetX = (mouseX - pan.x) / zoom;
                const sheetY = (mouseY - pan.y) / zoom;

                const newViewX = Math.round(sheetX - dragOffsetMm.x);
                const newViewY = Math.round(sheetY - dragOffsetMm.y);

                onUpdateViewPosition(draggingViewId, newViewX, newViewY);
            }
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setDraggingViewId(null);
    };

    const startDragView = (view: DrawingView2D, e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectView(view.id);

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const sheetX = (mouseX - pan.x) / zoom;
            const sheetY = (mouseY - pan.y) / zoom;

            setDraggingViewId(view.id);
            setDragOffsetMm({
                x: sheetX - view.x,
                y: sheetY - view.y,
            });
        }
    };

    // ─── Drag & Drop z drzewa obiektów ───

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOverCanvas(true);
    };

    const handleDragLeave = () => {
        setIsDragOverCanvas(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOverCanvas(false);

        try {
            const rawData = e.dataTransfer.getData('application/json');
            if (rawData && containerRef.current) {
                const node: CADTreeNode = JSON.parse(rawData);
                const rect = containerRef.current.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const sheetX = Math.round((mouseX - pan.x) / zoom);
                const sheetY = Math.round((mouseY - pan.y) / zoom);

                onDropNodeOnCanvas(node, sheetX, sheetY);
            }
        } catch (err) {
            console.error('Błąd podczas upuszczania elementu na arkusz:', err);
        }
    };

    const resetViewToFit = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const z = Math.min((rect.width - 80) / paperW, (rect.height - 80) / paperH);
            setZoom(z);
            setPan({
                x: (rect.width - paperW * z) / 2,
                y: (rect.height - paperH * z) / 2,
            });
        }
    };

    return (
        <div
            ref={containerRef}
            style={{
                flex: 1,
                height: '100%',
                backgroundColor: '#090d16',
                backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                position: 'relative',
                overflow: 'hidden',
                cursor: isPanning ? 'grabbing' : draggingViewId ? 'move' : 'default',
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Wskaźnik podświetlenia upuszczenia z drzewa */}
            {isDragOverCanvas && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(37, 99, 235, 0.12)',
                        border: '2px dashed #3b82f6',
                        zIndex: 20,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#93c5fd',
                        fontSize: '15px',
                        fontWeight: 600,
                    }}
                >
                    📥 Upuść tutaj, aby wstawić kadr 3D na arkusz
                </div>
            )}

            {/* Pływający pasek nawigacji widoku (Zoom Controls) */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '16px',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(8px)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    fontSize: '12px',
                    color: '#94a3b8',
                }}
            >
                <button
                    onClick={() => setZoom((z) => Math.max(0.3, z * 0.85))}
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer' }}
                >
                    −
                </button>
                <span style={{ minWidth: '45px', textAlign: 'center', fontWeight: 600, color: '#60a5fa' }}>
                    {Math.round((zoom / 1.0) * 100)}%
                </span>
                <button
                    onClick={() => setZoom((z) => Math.min(4.0, z * 1.15))}
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer' }}
                >
                    +
                </button>
                <button
                    onClick={resetViewToFit}
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', marginLeft: '4px' }}
                >
                    ⤢ Dopasuj
                </button>
            </div>

            {/* Obszar Arkusza Papieru (Biały Canvas 2D) */}
            <div
                style={{
                    position: 'absolute',
                    left: `${pan.x}px`,
                    top: `${pan.y}px`,
                    width: `${paperW * zoom}px`,
                    height: `${paperH * zoom}px`,
                    backgroundColor: '#ffffff',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)',
                    transition: isPanning || draggingViewId ? 'none' : 'box-shadow 0.2s',
                    transformOrigin: '0 0',
                }}
            >
                {/* Ramka rysunkowa CAD (Gruba zewnętrzna + cienka wewnętrzna) */}
                <svg
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                    }}
                    viewBox={`0 0 ${paperW} ${paperH}`}
                >
                    <rect
                        x={MARGIN_LEFT}
                        y={MARGIN_TOP}
                        width={paperW - MARGIN_LEFT - MARGIN_RIGHT}
                        height={paperH - MARGIN_TOP - MARGIN_BOTTOM}
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="0.7"
                    />

                    <rect
                        x={MARGIN_LEFT + 1.0}
                        y={MARGIN_TOP + 1.0}
                        width={paperW - MARGIN_LEFT - MARGIN_RIGHT - 2.0}
                        height={paperH - MARGIN_TOP - MARGIN_BOTTOM - 2.0}
                        fill="none"
                        stroke="#475569"
                        strokeWidth="0.25"
                    />

                    {/* Tabelka Rysunkowa ISO 7200 */}
                    <g
                        transform={`translate(${paperW - MARGIN_RIGHT - TITLE_BLOCK_WIDTH}, ${paperH - MARGIN_BOTTOM - TITLE_BLOCK_HEIGHT})`}
                    >
                        <rect x="0" y="0" width={TITLE_BLOCK_WIDTH} height={TITLE_BLOCK_HEIGHT} fill="#ffffff" stroke="#0f172a" strokeWidth="0.7" />
                        <line x1="0" y1="12" x2={TITLE_BLOCK_WIDTH} y2="12" stroke="#475569" strokeWidth="0.35" />
                        <line x1="0" y1="21" x2={TITLE_BLOCK_WIDTH} y2="21" stroke="#475569" strokeWidth="0.35" />
                        <line x1="80" y1="0" x2="80" y2={TITLE_BLOCK_HEIGHT} stroke="#475569" strokeWidth="0.35" />
                        <line x1="100" y1="21" x2="100" y2={TITLE_BLOCK_HEIGHT} stroke="#475569" strokeWidth="0.35" />

                        <text x="2" y="3.5" fontSize="1.5" fill="#64748b" fontFamily="'Segoe UI', sans-serif">Projekt / Mebel</text>
                        <text x="2" y="9" fontSize="3.2" fill="#0f172a" fontFamily="'Segoe UI', sans-serif" fontWeight="bold">
                            {sheet.titleBlock.furnitureName || sheet.titleBlock.projectName || 'Mebel CAD'}
                        </text>

                        <text x="82" y="3.5" fontSize="1.5" fill="#64748b" fontFamily="'Segoe UI', sans-serif">Nr rysunku</text>
                        <text x="82" y="9" fontSize="3.0" fill="#0f172a" fontFamily="'Segoe UI', sans-serif" fontWeight="bold">
                            {sheet.titleBlock.drawingNumber || 'SB-001'}
                        </text>

                        <text x="2" y="15" fontSize="1.3" fill="#64748b" fontFamily="'Segoe UI', sans-serif">
                            Wykonał: <tspan fill="#0f172a" fontWeight="600">{sheet.titleBlock.author}</tspan>
                        </text>
                        <text x="82" y="15" fontSize="1.3" fill="#64748b" fontFamily="'Segoe UI', sans-serif">
                            Data: <tspan fill="#0f172a" fontWeight="600">{sheet.titleBlock.date}</tspan>
                        </text>

                        <text x="2" y="24" fontSize="1.3" fill="#64748b" fontFamily="'Segoe UI', sans-serif">
                            Format: <tspan fill="#0f172a" fontWeight="600">{sheet.paperFormat.split('_')[0]}</tspan>
                        </text>
                        <text x="82" y="24" fontSize="1.3" fill="#64748b" fontFamily="'Segoe UI', sans-serif">
                            Skala: <tspan fill="#0f172a" fontWeight="600">{sheet.titleBlock.scale || '1:10'}</tspan>
                        </text>
                    </g>
                </svg>

                {/* Warstwa Multi-Kadrów 3D z wymiarami PMI */}
                {sheet.views.map((view) => {
                    const isSelected = selectedViewId === view.id;

                    return (
                        <div
                            key={view.id}
                            style={{
                                position: 'absolute',
                                left: `${view.x * zoom}px`,
                                top: `${view.y * zoom}px`,
                                cursor: 'move',
                                userSelect: 'none',
                                zIndex: isSelected ? 15 : 2,
                            }}
                            onMouseDown={(e) => startDragView(view, e)}
                        >
                            {/* Kadr CAD z interaktywnym paskiem narzędzi */}
                            <div
                                style={{
                                    border: isSelected ? '1.5px dashed #2563eb' : '1px solid transparent',
                                    borderRadius: '2px',
                                    padding: '1px',
                                    position: 'relative',
                                }}
                            >
                                {/* Pływający pasek sterowania kadrem (widoczny po zaznaczeniu) */}
                                {isSelected && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '-36px',
                                            left: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            background: '#0f172a',
                                            padding: '3px 6px',
                                            borderRadius: '5px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                            border: '1px solid #334155',
                                            zIndex: 30,
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        {/* Kąty kamery */}
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                            {CAMERA_ANGLES.map((ang) => (
                                                <button
                                                    key={ang.key}
                                                    onClick={() => onUpdateViewProjection(view.id, ang.key)}
                                                    style={{
                                                        background: view.projection === ang.key ? '#2563eb' : '#1e293b',
                                                        color: view.projection === ang.key ? '#fff' : '#94a3b8',
                                                        border: '1px solid #334155',
                                                        borderRadius: '3px',
                                                        padding: '2px 6px',
                                                        fontSize: '10px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                    title={`Zmień rzut na: ${ang.label}`}
                                                >
                                                    {ang.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div style={{ width: '1px', height: '14px', background: '#334155', margin: '0 2px' }} />

                                        {/* Przełącznik PMI */}
                                        <button
                                            onClick={() => onToggleViewPMI(view.id)}
                                            style={{
                                                background: view.showPMI ? '#059669' : '#1e293b',
                                                color: '#fff',
                                                border: '1px solid #334155',
                                                borderRadius: '3px',
                                                padding: '2px 6px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                            title="Włącz/Wyłącz wymiary PMI w tym kadrze"
                                        >
                                            📐 PMI {view.showPMI ? '✓' : '✗'}
                                        </button>

                                        {/* Skala kadru */}
                                        <select
                                            value={view.scaleText}
                                            onChange={(e) => {
                                                const found = SCALES.find((s) => s.text === e.target.value);
                                                if (found) onUpdateViewScale(view.id, found.value, found.text);
                                            }}
                                            style={{
                                                background: '#1e293b',
                                                color: '#fff',
                                                border: '1px solid #334155',
                                                borderRadius: '3px',
                                                padding: '2px 4px',
                                                fontSize: '10px',
                                                cursor: 'pointer',
                                                outline: 'none',
                                            }}
                                        >
                                            {SCALES.map((s) => (
                                                <option key={s.text} value={s.text}>
                                                    {s.text}
                                                </option>
                                            ))}
                                        </select>

                                        {/* Usuń kadr */}
                                        <button
                                            onClick={() => onDeleteView(view.id)}
                                            style={{
                                                background: '#ef4444',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '3px',
                                                padding: '2px 6px',
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                            }}
                                            title="Usuń ten kadr z arkusza"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}

                                {/* Etykieta techniczna kadru (Standardowy podpis CAD pod lub nad rzutem) */}
                                <div
                                    style={{
                                        fontSize: `${Math.max(8, 2.2 * zoom)}px`,
                                        color: isSelected ? '#1d4ed8' : '#0f172a',
                                        fontWeight: 700,
                                        fontFamily: "'Segoe UI', Arial, sans-serif",
                                        marginBottom: '2px',
                                        letterSpacing: '0.2px',
                                    }}
                                >
                                    • {view.title} ({view.scaleText})
                                </div>

                                {/* Wyrenderowany Wektor SVG Rzutu 3D + Wymiary PMI */}
                                <div
                                    dangerouslySetInnerHTML={{ __html: view.svgCode }}
                                    style={{
                                        display: 'block',
                                        pointerEvents: 'none',
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}

                {/* Komunikat o pustym arkuszu */}
                {sheet.views.length === 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '45%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                            color: '#94a3b8',
                            fontSize: `${Math.max(12, 3.5 * zoom)}px`,
                            pointerEvents: 'none',
                            fontFamily: "'Segoe UI', sans-serif",
                        }}
                    >
                        <div style={{ fontSize: `${Math.max(22, 6 * zoom)}px`, marginBottom: '6px' }}>📐</div>
                        Arkusz jest pusty.<br />
                        <span style={{ fontSize: `${Math.max(11, 2.7 * zoom)}px`, color: '#64748b' }}>
                            Przeciągnij model (np. <strong>komodę</strong>) z drzewa po lewej stronie na arkusz — możesz upuścić go <strong>wielokrotnie z różnymi widokami (Przód, Góra, Izometria)</strong>!
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
