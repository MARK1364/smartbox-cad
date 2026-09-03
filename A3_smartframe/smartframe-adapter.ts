import { Korpus3Engine } from './smartframe-engine.js';
import { applyAllAssociativeDims } from '../A4_smartpanel/associative-dim.js';
import { isManualPanel, PanelModel } from '../A4_smartpanel/panel-model.js';
import { mergeEngineAndLibraryFeatures, refreshLibraryOperationsOnPanel } from '../o1_operacji/operacje-apply.js';
import { ContainerModel } from '../A1_core/container-model.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { SyncBackGroovesCommand } from '../A1_core/commands/sync-back-grooves-command.js';
import { SyncShelfDrillingsCommand } from '../A1_core/commands/sync-shelf-drillings-command.js';
import { SyncDoorDrillingsCommand } from '../A1_core/commands/sync-door-drillings-command.js';
import { SyncDrawerDrillingsCommand } from '../A1_core/commands/sync-drawer-drillings-command.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';

// Silnik — singleton na poziomie modułu (ładuje reguły raz)
const engine = new Korpus3Engine();
engine.loadRules();

/** Wyciąga aktywny kontener z projectModel */
export function getActiveContainer(docTarget: any): any | null {
    if (!docTarget) return null;
    const doc = docTarget.document || docTarget;
    const ae = doc.activeEntity;
    if (!ae) return null;
    if (ae.type === 'container') {
        const pType = ae.generatorParams?.type || '';
        if (pType.startsWith('smartbox_')) {
            const node = doc.findNode(ae.id);
            if (node && node.parent && node.parent.domainData?.type === 'container') {
                return node.parent.domainData;
            }
        }
        return ae;
    }
    // Jeżeli to płyta, znajdź jej kontener-rodzica poprzez drzewo CADNode
    const node = doc.findNode(ae.id);
    if (node && node.parent && node.parent.domainData?.type === 'container') {
        const parentData = node.parent.domainData as any;
        const pType = parentData.generatorParams?.type || '';
        if (pType.startsWith('smartbox_')) {
             if (node.parent.parent && node.parent.parent.domainData?.type === 'container') {
                 return node.parent.parent.domainData;
             }
        }
        return parentData;
    }
    return null;
}

/** Oblicza wysokość strefy górnej */
export function calcTopHeight(h: number, zCount: number, hB: number, hM: number): number {
    if (zCount === 1) return h;
    if (zCount === 2) return Math.max(0, h - hB);
    return Math.max(0, h - hB - hM);
}

export function isSmartBoxHoleFeature(f: any): boolean {
    if (!f) return false;
    const tid = f.params?.template_id;
    if (tid === 'SYSTEM_32' || tid === 'SINGLE' || tid === 'TRIPLE' || tid === 'ROW') return true;
    if (f.id && (typeof f.id === 'string') && (f.id.startsWith('row_hole_') || f.id.startsWith('hole_'))) return true;
    if (f.is_smartbox_child || f.customProperties?.is_smartbox_child || f.customProperties?.is_assembly_drilling) return true;
    return false;
}

function assignPlanFeatures(panel: any, engineFeatures: any[], preserveLibrary: boolean) {
    const existing = preserveLibrary ? (panel.features || []) : [];
    const merged = mergeEngineAndLibraryFeatures(existing, engineFeatures || []);
    if (typeof panel.setFeatures === 'function') {
        panel.setFeatures(merged);
    } else {
        panel.features = merged;
    }
    refreshLibraryOperationsOnPanel(panel);
}

/** Kopiuje strukturę operacji z silnika do kontenera w projekcie */
export function applyPlanToContainer(container: any, operationPlan: any) {
    const activePanelIds = new Set<string>();
    const W = container.width;
    const D = container.depth;

    const doc = ContextManager.instance.document;
    const cntNode = doc?.findNode(container.id);
    if (!cntNode) return;

    const cleanSmartBoxChildHoleFeatures = (node: any) => {
        for (const child of node.children) {
            if (child.domainData?.type === 'container') {
                cleanSmartBoxChildHoleFeatures(child);
                continue;
            }
            const panelData = child.domainData;
            if (isManualPanel(panelData)) continue;
            if (!panelData?.features?.length) continue;
            const filtered = panelData.features.filter((f: any) => (f.frozen || f.params?.frozen) || !isSmartBoxHoleFeature(f));
            if (filtered.length === panelData.features.length) continue;
            if (typeof panelData.setFeatures === 'function') {
                panelData.setFeatures(filtered);
            } else {
                panelData.features = filtered;
            }
        }
    };
    cleanSmartBoxChildHoleFeatures(cntNode);

    const hasSystem32InPlan = operationPlan.parts.some((p: any) => p.role === 'DRILLING_PATTERN' || p.type === 'Assembly' || p.subtype === 'Empty');
    if (!hasSystem32InPlan) {
        const candidatePanels: any[] = [];
        const collectPanels = (node: any) => {
            for (const child of node.children) {
                if (child.domainData) {
                    if (child.domainData.type === 'container') collectPanels(child);
                    else candidatePanels.push(child.domainData);
                }
            }
        };
        collectPanels(cntNode);
        
        // Zbieramy z globalnych (inne kontenery)
        if (doc) {
            for (const rootChild of doc.rootNode.children) {
                const domainData = rootChild.domainData as any;
                if (domainData && domainData.type === 'container') {
                    collectPanels(rootChild);
                } else if (domainData) {
                    candidatePanels.push(domainData);
                }
            }
        }
        
        for (const p of candidatePanels) {
            if (isManualPanel(p)) continue;
            if (p.features && p.features.length > 0) {
                const filtered = p.features.filter((f: any) => (f.frozen || f.params?.frozen) || !isSmartBoxHoleFeature(f));
                if (filtered.length !== p.features.length) {
                    if (typeof p.setFeatures === 'function') {
                        p.setFeatures(filtered);
                    } else {
                        p.features = filtered;
                    }
                }
            }
        }
        if (container.features && container.features.length > 0) {
            container.features = container.features.filter((f: any) => (f.frozen || f.params?.frozen) || !isSmartBoxHoleFeature(f));
        }
    }

    for (const part of operationPlan.parts) {

        let localCenterX = part.loc.x;   // CAD X = szerokość
        let localCenterY = part.loc.y;   // CAD Y = głębokość
        const localCenterZ = part.loc.z;   // CAD Z = wysokość
        // Kąty rotacji per rola — zakodowane jako kwaterniony (CAD Z-up).
        // Wcześniej: ręczna zamiana osi + hardkodowane Math.PI/2 w 5+ miejscach.
        // Teraz: jedno miejsce, czytelna intencja.
        let bbWidth = part.dim.x;
        let bbHeight = part.dim.y;
        let bbThickness = part.dim.z;
        let rotQuat = Quat.IDENTITY;

        // Pobierz lcs z konfiguracji JSON (przekazane przez silnik w part.lcs lub bezpośrednio w node)
        // part.lcs zostało dodane do modelu
        let lcs = part.lcs;
        if (!lcs && engine.rules?.model_tree) {
            // Spróbujmy znaleźć lcs w regułach silnika na podstawie role/name
            const findLCS = (obj: any): any => {
                for (let key in obj) {
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        if (obj[key].role === part.role || obj[key].name === part.name) {
                            if (obj[key].lcs) return obj[key].lcs;
                        }
                        const res = findLCS(obj[key]);
                        if (res) return res;
                    }
                }
                return null;
            };
            lcs = findLCS(engine.rules.model_tree);
        }

        if (lcs && lcs.mapping) {
            bbWidth = part.dim[lcs.mapping.X];
            bbHeight = part.dim[lcs.mapping.Y];
            bbThickness = part.dim[lcs.mapping.Z];
            
            if (lcs.rotation) {
                rotQuat = Quat.fromEulerXYZ(
                    lcs.rotation[0] * Math.PI / 180,
                    lcs.rotation[1] * Math.PI / 180,
                    lcs.rotation[2] * Math.PI / 180
                );
            }
        }

        const rot = rotQuat.toEulerXYZ();

        const cornerX = part.loc.x;
        const cornerY = part.loc.y;
        const cornerZ = part.loc.z;

        let panel = cntNode.children.map((c: any) => c.domainData).find((p: any) => 
            p && !isManualPanel(p) && ((part.key && (p as any).key === part.key) ||
            (p.name === part.name && (!part.zonePrefix || p.zonePrefix === part.zonePrefix)) || 
            (p.role === part.role && p.name?.replace(/\s+/g, '_') === part.name?.replace(/\s+/g, '_') && (!part.zonePrefix || p.zonePrefix === part.zonePrefix)))
        );
        let panelNode: any = panel ? doc?.findNode(panel.id) : null;

        // Pobierz domyślne okleinowanie z reguł dla danej roli jeśli panel nie ma jeszcze własnego
        const roleOverride = engine.rules?.smart_panel_integration?.role_overrides?.[part.role] || (engine.rules?.parameters?.smart_panel_integration?.role_overrides?.[part.role]);
        const defaultEdgeBanding = part.edge_banding || roleOverride?.edge_banding;

        if (panel && panelNode) {
            if (panel.frozen) {
                panel.visible = false;
            }
            panel.name = part.name;
            panel.setDimensions(mmToNm(bbWidth), mmToNm(bbHeight), mmToNm(bbThickness));
            
            panelNode.setLocalTransform(
                new Vec3(mmToNm(cornerX), mmToNm(cornerY), mmToNm(cornerZ)),
                rotQuat
            );

            (panel as any).key = part.key;
            panel.zonePrefix = part.zonePrefix;
            if (defaultEdgeBanding && (!panel.edgeBanding || Object.keys(panel.edgeBanding).length === 0)) {
                panel.setEdgeBanding(defaultEdgeBanding);
            }
            if (part.customProperties) (panel as any).custom_properties = { ...part.customProperties };
            assignPlanFeatures(panel, part.features || [], true);
        } else {
            panel = new PanelModel({
                width: mmToNm(bbWidth), height: mmToNm(bbHeight), thickness: mmToNm(bbThickness)
            });
            panel.name = part.name;
            panel.role = part.role;
            (panel as any).key = part.key;
            panel.zonePrefix = part.zonePrefix;
            if (defaultEdgeBanding) {
                panel.setEdgeBanding(defaultEdgeBanding);
            }
            if (part.customProperties) (panel as any).custom_properties = { ...part.customProperties };
            assignPlanFeatures(panel, part.features || [], false);

            panelNode = CADNode.create(NodeType.PART, panel.name, panel.id);
            panelNode.domainData = panel;
            panelNode.setLocalTransform(
                new Vec3(mmToNm(cornerX), mmToNm(cornerY), mmToNm(cornerZ)),
                rotQuat
            );
            
            if (doc) doc.addNode(container.id, panelNode);
            else cntNode.addChild(panelNode);
        }
        if (panel) {
            const panelId = panel.smartId?.fullPath || panel.id;
            activePanelIds.add(panelId);
        }
    }
    
    if (doc) {
        const currentChildren = [...cntNode.children];
        for (const childNode of currentChildren) {
            const p = childNode.domainData as any;
            if (!p || p.type === 'container' || p.name?.endsWith('_SB') || isManualPanel(p)) {
                continue;
            }
            const panelId = p.smartId?.fullPath || p.id;
            if (!activePanelIds.has(panelId)) {
                doc.removeNode(childNode.id);
            }
        }
        applyAllAssociativeDims(doc);
    }
}

/** Uruchamia silnik i aplikuje wygenerowane części do kontenera */
export function runEngineAndApply(
    container: any,
    w: number, h: number, d: number,
    zCount: 1 | 2 | 3,
    hB: number, hM: number,
    backOffsetMm: number,
    offsets?: Record<string, number>
) {
    const plan = engine.plan({ 
        width: w, height: h, depth: d, 
        zoneCount: zCount, bottomHeight: hB, middleHeight: hM, 
        backOffsetMm, offsets,
        container
    });
    applyPlanToContainer(container, plan);

    // Po zastosowaniu planu węzły istnieją w dokumencie. Wyliczamy rowki matematycznie na podstawie macierzy:
    const syncCmd = new SyncBackGroovesCommand(container.id);
    ContextManager.instance.commandHistory.execute(syncCmd);

    const syncDrillingsCmd = new SyncShelfDrillingsCommand(container.id);
    ContextManager.instance.commandHistory.execute(syncDrillingsCmd);

    const syncDoorDrillingsCmd = new SyncDoorDrillingsCommand(container.id);
    ContextManager.instance.commandHistory.execute(syncDoorDrillingsCmd);

    const syncDrawerDrillingsCmd = new SyncDrawerDrillingsCommand(container.id);
    ContextManager.instance.commandHistory.execute(syncDrawerDrillingsCmd);
}

export async function initializeSmartFrameEngine(): Promise<void> {
    await engine.loadRules();
}

export function rebuildSmartFrameContainer(container: any): boolean {
    if (!container) return false;

    const params = container.generatorParams;
    const zCount = (params?.zoneCount || 1) as 1 | 2 | 3;
    const bHeight = params?.bottomHeight ?? undefined;
    const mHeight = params?.middleHeight ?? undefined;
    const bOffset = params?.backOffset ?? 0;
    const offs = params?.offsets || {};

    runEngineAndApply(
        container,
        nmToMm(container.width),
        nmToMm(container.height),
        nmToMm(container.depth),
        zCount,
        bHeight,
        mHeight,
        bOffset,
        offs
    );
    return true;
}

interface KorpusParams {
    width: number;
    height: number;
    depth: number;
    zoneCount: 1 | 2 | 3;
    bottomHeight: number;
    middleHeight: number;
    backOffset: number;
    offsets?: Record<string, number>;
}

/** Tworzy nową, niezależną instancję kontenera korpusu */
export function createNewKorpus(docTarget: any, params: KorpusParams) {
    if (!docTarget) return;
    const doc = docTarget.document || docTarget;

    const existingCount = typeof doc.getContainers === 'function' ? doc.getContainers().length : 0;
    // Nowy kontener
    const nc = new ContainerModel({
        width: mmToNm(params.width),
        height: mmToNm(params.height),
        depth: mmToNm(params.depth),
        name: `Korpus (SmartFrame) ${existingCount + 1}`
    });
    
    nc.generatorParams = {
        type: 'korpus3_2',
        zoneCount: params.zoneCount,
        bottomHeight: params.bottomHeight,
        middleHeight: params.middleHeight,
        backOffset: params.backOffset,
        offsets: params.offsets || {}
    };


    const ncNode = CADNode.create(NodeType.ASSEMBLY, nc.name, nc.id);
    ncNode.domainData = nc;

    doc.addNode(doc.rootNode.id, ncNode);

    runEngineAndApply(
        nc,
        params.width, params.height, params.depth,
        params.zoneCount, params.bottomHeight, params.middleHeight,
        params.backOffset, params.offsets || {}
    );

    doc.setActiveEntity(nc);
    document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
}

/** Aktualizacja w czasie rzeczywistym przy wpisywaniu parametrów */
export function applyRealtimeUpdate(docTarget: any, params: KorpusParams) {
    if (!docTarget) return;
    const doc = docTarget.document || docTarget;
    
    const w_mm = params.width;
    const h_mm = params.height;
    const d_mm = params.depth;

    if (w_mm < 150 || h_mm < 150 || d_mm < 150) return;

    const container = getActiveContainer(doc);
    if (!container) return;

    container.width  = mmToNm(w_mm);
    container.height = mmToNm(h_mm);
    container.depth  = mmToNm(d_mm);
    if (!container.generatorParams) container.generatorParams = {};
    Object.assign(container.generatorParams, {
        type: 'korpus3_2',
        zoneCount: params.zoneCount,
        bottomHeight: params.bottomHeight,
        middleHeight: params.middleHeight,
        backOffset: params.backOffset,
        offsets: params.offsets || {}
    });
    runEngineAndApply(
        container,
        w_mm, h_mm, d_mm,
        params.zoneCount, params.bottomHeight, params.middleHeight,
        params.backOffset, params.offsets || {}
    );
    document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
}

/** Synchronizuje pozycję kontenera w modelu z pozycją w scenie bez regeneracji płyt */
export function updateContainerPosition(container: any, x: number, y: number, z: number) {
    if (!container) return;
    const doc = ContextManager.instance.document;
    const node = doc?.findNode(container.id);
    if (node) {
        const { rotation, scale } = node.localMatrix.decompose();
        node.setLocalTransform(new Vec3(mmToNm(x), mmToNm(y), mmToNm(z)), rotation, scale);
    }
}