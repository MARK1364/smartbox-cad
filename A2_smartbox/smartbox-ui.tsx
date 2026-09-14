import React, { useState, useEffect, useCallback, useRef } from 'react';
import { update_smartbox_core, validateReferenceFaceOrientation } from './smartbox-core.js';
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
import { highlightBayInScene, clearBayHighlight } from './smartbox-bay-visualizer.js';
import { RemoveNodeCommand } from '../A1_core/commands/remove-node-command.js';
import { TooltipManager } from '../A1_core/tooltip-manager.js';

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

interface ModuleDefinition {
    id: string;
    label: string;
    desc: string;
    icon: (color?: string) => React.ReactNode;
}

const INTERNAL_MODULES: ModuleDefinition[] = [
    {
        id: 'SHELVES',
        label: 'Półki',
        desc: 'Półki z podziałem równomiernym',
        icon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
            </svg>
        )
    },
    {
        id: 'DOORS',
        label: 'Drzwi',
        desc: 'Fronty pojedyncze lub podwójne',
        icon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2 2" />
                <circle cx="8" cy="12" r="1.2" fill={c} />
                <circle cx="16" cy="12" r="1.2" fill={c} />
            </svg>
        )
    },
    {
        id: 'DRAWERS',
        label: 'Szuflady',
        desc: 'Zestaw szuflad z prowadnicami',
        icon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="6" x2="15" y2="6" strokeWidth="2" />
                <line x1="9" y1="12" x2="15" y2="12" strokeWidth="2" />
                <line x1="9" y1="18" x2="15" y2="18" strokeWidth="2" />
            </svg>
        )
    },
    {
        id: 'SHELF',
        label: 'Wieniec',
        desc: 'Pojedyncza półka / wieniec poziomy',
        icon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeOpacity="0.4" />
                <rect x="3" y="11" width="18" height="3" fill={c} fillOpacity="0.25" stroke={c} />
            </svg>
        )
    },
    {
        id: 'TUBES',
        label: 'Drążek',
        desc: 'Drążek ubraniowy z rozetami',
        icon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeOpacity="0.4" />
                <line x1="3" y1="8" x2="21" y2="8" strokeWidth="2.5" />
                <path d="M12 8v3l-4 6h8l-4-6" />
            </svg>
        )
    },
    {
        id: 'DIVIDERS',
        label: 'Przegrody',
        desc: 'Pionowe przegrody wnęki',
        icon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="10" y1="3" x2="10" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
        )
    },
    {
        id: 'FLAPS',
        label: 'Klapy',
        desc: 'Klapy uchylne podnośnikowe',
        icon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeOpacity="0.4" />
                <path d="M4 14l16-6" />
                <path d="M12 8l3-2-1 4" fill={c} />
                <circle cx="5" cy="14" r="1.5" fill={c} />
            </svg>
        )
    }
];

const EXTERNAL_MODULES: ModuleDefinition[] = [
    {
        id: 'PANELS',
        label: 'Blendy',
        desc: 'Blendy i panele obudowy korpusu',
        icon: (c = 'currentColor') => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="1" strokeDasharray="2 2" strokeOpacity="0.5" />
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <line x1="2" y1="2" x2="6" y2="6" />
                <line x1="22" y1="2" x2="18" y2="6" />
                <line x1="2" y1="22" x2="6" y2="18" />
                <line x1="22" y1="22" x2="18" y2="18" />
            </svg>
        )
    }
];

// ─── GŁÓWNY KOMPONENT: SmartBoxUI ────────────────────────────────────────────
export function SmartBoxUI({ projectModel }: Props) {
    const [container, setContainer] = useState<any>(null);
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
        const ctrl = ContextManager.instance.smartBoxBayController;
        const syncPicker = (active?: boolean, mode?: any) => {
            const isAct = active !== undefined ? active : !!ctrl?.isPickerActive;
            setIsPickerActive(isAct);
            setPickerMode(mode !== undefined ? mode : (ctrl?.pickerMode || 'internal'));
            if (!isAct) {
                setPendingPickType(null);
            } else if (ctrl?.pendingSmartBoxType) {
                setPendingPickType(ctrl.pendingSmartBoxType);
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
        window.addEventListener('smartbox-bay-picker-state', onCustom);
        syncPicker();
        return () => {
            if (unsub) unsub();
            window.removeEventListener('smartbox-bay-picker-state', onCustom);
        };
    }, []);

    useEffect(() => {
        if (!container) return;
        const hintsByBoxType: Record<string, { title: string; desc: string }> = {
            SHELVES: { title: 'Półki', desc: 'Przeciągnij na wnękę w korpusie.' },
            DOORS: { title: 'Drzwi', desc: 'Przeciągnij na wnękę w korpusie.' },
            DRAWERS: { title: 'Szuflady', desc: 'Przeciągnij na wnękę w korpusie.' },
            DIVIDERS: { title: 'Przegrody', desc: 'Przeciągnij na wnękę w korpusie.' },
            TUBES: { title: 'Drążek', desc: 'Przeciągnij na wnękę w korpusie.' },
            FLAPS: { title: 'Klapa', desc: 'Przeciągnij na wnękę w korpusie.' },
            PANELS: { title: 'Blendy', desc: 'Przeciągnij i upuść na zewnątrz korpusu.' },
            EMPTY: { title: 'SmartBox', desc: 'Wybierz moduł lub przeciągnij na korpus.' },
        };
        const hint = hintsByBoxType[boxType];
        if (hint) {
            TooltipManager.instance.setActiveHint({
                id: `smartbox_active_${boxType}`,
                title: hint.title,
                description: hint.desc,
                category: 'smartbox'
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
                    if (parentBox && (parentBox.generatorParams?.type?.startsWith('smartbox_') || parentBox.generatorParams?.boxType)) {
                        active = parentBox;
                    }
                }
            }

            if (active && active.type === 'container' && (active.generatorParams?.type?.startsWith('smartbox_') || active.generatorParams?.boxType)) {
                setContainer(active);
                const p = active.generatorParams;
                const bType = boxTypeFromParams(p);
                setBoxType(bType);
                setCustomRefs(p.customReferences || {});
                setDisabledRefsState(p.disabledReferences || {});
                setOffsets(p.offsets || {});
                setMaxHeight(p.maxHeight || 0);

                if (p.side_references_smartbox === 'OUTER' || bType === 'PANELS') {
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

    const handleSelectModule = useCallback((val: string) => {
        setBoxType(val);
        const scene = ContextManager.instance.viewport?.scene;
        if (val !== 'EMPTY') {
            clearBayHighlight(scene);
        } else if (container?.generatorParams?.detectedBay && scene) {
            highlightBayInScene(scene, container.generatorParams.detectedBay);
        }
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
            ...(val === 'PANELS' ? { targetZone: 'FULL' } : {}),
            ...(val === 'DOORS' ? { door_type: 'LEFT', doorType: 'LEFT' } : {})
        }, true);
    }, [container, triggerUpdateEx]);

    const handleDeleteEmptySmartBox = useCallback(() => {
        if (!container) return;
        const doc = projectModel?.document || projectModel || ContextManager.instance.document;
        if (doc) {
            clearBayHighlight();
            const cadNode = doc.findNode(container.id);
            if (cadNode) {
                try {
                    const cmdHist = ContextManager.instance.commandHistory;
                    if (cmdHist && cadNode.parent) {
                        cmdHist.execute(new RemoveNodeCommand(doc, cadNode.id, 'Usunięcie pustego SmartBox'));
                    } else {
                        doc.removeNode(cadNode.id);
                    }
                } catch {
                    doc.removeNode(cadNode.id);
                }
                doc.setActiveEntity(null);
                setContainer(null);
                if (typeof window !== 'undefined') {
                    window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
                }
            }
        }
    }, [container, projectModel]);

    const startPicking = (sideKey: string) => {
        const isDisabled = !!disabledRefsState[sideKey];
        const isCustom = !!customRefs[sideKey];
        const hasAssigned = isCustom && !isDisabled;

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

        let bg = '#27272a';
        let border = '1px solid #3f3f46';
        let color = '#ffffff';
        let labelText = isCustom ? customRefs[sideKey].partKey : defaultName;

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
                                pKey = customRefs[sideKey]?.partKey;
                                pFace = customRefs[sideKey]?.face;
                            } else {
                                const defaultRef = container?.generatorParams?.references?.[sideKey];
                                if (defaultRef) {
                                    pKey = defaultRef.partKey || defaultRef.panelId;
                                    pFace = defaultRef.face || defaultRef.faceName;
                                }
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
                                pKey = customRefs[sideKey]?.partKey;
                                pFace = customRefs[sideKey]?.face;
                            } else {
                                const defaultRef = container?.generatorParams?.references?.[sideKey];
                                if (defaultRef) {
                                    pKey = defaultRef.partKey || defaultRef.panelId;
                                    pFace = defaultRef.face || defaultRef.faceName;
                                }
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

    const renderModulePalette = () => {
        const modules = uiMode === 'internal' ? INTERNAL_MODULES : EXTERNAL_MODULES;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                {/* Dwa główne przyciski wyboru trybu SmartBox */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <button
                        type="button"
                        id="btnSmartBoxWewnatrz"
                        draggable={true}
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/smartbox-template', JSON.stringify({ boxType: 'EMPTY', category: 'internal' }));
                            const ctrl = ContextManager.instance.smartBoxBayController;
                            if (ctrl) {
                                ctrl.startDrag('EMPTY', 'internal');
                                ctrl.setPendingSmartBoxType('EMPTY');
                            }
                        }}
                        onDragEnd={() => {
                            ContextManager.instance.smartBoxBayController?.endDrag();
                        }}
                        onClick={() => {
                            setUiMode('internal');
                            if (isPickerActive && pickerMode === 'external') {
                                ContextManager.instance.smartBoxBayController?.stopPicker();
                            }
                        }}
                        onMouseEnter={() => {
                            TooltipManager.instance.setActiveHint({
                                id: 'smartbox_mode_internal',
                                title: 'SmartBox wewnątrz',
                                description: 'Przeciągnij na wnękę w korpusie.',
                                category: 'smartbox'
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
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            boxShadow: uiMode === 'internal' ? '0 0 10px rgba(59, 130, 246, 0.35)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                        title="Moduły do wnętrza szafek: półki, drzwi, szuflady, drążki, wieńce, przegrody, klapy (kliknij lub przeciągnij na wnękę)"
                    >
                        <span className="hand-icon" title="Chwyć i przeciągnij na scenę 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                            </svg>
                        </span>
                        <span style={{ fontSize: '13px' }}>📥</span>
                        <span>SmartBox wewnątrz</span>
                    </button>

                    <button
                        type="button"
                        id="btnSmartBoxNaZewnatrz"
                        draggable={true}
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/smartbox-template', JSON.stringify({ boxType: 'PANELS', category: 'external' }));
                            const ctrl = ContextManager.instance.smartBoxBayController;
                            if (ctrl) {
                                ctrl.startDrag('PANELS', 'external');
                                ctrl.setPendingSmartBoxType('PANELS');
                            }
                        }}
                        onDragEnd={() => {
                            ContextManager.instance.smartBoxBayController?.endDrag();
                        }}
                        onClick={() => {
                            setUiMode('external');
                            if (isPickerActive && pickerMode === 'internal') {
                                ContextManager.instance.smartBoxBayController?.stopPicker();
                            }
                        }}
                        onMouseEnter={() => {
                            TooltipManager.instance.setActiveHint({
                                id: 'smartbox_mode_external',
                                title: 'SmartBox na zewnątrz',
                                description: 'Przeciągnij i upuść na zewnątrz korpusu.',
                                category: 'smartbox'
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
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            boxShadow: uiMode === 'external' ? '0 0 10px rgba(245, 158, 11, 0.35)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                        title="Moduły zewnętrzne: blendy i obudowy zewnętrzne korpusu (kliknij lub przeciągnij na korpus)"
                    >
                        <span className="hand-icon" title="Chwyć i przeciągnij na scenę 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#fef08a' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                            </svg>
                        </span>
                        <span style={{ fontSize: '13px' }}>📦</span>
                        <span>SmartBox na zewnątrz</span>
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
                                id={`cardSmartBoxMod_${mod.id}`}
                                draggable={true}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/smartbox-template', JSON.stringify({ boxType: mod.id, category: uiMode }));
                                    const ctrl = ContextManager.instance.smartBoxBayController;
                                    if (ctrl) {
                                        ctrl.startDrag(mod.id, uiMode);
                                        ctrl.setPendingSmartBoxType(mod.id);
                                    }
                                }}
                                onDragEnd={() => {
                                    ContextManager.instance.smartBoxBayController?.endDrag();
                                }}
                                onClick={() => {
                                    if (container) {
                                        handleSelectModule(mod.id);
                                    } else {
                                        const ctrl = ContextManager.instance.smartBoxBayController;
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
                                        id: `smartbox_mod_${mod.id}`,
                                        title: mod.label,
                                        description: text,
                                        category: 'smartbox'
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
                                title={`${mod.label}: ${mod.desc}\n• Przeciągnij i upuść na wnękę w 3D\n• Lub kliknij, aby ${container ? 'przełączyć ten SmartBox na ' + mod.label : 'wskazać wnękę w 3D'}`}
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

    const isExternalContainer = container?.generatorParams?.side_references_smartbox === 'OUTER' || boxType === 'PANELS';

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
                    <span>∨</span> {boxType === 'SHELVES' ? 'Półki' : boxType === 'DOORS' ? 'Drzwi / Fronty' : boxType === 'SHELF' ? 'Wieniec' : boxType === 'TUBES' ? 'Drążek' : boxType === 'DRAWERS' ? 'Szuflady' : boxType === 'DIVIDERS' ? 'Przegrody' : boxType === 'PANELS' ? 'Blendy' : boxType === 'FLAPS' ? 'Klapy' : boxType === 'EMPTY' ? 'Wybór modułu' : 'Moduł'}
                </div>

                {boxType === 'EMPTY' && (
                    <div style={{ padding: '8px', background: '#222225', borderRadius: '6px', border: '1px dashed #3f3f46', display: 'flex', justifyContent: 'center' }}>
                        <button
                            type="button"
                            onClick={handleDeleteEmptySmartBox}
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
                            title="Usuń ten pusty SmartBox z drzewa projektu"
                        >
                            <span>✕</span> Usuń ten pusty SmartBox
                        </button>
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
