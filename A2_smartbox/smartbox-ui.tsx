import React, { useState, useEffect, useCallback, useRef } from 'react';
import { update_smartbox_core, getDefaultReferenceProvenance, validateReferenceFaceOrientation } from './smartbox-core.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { normalizeFaceName } from '../A4_smartpanel/panel-model.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { ShelvesSubModule } from './shelves-adapter.js';
import { ShelfSubModule } from './shelf-adapter.js';
import { DoorsSubModule } from './doors-adapter.js';
import { TubesSubModule } from './tubes-adapter.js';
import { DrawersSubModule } from './drawers-adapter.js';
import { DividersSubModule } from './dividers-adapter.js';
import { PanelsSubModule } from './panels-adapter.js';
import { FlapsSubModule } from './flaps-adapter.js';

interface Props {
    projectModel: any;
}

function boxTypeFromParams(p: any): string {
    if (p?.boxType) return p.boxType;
    const typeToBox: Record<string, string> = {
        smartbox_doors: 'DOORS',
        smartbox_shelf: 'SHELF',
        smartbox_tubes: 'TUBES',
        smartbox_drawers: 'DRAWERS',
        smartbox_dividers: 'DIVIDERS',
        smartbox_panels: 'PANELS',
        smartbox_flaps: 'FLAPS',
        smartbox_empty: 'EMPTY',
        smartbox_shelves: 'SHELVES'
    };
    return typeToBox[p?.type] || 'SHELVES';
}

// ─── GŁÓWNY KOMPONENT: SmartBoxUI ────────────────────────────────────────────
export function SmartBoxUI({ projectModel }: Props) {
    const [container, setContainer] = useState<any>(null);
    const [boxType, setBoxType] = useState<string>('EMPTY');
    const [customRefs, setCustomRefs] = useState<any>({});
    const [offsets, setOffsets] = useState<any>({});
    const [maxHeight, setMaxHeight] = useState<string | number>(0);
    const [pickingField, setPickingField] = useState<string | null>(null);
    const [disabledRefsState, setDisabledRefsState] = useState<any>({});
    const [targetZone, setTargetZone] = useState<string>('FULL');
    const [isRefsOpen, setIsRefsOpen] = useState<boolean>(false);
    const [isPickerActive, setIsPickerActive] = useState<boolean>(false);

    useEffect(() => {
        const ctrl = ContextManager.instance.smartBoxBayController;
        const syncPicker = () => setIsPickerActive(!!ctrl?.isPickerActive);
        let unsub: (() => void) | undefined;
        if (ctrl) unsub = ctrl.subscribePicker(syncPicker);
        const onCustom = () => syncPicker();
        window.addEventListener('smartbox-bay-picker-state', onCustom);
        syncPicker();
        return () => {
            if (unsub) unsub();
            window.removeEventListener('smartbox-bay-picker-state', onCustom);
        };
    }, []);
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
                setTargetZone(p.targetZone || 'FULL');
                return;
            }

            let active = doc.activeEntity;

            if (active && active.type !== 'container') {
                const node = doc.findNode(active.id);
                if (node && node.parent && node.parent.domainData?.type === 'container') {
                    const parentBox = node.parent.domainData;
                    if (parentBox && (parentBox.generatorParams?.type?.startsWith('smartbox_') || parentBox.generatorParams?.boxType)) {
                        active = parentBox;
                    }
                }
            }

            if (active && active.type === 'container' && (active.generatorParams?.type?.startsWith('smartbox_') || active.generatorParams?.boxType)) {
                setContainer(active);
                const p = active.generatorParams;
                setBoxType(boxTypeFromParams(p));
                setCustomRefs(p.customReferences || {});
                setDisabledRefsState(p.disabledReferences || {});
                setOffsets(p.offsets || {});
                setMaxHeight(p.maxHeight || 0);
                setTargetZone(p.targetZone || 'FULL');
            } else {
                setContainer(null);
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
        };
    }, [projectModel]);

    const pendingParamsRef = useRef<any>({});
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

        update_smartbox_core(container, projectModel);
        
        if (typeof projectModel._notify === 'function') {
            projectModel._notify();
        } else if (ContextManager.instance.document && typeof (ContextManager.instance.document as any)._notify === 'function') {
            (ContextManager.instance.document as any)._notify();
        }

        document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
    }, [container, projectModel]);

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

    const startPicking = (sideKey: string) => {
        const isDisabled = !!disabledRefsState[sideKey];
        const isCustom = !!customRefs[sideKey];
        const prov = !isCustom && !isDisabled ? getDefaultReferenceProvenance(container, sideKey) : null;
        const hasAssigned = isCustom || (prov && !isDisabled);

        const appApi = ContextManager.instance.appAPI;
        const picker = ContextManager.instance.facePicker;

        // Jeśli referencja jest aktualnie przypisana i nie jest pusta/skasowana, wymagamy najpierw skasowania [✕]
        if (hasAssigned && !isDisabled) {
            if (appApi?.setStatus) {
                const sideLabels: any = {
                    xMin: 'Bok Lewy', xMax: 'Bok Prawy',
                    yMin: 'Przód', yMax: 'Tył',
                    zMin: 'Dół', zMax: 'Góra'
                };
                appApi.setStatus(`Referencja [${sideLabels[sideKey]}] jest przypisana. Aby wybrać inną, najpierw kliknij [✕] aby ją skasować.`, true);
            }
            return;
        }

        if (picker) {
            if (typeof picker.resetAllFaceHighlights === 'function') picker.resetAllFaceHighlights();
            else picker.clearSelection();
        }

        if (pickingField === sideKey) {
            setPickingField(null);
            delete ContextManager.instance.activeReferencePicker;
            if (picker) picker.clearSelection();
            if (appApi?.setSelectionMode) appApi.setSelectionMode('object');
            if (appApi?.setStatus) appApi.setStatus("Gotowy", false);
            return;
        }

        setPickingField(sideKey);

        if (appApi?.setSelectionMode) {
            appApi.setSelectionMode('subgeometry');
        }

        const sideLabels: any = {
            xMin: 'Bok Lewy', xMax: 'Bok Prawy',
            yMin: 'Przód', yMax: 'Tył',
            zMin: 'Dół', zMax: 'Góra'
        };

        if (appApi?.setStatus) {
            appApi.setStatus(`Wskaż ścianę w oknie 3D dla referencji: ${sideLabels[sideKey]}...`, true);
        }

        ContextManager.instance.activeReferencePicker = {
            targetContainerId: container?.id,
            sideKey,
            onSelect: (refData: { partKey: string, face: string, panelModel?: any }) => {
                const doc = ContextManager.instance.document;
                const cabinetId = container?.generatorParams?.parentContainerId || '';
                const cabinetNode = doc?.findNode(cabinetId) || (doc?.getContainers ? doc.getContainers()[0] : null);

                const allPanels = typeof (doc as any)?.getPanels === 'function' ? (doc as any).getPanels() : [];
                const targetNode = doc?.findNode(refData.partKey) || allPanels.find((n: any) => n.id === refData.partKey || n.domainData?.name === refData.partKey || n.domainData?.id === refData.partKey || (n.domainData as any)?.key === refData.partKey);
                const targetPanel = refData.panelModel || targetNode?.domainData || null;

                if (targetPanel && targetNode && cabinetNode) {
                    const validation = validateReferenceFaceOrientation(
                        targetPanel,
                        targetNode,
                        cabinetNode,
                        refData.face,
                        sideKey
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
                    [sideKey]: { partKey: refData.partKey, face: refData.face }
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
                    appApi.setStatus(`Przypisano referencję ${sideLabels[sideKey]} -> ${refData.partKey}`, false);
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

    const renderRefSlot = (sideKey: string, defaultName: string) => {
        const isCustom = !!customRefs[sideKey];
        const isDisabled = !!disabledRefsState[sideKey];
        const isPicking = pickingField === sideKey;
        const prov = !isCustom && !isDisabled ? getDefaultReferenceProvenance(container, sideKey) : null;

        let bg = '#27272a';
        let border = '1px solid #3f3f46';
        let color = '#ffffff';
        let labelText = isCustom ? customRefs[sideKey].partKey : (prov ? prov.partKey : defaultName);

        if (isPicking) {
            bg = '#eab308';
            border = '1px solid #ca8a04';
            color = '#000000';
            labelText = '🎯 Wskaż w 3D...';
        } else if (isDisabled) {
            bg = '#18181b';
            border = '1px dashed #ca8a04';
            color = '#facc15';
            labelText = `➕ Wybierz ścianę w 3D`;
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: '#1c1c1f', padding: '4px 6px', borderRadius: '4px', border: '1px solid #27272a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {defaultName}
                    </span>
                    {isCustom && <span style={{ fontSize: '9px', color: '#60a5fa', fontStyle: 'italic' }}>custom</span>}
                </div>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    <button 
                        onClick={() => startPicking(sideKey)}
                        onMouseEnter={() => {
                            if (isDisabled || isPicking) return;
                            const doc = ContextManager.instance.document;
                            let pKey = '';
                            let pFace = '';
                            
                            if (isCustom) {
                                pKey = customRefs[sideKey].partKey;
                                pFace = customRefs[sideKey].face;
                            } else if (prov) {
                                pKey = prov.panelId || prov.partKey;
                                pFace = prov.faceName;
                            }

                            if (pKey && doc) {
                                const allPanels = typeof (doc as any).getPanels === 'function' ? (doc as any).getPanels() : [];
                                const foundNode = allPanels.find((n: any) => {
                                    const d = n.domainData;
                                    return n.id === pKey || (d && (d.id === pKey || d.name === pKey || (d as any).key === pKey || d.role === pKey));
                                });
                                const targetPanel = foundNode ? foundNode.domainData : (doc.findNode(pKey)?.domainData || null);

                                if (targetPanel) {
                                    const view = ContextManager.instance.panelViews.get(targetPanel);
                                    if (view && view.faceMeshes) {
                                        const canonical = normalizeFaceName(pFace);
                                        const mesh = view.faceMeshes[canonical] || view.faceMeshes[pFace];
                                        if (mesh && mesh.material) {
                                            mesh.material.emissiveColor = new (window as any).BABYLON.Color3(0.1, 0.4, 0.8);
                                            mesh.material.diffuseColor = new (window as any).BABYLON.Color3(0.2, 0.5, 1.0);
                                        }
                                    }
                                }
                            }
                        }}
                        onMouseLeave={() => {
                            if (isDisabled || isPicking) return;
                            const doc = ContextManager.instance.document;
                            let pKey = '';
                            let pFace = '';
                            
                            if (isCustom) {
                                pKey = customRefs[sideKey].partKey;
                                pFace = customRefs[sideKey].face;
                            } else if (prov) {
                                pKey = prov.panelId || prov.partKey;
                                pFace = prov.faceName;
                            }

                            if (pKey && doc) {
                                const allPanels = typeof (doc as any).getPanels === 'function' ? (doc as any).getPanels() : [];
                                const foundNode = allPanels.find((n: any) => {
                                    const d = n.domainData;
                                    return n.id === pKey || (d && (d.id === pKey || d.name === pKey || (d as any).key === pKey || d.role === pKey));
                                });
                                const targetPanel = foundNode ? foundNode.domainData : (doc.findNode(pKey)?.domainData || null);

                                if (targetPanel) {
                                    const view = ContextManager.instance.panelViews.get(targetPanel);
                                    if (view && view.faceMeshes) {
                                        const canonical = normalizeFaceName(pFace);
                                        const mesh = view.faceMeshes[canonical] || view.faceMeshes[pFace];
                                        if (mesh && mesh.material && mesh.metadata) {
                                            mesh.material.emissiveColor = mesh.metadata.baseColor || (window as any).BABYLON.Color3.Black();
                                            mesh.material.diffuseColor = mesh.metadata.baseDiffuse || new (window as any).BABYLON.Color3(0.8, 0.8, 0.8);
                                        }
                                    }
                                }
                            }
                        }}
                        title={isDisabled ? `Kliknij, aby wybrać ścianę w oknie 3D dla: ${defaultName}` : isPicking ? 'Wskaż ścianę w oknie 3D' : `Referencja ${defaultName}: ${labelText}. (Najpierw usuń [✕] aby wybrać inną)`}
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
                            fontWeight: isPicking || isCustom || isDisabled ? 'bold' : '500'
                        }}
                    >
                        {labelText}
                    </button>
                    <button 
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

    const renderAddSmartBoxBtn = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
            <button 
                id="btnNowySmartBox"
                onClick={() => {
                    if (ContextManager.instance.appAPI?.addSmartBox) {
                        ContextManager.instance.appAPI.addSmartBox();
                    } else {
                        console.error('[SmartBoxUI] appAPI.addSmartBox is not available');
                    }
                }}
                style={{ 
                    width: '100%',
                    padding: '8px 12px', 
                    background: '#d97706', 
                    border: 'none', 
                    color: '#fff', 
                    borderRadius: '4px', 
                    fontSize: '13px', 
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                }}
            >
                + Nowy SmartBox
            </button>
            <button
                id="btnWstawSmartBoxDoWneki"
                draggable={true}
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/smartbox-template', JSON.stringify({ boxType: 'EMPTY' }));
                    const ctrl = ContextManager.instance.smartBoxBayController;
                    if (ctrl) {
                        ctrl.startDrag('EMPTY');
                        ctrl.setPendingSmartBoxType('EMPTY');
                    }
                }}
                onDragEnd={() => {
                    ContextManager.instance.smartBoxBayController?.endDrag();
                }}
                onClick={() => {
                    ContextManager.instance.smartBoxBayController?.togglePicker('EMPTY');
                }}
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: isPickerActive ? '#16a34a' : '#2563eb',
                    border: isPickerActive ? '1px solid #4ade80' : 'none',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: isPickerActive ? '0 0 10px rgba(74, 222, 128, 0.4)' : 'none',
                    transition: 'all 0.15s ease'
                }}
                title="Wskaż wnękę w korpusie 3D lub przeciągnij ten przycisk na wnękę"
            >
                {isPickerActive
                    ? 'Wskaż wnękę w 3D... (anuluj)'
                    : 'Wstaw do wnęki (przeciągnij / wskaż)'}
            </button>
        </div>
    );

    if (!container) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: '#121214', color: '#fff', fontSize: '13px' }}>
                {renderAddSmartBoxBtn()}
                <div className="panel-section" style={{ padding: '16px' }}>
                    <p className="placeholder-text" style={{ fontStyle: 'italic', color: '#a1a1aa', textAlign: 'center' }}>
                        Zaznacz SmartBox na drzewie projektu lub scenie, aby go skonfigurować.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: '#121214', color: '#fff', fontSize: '13px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {renderAddSmartBoxBtn()}
            </div>

            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '6px', overflow: 'hidden' }}>
                <div 
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

            <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Konfiguracja
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Segment:</span>
                    <select 
                        value={targetZone} 
                        onChange={(e) => {
                            const val = e.target.value;
                            setTargetZone(val);
                            triggerUpdateEx({ targetZone: val });
                        }}
                        style={{ 
                            width: '160px', 
                            padding: '4px 6px', 
                            background: '#27272a', 
                            border: '1px solid #3b82f6', 
                            color: '#fff', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                        }}
                    >
                        <option value="FULL">Cały korpus</option>
                        <option value="T">Sekcja górna</option>
                        <option value="M">Sekcja środkowa</option>
                        <option value="B">Sekcja dolna</option>
                    </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Typ:</span>
                    <select 
                        value={boxType} 
                        onChange={(e) => {
                            const val = e.target.value;
                            setBoxType(val);
                            const typeMap: Record<string, string> = {
                                'EMPTY': 'smartbox_empty',
                                'SHELVES': 'smartbox_shelves',
                                'DOORS': 'smartbox_doors',
                                'SHELF': 'smartbox_shelf',
                                'DRAWERS': 'smartbox_drawers',
                                'DIVIDERS': 'smartbox_dividers',
                                'FLAPS': 'smartbox_flaps',
                                'TUBES': 'smartbox_tubes',
                                'PANELS': 'smartbox_panels'
                            };
                            triggerUpdateEx({ 
                                boxType: val,
                                type: typeMap[val] || 'smartbox_empty',
                                ...(val === 'PANELS' ? { targetZone: 'FULL' } : {})
                            });
                            if (val === 'PANELS') setTargetZone('FULL');
                        }}
                        style={{ width: '160px', padding: '4px 6px', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                        <option value="EMPTY">Brak</option>
                        <option value="SHELVES">Półki</option>
                        <option value="DOORS">Drzwi</option>
                        <option value="SHELF">Wieniec</option>
                        <option value="DRAWERS">Szuflady</option>
                        <option value="DIVIDERS">Przegrody</option>
                        <option value="FLAPS">Klapy</option>
                        <option value="TUBES">Drążek</option>
                        <option value="PANELS">Blendy</option>
                    </select>
                </div>
            </div>

            <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#e4e4e7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>∨</span> {boxType === 'SHELVES' ? 'Polki V1' : boxType === 'DOORS' ? 'Fronty V1' : boxType === 'SHELF' ? 'Wieniec V1' : boxType === 'TUBES' ? 'Drążek V1' : boxType === 'DRAWERS' ? 'Szuflady V1' : boxType === 'DIVIDERS' ? 'Przegrody V1' : boxType === 'PANELS' ? 'Blendy V1' : boxType === 'FLAPS' ? 'Klapy V1' : boxType === 'EMPTY' ? 'Brak modułu' : 'Moduł V1'}
                </div>

                {boxType === 'EMPTY' && (
                    <div style={{ padding: '12px', background: '#222225', borderRadius: '4px', border: '1px dashed #3f3f46', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#93c5fd', fontWeight: 'bold' }}>
                            📦 Brak modułu
                        </p>
                        <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#a1a1aa' }}>
                            Wybierz powyżej moduł (np. <strong>Półki</strong>, <strong>Drzwi</strong>, <strong>Wieniec</strong> lub <strong>Drążek</strong>), aby wypełnić wnętrze.
                        </p>
                    </div>
                )}
                {boxType === 'SHELVES' && <ShelvesSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                {boxType === 'DOORS' && <DoorsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                {boxType === 'SHELF' && <ShelfSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                {boxType === 'TUBES' && <TubesSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                {boxType === 'DRAWERS' && <DrawersSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                {boxType === 'DIVIDERS' && <DividersSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                {boxType === 'PANELS' && <PanelsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                {boxType === 'FLAPS' && <FlapsSubModule container={container} triggerUpdate={triggerUpdateEx} />}
                {boxType !== 'SHELVES' && boxType !== 'DOORS' && boxType !== 'SHELF' && boxType !== 'TUBES' && boxType !== 'DRAWERS' && boxType !== 'DIVIDERS' && boxType !== 'PANELS' && boxType !== 'FLAPS' && boxType !== 'EMPTY' && (
                    <div style={{ padding: '8px', background: '#222225', borderRadius: '4px', border: '1px dashed #3f3f46' }}>
                        <p style={{ margin: 0, fontSize: '11px', color: '#a1a1aa' }}>
                            Moduł <strong>{boxType}</strong> jest aktywny.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
