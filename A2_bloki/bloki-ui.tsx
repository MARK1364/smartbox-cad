import type { BlokiGeneratorParamsPatch, BlokiModuleId, BlokiModuleTypeById } from './bloki-module-types.js';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    update_bloki_core,
    validateReferenceFaceOrientation,
    resolveManualReferenceFace,
    canonicalizeRefFaceName,
} from './bloki-core.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { highlightBayInScene, clearBayHighlight } from './bloki-bay-visualizer.js';
import {
    highlightBlokiRefSide,
    clearBlokiRefPlaneHint,
    type BlokiRefSideKey,
} from './bloki-ref-plane-hint.js';
import { RemoveNodeCommand } from '../A1_core/commands/remove-node-command.js';
import { TooltipManager } from '../A1_core/tooltip-manager.js';
import { SmartModuleRegistry } from './core/smart-module-registry.js';
import { ContainerModel } from '../A1_core/container-model.js';

interface Props {
    projectModel: any;
}

function boxTypeFromParams(p: any): string {
    if (p?.boxType) return p.boxType;
    const typeToBox: Record<string, string> = {
        blok_doors: 'DOORS',
        blok_corner_doors: 'CORNER_DOORS',
        blok_shelf: 'SHELF',
        blok_tubes: 'TUBES',
        blok_drawers: 'DRAWERS',
        blok_dividers: 'DIVIDERS',
        blok_panels: 'PANELS',
        blok_flaps: 'FLAPS',
        blok_empty: 'EMPTY',
        blok_shelves: 'SHELVES',
        blok_led_external: 'LED_EXTERNAL',
        blok_led_internal: 'LED_INTERNAL'
    };
    return typeToBox[p?.type] || 'SHELVES';
}

// ─── GŁÓWNY KOMPONENT: BlokiUI ────────────────────────────────────────────

export function BlokiUI({ projectModel }: Props) {
    const [container, setContainer] = useState<ContainerModel | null>(null);
    const [boxType, setBoxType] = useState<string>('EMPTY');
    const [customRefs, setCustomRefs] = useState<any>({});
    const [offsets, setOffsets] = useState<any>({});
    const [maxHeight, setMaxHeight] = useState<string | number>(0);
    const [pickingField, setPickingField] = useState<string | null>(null);
    const [disabledRefsState, setDisabledRefsState] = useState<any>({});
    const [isRefsOpen, setIsRefsOpen] = useState<boolean>(false);
    const [isPickerActive, setIsPickerActive] = useState<boolean>(false);
    const [pickerMode, setPickerMode] = useState<'internal' | 'external'>('internal');
    const [pendingPickType, setPendingPickType] = useState<string | null>(null);
    const [uiMode, setUiMode] = useState<'internal' | 'external'>('internal');

    useEffect(() => {
        const ctrl = ContextManager.instance.blokiBayController;
        const syncPicker = (active?: boolean, mode?: any) => {
            const isAct = active !== undefined ? active : !!ctrl?.isPickerActive;
            setIsPickerActive(isAct);
            setPickerMode(mode !== undefined ? mode : (ctrl?.pickerMode || 'internal'));
            if (!isAct) {
                setPendingPickType(null);
            } else if (ctrl?.pendingBlokType) {
                setPendingPickType(ctrl.pendingBlokType);
            }
        };
        let unsub: (() => void) | undefined;
        if (ctrl) unsub = ctrl.subscribePicker(syncPicker);
        const onCustom = (e: any) => {
            const detail = e.detail;
            if (typeof detail === 'object' && detail !== null) {
                syncPicker(detail.isActive, detail.mode);
            } else {
                syncPicker(!!detail);
            }
        };
        window.addEventListener('bloki-bay-picker-state', onCustom);
        syncPicker();
        return () => {
            if (unsub) unsub();
            window.removeEventListener('bloki-bay-picker-state', onCustom);
        };
    }, []);

    useEffect(() => {
        if (!container) return;
        const hintsByBoxType: Record<string, { title: string; desc: string }> = {
            SHELVES: { title: 'Półki', desc: 'Przeciągnij na wnękę w korpusie.' },
            DOORS: { title: 'Drzwi', desc: 'Przeciągnij na wnękę w korpusie.' },
            CORNER_DOORS: { title: 'Drzwi narożne', desc: 'L 90° — szer.×głęb. = dwa otwory.' },
            DRAWERS: { title: 'Szuflady', desc: 'Przeciągnij na wnękę w korpusie.' },
            DIVIDERS: { title: 'Przegrody', desc: 'Przeciągnij na wnękę w korpusie.' },
            TUBES: { title: 'Drążek', desc: 'Przeciągnij na wnękę w korpusie.' },
            FLAPS: { title: 'Klapa', desc: 'Przeciągnij na wnękę w korpusie.' },
            PANELS: { title: 'Blendy', desc: 'Przeciągnij i upuść na zewnątrz korpusu.' },
            EMPTY: { title: 'Blok', desc: 'Wybierz moduł lub przeciągnij na korpus.' },
        };
        const hint = hintsByBoxType[boxType];
        if (hint) {
            TooltipManager.instance.setActiveHint({
                id: `blok_active_${boxType}`,
                title: hint.title,
                description: hint.desc,
                category: 'bloki'
            });
        }
        return () => {
            TooltipManager.instance.clearActiveHint();
        };
    }, [boxType, container]);

    useEffect(() => {
        const doc = projectModel?.document || projectModel;

        const sync = () => {
            if (!doc) {
                setContainer(null);
                return;
            }

            if (ContextManager.instance.activeReferencePicker && container) {
                const p = container.generatorParams || {};
                setBoxType(boxTypeFromParams(p));
                setCustomRefs(p.customReferences || {});
                setDisabledRefsState(p.disabledReferences || {});
                setOffsets(p.offsets || {});
                setMaxHeight(p.maxHeight || 0);
                return;
            }

            let active = doc.activeEntity;

            if (active && active.type !== 'container') {
                const node = doc.findNode(active.id);
                if (node && node.parent && node.parent.domainData?.type === 'container') {
                    const parentBox = node.parent.domainData;
                    if (parentBox && (parentBox.generatorParams?.type?.startsWith('blok_') || parentBox.generatorParams?.boxType)) {
                        active = parentBox;
                    }
                }
            }

            if (active && active.type === 'container' && (active.generatorParams?.type?.startsWith('blok_') || active.generatorParams?.boxType)) {
                setContainer(active);
                const p = active.generatorParams;
                const bType = boxTypeFromParams(p);
                setBoxType(bType);
                setCustomRefs(p.customReferences || {});
                setDisabledRefsState(p.disabledReferences || {});
                setOffsets(p.offsets || {});
                setMaxHeight(p.maxHeight || 0);

                if (bType === 'CORNER_DOORS') {
                    setIsRefsOpen(true);
                }

                if (p.side_references_bloki === 'OUTER' || bType === 'PANELS') {
                    setUiMode('external');
                } else if (bType !== 'EMPTY') {
                    setUiMode('internal');
                }

                const scene = ContextManager.instance.viewport?.scene;
                if (bType === 'EMPTY' && p.detectedBay && scene) {
                    highlightBayInScene(scene, p.detectedBay);
                } else if (bType !== 'EMPTY') {
                    clearBayHighlight(scene);
                }
            } else {
                setContainer(null);
                clearBayHighlight();
            }
        };

        ContextManager.instance.document = doc;
        const unsub = doc?.onDocumentChanged ? doc.onDocumentChanged(sync) : (doc?.onChange ? doc.onChange(sync) : null);
        sync();

        return () => {
            if (typeof unsub === 'function') unsub();
            else if (doc?.offChange) doc.offChange(sync);
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            delete ContextManager.instance.activeReferencePicker;
            clearBayHighlight();
            clearBlokiRefPlaneHint();
        };
    }, [projectModel]);

    const pendingParamsRef = useRef<Record<string, unknown>>({});
    const rafIdRef = useRef<number | null>(null);

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

        update_bloki_core(container, projectModel);
        
        if (typeof projectModel._notify === 'function') {
            projectModel._notify();
        } else if (ContextManager.instance.document && typeof (ContextManager.instance.document as any)._notify === 'function') {
            (ContextManager.instance.document as any)._notify();
        }

        document.dispatchEvent(new CustomEvent('bloki-project-changed'));
    }, [container, projectModel]);

    const triggerUpdateEx = useCallback((updatedParams: BlokiGeneratorParamsPatch, immediate: boolean = false) => {
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

    const handleSelectModule = useCallback((val: string) => {
        setBoxType(val);
        if (val === 'CORNER_DOORS') {
            setIsRefsOpen(true);
        }
        const scene = ContextManager.instance.viewport?.scene;
        if (val !== 'EMPTY') {
            clearBayHighlight(scene);
        } else if (container?.generatorParams?.detectedBay && scene) {
            highlightBayInScene(scene, container.generatorParams.detectedBay);
        }
        const typeMap: Record<'EMPTY' | BlokiModuleId, 'blok_empty' | BlokiModuleTypeById[BlokiModuleId]> = {
            'EMPTY': 'blok_empty',
            'SHELVES': 'blok_shelves',
            'DOORS': 'blok_doors',
            'CORNER_DOORS': 'blok_corner_doors',
            'SHELF': 'blok_shelf',
            'DRAWERS': 'blok_drawers',
            'DIVIDERS': 'blok_dividers',
            'FLAPS': 'blok_flaps',
            'TUBES': 'blok_tubes',
            'PANELS': 'blok_panels',
            'LED_EXTERNAL': 'blok_led_external',
            'LED_INTERNAL': 'blok_led_internal'
        };
        const selected = val in typeMap ? val as keyof typeof typeMap : 'EMPTY';
        triggerUpdateEx({ 
            boxType: selected,
            type: typeMap[selected],
            ...(selected === 'PANELS' ? { targetZone: 'FULL' } : {}),
            ...(selected === 'DOORS' ? { rodzaj_drzwi: 'LEFT' } : {})
        } as BlokiGeneratorParamsPatch, true);
    }, [container, triggerUpdateEx]);

    const handleDeleteEmptyBloki = useCallback(() => {
        if (!container) return;
        const doc = projectModel?.document || projectModel || ContextManager.instance.document;
        if (doc) {
            clearBayHighlight();
            const cadNode = doc.findNode(container.id);
            if (cadNode) {
                try {
                    const cmdHist = ContextManager.instance.commandHistory;
                    if (cmdHist && cadNode.parent) {
                        cmdHist.execute(new RemoveNodeCommand(doc, cadNode.id, 'Usunięcie pustego Bloku'));
                    } else {
                        doc.removeNode(cadNode.id);
                    }
                } catch {
                    doc.removeNode(cadNode.id);
                }
                doc.setActiveEntity(null);
                setContainer(null);
                if (typeof window !== 'undefined') {
                    window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
                }
            }
        }
    }, [container, projectModel]);

    const startPicking = (sideKey: string) => {
        const isCustom = !!customRefs[sideKey];
        const isDisabled = !!disabledRefsState[sideKey];
        const appApi = ContextManager.instance.appAPI;
        const picker = ContextManager.instance.facePicker;

        const sideLabels: any = {
            xMin: 'Bok Lewy', xMax: 'Bok Prawy',
            yMin: 'Przód', yMax: 'Tył',
            zMin: 'Dół', zMax: 'Góra'
        };

        // Jeśli kliknięto w trakcie aktywnego wskazywania — anuluj tryb wyboru
        if (pickingField === sideKey) {
            setPickingField(null);
            delete ContextManager.instance.activeReferencePicker;
            if (picker) picker.clearSelection();
            if (appApi?.setSelectionMode) appApi.setSelectionMode('object');
            if (appApi?.setStatus) appApi.setStatus("Gotowy", false);
            return;
        }

        // Jeśli referencja jest przypisana — wymaga najpierw skasowania [✕]
        if (isCustom && !isDisabled) {
            showRefSideHint(sideKey as BlokiRefSideKey);
            if (appApi?.setStatus) {
                appApi.setStatus(`Referencja [${sideLabels[sideKey] || sideKey}] jest przypisana. Aby wybrać inną, najpierw skasuj ją przyciskiem [✕].`, true);
            }
            return;
        }

        // Tutaj isDisabled === true -> użytkownik skasował referencję i teraz klika, aby wskazać nową w 3D:
        if (picker) {
            if (typeof picker.resetAllFaceHighlights === 'function') picker.resetAllFaceHighlights();
            else picker.clearSelection();
        }

        setPickingField(sideKey);

        if (appApi?.setSelectionMode) {
            appApi.setSelectionMode('subgeometry');
        }

        if (appApi?.setStatus) {
            appApi.setStatus(`Wskaż ścianę w oknie 3D dla referencji: ${sideLabels[sideKey]}...`, true);
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
                        (n.domainData as any)?.key === refData.partKey
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
                        refData.uv
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
                        { manualPick: true }
                    );
                    if (!validation.valid) {
                        const appApi = ContextManager.instance.appAPI;
                        if (appApi?.setStatus) {
                            appApi.setStatus(`⛔ ${validation.errorMsg}`, true);
                        }
                        const p = ContextManager.instance.facePicker;
                        if (p) {
                            if (typeof p.resetAllFaceHighlights === 'function') p.resetAllFaceHighlights();
                            else p.clearSelection();
                        }
                        return; // Odrzucenie wyboru i oczekiwanie na poprawną ścianę
                    }
                }

                // Sukces:
                delete ContextManager.instance.activeReferencePicker;
                const p = ContextManager.instance.facePicker;
                if (p) {
                    if (typeof p.resetAllFaceHighlights === 'function') p.resetAllFaceHighlights();
                    else p.clearSelection();
                }

                const updatedRefs = {
                    ...(container.generatorParams.customReferences || {}),
                    [sideKey]: {
                        partKey,
                        face: resolvedFace.face,
                        panelId: panelId || targetNode?.id,
                    }
                };
                const disabledRefs = {
                    ...(container.generatorParams.disabledReferences || {})
                };
                delete disabledRefs[sideKey];

                setCustomRefs(updatedRefs);
                setDisabledRefsState(disabledRefs);

                triggerUpdateEx({ 
                    customReferences: updatedRefs,
                    disabledReferences: disabledRefs
                });
                setPickingField(null);
                if (appApi?.setSelectionMode) appApi.setSelectionMode('object');
                if (appApi?.setStatus) {
                    const mappedHint = resolvedFace.mapped ? ' (lico wewn.)' : '';
                    appApi.setStatus(`Przypisano referencję ${sideLabels[sideKey]} -> ${partKey}${mappedHint}`, false);
                }
            }
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
        });

        if (appApi?.setStatus) {
            const sideLabels: any = {
                xMin: 'Bok Lewy', xMax: 'Bok Prawy',
                yMin: 'Przód', yMax: 'Tył',
                zMin: 'Dół', zMax: 'Góra'
            };
            if (willBeDisabled) {
                appApi.setStatus(`Skasowano referencję [${sideLabels[sideKey]}]. Kliknij w pusty przycisk, aby wskazać nową ścianę w 3D.`, true);
            } else {
                appApi.setStatus(`Przywrócono domyślną referencję [${sideLabels[sideKey]}].`, false);
            }
        }
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
        const isCornerDoors = boxType === 'CORNER_DOORS';

        let bg = '#27272a';
        let border = '1px solid #3f3f46';
        let color = '#ffffff';
        let labelText = isCustom ? customRefs[sideKey].partKey : (isCornerDoors ? 'Wybierz sciane 3d' : '');

        if (isPicking) {
            bg = '#eab308';
            border = '1px solid #ca8a04';
            color = '#000000';
            labelText = '🎯 Wskaż w 3D...';
        } else if (isDisabled || (!isCustom && isCornerDoors)) {
            bg = '#18181b';
            border = '1px dashed #ca8a04';
            color = '#facc15';
            labelText = 'Wybierz sciane 3d';
        }

        return (
            <div
                style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: '#1c1c1f', padding: '4px 6px', borderRadius: '4px', border: '1px solid #27272a' }}
                onMouseEnter={() => {
                    if (!isPicking) showRefSideHint(sideKey);
                }}
                onMouseLeave={hideRefSideHint}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {defaultName}
                    </span>
                    {isCustom && <span style={{ fontSize: '9px', color: '#60a5fa', fontStyle: 'italic' }}>custom</span>}
                </div>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    <button 
                        id={`sb-ref-slot-${sideKey.toLowerCase()}`}
                        onClick={() => startPicking(sideKey)}
                        title={isPicking ? 'Wskaż ścianę w oknie 3D (kliknij, aby anulować)' : (isDisabled || (!isCustom && isCornerDoors)) ? `Kliknij, aby wybrać ścianę w oknie 3D dla: ${defaultName}` : `Referencja ${defaultName}: ${labelText}. (Aby wybrać inną, najpierw skasuj referencję przyciskiem [✕])`}
                        style={{ 
                            flex: 1, 
                            height: '22px',
                            padding: '1px 5px', 
                            background: bg, 
                            border: border, 
                            color: color, 
                            borderRadius: '3px', 
                            fontSize: '11px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '3px', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            fontWeight: isPicking || isCustom || isDisabled || (isCornerDoors && !isCustom) ? 'bold' : '500'
                        }}
                    >
                        {labelText}
                    </button>
                    <button 
                        id={`sb-ref-clear-${sideKey.toLowerCase()}`}
                        onClick={() => clearReference(sideKey)} 
                        title={isDisabled ? `Przywróć domyślną referencję ${defaultName}` : `Skasuj referencję ${defaultName}`}
                        style={{ 
                            height: '22px',
                            padding: '0 6px', 
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
                            opacity: isDisabled ? 0.8 : 1
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

    const renderModulePalette = () => {
        const activePlugins = SmartModuleRegistry.getActiveModules().filter(p => p.meta.category === uiMode);
        const modules = activePlugins.map(plugin => ({
            id: plugin.id,
            label: plugin.meta.label,
            desc: plugin.meta.description || '',
            icon: plugin.meta.renderIcon || ((c = 'currentColor') => (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
            ))
        }));

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                {/* Dwa główne przyciski wyboru trybu Bloki */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <button
                        type="button"
                        id="btnBlokiWewnatrz"
                        onClick={() => {
                            setUiMode('internal');
                            if (isPickerActive && pickerMode === 'external') {
                                ContextManager.instance.blokiBayController?.stopPicker();
                            }
                        }}
                        onMouseEnter={() => {
                            TooltipManager.instance.setActiveHint({
                                id: 'blok_mode_internal',
                                title: 'BLOKI WEWNĄTRZ',
                                description: 'Przełącz na moduły wewnętrzne (półki, drzwi, szuflady…).',
                                category: 'bloki'
                            });
                        }}
                        onMouseLeave={() => TooltipManager.instance.clearActiveHint()}
                        style={{
                            padding: '5px 6px',
                            background: uiMode === 'internal' ? '#1e40af' : '#27272a',
                            border: uiMode === 'internal' ? '2px solid #3b82f6' : '1px solid #3f3f46',
                            color: '#fff',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            boxShadow: uiMode === 'internal' ? '0 0 10px rgba(59, 130, 246, 0.35)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                        title="Przełącz na moduły wewnętrzne: półki, drzwi, szuflady, drążki, wieńce, przegrody, klapy"
                    >
                        <span style={{ fontSize: '13px' }}>📥</span>
                        <span>BLOKI WEWNĄTRZ</span>
                    </button>

                    <button
                        type="button"
                        id="btnBlokiNaZewnatrz"
                        onClick={() => {
                            setUiMode('external');
                            if (isPickerActive && pickerMode === 'internal') {
                                ContextManager.instance.blokiBayController?.stopPicker();
                            }
                        }}
                        onMouseEnter={() => {
                            TooltipManager.instance.setActiveHint({
                                id: 'blok_mode_external',
                                title: 'BLOKI NA ZEWNĄTRZ',
                                description: 'Przełącz na moduły zewnętrzne (blendy, obudowy).',
                                category: 'bloki'
                            });
                        }}
                        onMouseLeave={() => TooltipManager.instance.clearActiveHint()}
                        style={{
                            padding: '5px 6px',
                            background: uiMode === 'external' ? '#b45309' : '#27272a',
                            border: uiMode === 'external' ? '2px solid #f59e0b' : '1px solid #3f3f46',
                            color: '#fff',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            boxShadow: uiMode === 'external' ? '0 0 10px rgba(245, 158, 11, 0.35)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                        title="Przełącz na moduły zewnętrzne: blendy i obudowy korpusu"
                    >
                        <span style={{ fontSize: '13px' }}>📦</span>
                        <span>BLOKI NA ZEWNĄTRZ</span>
                    </button>
                </div>

                {/* Paleta małych przycisków Drag & Drop poszczególnych modułów */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: uiMode === 'internal' ? 'repeat(4, 1fr)' : '1fr',
                    gap: '4px',
                    background: '#18181b',
                    padding: '4px',
                    borderRadius: '6px',
                    border: '1px solid #27272a'
                }}>
                    {modules.map((mod) => {
                        const isCurrentActive = container && boxType === mod.id;
                        const isCurrentPicking = isPickerActive && pendingPickType === mod.id;

                        let cardBg = '#222226';
                        let cardBorder = '#333338';
                        if (isCurrentActive) {
                            cardBg = uiMode === 'internal' ? '#1e3a8a' : '#78350f';
                            cardBorder = uiMode === 'internal' ? '#60a5fa' : '#fbbf24';
                        } else if (isCurrentPicking) {
                            cardBg = '#14532d';
                            cardBorder = '#4ade80';
                        }

                        return (
                            <div
                                key={mod.id}
                                id={`cardBlokiMod_${mod.id}`}
                                data-id={`bloki-card-${mod.id.toLowerCase()}`}
                                draggable={true}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/bloki-template', JSON.stringify({ boxType: mod.id, category: uiMode }));
                                    const ctrl = ContextManager.instance.blokiBayController;
                                    if (ctrl) {
                                        ctrl.startDrag(mod.id, uiMode);
                                        ctrl.setPendingBlokType(mod.id);
                                    }
                                }}
                                onDragEnd={() => {
                                    ContextManager.instance.blokiBayController?.endDrag();
                                }}
                                onClick={() => {
                                    if (container) {
                                        handleSelectModule(mod.id);
                                    } else {
                                        const ctrl = ContextManager.instance.blokiBayController;
                                        if (ctrl) {
                                            ctrl.togglePicker(mod.id, uiMode);
                                            setPendingPickType(ctrl.isPickerActive ? mod.id : null);
                                        }
                                    }
                                }}
                                onMouseEnter={() => {
                                    const isExternal = uiMode === 'external' || mod.id === 'PANELS';
                                    const text = isExternal 
                                        ? 'Przeciągnij i upuść na zewnątrz korpusu.' 
                                        : 'Przeciągnij na wnękę w korpusie.';
                                    TooltipManager.instance.setActiveHint({
                                        id: `blok_mod_${mod.id}`,
                                        title: mod.label,
                                        description: text,
                                        category: 'bloki'
                                    });
                                }}
                                onMouseLeave={() => {
                                    TooltipManager.instance.clearActiveHint();
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px 2px 3px 2px',
                                    background: cardBg,
                                    border: `1px solid ${cardBorder}`,
                                    borderRadius: '5px',
                                    cursor: 'grab',
                                    userSelect: 'none',
                                    position: 'relative',
                                    transition: 'all 0.15s ease',
                                    boxShadow: isCurrentActive ? '0 0 8px rgba(59, 130, 246, 0.4)' : (isCurrentPicking ? '0 0 8px rgba(74, 222, 128, 0.4)' : 'none'),
                                    minHeight: '42px'
                                }}
                                title={`${mod.label}: ${mod.desc}\n• Przeciągnij i upuść na wnękę w 3D\n• Lub kliknij, aby ${container ? 'przełączyć ten Blok na ' + mod.label : 'wskazać wnękę w 3D'}`}
                            >
                                <div style={{ color: isCurrentActive ? '#fff' : (isCurrentPicking ? '#4ade80' : '#93c5fd'), marginBottom: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {mod.icon(isCurrentActive ? '#fff' : (isCurrentPicking ? '#4ade80' : '#93c5fd'))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', marginTop: '2px' }}>
                                    <span className="hand-icon" title="Chwyć i przeciągnij na scenę 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                        </svg>
                                    </span>
                                    <span style={{ fontSize: '10.5px', fontWeight: isCurrentActive ? 'bold' : 500, color: isCurrentActive ? '#fff' : 'var(--text-secondary, #aaa)', textAlign: 'center', lineHeight: 1.1 }}>
                                        {mod.label}
                                    </span>
                                </div>
                                {isCurrentActive && (
                                    <span style={{ fontSize: '8px', color: '#93c5fd', marginTop: '1px', fontWeight: 'bold' }}>
                                        ✓ Aktywny
                                    </span>
                                )}
                                {isCurrentPicking && !isCurrentActive && (
                                    <span style={{ fontSize: '8px', color: '#4ade80', marginTop: '1px', fontWeight: 'bold' }}>
                                        Wskaż 3D
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (!container) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: '#121214',
                color: '#fff',
                fontSize: '13px',
                width: '100%',
                padding: '6px 8px 32px 8px',
                boxSizing: 'border-box'
            }}>
                {renderModulePalette()}
            </div>
        );
    }

    const isExternalContainer = container?.generatorParams?.side_references_bloki === 'OUTER' || boxType === 'PANELS';

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: '#121214',
            color: '#fff',
            fontSize: '13px',
            width: '100%',
            padding: '6px 8px 32px 8px',
            boxSizing: 'border-box'
        }}>
            {renderModulePalette()}

            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '6px', overflow: 'hidden' }}>
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
                        userSelect: 'none'
                    }}
                >
                    <span>Ściany referencyjne</span>
                    <span style={{ fontSize: '12px', color: '#93c5fd' }}>
                        {isRefsOpen ? '▲' : '▼'}
                    </span>
                </div>

                {isRefsOpen && (
                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Referencje
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

                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            marginTop: '4px',
                            padding: '6px 8px',
                            background: (disabledRefsState.zMin || disabledRefsState.zMax) ? '#451a03' : '#18181b',
                            border: '1px solid ' + ((disabledRefsState.zMin || disabledRefsState.zMax) ? '#f59e0b' : '#27272a'),
                            borderRadius: '4px'
                        }}>
                            <span style={{ 
                                color: (disabledRefsState.zMin || disabledRefsState.zMax) ? '#fbbf24' : '#d4d4d8', 
                                fontSize: '12px',
                                fontWeight: (disabledRefsState.zMin || disabledRefsState.zMax) ? 'bold' : 'normal'
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
                                        width: '100px', 
                                        padding: '3px 6px', 
                                        background: '#27272a', 
                                        border: '1px solid ' + ((disabledRefsState.zMin || disabledRefsState.zMax) ? '#f59e0b' : '#3f3f46'), 
                                        color: '#fff', 
                                        borderRadius: '3px', 
                                        textAlign: 'right', 
                                        fontSize: '11px',
                                        fontWeight: (disabledRefsState.zMin || disabledRefsState.zMax) ? 'bold' : 'normal'
                                    }} 
                                />
                                <span style={{ color: '#a1a1aa', fontSize: '10px' }}>mm</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Sekcja konfiguracji aktywnego modułu */}
            <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#e4e4e7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>∨</span> {(() => {
                        if (boxType === 'EMPTY') return 'Wybór modułu';
                        const p = SmartModuleRegistry.get(boxType);
                        return p?.meta.label || boxType;
                    })()}
                </div>

                {boxType === 'EMPTY' && (
                    <div style={{ padding: '8px', background: '#222225', borderRadius: '6px', border: '1px dashed #3f3f46', display: 'flex', justifyContent: 'center' }}>
                        <button
                            type="button"
                            onClick={handleDeleteEmptyBloki}
                            style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#f87171',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.15s ease'
                            }}
                            title="Usuń ten pusty Blok z drzewa projektu"
                        >
                            <span>✕</span> Usuń ten pusty Blok
                        </button>
                    </div>
                )}
                {(() => {
                    if (boxType === 'EMPTY') return null;
                    const plugin = SmartModuleRegistry.get(boxType);
                    const isEnabled = SmartModuleRegistry.isModuleEnabled(boxType);
                    if (plugin && isEnabled) {
                        const SubComponent = plugin.UIComponent;
                        return <SubComponent container={container} triggerUpdate={triggerUpdateEx} />;
                    }
                    const currentParams = container?.generatorParams || {};
                    return (
                        <div style={{ padding: '10px', background: '#222225', borderRadius: '6px', border: '1px dashed #eab308', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#fde047' }}>
                                ⚠️ Moduł <strong>{boxType}</strong> jest niedostępny lub wyłączony w tym wariancie (Read-Only).
                            </div>
                            <div style={{ fontSize: '10px', color: '#a1a1aa', background: '#18181b', padding: '6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                {Object.keys(currentParams).length > 0 ? (
                                    Object.entries(currentParams).map(([k, v]) => (
                                        <div key={k}>{k}: {String(v)}</div>
                                    ))
                                ) : (
                                    <div>Brak zapisanych parametrów kontenera.</div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
