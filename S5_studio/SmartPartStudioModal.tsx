/**
 * A5_smartparts / studio — SmartPartStudioModal.tsx
 * DEPRECATED: ścieżka robocza to osobne okno smartparts.html
 * (Plik → SmartParts Studio / openSmartPartsStudioFromCad).
 * Modal zostaje tylko dla kompatybilności; nie rozwijaj tu UI.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './smartpart-studio.css';
import type {
    SmartPartPackageDefinition,
    SmartPartBodyItem,
    SmartPartCut,
    SmartPartHoleCut,
    SmartPartPocketCut,
    CutAxis,
    XRefWall,
    YRefWall,
    ZRefWall,
} from './smartpart-studio-types.js';
import {
    calculateCutProtrusion,
    computeAbsoluteFromReference,
    computeReferenceFromAbsolute,
    cutOrientFromRefs,
    findPartForCut,
    holeOutwardDirectionForRef,
    partDimsAsMain,
} from './smartpart-studio-types.js';
import {
    SmartPartStudioScene,
    CameraViewPreset,
    TransformToolMode,
    TransformUpdateEvent,
} from './smartpart-studio-scene.js';
import {
    saveSmartPartPackage,
    exportSmartPartPackageJson,
    exportSmartPartIconPng,
    createEmptySmartPartPackage,
    DEFAULT_HANGER_SMARTPART,
    allocSmartPartPackageId,
    allocSmartPartBodyId,
    allocSmartPartCutId,
} from './smartpart-custom-store.js';

const TREE_ICONS = {
    project: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
    ),
    part: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        </svg>
    ),
    opsFolder: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    ),
    tool: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
    ),
    chevronDown: (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.6 }}>
            <path d="M6 9l6 6 6-6"></path>
        </svg>
    ),
    chevronRight: (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.6 }}>
            <path d="M9 5l7 7-7 7"></path>
        </svg>
    ),
    trash: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    ),
};

export interface SmartPartStudioModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialDefinition?: SmartPartPackageDefinition | null;
}

export function SmartPartStudioModal({
    isOpen,
    onClose,
    initialDefinition,
}: SmartPartStudioModalProps): React.JSX.Element | null {
    const [def, setDef] = useState<SmartPartPackageDefinition>(() => {
        if (initialDefinition) return initialDefinition;
        return createEmptySmartPartPackage('SmartPart Kontener 1');
    });

    const [selectedId, setSelectedId] = useState<string>('main_container');
    const [transformTool, setTransformTool] = useState<TransformToolMode>('select');
    const [isOrtho, setIsOrtho] = useState<boolean>(false);
    const [isPartsExpanded, setIsPartsExpanded] = useState<boolean>(true);
    const [isCutsExpanded, setIsCutsExpanded] = useState<boolean>(true);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sceneRef = useRef<SmartPartStudioScene | null>(null);

    useEffect(() => {
        if (isOpen) {
            setDef(initialDefinition ? { ...initialDefinition } : createEmptySmartPartPackage('SmartPart Kontener 1'));
            setSelectedId('main_container');
        }
    }, [isOpen, initialDefinition]);

    const handleGizmoTransform = useCallback((targetId: string, transform: TransformUpdateEvent) => {
        setDef((prev) => {
            const partIdx = prev.parts.findIndex((p) => p.id === targetId);
            if (partIdx >= 0) {
                const p = prev.parts[partIdx];
                const rel = computeReferenceFromAbsolute(
                    prev.mainContainer,
                    transform.xMm,
                    transform.yMm,
                    transform.zMm,
                    p.refX || 'CENTER',
                    p.refY || 'CENTER',
                    p.refZ || 'CENTER'
                );
                const updatedParts = [...prev.parts];
                updatedParts[partIdx] = {
                    ...p,
                    xMm: transform.xMm,
                    yMm: transform.yMm,
                    zMm: transform.zMm,
                    offsetX_mm: rel.offsetX_mm,
                    offsetY_mm: rel.offsetY_mm,
                    offsetZ_mm: rel.offsetZ_mm,
                };
                return { ...prev, parts: updatedParts };
            }

            const cutIdx = prev.cuts.findIndex((c) => c.id === targetId);
            if (cutIdx >= 0) {
                const c = prev.cuts[cutIdx];
                const rel = computeReferenceFromAbsolute(
                    prev.mainContainer,
                    transform.xMm,
                    transform.yMm,
                    transform.zMm,
                    c.refX || 'CENTER',
                    c.refY || 'CENTER',
                    c.refZ || 'CENTER'
                );
                const updatedCuts = [...prev.cuts];
                updatedCuts[cutIdx] = {
                    ...c,
                    xMm: transform.xMm,
                    yMm: transform.yMm,
                    zMm: transform.zMm,
                    offsetX_mm: rel.offsetX_mm,
                    offsetY_mm: rel.offsetY_mm,
                    offsetZ_mm: rel.offsetZ_mm,
                };
                return { ...prev, cuts: updatedCuts };
            }

            return prev;
        });
    }, []);

    useEffect(() => {
        if (!isOpen || !canvasRef.current) return;

        const studioScene = new SmartPartStudioScene(
            canvasRef.current,
            (clickedId) => {
                setSelectedId(clickedId);
            },
            handleGizmoTransform
        );
        sceneRef.current = studioScene;
        studioScene.updateDefinition(def, selectedId);

        return () => {
            studioScene.dispose();
            sceneRef.current = null;
        };
    }, [isOpen, handleGizmoTransform]);

    useEffect(() => {
        if (sceneRef.current && isOpen) {
            sceneRef.current.updateDefinition(def, selectedId);
        }
    }, [def, selectedId, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'Escape') onClose();
            const key = e.key.toLowerCase();
            if (key === 'q') {
                setTransformTool('select');
                sceneRef.current?.setTransformTool('select');
            } else if (key === 'g' || key === 'w') {
                const next = sceneRef.current?.getTransformTool() === 'translate' ? 'select' : 'translate';
                setTransformTool(next);
                sceneRef.current?.setTransformTool(next);
            } else if (key === 'e') {
                setTransformTool('rotate');
                sceneRef.current?.setTransformTool('rotate');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleChangeTransformTool = (tool: TransformToolMode) => {
        setTransformTool(tool);
        sceneRef.current?.setTransformTool(tool);
    };

    const handleUpdateMainContainer = (field: 'widthMm' | 'heightMm' | 'depthMm', val: number) => {
        const updatedMain = {
            ...def.mainContainer,
            [field]: Math.max(1, val),
        };

        const updatedParts = def.parts.map((p) => {
            const abs = computeAbsoluteFromReference(
                updatedMain,
                p.refX || 'CENTER',
                p.offsetX_mm ?? p.xMm,
                p.refY || 'CENTER',
                p.offsetY_mm ?? p.yMm,
                p.refZ || 'CENTER',
                p.offsetZ_mm ?? p.zMm
            );
            return { ...p, xMm: abs.xMm, yMm: abs.yMm, zMm: abs.zMm };
        });

        const updatedCuts = def.cuts.map((c) => {
            const abs = computeAbsoluteFromReference(
                updatedMain,
                c.refX || 'CENTER',
                c.offsetX_mm ?? c.xMm,
                c.refY || 'CENTER',
                c.offsetY_mm ?? c.yMm,
                c.refZ || 'CENTER',
                c.offsetZ_mm ?? c.zMm
            );
            return { ...c, xMm: abs.xMm, yMm: abs.yMm, zMm: abs.zMm };
        });

        setDef({
            ...def,
            mainContainer: updatedMain,
            parts: updatedParts,
            cuts: updatedCuts,
        });
    };

    const handleAddPart = () => {
        const num = def.parts.length + 1;
        const newPart: SmartPartBodyItem = {
            id: allocSmartPartBodyId(def.id, `part_${num}`),
            name: `Part ${num}`,
            widthMm: 18,
            heightMm: 38,
            depthMm: 68,
            xMm: 0,
            yMm: 0,
            zMm: 0,
            refX: 'CENTER',
            offsetX_mm: 0,
            refY: 'CENTER',
            offsetY_mm: 0,
            refZ: 'CENTER',
            offsetZ_mm: 0,
            colorHex: num % 2 === 0 ? '#10b981' : '#38bdf8',
        };
        setDef({ ...def, parts: [...def.parts, newPart] });
        setSelectedId(newPart.id);
        setIsPartsExpanded(true);
    };

    const handleDeletePart = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (def.parts.length <= 1) {
            alert('SmartPart musi posiadać co najmniej jeden Part.');
            return;
        }
        setDef({ ...def, parts: def.parts.filter((p) => p.id !== id) });
        if (selectedId === id) setSelectedId('main_container');
    };

    const handleUpdatePartRef = (
        id: string,
        axis: 'X' | 'Y' | 'Z',
        newRef: string,
        newOffset?: number
    ) => {
        setDef((prev) => {
            const part = prev.parts.find((p) => p.id === id);
            if (!part) return prev;

            const refX = axis === 'X' ? (newRef as XRefWall) : (part.refX || 'CENTER');
            const refY = axis === 'Y' ? (newRef as YRefWall) : (part.refY || 'CENTER');
            const refZ = axis === 'Z' ? (newRef as ZRefWall) : (part.refZ || 'CENTER');

            let offX = part.offsetX_mm ?? part.xMm ?? 0;
            let offY = part.offsetY_mm ?? part.yMm ?? 0;
            let offZ = part.offsetZ_mm ?? part.zMm ?? 0;
            let xMm = part.xMm ?? 0;
            let yMm = part.yMm ?? 0;
            let zMm = part.zMm ?? 0;

            if (newOffset !== undefined) {
                // Użytkownik ręcznie wpisał nowy offset w inpucie
                if (axis === 'X') offX = newOffset;
                if (axis === 'Y') offY = newOffset;
                if (axis === 'Z') offZ = newOffset;
            }
            // Zmiana ściany referencyjnej (lub offsetu) natychmiast przelicza pozycję bezwzględną w kontenerze
            const abs = computeAbsoluteFromReference(prev.mainContainer, refX, offX, refY, offY, refZ, offZ);
            xMm = abs.xMm;
            yMm = abs.yMm;
            zMm = abs.zMm;

            return {
                ...prev,
                parts: prev.parts.map((p) =>
                    p.id === id
                        ? {
                              ...p,
                              refX,
                              offsetX_mm: offX,
                              refY,
                              offsetY_mm: offY,
                              refZ,
                              offsetZ_mm: offZ,
                              xMm,
                              yMm,
                              zMm,
                          }
                        : p
                ),
            };
        });
    };

    const handleAddHoleCut = () => {
        const num = def.cuts.filter((c) => c.type === 'HOLE').length + 1;
        const refs = {
            refX: 'LEFT' as const,
            offsetX_mm: 0,
            refY: 'CENTER' as const,
            offsetY_mm: 0,
            refZ: 'CENTER' as const,
            offsetZ_mm: 0,
        };
        const newCut: SmartPartHoleCut = {
            id: allocSmartPartCutId(def.id, `walec_${num}`),
            name: `Otwór okrągły ${num}`,
            type: 'HOLE',
            diameterMm: 8,
            lengthMm: 24,
            xMm: -def.mainContainer.widthMm / 2,
            yMm: 0,
            zMm: 0,
            ...refs,
            ...cutOrientFromRefs(refs),
        };
        setDef({ ...def, cuts: [...def.cuts, newCut] });
        setSelectedId(newCut.id);
        setIsCutsExpanded(true);
    };

    const handleAddPocketCut = () => {
        const num = def.cuts.filter((c) => c.type === 'POCKET').length + 1;
        const refs = {
            refX: 'CENTER' as const,
            offsetX_mm: 0,
            refY: 'BACK' as const,
            offsetY_mm: 0,
            refZ: 'CENTER' as const,
            offsetZ_mm: 0,
        };
        const newCut: SmartPartPocketCut = {
            id: allocSmartPartCutId(def.id, `szescian_${num}`),
            name: `Wcięcie prostokątne ${num}`,
            type: 'POCKET',
            widthMm: 16,
            heightMm: 32,
            depthMm: 15,
            xMm: 0,
            yMm: 0,
            zMm: -def.mainContainer.depthMm / 2,
            ...refs,
            ...cutOrientFromRefs(refs),
        };
        setDef({ ...def, cuts: [...def.cuts, newCut] });
        setSelectedId(newCut.id);
        setIsCutsExpanded(true);
    };

    const handleDeleteCut = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setDef({ ...def, cuts: def.cuts.filter((c) => c.id !== id) });
        if (selectedId === id) setSelectedId('main_container');
    };

    const handleUpdateCutRef = (
        id: string,
        axis: 'X' | 'Y' | 'Z',
        newRef: string,
        newOffset?: number
    ) => {
        setDef((prev) => {
            const cut = prev.cuts.find((c) => c.id === id);
            if (!cut) return prev;

            const refX = axis === 'X' ? (newRef as XRefWall) : (cut.refX || 'CENTER');
            const refY = axis === 'Y' ? (newRef as YRefWall) : (cut.refY || 'CENTER');
            const refZ = axis === 'Z' ? (newRef as ZRefWall) : (cut.refZ || 'CENTER');

            const part = findPartForCut(prev, cut);
            const dims = part ? partDimsAsMain(part) : prev.mainContainer;

            let offX = cut.offsetX_mm ?? cut.xMm ?? 0;
            let offY = cut.offsetY_mm ?? cut.yMm ?? 0;
            let offZ = cut.offsetZ_mm ?? cut.zMm ?? 0;
            let xMm = cut.xMm ?? 0;
            let yMm = cut.yMm ?? 0;
            let zMm = cut.zMm ?? 0;

            if (newOffset !== undefined) {
                // Użytkownik ręcznie wpisał nowy offset w inpucie
                if (axis === 'X') offX = newOffset;
                if (axis === 'Y') offY = newOffset;
                if (axis === 'Z') offZ = newOffset;
            }
            // Zmiana ściany referencyjnej (lub offsetu) natychmiast przelicza pozycję w LCS parta
            const local = computeAbsoluteFromReference(dims, refX, offX, refY, offY, refZ, offZ);
            xMm = local.xMm;
            yMm = local.yMm;
            zMm = local.zMm;

            let orientPatch: { axis: CutAxis; direction: 1 | -1 } | Record<string, never> = {};
            if (newOffset === undefined) {
                if (newRef !== 'CENTER') {
                    const outward = holeOutwardDirectionForRef(axis, refX, refY, refZ);
                    if (outward !== null) orientPatch = { axis, direction: outward };
                } else {
                    orientPatch = cutOrientFromRefs({ refX, refY, refZ });
                }
            }

            return {
                ...prev,
                cutsFrame: 'PART',
                cuts: prev.cuts.map((c) =>
                    c.id === id
                        ? {
                              ...c,
                              refX,
                              offsetX_mm: offX,
                              refY,
                              offsetY_mm: offY,
                              refZ,
                              offsetZ_mm: offZ,
                              xMm,
                              yMm,
                              zMm,
                              ...orientPatch,
                          }
                        : c
                ),
            };
        });
    };

    const handleUpdateCutProp = (id: string, field: string, val: any) => {
        setDef({
            ...def,
            cuts: def.cuts.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
        });
    };

    const handleSave = () => {
        const iconDataUrl = sceneRef.current?.captureThumbnail();
        const safeName = (def.name || 'SmartPart').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const targetId = def.name && (!def.id || !def.id.includes(safeName))
            ? allocSmartPartPackageId(safeName)
            : def.id;
        const toSave = {
            ...def,
            id: targetId,
            units: 'mm' as const,
            version: '1.0' as const,
            coordSystem: 'CAD' as const,
            partBody: def.parts?.[0] ? { ...def.parts[0] } : def.partBody,
            iconDataUrl: iconDataUrl || def.iconDataUrl,
            updatedAt: Date.now(),
        };
        saveSmartPartPackage(toSave);
        onClose();
    };

    const selectedPart = def.parts.find((p) => p.id === selectedId);
    const selectedCut = def.cuts.find((c) => c.id === selectedId);
    const selectedProtrusion = selectedCut ? calculateCutProtrusion(selectedCut, def.mainContainer) : null;

    if (!isOpen) return null;

    return (
        <div className="smartparts-app-shell" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
            {/* Pasek górny */}
            <header className="cad-topbar">
                <div className="cad-topbar-brand">
                    <span className="cad-topbar-badge">SmartParts</span>
                    <h2 className="cad-topbar-title">Studio Akcesoriów 3D</h2>
                </div>

                <div className="cad-topbar-inputs">
                    <input
                        type="text"
                        className="cad-input-title"
                        value={def.name}
                        onChange={(e) => setDef({ ...def, name: e.target.value })}
                        placeholder="Nazwa SmartParta..."
                    />
                </div>

                <div className="cad-topbar-actions">
                    <button type="button" className="cad-btn cad-btn-primary" onClick={handleSave}>
                        💾 Zapisz
                    </button>
                    <button
                        type="button"
                        className="cad-btn"
                        onClick={() => {
                            const safeName = (def.name || 'SmartPart').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                            const targetId = def.name && (!def.id || !def.id.includes(safeName))
                                ? allocSmartPartPackageId(safeName)
                                : def.id;
                            exportSmartPartPackageJson({ ...def, id: targetId });
                        }}
                    >
                        Pobierz JSON
                    </button>
                    <button
                        type="button"
                        className="cad-btn"
                        onClick={() => {
                            const icon = sceneRef.current?.captureThumbnail() || def.iconDataUrl;
                            if (icon) exportSmartPartIconPng(icon, def.name);
                        }}
                    >
                        Ikona PNG
                    </button>
                    <a href="./smartparts.html" target="_blank" rel="noreferrer" className="cad-btn">
                        ↗ Otwórz w oknie
                    </a>
                    <button type="button" className="cad-btn" onClick={onClose}>
                        ✕ Zamknij
                    </button>
                </div>
            </header>

            {/* Obszar roboczy */}
            <div className="cad-workspace">
                {/* 1. LEWY PANEL: Drzewo Operacji (SceneTree) */}
                <div className="cad-tree-panel">
                    <div className="cad-panel-header">
                        <span>Drzewo Obiektów</span>
                    </div>

                    <div className="cad-tree-content">
                        <div
                            className={`tree-node ${selectedId === 'main_container' ? 'selected' : ''}`}
                            onClick={() => setSelectedId('main_container')}
                        >
                            <div className="tree-node-content">
                                {TREE_ICONS.project}
                                <span className="node-name-text">Kontener SmartPart</span>
                                <span className="cad-tree-badge">
                                    {def.mainContainer.widthMm}×{def.mainContainer.heightMm}×{def.mainContainer.depthMm} mm
                                </span>
                            </div>
                        </div>

                        {/* Grupa: Części (Parts) */}
                        <div
                            className="tree-node"
                            style={{ marginTop: '4px', background: 'rgba(255,255,255,0.02)' }}
                            onClick={() => setIsPartsExpanded(!isPartsExpanded)}
                        >
                            <div className="tree-node-content">
                                {isPartsExpanded ? TREE_ICONS.chevronDown : TREE_ICONS.chevronRight}
                                {TREE_ICONS.opsFolder}
                                <span className="node-name-text" style={{ fontWeight: 600 }}>Części (Parts)</span>
                                <span style={{ opacity: 0.5, fontSize: '10px' }}>({def.parts.length})</span>
                            </div>
                        </div>

                        {isPartsExpanded &&
                            def.parts.map((p, idx) => {
                                const isSel = selectedId === p.id;
                                return (
                                    <div
                                        key={p.id}
                                        className={`tree-node ${isSel ? 'selected' : ''}`}
                                        style={{ paddingLeft: '22px' }}
                                        onClick={() => setSelectedId(p.id)}
                                    >
                                        <div className="tree-node-content">
                                            {TREE_ICONS.part}
                                            <span className="node-name-text">{p.name || `Part ${idx + 1}`}</span>
                                            <span className="cad-tree-badge is-part">
                                                {p.widthMm}×{p.heightMm}×{p.depthMm}
                                            </span>
                                        </div>
                                        {def.parts.length > 1 && (
                                            <div className="tree-node-actions">
                                                <button
                                                    type="button"
                                                    className="tree-action-btn"
                                                    title="Usuń część"
                                                    onClick={(e) => handleDeletePart(p.id, e)}
                                                >
                                                    {TREE_ICONS.trash}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                        {/* Grupa: Cięcia */}
                        <div
                            className="tree-node"
                            style={{ marginTop: '8px', background: 'rgba(255,255,255,0.02)' }}
                            onClick={() => setIsCutsExpanded(!isCutsExpanded)}
                        >
                            <div className="tree-node-content">
                                {isCutsExpanded ? TREE_ICONS.chevronDown : TREE_ICONS.chevronRight}
                                {TREE_ICONS.opsFolder}
                                <span className="node-name-text" style={{ fontWeight: 600 }}>Cięcia (Otwory / Rewizje)</span>
                                <span style={{ opacity: 0.5, fontSize: '10px' }}>({def.cuts.length})</span>
                            </div>
                        </div>

                        {isCutsExpanded &&
                            def.cuts.map((cut) => {
                                const isSel = selectedId === cut.id;
                                const prot = calculateCutProtrusion(cut, def.mainContainer);
                                const maxProt = Math.max(
                                    prot.leftXMinusMm,
                                    prot.rightXPlusMm,
                                    prot.bottomYMinusMm,
                                    prot.topYPlusMm,
                                    prot.backZMinusMm,
                                    prot.frontZPlusMm
                                );

                                return (
                                    <div
                                        key={cut.id}
                                        className={`tree-node ${isSel ? 'selected' : ''}`}
                                        style={{ paddingLeft: '22px' }}
                                        onClick={() => setSelectedId(cut.id)}
                                    >
                                        <div className="tree-node-content">
                                            {TREE_ICONS.tool}
                                            <span className="node-name-text">{cut.name}</span>
                                            {cut.type === 'HOLE' ? (
                                                <span className="cad-tree-badge is-hole">
                                                    Ø{(cut as SmartPartHoleCut).diameterMm}
                                                    {maxProt > 0 ? ` (+${maxProt})` : ''}
                                                </span>
                                            ) : (
                                                <span className="cad-tree-badge is-pocket">
                                                    {(cut as SmartPartPocketCut).widthMm}×{(cut as SmartPartPocketCut).heightMm}
                                                    {maxProt > 0 ? ` (+${maxProt})` : ''}
                                                </span>
                                            )}
                                        </div>
                                        <div className="tree-node-actions">
                                            <button
                                                type="button"
                                                className="tree-action-btn"
                                                title="Usuń cięcie"
                                                onClick={(e) => handleDeleteCut(cut.id, e)}
                                            >
                                                {TREE_ICONS.trash}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {/* 2. ŚRODKOWY PANEL: Viewport 3D */}
                <div className="cad-viewport-container">
                    <canvas ref={canvasRef} className="cad-canvas" />

                    <div className="cad-viewport-toolbar-container">
                        <div className="cad-transform-toolbar">
                            <button
                                type="button"
                                className={`cad-tool-btn ${transformTool === 'select' ? 'is-active' : ''}`}
                                onClick={() => handleChangeTransformTool('select')}
                            >
                                <span>✋ Wybierz</span>
                                <span className="cad-hotkey-badge">Q</span>
                            </button>
                            <button
                                type="button"
                                className={`cad-tool-btn ${transformTool === 'translate' ? 'is-active' : ''}`}
                                onClick={() => handleChangeTransformTool(
                                    transformTool === 'translate' ? 'select' : 'translate'
                                )}
                            >
                                <span>↔️ Przesuń</span>
                                <span className="cad-hotkey-badge">G</span>
                            </button>
                            <button
                                type="button"
                                className={`cad-tool-btn ${transformTool === 'rotate' ? 'is-active' : ''}`}
                                onClick={() => handleChangeTransformTool('rotate')}
                            >
                                <span>🔄 Obróć</span>
                                <span className="cad-hotkey-badge">E</span>
                            </button>
                        </div>

                        <div className="cad-camera-toolbar">
                            <button type="button" className="cad-camera-btn" onClick={() => sceneRef.current?.setViewPreset('ISO')}>
                                ISO
                            </button>
                            <button type="button" className="cad-camera-btn" onClick={() => sceneRef.current?.setViewPreset('TOP')}>
                                GÓRA
                            </button>
                            <button type="button" className="cad-camera-btn" onClick={() => sceneRef.current?.setViewPreset('FRONT')}>
                                PRZÓD
                            </button>
                            <button type="button" className="cad-camera-btn" onClick={() => sceneRef.current?.setViewPreset('SIDE')}>
                                BOK
                            </button>
                            <div className="cad-toolbar-separator" />
                            <button
                                type="button"
                                className={`cad-camera-btn ${isOrtho ? 'is-active' : ''}`}
                                onClick={() => {
                                    const next = sceneRef.current?.toggleProjection() ?? false;
                                    setIsOrtho(next);
                                }}
                            >
                                {isOrtho ? '📐 ORTHO' : '👁️ PERSP'}
                            </button>
                            <button type="button" className="cad-camera-btn" onClick={() => sceneRef.current?.resetCamera()}>
                                Dopasuj
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. PRAWY PANEL: Biblioteki i Inspektor */}
                <div className="cad-properties-panel">
                    <div className="cad-section">
                        <div className="cad-section-title">Biblioteka Obiektów</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button type="button" className="cad-add-btn" onClick={handleAddPart}>
                                <span>🧩 + Dodaj Part (Część)</span>
                            </button>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                <button type="button" className="cad-add-btn is-hole" onClick={handleAddHoleCut}>
                                    <span>+ Otwór okrągły</span>
                                </button>
                                <button type="button" className="cad-add-btn is-pocket" onClick={handleAddPocketCut}>
                                    <span>+ Wcięcie prostokątne</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="cad-section" style={{ flex: 1, overflowY: 'auto' }}>
                        {selectedId === 'main_container' && (
                            <>
                                <div className="cad-section-title">Kontener główny</div>
                                <div className="cad-prop-grid">
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Szerokość [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={def.mainContainer.widthMm}
                                            onChange={(e) => handleUpdateMainContainer('widthMm', Number(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Wysokość [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={def.mainContainer.heightMm}
                                            onChange={(e) => handleUpdateMainContainer('heightMm', Number(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Głębokość [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={def.mainContainer.depthMm}
                                            onChange={(e) => handleUpdateMainContainer('depthMm', Number(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {selectedPart && (
                            <>
                                <div className="cad-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Część (Part)</span>
                                    {def.parts.length > 1 && (
                                        <button
                                            type="button"
                                            className="cad-btn-danger-sm"
                                            onClick={() => handleDeletePart(selectedPart.id)}
                                        >
                                            Usuń
                                        </button>
                                    )}
                                </div>
                                <div className="cad-prop-grid">
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Nazwa części</label>
                                        <input
                                            type="text"
                                            className="cad-prop-input"
                                            value={selectedPart.name}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setDef((prev) => ({
                                                    ...prev,
                                                    parts: prev.parts.map((p) => (p.id === selectedPart.id ? { ...p, name: val } : p)),
                                                }));
                                            }}
                                        />
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Szerokość [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedPart.widthMm}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setDef((prev) => ({
                                                    ...prev,
                                                    parts: prev.parts.map((p) => (p.id === selectedPart.id ? { ...p, widthMm: val } : p)),
                                                }));
                                            }}
                                        />
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Wysokość [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedPart.heightMm}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setDef((prev) => ({
                                                    ...prev,
                                                    parts: prev.parts.map((p) => (p.id === selectedPart.id ? { ...p, heightMm: val } : p)),
                                                }));
                                            }}
                                        />
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Głębokość [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedPart.depthMm}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setDef((prev) => ({
                                                    ...prev,
                                                    parts: prev.parts.map((p) => (p.id === selectedPart.id ? { ...p, depthMm: val } : p)),
                                                }));
                                            }}
                                        />
                                    </div>

                                    {/* Pozycjonowanie względem ścian referencyjnych */}
                                    <div className="cad-prop-row" style={{ gridColumn: 'span 2', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>Pozycja i ściany odniesienia</span>
                                    </div>

                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Oś X: Odniesienie</label>
                                        <select
                                            className="cad-prop-select"
                                            value={selectedPart.refX || 'CENTER'}
                                            onChange={(e) => handleUpdatePartRef(selectedPart.id, 'X', e.target.value)}
                                        >
                                            <option value="LEFT">Bok lewy (-X)</option>
                                            <option value="RIGHT">Bok prawy (+X)</option>
                                            <option value="CENTER">Środek</option>
                                        </select>
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Odstęp X [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedPart.offsetX_mm ?? selectedPart.xMm}
                                            onChange={(e) => handleUpdatePartRef(selectedPart.id, 'X', selectedPart.refX || 'CENTER', Number(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Oś Y: Odniesienie</label>
                                        <select
                                            className="cad-prop-select"
                                            value={selectedPart.refY || 'CENTER'}
                                            onChange={(e) => handleUpdatePartRef(selectedPart.id, 'Y', e.target.value)}
                                        >
                                            <option value="FRONT">Przód (−Y)</option>
                                            <option value="BACK">Tył (+Y)</option>
                                            <option value="CENTER">Środek</option>
                                        </select>
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Odstęp Y [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedPart.offsetY_mm ?? selectedPart.yMm}
                                            onChange={(e) => handleUpdatePartRef(selectedPart.id, 'Y', selectedPart.refY || 'CENTER', Number(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Oś Z: Odniesienie</label>
                                        <select
                                            className="cad-prop-select"
                                            value={selectedPart.refZ || 'CENTER'}
                                            onChange={(e) => handleUpdatePartRef(selectedPart.id, 'Z', e.target.value)}
                                        >
                                            <option value="BOTTOM">Dół (−Z)</option>
                                            <option value="TOP">Góra (+Z)</option>
                                            <option value="CENTER">Środek</option>
                                        </select>
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Odstęp Z [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedPart.offsetZ_mm ?? selectedPart.zMm}
                                            onChange={(e) => handleUpdatePartRef(selectedPart.id, 'Z', selectedPart.refZ || 'CENTER', Number(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {selectedCut && selectedCut.type === 'HOLE' && (
                            <>
                                <div className="cad-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Otwór okrągły</span>
                                    <button
                                        type="button"
                                        className="cad-btn-danger-sm"
                                        onClick={() => handleDeleteCut(selectedCut.id)}
                                    >
                                        Usuń
                                    </button>
                                </div>
                                <div className="cad-prop-grid">
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Nazwa cięcia</label>
                                        <input
                                            type="text"
                                            className="cad-prop-input"
                                            value={selectedCut.name}
                                            onChange={(e) => handleUpdateCutProp(selectedCut.id, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Średnica Ø [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={(selectedCut as SmartPartHoleCut).diameterMm}
                                            onChange={(e) => handleUpdateCutProp(selectedCut.id, 'diameterMm', Number(e.target.value) || 1)}
                                        />
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Długość [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={(selectedCut as SmartPartHoleCut).lengthMm}
                                            onChange={(e) => handleUpdateCutProp(selectedCut.id, 'lengthMm', Number(e.target.value) || 1)}
                                        />
                                    </div>

                                    {/* Pozycjonowanie względem ścian referencyjnych */}
                                    <div className="cad-prop-row" style={{ gridColumn: 'span 2', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>Pozycja i ściany odniesienia</span>
                                    </div>

                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Oś X: Odniesienie</label>
                                        <select
                                            className="cad-prop-select"
                                            value={selectedCut.refX || 'CENTER'}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'X', e.target.value)}
                                        >
                                            <option value="LEFT">Bok lewy (-X)</option>
                                            <option value="RIGHT">Bok prawy (+X)</option>
                                            <option value="CENTER">Środek</option>
                                        </select>
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Odstęp X [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedCut.offsetX_mm ?? selectedCut.xMm}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'X', selectedCut.refX || 'CENTER', Number(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Oś Y: Odniesienie</label>
                                        <select
                                            className="cad-prop-select"
                                            value={selectedCut.refY || 'CENTER'}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Y', e.target.value)}
                                        >
                                            <option value="FRONT">Przód (−Y)</option>
                                            <option value="BACK">Tył (+Y)</option>
                                            <option value="CENTER">Środek</option>
                                        </select>
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Odstęp Y [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedCut.offsetY_mm ?? selectedCut.yMm}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Y', selectedCut.refY || 'CENTER', Number(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Oś Z: Odniesienie</label>
                                        <select
                                            className="cad-prop-select"
                                            value={selectedCut.refZ || 'CENTER'}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Z', e.target.value)}
                                        >
                                            <option value="BOTTOM">Dół (−Z)</option>
                                            <option value="TOP">Góra (+Z)</option>
                                            <option value="CENTER">Środek</option>
                                        </select>
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Odstęp Z [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedCut.offsetZ_mm ?? selectedCut.zMm}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Z', selectedCut.refZ || 'CENTER', Number(e.target.value) || 0)}
                                        />
                                    </div>

                                </div>
                            </>
                        )}

                        {selectedCut && selectedCut.type === 'POCKET' && (
                            <>
                                <div className="cad-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Wcięcie prostokątne</span>
                                    <button
                                        type="button"
                                        className="cad-btn-danger-sm"
                                        onClick={() => handleDeleteCut(selectedCut.id)}
                                    >
                                        Usuń
                                    </button>
                                </div>
                                <div className="cad-prop-grid">
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Nazwa cięcia</label>
                                        <input
                                            type="text"
                                            className="cad-prop-input"
                                            value={selectedCut.name}
                                            onChange={(e) => handleUpdateCutProp(selectedCut.id, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Szerokość [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={(selectedCut as SmartPartPocketCut).widthMm}
                                            onChange={(e) => handleUpdateCutProp(selectedCut.id, 'widthMm', Number(e.target.value) || 1)}
                                        />
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Wysokość [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={(selectedCut as SmartPartPocketCut).heightMm}
                                            onChange={(e) => handleUpdateCutProp(selectedCut.id, 'heightMm', Number(e.target.value) || 1)}
                                        />
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Głębokość [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={(selectedCut as SmartPartPocketCut).depthMm}
                                            onChange={(e) => handleUpdateCutProp(selectedCut.id, 'depthMm', Number(e.target.value) || 1)}
                                        />
                                    </div>

                                    {/* Pozycjonowanie względem ścian referencyjnych */}
                                    <div className="cad-prop-row" style={{ gridColumn: 'span 2', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>Pozycja i ściany odniesienia</span>
                                    </div>

                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Oś X: Odniesienie</label>
                                        <select
                                            className="cad-prop-select"
                                            value={selectedCut.refX || 'CENTER'}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'X', e.target.value)}
                                        >
                                            <option value="LEFT">Bok lewy (-X)</option>
                                            <option value="RIGHT">Bok prawy (+X)</option>
                                            <option value="CENTER">Środek</option>
                                        </select>
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Odstęp X [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedCut.offsetX_mm ?? selectedCut.xMm}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'X', selectedCut.refX || 'CENTER', Number(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Oś Y: Odniesienie</label>
                                        <select
                                            className="cad-prop-select"
                                            value={selectedCut.refY || 'CENTER'}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Y', e.target.value)}
                                        >
                                            <option value="FRONT">Przód (−Y)</option>
                                            <option value="BACK">Tył (+Y)</option>
                                            <option value="CENTER">Środek</option>
                                        </select>
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Odstęp Y [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedCut.offsetY_mm ?? selectedCut.yMm}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Y', selectedCut.refY || 'CENTER', Number(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Oś Z: Odniesienie</label>
                                        <select
                                            className="cad-prop-select"
                                            value={selectedCut.refZ || 'CENTER'}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Z', e.target.value)}
                                        >
                                            <option value="BOTTOM">Dół (−Z)</option>
                                            <option value="TOP">Góra (+Z)</option>
                                            <option value="CENTER">Środek</option>
                                        </select>
                                    </div>
                                    <div className="cad-prop-row">
                                        <label className="cad-prop-label">Odstęp Z [mm]</label>
                                        <input
                                            type="number"
                                            className="cad-prop-input"
                                            value={selectedCut.offsetZ_mm ?? selectedCut.zMm}
                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Z', selectedCut.refZ || 'CENTER', Number(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {selectedProtrusion && (
                            <div className="cad-protrusion-box">
                                <div className="cad-protrusion-title">
                                    <span>Głębokość wycięcia w ściankach korpusu</span>
                                </div>
                                <div className="cad-protrusion-grid">
                                    <div className="cad-protrusion-item">
                                        <span className="cad-protrusion-label">Bok lewy (-X):</span>
                                        <span className="cad-protrusion-val">{selectedProtrusion.leftXMinusMm} mm</span>
                                    </div>
                                    <div className="cad-protrusion-item">
                                        <span className="cad-protrusion-label">Bok prawy (+X):</span>
                                        <span className="cad-protrusion-val">{selectedProtrusion.rightXPlusMm} mm</span>
                                    </div>
                                    <div className="cad-protrusion-item">
                                        <span className="cad-protrusion-label">Wieniec dolny (-Y):</span>
                                        <span className="cad-protrusion-val">{selectedProtrusion.bottomYMinusMm} mm</span>
                                    </div>
                                    <div className="cad-protrusion-item">
                                        <span className="cad-protrusion-label">Wieniec górny (+Y):</span>
                                        <span className="cad-protrusion-val">{selectedProtrusion.topYPlusMm} mm</span>
                                    </div>
                                    <div className="cad-protrusion-item">
                                        <span className="cad-protrusion-label">Plecy (-Z):</span>
                                        <span className="cad-protrusion-val">{selectedProtrusion.backZMinusMm} mm</span>
                                    </div>
                                    <div className="cad-protrusion-item">
                                        <span className="cad-protrusion-label">Front (+Z):</span>
                                        <span className="cad-protrusion-val">{selectedProtrusion.frontZPlusMm} mm</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
