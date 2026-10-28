/**
 * smartwall-core — rebuild SmartWall: silniki → sync PART pod kontenerem.
 * Bez importu A3 (własny sync dzieci).
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { PanelModel, isManualPanel } from '../A4_smartpanel/panel-model.js';
import { planWalls } from './walls-engine.js';
import { planPillars } from './pillars-engine.js';
import { planSkos, SKOS_DEFAULTS_MM, type SkosSlant } from './skos-engine.js';
import {
    SMARTWALL_TYPE,
    isSmartWallContainer,
    isWallPart,
    type SmartWallFillMm,
    type SmartWallPartPlanMm,
    type SmartWallPreset,
} from './smartwall-types.js';

export function ensureSmartWallGeneratorParams(container: any): void {
    if (!container.generatorParams) container.generatorParams = {};
    container.generatorParams.type = SMARTWALL_TYPE;
    if (!container.generatorParams.preset) container.generatorParams.preset = 'rect';
    if (!Array.isArray(container.generatorParams.fills)) container.generatorParams.fills = [];
}

function gpMm(container: any) {
    const gp = container.generatorParams || {};
    // Wszystko stamtąd jest w nm: gp.* zapisuje rebuild (mmToNm na końcu pliku),
    // a container.* to model CAD. Jawnie, bez progu heurystyki.
    const nmVal = (v: number | undefined, fallback: number) =>
        (v == null || !Number.isFinite(v) ? fallback : nmToMm(v));
    return {
        preset: (gp.preset || 'rect') as SmartWallPreset,
        roomWidth: nmVal(gp.roomWidth ?? container.width, 4000),
        roomDepth: nmVal(gp.roomDepth ?? container.depth, 3000),
        wallHeight: nmVal(gp.wallHeight ?? container.height, 2700),
        wallThickness: nmVal(gp.wallThickness, 100),
        singleLength: gp.singleLength != null ? nmVal(gp.singleLength, 3000) : undefined,
        uskokGapStart: gp.uskokGapStart != null ? nmVal(gp.uskokGapStart, 1000) : undefined,
        uskokGapEnd: gp.uskokGapEnd != null ? nmVal(gp.uskokGapEnd, 1500) : undefined,
        skosLength: nmVal(gp.skosLength, SKOS_DEFAULTS_MM.length),
        skosHeightLeft: nmVal(gp.skosHeightLeft, SKOS_DEFAULTS_MM.heightLeft),
        skosHeightRight: nmVal(gp.skosHeightRight, SKOS_DEFAULTS_MM.heightRight),
        skosSlant: (gp.skosSlant === 'top' ? 'top' : 'bottom') as SkosSlant,
        fills: (gp.fills || []) as SmartWallFillMm[],
    };
}

function buildCombinedPlan(container: any): SmartWallPartPlanMm[] {
    const p = gpMm(container);
    if (p.preset === 'skos') {
        return planSkos({
            skosLength: p.skosLength,
            skosHeightLeft: p.skosHeightLeft,
            skosHeightRight: p.skosHeightRight,
            wallThickness: p.wallThickness,
            skosSlant: p.skosSlant,
        }).parts;
    }
    const walls = planWalls({
        preset: p.preset,
        roomWidth: p.roomWidth,
        roomDepth: p.roomDepth,
        wallHeight: p.wallHeight,
        wallThickness: p.wallThickness,
        singleLength: p.singleLength,
        uskokGapStart: p.uskokGapStart,
        uskokGapEnd: p.uskokGapEnd,
    }).parts;
    const pillars = planPillars(p.fills, p.wallHeight).parts;
    return [...walls, ...pillars];
}

function applyPartToPanel(panel: PanelModel, part: SmartWallPartPlanMm): void {
    panel.name = part.name;
    panel.role = part.role;
    (panel as any).key = part.key;
    (panel as any).lcs = part.lcs;
    const { bbWidth, bbHeight, bbThickness } = resolvePanelDimsMm(part);
    panel.setDimensions(mmToNm(bbWidth), mmToNm(bbHeight), mmToNm(bbThickness));
    if (part.edge_banding) {
        panel.setEdgeBanding(part.edge_banding);
    }
    if (part.color) {
        (panel as any).color = { ...part.color };
    }
    // Zamrożona ściana: poza sceną (jak SmartFrame) — flaga frozen zostaje przy rebuild
    if ((panel as any).frozen) {
        panel.visible = false;
    }
    const cp = {
        ...(panel.custom_properties || {}),
        ...(part.custom_properties || {}),
        excludeFromProduction: true,
        domain: part.custom_properties?.domain || 'wall_segment',
    };
    (panel as any).custom_properties = cp;
    (panel as any)._emit?.('dimensions', { width: panel.width, height: panel.height, thickness: panel.thickness });
}

function resolvePanelDimsMm(part: SmartWallPartPlanMm): { bbWidth: number; bbHeight: number; bbThickness: number } {
    const lcs = part.lcs;
    if (lcs?.mapping) {
        return {
            bbWidth: part.dim[lcs.mapping.X],
            bbHeight: part.dim[lcs.mapping.Y],
            bbThickness: part.dim[lcs.mapping.Z],
        };
    }
    return { bbWidth: part.dim.x, bbHeight: part.dim.y, bbThickness: part.dim.z };
}

function rotFromPart(part: SmartWallPartPlanMm): Quat {
    const r = part.lcs?.rotation || part.rotationDeg;
    if (!r || (r[0] === 0 && r[1] === 0 && r[2] === 0)) return Quat.IDENTITY;
    return Quat.fromEulerXYZ(
        (r[0] * Math.PI) / 180,
        (r[1] * Math.PI) / 180,
        (r[2] * Math.PI) / 180,
    );
}

/**
 * Synchronizuje dzieci PART SmartWall z planem silników.
 * Zwraca true gdy kontener jest smartwall i przebudowa się wykonała.
 */
export function rebuildSmartWall(container: any, doc?: any): boolean {
    if (!isSmartWallContainer(container)) return false;
    ensureSmartWallGeneratorParams(container);

    const document = doc || ContextManager.instance.document;
    const cntNode = document?.findNode(container.id);
    if (!cntNode) return false;

    const p = gpMm(container);
    if (p.preset === 'skos') {
        // Kontener-sk os: gabaryt = bbox trapezu (L × maxH × T).
        container.width = mmToNm(p.skosLength);
        container.height = mmToNm(Math.max(p.skosHeightLeft, p.skosHeightRight));
        container.depth = mmToNm(p.wallThickness);
    } else {
        container.width = mmToNm(p.roomWidth);
        container.height = mmToNm(p.wallHeight);
        container.depth = mmToNm(p.roomDepth);
    }
    // gp w nm (SSOT)
    container.generatorParams.roomWidth = mmToNm(p.roomWidth);
    container.generatorParams.roomDepth = mmToNm(p.roomDepth);
    container.generatorParams.wallHeight = mmToNm(p.wallHeight);
    container.generatorParams.wallThickness = mmToNm(p.wallThickness);
    container.generatorParams.skosLength = mmToNm(p.skosLength);
    container.generatorParams.skosHeightLeft = mmToNm(p.skosHeightLeft);
    container.generatorParams.skosHeightRight = mmToNm(p.skosHeightRight);
    container.generatorParams.skosSlant = p.skosSlant;
    if (p.singleLength != null) container.generatorParams.singleLength = mmToNm(p.singleLength);
    if (p.uskokGapStart != null) container.generatorParams.uskokGapStart = mmToNm(p.uskokGapStart);
    if (p.uskokGapEnd != null) container.generatorParams.uskokGapEnd = mmToNm(p.uskokGapEnd);

    const planParts = buildCombinedPlan(container);
    const activeIds = new Set<string>();

    for (const part of planParts) {
        let panel = cntNode.children
            .map((c: any) => c.domainData)
            .find((d: any) => d && !isManualPanel(d) && (d as any).key === part.key);

        let panelNode = panel ? document.findNode(panel.id) : null;

        if (panel && panelNode) {
            applyPartToPanel(panel, part);
            panelNode.name = part.name;
            panelNode.setLocalTransform(
                new Vec3(mmToNm(part.loc.x), mmToNm(part.loc.y), mmToNm(part.loc.z)),
                rotFromPart(part),
            );
        } else {
            const { bbWidth, bbHeight, bbThickness } = resolvePanelDimsMm(part);
            panel = new PanelModel({
                width: mmToNm(bbWidth),
                height: mmToNm(bbHeight),
                thickness: mmToNm(bbThickness),
                role: part.role,
                name: part.name,
                color: part.color || { r: 0.88, g: 0.88, b: 0.86 },
            });
            applyPartToPanel(panel, part);
            panelNode = CADNode.create(NodeType.PART, panel.name, panel.id);
            panelNode.domainData = panel;
            panelNode.setLocalTransform(
                new Vec3(mmToNm(part.loc.x), mmToNm(part.loc.y), mmToNm(part.loc.z)),
                rotFromPart(part),
            );
            document.addNode(container.id, panelNode);
        }
        activeIds.add(panel.id);
    }

    for (const child of [...cntNode.children]) {
        if (child.nodeType !== NodeType.PART) continue;
        const d = child.domainData as any;
        if (isManualPanel(d)) continue;
        if (!isWallPart(d) && (d as any)?.key == null) continue;
        if (!activeIds.has(d?.id)) {
            document.removeNode(child.id);
        }
    }

    return true;
}

export function syncAllSmartWalls(doc: any, containers: any[]): void {
    for (const c of containers) {
        if (isSmartWallContainer(c)) {
            rebuildSmartWall(c, doc);
        }
    }
}
