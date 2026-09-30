/**
 * SmartPanel Web — Context Menu Handler
 * 
 * Obsługuje menu kontekstowe pod prawym przyciskiem myszy (3D oraz na drzewie obiektu).
 */

import { ContextManager } from './context-manager.js';
import { UIController } from './ui-controller.js';
import { getModuleOpenHandler } from './module-open-port.js';
import { findFacesAlongRay } from './quick-pick/quick-pick-detector.js';
import { openQuickPick } from './quick-pick/quick-pick-events.js';

export class ContextMenuHandler {
    private svgIcons = {
        fillet: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20v-8a8 8 0 0 1 8-8h8"></path></svg>',
        quickPick: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>',
        properties: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
        zoomFit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
        reset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>',
        undo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>',
        redo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path></svg>',
        eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
        freeze: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>',
        trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
        deselect: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        cnc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v5"/><path d="M9 7h6v4a3 3 0 0 1-6 0V7z"/><path d="M12 14v4"/><path d="M10 21l2-3 2 3h-4z"/></svg>',
    };

    private lastInspectedData: any = null;
    private _lastPickedMesh: any = null;
    private _lastClientX: number = 0;
    private _lastClientY: number = 0;

    public init(canvas: HTMLCanvasElement, contextMenu: any, propertiesManager: any, getAllPanels: () => any[], applyUndo: () => void, applyRedo: () => void): void {
        const viewport = ContextManager.instance.viewport;
        const doc = ContextManager.instance.document;
        const facePicker = ContextManager.instance.facePicker;
        const canUndo = () => !!ContextManager.instance.commandHistory?.canUndo;
        const canRedo = () => !!ContextManager.instance.commandHistory?.canRedo;

        if (!canvas || !viewport || !doc || !facePicker) return;

        canvas.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();

            // Jeśli użytkownik właśnie zakończył przesuwanie kamery PPM (SolidWorks pan gesture) - zablokuj otwarcie menu
            if (viewport.shouldSuppressContextMenu && viewport.shouldSuppressContextMenu()) {
                return;
            }

            this._lastClientX = e.clientX;
            this._lastClientY = e.clientY;

            const isPickingConstraint = !!ContextManager.instance.activeConstraintPicker;
            const isPickingRef = !!ContextManager.instance.activeReferencePicker;

            // Gdy aktywna jest pipeta więzów / relacji — PPM natychmiast wyzwala QuickPick (Solid Edge style)!
            if (isPickingConstraint || isPickingRef) {
                const candidates = findFacesAlongRay(viewport.scene, viewport.scene.pointerX, viewport.scene.pointerY);
                if (candidates.length > 0) {
                    openQuickPick({
                        screenX: e.clientX,
                        screenY: e.clientY,
                        candidates,
                        onSelect: (candidate) => {
                            facePicker.selectFaceExplicit(
                                candidate.mesh,
                                candidate.worldPoint,
                                candidate.smartId,
                                candidate.panelModel,
                                candidate.worldNormal
                            );
                        }
                    });
                    return;
                }
            }

            const items: any[] = [];
            this.lastInspectedData = null;

            const quickPickCandidates = findFacesAlongRay(viewport.scene, viewport.scene.pointerX, viewport.scene.pointerY);
            if (quickPickCandidates.length > 1) {
                items.push({
                    label: `Wybierz inną płaszczyznę (QuickPick - ${quickPickCandidates.length})...`,
                    icon: this.svgIcons.quickPick,
                    action: 'open-quick-pick',
                });
                items.push({ separator: true });
            }

            const generalPick = viewport.scene.pick(
                viewport.scene.pointerX,
                viewport.scene.pointerY
            );
            const pickedMesh = (generalPick && generalPick.hit) ? generalPick.pickedMesh : null;
            this._lastPickedMesh = pickedMesh;

            if (pickedMesh) {
                this.lastInspectedData = propertiesManager.inspectMesh(pickedMesh, doc, ContextManager.instance.panelViews, getAllPanels, false);
                if (this.lastInspectedData) {
                    items.push(...propertiesManager.getContextMenuItems(this.lastInspectedData, this.svgIcons.properties));
                }
            }

            const pickResult = viewport.scene.pick(
                viewport.scene.pointerX,
                viewport.scene.pointerY,
                (mesh: any) => mesh.metadata && mesh.metadata.faceName
            );

            const clickedFaceMesh = (pickResult && pickResult.hit) ? pickResult.pickedMesh : null;
            const clickedFaceName = clickedFaceMesh ? clickedFaceMesh.metadata.faceName : null;

            if (clickedFaceMesh && clickedFaceName) {
                facePicker.selectedFace = clickedFaceMesh;
                facePicker.selectedFaces.clear();
                facePicker.selectedFaces.add(clickedFaceMesh);
            } else {
                if (facePicker.selectionMode === 'object') {
                    facePicker.selectedFace = null;
                    facePicker.selectedFaces.clear();
                }
            }

            const hasFace = !!facePicker.selectedFace;
            const hasEdges = facePicker.selectedEdges && facePicker.selectedEdges.size > 0;
            const hasEdge = hasEdges || !!facePicker.selectedEdge;

            if (hasEdge) {
                const count = facePicker.selectedEdges ? facePicker.selectedEdges.size : 1;
                items.push({ label: `Zaokrąglij krawędź (${count})`, icon: this.svgIcons.fillet, action: 'add-fillet' });
                items.push({ separator: true });
            }

            const isComponent = !!(
                this.lastInspectedData?.panelId ||
                this.lastInspectedData?.containerId ||
                this.lastInspectedData?.kind === 'feature' ||
                this.lastInspectedData?.holeProps ||
                this.lastInspectedData?.grooveProps ||
                pickedMesh?.metadata?.type === 'hardware' ||
                this.lastInspectedData?.hardwareId
            );

            if (isComponent) {
                let isFrozen = false;
                if (this.lastInspectedData?.panelId) {
                    const p = getAllPanels().find((x: any) => x.id === this.lastInspectedData.panelId);
                    isFrozen = !!p?.frozen;
                } else if (this.lastInspectedData?.holeProps || this.lastInspectedData?.grooveProps || this.lastInspectedData?.kind === 'feature') {
                    isFrozen = !!(this.lastInspectedData.frozen || this.lastInspectedData.params?.frozen);
                } else if (pickedMesh?.metadata?.type === 'hardware') {
                    isFrozen = !!pickedMesh.metadata.frozen;
                }

                items.push({
                    label: 'Ukryj',
                    icon: this.svgIcons.eye,
                    action: 'toggle-visibility'
                });
                items.push({
                    label: isFrozen ? 'Odmroź' : 'Zamroź',
                    icon: this.svgIcons.freeze,
                    action: 'toggle-freeze'
                });
            } else {
                items.push({ label: 'Cofnij', icon: this.svgIcons.undo, action: 'undo', shortcut: 'Ctrl+Z', disabled: !canUndo() });
                items.push({ label: 'Ponów', icon: this.svgIcons.redo, action: 'redo', shortcut: 'Ctrl+Y', disabled: !canRedo() });
            }

            if (this.lastInspectedData?.panelId) {
                const panel = getAllPanels().find((p: any) => p.id === this.lastInspectedData.panelId);
                const isAlu = panel?.isAluFrame ? panel.isAluFrame() : panel?.panelForm === 'ALU_FRAME';
                if (isAlu) {
                    items.push({
                        label: '↩️ Przywróć pełną formatkę',
                        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10"/></svg>',
                        action: 'convert-to-solid'
                    });
                } else {
                    items.push({
                        label: '🔲 Konwertuj na ramkę aluminiową',
                        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10"/></svg>',
                        action: 'convert-to-alu-frame'
                    });
                }
            }

            // Moduły produkcyjne na samym dole menu, rozdzielone separatorem
            if (this.lastInspectedData?.panelId || this.lastInspectedData?.containerId) {
                const isContainer = !this.lastInspectedData.panelId && !!this.lastInspectedData.containerId;
                const targetName = this.lastInspectedData.name || (isContainer ? 'Korpus' : 'Formatka');

                items.push({ separator: true });
                items.push({
                    label: isContainer ? 'Raport z korpusu' : 'Raport z formatki',
                    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="18" x2="8" y2="14"/><line x1="12" y1="18" x2="12" y2="11"/><line x1="16" y1="18" x2="16" y2="15"/></svg>',
                    action: 'open-report',
                });
                items.push({
                    label: 'Rozkrój (nesting)',
                    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="5" y="5" width="6" height="8"/><rect x="13" y="5" width="6" height="5"/><rect x="13" y="12" width="6" height="7"/></svg>',
                    action: 'open-nesting',
                });
                items.push({
                    label: isContainer ? 'CNC — obróbka CNC' : 'CNC — obróbka formatki',
                    icon: this.svgIcons.cnc,
                    action: 'open-cnc',
                });
            }

            contextMenu.show(e.clientX, e.clientY, items);
        });

        contextMenu.onAction((action: string) => {
            switch (action) {
                case 'open-properties':
                case 'toggle-item-panel':
                    if (this.lastInspectedData) {
                        propertiesManager.showProperties(this.lastInspectedData);
                    } else if (propertiesManager.current) {
                        propertiesManager.showProperties(propertiesManager.current);
                    } else {
                        document.dispatchEvent(new CustomEvent('bloki-toggle-item-panel'));
                    }
                    break;
                case 'convert-to-alu-frame': {
                    if (this.lastInspectedData?.panelId) {
                        const panel = getAllPanels().find((p: any) => p.id === this.lastInspectedData.panelId);
                        if (panel) {
                            if (typeof panel.convertToAluFrame === 'function') {
                                panel.convertToAluFrame('Z1_BLACK');
                            } else {
                                panel.panelForm = 'ALU_FRAME';
                                panel.frameTemplateId = 'Z1_BLACK';
                                panel._emit?.('panelFormChanged', { panelForm: 'ALU_FRAME' });
                            }
                            doc.notifyDocumentChanged?.();
                            doc.emitChange?.('all');
                            UIController.instance?.setStatus?.('Formatka skonwertowana na ramkę aluminiową ze szkłem', true);
                        }
                    }
                    break;
                }
                case 'convert-to-solid': {
                    if (this.lastInspectedData?.panelId) {
                        const panel = getAllPanels().find((p: any) => p.id === this.lastInspectedData.panelId);
                        if (panel) {
                            if (typeof panel.convertToSolid === 'function') {
                                panel.convertToSolid();
                            } else {
                                panel.panelForm = 'SOLID';
                                panel.frameTemplateId = undefined;
                                panel._emit?.('panelFormChanged', { panelForm: 'SOLID' });
                            }
                            doc.notifyDocumentChanged?.();
                            doc.emitChange?.('all');
                            UIController.instance?.setStatus?.('Przywrócono pełną formatkę', true);
                        }
                    }
                    break;
                }
                case 'open-report': {
                    const isContainer = !this.lastInspectedData?.panelId && !!this.lastInspectedData?.containerId;
                    const targetId = this.lastInspectedData?.panelId || this.lastInspectedData?.containerId;
                    const targetName = this.lastInspectedData?.name || (isContainer ? 'Korpus' : 'Formatka');
                    if (targetId) {
                        getModuleOpenHandler()?.openReport({ type: isContainer ? 'CONTAINER' : 'PANEL', id: targetId, name: targetName });
                    }
                    break;
                }
                case 'open-nesting': {
                    const isContainer = !this.lastInspectedData?.panelId && !!this.lastInspectedData?.containerId;
                    const targetId = this.lastInspectedData?.panelId || this.lastInspectedData?.containerId;
                    const targetName = this.lastInspectedData?.name || (isContainer ? 'Korpus' : 'Formatka');
                    if (targetId) {
                        getModuleOpenHandler()?.openNesting({ type: isContainer ? 'CONTAINER' : 'PANEL', id: targetId, name: targetName });
                    }
                    break;
                }
                case 'open-cnc': {
                    const isContainer = !this.lastInspectedData?.panelId && !!this.lastInspectedData?.containerId;
                    const targetId = this.lastInspectedData?.panelId || this.lastInspectedData?.containerId;
                    const targetName = this.lastInspectedData?.name || (isContainer ? 'Korpus' : 'Formatka');
                    if (targetId) {
                        getModuleOpenHandler()?.openCnc({ type: isContainer ? 'CONTAINER' : 'PANEL', id: targetId, name: targetName });
                    }
                    break;
                }
                case 'open-quick-pick': {
                    const cands = findFacesAlongRay(viewport.scene, viewport.scene.pointerX, viewport.scene.pointerY);
                    if (cands.length > 0) {
                        openQuickPick({
                            screenX: this._lastClientX,
                            screenY: this._lastClientY,
                            candidates: cands,
                            onSelect: (c) => {
                                facePicker.selectFaceExplicit(c.mesh, c.worldPoint, c.smartId, c.panelModel, c.worldNormal);
                            }
                        });
                    }
                    break;
                }
                case 'toggle-visibility': {
                    if (this.lastInspectedData?.panelId) {
                        UIController.instance?.emitTree('toggle-part-visibility', {
                            id: this.lastInspectedData.panelId,
                            uuid: this.lastInspectedData.panelId,
                            panelRef: this._lastPickedMesh?.metadata?.panelModel
                        });
                    } else if (this.lastInspectedData?.containerId) {
                        UIController.instance?.emitTree('toggle-container-visibility', {
                            id: this.lastInspectedData.containerId
                        });
                    } else if (this.lastInspectedData?.holeProps || this.lastInspectedData?.grooveProps || this.lastInspectedData?.kind === 'feature') {
                        UIController.instance?.emitTree('toggle-visibility', {
                            id: this.lastInspectedData.id,
                            panelId: this.lastInspectedData.parentPanelId || this.lastInspectedData.panelId
                        });
                    } else if (this._lastPickedMesh?.metadata?.type === 'hardware' || this.lastInspectedData?.hardwareId) {
                        const hwId = this._lastPickedMesh?.metadata?.id || this.lastInspectedData?.id || this.lastInspectedData?.hardwareId;
                        UIController.instance?.emitTree('toggle-hardware-visibility', { id: hwId });
                    }
                    break;
                }
                case 'toggle-freeze': {
                    if (this.lastInspectedData?.panelId) {
                        UIController.instance?.emitTree('toggle-freeze-part', {
                            id: this.lastInspectedData.panelId,
                            uuid: this.lastInspectedData.panelId
                        });
                    } else if (this.lastInspectedData?.holeProps || this.lastInspectedData?.grooveProps || this.lastInspectedData?.kind === 'feature') {
                        UIController.instance?.emitTree('toggle-freeze-feature', {
                            id: this.lastInspectedData.id,
                            panelId: this.lastInspectedData.parentPanelId || this.lastInspectedData.panelId
                        });
                    } else if (this._lastPickedMesh?.metadata?.type === 'hardware' || this.lastInspectedData?.hardwareId) {
                        const hwId = this._lastPickedMesh?.metadata?.id || this.lastInspectedData?.id || this.lastInspectedData?.hardwareId;
                        UIController.instance?.emitTree('toggle-freeze-hardware', { id: hwId });
                    }
                    break;
                }
                case 'add-fillet':
                    document.getElementById('btnAddFillet')?.click();
                    break;
                case 'undo':
                    applyUndo();
                    break;
                case 'redo':
                    applyRedo();
                    break;
                case 'zoom-fit':
                    viewport.zoomToFit();
                    break;
                case 'deselect':
                    facePicker.clearSelection();
                    const ui = ContextManager.instance.appAPI;
                    break;
            }
        });
    }
}
