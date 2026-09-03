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
import type { ModuleScope, ModuleScopeType } from './types';

export const CAD_TREE_START_RENAME = 'cad-tree-start-rename';

export interface TreeContextMenuData {
    type: string;
    id: string;
    name?: string;
    uuid?: string;
    panelId?: string;
    clientX: number;
    clientY: number;
}

const ICONS = {
    report: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="18" x2="8" y2="14"/><line x1="12" y1="18" x2="12" y2="11"/><line x1="16" y1="18" x2="16" y2="15"/></svg>',
    nesting: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="5" y="5" width="6" height="8"/><rect x="13" y="5" width="6" height="5"/><rect x="13" y="12" width="6" height="7"/></svg>',
    cnc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v5"/><path d="M9 7h6v4a3 3 0 0 1-6 0V7z"/><path d="M12 14v4"/><path d="M10 21l2-3 2 3h-4z"/></svg>',
    draw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    rename: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    properties: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
};

const treeMenu = new ContextMenu();

function nodeKind(rawType: string): string {
    return String(rawType || '').toLowerCase();
}

function resolveScopeType(rawType: string): ModuleScopeType | null {
    const t = nodeKind(rawType);
    if (t === 'project' || t === 'root') return 'PROJECT';
    if (t === 'smartbox' || t === 'drawers' || t === 'shelves') return 'SMARTBOX';
    if (t === 'part' || t === 'panel') return 'PANEL';
    if (t === 'container' || t === 'assembly' || t === 'korpus') return 'CONTAINER';
    return null;
}

function scopeFromData(data: TreeContextMenuData): ModuleScope | null {
    const type = resolveScopeType(data.type);
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

export function showCadTreeContextMenu(data: TreeContextMenuData): void {
    const kind = nodeKind(data.type);
    const scope = scopeFromData(data);
    const items: any[] = [];

    items.push({ label: 'Zmień nazwę', icon: ICONS.rename, action: 'rename' });
    items.push({ label: 'Właściwości', icon: ICONS.properties, action: 'open-properties' });

    if (kind !== 'project' && kind !== 'root') {
        items.push({ label: 'Ukryj / Pokaż', icon: ICONS.eye, action: 'toggle-visibility' });
        items.push({ label: 'Usuń', icon: ICONS.trash, action: 'delete' });
    }

    if (scope) {
        items.push({ separator: true });
        if (scope.type === 'PANEL') {
            items.push({ label: 'CNC — obróbka formatki', icon: ICONS.cnc, action: 'open-cnc' });
            items.push({ label: 'Utwórz rysunek', icon: ICONS.draw, action: 'open-draw' });
        } else if (scope.type === 'SMARTBOX') {
            items.push({ label: 'Raport ze SmartBoxa', icon: ICONS.report, action: 'open-report' });
            items.push({ label: 'Rozkrój (nesting)', icon: ICONS.nesting, action: 'open-nesting' });
            items.push({ label: 'Utwórz rysunek', icon: ICONS.draw, action: 'open-draw' });
        } else if (scope.type === 'CONTAINER') {
            items.push({ label: 'Raport z korpusu', icon: ICONS.report, action: 'open-report' });
            items.push({ label: 'Rozkrój (nesting)', icon: ICONS.nesting, action: 'open-nesting' });
            items.push({ label: 'Utwórz rysunek', icon: ICONS.draw, action: 'open-draw' });
        } else {
            items.push({ label: 'Raport z projektu', icon: ICONS.report, action: 'open-report' });
            items.push({ label: 'Rozkrój (nesting)', icon: ICONS.nesting, action: 'open-nesting' });
            items.push({ label: 'Utwórz rysunek', icon: ICONS.draw, action: 'open-draw' });
        }
    }

    treeMenu.onAction((action: string) => {
        if (action === 'rename') startRename(data);
        else if (action === 'open-properties') openProperties(data);
        else if (action === 'toggle-visibility') toggleVisibility(data);
        else if (action === 'delete') deleteNode(data);
        else if (action === 'open-report' && scope) openReportFromCad(scope);
        else if (action === 'open-nesting' && scope) openNestingFromCad(scope);
        else if (action === 'open-cnc' && scope) openCncFromCad(scope);
        else if (action === 'open-draw' && scope) openDrawFromCad(scope);
    });

    treeMenu.show(data.clientX, data.clientY, items);
}
