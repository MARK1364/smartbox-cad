/**
 * Ekstrakcja payloadów z żywego dokumentu CAD.
 * Jedyny most między ProjectDocument a podstronami.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { ReportDataNormalizer } from '../../R1_reports/report-data-normalizer.js';
import { resolveMaterialName } from '../../n1_nesting/core/nesting-engine.js';
import { DrawingProjectExtractor } from '../../R2_rys/drawing-project-extractor.js';
import { persistProjectSnapshot, readProjectSnapshot } from './session';
import { filterPanelsByScope, filterAccessoriesByScope, filterNestingPartsByScope } from './scope-filter';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { ConstraintStore } from '../../S2_solver/constraint-store.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';
import type {
    ModuleScope,
    ReportModulePayload,
    NestingModulePayload,
    CncModulePayload,
    CncWorkpiece,
    DrawModulePayload,
    DagModulePayload,
    DagNode,
    DagEdge,
    InstrukcjaModulePayload,
} from './types';

function nowIso(): string {
    return new Date().toISOString();
}

function getDocument(explicit?: any): any {
    return explicit || ContextManager.instance?.document || readProjectSnapshot();
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
            material: resolveMaterialName(p.material),
            containerId: p.container_id,
            blokId: p.blok_id,
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
        config: { width: 2070, height: 2800, kerf: 4, trimMargin: 10, thickness: 18, machineType: 'saw' },
        selectedMaterial: 'ALL',
    };
}

export function extractCncPayload(scope: ModuleScope, document?: any): CncModulePayload {
    const doc = getDocument(document);
    let panel = findPanelInDocument(doc, scope.id);
    if (!panel && (scope.type === 'CONTAINER' || scope.type === 'BLOKI' || scope.type === 'PROJECT')) {
        const raw = ReportDataNormalizer.extractProjectData(doc);
        const scopedPanels = filterPanelsByScope(raw.panels, scope);
        if (scopedPanels.length > 0) {
            const firstId = scopedPanels[0].node_id || scopedPanels[0].part_id;
            panel = findPanelInDocument(doc, firstId);
        }
    }
    if (!panel) {
        throw new Error(`Nie znaleziono formatki dla zakresu „${scope.name}” (${scope.id}).`);
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

export function extractDagPayload(scope: ModuleScope, document?: any): DagModulePayload {
    const doc = getDocument(document);
    persistProjectSnapshot(doc);

    const nodes: DagNode[] = [];
    const edges: DagEdge[] = [];
    const visitedNodeIds = new Set<string>();

    let containerCount = 0;
    let panelCount = 0;
    let featureCount = 0;
    let hardwareCount = 0;
    let constraintCount = 0;
    let conflictCount = 0;

    const traverse = (node: any, parentId?: string) => {
        if (!node || !node.id) return;
        visitedNodeIds.add(node.id);

        const nodeType = node.nodeType || 'PART';
        let dagType: DagNode['type'] = 'PANEL';
        if (nodeType === 'ROOM') dagType = 'ROOM';
        else if (nodeType === 'ASSEMBLY') { dagType = 'CONTAINER'; containerCount++; }
        else if (nodeType === 'PART') { dagType = 'PANEL'; panelCount++; }
        else if (nodeType === 'FEATURE') { dagType = 'FEATURE'; featureCount++; }
        else if (nodeType === 'HARDWARE') { dagType = 'HARDWARE'; hardwareCount++; }
        else { dagType = 'PANEL'; panelCount++; }

        const domain = node.domainData;
        let dimensions: { widthMm: number; heightMm: number; thicknessMm: number } | undefined;

        if (domain) {
            const wNm = typeof domain.width === 'number' ? domain.width : 0;
            const hNm = typeof domain.height === 'number' ? domain.height : 0;
            const tNm = typeof domain.thickness === 'number' ? domain.thickness : (typeof domain.depth === 'number' ? domain.depth : 0);
            if (wNm || hNm || tNm) {
                dimensions = {
                    widthMm: Math.round(nmToMm(wNm) * 10) / 10,
                    heightMm: Math.round(nmToMm(hNm) * 10) / 10,
                    thicknessMm: Math.round(nmToMm(tNm) * 10) / 10,
                };
            }
        }

        const isFrozen = !!node.frozen || !!domain?.frozen;
        const isVisible = node.visible !== false;

        nodes.push({
            id: node.id,
            label: node.name || (domain?.name) || node.id,
            type: dagType,
            role: node.role || domain?.role || undefined,
            parentId,
            dimensions,
            status: {
                frozen: isFrozen,
                visible: isVisible,
            },
            meta: {
                nodeType: node.nodeType,
                hasDomain: !!domain,
                materialId: domain?.materialId || undefined,
            },
        });

        if (parentId) {
            edges.push({
                id: `edge_${parentId}_${node.id}`,
                source: parentId,
                target: node.id,
                kind: 'HIERARCHY',
                label: 'zawiera',
            });
        }

        // Sprawdź czy formatka posiada cechy (nawierty/otwory/rowki) w domainData
        if (domain && Array.isArray(domain.features)) {
            domain.features.forEach((feat: any, idx: number) => {
                const featId = feat.id || `${node.id}_feat_${idx}`;
                featureCount++;
                nodes.push({
                    id: featId,
                    label: feat.name || (feat.type ? tx(srcTekst, 'moddata.extract_feat', TX_NS, { type: feat.type }) : tx(srcTekst, 'moddata.hole_idx', TX_NS, { i: idx + 1 })),
                    type: 'FEATURE',
                    parentId: node.id,
                    dimensions: feat.diameter ? {
                        widthMm: Math.round(nmToMm(feat.diameter) * 10) / 10,
                        heightMm: Math.round(nmToMm(feat.depth || 0) * 10) / 10,
                        thicknessMm: 0,
                    } : undefined,
                    meta: {
                        purpose: feat.purpose,
                        kind: feat.type || feat.kind,
                    },
                });
                edges.push({
                    id: `edge_feat_${node.id}_${featId}`,
                    source: node.id,
                    target: featId,
                    kind: 'FEATURE_PARENT',
                    label: tx(srcTekst, 'moddata.machining', TX_NS),
                });
            });
        }

        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                traverse(child, node.id);
            }
        }
    };

    const root = doc?.rootNode || doc?.root;
    if (root) {
        traverse(root);
    } else if (doc && typeof doc.getContainers === 'function') {
        const containers = doc.getContainers() || [];
        for (const c of containers) traverse(c);
        const panels = doc.getPanels?.() || [];
        for (const p of panels) {
            if (!visitedNodeIds.has(p.id)) traverse(p);
        }
    }

    // Pobierz więzy z ConstraintStore
    try {
        const constraints = ConstraintStore.instance.constraints || [];
        constraints.forEach((c) => {
            constraintCount++;
            const cNodeId = `constraint_${c.id}`;
            const hasConflict = !!c.conflict;
            if (hasConflict) conflictCount++;

                nodes.push({
                    id: cNodeId,
                    label: tx(srcTekst, 'moddata.joint', TX_NS, { type: c.bindType }),
                type: 'CONSTRAINT',
                status: {
                    conflict: hasConflict,
                    residual: c.residual?.linearMm,
                },
                meta: {
                    bindType: c.bindType,
                    offsetMm: c.offsetMm,
                    enabled: c.enabled,
                },
            });

            if (c.anchorA?.nodeId && visitedNodeIds.has(c.anchorA.nodeId)) {
                edges.push({
                    id: `edge_${cNodeId}_${c.anchorA.nodeId}`,
                    source: cNodeId,
                    target: c.anchorA.nodeId,
                    kind: 'CONSTRAINT',
                    label: c.anchorA.faceName ? tx(srcTekst, 'moddata.wall_anchor', TX_NS, { face: c.anchorA.faceName }) : tx(srcTekst, 'moddata.anchor_a', TX_NS),
                    conflict: hasConflict,
                });
            }

            if (c.anchorB?.nodeId && visitedNodeIds.has(c.anchorB.nodeId)) {
                edges.push({
                    id: `edge_${cNodeId}_${c.anchorB.nodeId}`,
                    source: cNodeId,
                    target: c.anchorB.nodeId,
                    kind: 'CONSTRAINT',
                    label: c.anchorB.faceName ? tx(srcTekst, 'moddata.wall_anchor', TX_NS, { face: c.anchorB.faceName }) : tx(srcTekst, 'moddata.anchor_b', TX_NS),
                    conflict: hasConflict,
                });
            }
        });
    } catch (e) {
        console.warn('extractDagPayload: błąd pobierania więzów:', e);
    }

    return {
        meta: {
            module: 'dag',
            sourceId: 'cad',
            loadedAt: nowIso(),
            originLabel: `CAD · ${scope.name}`,
        },
        scope,
        nodes,
        edges,
        stats: {
            containerCount,
            panelCount,
            featureCount,
            hardwareCount,
            constraintCount,
            conflictCount,
        },
    };
}
/**
 * Instrukcja montazu (I1): lekki payload — podstrona jest kopia shella CAD,
 * laduje projekt ze snapshotu i liczy plan na zywo (`assemblyPlanFromScene`).
 */
export function extractInstrukcjaPayload(scope: ModuleScope, document?: any): InstrukcjaModulePayload {
    const doc = getDocument(document);
    persistProjectSnapshot(doc);
    return {
        meta: {
            module: 'instrukcja',
            sourceId: 'cad',
            loadedAt: nowIso(),
            originLabel: scope.name || tx(srcTekst, 'moddata.instrukcja_origin', TX_NS),
        },
        scope,
    };
}