/**
 * Wspólna sekcja „Ściany referencyjne” (jak w BlokiUI).
 * Używana przez Bloki / zawieszki / AGD — ten sam schemat customReferences + offsets.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import {
    validateReferenceFaceOrientation,
    resolveManualReferenceFace,
    canonicalizeRefFaceName,
} from './01_bloki-core.js';
import {
    highlightBlokiRefSide,
    clearBlokiRefPlaneHint,
    type BlokiRefSideKey,
} from './02_bloki-ref-plane-hint.js';
import { HEIGHT_H_LOCKED_HINT, isBlokiHeightHLocked } from './01_bloki-height-h.js';

export type BayRefsParamsPatch = {
    customReferences?: Record<string, any>;
    disabledReferences?: Record<string, any>;
    offsets?: Record<string, any>;
    maxHeight?: number;
};

export interface BayReferenceWallsPanelProps {
    container: any;
    /** Domyślnie otwarte (AGD / zawieszki). */
    defaultOpen?: boolean;
    /** Zapis patchy do generatorParams + rebuild domeny. */
    onParamsPatch: (patch: BayRefsParamsPatch) => void;
}

const SIDE_LABELS: Record<BlokiRefSideKey, string> = {
    xMin: 'Bok Lewy',
    xMax: 'Bok Prawy',
    yMin: 'Przód',
    yMax: 'Tył',
    zMin: 'Dół',
    zMax: 'Góra',
};

export function BayReferenceWallsPanel({
    container,
    defaultOpen = true,
    onParamsPatch,
}: BayReferenceWallsPanelProps): React.JSX.Element | null {
    const [isRefsOpen, setIsRefsOpen] = useState(defaultOpen);
    const [customRefs, setCustomRefs] = useState<any>({});
    const [disabledRefsState, setDisabledRefsState] = useState<any>({});
    const [offsets, setOffsets] = useState<any>({});
    const [maxHeight, setMaxHeight] = useState<string | number>(0);
    const [pickingField, setPickingField] = useState<string | null>(null);

    useEffect(() => {
        if (!container) return;
        const p = container.generatorParams || {};
        setCustomRefs(p.customReferences || {});
        setDisabledRefsState(p.disabledReferences || {});
        setOffsets(p.offsets || {});
        setMaxHeight(p.maxHeight || 0);
    }, [
        container?.id,
        container?.generatorParams?.customReferences,
        container?.generatorParams?.disabledReferences,
        container?.generatorParams?.offsets,
        container?.generatorParams?.maxHeight,
    ]);

    useEffect(() => {
        return () => {
            delete ContextManager.instance.activeReferencePicker;
            clearBlokiRefPlaneHint();
        };
    }, []);

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

    const startPicking = (sideKey: string) => {
        const isCustom = !!customRefs[sideKey];
        const isDisabled = !!disabledRefsState[sideKey];
        const appApi = ContextManager.instance.appAPI;
        const picker = ContextManager.instance.facePicker;

        if (pickingField === sideKey) {
            setPickingField(null);
            delete ContextManager.instance.activeReferencePicker;
            if (picker) {
                picker.selectionMode = 'object';
                picker.targetSubgeometryType = null;
                picker.clearSelection();
            }
            if (appApi?.setSelectionMode) appApi.setSelectionMode('object');
            if (appApi?.setStatus) appApi.setStatus('Gotowy', false);
            return;
        }

        if (isCustom && !isDisabled) {
            showRefSideHint(sideKey as BlokiRefSideKey);
            if (appApi?.setStatus) {
                appApi.setStatus(
                    `Odniesienie [${SIDE_LABELS[sideKey as BlokiRefSideKey] || sideKey}] jest przypisane. Aby wybrać inne, najpierw skasuj je przyciskiem [✕].`,
                    true,
                );
            }
            return;
        }

        if (picker) {
            picker.selectionMode = 'subgeometry';
            picker.targetSubgeometryType = 'face';
            if (typeof picker.resetAllFaceHighlights === 'function') picker.resetAllFaceHighlights();
            else picker.clearSelection();
        }

        setPickingField(sideKey);
        if (appApi?.setSelectionMode) appApi.setSelectionMode('subgeometry');
        if (appApi?.setStatus) {
            appApi.setStatus(`Wskaż ścianę w oknie 3D dla odniesienia: ${SIDE_LABELS[sideKey as BlokiRefSideKey]}...`, true);
        }

        ContextManager.instance.activeReferencePicker = {
            targetContainerId: container?.id,
            sideKey,
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
                const cabinetId = container?.generatorParams?.parentContainerId || '';
                const cabinetNode = doc?.findNode(cabinetId) || (doc?.getContainers ? doc.getContainers()[0] : null);

                const panelId = refData.panelId || refData.nodeId || refData.panelModel?.id;
                const allPanels = typeof (doc as any)?.getPanels === 'function' ? (doc as any).getPanels() : [];
                const targetNode =
                    (panelId ? doc?.findNode(panelId) : null) ||
                    doc?.findNode(refData.partKey) ||
                    allPanels.find((n: any) =>
                        n.id === panelId ||
                        n.id === refData.partKey ||
                        n.domainData?.name === refData.partKey ||
                        n.domainData?.id === refData.partKey ||
                        (n.domainData as any)?.key === refData.partKey,
                    );
                const targetPanel = refData.panelModel || targetNode?.domainData || null;
                const partKey =
                    targetNode?.name ||
                    (targetPanel as any)?.key ||
                    targetPanel?.name ||
                    refData.partKey;

                const resolvedFace = targetPanel && targetNode && cabinetNode
                    ? resolveManualReferenceFace(
                        targetPanel,
                        targetNode,
                        cabinetNode,
                        refData.face,
                        sideKey,
                        refData.worldNormal,
                        refData.uv,
                    )
                    : { face: canonicalizeRefFaceName(refData.face), mapped: false };

                if (targetPanel && targetNode && cabinetNode) {
                    const validation = validateReferenceFaceOrientation(
                        targetPanel,
                        targetNode,
                        cabinetNode,
                        resolvedFace.face,
                        sideKey,
                        container?.generatorParams?.customReferences,
                        { manualPick: true },
                    );
                    if (!validation.valid) {
                        if (appApi?.setStatus) appApi.setStatus(`⛔ ${validation.errorMsg}`, true);
                        const p = ContextManager.instance.facePicker;
                        if (p) {
                            if (typeof p.resetAllFaceHighlights === 'function') p.resetAllFaceHighlights();
                            else p.clearSelection();
                        }
                        return;
                    }
                }

                delete ContextManager.instance.activeReferencePicker;
                const p = ContextManager.instance.facePicker;
                if (p) {
                    p.selectionMode = 'object';
                    p.targetSubgeometryType = null;
                    if (typeof p.resetAllFaceHighlights === 'function') p.resetAllFaceHighlights();
                    else p.clearSelection();
                }

                const updatedRefs = {
                    ...(container.generatorParams.customReferences || {}),
                    [sideKey]: {
                        partKey,
                        face: resolvedFace.face,
                        panelId: panelId || targetNode?.id,
                    },
                };
                const disabledRefs = { ...(container.generatorParams.disabledReferences || {}) };
                delete disabledRefs[sideKey];

                setCustomRefs(updatedRefs);
                setDisabledRefsState(disabledRefs);
                onParamsPatch({
                    customReferences: updatedRefs,
                    disabledReferences: disabledRefs,
                });
                setPickingField(null);
                if (appApi?.setSelectionMode) appApi.setSelectionMode('object');
                if (appApi?.setStatus) {
                    const mappedHint = resolvedFace.mapped ? ' (lico wewn.)' : '';
                    appApi.setStatus(
                        `Przypisano odniesienie ${SIDE_LABELS[sideKey as BlokiRefSideKey]} -> ${partKey}${mappedHint}`,
                        false,
                    );
                }
            },
        };
    };

    const clearReference = (sideKey: string) => {
        const appApi = ContextManager.instance.appAPI;
        const picker = ContextManager.instance.facePicker;
        if (picker) {
            if (typeof picker.resetAllFaceHighlights === 'function') picker.resetAllFaceHighlights();
            else picker.clearSelection();
        }

        if (pickingField === sideKey) {
            setPickingField(null);
            delete ContextManager.instance.activeReferencePicker;
            if (appApi?.setSelectionMode) appApi.setSelectionMode('object');
        }

        const updatedRefs = { ...(container?.generatorParams?.customReferences || {}) };
        delete updatedRefs[sideKey];

        const disabledRefs = { ...(container?.generatorParams?.disabledReferences || {}) };
        const willBeDisabled = !disabledRefs[sideKey];
        if (willBeDisabled) disabledRefs[sideKey] = true;
        else delete disabledRefs[sideKey];

        setCustomRefs(updatedRefs);
        setDisabledRefsState(disabledRefs);
        onParamsPatch({
            customReferences: updatedRefs,
            disabledReferences: disabledRefs,
        });

        if (appApi?.setStatus) {
            if (willBeDisabled) {
                appApi.setStatus(
                    `Skasowano odniesienie [${SIDE_LABELS[sideKey as BlokiRefSideKey]}]. Kliknij w pusty przycisk, aby wskazać nową ścianę w 3D.`,
                    true,
                );
            } else {
                appApi.setStatus(
                    `Przywrócono domyślne odniesienie [${SIDE_LABELS[sideKey as BlokiRefSideKey]}].`,
                    false,
                );
            }
        }
    };

    const handleOffsetChange = (sideKey: string, valStr: string) => {
        const updatedOffsets = { ...(offsets || {}), [sideKey]: valStr };
        setOffsets(updatedOffsets);
        if (valStr !== '-' && valStr !== '' && !isNaN(Number(valStr))) {
            onParamsPatch({
                offsets: {
                    ...(container?.generatorParams?.offsets || {}),
                    [sideKey]: parseFloat(valStr),
                },
            });
        }
    };

    const renderRefSlot = (sideKey: BlokiRefSideKey, defaultName: string) => {
        const isCustom = !!customRefs[sideKey];
        const isDisabled = !!disabledRefsState[sideKey];
        const isPicking = pickingField === sideKey;

        let bg = '#27272a';
        let border = '1px solid #3f3f46';
        let color = '#ffffff';
        // Pusty slot po skasowaniu / bez custom — bez żółtego „Wybierz ścianę”.
        let labelText = isCustom && !isDisabled ? customRefs[sideKey].partKey : '';

        if (isPicking) {
            bg = '#eab308';
            border = '1px solid #ca8a04';
            color = '#000000';
            labelText = '🎯 Wskaż ścianę…';
        } else if (isDisabled || !isCustom) {
            bg = '#18181b';
            border = '1px dashed #3f3f46';
            color = '#71717a';
            labelText = '';
        }

        return (
            <div
                style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: '#1c1c1f', padding: '4px 6px', borderRadius: '4px', border: '1px solid #27272a', minWidth: 0, overflow: 'hidden' }}
                onMouseEnter={() => { if (!isPicking) showRefSideHint(sideKey); }}
                onMouseLeave={hideRefSideHint}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {defaultName}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center', minWidth: 0, width: '100%' }}>
                    <button
                        type="button"
                        id={`sb-ref-slot-${sideKey.toLowerCase()}`}
                        onClick={() => startPicking(sideKey)}
                        title={isPicking
                            ? 'Wskaż ścianę w oknie 3D (kliknij, aby anulować)'
                            : (isDisabled || !isCustom)
                                ? `Kliknij, aby wskazać ścianę w 3D: ${defaultName}`
                                : `Odniesienie ${defaultName}: ${labelText}. (Aby wybrać inne, najpierw skasuj odniesienie przyciskiem [✕])`}
                        style={{
                            flex: '1 1 0',
                            minWidth: 0,
                            width: 0,
                            height: '22px',
                            padding: '1px 5px',
                            background: bg,
                            border,
                            color,
                            borderRadius: '3px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textAlign: 'left',
                            fontWeight: isPicking || (isCustom && !isDisabled) ? 'bold' : '500',
                        }}
                    >
                        {labelText || '\u00A0'}
                    </button>
                    <button
                        type="button"
                        id={`sb-ref-clear-${sideKey.toLowerCase()}`}
                        onClick={() => clearReference(sideKey)}
                        title={isDisabled ? `Przywróć domyślne odniesienie ${defaultName}` : `Skasuj odniesienie ${defaultName}`}
                        style={{
                            flex: '0 0 auto',
                            width: '24px',
                            height: '22px',
                            padding: 0,
                            background: isDisabled ? '#27272a' : '#ef4444',
                            border: '1px solid ' + (isDisabled ? '#3f3f46' : '#dc2626'),
                            color: isDisabled ? '#a1a1aa' : '#ffffff',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isDisabled ? 0.8 : 1,
                        }}
                    >
                        {isDisabled ? '↺' : '✕'}
                    </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1px' }}>
                    <span style={{ color: '#71717a', fontSize: '10px' }}>Offset:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <input
                            type="number"
                            value={offsets[sideKey] !== undefined ? offsets[sideKey] : 0}
                            onChange={(e) => handleOffsetChange(sideKey, e.target.value)}
                            onBlur={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                handleOffsetChange(sideKey, String(v));
                            }}
                            style={{ width: '48px', height: '18px', padding: '1px 3px', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '2px', textAlign: 'right', fontSize: '10px' }}
                        />
                        <span style={{ color: '#71717a', fontSize: '9px' }}>mm</span>
                    </div>
                </div>
            </div>
        );
    };

    if (!container) return null;

    return (
        <div
            className={`ref-walls-accordion ${isRefsOpen ? 'is-open' : ''}`}
            style={{
                borderRadius: '6px',
                overflow: 'hidden',
                ...(isRefsOpen ? { borderColor: 'rgba(59, 130, 246, 0.55)', boxShadow: '0 0 10px rgba(59, 130, 246, 0.15)' } : {}),
            }}
        >
            <div
                id="sb-accordion-refs"
                onClick={() => setIsRefsOpen(!isRefsOpen)}
                style={{
                    background: '#3b82f6',
                    padding: '8px 10px',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    userSelect: 'none',
                }}
            >
                <span>Ściany odniesienia</span>
                <span style={{ fontSize: '12px', color: '#93c5fd' }}>
                    {isRefsOpen ? '▲' : '▼'}
                </span>
            </div>

            {isRefsOpen && (
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Odniesienia
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                        {renderRefSlot('xMin', 'Bok Lewy')}
                        {renderRefSlot('xMax', 'Bok Prawy')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                        {renderRefSlot('yMin', 'Przód')}
                        {renderRefSlot('yMax', 'Tył')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                        {renderRefSlot('zMin', 'Dół')}
                        {renderRefSlot('zMax', 'Góra')}
                    </div>

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
                                    marginTop: '4px',
                                    padding: '6px 8px',
                                    background: hLocked ? '#141416' : (hNeedsInput ? '#451a03' : '#18181b'),
                                    border: '1px solid ' + (hLocked ? '#27272a' : (hNeedsInput ? '#f59e0b' : '#27272a')),
                                    borderRadius: '4px',
                                    opacity: hLocked ? 0.55 : 1,
                                    cursor: hLocked ? 'not-allowed' : undefined,
                                }}
                            >
                                <span style={{
                                    color: hLocked ? '#71717a' : (hNeedsInput ? '#fbbf24' : '#d4d4d8'),
                                    fontSize: '12px',
                                    fontWeight: hNeedsInput ? 'bold' : 'normal',
                                }}>
                                    {disabledRefsState.zMin && !disabledRefsState.zMax
                                        ? 'Wysokość H (od góry):'
                                        : (!disabledRefsState.zMin && disabledRefsState.zMax
                                            ? 'Wysokość H (od dołu):'
                                            : 'Wysokość H:')}
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
                                                onParamsPatch({ maxHeight: parseFloat(raw) });
                                            }
                                        }}
                                        onBlur={() => {
                                            if (hLocked) return;
                                            const val = parseFloat(String(maxHeight)) || 0;
                                            setMaxHeight(val);
                                            onParamsPatch({ maxHeight: val });
                                        }}
                                        onFocus={showHLockedHint}
                                        style={{
                                            width: '100px',
                                            padding: '3px 6px',
                                            background: hLocked ? '#18181b' : '#27272a',
                                            border: '1px solid ' + (hLocked ? '#3f3f46' : (hNeedsInput ? '#f59e0b' : '#3f3f46')),
                                            color: hLocked ? '#71717a' : '#fff',
                                            borderRadius: '3px',
                                            textAlign: 'right',
                                            fontSize: '11px',
                                            fontWeight: hNeedsInput ? 'bold' : 'normal',
                                            cursor: hLocked ? 'not-allowed' : undefined,
                                        }}
                                    />
                                    <span style={{ color: '#a1a1aa', fontSize: '10px' }}>mm</span>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
