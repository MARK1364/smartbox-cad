/**
 * SmartBoxFloatingWindow.tsx
 *
 * Pływające, przeciągalne okno konfiguracji SmartBoxa (nowy workflow UI).
 * Umożliwia swobodną manipulację kamerą 3D podczas edycji parametrów modułu (Półki)
 * oraz wskazywanie ścian referencyjnych pipetą w scenie 3D.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { update_smartbox_core, getDefaultReferenceProvenance, validateReferenceFaceOrientation } from '../smartbox-core.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { UIController } from '../../A1_core/ui-controller.js';
import { normalizeFaceName } from '../../A4_smartpanel/panel-model.js';
import { SetSmartBoxParamsCommand } from '../commands/set-smartbox-params-command.js';
import { ShelvesSubModule } from '../shelves-adapter.js';
import { ShelfSubModule } from '../shelf-adapter.js';
import { DoorsSubModule } from '../doors-adapter.js';
import { TubesSubModule } from '../tubes-adapter.js';
import { DrawersSubModule } from '../drawers-adapter.js';
import { DividersSubModule } from '../dividers-adapter.js';
import { PanelsSubModule } from '../panels-adapter.js';
import { FlapsSubModule } from '../flaps-adapter.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

export const MODULE_TYPES: Record<string, { type: string; label: string }> = {
    'EMPTY': { type: 'smartbox_empty', label: 'Wybierz moduł...' },
    'SHELVES': { type: 'smartbox_shelves', label: 'Półki' },
    'DOORS': { type: 'smartbox_doors', label: 'Drzwi' },
    'DRAWERS': { type: 'smartbox_drawers', label: 'Szuflady' },
    'FLAPS': { type: 'smartbox_flaps', label: 'Klapa' },
    'TUBES': { type: 'smartbox_tubes', label: 'Drążek' },
    'SHELF': { type: 'smartbox_shelf', label: 'Wieniec' },
    'DIVIDERS': { type: 'smartbox_dividers', label: 'Przegrody' },
    'PANELS': { type: 'smartbox_panels', label: 'Blendy' }
};

interface Props {
    container: any;
    projectModel: any;
    onClose: () => void;
    isDocked?: boolean;
    onNewSmartBox?: () => void;
}

function cloneParams(params: any): Record<string, any> {
    return JSON.parse(JSON.stringify(params || {}));
}

export function SmartBoxFloatingWindow({ container, projectModel, onClose, isDocked, onNewSmartBox }: Props) {
    // Stan pozycji okna pływającego (domyślnie z prawej strony pod UI, aby nie zasłaniać korpusu)
    const [position, setPosition] = useState(() => {
        const defaultX = typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 320 - 366) : 1000;
        return { x: defaultX, y: 70 };
    });
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeTab, setActiveTab] = useState<'module' | 'references'>('module');

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
        setCustomRefs(p.customReferences || {});
        setOffsets(p.offsets || {});
        setDisabledRefsState(p.disabledReferences || {});
        setMaxHeight(p.maxHeight || 0);
        committedParamsRef.current = cloneParams(p);
    }, [container?.id]);

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
                history.execute(new SetSmartBoxParamsCommand(container.id, old, current));
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
        update_smartbox_core(container, doc);
        isPreviewingRef.current = false;

        if (typeof doc?._notify === 'function') {
            doc._notify();
        } else if (doc?.emitChange) {
            doc.emitChange('all');
        }

        window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
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
        const appApi = (window as any).app;
        if (appApi?.setSelectionMode) appApi.setSelectionMode('object');
    }, []);

    const startPicking = (sideKey: string) => {
        if (pickingField === sideKey) {
            cancelPicking();
            return;
        }
        setPickingField(sideKey);

        const appApi = (window as any).app;
        if (appApi?.setSelectionMode) appApi.setSelectionMode('face');

        ContextManager.instance.activeReferencePicker = {
            field: sideKey,
            onPick: (panelId: string, faceName: string, meta?: any) => {
                const doc = ContextManager.instance.document;
                let targetPartKey = panelId;
                const targetNode = doc?.findNode ? doc.findNode(panelId) : null;
                if (targetNode?.name) targetPartKey = targetNode.name;

                const faceNorm = normalizeFaceName(faceName);
                const cabinetId = container?.generatorParams?.parentContainerId || '';
                const cabinetNode = doc?.findNode ? (doc.findNode(cabinetId) || (doc.getContainers ? doc.getContainers()[0] : null)) : null;
                const targetPanel = targetNode?.domainData;

                if (targetPanel && targetNode && cabinetNode) {
                    const orient = validateReferenceFaceOrientation(targetPanel, targetNode, cabinetNode, faceNorm, sideKey);
                    if (!orient.valid && appApi?.setStatus) {
                        appApi.setStatus(`Ostrzeżenie: Wybrana ściana ${faceNorm} może być nieprawidłowa dla ${sideKey}.`, true);
                    }
                }

                const updatedRefs = {
                    ...(container?.generatorParams?.customReferences || {}),
                    [sideKey]: {
                        partKey: targetPartKey,
                        face: faceNorm,
                        pointCoordMm: meta?.centerWorld ? meta.centerWorld : null
                    }
                };
                const updatedDisabled = { ...(container?.generatorParams?.disabledReferences || {}) };
                delete updatedDisabled[sideKey];

                setCustomRefs(updatedRefs);
                setDisabledRefsState(updatedDisabled);
                setPickingField(null);
                delete ContextManager.instance.activeReferencePicker;
                if (appApi?.setSelectionMode) appApi.setSelectionMode('object');

                triggerUpdateEx({
                    customReferences: updatedRefs,
                    disabledReferences: updatedDisabled
                }, true);
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

    const renderRefSlot = (sideKey: string, defaultName: string) => {
        const isCustom = !!customRefs[sideKey];
        const isDisabled = !!disabledRefsState[sideKey];
        const isPicking = pickingField === sideKey;
        const prov = !isCustom && !isDisabled ? getDefaultReferenceProvenance(container, sideKey) : null;

        let labelText = isCustom ? customRefs[sideKey].partKey : (prov ? prov.partKey : defaultName);
        if (isPicking) labelText = 'Wskaż w 3D...';
        else if (isDisabled) labelText = 'Brak (wskaż w 3D)';

        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                background: '#16191f',
                padding: '8px 10px',
                borderRadius: '6px',
                border: isPicking ? '1px solid #eab308' : (isDisabled ? '1px dashed #71717a' : '1px solid #272a30')
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                        {defaultName}
                    </span>
                    {isCustom && <span style={{ fontSize: '9px', color: '#60a5fa', fontStyle: 'italic' }}>custom</span>}
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                        onClick={() => startPicking(sideKey)}
                        style={{
                            flex: 1,
                            padding: '4px 8px',
                            background: isPicking ? '#eab308' : (isDisabled ? '#1f242d' : '#222730'),
                            border: '1px solid #3b4252',
                            color: isPicking ? '#000' : (isDisabled ? '#facc15' : '#fff'),
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: isPicking ? 700 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {labelText}
                    </button>
                    <button
                        onClick={() => handleClearOrRestoreRef(sideKey)}
                        title={isDisabled ? 'Przywróć domyślną referencję' : 'Wyłącz referencję'}
                        style={{
                            padding: '4px 8px',
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
                            {container.name || 'SmartBox'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                            Wnęka: {widthMm.toFixed(0)} × {heightMm.toFixed(0)} × {depthMm.toFixed(0)} mm
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {onNewSmartBox && (
                        <button
                            onClick={onNewSmartBox}
                            title="Wstaw kolejny SmartBox do wnęki"
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
                            Referencje
                        </button>
                    </div>

                    {/* Treść Zakładki: Parametry Modułu */}
                    {activeTab === 'module' && (
                        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Lista wyboru typu SmartBoxa (do podmiany) */}
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
                                        const mapping = MODULE_TYPES[val] || MODULE_TYPES['SHELVES'];
                                        triggerUpdateEx({
                                            boxType: val,
                                            type: mapping.type
                                        }, true);
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
                                    {Object.entries(MODULE_TYPES).map(([k, opt]) => (
                                        <option key={k} value={k}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {boxType !== 'EMPTY' && (
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.5px' }}>
                                        {MODULE_TYPES[boxType]?.label.toUpperCase() || 'MODUŁ'}
                                    </div>
                                )}
                                {boxType === 'SHELVES' && <ShelvesSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'DOORS' && <DoorsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'DRAWERS' && <DrawersSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'FLAPS' && <FlapsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'TUBES' && <TubesSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'SHELF' && <ShelfSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'DIVIDERS' && <DividersSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                                {boxType === 'PANELS' && <PanelsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
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

                            {/* Ograniczenie wysokości H */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 10px',
                                background: (disabledRefsState.zMin || disabledRefsState.zMax) ? '#382510' : '#14161a',
                                border: '1px solid ' + ((disabledRefsState.zMin || disabledRefsState.zMax) ? '#f59e0b' : '#282c35'),
                                borderRadius: '6px'
                            }}>
                                <span style={{
                                    color: (disabledRefsState.zMin || disabledRefsState.zMax) ? '#fbbf24' : '#cbd5e1',
                                    fontSize: '12px',
                                    fontWeight: (disabledRefsState.zMin || disabledRefsState.zMax) ? 700 : 400
                                }}>
                                    {disabledRefsState.zMin && !disabledRefsState.zMax ? 'Wysokość H (od góry):' : (!disabledRefsState.zMin && disabledRefsState.zMax ? 'Wysokość H (od dołu):' : 'Wysokość H:')}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <input
                                        type="number"
                                        value={maxHeight}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            setMaxHeight(raw);
                                            if (raw !== '-' && raw !== '' && !isNaN(Number(raw))) {
                                                triggerUpdateEx({ maxHeight: parseFloat(raw) });
                                            }
                                        }}
                                        onBlur={() => {
                                            const val = parseFloat(String(maxHeight)) || 0;
                                            setMaxHeight(val);
                                            triggerUpdateEx({ maxHeight: val });
                                        }}
                                        style={{
                                            width: '80px',
                                            padding: '4px 6px',
                                            background: '#121418',
                                            border: '1px solid #3b82f6',
                                            color: '#fff',
                                            borderRadius: '4px',
                                            textAlign: 'right',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <span style={{ color: '#8c93a0', fontSize: '11px' }}>mm</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Stopka Okna ─── */}
                    <div style={{
                        padding: '10px 14px',
                        borderTop: '1px solid #282c35',
                        background: '#121418',
                        display: 'flex',
                        justifyContent: onNewSmartBox ? 'space-between' : 'flex-end',
                        alignItems: 'center'
                    }}>
                        {onNewSmartBox && (
                            <button
                                onClick={onNewSmartBox}
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
