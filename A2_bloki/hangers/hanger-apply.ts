/**
 * Montaż pary zawieszek Camaro w górnych tylnych rogach wykrytej wnęki.
 * Nie dodaje formatek — hierarchia: SmartParts → Part → FEATURE (cuts);
 * HARDWARE/GLB tylko opcjonalnie, gdy Part ma model.
 *
 * Drzewo (jak Bloki): jeden główny ASSEMBLY „Zawieszki_*”, w środku L/R.
 * Grupa = gabaryt wnęki (jak kontener Bloku), zawieszki lokalnie względem grupy.
 */
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { AddNodeCommand } from '../../A1_core/commands/add-node-command.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { findPanelNodeByRef, getPanelFaceCoordinate } from '../../A2_bloki/01_bloki-core.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import type { DetectedBay } from '../../A2_bloki/02_bloki-bay-detector.js';
import { getHangerOrUndefined } from '../../B1_biblioteka/index.js';
import {
    SMARTPART_HANGER_TYPE,
    SMARTPART_HANGERS_GROUP_TYPE,
    type HangerSide,
    type HangerTemplateItem,
} from './hanger-types.js';
import { buildHangerGlbMesh } from './hanger-mesh.js';
import { SmartPartCutModel } from './smartpart-cut-model.js';
import {
    initialSmartPartParamValues,
    resolveSmartPartParams,
    type SmartPartParamValues,
} from '../../S5_studio/smartpart-params.js';
import {
    cutOrientFromRefs,
    type SmartPartPackageDefinition,
} from '../../S5_studio/smartpart-studio-types.js';
import {
    applySmartPartCutIntents,
    bayFrameFromDetectedBay,
    bayFrameFromDocument,
    bayWallRefsFromCustomReferences,
    computeSmartPartCutIntents,
    customReferencesFromDetectedBay,
    resolveStudioPlacementInContainerMm,
    resolveClassicHangerInContainerMm,
    resolveStudioPlacementWorldMm,
    resolveCutPlacementInPartLcsMm,
    type BayWallRefs,
    type SmartPartBayFrameMm,
} from './smartpart-bay-placement.js';
export interface HangerCornerPoseMm {
    side: HangerSide;
    /** Punkt styku 3 WEWNĘTRZNYCH lic (bok + plecy + wieniec) — wewnątrz wnęki */
    worldMm: { x: number; y: number; z: number };
    /** Formatki styku — do nawiertów / BOM */
    faces: {
        sidePanelId?: string;
        backPanelId?: string;
        topPanelId?: string;
    };
    /** Bryła SmartParta ze Studio (tylko dla SmartPartów z definition.parts) */
    part?: any;
}
/**
 * Róg montażowy zawieszki = styk 3 ścian WEWNĄTRZ wnęki:
 *   - boczek (L lub R)
 *   - plecy
 *   - wieniec górny
 *
 * bay.boundary.*.planeCoordMm z bloki-bay-detector to już środek WEWNĘTRZNEGO lica
 * (hit po normalnej skierowanej do wnęki) — nie dodajemy pół grubości płyty.
 * from_* z JSON = dodatkowe odsunięcie w głąb światła (0 = na samym styku 3 ścian).
 */
export function computeHangerCornerPoses(
    bay: DetectedBay,
    tpl: HangerTemplateItem,
    _document?: any | null,
): HangerCornerPoseMm[] {
    const c = bay.centerWorldMm;
    const hw = bay.boundsMm.width / 2;
    const hh = bay.boundsMm.height / 2;
    const hd = bay.boundsMm.depth / 2;
    const b = bay.boundary;
    const leftX = b?.left?.planeCoordMm ?? (c.x - hw);
    const rightX = b?.right?.planeCoordMm ?? (c.x + hw);
    // W bloki-bay-detector: przód = mniejszy Y, plecy = większy Y
    const backPlaneY = b?.back?.planeCoordMm ?? (c.y + hd);
    const frontPlaneY = b?.front?.planeCoordMm ?? b?.frontPlaneYMm ?? (c.y - hd);
    const topZ = b?.top?.planeCoordMm ?? (c.z + hh);
    const bottomZ = b?.bottom?.planeCoordMm ?? (c.z - hh);
    const xL = Math.min(leftX, rightX);
    const xR = Math.max(leftX, rightX);
    const zTop = Math.max(topZ, bottomZ);
    const zBottom = Math.min(topZ, bottomZ);
    const fromTop = Math.max(0, tpl.fromTopMm);
    const fromBack = Math.max(0, tpl.fromBackMm);
    const fromSide = Math.max(0, tpl.fromSideMm);
    // Kierunek od pleców w głąb wnęki (w stronę przodu)
    const backToFront = Math.sign(frontPlaneY - backPlaneY) || -1;
    const leftIsLeftBoundary = (b?.left?.planeCoordMm ?? leftX) <= (b?.right?.planeCoordMm ?? rightX);
    const sidePanelL = leftIsLeftBoundary ? b?.left?.nodeId : b?.right?.nodeId;
    const sidePanelR = leftIsLeftBoundary ? b?.right?.nodeId : b?.left?.nodeId;
    const backPanelId = b?.back?.nodeId;
    const topPanelId = b?.top?.nodeId;
    // SmartPart ze Studio: każda bryła liczona od wybranych ścian wnęki (refX/refY/refZ + offsety)
    const parts = smartPartBodies(tpl.definition);
    if (parts.length > 0) {
        const frame = bayFrameFromDetectedBay(bay);
        return computeSmartPartPartPoses(frame, parts, {
            sidePanelL, sidePanelR, backPanelId, topPanelId,
        });
    }
    // Standardowe okucie bez definicji SmartPart (np. Camaro 806)
    const sides: HangerSide[] = tpl.pair ? ['L', 'R'] : ['L'];
    return sides.map((side) => {
        const x = side === 'L' ? xL + fromSide : xR - fromSide;
        const y = backPlaneY + backToFront * fromBack;
        const z = zTop - fromTop;
        return {
            side,
            worldMm: { x, y, z },
            faces: {
                sidePanelId: side === 'L' ? sidePanelL : sidePanelR,
                backPanelId,
                topPanelId,
            },
        };
    });
}
/** Bryły SmartParta ze Studio (parts; partBody = zgodność z pakietami 1-bryłowymi). */
export function smartPartBodies(definition: any): any[] {
    if (Array.isArray(definition?.parts) && definition.parts.length > 0) return definition.parts;
    if (definition?.partBody) return [definition.partBody];
    return [];
}
/**
 * Cięcia należące do danego Parta.
 * Bez partId przy multi-part NIE doklejamy do Part1 (to dawało „3 walce zamiast 2”).
 */
export function smartPartCutsForPart(definition: any, partId: string | undefined, partIndex: number): any[] {
    const cuts = Array.isArray(definition?.cuts) ? definition.cuts : [];
    const bodies = smartPartBodies(definition);
    const owner = partId ? bodies.find((p: any) => p?.id === partId) : bodies[partIndex];
    if (owner?.frozen === true) return [];
    return cuts.filter((c: any) => {
        if (c?.frozen === true) return false;
        if (c.partId) return c.partId === partId;
        return bodies.length <= 1 && partIndex === 0;
    });
}
function cutDomainDimsNm(cut: any): { width: number; height: number; depth: number } {
    if (cut?.type === 'HOLE') {
        const d = mmToNm(Math.max(1, Number(cut.diameterMm) || 8));
        const l = mmToNm(Math.max(1, Number(cut.lengthMm) || 24));
        const { axis } = cutOrientFromRefs(cut);
        if (axis === 'X') return { width: l, height: d, depth: d };
        if (axis === 'Y') return { width: d, height: l, depth: d };
        return { width: d, height: d, depth: l };
    }
    return {
        width: mmToNm(Math.max(1, Number(cut.widthMm) || 16)),
        height: mmToNm(Math.max(1, Number(cut.heightMm) || 32)),
        depth: mmToNm(Math.max(1, Number(cut.depthMm) || 15)),
    };
}
/**
 * Pozycje (środki) brył SmartParta w świecie CAD — od ścian wnęki wybranych w Studio.
 * Strona L/R: z refX; dla CENTER — po której stronie osi wnęki leży bryła.
 */
export function computeSmartPartPartPoses(
    frame: SmartPartBayFrameMm,
    parts: any[],
    faces: { sidePanelL?: string; sidePanelR?: string; backPanelId?: string; topPanelId?: string },
): HangerCornerPoseMm[] {
    const midX = (frame.xL + frame.xR) / 2;
    return parts.map((part) => {
        const worldMm = resolveStudioPlacementWorldMm(frame, part);
        const refX = typeof part?.refX === 'string' ? part.refX.toUpperCase() : 'CENTER';
        const side: HangerSide = refX === 'LEFT' ? 'L'
            : refX === 'RIGHT' ? 'R'
                : (worldMm.x <= midX ? 'L' : 'R');
        return {
            side,
            worldMm,
            faces: {
                sidePanelId: side === 'L' ? faces.sidePanelL : faces.sidePanelR,
                backPanelId: faces.backPanelId,
                topPanelId: faces.topPanelId,
            },
            part,
        };
    });
}
/**
 * Tworzy grupę zawieszek w wykrytej wnęce (jeden wpis w drzewie + L/R w środku).
 * @returns główny węzeł grupy (albo null)
 */
export function createSmartPartHangersInBay(
    document: any,
    bay: DetectedBay,
    template: HangerTemplateItem,
): CADNode | null {
    if (!document || !bay || !template) return null;
    const hw = getHangerOrUndefined(template.id);
    const parentId = bay.parentCabinetId || document.rootNode?.id;
    if (!parentId) return null;
    const parentNode = document.findNode(parentId) as CADNode | null;
    if (!parentNode) return null;
    // Głęboka kopia — resolve nie może dzielić parts[] z katalogiem / sourceDefinition
    const sourceDefinition = template.definition
        ? (JSON.parse(JSON.stringify(template.definition)) as SmartPartPackageDefinition)
        : undefined;
    // Start od geometrii (offsety z Parta), nie od stale default_mm parametru
    const paramValues: SmartPartParamValues = sourceDefinition
        ? initialSmartPartParamValues(sourceDefinition)
        : {};
    let workingDefinition = sourceDefinition;
    if (sourceDefinition && Array.isArray(sourceDefinition.parameters) && sourceDefinition.parameters.length > 0) {
        try {
            workingDefinition = resolveSmartPartParams(sourceDefinition, paramValues);
        } catch (err) {
            console.warn('[HangerApply] resolveSmartPartParams:', err);
            workingDefinition = sourceDefinition;
        }
    }
    const templateForPose: HangerTemplateItem = workingDefinition
        ? { ...template, definition: workingDefinition }
        : template;

    const poses = computeHangerCornerPoses(bay, templateForPose, document);

    if (poses.length === 0) return null;

    const isSmartPart = smartPartBodies(workingDefinition).length > 0;
    const groupName = isSmartPart
        ? `SmartParts_${template.name}`
        : `Zawieszki_${template.name}`;
    const bayFrame = bayFrameFromDetectedBay(bay);
    const groupContainer = new ContainerModel({
        name: groupName,
        // Wymiary z ramki ścian (boundary), nie z boundsMm — ta sama semantyka co placement TOP/LEFT/FRONT
        width: mmToNm(bayFrame.widthMm),
        height: mmToNm(bayFrame.heightMm),
        depth: mmToNm(bayFrame.depthMm),
    });
    (groupContainer as any).role = 'SMARTPART_HANGERS';
    (groupContainer as any).source = 'smartpart';
    const customReferences = customReferencesFromDetectedBay(bay);
    groupContainer.generatorParams = {
        type: SMARTPART_HANGERS_GROUP_TYPE,
        partType: 'HANGERS',
        hardwareId: template.id,
        pair: template.pair,
        fromTopMm: template.fromTopMm,
        fromBackMm: template.fromBackMm,
        fromSideMm: template.fromSideMm,
        glbModelPath: template.glbModelPath,
        parentCabinetId: bay.parentCabinetId,
        parentContainerId: bay.parentCabinetId,
        bayCenterMm: { ...bay.centerWorldMm },
        isSmartPart,
        // definition = po resolve (offsety z parametrów); source = surowy pakiet do kolejnych resolve
        definition: isSmartPart ? (workingDefinition || sourceDefinition) : undefined,
        sourceDefinition: isSmartPart ? sourceDefinition : undefined,
        paramValues: isSmartPart ? paramValues : undefined,
        /** Jak Blok: ściany wnęki edytowalne w zakładce „Ściany referencyjne” (BlokiUI). */
        boundary: bay.boundary,
        detectedBay: bay,
        side_references_bloki: 'INNER',
        customReferences,
        disabledReferences: {},
        offsets: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 },
        width_mm: bayFrame.widthMm,
        depth_mm: bayFrame.depthMm,
        height_mm: bayFrame.heightMm,
        maxHeight: bayFrame.heightMm,
        /** Wewnętrzna ramka SmartPart (nodeId) — sync z customReferences przy update. */
        bayWallRefs: bayFrame.refs,
    };
    const groupNode = CADNode.create(NodeType.ASSEMBLY, groupName, groupContainer.id);
    groupNode.domainData = groupContainer;
    // Jak Bloki: lokalne Z=0 grupy = spód wnęki, XY = środek wnęki
    const cX = (bayFrame.xL + bayFrame.xR) / 2;
    const cY = (bayFrame.backY + bayFrame.frontY) / 2;
    let groupLocalNm = new Vec3(
        mmToNm(cX),
        mmToNm(cY),
        mmToNm(bayFrame.zBottom),
    );
    if (parentNode.id !== document.rootNode?.id) {
        const parentWorldInv = parentNode.getWorldMatrix().invert();
        groupLocalNm = parentWorldInv.transformPoint(groupLocalNm);
    }
    groupNode.setLocalTransform(groupLocalNm, Quat.IDENTITY);
    const hangerNodes: CADNode[] = [];
    for (const pose of poses) {
        const part = pose.part;
        const partW = Number(part?.widthMm) || template.widthMm;
        const partH = Number(part?.heightMm) || template.heightMm;
        const partD = Number(part?.depthMm) || template.depthMm;
        const partLabel = String(part?.name || part?.id || pose.side);
        // GLB opcjonalny: part.glbPath > template.glbModelPath; brak = tylko Part + cuts
        const partGlbPath = String(part?.glbPath || template.glbModelPath || '').trim();
        const container = new ContainerModel({
            name: isSmartPart ? `Part_${partLabel}` : `Zawieszka_${pose.side}`,
            width: mmToNm(partW),
            height: mmToNm(partH),
            depth: mmToNm(partD),
        });
        (container as any).role = 'SMARTPART_HANGER';
        (container as any).source = 'smartpart';
        container.generatorParams = {
            type: SMARTPART_HANGER_TYPE,
            partType: 'HANGER',
            hardwareId: template.id,
            side: pose.side,
            fromTopMm: template.fromTopMm,
            fromBackMm: template.fromBackMm,
            fromSideMm: template.fromSideMm,
            widthMm: partW,
            heightMm: partH,
            depthMm: partD,
            glbModelPath: partGlbPath || undefined,
            definition: workingDefinition || template.definition,
            part,
            isSmartPart,
            parentCabinetId: bay.parentCabinetId,
            bayCenterMm: { ...bay.centerWorldMm },
            groupId: groupContainer.id,
            mountOrigin: isSmartPart ? 'CENTER' : 'MOUNT_CORNER',
            mountFaces: {
                side: pose.faces.sidePanelId,
                back: pose.faces.backPanelId,
                top: pose.faces.topPanelId,
            },
        };
        const cntNode = CADNode.create(NodeType.ASSEMBLY, container.name, container.id);
        cntNode.domainData = container;
        const bayDims = {
            widthMm: bayFrame.widthMm,
            heightMm: bayFrame.heightMm,
            depthMm: bayFrame.depthMm,
        };
        const localPosMm = isSmartPart && part
            ? resolveStudioPlacementInContainerMm(bayDims, part)
            : resolveClassicHangerInContainerMm(bayDims, template, pose.side);

        const localToGroupNm = new Vec3(
            mmToNm(localPosMm.x),
            mmToNm(localPosMm.y),
            mmToNm(localPosMm.z),
        );
        cntNode.setLocalTransform(localToGroupNm, Quat.IDENTITY);
        // HARDWARE tylko gdy jest model GLB — features idą zawsze bezpośrednio pod Part
        if (partGlbPath) {
            const hwNode = CADNode.create(
                NodeType.HARDWARE,
                `Model_${partLabel}`,
                `hw_${container.id}`,
            );
            const hwData: Record<string, any> = {
                id: `hw_${container.id}`,
                name: `Model_${partLabel}`,
                role: 'HANGER',
                nodeType: 'HARDWARE',
                hardwareType: 'HANGER',
                hardwareId: template.id,
                side: pose.side,
                units: 'mm',
                art_no: hw?.art_no,
                price_id: hw?.price_id || `HANGER_${template.id}`,
                custom_properties: {
                    fromTopMm: template.fromTopMm,
                    fromBackMm: template.fromBackMm,
                    fromSideMm: template.fromSideMm,
                    glbModelPath: partGlbPath,
                    mountFaces: pose.faces,
                    groupId: groupContainer.id,
                },
            };
            hwData.toJSON = function toJSON() {
                const { toJSON: _t, ...rest } = this as any;
                return { ...rest };
            };
            hwNode.domainData = hwData as any;
            cntNode.addChild(hwNode);
        }
        // Węzły cięć (walce / kieszenie) — dzieci Parta; tną formatki korpusu przez applySmartPartCutsToBay
        if (isSmartPart && workingDefinition) {
            const bodies = smartPartBodies(workingDefinition);
            const partIndex = Math.max(0, bodies.findIndex((p: any) => p?.id === part?.id));
            const cuts = smartPartCutsForPart(workingDefinition, part?.id, partIndex);
            for (const cut of cuts) {
                const cutDimsNm = cutDomainDimsNm(cut);
                const cutKind = String(cut.type || '').toUpperCase() === 'POCKET' ? 'Kieszen' : 'Otwor';
                const cutLabel = cut.name || `${cutKind}_${cut.id}`;
                const cutNode = CADNode.create(
                    NodeType.FEATURE,
                    cutLabel,
                    `cut_${container.id}_${cut.id}`,
                );
                cutNode.domainData = new SmartPartCutModel({
                    id: cutNode.id,
                    name: cutLabel,
                    cutType: cut.type,
                    width: cutDimsNm.width,
                    height: cutDimsNm.height,
                    depth: cutDimsNm.depth,
                    generatorParams: {
                        type: 'smartpart_cut',
                        cut,
                        hardwareId: template.id,
                        groupId: groupContainer.id,
                        side: pose.side,
                        partId: part?.id,
                    },
                });
                // Lokalne LCS Parta (CAD mm → nm) — z referencji cięcia do ścianek Parta
                const cutLcs = resolveCutPlacementInPartLcsMm(part, cut);
                cutNode.setLocalTransform(
                    new Vec3(
                        mmToNm(cutLcs.xMm),
                        mmToNm(cutLcs.yMm),
                        mmToNm(cutLcs.zMm),
                    ),
                    Quat.IDENTITY,
                );
                cntNode.addChild(cutNode);
            }
        }
        groupNode.addChild(cntNode);
        hangerNodes.push(cntNode);
    }
    const label = `Wstawienie Zawieszki: ${template.name}`;
    const cmdHist = ContextManager.instance?.commandHistory;
    const insertCmd = new AddNodeCommand(parentId, groupNode, undefined, label);
    if (cmdHist) {
        cmdHist.execute(insertCmd);
    } else {
        document.addNode(parentId, groupNode);
    }
    if (isSmartPart && Array.isArray(workingDefinition?.cuts) && workingDefinition.cuts.length > 0) {
        applySmartPartCutsToBay(document, bay, workingDefinition, groupContainer.id);
        if (typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
    }
    if (typeof window !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
        if (typeof (window as any).__rebuildGeometry === 'function') {
            (window as any).__rebuildGeometry('Zawieszki Camaro');
        }
    }
    return groupNode;
}
/**
 * Aplikuje cechy cięć (otwory / kieszenie) ze SmartParta do formatek wnęki.
 */
export function applySmartPartCutsToBay(
    document: any,
    bay: DetectedBay,
    definition: any,
    groupContainerId: string,
): boolean {
    if (!document || !bay || !definition) return false;
    const frame = bayFrameFromDetectedBay(bay);
    const candidateNodeIds = Object.values(frame.refs).map((r) => r.nodeId);
    const intents = computeSmartPartCutIntents(document, frame, definition, groupContainerId);
    return applySmartPartCutIntents(document, groupContainerId, candidateNodeIds, intents);
}
function panelRoleText(node: any): string {
    return String(node?.domainData?.role || node?.name || node?.domainData?.name || '').toUpperCase();
}

/** Wieniec / półka / dno — nie bok (środek boku na Z ≈ środek korpusu). */
function isHorizontalBayPanel(node: any): boolean {
    if (!node?.domainData || node.domainData.type === 'container') return false;
    const role = panelRoleText(node);
    return (
        role.includes('TOP')
        || role.includes('BOTTOM')
        || role.includes('WIENIEC')
        || role.includes('SHELF')
        || role.includes('PÓŁKA')
        || role.includes('POLKA')
        || role.includes('GORN')
        || role.includes('GÓRN')
        || role.includes('DOLN')
    );
}

function findCrownPanel(cabinetNode: any, which: 'top' | 'bottom'): { node: any; face: string } | null {
    const nodes: any[] = [];
    const walk = (n: any) => {
        for (const c of n?.children || []) {
            nodes.push(c);
            walk(c);
        }
    };
    walk(cabinetNode);
    let best: any = null;
    let bestZ = which === 'top' ? -Infinity : Infinity;
    for (const n of nodes) {
        if (!isHorizontalBayPanel(n)) continue;
        const role = panelRoleText(n);
        const isTop = role.includes('TOP') || role.includes('WIENIEC_G') || role.includes('GORN') || role.includes('GÓRN');
        const isBottom = role.includes('BOTTOM') || role.includes('WIENIEC_D') || role.includes('DOLN');
        if (which === 'top' && isBottom && !isTop) continue;
        if (which === 'bottom' && isTop && !isBottom) continue;
        if (which === 'top' && !isTop && !role.includes('WIENIEC') && !role.includes('SHELF') && !role.includes('POLKA') && !role.includes('PÓŁKA')) continue;
        if (which === 'bottom' && !isBottom && !role.includes('WIENIEC') && !role.includes('SHELF') && !role.includes('POLKA') && !role.includes('PÓŁKA')) continue;
        const z = nmToMm(Number(n.localMatrix?.data?.[14]) || 0);
        if (which === 'top' ? z > bestZ : z < bestZ) {
            bestZ = z;
            best = n;
        }
    }
    if (!best) return null;
    // FACE_Z_PLUS: getPanelFaceCoordinate bierze wewnętrzne lico wieńca (sufit / podłoga wnęki)
    return { node: best, face: 'FACE_Z_PLUS' };
}

const HANGER_REF_AXIS: Record<string, { axis: 'x' | 'y' | 'z'; isMax: boolean }> = {
    xMin: { axis: 'x', isMax: false },
    xMax: { axis: 'x', isMax: true },
    yMin: { axis: 'y', isMax: false },
    yMax: { axis: 'y', isMax: true },
    zMin: { axis: 'z', isMax: false },
    zMax: { axis: 'z', isMax: true },
};

/**
 * Ramka głównego kontenera SmartParts — te same ściany i offsety co kontener Bloku
 * (`customReferences` + `offsets` + `getPanelFaceCoordinate`).
 * Współrzędne w układzie lokalnym korpusu [mm]. Z=0 kontenera = spód (zMin).
 */
export function resolveHangersReferenceBoxMm(
    groupContainer: any,
    document: any,
    /** Brakujące osie X/Y (układ korpusu, mm). Z stąd nie uzupełniamy — to zamrożona wysokość z chwili wstawienia. */
    fallbackXY?: { xMin: number; xMax: number; yMin: number; yMax: number } | null,
): {
    widthMm: number; heightMm: number; depthMm: number;
    posX: number; posY: number; posZ: number;
    xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number;
} | null {
    const gp = groupContainer?.generatorParams;
    const refs = gp?.customReferences;
    if (!refs || !document) return null;
    const cabinetNode = gp.parentContainerId ? document.findNode(gp.parentContainerId) : null;
    if (!cabinetNode) return null;
    const disabled = gp.disabledReferences || {};
    const offsets = gp.offsets || {};

    const coord = (sideKey: string): number | null => {
        if (disabled[sideKey]) return null;
        const spec = HANGER_REF_AXIS[sideKey];
        if (!spec) return null;
        const off = parseFloat(offsets[sideKey]) || 0;
        const ref = refs[sideKey];
        let panelNode = ref ? findPanelNodeByRef(ref, cabinetNode, document) : null;
        let face = ref?.face;
        // Góra/dół: wyłącznie wieniec/półka. Bok jako zMax daje Z≈środek korpusu → Part TOP ląduje „na środku”.
        if (sideKey === 'zMin' || sideKey === 'zMax') {
            if (!isHorizontalBayPanel(panelNode)) {
                const crown = findCrownPanel(cabinetNode, sideKey === 'zMax' ? 'top' : 'bottom');
                if (crown) {
                    panelNode = crown.node;
                    face = crown.face;
                }
            } else if (!face) {
                face = 'FACE_Z_PLUS';
            }
        }
        const dd = panelNode?.domainData;
        if (!dd || dd.type === 'container' || !face) {
            // Przód bez płyty: zewnętrzne lico korpusu (−depth/2), jak update_bloki_core
            if (sideKey === 'yMin') {
                const cabDepth = nmToMm(Number(cabinetNode.domainData?.depth) || 0);
                if (cabDepth > 10) return -cabDepth / 2 + off;
            }
            return null;
        }
        const raw = getPanelFaceCoordinate(dd, panelNode, cabinetNode, face, spec.axis, null, spec.isMax);
        if (!Number.isFinite(raw)) return null;
        return spec.isMax ? raw - off : raw + off;
    };

    let xMin = coord('xMin');
    let xMax = coord('xMax');
    let yMin = coord('yMin');
    let yMax = coord('yMax');
    let zMin = coord('zMin');
    let zMax = coord('zMax');
    // Oba odczyty w tym samym miejscu (środek boku) — wysokość się nie liczy, bierz wieńce korpusu
    if (zMin != null && zMax != null && Math.abs(zMax - zMin) < 40) {
        zMin = null;
        zMax = null;
    }
    if (zMin == null || zMax == null) {
        const bot = findCrownPanel(cabinetNode, 'bottom');
        const top = findCrownPanel(cabinetNode, 'top');
        if (bot && zMin == null) {
            const raw = getPanelFaceCoordinate(bot.node.domainData, bot.node, cabinetNode, bot.face, 'z', null, false);
            const off = parseFloat(offsets.zMin) || 0;
            if (Number.isFinite(raw)) zMin = raw + off;
        }
        if (top && zMax == null) {
            const raw = getPanelFaceCoordinate(top.node.domainData, top.node, cabinetNode, top.face, 'z', null, true);
            const off = parseFloat(offsets.zMax) || 0;
            if (Number.isFinite(raw)) zMax = raw - off;
        }
    }

    const widthParam = parseFloat(gp.width_mm) || 0;
    const depthParam = parseFloat(gp.depth_mm) || 0;
    const heightParam = parseFloat(gp.maxHeight || gp.height_mm) || 0;
    if (xMin == null && disabled.xMin && xMax != null && widthParam > 0) xMin = xMax - widthParam;
    if (xMax == null && disabled.xMax && xMin != null && widthParam > 0) xMax = xMin + widthParam;
    if (yMin == null && disabled.yMin && yMax != null && depthParam > 0) yMin = yMax - depthParam;
    if (yMax == null && disabled.yMax && yMin != null && depthParam > 0) yMax = yMin + depthParam;
    if (zMin == null && disabled.zMin && zMax != null && heightParam > 0) zMin = zMax - heightParam;
    if (zMax == null && disabled.zMax && zMin != null && heightParam > 0) zMax = zMin + heightParam;

    if (fallbackXY) {
        if (xMin == null) xMin = fallbackXY.xMin;
        if (xMax == null) xMax = fallbackXY.xMax;
        if (yMin == null) yMin = fallbackXY.yMin;
        if (yMax == null) yMax = fallbackXY.yMax;
    }

    if ([xMin, xMax, yMin, yMax, zMin, zMax].some((v) => v == null || !Number.isFinite(v as number))) {
        return null;
    }
    const xLo = Math.min(xMin!, xMax!);
    const xHi = Math.max(xMin!, xMax!);
    const yLo = Math.min(yMin!, yMax!);
    const yHi = Math.max(yMin!, yMax!);
    const zLo = Math.min(zMin!, zMax!);
    const zHi = Math.max(zMin!, zMax!);
    const widthMm = xHi - xLo;
    const depthMm = yHi - yLo;
    const heightMm = zHi - zLo;
    if (widthMm < 10 || depthMm < 10 || heightMm < 10) return null;
    return {
        widthMm, depthMm, heightMm,
        xMin: xLo, xMax: xHi, yMin: yLo, yMax: yHi, zMin: zLo, zMax: zHi,
        posX: (xLo + xHi) / 2,
        posY: (yLo + yHi) / 2,
        posZ: zLo,
    };
}

function cabinetLocalToWorldMm(cabinetNode: any, x: number, y: number, z: number) {
    if (cabinetNode && typeof cabinetNode.localToWorld === 'function') {
        const w = cabinetNode.localToWorld(new Vec3(mmToNm(x), mmToNm(y), mmToNm(z)));
        return { x: nmToMm(w.x), y: nmToMm(w.y), z: nmToMm(w.z) };
    }
    return { x, y, z };
}

/**
 * Przelicza pozycje SmartPartów i otwory we wnęce po zmianie wymiarów korpusu.
 */
export function updateSmartPartHangersGroup(groupNode: CADNode, document: any): boolean {
    if (!groupNode || !document) return false;
    const groupContainer: any = groupNode.domainData;
    const gp = groupContainer?.generatorParams;
    if (!gp) return false;
    // Sync bayWallRefs ← customReferences (BlokiUI / ten sam schemat co Blok)
    if (gp.customReferences) {
        gp.bayWallRefs = bayWallRefsFromCustomReferences(
            document,
            gp.customReferences,
            gp.bayWallRefs,
        );
    }
    const wallRefs: BayWallRefs | undefined = gp.bayWallRefs;
    if (!wallRefs && !gp.detectedBay && !gp.customReferences) return false;

    if (!gp.parentContainerId || !document.findNode(gp.parentContainerId)) {
        const parent = groupNode.parent;
        if (parent && parent.id !== document.rootNode?.id) gp.parentContainerId = parent.id;
    }
    const cabinetNode = gp.parentContainerId ? document.findNode(gp.parentContainerId) : null;

    const bayFrame = gp.detectedBay ? bayFrameFromDetectedBay(gp.detectedBay) : null;
    let frame = wallRefs ? bayFrameFromDocument(document, wallRefs) : null;
    if (!frame && bayFrame) frame = bayFrame;

    let fallbackXY: { xMin: number; xMax: number; yMin: number; yMax: number } | null = null;
    if (frame && cabinetNode && typeof cabinetNode.worldToLocal === 'function') {
        const toCab = (x: number, y: number, z: number) => {
            const p = cabinetNode.worldToLocal(new Vec3(mmToNm(x), mmToNm(y), mmToNm(z)));
            return { x: nmToMm(p.x), y: nmToMm(p.y) };
        };
        const a = toCab(frame.xL, frame.frontY, frame.zBottom);
        const b = toCab(frame.xR, frame.backY, frame.zTop);
        fallbackXY = {
            xMin: Math.min(a.x, b.x),
            xMax: Math.max(a.x, b.x),
            yMin: Math.min(a.y, b.y),
            yMax: Math.max(a.y, b.y),
        };
    }
    const refBox = resolveHangersReferenceBoxMm(groupContainer, document, fallbackXY);
    if (!frame && !refBox) return false;

    const parentNode = groupNode.parent;
    const offsets = gp.offsets || {};
    const disabled = gp.disabledReferences || {};

    if (refBox) {
        const w0 = cabinetLocalToWorldMm(cabinetNode, refBox.xMin, refBox.yMin, refBox.zMin);
        const w1 = cabinetLocalToWorldMm(cabinetNode, refBox.xMax, refBox.yMax, refBox.zMax);
        const xL = Math.min(w0.x, w1.x);
        const xR = Math.max(w0.x, w1.x);
        const zBottom = Math.min(w0.z, w1.z);
        const zTop = Math.max(w0.z, w1.z);
        const frontY = Math.min(w0.y, w1.y);
        const backY = Math.max(w0.y, w1.y);
        const base = frame || bayFrame;
        frame = {
            xL, xR, zBottom, zTop, frontY, backY,
            backToFront: (frontY - backY >= 0 ? 1 : -1) as 1 | -1,
            widthMm: refBox.widthMm,
            heightMm: refBox.heightMm,
            depthMm: refBox.depthMm,
            refs: base?.refs || gp.bayWallRefs || {},
        };
        groupContainer.width = mmToNm(refBox.widthMm);
        groupContainer.height = mmToNm(refBox.heightMm);
        groupContainer.depth = mmToNm(refBox.depthMm);
        gp.width_mm = refBox.widthMm;
        gp.depth_mm = refBox.depthMm;
        gp.height_mm = refBox.heightMm;
        gp.maxHeight = refBox.heightMm;

        let groupLocalNm = new Vec3(mmToNm(refBox.posX), mmToNm(refBox.posY), mmToNm(refBox.posZ));
        if (cabinetNode && parentNode && parentNode.id !== cabinetNode.id && typeof cabinetNode.localToWorld === 'function') {
            const world = cabinetNode.localToWorld(groupLocalNm);
            groupLocalNm = parentNode.id !== document.rootNode?.id
                ? parentNode.getWorldMatrix().invert().transformPoint(world)
                : world;
        }
        groupNode.setLocalTransform(groupLocalNm, Quat.IDENTITY);
    } else if (frame) {
        // Bez refBox: i tak zastosuj offsety ścian (zMax/zMin) — inaczej otwór/Part ignorują offset góry
        let zBottom = frame.zBottom;
        let zTop = frame.zTop;
        let xL = frame.xL;
        let xR = frame.xR;
        let frontY = frame.frontY;
        let backY = frame.backY;
        if (!disabled.zMin) zBottom += parseFloat(offsets.zMin) || 0;
        if (!disabled.zMax) zTop -= parseFloat(offsets.zMax) || 0;
        if (!disabled.xMin) xL += parseFloat(offsets.xMin) || 0;
        if (!disabled.xMax) xR -= parseFloat(offsets.xMax) || 0;
        if (!disabled.yMin) frontY += parseFloat(offsets.yMin) || 0;
        if (!disabled.yMax) backY -= parseFloat(offsets.yMax) || 0;
        // Góra/dół z wieńców korpusu (nie ze środka boku) + offset
        if (cabinetNode) {
            const bot = findCrownPanel(cabinetNode, 'bottom');
            const top = findCrownPanel(cabinetNode, 'top');
            if (bot && !disabled.zMin) {
                const raw = getPanelFaceCoordinate(bot.node.domainData, bot.node, cabinetNode, bot.face, 'z', null, false);
                if (Number.isFinite(raw)) {
                    zBottom = cabinetLocalToWorldMm(cabinetNode, 0, 0, raw + (parseFloat(offsets.zMin) || 0)).z;
                }
            }
            if (top && !disabled.zMax) {
                const raw = getPanelFaceCoordinate(top.node.domainData, top.node, cabinetNode, top.face, 'z', null, true);
                if (Number.isFinite(raw)) {
                    zTop = cabinetLocalToWorldMm(cabinetNode, 0, 0, raw - (parseFloat(offsets.zMax) || 0)).z;
                }
            }
        }
        const zLo = Math.min(zBottom, zTop);
        const zHi = Math.max(zBottom, zTop);
        const xLo = Math.min(xL, xR);
        const xHi = Math.max(xL, xR);
        const yLo = Math.min(frontY, backY);
        const yHi = Math.max(frontY, backY);
        frame = {
            ...frame,
            xL: xLo, xR: xHi, zBottom: zLo, zTop: zHi, frontY: yLo, backY: yHi,
            backToFront: (yLo - yHi >= 0 ? 1 : -1) as 1 | -1,
            widthMm: xHi - xLo,
            heightMm: zHi - zLo,
            depthMm: yHi - yLo,
        };
        groupContainer.width = mmToNm(frame.widthMm);
        groupContainer.height = mmToNm(frame.heightMm);
        groupContainer.depth = mmToNm(frame.depthMm);
        gp.width_mm = frame.widthMm;
        gp.depth_mm = frame.depthMm;
        gp.height_mm = frame.heightMm;
        gp.maxHeight = frame.heightMm;
        const cX = (frame.xL + frame.xR) / 2;
        const cY = (frame.backY + frame.frontY) / 2;
        const bottomZ = frame.zBottom;
        let groupLocalNm = new Vec3(mmToNm(cX), mmToNm(cY), mmToNm(bottomZ));
        if (parentNode && parentNode.id !== document.rootNode?.id) {
            const parentWorldInv = parentNode.getWorldMatrix().invert();
            groupLocalNm = parentWorldInv.transformPoint(groupLocalNm);
        }
        groupNode.setLocalTransform(groupLocalNm, Quat.IDENTITY);
    }
    if (!frame) return false;
    // Zapisz płaszczyzny Z kontenera (po offsetach) — otwory i kolejny update czytają tę samą górę SmartParts
    if (gp.bayWallRefs) {
        if (gp.bayWallRefs.bottom) gp.bayWallRefs.bottom = { ...gp.bayWallRefs.bottom, planeCoordMm: frame.zBottom };
        if (gp.bayWallRefs.top) gp.bayWallRefs.top = { ...gp.bayWallRefs.top, planeCoordMm: frame.zTop };
    }
    // Parts ze sourceDefinition/definition — refZ TOP z JSON Studia musi zostać (nie gubić przy merge)
    const bodies = smartPartBodies(gp.definition || gp.sourceDefinition);
    // Part jest dzieckiem grupy (CAD); zbierz też zagnieżdżone (gdy struktura drzewa się rozjechała)
    const partNodes: CADNode[] = [];
    const collectParts = (n: CADNode) => {
        for (const ch of n.children || []) {
            const dd: any = ch.domainData;
            const role = String(dd?.role || '');
            const typ = String(dd?.generatorParams?.type || '');
            if (role === 'SMARTPART_HANGER' || typ === SMARTPART_HANGER_TYPE || dd?.generatorParams?.part) {
                partNodes.push(ch);
            } else {
                collectParts(ch);
            }
        }
    };
    collectParts(groupNode);
    // Aktualizacja pozycji każdego Parta względem ramki kontenera (z offsetami ścian)
    for (const childNode of partNodes) {
        const childContainer: any = childNode.domainData;
        const childGp = childContainer?.generatorParams;
        if (!childGp) continue;
        const oldPart = childGp.part;
        const fromDef = bodies.length > 0
            ? (bodies.find((b: any) => b?.id && b.id === oldPart?.id)
                || bodies.find((b: any) => b?.name && b.name === oldPart?.name)
                || bodies[0])
            : null;
        // Referencje zawsze z definicji JSON; wymiary mogą pochodzić z live Parta
        const part = fromDef
            ? {
                ...oldPart,
                ...fromDef,
                refX: fromDef.refX ?? oldPart?.refX,
                refY: fromDef.refY ?? oldPart?.refY,
                refZ: fromDef.refZ ?? oldPart?.refZ,
                offsetX_mm: fromDef.offsetX_mm ?? oldPart?.offsetX_mm,
                offsetY_mm: fromDef.offsetY_mm ?? oldPart?.offsetY_mm,
                offsetZ_mm: fromDef.offsetZ_mm ?? oldPart?.offsetZ_mm,
            }
            : oldPart;
        const bayDims = {
            widthMm: frame.widthMm,
            heightMm: frame.heightMm,
            depthMm: frame.depthMm,
        };
        const localPosMm = part
            ? resolveStudioPlacementInContainerMm(bayDims, part)
            : resolveClassicHangerInContainerMm(bayDims, {
                fromSideMm: childGp.fromSideMm,
                fromBackMm: childGp.fromBackMm,
                fromTopMm: childGp.fromTopMm,
            }, childGp.side || 'L');

        if (part) {
            childGp.part = part;
        }

        const localToGroupNm = new Vec3(
            mmToNm(localPosMm.x),
            mmToNm(localPosMm.y),
            mmToNm(localPosMm.z),
        );
        childNode.setLocalTransform(localToGroupNm, Quat.IDENTITY);
        // Przelicz lokalne pozycje cięć względem Parta (LCS Part)
        for (const cutChild of childNode.children || []) {
            const cutDd: any = cutChild.domainData;
            const cut = cutDd?.generatorParams?.cut;
            if (!cut || (cutDd?.role !== 'SMARTPART_CUT' || cutDd?.type !== 'smartpart_cut')) continue;
            const cutLcs = resolveCutPlacementInPartLcsMm(part, cut);
            cutChild.setLocalTransform(
                new Vec3(
                    mmToNm(cutLcs.xMm),
                    mmToNm(cutLcs.yMm),
                    mmToNm(cutLcs.zMm),
                ),
                Quat.IDENTITY,
            );
        }
    }
    // Otwory na formatkach: ta sama ramka kontenera SmartParts (góra po offsetach), Part z refZ ze Studia
    const defForCuts = gp.definition || gp.sourceDefinition;
    if (defForCuts && Array.isArray(defForCuts.cuts) && defForCuts.cuts.length > 0) {
        const cutDef = {
            ...defForCuts,
            parts: bodies.length > 0 ? bodies : defForCuts.parts,
            partBody: bodies[0] || defForCuts.partBody,
        };
        const candidateNodeIds = Object.values(frame.refs || {}).map((r: any) => r.nodeId).filter(Boolean);
        const intents = computeSmartPartCutIntents(document, frame, cutDef, groupContainer.id);
        applySmartPartCutIntents(document, groupContainer.id, candidateNodeIds, intents);
    }
    return true;
}


/**
 * Resolve sourceDefinition + paramValues → gp.definition (parts z offsetami z panelu).
 * Wywoływane przy edycji parametru i przed rebuildem geometrii.
 */
export function syncHangerDefinitionFromParams(groupContainer: any): boolean {
    const gp = groupContainer?.generatorParams;
    if (!gp || !gp.isSmartPart) return false;
    const source = (gp.sourceDefinition || gp.definition) as SmartPartPackageDefinition | undefined;
    if (!source) return false;
    // Zachowaj surowy pakiet osobno (nie nadpisuj resolvedem)
    if (!gp.sourceDefinition) {
        gp.sourceDefinition = JSON.parse(JSON.stringify(source));
    }
    const raw = gp.sourceDefinition as SmartPartPackageDefinition;
    const values = (gp.paramValues || {}) as SmartPartParamValues;
    try {
        const resolved = resolveSmartPartParams(raw, values);
        gp.definition = {
            ...raw,
            parts: resolved.parts,
            partBody: resolved.partBody || resolved.parts?.[0],
            cuts: resolved.cuts,
            mainContainer: resolved.mainContainer,
        };
        return true;
    } catch (err) {
        console.warn('[HangerApply] syncHangerDefinitionFromParams:', err);
        return false;
    }
}

/**
 * Tworzy węzeł FEATURE (cięcie SmartParta) pod Partem — 1:1 jak w
 * `createSmartPartHangersInBay` (bez duplikowania identyfikatorów).
 */
function createHangerCutNode(container: any, childGp: any, cut: any): CADNode {
    const cutDimsNm = cutDomainDimsNm(cut);
    const cutKind = String(cut.type || '').toUpperCase() === 'POCKET' ? 'Kieszen' : 'Otwor';
    const cutLabel = cut.name || `${cutKind}_${cut.id}`;
    const cutNode = CADNode.create(
        NodeType.FEATURE,
        cutLabel,
        `cut_${container.id}_${cut.id}`,
    );
    cutNode.domainData = new SmartPartCutModel({
        id: cutNode.id,
        name: cutLabel,
        cutType: cut.type,
        width: cutDimsNm.width,
        height: cutDimsNm.height,
        depth: cutDimsNm.depth,
        generatorParams: {
            type: 'smartpart_cut',
            cut,
            hardwareId: childGp.hardwareId,
            groupId: childGp.groupId,
            side: childGp.side,
            partId: childGp.part?.id,
        },
    });
    const cutLcs = resolveCutPlacementInPartLcsMm(childGp.part, cut);
    cutNode.setLocalTransform(
        new Vec3(
            mmToNm(cutLcs.xMm),
            mmToNm(cutLcs.yMm),
            mmToNm(cutLcs.zMm),
        ),
        Quat.IDENTITY,
    );
    return cutNode;
}

/**
 * Tworzy węzeł-dziecko Part (asembly + opcjonalny HARDWARE + FEATURE cięcia)
 * dla partu dodanego do definicji SmartParta. Pozycję przelicza zaraz po tym
 * `updateSmartPartHangersGroup` (ramka wnęki), stąd transform startowy = 0.
 */
function createHangerPartChildNode(groupContainer: any, part: any): CADNode | null {
    const gp = groupContainer?.generatorParams;
    if (!gp) return null;
    const partW = Number(part?.widthMm) || 0;
    const partH = Number(part?.heightMm) || 0;
    const partD = Number(part?.depthMm) || 0;
    if (!partW || !partH || !partD) return null;
    const partLabel = String(part?.name || part?.id || 'Part');
    const partGlbPath = String(part?.glbPath || gp.glbModelPath || '').trim();
    const container = new ContainerModel({
        name: `Part_${partLabel}`,
        width: mmToNm(partW),
        height: mmToNm(partH),
        depth: mmToNm(partD),
    });
    (container as any).role = 'SMARTPART_HANGER';
    (container as any).source = 'smartpart';
    container.generatorParams = {
        type: SMARTPART_HANGER_TYPE,
        partType: 'HANGER',
        hardwareId: gp.hardwareId,
        side: 'L',
        fromTopMm: gp.fromTopMm,
        fromBackMm: gp.fromBackMm,
        fromSideMm: gp.fromSideMm,
        widthMm: partW,
        heightMm: partH,
        depthMm: partD,
        glbModelPath: partGlbPath || undefined,
        definition: gp.definition,
        part,
        isSmartPart: true,
        parentCabinetId: gp.parentCabinetId,
        bayCenterMm: gp.bayCenterMm ? { ...gp.bayCenterMm } : undefined,
        groupId: groupContainer.id,
        mountOrigin: 'CENTER',
    };
    const node = CADNode.create(NodeType.ASSEMBLY, container.name, container.id);
    node.domainData = container;
    if (partGlbPath) {
        const hwNode = CADNode.create(
            NodeType.HARDWARE,
            `Model_${partLabel}`,
            `hw_${container.id}`,
        );
        const hwData: Record<string, any> = {
            id: `hw_${container.id}`,
            name: `Model_${partLabel}`,
            role: 'HANGER',
            nodeType: 'HARDWARE',
            hardwareType: 'HANGER',
            hardwareId: gp.hardwareId,
            side: 'L',
            units: 'mm',
            price_id: `HANGER_${gp.hardwareId}`,
            custom_properties: {
                fromTopMm: gp.fromTopMm,
                fromBackMm: gp.fromBackMm,
                fromSideMm: gp.fromSideMm,
                glbModelPath: partGlbPath,
                groupId: groupContainer.id,
            },
        };
        hwData.toJSON = function toJSON() {
            const { toJSON: _t, ...rest } = this as any;
            return { ...rest };
        };
        hwNode.domainData = hwData as any;
        node.addChild(hwNode);
    }
    const definition = gp.definition;
    const bodiesForIndex = smartPartBodies(definition);
    const partIndex = Math.max(0, bodiesForIndex.findIndex((b: any) => b?.id === part?.id));
    const cuts = smartPartCutsForPart(definition, part?.id, partIndex);
    for (const cut of cuts) {
        node.addChild(createHangerCutNode(container, container.generatorParams, cut));
    }
    return node;
}

/**
 * Zmiana parametrów panelu (Studio) na grupie zawieszek SmartPart.
 * Resolve bindings → sync parts/cuts → updateSmartPartHangersGroup → rebuild.
 */
export function updateHangerSmartPartParams(
    document: any,
    groupContainer: any,
    nextValues: SmartPartParamValues,
): boolean {
    if (!document || !groupContainer) return false;
    const gp = groupContainer.generatorParams;
    if (!gp || !gp.isSmartPart) return false;
    if (!gp.sourceDefinition && gp.definition) {
        gp.sourceDefinition = JSON.parse(JSON.stringify(gp.definition));
    }
    gp.paramValues = { ...nextValues };
    if (!syncHangerDefinitionFromParams(groupContainer)) return false;

    const groupNode = document.findNode(groupContainer.id) as CADNode | null;
    if (!groupNode) return false;

    const bodies = smartPartBodies(gp.definition);
    const usedBodyIds = new Set<string>();
    for (const childNode of [...(groupNode.children || [])]) {
        const childContainer: any = childNode.domainData;
        const childGp = childContainer?.generatorParams;
        if (!childGp) continue;
        const oldPart = childGp.part;
        // Match po id/name; bez trafienia — adoptuj pierwszy nieużyty part definicji
        const nextPart = bodies.find((b: any) => b?.id && b.id === oldPart?.id)
            || bodies.find((b: any) => b?.name && b.name === oldPart?.name)
            || bodies.find((b: any) => b?.id && !usedBodyIds.has(String(b.id)))
            || null;
        if (!nextPart) {
            // Part usunięty z definicji → usuń węzeł (z jego FEATURE cięciami)
            childNode.detach();
            continue;
        }
        if (nextPart.id) usedBodyIds.add(String(nextPart.id));
        childGp.part = nextPart;
        childGp.widthMm = Number(nextPart.widthMm) || childGp.widthMm;
        childGp.heightMm = Number(nextPart.heightMm) || childGp.heightMm;
        childGp.depthMm = Number(nextPart.depthMm) || childGp.depthMm;
        if (childContainer) {
            childContainer.width = mmToNm(childGp.widthMm);
            childContainer.height = mmToNm(childGp.heightMm);
            childContainer.depth = mmToNm(childGp.depthMm);
        }
        childGp.definition = gp.definition;

        const partIndex = Math.max(0, bodies.findIndex((b: any) => b?.id === childGp.part?.id));
        const cuts = smartPartCutsForPart(gp.definition, childGp.part?.id, partIndex);
        // Upsert FEATURE: usuń nieaktualne cięcia, zaktualizuj trafione
        for (const cutChild of [...(childNode.children || [])]) {
            const cutDd: any = cutChild.domainData;
            if (cutDd?.role !== 'SMARTPART_CUT' && cutDd?.type !== 'smartpart_cut') continue;
            const cutId = cutDd?.generatorParams?.cut?.id;
            const nextCut = cuts.find((c: any) => c?.id === cutId);
            if (!nextCut) {
                // Cięcie usunięte z definicji → usuń FEATURE node
                childNode.removeChild(cutChild);
                continue;
            }
            cutDd.generatorParams.cut = nextCut;
            const cutDimsNm = cutDomainDimsNm(nextCut);
            const cutKind = String(nextCut.type || '').toUpperCase() === 'POCKET' ? 'Kieszen' : 'Otwor';
            const cutLabel = nextCut.name || `${cutKind}_${nextCut.id}`;
            cutDd.cutType = nextCut.type;
            cutDd.width = cutDimsNm.width;
            cutDd.height = cutDimsNm.height;
            cutDd.depth = cutDimsNm.depth;
            cutChild.name = cutLabel;
            cutDd.name = cutLabel;
            const cutLcsUpdate = resolveCutPlacementInPartLcsMm(childGp.part, nextCut);
            cutChild.setLocalTransform(
                new Vec3(
                    mmToNm(cutLcsUpdate.xMm),
                    mmToNm(cutLcsUpdate.yMm),
                    mmToNm(cutLcsUpdate.zMm),
                ),
                Quat.IDENTITY,
            );
        }
        // Upsert FEATURE: dodaj brakujące cięcia
        const existingCutIds = new Set(
            (childNode.children || [])
                .map((c: any) => (c.domainData as any)?.generatorParams?.cut?.id)
                .filter(Boolean)
                .map(String),
        );
        for (const cut of cuts) {
            if (!cut?.id || existingCutIds.has(String(cut.id))) continue;
            childNode.addChild(createHangerCutNode(childContainer, childGp, cut));
        }
    }
    // Nowy part w definicji bez węzła-dziecka → dodaj (HARDWARE + FEATURE razem)
    for (const body of bodies) {
        if (!body?.id || usedBodyIds.has(String(body.id))) continue;
        const newNode = createHangerPartChildNode(groupContainer, body);
        if (newNode) groupNode.addChild(newNode);
        usedBodyIds.add(String(body.id));
    }

    const ok = updateSmartPartHangersGroup(groupNode, document);
    if (typeof document.notifyDocumentChanged === 'function') {
        document.notifyDocumentChanged();
    }
    if (typeof window !== 'undefined' && typeof (window as any).__rebuildGeometry === 'function') {
        (window as any).__rebuildGeometry('SmartPart param');
    }
    return ok;
}
