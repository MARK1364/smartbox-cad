import type { BlokiGeneratorParamsPatch, BlokiModuleId, BlokiModuleTypeById } from './01_bloki-module-types.js';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    update_bloki_core,
    validateReferenceFaceOrientation,
    resolveManualReferenceFace,
    canonicalizeRefFaceName,
} from './01_bloki-core.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { highlightBayInScene, clearBayHighlight } from './02_bloki-bay-visualizer.js';
import {
    highlightBlokiRefSide,
    clearBlokiRefPlaneHint,
    type BlokiRefSideKey,
} from './02_bloki-ref-plane-hint.js';
import { RemoveNodeCommand } from '../A1_core/commands/remove-node-command.js';
import { TooltipManager } from '../A1_core/tooltip-manager.js';
import { SmartModuleRegistry } from './core/smart-module-registry.js';
import { ContainerModel } from '../A1_core/container-model.js';
import { SMARTPART_HANGERS_GROUP_TYPE } from './hangers/hanger-types.js';
import { SMARTPART_HANDLE_TYPE } from './handles/handle-types.js';
import { HandleCatalogBrowser } from './handles/handle-catalog-browser.js';
import { updateSmartPartHangersGroup } from './hangers/hanger-apply.js';
import { customReferencesFromDetectedBay } from './hangers/smartpart-bay-placement.js';
import { resolveDetectedBay } from './02_bloki-bay-detector.js';
import { buildCornerDoorsAutoRefsPatch } from './07_corner-doors-refs.js';
import './01_smartparts-ui.css';

interface Props {
    projectModel: any;
}

function boxTypeFromParams(p: any): string {
    if (p?.boxType) return p.boxType;
    const typeToBox: Record<string, string> = {
        blok_doors: 'DOORS',
        blok_skosne_drzwi: 'SKOSNE_DOORS',
        blok_corner_doors: 'CORNER_DOORS',
        blok_corner_shelves: 'CORNER_SHELVES',
        blok_shelf: 'SHELF',
        blok_tubes: 'TUBES',
        blok_drawers: 'DRAWERS',
        blok_dividers: 'DIVIDERS',
        blok_panels: 'PANELS',
        blok_flaps: 'FLAPS',
        blok_empty: 'EMPTY',
        blok_shelves: 'SHELVES',
        blok_led_external: 'LED_EXTERNAL',
        blok_led_internal: 'LED_INTERNAL',
        blok_handle: 'HANDLES',
        smartpart_handle: 'HANDLES'
    };
    return typeToBox[p?.type] || 'SHELVES';
}

/** AGD ma własną zakładkę — nie wciągaj do BlokiUI przez boxType: APPLIANCE. */
function isApplianceContainer(model: any): boolean {
    if (!model) return false;
    const gp = model.generatorParams || {};
    const role = String(model.role || '');
    return role === 'APPLIANCE' || gp.type === 'smart_appliance' || gp.boxType === 'APPLIANCE';
}

/** Kontener Bloku LUB grupy zawieszek/uchwytów — spójna obsługa w BlokiUI. */
function isBlokiOrHangersContainer(model: any): boolean {
    if (!model || model.type !== 'container') return false;
    if (isApplianceContainer(model)) return false;
    const gp = model.generatorParams || {};
    const role = String(model.role || '');
    if (gp.type?.startsWith('blok_') || gp.boxType) return true;
    if (gp.type === SMARTPART_HANGERS_GROUP_TYPE || role === 'SMARTPART_HANGERS') return true;
    if (gp.type === SMARTPART_HANDLE_TYPE || role === 'SMARTPART_HANDLE') return true;
    return false;
}

function isHangersGroupContainer(model: any): boolean {
    if (!model) return false;
    const gp = model.generatorParams || {};
    const role = String(model.role || '');
    return gp.type === SMARTPART_HANGERS_GROUP_TYPE || role === 'SMARTPART_HANGERS';
}

function isHandleContainer(model: any): boolean {
    if (!model) return false;
    const gp = model.generatorParams || {};
    const role = String(model.role || '');
    return gp.type === SMARTPART_HANDLE_TYPE || gp.type === 'blok_handle' || role === 'SMARTPART_HANDLE' || gp.boxType === 'HANDLES';
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
    const [pickerMode, setPickerMode] = useState<'internal' | 'external' | 'panel'>('internal');
    const [pendingPickType, setPendingPickType] = useState<string | null>(null);
    /** Katalog SmartParts (uchwyty/zawieszki) w panelu Bloki — niezależny od stanu pickera 3D. */
    const [panelTool, setPanelTool] = useState<'HANDLES' | 'HANGERS' | null>(null);
    const [uiMode, setUiMode] = useState<'internal' | 'external' | 'panel'>('internal');

    useEffect(() => {
        const ctrl = ContextManager.instance.blokiBayController;
        const syncPicker = (active?: boolean, mode?: any) => {
            const isAct = active !== undefined ? active : !!ctrl?.isPickerActive;
            setIsPickerActive(isAct);
            setPickerMode(mode !== undefined ? mode : (ctrl?.pickerMode || 'internal'));
            if (isAct && ctrl?.pendingBlokType) {
                setPendingPickType(ctrl.pendingBlokType);
            } else if (!isAct) {
                setPendingPickType(null);
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
            SKOSNE_DOORS: { title: 'Drzwi skośne', desc: 'Wpisz wysokości skośne wnęki (lewa/prawa).' },
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
                let node = doc.findNode(active.id);
                // Wspinaczka do kontenera Bloku / zawieszek (Part lub FEATURE → grupa)
                while (node?.parent) {
                    const parentBox = node.parent.domainData;
                    if (parentBox && isBlokiOrHangersContainer(parentBox)) {
                        active = parentBox;
                        break;
                    }
                    node = node.parent;
                }
            } else if (active && active.type === 'container' && !isBlokiOrHangersContainer(active)) {
                // Part zawieszki (SMARTPART_HANGER) → grupa nadrzędna
                const node = doc.findNode(active.id);
                const parentBox = node?.parent?.domainData;
                if (parentBox && isBlokiOrHangersContainer(parentBox)) {
                    active = parentBox;
                }
            }

            if (active && isBlokiOrHangersContainer(active)) {
                setContainer(active);
                const p = active.generatorParams || {};
                const hangers = isHangersGroupContainer(active);
                const handle = isHandleContainer(active);
                // Migracja starych zawieszek bez customReferences (schemat Bloku)
                if (hangers && !p.customReferences) {
                    const resolvedBay = resolveDetectedBay(p, {
                        width: active.width,
                        height: active.height,
                        depth: active.depth,
                    });
                    if (resolvedBay) {
                        p.customReferences = customReferencesFromDetectedBay(resolvedBay);
                        p.disabledReferences = p.disabledReferences || {};
                        p.offsets = p.offsets || { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 };
                        p.side_references_bloki = p.side_references_bloki || 'INNER';
                        active.generatorParams = { ...p };
                    }
                }
                const bType = hangers ? 'HANGERS' : handle ? 'HANDLES' : boxTypeFromParams(p);
                setBoxType(bType);
                setCustomRefs(p.customReferences || {});
                setDisabledRefsState(p.disabledReferences || {});
                setOffsets(p.offsets || {});
                setMaxHeight(p.maxHeight || 0);

                if (hangers || bType === 'CORNER_DOORS') {
                    setIsRefsOpen(true);
                }

                if (p.side_references_bloki === 'OUTER' || bType === 'PANELS') {
                    setUiMode('external');
                } else if (handle) {
                    setUiMode('panel');
                } else if (bType !== 'EMPTY' || hangers) {
                    setUiMode('internal');
                }

                const scene = ContextManager.instance.viewport?.scene;
                const resolvedBay = resolveDetectedBay(p, {
                    width: active.width,
                    height: active.height,
                    depth: active.depth,
                });
                if (!hangers && bType === 'EMPTY' && resolvedBay && scene) {
                    highlightBayInScene(scene, resolvedBay);
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
        const onProps = () => sync();
        window.document.addEventListener('bloki-properties-update', onProps);
        sync();

        return () => {
            if (typeof unsub === 'function') unsub();
            else if (doc?.offChange) doc.offChange(sync);
            window.document.removeEventListener('bloki-properties-update', onProps);
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

        const doc = projectModel?.document || projectModel || ContextManager.instance.document;
        if (isHangersGroupContainer(container)) {
            const node = doc?.findNode?.(container.id);
            if (node) updateSmartPartHangersGroup(node, doc);
            // Offset ściany musi przebudować Part + otwory (sam CAD bez rebuild = Part „stoi”, kontener się kurczy)
            if (typeof doc?.notifyDocumentChanged === 'function') doc.notifyDocumentChanged();
            if (typeof window !== 'undefined' && typeof (window as any).__rebuildGeometry === 'function') {
                (window as any).__rebuildGeometry('SmartPart offset');
            }
        } else {
            update_bloki_core(container, projectModel);
        }
        
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
        } else if (container && scene) {
            const resolvedBay = resolveDetectedBay(container.generatorParams, {
                width: container.width,
                height: container.height,
                depth: container.depth,
            });
            if (resolvedBay) highlightBayInScene(scene, resolvedBay);
        }
        const typeMap: Record<'EMPTY' | BlokiModuleId, 'blok_empty' | BlokiModuleTypeById[BlokiModuleId]> = {
            'EMPTY': 'blok_empty',
            'SHELVES': 'blok_shelves',
            'CORNER_SHELVES': 'blok_corner_shelves',
            'DOORS': 'blok_doors',
            'SKOSNE_DOORS': 'blok_skosne_drzwi',
            'CORNER_DOORS': 'blok_corner_doors',
            'SHELF': 'blok_shelf',
            'DRAWERS': 'blok_drawers',
            'DIVIDERS': 'blok_dividers',
            'FLAPS': 'blok_flaps',
            'TUBES': 'blok_tubes',
            'PANELS': 'blok_panels',
            'LED_EXTERNAL': 'blok_led_external',
            'LED_INTERNAL': 'blok_led_internal',
            'HANDLES': 'blok_handle',
            'HANGERS': 'smartpart_hangers'
        };
        const selected = val in typeMap ? val as keyof typeof typeMap : 'EMPTY';
        const patch: BlokiGeneratorParamsPatch = {
            boxType: selected,
            type: typeMap[selected],
            ...(selected === 'PANELS' ? { targetZone: 'FULL' } : {}),
            ...(selected === 'DOORS' ? { rodzaj_drzwi: 'LEFT' } : {}),
            ...(selected === 'SKOSNE_DOORS' ? { rodzaj_drzwi: 'LEFT' } : {})
        } as BlokiGeneratorParamsPatch;

        if (selected === 'CORNER_DOORS') {
            const autoRefs = buildCornerDoorsAutoRefsPatch(container, ContextManager.instance.document);
            if (autoRefs) {
                patch.customReferences = autoRefs.customReferences as any;
                patch.disabledReferences = autoRefs.disabledReferences as any;
                setCustomRefs(autoRefs.customReferences);
                setDisabledRefsState(autoRefs.disabledReferences);
            }
        }

        triggerUpdateEx(patch, true);
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
            if (picker) {
                picker.selectionMode = 'object';
                picker.targetSubgeometryType = null;
                picker.clearSelection();
            }
            if (appApi?.setSelectionMode) appApi.setSelectionMode('object');
            if (appApi?.setStatus) appApi.setStatus("Gotowy", false);
            return;
        }

        // Jeśli referencja jest przypisana — wymaga najpierw skasowania [✕]
        if (isCustom && !isDisabled) {
            showRefSideHint(sideKey as BlokiRefSideKey);
            if (appApi?.setStatus) {
                appApi.setStatus(`Odniesienie [${sideLabels[sideKey] || sideKey}] jest przypisane. Aby wybrać inne, najpierw skasuj je przyciskiem [✕].`, true);
            }
            return;
        }

        // Tutaj isDisabled === true -> użytkownik skasował referencję i teraz klika, aby wskazać nową w 3D:
        if (picker) {
            picker.selectionMode = 'subgeometry';
            picker.targetSubgeometryType = 'face';
            if (typeof picker.resetAllFaceHighlights === 'function') picker.resetAllFaceHighlights();
            else picker.clearSelection();
        }

        setPickingField(sideKey);

        if (appApi?.setSelectionMode) {
            appApi.setSelectionMode('subgeometry');
        }

        if (appApi?.setStatus) {
            appApi.setStatus(`Wskaż ścianę w oknie 3D dla odniesienia: ${sideLabels[sideKey]}...`, true);
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
                    appApi.setStatus(`Przypisano odniesienie ${sideLabels[sideKey]} -> ${partKey}${mappedHint}`, false);
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
                appApi.setStatus(`Skasowano odniesienie [${sideLabels[sideKey]}]. Kliknij w pusty przycisk, aby wskazać nową ścianę w 3D.`, true);
            } else {
                appApi.setStatus(`Przywrócono domyślne odniesienie [${sideLabels[sideKey]}].`, false);
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

        let bg = '#27272a';
        let border = '1px solid #3f3f46';
        let color = '#ffffff';
        // Pusty slot po skasowaniu — bez żółtego „Wybierz ścianę”.
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
                onMouseEnter={() => {
                    if (!isPicking) showRefSideHint(sideKey);
                }}
                onMouseLeave={hideRefSideHint}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {defaultName}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center', minWidth: 0, width: '100%' }}>
                    <button 
                        id={`sb-ref-slot-${sideKey.toLowerCase()}`}
                        onClick={() => startPicking(sideKey)}
                        title={isPicking ? 'Wskaż ścianę w oknie 3D (kliknij, aby anulować)' : (isDisabled || !isCustom) ? `Kliknij, aby wskazać ścianę w 3D: ${defaultName}` : `Odniesienie ${defaultName}: ${labelText}. (Aby wybrać inne, najpierw skasuj odniesienie przyciskiem [✕])`}
                        style={{ 
                            flex: '1 1 0',
                            minWidth: 0,
                            width: 0,
                            height: '22px',
                            padding: '1px 5px', 
                            background: bg, 
                            border: border, 
                            color: color, 
                            borderRadius: '3px', 
                            fontSize: '11px', 
                            cursor: 'pointer',
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            textAlign: 'left',
                            fontWeight: isPicking || (isCustom && !isDisabled) ? 'bold' : '500'
                        }}
                    >
                        {labelText || '\u00A0'}
                    </button>
                    <button 
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
                {/* Trzy główne przyciski wyboru trybu Bloki */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    <button
                        type="button"
                        id="btnBlokiWewnatrz"
                        onClick={() => {
                            setUiMode('internal');
                            setPanelTool(null);
                            if (isPickerActive && pickerMode !== 'internal') {
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
                            padding: '5px 4px',
                            background: uiMode === 'internal' ? '#1e40af' : '#27272a',
                            border: uiMode === 'internal' ? '2px solid #3b82f6' : '1px solid #3f3f46',
                            color: '#fff',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            boxShadow: uiMode === 'internal' ? '0 0 10px rgba(59, 130, 246, 0.35)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                        title="Przełącz na moduły wewnętrzne: półki, drzwi, szuflady, drążki, wieńce, przegrody, klapy"
                    >
                        {/* Prostokąt + przerywany w środku */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="3" y="3" width="18" height="18" rx="1" />
                            <rect x="7.5" y="7.5" width="9" height="9" rx="0.5" strokeDasharray="2.2 1.8" />
                        </svg>
                        <span>WEWNĄTRZ</span>
                    </button>

                    <button
                        type="button"
                        id="btnBlokiNaZewnatrz"
                        onClick={() => {
                            setUiMode('external');
                            setPanelTool(null);
                            if (isPickerActive && pickerMode !== 'external') {
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
                            padding: '5px 4px',
                            background: uiMode === 'external' ? '#b45309' : '#27272a',
                            border: uiMode === 'external' ? '2px solid #f59e0b' : '1px solid #3f3f46',
                            color: '#fff',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            boxShadow: uiMode === 'external' ? '0 0 10px rgba(245, 158, 11, 0.35)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                        title="Przełącz na moduły zewnętrzne: blendy i obudowy korpusu"
                    >
                        {/* Prostokąt + przerywany na zewnątrz */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="7.5" y="7.5" width="9" height="9" rx="0.5" />
                            <rect x="3" y="3" width="18" height="18" rx="1" strokeDasharray="2.2 1.8" />
                        </svg>
                        <span>ZEWNĄTRZ</span>
                    </button>

                    <button
                        type="button"
                        id="btnBlokiNaFormatce"
                        onClick={() => {
                            setUiMode('panel');
                            if (isPickerActive && pickerMode !== 'panel') {
                                ContextManager.instance.blokiBayController?.stopPicker();
                            }
                            // Wejdź w FORMATKA bez zamykania już otwartego katalogu uchwytów
                        }}
                        onMouseEnter={() => {
                            TooltipManager.instance.setActiveHint({
                                id: 'blok_mode_panel',
                                title: 'BLOKI NA FORMATCE',
                                description: 'Przełącz na moduły powierzchniowe (uchwyty na płytach frontów…).',
                                category: 'bloki'
                            });
                        }}
                        onMouseLeave={() => TooltipManager.instance.clearActiveHint()}
                        style={{
                            padding: '5px 4px',
                            background: uiMode === 'panel' ? '#1e40af' : '#27272a',
                            border: uiMode === 'panel' ? '2px solid #3b82f6' : '1px solid #3f3f46',
                            color: '#fff',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            boxShadow: uiMode === 'panel' ? '0 0 10px rgba(59, 130, 246, 0.35)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                        title="Przełącz na moduły montowane na płycie/froncie: uchwyty"
                    >
                        {/* Sam prostokąt = formatka */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="4" y="4" width="16" height="16" rx="1" />
                        </svg>
                        <span>FORMATKA</span>
                    </button>
                </div>

                {/* Paleta małych przycisków Drag & Drop — flex, wewn. / zewn. / formatka */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignContent: 'flex-start',
                    gap: '4px',
                    background: '#18181b',
                    padding: '4px',
                    borderRadius: '6px',
                    border: '1px solid #27272a'
                }}>
                    {modules.map((mod) => {
                        const isCurrentActive = container && boxType === mod.id;
                        const isPanelSmartTool = mod.id === 'HANDLES' || mod.id === 'HANGERS';
                        const isToolOpen = isPanelSmartTool && panelTool === mod.id;
                        const isCurrentPicking = isPickerActive && (pendingPickType === mod.id || panelTool === mod.id);

                        let cardBg = '#222226';
                        let cardBorder = '#333338';
                        if (isToolOpen || isCurrentPicking) {
                            cardBg = isPanelSmartTool ? '#1e3a8a' : '#14532d';
                            cardBorder = isPanelSmartTool ? '#60a5fa' : '#4ade80';
                        } else if (isCurrentActive && !isPanelSmartTool) {
                            cardBg = uiMode === 'external' ? '#78350f' : '#1e3a8a';
                            cardBorder = uiMode === 'external' ? '#fbbf24' : '#60a5fa';
                        }

                        const isDirectDrag = !isPanelSmartTool;

                        return (
                            <div
                                key={mod.id}
                                id={`cardBlokiMod_${mod.id}`}
                                data-id={`bloki-card-${mod.id.toLowerCase()}`}
                                data-rec={`bloki-card-${mod.id.toLowerCase()}`}
                                draggable={isDirectDrag}
                                onDragStart={(e) => {
                                    if (!isDirectDrag) {
                                        e.preventDefault();
                                        return;
                                    }
                                    e.dataTransfer.setData('application/bloki-template', JSON.stringify({ boxType: mod.id, category: uiMode }));
                                    const ctrl = ContextManager.instance.blokiBayController;
                                    if (ctrl) {
                                        ctrl.startDrag(mod.id, uiMode);
                                        ctrl.setPendingBlokType(mod.id);
                                    }
                                }}
                                onDragEnd={() => {
                                    if (isDirectDrag) {
                                        ContextManager.instance.blokiBayController?.endDrag();
                                    }
                                }}
                                onClick={() => {
                                    // Uchwyty / zawieszki = katalog SmartParts w panelu edycji (nie przełączaj typu Bloku)
                                    if (mod.id === 'HANDLES' || mod.id === 'HANGERS') {
                                        setUiMode('panel');
                                        const ctrl = ContextManager.instance.blokiBayController;
                                        if (panelTool === mod.id) {
                                            ctrl?.stopPicker();
                                            setPanelTool(null);
                                            setPendingPickType(null);
                                            return;
                                        }
                                        setPanelTool(mod.id);
                                        setPendingPickType(mod.id);
                                        ctrl?.startPicker(mod.id, 'panel');
                                        return;
                                    }
                                    setPanelTool(null);
                                    if (container) {
                                        handleSelectModule(mod.id);
                                    } else {
                                        const ctrl = ContextManager.instance.blokiBayController;
                                        if (ctrl) {
                                            if (isPickerActive && pendingPickType === mod.id) {
                                                ctrl.stopPicker();
                                                setPendingPickType(null);
                                            } else {
                                                ctrl.startPicker(mod.id, uiMode);
                                                setPendingPickType(mod.id);
                                            }
                                        }
                                    }
                                }}
                                onMouseEnter={() => {
                                    let text = 'Przeciągnij na wnękę w korpusie.';
                                    if (uiMode === 'external' || mod.id === 'PANELS') {
                                        text = 'Przeciągnij i upuść na zewnątrz korpusu.';
                                    } else if (uiMode === 'panel') {
                                        text = mod.id === 'HANDLES'
                                            ? 'Kliknij, aby otworzyć katalog uchwytów i wskazać formatkę w 3D.'
                                            : 'Kliknij, aby otworzyć zawieszki i wskazać pozycję w 3D.';
                                    }
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
                                    flex: '1 1 calc(50% - 2px)',
                                    minWidth: '120px',
                                    maxWidth: '100%',
                                    boxSizing: 'border-box',
                                    padding: '4px 2px 3px 2px',
                                    background: cardBg,
                                    border: `1px solid ${cardBorder}`,
                                    borderRadius: '5px',
                                    cursor: isDirectDrag ? 'grab' : 'pointer',
                                    userSelect: 'none',
                                    position: 'relative',
                                    transition: 'all 0.15s ease',
                                    boxShadow: (isToolOpen || isCurrentPicking)
                                        ? (isPanelSmartTool ? '0 0 8px rgba(59, 130, 246, 0.45)' : '0 0 8px rgba(74, 222, 128, 0.4)')
                                        : (isCurrentActive ? '0 0 8px rgba(59, 130, 246, 0.4)' : 'none'),
                                    minHeight: '42px'
                                }}
                                title={`${mod.label}: ${mod.desc}\n• ${isDirectDrag ? 'Przeciągnij i upuść na wnękę w 3D' : 'Kliknij, aby otworzyć listę elementów'}`}
                            >
                                <div style={{ color: (isToolOpen || isCurrentPicking) ? (isPanelSmartTool ? '#93c5fd' : '#4ade80') : (isCurrentActive ? '#fff' : '#93c5fd'), marginBottom: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {mod.icon((isToolOpen || isCurrentPicking) ? (isPanelSmartTool ? '#93c5fd' : '#4ade80') : (isCurrentActive ? '#fff' : '#93c5fd'))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', marginTop: '2px' }}>
                                    {mod.id !== 'HANDLES' && mod.id !== 'HANGERS' && (
                                        <span className="hand-icon" title="Chwyć i przeciągnij na scenę 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                            </svg>
                                        </span>
                                    )}
                                    <span style={{ fontSize: '10.5px', fontWeight: isCurrentActive ? 'bold' : 500, color: isCurrentActive ? '#fff' : 'var(--text-secondary, #aaa)', textAlign: 'center', lineHeight: 1.1 }}>
                                        {mod.label}
                                    </span>
                                </div>
                                {isCurrentActive && (
                                    <span style={{ fontSize: '8px', color: '#93c5fd', marginTop: '1px', fontWeight: 'bold' }}>
                                        ✓ Aktywny
                                    </span>
                                )}
                                {(isToolOpen || isCurrentPicking) && (
                                    <span style={{ fontSize: '8px', color: isPanelSmartTool ? '#93c5fd' : '#4ade80', marginTop: '1px', fontWeight: 'bold' }}>
                                        {isPanelSmartTool ? 'Katalog' : 'Wskaż 3D'}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Katalog SmartParts: filtry + wybór uchwytów (panel edycji Bloki) */}
                {panelTool === 'HANDLES' && (
                    <div style={{ marginTop: '4px', width: '100%' }}>
                        <HandleCatalogBrowser
                            onSelectHandle={() => {
                                setUiMode('panel');
                                setPanelTool('HANDLES');
                                setPendingPickType('HANDLES');
                                ContextManager.instance.blokiBayController?.startPicker('HANDLES', 'panel');
                            }}
                        />
                    </div>
                )}

                {/* Podpowiedź / widok dla modułu ZAWIESZKI */}
                {panelTool === 'HANGERS' && (
                    <div style={{
                        marginTop: '4px',
                        padding: '10px',
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#d4d4d8'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '4px' }}>
                            Zawieszki meblowe (SmartPart)
                        </div>
                        <div style={{ opacity: 0.8, fontSize: '11px', lineHeight: 1.4 }}>
                            Przeciągnij zawieszki na szafkę lub wskaż pozycję montażową, aby dodać okucia i nawierty.
                        </div>
                    </div>
                )}

                {/* Podpowiedź domyślna dla trybu FORMATKA gdy żaden katalog nie jest otwarty */}
                {uiMode === 'panel' && !panelTool && (
                    <div style={{
                        marginTop: '4px',
                        padding: '10px',
                        background: '#18181b',
                        border: '1px dashed #3f3f46',
                        borderRadius: '6px',
                        textAlign: 'center',
                        color: '#71717a',
                        fontSize: '11px'
                    }}>
                        Kliknij <strong>Uchwyty</strong>, aby otworzyć filtry i katalog w panelu edycji, potem wskaż formatkę w 3D.
                    </div>
                )}
            </div>
        );
    };

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

            {container && boxType === 'EMPTY' && (
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
                    }}
                >
                    Usuń ten pusty Blok
                </button>
            )}
        </div>
    );
}
