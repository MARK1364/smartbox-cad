/**
 * Menu kontekstowe drzewa CAD (PPM).
 * Najpierw klasyczne akcje węzła (nazwa, właściwości, widoczność, usuń),
 * potem — po separatorze — moduły produkcyjne (raport / nesting / CNC / draw).
 */

import { ContextMenu } from '../../A1_core/context-menu.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { UIController } from '../../A1_core/ui-controller.js';
import { PropertiesManager } from '../../A1_core/properties.js';
import { openReportFromCad, openNestingFromCad, openCncFromCad, openDrawFromCad } from './open-modules';
import { CAD_OPEN_FLOATING_PANEL_EDIT } from '../FloatingOperationDialog';
import type { ModuleScope, ModuleScopeType } from './types';

export const CAD_TREE_START_RENAME = 'cad-tree-start-rename';

export interface TreeContextMenuData {
    type: string;
    id: string;
    name?: string;
    uuid?: string;
    panelId?: string;
    libraryId?: string;
    face?: string;
    isSmart?: boolean;
    source?: string;
    isManual?: boolean;
    frozen?: boolean;
    clientX: number;
    clientY: number;
}

const ICONS = {
    editOperation: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    editKorpus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>',
    report: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="18" x2="8" y2="14"/><line x1="12" y1="18" x2="12" y2="11"/><line x1="16" y1="18" x2="16" y2="15"/></svg>',
    nesting: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="5" y="5" width="6" height="8"/><rect x="13" y="5" width="6" height="5"/><rect x="13" y="12" width="6" height="7"/></svg>',
    cnc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v5"/><path d="M9 7h6v4a3 3 0 0 1-6 0V7z"/><path d="M12 14v4"/><path d="M10 21l2-3 2 3h-4z"/></svg>',
    draw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    rename: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    properties: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    freeze: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
};

const treeMenu = new ContextMenu();

function nodeKind(rawType: string): string {
    return String(rawType || '').toLowerCase();
}

function isSmartBoxContainer(id: string, rawType?: string): boolean {
    const t = nodeKind(rawType || '');
    if (t === 'smartbox' || t === 'drawers' || t === 'shelves') return true;
    const doc = getDoc();
    if (!doc) return false;
    const c = findContainer(id) || doc.findNode(id)?.domainData;
    if (c) {
        const pType = (c.generatorParams?.type || '').toLowerCase();
        if (
            pType.startsWith('smartbox') || 
            c.generatorParams?.boxType !== undefined || 
            c.is_smartbox || 
            c.type === 'smartbox' || 
            c.sb_role !== undefined ||
            (c.name && String(c.name).toLowerCase().includes('smartbox')) ||
            (c.name && String(c.name).endsWith('_SB'))
        ) return true;
    }
    return false;
}

function isKorpusNode(data: TreeContextMenuData): boolean {
    if (isSmartBoxContainer(data.id, data.type)) return false;
    const kind = nodeKind(data.type);
    const doc = getDoc();
    if (!doc) return kind === 'container' || kind === 'korpus';
    const c = findContainer(data.id) || doc.findNode(data.id)?.domainData;
    if (c) {
        const pType = (c.generatorParams?.type || '').toLowerCase();
        if (pType.includes('korpus') || pType.includes('smartframe') || (!pType.startsWith('smartbox') && c.type === 'container')) return true;
    }
    if (kind === 'part' || kind === 'panel') {
        const node = doc.findNode(data.id);
        const parent = node?.parent?.domainData;
        if (parent && (parent.type === 'container' || parent.generatorParams)) {
            const pType = (parent.generatorParams?.type || '').toLowerCase();
            if (pType.includes('korpus') || pType.includes('smartframe') || (!pType.startsWith('smartbox') && parent.type === 'container')) return true;
        }
    }
    return kind === 'container' || kind === 'korpus';
}

function resolveScopeType(rawType: string, id?: string): ModuleScopeType | null {
    const t = nodeKind(rawType);
    if (t === 'project' || t === 'root') return 'PROJECT';
    if (t === 'smartbox' || t === 'drawers' || t === 'shelves' || (id && isSmartBoxContainer(id, rawType))) return 'SMARTBOX';
    if (t === 'part' || t === 'panel') return 'PANEL';
    if (t === 'container' || t === 'assembly' || t === 'korpus') return 'CONTAINER';
    return null;
}

function scopeFromData(data: TreeContextMenuData): ModuleScope | null {
    const type = resolveScopeType(data.type, data.id || data.uuid);
    if (!type) return null;
    const id = type === 'PROJECT' ? 'ALL' : String(data.id || data.uuid || '');
    const name = data.name || (type === 'PROJECT' ? 'Cały projekt' : id);
    return { type, id, name };
}

function getDoc(): any {
    return ContextManager.instance?.document;
}

function findPanel(id: string): any | null {
    const doc = getDoc();
    if (!doc) return null;
    const items = typeof doc.getPanels === 'function' ? doc.getPanels() : [];
    for (const item of items) {
        const panel = item.domainData || item;
        if (!panel) continue;
        if (panel.id === id || panel.smartId?.uid === id || item.id === id) return panel;
    }
    return null;
}

function findContainer(id: string): any | null {
    const doc = getDoc();
    if (!doc) return null;
    const items = typeof doc.getContainers === 'function' ? doc.getContainers() : [];
    for (const item of items) {
        const c = item.domainData || item;
        if (!c) continue;
        if (c.id === id || item.id === id) return c;
    }
    return null;
}

function getAllPanels(): any[] {
    const doc = getDoc();
    if (!doc || typeof doc.getPanels !== 'function') return [];
    return doc.getPanels().map((item: any) => item.domainData || item).filter(Boolean);
}

function startRename(data: TreeContextMenuData): void {
    const kind = nodeKind(data.type);
    const type =
        kind === 'project' || kind === 'root' ? 'project' :
        kind === 'part' || kind === 'panel' ? 'part' :
        kind === 'feature' ? 'feature' :
        'container';
    window.dispatchEvent(new CustomEvent(CAD_TREE_START_RENAME, {
        detail: {
            type,
            id: String(data.id || data.uuid || 'root'),
            panelId: data.panelId,
            name: data.name || '',
        },
    }));
}

function openProperties(data: TreeContextMenuData): void {
    const pm = PropertiesManager.instance;
    const kind = nodeKind(data.type);
    const views = ContextManager.instance.panelViews;
    let inspected: any = null;

    if (kind === 'part' || kind === 'panel') {
        inspected = pm.inspectPanel(findPanel(data.id || data.uuid || ''), views, true);
    } else if (kind === 'feature') {
        inspected = pm.inspectFeature(
            data.id,
            getDoc(),
            views,
            getAllPanels,
            ContextManager.instance.facePicker,
            undefined,
            true
        );
    } else if (kind === 'project' || kind === 'root') {
        document.dispatchEvent(new CustomEvent('smartbox-toggle-item-panel'));
        return;
    } else {
        inspected = pm.inspectContainer(findContainer(data.id) || findPanel(data.id), true);
    }

    if (inspected) pm.showProperties(inspected);
}

function toggleVisibility(data: TreeContextMenuData): void {
    const kind = nodeKind(data.type);
    if (kind === 'part' || kind === 'panel') {
        UIController.instance?.emitTree('toggle-part-visibility', { id: data.id, uuid: data.uuid || data.id });
    } else if (kind === 'feature') {
        UIController.instance?.emitTree('toggle-visibility', { id: data.id, panelId: data.panelId });
    } else if (kind !== 'project' && kind !== 'root') {
        UIController.instance?.emitTree('toggle-container-visibility', { id: data.id });
    }
}

function deleteNode(data: TreeContextMenuData): void {
    const kind = nodeKind(data.type);
    if (kind === 'part' || kind === 'panel') {
        UIController.instance?.emitTree('delete-part', { id: data.id, uuid: data.uuid || data.id });
    } else if (kind === 'feature') {
        UIController.instance?.emitTree('delete-feature', { id: data.id, panelId: data.panelId });
    } else if (kind !== 'project' && kind !== 'root') {
        UIController.instance?.emitTree('delete-container', { id: data.id });
    }
}

function toggleFreeze(data: TreeContextMenuData): void {
    const kind = nodeKind(data.type);
    if (kind === 'part' || kind === 'panel') {
        UIController.instance?.emitTree('toggle-freeze-part', { id: data.id, uuid: data.uuid || data.id });
    } else if (kind === 'feature') {
        UIController.instance?.emitTree('toggle-freeze-feature', { id: data.id, panelId: data.panelId });
    }
}

function editKorpus(data: TreeContextMenuData): void {
    const doc = getDoc();
    if (!doc) return;
    let targetContainer = findContainer(data.id);
    if (!targetContainer) {
        const node = doc.findNode(data.id);
        if (node?.domainData?.type === 'container') targetContainer = node.domainData;
        else if (node?.parent?.domainData?.type === 'container') targetContainer = node.parent.domainData;
    }
    if (targetContainer) {
        doc.setActiveEntity(targetContainer);
        UIController.instance?.emitTree('select-container', { id: targetContainer.id });
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('cad-switch-tab', { detail: { tabId: 'tab-a3-smartframe' } }));
        window.dispatchEvent(new CustomEvent('cad-edit-smartframe-korpus', { detail: { containerId: targetContainer?.id } }));
    }
}

function editPanel(data: TreeContextMenuData): void {
    const doc = getDoc();
    const panelId = String(data.id || data.uuid || '');
    if (doc && panelId) {
        const node = doc.findNode(panelId);
        const panel = node?.domainData || findPanel(panelId);
        if (panel) {
            doc.setActiveEntity(panel);
            UIController.instance?.emitTree('select-part', { id: panelId, uuid: panelId });
        }
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && panelId) {
        window.dispatchEvent(new CustomEvent(CAD_OPEN_FLOATING_PANEL_EDIT, {
            detail: {
                panelId,
            },
        }));
    }
}

function editOperation(data: TreeContextMenuData): void {
    const doc = getDoc();
    if (doc && data.panelId) {
        const node = doc.findNode(data.panelId);
        const panel = node?.domainData;
        if (panel) {
            doc.setActiveEntity(panel);
            UIController.instance?.emitTree('select-part', { id: data.panelId, uuid: data.panelId });
        }
    }
    UIController.instance?.emitTree('select-feature', { id: data.id, panelId: data.panelId, face: data.face, openProperties: false });
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && data.panelId) {
        window.dispatchEvent(new CustomEvent('cad-open-floating-operation', {
            detail: {
                library_id: data.libraryId || 'przetloczenie',
                featureId: data.id,
                panelId: data.panelId,
                face: data.face,
            },
        }));
    }
}

export function showCadTreeContextMenu(data: TreeContextMenuData): void {
    const kind = nodeKind(data.type);
    const scope = scopeFromData(data);
    const items: any[] = [];

    if (kind === 'feature') {
        const isSmart = data.isSmart === true || data.source === 'library' || !!data.libraryId;
        if (isSmart) {
            items.push({ label: 'Edytuj operację', icon: ICONS.editOperation, action: 'edit-operation' });
            items.push({ label: 'Usuń', icon: ICONS.trash, action: 'delete' });
        } else {
            const isFrozen = data.frozen === true;
            items.push({
                label: isFrozen ? 'Odmroź obróbkę' : 'Zamroź obróbkę',
                icon: ICONS.freeze,
                action: 'toggle-freeze',
            });
        }
    }

    if (kind === 'part' || kind === 'panel') {
        items.push({ label: 'Edytuj formatkę', icon: ICONS.editOperation, action: 'edit-panel' });
    }

    if (isKorpusNode(data)) {
        items.push({ label: 'Edytuj korpus', icon: ICONS.editKorpus, action: 'edit-korpus' });
    }
    items.push({ label: 'Zmień nazwę', icon: ICONS.rename, action: 'rename' });
    items.push({ label: 'Właściwości', icon: ICONS.properties, action: 'open-properties' });

    if (kind === 'part' || kind === 'panel') {
        const isManual = data.isManual === true;
        items.push({ label: 'Ukryj / Pokaż', icon: ICONS.eye, action: 'toggle-visibility' });
        if (isManual) {
            items.push({ label: 'Usuń', icon: ICONS.trash, action: 'delete' });
        } else {
            const isFrozen = data.frozen === true;
            items.push({
                label: isFrozen ? 'Odmroź formatkę' : 'Zamroź formatkę',
                icon: ICONS.freeze,
                action: 'toggle-freeze',
            });
        }
    } else if (kind === 'container') {
        items.push({ label: 'Ukryj / Pokaż', icon: ICONS.eye, action: 'toggle-visibility' });
        items.push({ label: 'Usuń', icon: ICONS.trash, action: 'delete' });
    }

    if (scope) {
        items.push({ separator: true });
        if (scope.type === 'PANEL') {
            items.push({ label: 'Raport z formatki', icon: ICONS.report, action: 'open-report' });
            items.push({ label: 'CNC — obróbka formatki', icon: ICONS.cnc, action: 'open-cnc' });
        } else if (scope.type === 'SMARTBOX') {
            items.push({ label: 'Raport ze SmartBoxa', icon: ICONS.report, action: 'open-report' });
            items.push({ label: 'Rozkrój (nesting)', icon: ICONS.nesting, action: 'open-nesting' });
        } else if (scope.type === 'CONTAINER') {
            items.push({ label: 'Raport z korpusu', icon: ICONS.report, action: 'open-report' });
            items.push({ label: 'Rozkrój (nesting)', icon: ICONS.nesting, action: 'open-nesting' });
        } else {
            items.push({ label: 'Raport z projektu', icon: ICONS.report, action: 'open-report' });
            items.push({ label: 'Rozkrój (nesting)', icon: ICONS.nesting, action: 'open-nesting' });
        }
    }

    treeMenu.onAction((action: string) => {
        if (action === 'edit-panel') editPanel(data);
        else if (action === 'edit-operation') editOperation(data);
        else if (action === 'edit-korpus') editKorpus(data);
        else if (action === 'rename') startRename(data);
        else if (action === 'open-properties') openProperties(data);
        else if (action === 'toggle-visibility') toggleVisibility(data);
        else if (action === 'toggle-freeze') toggleFreeze(data);
        else if (action === 'delete') deleteNode(data);
        else if (action === 'open-report' && scope) openReportFromCad(scope);
        else if (action === 'open-nesting' && scope) openNestingFromCad(scope);
        else if (action === 'open-cnc' && scope) openCncFromCad(scope);
        else if (action === 'open-draw' && scope) openDrawFromCad(scope);
    });

    treeMenu.show(data.clientX, data.clientY, items);
}

