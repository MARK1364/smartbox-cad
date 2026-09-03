/**
 * Ekstrakcja payloadów z żywego dokumentu CAD.
 * Jedyny most między ProjectDocument a podstronami.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { ReportDataNormalizer } from '../../R1_reports/report-data-normalizer.js';
import { NestingEngine } from '../../n1_nesting/core/nesting-engine.js';
import { DrawingProjectExtractor } from '../../E2_export/drawing-project-extractor.js';
import { persistProjectSnapshot } from './session';
import { filterPanelsByScope, filterAccessoriesByScope, filterNestingPartsByScope } from './scope-filter';
import type {
    ModuleScope,
    ReportModulePayload,
    NestingModulePayload,
    CncModulePayload,
    CncWorkpiece,
    DrawModulePayload,
} from './types';

function nowIso(): string {
    return new Date().toISOString();
}

function getDocument(explicit?: any): any {
    return explicit || ContextManager.instance?.document;
}

function findPanelInDocument(doc: any, panelId: string): any | null {
    if (!doc) return null;
    const items = typeof doc.getPanels === 'function' ? doc.getPanels() : [];
    for (const item of items) {
        const panel = item.domainData || item;
        if (!panel) continue;
        if (panel.id === panelId || panel.smartId?.uid === panelId || item.id === panelId) {
            return panel;
        }
    }
    const node = typeof doc.findNode === 'function' ? doc.findNode(panelId) : null;
    return node?.domainData || null;
}

/** Programy CAM bez `targetPanel` — referencja jest cykliczna i nie wchodzi do JSON. */
export function cloneCncPrograms(programs: any[] | undefined): any[] {
    if (!Array.isArray(programs)) return [];
    return programs.map((p) => {
        if (!p || typeof p !== 'object') return p;
        const { targetPanel: _targetPanel, ...rest } = p;
        try {
            return JSON.parse(JSON.stringify(rest));
        } catch {
            return {
                id: p.id,
                name: p.name,
                targetPanelName: p.targetPanelName,
                wcsName: p.wcsName,
                cornerIndex: p.cornerIndex,
                postprocessor: p.postprocessor,
                features: Array.isArray(p.features) ? p.features : [],
                isActive: p.isActive,
            };
        }
    });
}

export function bindCncProgramsToPanel(panel: any): void {
    if (!panel.cncPrograms) panel.cncPrograms = [];
    for (const prog of panel.cncPrograms) {
        if (!prog || typeof prog !== 'object') continue;
        prog.targetPanel = panel;
        if (!prog.targetPanelName) prog.targetPanelName = panel.name;
    }
}

/**
 * Wstawia snapshot formatki do dokumentu CAD jako żywy PanelModel
 * (ta sama instancja, która potem idzie do PanelView i CncPanel).
 */
export function hydrateCncWorkpiece(document: any, workpiece: CncWorkpiece): any {
    const panel = document.createPanel({
        name: workpiece.name || 'Formatka',
        width: workpiece.width,
        height: workpiece.height,
        thickness: workpiece.thickness,
        role: workpiece.role,
        materialId: workpiece.materialId,
        color: workpiece.color,
    });
    if (typeof panel.fromJSON === 'function') {
        panel.fromJSON(workpiece);
    }
    panel.cncPrograms = cloneCncPrograms(workpiece.cncPrograms);
    bindCncProgramsToPanel(panel);
    if (typeof document.setActiveEntity === 'function') {
        document.setActiveEntity(panel);
    }
    return panel;
}

export function snapshotPanelForCnc(panel: any): CncWorkpiece {
    return {
        id: String(panel.id || panel.smartId?.uid || 'panel'),
        name: panel.name || 'Formatka',
        type: panel.type || 'panel',
        role: panel.role,
        materialId: panel.materialId || panel.material,
        width: panel.width,
        height: panel.height,
        thickness: panel.thickness,
        color: panel.color,
        features: JSON.parse(JSON.stringify(panel.features || [])),
        cncPrograms: cloneCncPrograms(panel.cncPrograms),
    };
}

export function extractReportPayload(scope: ModuleScope, document?: any): ReportModulePayload {
    const doc = getDocument(document);
    const raw = ReportDataNormalizer.extractProjectData(doc);
    const panels = filterPanelsByScope(raw.panels, scope);
    const accessories = filterAccessoriesByScope(raw.accessories, scope);
    return {
        meta: {
            module: 'report',
            sourceId: 'cad',
            loadedAt: nowIso(),
            originLabel: `CAD · ${scope.name}`,
        },
        scope,
        panels,
        accessories,
        furnitures: raw.furnitures,
        containers: raw.containers,
    };
}

export function extractNestingPayload(scope: ModuleScope, document?: any): NestingModulePayload {
    const report = extractReportPayload(scope, document);
    const parts = filterNestingPartsByScope(
        report.panels.map((p, idx) => ({
            id: p.node_id || p.part_id || `panel_${idx}`,
            name: p.role || p.part_id || `panel_${idx}`,
            width: p.length_mm,
            height: p.width_mm,
            thickness: p.thickness_mm || 18,
            quantity: p.qty || 1,
            canRotate: true,
            material: NestingEngine.resolveMaterialName(p.material),
            containerId: p.container_id,
            smartboxId: p.smartbox_id,
            furnitureName: p.furniture_name,
            sourceNodeId: p.node_id,
        })),
        scope
    );
    return {
        meta: {
            module: 'nesting',
            sourceId: 'cad',
            loadedAt: nowIso(),
            originLabel: `CAD · ${scope.name}`,
        },
        scope,
        parts,
        containers: report.containers.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            partsCount: c.partsCount,
        })),
        config: { width: 2800, height: 2070, kerf: 4, trimMargin: 10, thickness: 18, machineType: 'saw' },
        selectedMaterial: 'ALL',
    };
}

export function extractCncPayload(scope: ModuleScope, document?: any): CncModulePayload {
    const doc = getDocument(document);
    const panel = findPanelInDocument(doc, scope.id);
    if (!panel) {
        throw new Error(`Nie znaleziono formatki „${scope.name}” (${scope.id}).`);
    }
    return {
        meta: {
            module: 'cnc',
            sourceId: 'cad',
            loadedAt: nowIso(),
            originLabel: `CAD · ${panel.name || scope.name}`,
        },
        scope: { ...scope, name: panel.name || scope.name, type: 'PANEL' },
        workpiece: snapshotPanelForCnc(panel),
    };
}

export function extractDrawPayload(scope: ModuleScope, document?: any): DrawModulePayload {
    const doc = getDocument(document);
    persistProjectSnapshot(doc);
    try {
        DrawingProjectExtractor.instance.syncLiveSceneTree();
    } catch (e) {
        console.warn('syncLiveSceneTree:', e);
    }
    let treeRoot = null;
    try {
        treeRoot = DrawingProjectExtractor.instance.extractProjectTree()?.rootNode || null;
    } catch (e) {
        console.warn('extractProjectTree:', e);
    }
    return {
        meta: {
            module: 'draw',
            sourceId: 'cad',
            loadedAt: nowIso(),
            originLabel: `CAD · ${scope.name}`,
        },
        scope,
        treeRoot,
    };
}
