/**
 * SmartPanel Web — Context Menu Handler
 * 
 * Obsługuje menu kontekstowe pod prawym przyciskiem myszy (3D oraz na drzewie obiektu).
 */

import { ContextManager } from './context-manager.js';
import { openCncFromCad } from '../src/module-data/open-modules.js';

export class ContextMenuHandler {
    private svgIcons = {
        hole: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
        fillet: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20v-8a8 8 0 0 1 8-8h8"></path></svg>',
        sketch: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path></svg>',
        properties: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
        zoomFit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
        reset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>',
        undo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>',
        redo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path></svg>',
        eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
        trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
        deselect: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        cnc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v5"/><path d="M9 7h6v4a3 3 0 0 1-6 0V7z"/><path d="M12 14v4"/><path d="M10 21l2-3 2 3h-4z"/></svg>',
    };

    private lastInspectedData: any = null;

    public init(canvas: HTMLCanvasElement, contextMenu: any, propertiesManager: any, getAllPanels: () => any[], toggleSketchMode: () => void, applyUndo: () => void, applyRedo: () => void, history: any): void {
        const viewport = ContextManager.instance.viewport;
        const doc = ContextManager.instance.document;
        const facePicker = ContextManager.instance.facePicker;

        if (!canvas || !viewport || !doc || !facePicker) return;

        canvas.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            const items: any[] = [];
            this.lastInspectedData = null;

            const generalPick = viewport.scene.pick(
                viewport.scene.pointerX,
                viewport.scene.pointerY
            );
            const pickedMesh = (generalPick && generalPick.hit) ? generalPick.pickedMesh : null;

            if (pickedMesh) {
                this.lastInspectedData = propertiesManager.inspectMesh(pickedMesh, doc, ContextManager.instance.panelViews, getAllPanels, false);
                if (this.lastInspectedData) {
                    items.push(...propertiesManager.getContextMenuItems(this.lastInspectedData, this.svgIcons.properties));
                    if (this.lastInspectedData.panelId) {
                        items.push({
                            label: 'CNC — obróbka formatki',
                            icon: this.svgIcons.cnc,
                            action: 'open-cnc',
                        });
                        items.push({ separator: true });
                    }
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

            if (hasFace) {
                const displayName = clickedFaceName ? `${clickedFaceMesh.metadata.panelModel?.name || 'Płyta'}_${clickedFaceName}` : 'wybranej ścianie';
                items.push({ label: `Dodaj otwór na: ${displayName}`, icon: this.svgIcons.hole, action: 'add-hole' });
                items.push({ label: 'Tryb szkicu', icon: this.svgIcons.sketch, action: 'sketch-mode', shortcut: 'S' });
                items.push({ separator: true });
            }

            if (hasEdge) {
                const count = facePicker.selectedEdges ? facePicker.selectedEdges.size : 1;
                items.push({ label: `Zaokrąglij krawędź (${count})`, icon: this.svgIcons.fillet, action: 'add-fillet' });
                items.push({ separator: true });
            }

            items.push({ label: 'Cofnij', icon: this.svgIcons.undo, action: 'undo', shortcut: 'Ctrl+Z', disabled: !history.canUndo() });
            items.push({ label: 'Ponów', icon: this.svgIcons.redo, action: 'redo', shortcut: 'Ctrl+Y', disabled: !history.canRedo() });
            items.push({ separator: true });
            items.push({ label: 'Zoom Fit', icon: this.svgIcons.zoomFit, action: 'zoom-fit' });
            items.push({ label: 'Odznacz', icon: this.svgIcons.deselect, action: 'deselect', disabled: !hasFace && !hasEdge });

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
                        document.dispatchEvent(new CustomEvent('smartbox-toggle-item-panel'));
                    }
                    break;
                case 'open-cnc': {
                    const panelId = this.lastInspectedData?.panelId;
                    const panelName = this.lastInspectedData?.name || 'Formatka';
                    if (panelId) {
                        openCncFromCad({ type: 'PANEL', id: panelId, name: panelName });
                    }
                    break;
                }
                case 'add-hole':
                    document.getElementById('btnAddHole')?.click();
                    break;
                case 'add-fillet':
                    document.getElementById('btnAddFillet')?.click();
                    break;
                case 'sketch-mode':
                    toggleSketchMode();
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
