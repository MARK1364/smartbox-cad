/**
 * Menu kontekstowe drzewa CAD (PPM).
 * Najpierw klasyczne akcje węzła (nazwa, właściwości, widoczność, usuń),
 * potem — po separatorze — moduły produkcyjne (raport / nesting / CNC / draw).
 */

import { ContextMenu } from '../../A1_core/context-menu.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { UIController } from '../../A1_core/ui-controller.js';
import { PropertiesManager } from '../../A1_core/properties.js';
import { openReportFromCad, openNestingFromCad, openCncFromCad, openDrawFromCad, openDagFromCad, openInstrukcjaFromCad } from './open-modules';
import { CncBatchController } from './cnc-batch-controller';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';
import { openCadEditEntity } from '../floating-edit/cad-edit-entity.js';
import { isSmartWallContainer, isWallPart } from '../../S4_sciany/smartwall-types.js';
import { openQuickPick } from '../../A1_core/quick-pick/quick-pick-events.js';
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
    quickPickCandidates?: any[];
}

const ICONS = {
    quickPick: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>',
    editOperation: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    editKorpus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>',
    report: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="18" x2="8" y2="14"/><line x1="12" y1="18" x2="12" y2="11"/><line x1="16" y1="18" x2="16" y2="15"/></svg>',
    nesting: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="5" y="5" width="6" height="8"/><rect x="13" y="5" width="6" height="5"/><rect x="13" y="12" width="6" height="7"/></svg>',
    cnc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v5"/><path d="M9 7h6v4a3 3 0 0 1-6 0V7z"/><path d="M12 14v4"/><path d="M10 21l2-3 2 3h-4z"/></svg>',
    draw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    dag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><line x1="6" y1="9" x2="12" y2="15"/><line x1="18" y1="9" x2="12" y2="15"/></svg>',
    instrukcja: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    rename: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    properties: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    freeze: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    eyeOff: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    aluFrame: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10"/></svg>',
};

const treeMenu = new ContextMenu();

function nodeKind(rawType: string): string {
    return String(rawType || '').toLowerCase();
}

function domainOf(id: string): any | null {
    const doc = getDoc();
    if (!doc || !id) return null;
    return findContainer(id) || findPanel(id) || doc.findNode(id)?.domainData || null;
}

function isSmartPartModel(m: any): boolean {
    if (!m) return false;
    const role = String(m.role || '');
    const genType = String(m.generatorParams?.type || '').toLowerCase();
    if (role.startsWith('SMARTPART')) return true;
    if (genType.startsWith('smartpart')) return true;
    if (m.generatorParams?.partType === 'HANDLE') return true;
    if (m.generatorParams?.isSmartPart) return true;
    return false;
}

function isApplianceModel(m: any): boolean {
    if (!m) return false;
    if (m.role === 'APPLIANCE' || m.domainData?.role === 'APPLIANCE') return true;
    return String(m.generatorParams?.type || '') === 'smart_appliance';
}

function isAppliancePartModel(m: any): boolean {
    if (!m) return false;
    const role = String(m.role || '').toUpperCase();
    return role === 'APPLIANCE_FRONT' || role === 'APPLIANCE_CORPUS' || m.custom_properties?.domain === 'appliance_part';
}

function resolveApplianceContainer(id: string): any | null {
    const doc = getDoc();
    if (!doc || !id) return null;
    const m = domainOf(id);
    if (isApplianceModel(m)) return m;
    if (isAppliancePartModel(m)) {
        const node = doc.findNode(id);
        const parent = node?.parent?.domainData;
        if (isApplianceModel(parent)) return parent;
    }
    return null;
}

function isSmartPartNode(data: TreeContextMenuData): boolean {
    const kind = nodeKind(data.type);
    if (kind === 'handle' || kind === 'smartpart') return true;
    return isSmartPartModel(domainOf(String(data.id || data.uuid || '')));
}

function isApplianceNode(data: TreeContextMenuData): boolean {
    const kind = nodeKind(data.type);
    if (kind === 'agd' || kind === 'appliance') return true;
    return !!resolveApplianceContainer(String(data.id || data.uuid || ''));
}

function isPanelNode(data: TreeContextMenuData): boolean {
    const kind = nodeKind(data.type);
    if (kind !== 'part' && kind !== 'panel') return false;
    const m = domainOf(String(data.id || data.uuid || ''));
    // SmartPart / część AGD / ściana SmartWall → nie „Edytuj formatkę”
    return !isSmartPartModel(m) && !isAppliancePartModel(m) && !isApplianceModel(m) && !isWallPart(m);
}

function isWallNode(data: TreeContextMenuData): any | null {
    const doc = getDoc();
    if (!doc) return null;
    const id = String(data.id || data.uuid || '');
    if (!id) return null;
    const node = doc.findNode(id);
    if (!node) return null;
    if (isSmartWallContainer(node.domainData)) return node.domainData;
    if (node.parent && isSmartWallContainer(node.parent.domainData)) return node.parent.domainData;
    return null;
}

/**
 * Formatka edytowalna TYLKO gdy powstała w SmartPanel (ręczna).
 * Silnikowe (z korpusów / bloków, engineManaged !== false) edytuje się
 * przez „Edytuj korpus” / „Edytuj blok” — nigdy bezpośrednio.
 */
function isManualEditablePanel(data: TreeContextMenuData): boolean {
    if (!isPanelNode(data)) return false;
    // Flaga z drzewa (drawing-project-extractor: engineManaged === false)
    if (data.isManual === true) return true;
    const m = domainOf(String(data.id || data.uuid || ''));
    if (m && (m as any).engineManaged === false) return true;
    return false;
}

function isBlokiContainer(id: string, rawType?: string): boolean {
    const t = nodeKind(rawType || '');
    if (t === 'handle' || t === 'smartpart' || t === 'agd' || t === 'appliance' || t === 'part' || t === 'panel' || t === 'feature') return false;
    if (t === 'bloki' || t === 'drawers' || t === 'shelves') return true;
    const doc = getDoc();
    if (!doc) return false;
    const c = findContainer(id) || doc.findNode(id)?.domainData;
    if (c) {
        if (isSmartPartModel(c) || isApplianceModel(c)) return false;
        const pType = (c.generatorParams?.type || '').toLowerCase();
        if (pType.startsWith('smartpart') || pType === 'smart_appliance') return false;
        if (
            pType.startsWith('blok_') ||
            pType.startsWith('bloki') ||
            c.generatorParams?.boxType !== undefined ||
            c.is_blok ||
            c.type === 'bloki'
        ) return true;
    }
    return false;
}

function isKorpusNode(data: TreeContextMenuData): boolean {
    if (isSmartPartNode(data) || isApplianceNode(data) || isWallNode(data)) return false;
    if (isBlokiContainer(data.id, data.type)) return false;
    const kind = nodeKind(data.type);
    // Formatka / AGD / Ściana mają własne „Edytuj…” — nie dokładaj „Edytuj korpus”
    if (kind === 'part' || kind === 'panel' || kind === 'feature' || kind === 'handle' || kind === 'agd' || kind === 'appliance') return false;
    const doc = getDoc();
    if (!doc) return kind === 'container' || kind === 'korpus';
    const c = findContainer(data.id) || doc.findNode(data.id)?.domainData;
    if (c) {
        if (isSmartPartModel(c) || isApplianceModel(c) || isSmartWallContainer(c)) return false;
        const pType = (c.generatorParams?.type || '').toLowerCase();
        if (pType.startsWith('smartpart') || pType === 'smart_appliance' || pType.startsWith('blok_') || pType.startsWith('bloki') || pType === 'smartwall') return false;
        if (pType.includes('korpus') || pType.includes('smartframe')) return true;
        if (c.type === 'container' && c.generatorParams?.boxType === undefined && !c.is_blok) return true;
    }
    return kind === 'container' || kind === 'korpus';
}

function resolveScopeType(rawType: string, id?: string): ModuleScopeType | null {
    const t = nodeKind(rawType);
    if (t === 'project' || t === 'root') return 'PROJECT';
    if (t === 'bloki' || t === 'drawers' || t === 'shelves' || (id && isBlokiContainer(id, rawType))) return 'BLOKI';
    if (t === 'part' || t === 'panel') return 'PANEL';
    if (t === 'container' || t === 'assembly' || t === 'korpus') return 'CONTAINER';
    return null;
}

function scopeFromData(data: TreeContextMenuData): ModuleScope | null {
    const type = resolveScopeType(data.type, data.id || data.uuid);
    if (!type) return null;
    const id = type === 'PROJECT' ? 'ALL' : String(data.id || data.uuid || '');
    const name = data.name || (type === 'PROJECT' ? tx(srcTekst, 'ctxmenu.project_default', TX_NS) : id);
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
    return doc.findNode?.(id)?.domainData || null;
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
    return doc.findNode?.(id)?.domainData || null;
}

function resolveParentContainer(id: string): { id: string; model: any; isBlok: boolean } | null {
    const doc = getDoc();
    if (!doc || !id) return null;
    const node = doc.findNode(id);
    if (!node) return null;
    let curr = node.parent;
    while (curr && curr !== doc.root && curr.id !== 'root') {
        const d = curr.domainData;
        if (isSmartWallContainer(d) || d?.generatorParams?.type === 'smartwall') {
            curr = curr.parent;
            continue;
        }
        if (d && (d.type === 'container' || curr.nodeType === 'ASSEMBLY' || d.is_blok || d.generatorParams?.type?.startsWith?.('korpus') || d.generatorParams?.type?.startsWith?.('blok_'))) {
            const isBlok = isBlokiContainer(curr.id, 'container') || !!(d.is_blok || d.type === 'bloki' || d.generatorParams?.type?.startsWith?.('bloki') || d.generatorParams?.type?.startsWith?.('blok_') || d.generatorParams?.boxType !== undefined);
            return { id: curr.id, model: d, isBlok };
        }
        curr = curr.parent;
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
        document.dispatchEvent(new CustomEvent('bloki-toggle-item-panel'));
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

function editSmartPart(data: TreeContextMenuData): void {
    const doc = getDoc();
    if (!doc) return;
    const node = doc.findNode(data.id);
    const model = node?.domainData;
    if (model) {
        doc.setActiveEntity(model);
        UIController.instance?.emitTree('select-container', { id: data.id });
    }
    openCadEditEntity({ entityId: data.id, kind: 'smartpart' });
}

function editKorpus(data: TreeContextMenuData): void {
    const doc = getDoc();
    if (!doc) return;
    let targetContainer = findContainer(data.id);
    if (!targetContainer) {
        const node = doc.findNode(data.id);
        if (node?.domainData?.type === 'container') targetContainer = node.domainData;
        else if (node?.parent?.domainData?.type === 'container') targetContainer = node.parent.domainData;
        else {
            const parentC = resolveParentContainer(data.id || data.uuid || '');
            if (parentC && !parentC.isBlok) targetContainer = parentC.model;
        }
    }
    if (targetContainer) {
        doc.setActiveEntity(targetContainer);
        UIController.instance?.emitTree('select-container', { id: targetContainer.id });
        openCadEditEntity({ entityId: targetContainer.id, kind: 'korpus' });
    }
}

function editBloki(data: TreeContextMenuData): void {
    const doc = getDoc();
    if (!doc) return;
    let targetContainer = findContainer(data.id);
    if (!targetContainer) {
        const node = doc.findNode(data.id);
        if (node?.domainData?.type === 'container') targetContainer = node.domainData;
        else if (node?.parent?.domainData && isBlokiContainer(node.parent.id, 'container')) {
            targetContainer = node.parent.domainData;
        } else {
            const parentC = resolveParentContainer(data.id || data.uuid || '');
            if (parentC && parentC.isBlok) targetContainer = parentC.model;
        }
    }
    if (targetContainer) {
        doc.setActiveEntity(targetContainer);
        UIController.instance?.emitTree('select-container', { id: targetContainer.id });
        openCadEditEntity({ entityId: targetContainer.id, kind: 'blok' });
    }
}

function editAgd(data: TreeContextMenuData): void {
    const doc = getDoc();
    if (!doc) return;
    const target = resolveApplianceContainer(String(data.id || data.uuid || ''))
        || findContainer(data.id);
    if (target) {
        doc.setActiveEntity(target);
        UIController.instance?.emitTree('select-container', { id: target.id });
        openCadEditEntity({ entityId: target.id, kind: 'agd' });
    }
}

function editWall(data: TreeContextMenuData): void {
    const doc = getDoc();
    if (!doc) return;
    const target = isWallNode(data);
    if (target) {
        doc.setActiveEntity(target);
        UIController.instance?.emitTree('select-container', { id: target.id });
        openCadEditEntity({ entityId: target.id, kind: 'wall' });
    }
}

function editPanel(data: TreeContextMenuData): void {
    // Obrona w głąb: formatki silnikowe (korpus/blok) nie mają bezpośredniej edycji.
    if (!isManualEditablePanel(data)) {
        UIController.instance?.setStatus?.('Formatki z korpusu / bloku edytuje się przez „Edytuj korpus” / „Edytuj blok”', true);
        return;
    }
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
    if (panelId) {
        openCadEditEntity({ entityId: panelId, kind: 'panel' });
    }
}

function toggleAluFrame(data: TreeContextMenuData, toAlu: boolean, templateId: string = 'Z1_BLACK'): void {
    const doc = getDoc();
    const panelId = String(data.id || data.uuid || '');
    if (!doc || !panelId) return;
    const node = doc.findNode(panelId);
    const panel = node?.domainData || findPanel(panelId);
    if (panel) {
        if (toAlu) {
            if (typeof panel.convertToAluFrame === 'function') {
                panel.convertToAluFrame(templateId);
            } else {
                panel.panelForm = 'ALU_FRAME';
                panel.frameTemplateId = templateId;
                panel._emit?.('panelFormChanged', { panelForm: 'ALU_FRAME' });
            }
        } else {
            if (typeof panel.convertToSolid === 'function') {
                panel.convertToSolid();
            } else {
                panel.panelForm = 'SOLID';
                panel.frameTemplateId = undefined;
                panel._emit?.('panelFormChanged', { panelForm: 'SOLID' });
            }
        }
        doc.notifyDocumentChanged?.();
        doc.emitChange?.('all');
        UIController.instance?.setStatus?.(toAlu ? tx(srcTekst, 'ctxmenu.alu_done', TX_NS) : tx(srcTekst, 'ctxmenu.alu_reverted', TX_NS), true);
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
    if (data.panelId) {
        openCadEditEntity({
            entityId: data.panelId,
            kind: 'operation',
            featureId: data.id,
            panelId: data.panelId,
            libraryId: data.libraryId || 'przetloczenie',
            face: data.face,
        });
    }
}

function showOnly(data: TreeContextMenuData): void {
    const kind = nodeKind(data.type);
    if (kind === 'project' || kind === 'root' || kind === 'feature') return;
    UIController.instance?.emitTree('show-only', {
        id: data.id,
        uuid: data.uuid || data.id,
        type: data.type,
    });
}

/** Przywraca widoczność całego projektu (zdejmuje izolację). */
function showAll(_data?: TreeContextMenuData): void {
    UIController.instance?.emitTree('show-all', {
        id: 'root',
        uuid: 'root',
        type: 'project',
    });
}

export function showCadTreeContextMenu(data: TreeContextMenuData): void {
    const kind = nodeKind(data.type);
    const scope = scopeFromData(data);
    const items: any[] = [];

    // Instrukcja montażu: klik na korpusie/bloku → ten kontener; klik na formatce →
    // korpus-rodzic (instrukcja zawsze dotyczy korpusu, nie pojedynczej formatki).
    const instrukcjaParent = scope?.type === 'PANEL' ? resolveParentContainer(scope.id) : null;
    const instrukcjaScope: ModuleScope | null = !scope
        ? null
        : scope.type !== 'PANEL'
            ? scope
            : instrukcjaParent
                ? {
                    type: instrukcjaParent.isBlok ? 'BLOKI' : 'CONTAINER',
                    id: instrukcjaParent.id,
                    name: instrukcjaParent.model?.name || instrukcjaParent.id,
                }
                : null;

    // Gdy pod kursorem na scenie 3D jest więcej nakładających się płaszczyzn
    const quickPickCandidates = data.quickPickCandidates;
    if (quickPickCandidates && quickPickCandidates.length > 1) {
        items.push({
            section: 'Wybór 3D',
            toolbar: [{
                label: `Wybierz zakrytą — inne płaszczyzny pod kursorem (${quickPickCandidates.length})`,
                caption: `Wybierz zakrytą · ${quickPickCandidates.length}`,
                icon: ICONS.quickPick,
                action: 'open-quick-pick',
            }],
        });
        items.push({ separator: true });
    }

    // Edycja na samej górze — SmartPart / AGD / ściana / formatka / blok / korpus / operacja
    const wallTarget = isWallNode(data);
    if (isSmartPartNode(data)) {
        items.push({ label: 'Edytuj', icon: ICONS.editOperation, action: 'edit-smartpart' });
        items.push({ separator: true });
    } else if (isApplianceNode(data)) {
        items.push({ label: 'Edytuj AGD', icon: ICONS.editKorpus, action: 'edit-agd' });
    } else if (wallTarget) {
        const isSkos = wallTarget.generatorParams?.preset === 'skos';
        items.push({ label: isSkos ? 'Edytuj skos' : 'Edytuj ścianę', icon: ICONS.editKorpus, action: 'edit-wall' });
    } else if (kind === 'feature') {
        const isSmart = data.isSmart === true || data.source === 'library' || !!data.libraryId;
        if (isSmart) {
            items.push({ label: 'Edytuj', icon: ICONS.editOperation, action: 'edit-operation' });
        } else {
            const isFrozen = data.frozen === true;
            items.push({
                label: isFrozen ? tx(srcTekst, 'ctxmenu.unfreeze_op', TX_NS) : tx(srcTekst, 'ctxmenu.freeze_op', TX_NS),
                icon: ICONS.freeze,
                action: 'toggle-freeze',
            });
        }
    } else if (isManualEditablePanel(data)) {
        items.push({ label: tx(srcTekst, 'ctxmenu.edit_panel', TX_NS), icon: ICONS.editOperation, action: 'edit-panel' });
    } else if (kind === 'part' || kind === 'panel') {
        const parentC = resolveParentContainer(String(data.id || data.uuid || ''));
        if (parentC) {
            if (parentC.isBlok) {
                items.push({ label: 'Edytuj blok', icon: ICONS.editKorpus, action: 'edit-bloki' });
            } else {
                items.push({ label: 'Edytuj korpus', icon: ICONS.editKorpus, action: 'edit-korpus' });
            }
        }
    } else if (isBlokiContainer(data.id, data.type) || kind === 'bloki' || kind === 'drawers' || kind === 'shelves') {
        items.push({ label: 'Edytuj blok', icon: ICONS.editKorpus, action: 'edit-bloki' });
    } else if (isKorpusNode(data)) {
        items.push({ label: 'Edytuj korpus', icon: ICONS.editKorpus, action: 'edit-korpus' });
    }

    // Obiekt: zębatka Właściwości + Zmień nazwę (małe przyciski z podpisem)
    const objectTools: any[] = [
        {
            label: tx(srcTekst, 'ctxmenu.props', TX_NS),
            caption: 'Właściwości',
            icon: ICONS.properties,
            action: 'open-properties',
        },
        {
            label: tx(srcTekst, 'ctxmenu.rename', TX_NS),
            caption: 'Nazwa',
            icon: ICONS.rename,
            action: 'rename',
        },
    ];
    if (kind !== 'project' && kind !== 'root') {
        objectTools.push({
            label: tx(srcTekst, 'tree.delete_panel', TX_NS),
            caption: 'Usuń',
            icon: ICONS.trash,
            action: 'delete',
        });
    }
    if (kind === 'part' || kind === 'panel') {
        const isManual = data.isManual === true;
        if (!isManual) {
            const isFrozen = data.frozen === true;
            objectTools.push({
                label: isFrozen ? tx(srcTekst, 'ctxmenu.unfreeze_panel', TX_NS) : tx(srcTekst, 'ctxmenu.freeze_panel', TX_NS),
                caption: isFrozen ? 'Odmroź' : 'Zamroź',
                icon: ICONS.freeze,
                action: 'toggle-freeze',
            });
        }
    }
    items.push({ section: 'Obiekt', toolbar: objectTools });

    // Widoczność — pasek z podpisami
    const canIsolate =
        kind === 'part' || kind === 'panel' || kind === 'container' || kind === 'assembly'
        || kind === 'korpus' || kind === 'bloki' || kind === 'drawers' || kind === 'shelves'
        || kind === 'handle' || kind === 'agd' || kind === 'appliance';
    const canRevealScope =
        canIsolate || kind === 'project' || kind === 'root' || kind === 'hardware';

    const viewTools: any[] = [];
    if (canIsolate) {
        viewTools.push({
            label: 'Ukryj',
            caption: 'Ukryj',
            icon: ICONS.eyeOff,
            action: 'toggle-visibility',
        });
        viewTools.push({
            label: tx(srcTekst, 'ctxmenu.show_only', TX_NS),
            caption: 'Tylko',
            icon: ICONS.eye,
            action: 'show-only',
        });
    }
    if (canRevealScope) {
        viewTools.push({
            label: tx(srcTekst, 'ctxmenu.show_all', TX_NS),
            caption: 'Wszystko',
            icon: ICONS.eye,
            action: 'show-all',
        });
    }
    if (viewTools.length) {
        items.push({ section: 'Widok', toolbar: viewTools });
    }

    // Osobna sekcja: ramka ALU (nie mieszać z widokiem / produkcją)
    if (kind === 'part' || kind === 'panel') {
        const doc = getDoc();
        const panelId = String(data.id || data.uuid || '');
        const node = doc?.findNode(panelId);
        const panel = node?.domainData || findPanel(panelId);
        const isAlu = panel?.panelForm === 'ALU_FRAME' || (typeof panel?.isAluFrame === 'function' && panel.isAluFrame());
        items.push({ separator: true });
        items.push({ section: 'Ramka ALU' });
        if (isAlu) {
            items.push({ label: tx(srcTekst, 'ctxmenu.restore_panel', TX_NS), icon: ICONS.aluFrame, action: 'convert-to-solid' });
        } else {
            items.push({ label: tx(srcTekst, 'ctxmenu.to_alu', TX_NS), icon: ICONS.aluFrame, action: 'convert-to-alu-frame' });
        }
    }

    if (scope) {
        items.push({ separator: true });
        const prodTools: any[] = [
            {
                label: scope.type === 'PANEL' ? 'Raport z formatki'
                    : scope.type === 'BLOKI' ? 'Raport ze Bloku'
                        : scope.type === 'CONTAINER' ? 'Raport z korpusu'
                            : 'Raport z projektu',
                caption: 'Raport',
                icon: ICONS.report,
                action: 'open-report',
            },
            {
                label: tx(srcTekst, 'ctxmenu.nesting', TX_NS),
                caption: 'Rozkrój',
                icon: ICONS.nesting,
                action: 'open-nesting',
            },
            {
                label: scope.type === 'PANEL' ? 'Generuj program CNC formatki'
                    : scope.type === 'BLOKI' ? 'Generuj programy CNC dla Bloku'
                        : scope.type === 'CONTAINER' ? 'Generuj programy CNC dla szafy'
                            : tx(srcTekst, 'ctxmenu.batch_cnc', TX_NS),
                caption: 'Batch',
                icon: ICONS.cnc,
                action: 'batch-cnc',
            },
            {
                label: 'CNC — edytor formatki',
                caption: 'CNC',
                icon: ICONS.cnc,
                action: 'open-cnc',
            },
            {
                label: scope.type === 'PANEL' ? 'Graf formatki (DAG)'
                    : scope.type === 'BLOKI' ? 'Graf Bloku (DAG)'
                        : scope.type === 'CONTAINER' ? 'Graf korpusu (DAG)'
                            : 'Graf projektu (DAG)',
                caption: 'DAG',
                icon: ICONS.dag,
                action: 'open-dag',
            },
        ];

        // Instrukcja montażu = korpus / blok (dla formatki: jej korpus-rodzic).
        if (instrukcjaScope) {
            const instrukcjaTool = {
                label: instrukcjaScope.type === 'BLOKI' ? 'Instrukcja montażu bloku'
                    : instrukcjaScope.type === 'CONTAINER' ? 'Instrukcja montażu korpusu'
                        : 'Instrukcja montażu (projekt)',
                caption: 'Instrukcja',
                icon: ICONS.instrukcja,
                action: 'open-instrukcja',
            };
            const dagIdx = prodTools.findIndex((t) => t.action === 'open-dag');
            if (dagIdx >= 0) prodTools.splice(dagIdx, 0, instrukcjaTool);
            else prodTools.push(instrukcjaTool);
        }

        items.push({ section: 'Produkcja', toolbar: prodTools });
    }

    treeMenu.onAction((action: string) => {
        if (action === 'open-quick-pick' && data.quickPickCandidates?.length) {
            openQuickPick({
                screenX: data.clientX,
                screenY: data.clientY,
                candidates: data.quickPickCandidates,
                onSelect: (candidate) => {
                    ContextManager.instance.facePicker?.selectFaceExplicit(
                        candidate.mesh,
                        candidate.worldPoint,
                        candidate.smartId,
                        candidate.panelModel,
                        candidate.worldNormal
                    );
                }
            });
        }
        else if (action === 'edit-smartpart') editSmartPart(data);
        else if (action === 'edit-agd') editAgd(data);
        else if (action === 'edit-wall') editWall(data);
        else if (action === 'edit-panel') editPanel(data);
        else if (action === 'edit-operation') editOperation(data);
        else if (action === 'edit-bloki') editBloki(data);
        else if (action === 'edit-korpus') editKorpus(data);
        else if (action === 'rename') startRename(data);
        else if (action === 'delete') deleteNode(data);
        else if (action === 'open-properties') openProperties(data);
        else if (action === 'toggle-visibility') toggleVisibility(data);
        else if (action === 'show-only') showOnly(data);
        else if (action === 'show-all') showAll(data);
        else if (action === 'toggle-freeze') toggleFreeze(data);
        else if (action === 'convert-to-alu-frame') toggleAluFrame(data, true);
        else if (action === 'convert-to-solid') toggleAluFrame(data, false);
        else if (action === 'open-report' && scope) openReportFromCad(scope);
        else if (action === 'open-nesting' && scope) openNestingFromCad(scope);
        else if (action === 'batch-cnc' && scope) CncBatchController.instance.openModal(scope);
        else if (action === 'open-cnc' && scope) openCncFromCad(scope);
        else if (action === 'open-instrukcja' && instrukcjaScope) openInstrukcjaFromCad(instrukcjaScope);
        else if (action === 'open-draw' && scope) openDrawFromCad(scope);
        else if (action === 'open-dag' && scope) openDagFromCad(scope);
    });

    treeMenu.show(data.clientX, data.clientY, items);
}

