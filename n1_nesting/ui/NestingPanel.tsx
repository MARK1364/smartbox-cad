/**
 * Pełny widok podstrony Nesting (rozkrój płyt / CNC).
 * Zakres formatek wybierany w CAD (PPM) — tu tylko maszyna, materiał, arkusz.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    NestingPart,
    SheetConfig,
    NestingResult,
    NestingMode,
    PackedPart,
    PackedBoard,
    MachineType,
    ContainerScopeInfo,
    getPartLabelLines,
} from '../core/nesting-types';
import { NestingEngine } from '../core/nesting-engine';
import { NestingExporter } from '../export/nesting-exporter';
import { resolveClampedMovePosition, isPositionColliding, getPartAABB } from '../core/nesting-snap';
import { ReportDataNormalizer } from '../../R1_reports/report-data-normalizer';
import { ContextManager } from '../../A1_core/context-manager';
import './nesting.css';

const DEFAULT_PARTS: NestingPart[] = [
    { id: '1', name: 'Bok Lewy', width: 2000, height: 600, quantity: 1, thickness: 18, material: 'Biel Alpejska', furnitureName: 'Szafka_01', canRotate: true },
    { id: '2', name: 'Bok Prawy', width: 2000, height: 600, quantity: 1, thickness: 18, material: 'Biel Alpejska', furnitureName: 'Szafka_01', canRotate: true },
    { id: '3', name: 'Wieniec Dolny', width: 800, height: 600, quantity: 1, thickness: 18, material: 'Biel Alpejska', furnitureName: 'Szafka_01', canRotate: true },
    { id: '4', name: 'Wieniec Górny', width: 800, height: 600, quantity: 1, thickness: 18, material: 'Biel Alpejska', furnitureName: 'Szafka_01', canRotate: true },
    { id: '5', name: 'Półka Wew', width: 764, height: 580, quantity: 5, thickness: 18, material: 'Biel Alpejska', furnitureName: 'Szafka_01', canRotate: true },
    { id: '6', name: 'Szuflada Tył', width: 600, height: 150, quantity: 6, thickness: 18, material: 'Biel Alpejska', furnitureName: 'Szafka_01', canRotate: false },
    { id: '7', name: 'Plecy HDF', width: 1964, height: 796, quantity: 1, thickness: 3, material: 'HDF Biały', furnitureName: 'Szafka_01', canRotate: false }
];

const DEFAULT_CONFIG: SheetConfig = {
    width: 2800,
    height: 2070,
    kerf: 4,
    trimMargin: 10,
    thickness: 18,
    machineType: 'saw'
};

/**
 * Sprawdza czy formatka ma fizyczną kolizję (nachodzenie materiału) z inną formatką lub wystaje poza arkusz.
 * Dla sygnalizacji wizualnej kolizja zachodzi, gdy elementy fizycznie nakładają się na siebie (kerf = 0)
 * lub przekraczają marginesy arkusza.
 */
function checkPartCollision(part: PackedPart, layout: PackedPart[], boardW: number, boardH: number, trimMargin: number = 10): boolean {
    return isPositionColliding(part, part.x, part.y, layout, boardW, boardH, 0, trimMargin);
}

interface NestingPanelProps {
    initialParts?: NestingPart[];
    initialSelectedMaterial?: string;
    /** Etykieta zakresu z CAD (PPM) — tylko informacja, bez wyboru w UI. */
    scopeLabel?: string;
    isStandaloneWindow?: boolean;
}

export const NestingPanel: React.FC<NestingPanelProps> = ({
    initialParts,
    initialSelectedMaterial = 'ALL',
    scopeLabel,
    isStandaloneWindow = false,
}) => {
    const [allProjectParts, setAllProjectParts] = useState<NestingPart[]>(() => {
        if (initialParts && initialParts.length > 0) return initialParts;
        if (isStandaloneWindow) return DEFAULT_PARTS;
        return extractPartsFrom3DScene()?.parts || DEFAULT_PARTS;
    });

    // Ustawienia maszyny
    const [machineType, setMachineType] = useState<MachineType>('saw');

    // Ustawienia arkusza
    const [config, setConfig] = useState<SheetConfig>(DEFAULT_CONFIG);
    const [mode, setMode] = useState<NestingMode>('fast');
    const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string>(initialSelectedMaterial);
    const [isCalculating, setIsCalculating] = useState(false);
    const [result, setResult] = useState<NestingResult | null>(null);
    const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
    const [selectedPart, setSelectedPart] = useState<PackedPart | null>(null);
    const [viewBoardMaterial, setViewBoardMaterial] = useState<string>(initialSelectedMaterial);
    const [zoomMap, setZoomMap] = useState<Record<number, { scale: number; originX: number; originY: number }>>({});
    const [activeBoards, setActiveBoards] = useState<PackedBoard[]>([]);
    const [dragState, setDragState] = useState<{
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
    } | null>(null);
    const svgRefs = useRef<Record<number, SVGSVGElement | null>>({});

    const getBoardZoom = (bIdx: number) => {
        return zoomMap[bIdx] || { scale: 1.0, originX: 50, originY: 50 };
    };

    const setBoardZoom = (bIdx: number, updater: (curr: { scale: number; originX: number; originY: number }) => { scale: number; originX: number; originY: number }) => {
        setZoomMap((prev) => ({
            ...prev,
            [bIdx]: updater(prev[bIdx] || { scale: 1.0, originX: 50, originY: 50 })
        }));
    };

    const handleWheelZoom = (e: React.WheelEvent, bIdx: number) => {
        // Zwykły scroll = przewijanie strony; zoom tylko Shift + kółko (Ctrl zoomuje przeglądarkę)
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

                if (selectedPart?.partId === partId) {
                    setSelectedPart(updated);
                }
                return updated;
            });
            return { ...board, layout: newLayout };
        }));
    };

    // Skrót klawiszowy R / Shift+R do obrotu wybranej formatki co 15°
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedPart) return;
            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                const delta = e.shiftKey ? -15 : 15;
                const targetBoard = activeBoards.find(bd => bd.layout.some(p => p.partId === selectedPart.partId));
                if (targetBoard) {
                    rotatePart(selectedPart.partId, targetBoard.boardIndex, delta);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedPart, activeBoards]);

    const handleMouseDownPart = (e: React.MouseEvent, part: PackedPart, board: PackedBoard) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        setSelectedPart(part);

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
                    const updated = { ...p, x: finalX, y: finalY };
                    if (selectedPart?.partId === p.partId) {
                        setSelectedPart(updated);
                    }
                    return updated;
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
    }, [dragState, selectedPart, activeBoards, config]);

    /** Ostre etykiety HTML (nie SVG) — rozmiar w px ekranu, bez rozmycia viewBox. */
    const renderHtmlPartLabel = (part: PackedPart, board: PackedBoard, displayW: number, displayH: number) => {
        const sx = displayW / board.width;
        const sy = displayH / board.height;
        const left = part.x * sx;
        const top = part.y * sy;
        const w = part.w * sx;
        const h = part.h * sy;
        if (w < 22 || h < 18) return null;

        const isVertical = part.h >= part.w * 1.15;
        const isHorizontal = part.w >= part.h * 1.15;
        const { project, panel } = getPartLabelLines(part);
        const dims = `${part.realW} × ${part.realH}`;
        const refPx = Math.min(isVertical ? w : (isHorizontal ? h : Math.min(w, h)), 120);
        if (refPx < 18) return null;

        const fontProject = Math.min(13, Math.max(9, refPx * 0.22));
        const fontPanel = Math.min(15, Math.max(10, refPx * 0.28));
        const fontDims = Math.min(12, Math.max(9, refPx * 0.2));
        const angle = part.rotationAngle ?? 0;
        const readAngle = isVertical ? angle - 90 : angle;

        return (
            <div
                key={`lbl-${part.partId}`}
                className="nesting-html-label"
                style={{
                    left,
                    top,
                    width: w,
                    height: h,
                    transform: readAngle ? `rotate(${readAngle}deg)` : undefined,
                }}
            >
                <div className="nesting-html-label-inner">
                    {project ? <div className="nesting-html-label-project" style={{ fontSize: fontProject }}>{project}</div> : null}
                    <div className="nesting-html-label-panel" style={{ fontSize: fontPanel }}>{panel}</div>
                    {refPx >= 28 ? <div className="nesting-html-label-dims" style={{ fontSize: fontDims }}>{dims}</div> : null}
                </div>
            </div>
        );
    };

    // Automatyczne odświeżanie danych ze sceny 3D — tylko gdy panel jest w głównym CAD
    useEffect(() => {
        if (isStandaloneWindow) return;
        const handleAutoSync = () => {
            const sceneData = extractPartsFrom3DScene();
            if (sceneData && sceneData.parts.length > 0) {
                setAllProjectParts(sceneData.parts);
            }
        };

        const doc = ContextManager.instance?.document || (window as any).CAD_APP?.document;
        let unsubscribeDoc: (() => void) | undefined;
        if (doc && typeof doc.onDocumentChanged === 'function') {
            unsubscribeDoc = doc.onDocumentChanged(handleAutoSync);
        }

        const events = [
            'smartbox-project-changed',
            'smartframe-updated',
            'material-database-updated',
            'smartbox-properties-update',
            'cad-document-changed',
            'cad-history-executed'
        ];

        events.forEach(evt => {
            window.addEventListener(evt, handleAutoSync);
            document.addEventListener(evt, handleAutoSync);
        });

        return () => {
            if (typeof unsubscribeDoc === 'function') unsubscribeDoc();
            events.forEach(evt => {
                window.removeEventListener(evt, handleAutoSync);
                document.removeEventListener(evt, handleAutoSync);
            });
        };
    }, [isStandaloneWindow]);

    // Przełączanie profilu maszyny (Piła vs CNC)
    const handleSwitchMachineType = (type: MachineType) => {
        setMachineType(type);
        const newKerf = NestingEngine.getDefaultKerf(type);
        const newTrim = type === 'cnc' ? 15 : 10;
        setConfig((prev) => ({
            ...prev,
            machineType: type,
            kerf: newKerf,
            trimMargin: newTrim
        }));
    };

    // Formatki z CAD (zakres już wybrany PPM na scenie głównej)
    const scopedParts = allProjectParts;

    // Unikalne grupy materiałowe
    const availableMaterials = useMemo(() => {
        const map = new Map<string, { key: string; name: string; thickness: number; label: string; count: number }>();
        scopedParts.forEach((p) => {
            const key = NestingEngine.getMaterialKey(p);
            const label = NestingEngine.getMaterialLabel(p);
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    name: p.material || 'Płyta podstawowa',
                    thickness: p.thickness || 18,
                    label,
                    count: 0
                });
            }
            map.get(key)!.count += (p.quantity || 0);
        });
        return Array.from(map.values());
    }, [scopedParts]);

    // Formatki do edycji w tabeli
    const displayedParts = useMemo(() => {
        if (selectedMaterialFilter === 'ALL') return scopedParts;
        return scopedParts.filter((p) => NestingEngine.getMaterialKey(p) === selectedMaterialFilter);
    }, [scopedParts, selectedMaterialFilter]);

    function handleSyncFromScene() {
        const sceneData = extractPartsFrom3DScene();
        if (sceneData && sceneData.parts.length > 0) {
            setAllProjectParts(sceneData.parts);
            setStatusMsg({ text: `Zaimportowano ${sceneData.parts.length} formatek z projektu 3D.`, type: 'success' });
        } else {
            setStatusMsg({ text: 'Brak wykrytych formatek w scenie 3D. Pozostawiono listę.', type: 'error' });
        }
    }

    const updatePart = (indexInDisplayed: number, field: keyof NestingPart, value: any) => {
        const targetPart = displayedParts[indexInDisplayed];
        if (!targetPart) return;

        const globalIndex = allProjectParts.findIndex((p) => p.id === targetPart.id);
        if (globalIndex === -1) return;

        const updated = [...allProjectParts];
        if (field === 'width' || field === 'height' || field === 'quantity' || field === 'thickness') {
            const num = parseFloat(value);
            (updated[globalIndex] as any)[field] = isNaN(num) ? 0 : Math.max(0, num);
        } else if (field === 'canRotate') {
            updated[globalIndex].canRotate = value === 'any' || value === true;
        } else {
            (updated[globalIndex] as any)[field] = value;
        }
        setAllProjectParts(updated);
    };

    const addPart = () => {
        const activeMat = availableMaterials.find((m) => m.key === selectedMaterialFilter);
        const newPart: NestingPart = {
            id: `part_${Date.now()}`,
            name: 'Nowa formatka',
            width: 500,
            height: 500,
            quantity: 1,
            thickness: activeMat ? activeMat.thickness : 18,
            material: activeMat ? activeMat.name : 'Biel Alpejska',
            canRotate: true
        };
        setAllProjectParts([...allProjectParts, newPart]);
    };

    const removePart = (indexInDisplayed: number) => {
        const targetPart = displayedParts[indexInDisplayed];
        if (!targetPart) return;
        setAllProjectParts(allProjectParts.filter((p) => p.id !== targetPart.id));
    };

    const handleRunNesting = async () => {
        setIsCalculating(true);
        setStatusMsg({ text: `Obliczanie rozkroju (${machineType === 'cnc' ? 'Frezarka CNC' : 'Piła'})...`, type: '' });

        try {
            const nestingResult = await NestingEngine.runNesting(scopedParts, config, {
                mode,
                iterations: mode === 'pro' ? 2000 : 1,
                selectedMaterial: selectedMaterialFilter,
                machineType,
                scope: 'PROJECT',
            });

            setResult(nestingResult);

            if (nestingResult.unplacedParts.length > 0) {
                setStatusMsg({
                    text: `Uwaga: ${nestingResult.unplacedParts.length} formatek przekracza wymiar arkusza!`,
                    type: 'error'
                });
            } else {
                setStatusMsg({
                    text: `Rozkrój [${machineType.toUpperCase()}] gotowy${scopeLabel ? ` (${scopeLabel})` : ''}! Arkuszy: ${nestingResult.totalBoardsCount}`,
                    type: 'success'
                });
            }
        } catch (err: any) {
            setStatusMsg({ text: `Błąd: ${err.message || err}`, type: 'error' });
        } finally {
            setIsCalculating(false);
        }
    };

    // Automatyczne generowanie rozkroju przy zmianie zestawu / maszyny / materiału
    useEffect(() => {
        if (scopedParts.length > 0) {
            handleRunNesting();
        }
    }, [scopedParts, machineType, selectedMaterialFilter, config.width, config.height, config.kerf, config.trimMargin]);

    const handleExportHtml = () => {
        if (!result) return;
        NestingExporter.downloadHtmlReport(result, config);
    };

    useEffect(() => {
        if (result && result.boards) {
            setActiveBoards(result.boards);
        } else {
            setActiveBoards([]);
        }
    }, [result]);

    const displayedBoards = useMemo(() => {
        if (activeBoards.length === 0) return [];
        if (viewBoardMaterial === 'ALL') return activeBoards;
        return activeBoards.filter((b) => NestingEngine.getMaterialKey(b) === viewBoardMaterial);
    }, [activeBoards, viewBoardMaterial]);

    return (
        <div className="nesting-app-page">
            <aside
                id="panel-edycji"
                className="sidebar panel-edycji nesting-panel-edycji"
                aria-label="Panel edycji"
            >
                <div className="nesting-form-header">
                    <h2>Nesting</h2>
                    <p className="subtitle">
                        {scopeLabel || 'Rozkrój płyt'}
                        {' · '}
                        {scopedParts.reduce((s, p) => s + (p.quantity || 0), 0)} szt.
                    </p>
                </div>

                <div className="panel">
                    <h3>Profil maszyny</h3>
                    <div className="nesting-machine-toggle">
                        <button
                            type="button"
                            className={`nesting-machine-btn ${machineType === 'saw' ? 'active' : ''}`}
                            onClick={() => handleSwitchMachineType('saw')}
                        >
                            Piła (4 mm)
                        </button>
                        <button
                            type="button"
                            className={`nesting-machine-btn ${machineType === 'cnc' ? 'active' : ''}`}
                            onClick={() => handleSwitchMachineType('cnc')}
                        >
                            CNC (10 mm)
                        </button>
                    </div>
                </div>

                <div className="panel">
                    <h3>Grupa materiałowa</h3>
                    <div className="input-group">
                        <label htmlFor="materialScope">Materiał</label>
                        <select
                            id="materialScope"
                            value={selectedMaterialFilter}
                            onChange={(e) => {
                                setSelectedMaterialFilter(e.target.value);
                                setViewBoardMaterial(e.target.value);
                            }}
                        >
                            <option value="ALL">Wszystkie ({scopedParts.reduce((s, p) => s + (p.quantity || 0), 0)} szt.)</option>
                            {availableMaterials.map((mat) => (
                                <option key={mat.key} value={mat.key}>
                                    {mat.label} ({mat.count} szt.)
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="panel">
                    <h3>Parametry arkusza</h3>
                    <div className="row">
                        <div className="input-group">
                            <label htmlFor="boardW">Szer. (mm)</label>
                            <input
                                type="number"
                                id="boardW"
                                value={config.width}
                                onChange={(e) => setConfig({ ...config, width: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="boardH">Wys. (mm)</label>
                            <input
                                type="number"
                                id="boardH"
                                value={config.height}
                                onChange={(e) => setConfig({ ...config, height: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                    <div className="row mt-2">
                        <div className="input-group">
                            <label htmlFor="kerf">{machineType === 'cnc' ? 'Frezu (mm)' : 'Rzaz (mm)'}</label>
                            <input
                                type="number"
                                id="kerf"
                                value={config.kerf}
                                onChange={(e) => setConfig({ ...config, kerf: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="optimizeMode">Tryb</label>
                            <select
                                id="optimizeMode"
                                value={mode}
                                onChange={(e) => setMode(e.target.value as NestingMode)}
                            >
                                <option value="fast">Szybki</option>
                                <option value="pro">Profesjonalny</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="panel list-panel">
                    <div className="panel-header">
                        <h3>
                            Formatki ({displayedParts.reduce((sum, p) => sum + (p.quantity || 0), 0)})
                        </h3>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {!isStandaloneWindow && (
                                <button
                                    className="btn-secondary"
                                    onClick={handleSyncFromScene}
                                    style={{ padding: '2px 8px', fontSize: '0.75rem', height: '24px' }}
                                    title="Pobierz formatki ze sceny 3D"
                                >
                                    Ze sceny
                                </button>
                            )}
                            <button id="addPartBtn" className="btn-icon" onClick={addPart} title="Dodaj formatkę">
                                +
                            </button>
                        </div>
                    </div>
                    <div className="table-container">
                        <table className="excel-table">
                            <thead>
                                <tr>
                                    <th>Nazwa</th>
                                    <th style={{ width: '70px' }}>Mat.</th>
                                    <th style={{ width: '40px' }}>Gr.</th>
                                    <th style={{ width: '48px' }}>Szer.</th>
                                    <th style={{ width: '48px' }}>Wys.</th>
                                    <th style={{ width: '36px' }}>Szt.</th>
                                    <th style={{ width: '48px' }}>Obrót</th>
                                    <th style={{ width: '24px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedParts.map((p, idx) => (
                                    <tr key={p.id || idx}>
                                        <td>
                                            <input type="text" value={p.name} onChange={(e) => updatePart(idx, 'name', e.target.value)} />
                                        </td>
                                        <td>
                                            <input type="text" value={p.material || 'Biel Alpejska'} onChange={(e) => updatePart(idx, 'material', e.target.value)} style={{ fontSize: '0.75rem' }} />
                                        </td>
                                        <td>
                                            <input type="number" value={p.thickness || 18} onChange={(e) => updatePart(idx, 'thickness', e.target.value)} />
                                        </td>
                                        <td>
                                            <input type="number" value={p.width} onChange={(e) => updatePart(idx, 'width', e.target.value)} />
                                        </td>
                                        <td>
                                            <input type="number" value={p.height} onChange={(e) => updatePart(idx, 'height', e.target.value)} />
                                        </td>
                                        <td>
                                            <input type="number" value={p.quantity} onChange={(e) => updatePart(idx, 'quantity', e.target.value)} />
                                        </td>
                                        <td>
                                            <select value={p.canRotate ? 'any' : 'none'} onChange={(e) => updatePart(idx, 'canRotate', e.target.value)}>
                                                <option value="any">Tak</option>
                                                <option value="none">Nie</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button className="btn-remove-row" onClick={() => removePart(idx)} title="Usuń">&times;</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="actions">
                    <button
                        id="runNestingBtn"
                        className="btn-primary"
                        onClick={handleRunNesting}
                        disabled={isCalculating || scopedParts.length === 0}
                    >
                        {isCalculating
                            ? 'Obliczanie...'
                            : `Generuj rozkrój (${machineType === 'cnc' ? 'CNC' : 'Piła'})`}
                    </button>
                </div>

                <div className={`status-msg ${statusMsg.type}`}>{statusMsg.text}</div>
            </aside>

            <main className="workspace">
                <div className="toolbar">
                    <div className="stats">
                        <span>Profil: <strong>{machineType === 'cnc' ? 'CNC' : 'Piła'}</strong></span>
                        <span>Arkusze: <strong id="boardsCountLabel">{displayedBoards.length}</strong></span>
                        <span>
                            Odpad:{' '}
                            <strong id="wasteLabel">
                                {displayedBoards.length > 0
                                    ? `${(displayedBoards.reduce((acc, b) => acc + b.wastePercent, 0) / displayedBoards.length).toFixed(1)}%`
                                    : '0%'}
                            </strong>
                        </span>
                        {result && result.materialGroups && result.materialGroups.length > 1 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Filtr:
                                <select
                                    value={viewBoardMaterial}
                                    onChange={(e) => setViewBoardMaterial(e.target.value)}
                                    className="nesting-inline-select"
                                >
                                    <option value="ALL">Wszystkie ({result.boards.length})</option>
                                    {result.materialGroups.map((g) => (
                                        <option key={g.materialKey} value={g.materialKey}>
                                            {g.materialLabel} ({g.boardsCount})
                                        </option>
                                    ))}
                                </select>
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" onClick={handleRunNesting} title="Przywróć optymalne ułożenie">
                            Przywróć auto
                        </button>
                        <button
                            className="btn-secondary"
                            id="exportPdfBtn"
                            onClick={handleExportHtml}
                            disabled={!result || result.boards.length === 0}
                        >
                            SVG / HTML
                        </button>
                    </div>
                </div>

                <div className="boards-container" id="boardsContainer">
                    {(!result || displayedBoards.length === 0) ? (
                        <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b' }}>
                            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b' }}>Brak rozkroju</p>
                            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                                Ustaw parametry po prawej i kliknij <strong>Generuj rozkrój</strong>.
                            </p>
                        </div>
                    ) : (
                        displayedBoards.map((board) => {
                            const zoom = getBoardZoom(board.boardIndex);
                            const selectedPartInThisBoard = board.layout.find(p => p.partId === selectedPart?.partId);
                            const baseW = 1100;
                            const displayW = Math.round(baseW * zoom.scale);
                            const displayH = Math.round(displayW * (board.height / board.width));

                            return (
                                <div key={board.boardIndex} className="board-wrapper">
                                    <div className="board-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: displayW, maxWidth: '100%' }}>
                                        <span>
                                            Arkusz nr {board.boardIndex} ({board.width} × {board.height} mm)
                                            {board.materialLabel && (
                                                <span className="board-mat-badge">{board.materialLabel}</span>
                                            )}
                                        </span>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            Odpad: {board.wastePercent.toFixed(1)}%
                                        </span>
                                    </div>
                                    {selectedPartInThisBoard && (
                                        <div className="part-edit-bar" style={{ width: displayW }}>
                                            <span>
                                                {selectedPartInThisBoard.name}
                                                {' · '}
                                                Kąt: <strong>{selectedPartInThisBoard.rotationAngle ?? 0}°</strong>
                                            </span>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button type="button" className="btn-secondary" onClick={() => rotatePart(selectedPartInThisBoard.partId, board.boardIndex, -15)}>−15°</button>
                                                <button type="button" className="btn-secondary" onClick={() => rotatePart(selectedPartInThisBoard.partId, board.boardIndex, 15)}>+15°</button>
                                                <button type="button" className="btn-secondary" onClick={() => rotatePart(selectedPartInThisBoard.partId, board.boardIndex, 90)}>90°</button>
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        className="board-stage"
                                        style={{ width: displayW, height: displayH }}
                                        onWheel={(e) => handleWheelZoom(e as any, board.boardIndex)}
                                    >
                                        <svg
                                            ref={(el) => { svgRefs.current[board.boardIndex] = el; }}
                                            viewBox={`0 0 ${board.width} ${board.height}`}
                                            className="board-svg"
                                            width={displayW}
                                            height={displayH}
                                            style={{ width: displayW, height: displayH }}
                                            onClick={() => setSelectedPart(null)}
                                        >
                                            <rect x={0} y={0} width={board.width} height={board.height} className="board-bg" />
                                            <rect
                                                x={config.trimMargin}
                                                y={config.trimMargin}
                                                width={board.width - 2 * config.trimMargin}
                                                height={board.height - 2 * config.trimMargin}
                                                className="board-trim"
                                            />
                                            {board.layout.map((part) => {
                                                const isSelected = selectedPart?.partId === part.partId;
                                                const colliding = checkPartCollision(part, board.layout, board.width, board.height, config.trimMargin);
                                                return (
                                                    <g
                                                        key={part.partId}
                                                        transform={`translate(${part.x}, ${part.y}) rotate(${part.rotationAngle ?? 0}, ${part.w / 2}, ${part.h / 2})`}
                                                        style={{ cursor: 'grab' }}
                                                        onMouseDown={(e) => handleMouseDownPart(e, part, board)}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedPart(part); }}
                                                    >
                                                        <rect
                                                            width={part.w}
                                                            height={part.h}
                                                            className={`part-rect${isSelected ? ' selected' : ''}${colliding ? ' colliding' : ''}`}
                                                        />
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                        <div className="board-labels-layer" aria-hidden>
                                            {board.layout.map((part) => renderHtmlPartLabel(part, board, displayW, displayH))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </main>
        </div>
    );
};

function extractPartsFrom3DScene(): { parts: NestingPart[]; containers: ContainerScopeInfo[] } | null {
    try {
        const doc = ContextManager.instance?.document || (window as any).CAD_APP?.document;
        const data = ReportDataNormalizer.extractProjectData(doc);
        if (data && data.panels && data.panels.length > 0) {
            const parts: NestingPart[] = data.panels.map((p, idx) => ({
                id: p.part_id || `part_${idx}`,
                name: p.role || p.part_id || `part_${idx}`,
                width: p.length_mm,
                height: p.width_mm,
                thickness: p.thickness_mm || 18,
                quantity: p.qty || 1,
                canRotate: true,
                material: NestingEngine.resolveMaterialName(p.material),
                containerId: p.container_id,
                smartboxId: p.smartbox_id,
                furnitureName: p.furniture_name
            }));
            return { parts, containers: data.containers || [] };
        }
    } catch (e) {
        console.warn('Nesting sync from 3D scene warning:', e);
    }
    return null;
}
