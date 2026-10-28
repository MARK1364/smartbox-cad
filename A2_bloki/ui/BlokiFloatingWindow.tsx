/**
 * BlokiFloatingWindow.tsx
 *
 * Pływające, przeciągalne okno konfiguracji Bloku (nowy workflow UI).
 * Umożliwia swobodną manipulację kamerą 3D podczas edycji parametrów modułu (Półki)
 * oraz wskazywanie ścian referencyjnych pipetą w scenie 3D.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    update_bloki_core,
    validateReferenceFaceOrientation,
    resolveManualReferenceFace,
    canonicalizeRefFaceName,
} from '../01_bloki-core.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { UIController } from '../../A1_core/ui-controller.js';
import { SetBlokiParamsCommand } from '../commands/set-blok-params-command.js';
import { ShelvesSubModule } from '../04_shelves-adapter.js';
import { CornerShelvesSubModule } from '../18_corner-shelves-adapter.js';
import { ShelfSubModule } from '../03_shelf-adapter.js';
import { DoorsSubModule } from '../05_doors-adapter.js';
import { SkosneDoorsSubModule } from '../06_skosne-doors-adapter.js';
import { CornerDoorsSubModule } from '../07_corner-doors-adapter.js';
import { TubesSubModule } from '../08_tubes-adapter.js';
import { DrawersSubModule } from '../09_drawers-adapter.js';
import { DividersSubModule } from '../10_dividers-adapter.js';
import { PanelsSubModule } from '../11_panels-adapter.js';
import { FlapsSubModule } from '../12_flaps-adapter.js';
import { LedInternalSubModule } from '../13_led-internal-adapter.js';
import { LedExternalSubModule } from '../14_led-external-adapter.js';
import { SinkEditPanel } from '../sinks/sink-edit-panel.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { highlightBayInScene, clearBayHighlight } from '../02_bloki-bay-visualizer.js';
import {
    highlightBlokiRefSide,
    clearBlokiRefPlaneHint,
    type BlokiRefSideKey,
} from '../02_bloki-ref-plane-hint.js';
import { HEIGHT_H_LOCKED_HINT, isBlokiHeightHLocked } from '../01_bloki-height-h.js';
import { resolveDetectedBay } from '../02_bloki-bay-detector.js';
import { buildCornerDoorsAutoRefsPatch } from '../07_corner-doors-refs.js';

export const MODULE_TYPES: Record<string, { type: string; label: string; category?: 'internal' | 'external' | 'panel' }> = {
    'EMPTY': { type: 'blok_empty', label: 'Wybierz moduł...' },
    'SHELVES': { type: 'blok_shelves', label: 'Półki', category: 'internal' },
    'CORNER_SHELVES': { type: 'blok_corner_shelves', label: 'Półki narożne', category: 'internal' },
    'DOORS': { type: 'blok_doors', label: 'Drzwi', category: 'internal' },
    'SKOSNE_DOORS': { type: 'blok_skosne_drzwi', label: 'Drzwi skośne', category: 'internal' },
    'CORNER_DOORS': { type: 'blok_corner_doors', label: 'Drzwi narożne', category: 'internal' },
    'DRAWERS': { type: 'blok_drawers', label: 'Szuflady', category: 'internal' },
    'FLAPS': { type: 'blok_flaps', label: 'Klapy', category: 'internal' },
    'TUBES': { type: 'blok_tubes', label: 'Drążek', category: 'internal' },
    'SHELF': { type: 'blok_shelf', label: 'Wieniec', category: 'internal' },
    'DIVIDERS': { type: 'blok_dividers', label: 'Przegrody', category: 'internal' },
    'LED_INTERNAL': { type: 'blok_led_internal', label: 'LED wewnętrzny', category: 'internal' },
    'PANELS': { type: 'blok_panels', label: 'Blendy', category: 'external' },
    'LED_EXTERNAL': { type: 'blok_led_external', label: 'LED zewnętrzny (kanał)', category: 'external' },
    'HANDLES': { type: 'blok_handle', label: 'Uchwyty', category: 'panel' },
    'SINKS': { type: 'blok_sink', label: 'Zlew', category: 'panel' },
    'HANGERS': { type: 'smartpart_hangers', label: 'Zawieszki', category: 'internal' }
};

export const INTERNAL_MODULE_TYPES = Object.entries(MODULE_TYPES).filter(([_, v]) => v.category === 'internal');
export const EXTERNAL_MODULE_TYPES = Object.entries(MODULE_TYPES).filter(([_, v]) => v.category === 'external');
export const PANEL_MODULE_TYPES = Object.entries(MODULE_TYPES).filter(([_, v]) => v.category === 'panel');

interface Props {
    container: any;
    projectModel: any;
    onClose: () => void;
    isDocked?: boolean;
    onNewBloki?: () => void;
}

function cloneParams(params: any): Record<string, any> {
    return JSON.parse(JSON.stringify(params || {}));
}

export function BlokiFloatingWindow({ container, projectModel, onClose, isDocked, onNewBloki }: Props) {
    // Stan pozycji okna pływającego (domyślnie z prawej strony pod UI, aby nie zasłaniać korpusu)
    const [position, setPosition] = useState(() => {
        const defaultX = typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 320 - 366) : 1000;
        return { x: defaultX, y: 70 };
    });
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeTab, setActiveTab] = useState<'module' | 'references'>(() => {
        const p = container?.generatorParams;
        return (p?.boxType === 'CORNER_DOORS' || p?.type === 'blok_corner_doors') ? 'references' : 'module';
    });

    const [boxType, setBoxType] = useState<string>(() => {
        const p = container?.generatorParams;
        if (p?.boxType && MODULE_TYPES[p.boxType]) return p.boxType;
        if (p?.type) {
            for (const [k, v] of Object.entries(MODULE_TYPES)) {
                if (v.type === p.type) return k;
            }
        }
        return 'EMPTY';
    });

    // Referencje i parametry
    const [customRefs, setCustomRefs] = useState<any>(container?.generatorParams?.customReferences || {});
    const [offsets, setOffsets] = useState<any>(container?.generatorParams?.offsets || {});
    const [disabledRefsState, setDisabledRefsState] = useState<any>(container?.generatorParams?.disabledReferences || {});
    const [maxHeight, setMaxHeight] = useState<string | number>(container?.generatorParams?.maxHeight || 0);
    const [pickingField, setPickingField] = useState<string | null>(null);

    // Live update i historia undo/redo
    const pendingParamsRef = useRef<Record<string, any>>({});
    const rafIdRef = useRef<number | null>(null);
    const commitTimerRef = useRef<number | null>(null);
    const committedParamsRef = useRef<Record<string, any> | null>(cloneParams(container?.generatorParams));
    const isPreviewingRef = useRef(false);

    // Przeciąganie okna
    const dragDataRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

    // Synchronizacja stanu przy zmianie kontenera
    useEffect(() => {
        if (!container) return;
        const p = container.generatorParams || {};
        let resolvedType = p.boxType || 'EMPTY';
        if (!p.boxType && p.type) {
            for (const [k, v] of Object.entries(MODULE_TYPES)) {
                if (v.type === p.type) { resolvedType = k; break; }
            }
        }
        setBoxType(resolvedType);
        if (resolvedType === 'CORNER_DOORS') {
            setActiveTab('references');
        }
        setCustomRefs(p.customReferences || {});
        setOffsets(p.offsets || {});
        setDisabledRefsState(p.disabledReferences || {});
        setMaxHeight(p.maxHeight || 0);
        committedParamsRef.current = cloneParams(p);
    }, [container?.id]);

    useEffect(() => {
        return () => {
            clearBlokiRefPlaneHint();
        };
    }, []);

    // Obsługa przeciągania myszą za nagłówek
    const handleHeaderMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.closest('button')) return;

        dragDataRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initX: position.x,
            initY: position.y
        };

        const handleMouseMove = (moveEvt: MouseEvent) => {
            if (!dragDataRef.current) return;
            const dx = moveEvt.clientX - dragDataRef.current.startX;
            const dy = moveEvt.clientY - dragDataRef.current.startY;
            setPosition({
                x: Math.max(10, Math.min(window.innerWidth - 320, dragDataRef.current.initX + dx)),
                y: Math.max(40, Math.min(window.innerHeight - 100, dragDataRef.current.initY + dy))
            });
        };

        const handleMouseUp = () => {
            dragDataRef.current = null;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const scheduleCommit = useCallback(() => {
        if (commitTimerRef.current !== null) {
            window.clearTimeout(commitTimerRef.current);
        }
        commitTimerRef.current = window.setTimeout(() => {
            commitTimerRef.current = null;
            if (!container) return;
            const history = ContextManager.instance.commandHistory;
            const current = cloneParams(container.generatorParams);
            const old = committedParamsRef.current;
            if (!old) {
                committedParamsRef.current = current;
                return;
            }
            if (JSON.stringify(old) === JSON.stringify(current)) return;
            if (history) {
                history.execute(new SetBlokiParamsCommand(container.id, old, current));
            }
            committedParamsRef.current = current;
        }, 400);
    }, [container]);

    const flushUpdate = useCallback(() => {
        if (!container) return;
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        const updates = { ...pendingParamsRef.current };
        pendingParamsRef.current = {};

        container.generatorParams = {
            ...container.generatorParams,
            ...updates
        };

        const doc = ContextManager.instance.document || projectModel;
        isPreviewingRef.current = true;
        update_bloki_core(container, doc);
        isPreviewingRef.current = false;

        if (typeof (window as any).__rebuildGeometry === 'function') {
            (window as any).__rebuildGeometry('Bloki update');
        } else if (typeof doc?._notify === 'function') {
            doc._notify();
        } else if (doc?.emitChange) {
            doc.emitChange('all');
        }

        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        scheduleCommit();
    }, [container, projectModel, scheduleCommit]);

    const triggerUpdateEx = useCallback((updatedParams: any, immediate: boolean = false) => {
        if (!container) return;

        pendingParamsRef.current = {
            ...pendingParamsRef.current,
            ...updatedParams
        };

        container.generatorParams = {
            ...container.generatorParams,
            ...updatedParams
        };

        if (immediate) {
            flushUpdate();
            return;
        }

        if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;
                flushUpdate();
            });
        }
    }, [container, flushUpdate]);

    // ─── PIPETA I OBSŁUGA REFERENCJI ───────────────────────────────────────────
    const cancelPicking = useCallback(() => {
        setPickingField(null);
        delete ContextManager.instance.activeReferencePicker;
        const picker = ContextManager.instance.facePicker;
        if (picker) {
            picker.selectionMode = 'object';
            picker.targetSubgeometryType = null;
            picker.clearSelection();
        }
        const appApi = (window as any).app || ContextManager.instance.appAPI;
        if (appApi?.setSelectionMode) appApi.setSelectionMode('object');
    }, []);

    const startPicking = (sideKey: string) => {
        if (pickingField === sideKey) {
            cancelPicking();
            return;
        }

        const isCustom = !!customRefs[sideKey];
        const isDisabled = !!disabledRefsState[sideKey];
        if (isCustom && !isDisabled) {
            showRefSideHint(sideKey as BlokiRefSideKey);
            const appApi = (window as any).app || ContextManager.instance.appAPI;
            const sideLabels: any = {
                xMin: 'Bok Lewy', xMax: 'Bok Prawy',
                yMin: 'Przód', yMax: 'Tył',
                zMin: 'Dół', zMax: 'Góra'
            };
            appApi.setStatus(`Odniesienie [${sideLabels[sideKey] || sideKey}] jest przypisane. Aby wybrać inne, najpierw kliknij [✕] aby je skasować.`, true);
            return;
        }

        setPickingField(sideKey);

        const picker = ContextManager.instance.facePicker;
        if (picker) {
            picker.selectionMode = 'subgeometry';
            picker.targetSubgeometryType = 'face';
            if (typeof picker.resetAllFaceHighlights === 'function') picker.resetAllFaceHighlights();
            else picker.clearSelection();
        }

        const appApi = (window as any).app || ContextManager.instance.appAPI;
        if (appApi?.setSelectionMode) appApi.setSelectionMode('subgeometry');

        ContextManager.instance.activeReferencePicker = {
            field: sideKey,
            sideKey,
            // Kontrakt app.ts: onSelect({ partKey, face, panelModel, panelId })
            onSelect: (refData: {
                partKey: string;
                face: string;
                panelModel?: any;
                panelId?: string;
                nodeId?: string;
                worldNormal?: { x: number; y: number; z: number } | null;
                uv?: { u: number; v: number } | null;
            }) => {
                const doc = ContextManager.instance.document;
                const panelId = refData.panelId || refData.nodeId || refData.panelModel?.id;
                const targetNode = panelId && doc?.findNode ? doc.findNode(panelId) : null;
                const targetPartKey = targetNode?.name
                    || (refData.panelModel as any)?.key
                    || refData.panelModel?.name
                    || refData.partKey
                    || panelId;

                const cabinetId = container?.generatorParams?.parentContainerId || '';
                const cabinetNode = doc?.findNode
                    ? (doc.findNode(cabinetId) || (doc.getContainers ? doc.getContainers()[0] : null))
                    : null;
                const targetPanel = refData.panelModel || targetNode?.domainData;

                const resolvedFace = targetPanel && targetNode && cabinetNode
                    ? resolveManualReferenceFace(
                        targetPanel,
                        targetNode,
                        cabinetNode,
                        refData.face,
                        sideKey,
                        refData.worldNormal,
                        refData.uv
                    )
                    : { face: canonicalizeRefFaceName(refData.face), mapped: false };

                if (targetPanel && targetNode && cabinetNode) {
                    const orient = validateReferenceFaceOrientation(
                        targetPanel,
                        targetNode,
                        cabinetNode,
                        resolvedFace.face,
                        sideKey,
                        container?.generatorParams?.customReferences,
                        { manualPick: true }
                    );
                    if (!orient.valid) {
                        if (appApi?.setStatus) appApi.setStatus(`⛔ ${orient.errorMsg}`, true);
                        return;
                    }
                }

                const updatedRefs = {
                    ...(container?.generatorParams?.customReferences || {}),
                    [sideKey]: {
                        partKey: targetPartKey,
                        face: resolvedFace.face,
                        panelId: panelId || undefined
                    }
                };
                const updatedDisabled = { ...(container?.generatorParams?.disabledReferences || {}) };
                delete updatedDisabled[sideKey];

                setCustomRefs(updatedRefs);
                setDisabledRefsState(updatedDisabled);
                setPickingField(null);
                delete ContextManager.instance.activeReferencePicker;
                const picker = ContextManager.instance.facePicker;
                if (picker) {
                    picker.selectionMode = 'object';
                    picker.targetSubgeometryType = null;
                    if (typeof picker.resetAllFaceHighlights === 'function') picker.resetAllFaceHighlights();
                    else picker.clearSelection();
                }
                if (appApi?.setSelectionMode) appApi.setSelectionMode('object');

                triggerUpdateEx({
                    customReferences: updatedRefs,
                    disabledReferences: updatedDisabled
                }, true);

                if (appApi?.setStatus) {
                    appApi.setStatus(`Przypisano odniesienie → ${targetPartKey}`, false);
                }
            },
            onCancel: () => cancelPicking()
        };
    };

    const handleClearOrRestoreRef = (sideKey: string) => {
        if (pickingField === sideKey) cancelPicking();

        const updatedRefs = { ...(container?.generatorParams?.customReferences || {}) };
        delete updatedRefs[sideKey];

        const disabledRefs = { ...(container?.generatorParams?.disabledReferences || {}) };
        const willBeDisabled = !disabledRefs[sideKey];
        if (willBeDisabled) {
            disabledRefs[sideKey] = true;
        } else {
            delete disabledRefs[sideKey];
        }

        setCustomRefs(updatedRefs);
        setDisabledRefsState(disabledRefs);

        triggerUpdateEx({
            customReferences: updatedRefs,
            disabledReferences: disabledRefs
        }, true);
    };

    const handleOffsetChange = (sideKey: string, valStr: string) => {
        const updatedOffsets = {
            ...(offsets || {}),
            [sideKey]: valStr
        };
        setOffsets(updatedOffsets);
        if (valStr !== '-' && valStr !== '' && !isNaN(Number(valStr))) {
            const sanitized = parseFloat(valStr);
            triggerUpdateEx({
                offsets: {
                    ...(container?.generatorParams?.offsets || {}),
                    [sideKey]: sanitized
                }
            });
        }
    };

    const showRefSideHint = useCallback((sideKey: BlokiRefSideKey) => {
        if (!container || pickingField === sideKey) return;
        highlightBlokiRefSide(container, sideKey, {
            customRefs,
            references: container?.generatorParams?.references,
        });
    }, [container, customRefs, pickingField]);

    const hideRefSideHint = useCallback(() => {
        clearBlokiRefPlaneHint();
    }, []);

    const renderRefSlot = (sideKey: BlokiRefSideKey, defaultName: string) => {
        const isCustom = !!customRefs[sideKey];
        const isDisabled = !!disabledRefsState[sideKey];
        const isPicking = pickingField === sideKey;
        const isEmpty = isDisabled || !isCustom;

        let labelText = isCustom && !isDisabled ? customRefs[sideKey].partKey : '';
        if (isPicking) labelText = '🎯 Wskaż ścianę…';

        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: '#16191f',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: isPicking ? '1px solid #eab308' : (isEmpty ? '1px dashed #3b4252' : '1px solid #272a30'),
                    minWidth: 0,
                    overflow: 'hidden',
                }}
                onMouseEnter={() => {
                    if (!isPicking) showRefSideHint(sideKey);
                }}
                onMouseLeave={hideRefSideHint}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                        {defaultName}
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', minWidth: 0, width: '100%' }}>
                    <button
                        onClick={() => startPicking(sideKey)}
                        title={isPicking
                            ? 'Wskaż ścianę w oknie 3D (kliknij, aby anulować)'
                            : isEmpty
                                ? `Kliknij, aby wskazać ścianę w 3D: ${defaultName}`
                                : `Odniesienie ${defaultName}: ${labelText}`}
                        style={{
                            flex: '1 1 0',
                            minWidth: 0,
                            width: 0,
                            padding: '4px 8px',
                            background: isPicking ? '#eab308' : (isEmpty ? '#1f242d' : '#222730'),
                            border: '1px solid #3b4252',
                            color: isPicking ? '#000' : (isEmpty ? '#71717a' : '#fff'),
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: isPicking || (isCustom && !isDisabled) ? 700 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {labelText || '\u00A0'}
                    </button>
                    <button
                        onClick={() => handleClearOrRestoreRef(sideKey)}
                        title={isDisabled ? 'Przywróć domyślne odniesienie' : 'Wyłącz odniesienie'}
                        style={{
                            flex: '0 0 auto',
                            width: '28px',
                            padding: '4px 0',
                            background: '#222730',
                            border: '1px solid #3b4252',
                            color: isDisabled ? '#4ade80' : '#ef4444',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px'
                        }}
                    >
                        {isDisabled ? '↺' : '✕'}
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <span style={{ color: '#8c93a0', fontSize: '11px' }}>Offset:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="number"
                            value={offsets[sideKey] !== undefined ? offsets[sideKey] : 0}
                            onChange={(e) => handleOffsetChange(sideKey, e.target.value)}
                            onBlur={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                handleOffsetChange(sideKey, String(v));
                            }}
                            style={{
                                width: '55px',
                                padding: '2px 4px',
                                background: '#121418',
                                border: '1px solid #3b4252',
                                color: '#fff',
                                borderRadius: '3px',
                                textAlign: 'right',
                                fontSize: '11px'
                            }}
                        />
                        <span style={{ color: '#8c93a0', fontSize: '10px' }}>mm</span>
                    </div>
                </div>
            </div>
        );
    };

    if (!container) return null;

    // Wymiary światła wnęki
    const widthMm = nmToMm(container.width || 0);
    const heightMm = nmToMm(container.height || 0);
    const depthMm = nmToMm(container.depth || 0);

    return (
        <div style={isDocked ? {
            width: '100%',
            backgroundColor: '#181a1f',
            color: '#e0e4eb',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, Segoe UI, sans-serif'
        } : {
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: '320px',
            maxWidth: '92vw',
            maxHeight: isMinimized ? 'auto' : '88vh',
            backgroundColor: '#181a1f',
            border: '1px solid #3b82f6',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75), 0 0 20px rgba(59, 130, 246, 0.25)',
            color: '#e0e4eb',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'Inter, Segoe UI, sans-serif'
        }}>
            {/* ─── Pasek Nagłówka ─── */}
            <div
                onMouseDown={isDocked ? undefined : handleHeaderMouseDown}
                style={{
                    padding: '10px 14px',
                    background: '#121418',
                    borderBottom: '1px solid #282c35',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: isDocked ? 'default' : 'grab',
                    userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                            {container.name || 'Blok'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                            Wnęka: {widthMm.toFixed(0)} × {heightMm.toFixed(0)} × {depthMm.toFixed(0)} mm
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {onNewBloki && (
                        <button
                            onClick={onNewBloki}
                            title="Wstaw kolejny Blok do wnęki"
                            style={{
                                background: '#16a34a',
                                border: 'none',
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: '3px 7px',
                                borderRadius: '3px'
                            }}
                        >
                            + Nowy
                        </button>
                    )}
                    {!isDocked && (
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            title={isMinimized ? 'Rozwiń' : 'Zwiń'}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                fontSize: '14px',
                                cursor: 'pointer',
                                padding: '3px 7px',
                                borderRadius: '3px'
                            }}
                        >
                            {isMinimized ? '□' : '—'}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        title="Zamknij edycję"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '16px',
                            cursor: 'pointer',
                            padding: '3px 7px',
                            borderRadius: '3px'
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* ─── Zawartość okna (gdy nie jest zminimalizowane) ─── */}
            {!isMinimized && (
                <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
                    {/* Zakładki okna: Parametry | Referencje (NAD LISTĄ) */}
                    <div style={{
                        display: 'flex',
                        backgroundColor: '#14161a',
                        borderBottom: '1px solid #282c35'
                    }}>
                        <button
                            onClick={() => setActiveTab('module')}
                            style={{
                                flex: 1,
                                padding: '9px 12px',
                                background: activeTab === 'module' ? '#181a1f' : 'transparent',
                                border: 'none',
                                borderBottom: activeTab === 'module' ? '2px solid #3b82f6' : 'none',
                                color: activeTab === 'module' ? '#fff' : '#8c93a0',
                                fontWeight: activeTab === 'module' ? 700 : 500,
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            Parametry{boxType && boxType !== 'EMPTY' ? `: ${MODULE_TYPES[boxType]?.label || ''}` : ''}
                        </button>
                        <button
                            onClick={() => setActiveTab('references')}
                            style={{
                                flex: 1,
                                padding: '9px 12px',
                                background: activeTab === 'references' ? '#181a1f' : 'transparent',
                                border: 'none',
                                borderBottom: activeTab === 'references' ? '2px solid #3b82f6' : 'none',
                                color: activeTab === 'references' ? '#fff' : '#8c93a0',
                                fontWeight: activeTab === 'references' ? 700 : 500,
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            Odniesienia
                        </button>
                    </div>

                    {/* Treść Zakładki: Parametry Modułu */}
                    {activeTab === 'module' && (
                        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Lista wyboru typu Bloku (do podmiany) */}
                            <div style={{
                                padding: '6px 10px',
                                background: '#14161a',
                                borderRadius: '6px',
                                border: '1px solid #282c35',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    Moduł wnęki:
                                </span>
                                <select
                                    value={boxType}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setBoxType(val);
                                        const scene = ContextManager.instance.viewport?.scene;
                                        if (val !== 'EMPTY') {
                                            clearBayHighlight(scene);
                                        } else if (container && scene) {
                                            const resolvedBay = resolveDetectedBay(container.generatorParams, {
                                                width: container.width,
                                                height: container.height,
                                                depth: container.depth,
                                            });
                                            if (resolvedBay) highlightBayInScene(scene, resolvedBay);
                                        }
                                        const mapping = MODULE_TYPES[val] || MODULE_TYPES['SHELVES'];
                                        const patch: Record<string, any> = {
                                            boxType: val,
                                            type: mapping.type
                                        };
                                        if (val === 'CORNER_DOORS') {
                                            const autoRefs = buildCornerDoorsAutoRefsPatch(
                                                container,
                                                ContextManager.instance.document
                                            );
                                            if (autoRefs) {
                                                patch.customReferences = autoRefs.customReferences;
                                                patch.disabledReferences = autoRefs.disabledReferences;
                                                setCustomRefs(autoRefs.customReferences);
                                                setDisabledRefsState(autoRefs.disabledReferences);
                                            }
                                            setActiveTab('references');
                                        }
                                        triggerUpdateEx(patch, true);
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '6px 10px',
                                        background: '#1e2024',
                                        border: '1px solid #3b82f6',
                                        color: '#fff',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="EMPTY">Wybierz moduł...</option>
                                    {(container?.generatorParams?.side_references_bloki === 'OUTER' || boxType === 'PANELS') ? (
                                        EXTERNAL_MODULE_TYPES.map(([k, opt]) => (
                                            <option key={k} value={k}>
                                                {opt.label}
                                            </option>
                                        ))
                                    ) : (
                                        INTERNAL_MODULE_TYPES.map(([k, opt]) => (
                                            <option key={k} value={k}>
                                                {opt.label}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {boxType !== 'EMPTY' && (
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.5px' }}>
                                        {MODULE_TYPES[boxType]?.label.toUpperCase() || 'MODUŁ'}
                                    </div>
                                )}
                                {boxType === 'SHELVES' && <ShelvesSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'CORNER_SHELVES' && <CornerShelvesSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'DOORS' && <DoorsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'SKOSNE_DOORS' && <SkosneDoorsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'CORNER_DOORS' && <CornerDoorsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'DRAWERS' && <DrawersSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'FLAPS' && <FlapsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'TUBES' && <TubesSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'SHELF' && <ShelfSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'DIVIDERS' && <DividersSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'PANELS' && <PanelsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'LED_INTERNAL' && <LedInternalSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'LED_EXTERNAL' && <LedExternalSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'SINKS' && <SinkEditPanel container={container} />}
                                {boxType === 'EMPTY' && (
                                    <div style={{ padding: '16px', textAlign: 'center', color: '#8c93a0', fontSize: '12px' }}>
                                        Wybierz powyżej moduł, aby wstawić elementy do wnęki.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Treść Zakładki: Ściany Referencyjne */}
                    {activeTab === 'references' && (
                        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.5px' }}>
                                ŚCIANY OGRANICZAJĄCE WNĘKĘ:
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {renderRefSlot('xMin', 'Bok Lewy')}
                                {renderRefSlot('xMax', 'Bok Prawy')}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {renderRefSlot('yMin', 'Przód')}
                                {renderRefSlot('yMax', 'Tył')}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {renderRefSlot('zMin', 'Dół')}
                                {renderRefSlot('zMax', 'Góra')}
                            </div>

                            {/* Ograniczenie wysokości H — nieaktywne gdy góra+dół mają referencje */}
                            {(() => {
                                const hLocked = isBlokiHeightHLocked(customRefs, disabledRefsState);
                                const hNeedsInput = !hLocked && (!!disabledRefsState.zMin || !!disabledRefsState.zMax);
                                const showHLockedHint = () => {
                                    if (!hLocked) return;
                                    const appApi = ContextManager.instance.appAPI;
                                    if (appApi?.setStatus) appApi.setStatus(HEIGHT_H_LOCKED_HINT, true);
                                };
                                return (
                                    <div
                                        title={hLocked ? HEIGHT_H_LOCKED_HINT : undefined}
                                        onClick={showHLockedHint}
                                        onFocusCapture={showHLockedHint}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 10px',
                                            background: hLocked ? '#101218' : (hNeedsInput ? '#382510' : '#14161a'),
                                            border: '1px solid ' + (hLocked ? '#282c35' : (hNeedsInput ? '#f59e0b' : '#282c35')),
                                            borderRadius: '6px',
                                            opacity: hLocked ? 0.55 : 1,
                                            cursor: hLocked ? 'not-allowed' : undefined
                                        }}
                                    >
                                        <span style={{
                                            color: hLocked ? '#64748b' : (hNeedsInput ? '#fbbf24' : '#cbd5e1'),
                                            fontSize: '12px',
                                            fontWeight: hNeedsInput ? 700 : 400
                                        }}>
                                            {disabledRefsState.zMin && !disabledRefsState.zMax ? 'Wysokość H (od góry):' : (!disabledRefsState.zMin && disabledRefsState.zMax ? 'Wysokość H (od dołu):' : 'Wysokość H:')}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input
                                                type="number"
                                                value={maxHeight}
                                                readOnly={hLocked}
                                                tabIndex={hLocked ? -1 : undefined}
                                                onChange={(e) => {
                                                    if (hLocked) return;
                                                    const raw = e.target.value;
                                                    setMaxHeight(raw);
                                                    if (raw !== '-' && raw !== '' && !isNaN(Number(raw))) {
                                                        triggerUpdateEx({ maxHeight: parseFloat(raw) });
                                                    }
                                                }}
                                                onBlur={() => {
                                                    if (hLocked) return;
                                                    const val = parseFloat(String(maxHeight)) || 0;
                                                    setMaxHeight(val);
                                                    triggerUpdateEx({ maxHeight: val });
                                                }}
                                                onFocus={showHLockedHint}
                                                style={{
                                                    width: '80px',
                                                    padding: '4px 6px',
                                                    background: hLocked ? '#0d0f12' : '#121418',
                                                    border: '1px solid ' + (hLocked ? '#3f3f46' : (hNeedsInput ? '#f59e0b' : '#3b82f6')),
                                                    color: hLocked ? '#64748b' : '#fff',
                                                    borderRadius: '4px',
                                                    textAlign: 'right',
                                                    fontSize: '12px',
                                                    cursor: hLocked ? 'not-allowed' : undefined
                                                }}
                                            />
                                            <span style={{ color: '#8c93a0', fontSize: '11px' }}>mm</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* ─── Stopka Okna ─── */}
                    <div style={{
                        padding: '10px 14px',
                        borderTop: '1px solid #282c35',
                        background: '#121418',
                        display: 'flex',
                        justifyContent: onNewBloki ? 'space-between' : 'flex-end',
                        alignItems: 'center'
                    }}>
                        {onNewBloki && (
                            <button
                                onClick={onNewBloki}
                                style={{
                                    padding: '5px 10px',
                                    background: '#16a34a',
                                    border: 'none',
                                    color: '#fff',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                + Wstaw kolejny
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                padding: '6px 18px',
                                background: '#2563eb',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Zamknij
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
