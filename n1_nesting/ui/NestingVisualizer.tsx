/**
 * Komponent React do wizualizacji i interaktywnej edycji rozkroju
 * Zawiera:
 * - Proste przesuwanie formatek myszą (Drag & Move)
 * - Obracanie formatki co 15° (przyciski ↺ -15°, ↻ +15°, ↺ 90° oraz klawisz R)
 * - Wykrywanie i wizualną sygnalizację kolizji (czerwone podświetlenie)
 * - Inteligentne etykietowanie formatek smukłych/pionowych (np. cokołów)
 * - Dynamiczny zoom kółkiem myszy
 */

import React, { useState, useEffect, useRef } from 'react';
import { NestingResult, SheetConfig, PackedPart, PackedBoard, getPartLabelLines } from '../core/nesting-types';
import { resolveClampedMovePosition, isPositionColliding, getPartAABB } from '../core/nesting-snap';

interface NestingVisualizerProps {
    result: NestingResult | null;
    config: SheetConfig;
    selectedPartId?: string | null;
    onSelectPart?: (part: PackedPart | null) => void;
}

interface BoardZoom {
    scale: number;
    originX: number; // procent 0-100
    originY: number; // procent 0-100
}

interface DragState {
    boardIndex: number;
    partId: string;
    startX: number;
    startY: number;
    initialPartX: number;
    initialPartY: number;
    svgWidth: number;
    svgHeight: number;
    boardWidth: number;
    boardHeight: number;
}

/**
 * Sprawdza czy formatka ma fizyczną kolizję (nachodzenie materiału) z inną formatką lub wystaje poza arkusz.
 * Dla sygnalizacji wizualnej kolizja zachodzi, gdy elementy fizycznie nakładają się na siebie (kerf = 0)
 * lub przekraczają marginesy arkusza.
 */
function checkPartCollision(part: PackedPart, layout: PackedPart[], boardW: number, boardH: number, trimMargin: number = 10): boolean {
    return isPositionColliding(part, part.x, part.y, layout, boardW, boardH, 0, trimMargin);
}

export const NestingVisualizer: React.FC<NestingVisualizerProps> = ({
    result,
    config,
    selectedPartId,
    onSelectPart
}) => {
    const [zoomMap, setZoomMap] = useState<Record<number, BoardZoom>>({});
    const [activeBoards, setActiveBoards] = useState<PackedBoard[]>([]);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const svgRefs = useRef<Record<number, SVGSVGElement | null>>({});

    // Synchronizacja po przeliczeniu rozkroju
    useEffect(() => {
        if (result && result.boards) {
            setActiveBoards(result.boards);
        } else {
            setActiveBoards([]);
        }
    }, [result]);

    const getBoardZoom = (bIdx: number): BoardZoom => {
        return zoomMap[bIdx] || { scale: 1.0, originX: 50, originY: 50 };
    };

    const setBoardZoom = (bIdx: number, updater: (curr: BoardZoom) => BoardZoom) => {
        setZoomMap((prev) => ({
            ...prev,
            [bIdx]: updater(prev[bIdx] || { scale: 1.0, originX: 50, originY: 50 })
        }));
    };

    // Zoom: tylko Shift + kółko; zwykły scroll przewija stronę (Ctrl zoomuje przeglądarkę)
    const handleWheelZoom = (e: React.WheelEvent<SVGSVGElement>, bIdx: number) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const mouseY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        const delta = e.deltaY < 0 ? 1.25 : 0.8;

        setBoardZoom(bIdx, (curr) => {
            const newScale = Math.min(6.0, Math.max(1.0, curr.scale * delta));
            return {
                scale: newScale,
                originX: curr.scale === 1.0 ? mouseX : (curr.originX * 0.4 + mouseX * 0.6),
                originY: curr.scale === 1.0 ? mouseY : (curr.originY * 0.4 + mouseY * 0.6)
            };
        });
    };

    // Obrót formatki o zadany kąt (np. +15°, -15°, +90°)
    const rotatePart = (partId: string, boardIndex: number, deltaAngle: number) => {
        setActiveBoards(prev => prev.map(board => {
            if (board.boardIndex !== boardIndex) return board;
            const newLayout = board.layout.map(p => {
                if (p.partId !== partId) return p;
                const currentAngle = p.rotationAngle ?? 0;
                const nextAngle = (currentAngle + deltaAngle + 360) % 360;
                const updated = {
                    ...p,
                    rotationAngle: nextAngle,
                    rotated: nextAngle % 180 !== 0
                };
                // Dopasowanie pozycji, aby formatka nie wystawała poza margines arkusza
                const aabb = getPartAABB(updated);
                const trim = config.trimMargin || 10;
                let adjX = updated.x;
                let adjY = updated.y;
                if (aabb.minX < trim) adjX += (trim - aabb.minX);
                if (aabb.maxX > board.width - trim) adjX -= (aabb.maxX - (board.width - trim));
                if (aabb.minY < trim) adjY += (trim - aabb.minY);
                if (aabb.maxY > board.height - trim) adjY -= (aabb.maxY - (board.height - trim));

                updated.x = Math.round(adjX);
                updated.y = Math.round(adjY);
                return updated;
            });
            return { ...board, layout: newLayout };
        }));
    };

    // Skrót klawiszowy R / Shift+R do obrotu wybranej formatki co 15°
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedPartId) return;
            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                const delta = e.shiftKey ? -15 : 15;
                const targetBoard = activeBoards.find(bd => bd.layout.some(p => p.partId === selectedPartId));
                if (targetBoard) {
                    rotatePart(selectedPartId, targetBoard.boardIndex, delta);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedPartId, activeBoards]);

    // Obsługa przesuwania myszą (Drag & Move)
    const handleMouseDownPart = (e: React.MouseEvent, part: PackedPart, board: PackedBoard) => {
        if (e.button !== 0) return; // tylko LPM
        e.stopPropagation();

        if (onSelectPart) {
            onSelectPart(part);
        }

        const svgEl = svgRefs.current[board.boardIndex];
        if (!svgEl) return;

        const rect = svgEl.getBoundingClientRect();

        setDragState({
            boardIndex: board.boardIndex,
            partId: part.partId,
            startX: e.clientX,
            startY: e.clientY,
            initialPartX: part.x,
            initialPartY: part.y,
            svgWidth: rect.width,
            svgHeight: rect.height,
            boardWidth: board.width,
            boardHeight: board.height
        });
    };

    useEffect(() => {
        if (!dragState) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dxPx = e.clientX - dragState.startX;
            const dyPx = e.clientY - dragState.startY;

            const scaleX = dragState.boardWidth / dragState.svgWidth;
            const scaleY = dragState.boardHeight / dragState.svgHeight;

            const rawX = Math.round(dragState.initialPartX + dxPx * scaleX);
            const rawY = Math.round(dragState.initialPartY + dyPx * scaleY);

            const targetBoard = activeBoards.find(b => b.boardIndex === dragState.boardIndex);
            const draggedPart = targetBoard?.layout.find(p => p.partId === dragState.partId);

            if (!draggedPart || !targetBoard) return;

            let finalX = rawX;
            let finalY = rawY;

            if (!e.altKey) {
                const resolved = resolveClampedMovePosition(
                    draggedPart,
                    rawX,
                    rawY,
                    draggedPart.x,
                    draggedPart.y,
                    targetBoard.layout,
                    dragState.boardWidth,
                    dragState.boardHeight,
                    config.kerf || 4,
                    config.trimMargin || 10
                );
                finalX = resolved.x;
                finalY = resolved.y;
            }

            setActiveBoards(prev => prev.map(board => {
                if (board.boardIndex !== dragState.boardIndex) return board;
                const newLayout = board.layout.map(p => {
                    if (p.partId !== dragState.partId) return p;
                    return { ...p, x: finalX, y: finalY };
                });
                return { ...board, layout: newLayout };
            }));
        };

        const handleMouseUp = () => {
            setDragState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, activeBoards, config]);

    if (!result || activeBoards.length === 0) {
        return (
            <div className="nesting-boards-viewport" style={{ justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', opacity: 0.6 }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                    <p style={{ fontSize: '1rem', fontWeight: 500 }}>Brak wygenerowanego rozkroju</p>
                    <p style={{ fontSize: '0.85rem' }}>Kliknij „Generuj Rozkrój” po lewej stronie, aby zoptymalizować ułożenie formatek.</p>
                </div>
            </div>
        );
    }

    /**
     * Etykieta: wiersz 1 = mebel/projekt, wiersz 2 = formatka (+ wymiary).
     * Współrzędne świata (rect ma x/y absolutne).
     */
    const renderPartLabel = (part: PackedPart) => {
        const cx = part.x + part.w / 2;
        const cy = part.y + part.h / 2;
        const isVertical = part.h >= part.w * 1.15;
        const isHorizontal = part.w >= part.h * 1.15;
        const { project, panel } = getPartLabelLines(part);
        const dims = `${part.realW} × ${part.realH}`;
        const hasProject = !!project;

        const refSize = isVertical ? part.w : (isHorizontal ? part.h : Math.min(part.w, part.h));
        const fontProject = Math.min(32, Math.max(12, refSize * (hasProject ? 0.28 : 0.34)));
        const fontPanel = Math.min(38, Math.max(14, refSize * (hasProject ? 0.34 : 0.38)));
        const fontDims = Math.min(26, Math.max(11, refSize * 0.24));

        if (part.w < 28 || part.h < 28) return null;
        if (isVertical && part.h < 90) return null;
        if (isHorizontal && part.w < 90) return null;
        if (!isVertical && !isHorizontal && (part.w < 70 || part.h < 45)) return null;

        const lineGap = Math.max(fontPanel * 0.85, fontDims * 0.9);
        const lines: { text: string; size: number; cls: string }[] = [];
        if (hasProject) lines.push({ text: project, size: fontProject, cls: 'svg-label-name svg-label-project' });
        lines.push({ text: panel, size: fontPanel, cls: 'svg-label-name' });
        if (refSize >= 48) lines.push({ text: dims, size: fontDims, cls: 'svg-label-dims' });

        const totalSpan = (lines.length - 1) * lineGap;
        let y = cy - totalSpan / 2;
        const texts = lines.map((line, i) => {
            const node = (
                <text
                    key={i}
                    x={cx}
                    y={y}
                    className={line.cls}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fontSize: `${line.size}px` }}
                >
                    {line.text}
                </text>
            );
            y += lineGap;
            return node;
        });

        if (isVertical) {
            return (
                <g transform={`rotate(-90, ${cx}, ${cy})`} style={{ pointerEvents: 'none' }}>
                    {texts}
                </g>
            );
        }
        return <g style={{ pointerEvents: 'none' }}>{texts}</g>;
    };

    return (
        <div className="nesting-boards-viewport">
            {activeBoards.map((board) => {
                const ratio = board.height / board.width;
                const displayWidth = Math.min(860, window.innerWidth * 0.55);
                const displayHeight = displayWidth * ratio;
                const zoom = getBoardZoom(board.boardIndex);
                const selectedPartInThisBoard = board.layout.find(p => p.partId === selectedPartId);

                return (
                    <div key={board.boardIndex} className="nesting-board-card">
                        <div className="nesting-board-header" style={{ width: `${displayWidth}px` }}>
                            <span>
                                <strong>Arkusz #{board.boardIndex}</strong> ({board.width} × {board.height} mm)
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>
                                    Wykorzystanie: <strong style={{ color: '#818cf8' }}>{board.utilizationPercent.toFixed(1)}%</strong> | Odpad: {board.wastePercent.toFixed(1)}%
                                </span>

                                {/* Narzędzia Zoom na arkuszu */}
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', background: '#1e212b', padding: '2px 5px', borderRadius: '4px', border: '1px solid #374151' }}>
                                    <button
                                        onClick={() => setBoardZoom(board.boardIndex, (c) => ({ ...c, scale: Math.min(6.0, c.scale * 1.25) }))}
                                        title="Przybliż na wskaźnik (+)"
                                        style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', fontSize: '11px', padding: '1px 4px', fontWeight: 700 }}
                                    >
                                        🔍+
                                    </button>
                                    <button
                                        onClick={() => setBoardZoom(board.boardIndex, (c) => ({ ...c, scale: Math.max(1.0, c.scale * 0.8) }))}
                                        title="Oddal (-)"
                                        style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', fontSize: '11px', padding: '1px 4px', fontWeight: 700 }}
                                    >
                                        🔍-
                                    </button>
                                    {zoom.scale > 1.01 && (
                                        <button
                                            onClick={() => setBoardZoom(board.boardIndex, () => ({ scale: 1.0, originX: 50, originY: 50 }))}
                                            title="Zresetuj widok do 100%"
                                            style={{ background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '10px', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}
                                        >
                                            {Math.round(zoom.scale * 100)}% ✕
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pływający pasek narzędzi obrotu wybranej formatki */}
                        {selectedPartInThisBoard && (
                            <div style={{
                                width: `${displayWidth}px`,
                                background: 'rgba(24, 24, 27, 0.95)',
                                borderBottom: '1px solid #3f3f46',
                                padding: '6px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '11px',
                                color: '#f4f4f5'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#facc15', fontWeight: 700 }}>
                                        🎯 {selectedPartInThisBoard.name}
                                    </span>
                                    <span style={{ color: '#a1a1aa' }}>
                                        Kąt: <strong>{selectedPartInThisBoard.rotationAngle ?? 0}°</strong>
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '10px', color: '#71717a' }}>Obrót:</span>
                                    <button
                                        onClick={() => rotatePart(selectedPartInThisBoard.partId, board.boardIndex, -15)}
                                        title="Obróć o -15 stopni (Shift+R)"
                                        style={{ background: '#27272a', border: '1px solid #3f3f46', color: '#fff', padding: '2px 7px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '10px' }}
                                    >
                                        ↺ -15°
                                    </button>
                                    <button
                                        onClick={() => rotatePart(selectedPartInThisBoard.partId, board.boardIndex, 15)}
                                        title="Obróć o +15 stopni (Klawisz R)"
                                        style={{ background: '#27272a', border: '1px solid #3f3f46', color: '#fff', padding: '2px 7px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '10px' }}
                                    >
                                        ↻ +15°
                                    </button>
                                    <button
                                        onClick={() => rotatePart(selectedPartInThisBoard.partId, board.boardIndex, 90)}
                                        title="Obróć o 90 stopni"
                                        style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '10px' }}
                                    >
                                        ↺ 90°
                                    </button>
                                </div>
                            </div>
                        )}

                        <div
                            style={{
                                width: `${displayWidth * zoom.scale}px`,
                                height: `${displayHeight * zoom.scale}px`,
                                position: 'relative',
                                borderRadius: '4px',
                                border: '1px solid #33384a',
                            }}
                        >
                            <svg
                                ref={(el) => { svgRefs.current[board.boardIndex] = el; }}
                                viewBox={`0 0 ${board.width} ${board.height}`}
                                className="nesting-board-svg"
                                onWheel={(e) => handleWheelZoom(e, board.boardIndex)}
                                width={displayWidth * zoom.scale}
                                height={displayHeight * zoom.scale}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'block',
                                    userSelect: 'none',
                                }}
                            >
                                {/* Tło arkusza */}
                                <rect
                                    x={0}
                                    y={0}
                                    width={board.width}
                                    height={board.height}
                                    fill="#16181f"
                                    stroke="#33384a"
                                    strokeWidth={2}
                                />

                                {/* Formatki */}
                                {board.layout.map((part, pIdx) => {
                                    const isSelected = selectedPartId === part.partId;
                                    const isColliding = checkPartCollision(part, board.layout, board.width, board.height, config.trimMargin ?? 10);
                                    const angle = part.rotationAngle ?? 0;
                                    const cx = part.x + part.w / 2;
                                    const cy = part.y + part.h / 2;

                                    return (
                                        <g
                                            key={`${board.boardIndex}_${part.partId}_${pIdx}`}
                                            onMouseDown={(e) => handleMouseDownPart(e, part, board)}
                                            transform={angle !== 0 ? `rotate(${angle}, ${cx}, ${cy})` : undefined}
                                            style={{ cursor: dragState?.partId === part.partId ? 'grabbing' : 'grab' }}
                                        >
                                            <rect
                                                x={part.x}
                                                y={part.y}
                                                width={part.w}
                                                height={part.h}
                                                className="svg-part-rect"
                                                style={
                                                    isColliding
                                                        ? {
                                                              fill: 'rgba(239, 68, 68, 0.45)',
                                                              stroke: '#ef4444',
                                                              strokeWidth: 3.5
                                                          }
                                                        : isSelected
                                                        ? {
                                                              fill: 'rgba(234, 179, 8, 0.45)',
                                                              stroke: '#facc15',
                                                              strokeWidth: 3.5
                                                          }
                                                        : undefined
                                                }
                                            >
                                                <title>{`${part.name} [${part.realW} × ${part.realH} mm] • Kąt: ${angle}°${isColliding ? '\n⚠️ UWAGA: Kolizja lub poza arkuszem!' : '\nChwyć aby przesunąć • R: obrót o 15°'}`}</title>
                                            </rect>

                                            {renderPartLabel(part)}
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
