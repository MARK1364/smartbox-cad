import { planCabinet } from './smartframe-engine.js';
import { applyAllAssociativeDims } from '../A4_smartpanel/associative-dim.js';
import { isManualPanel, PanelModel } from '../A4_smartpanel/panel-model.js';
import { mergeEngineAndLibraryFeatures, refreshLibraryOperationsOnPanel } from '../o1_operacji/operacje-apply.js';
import { ContainerModel } from '../A1_core/container-model.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { SyncBackGroovesCommand } from './commands/sync-back-grooves-command.js';
import { notifyKorpusRebuilt } from '../A1_core/cabinet-port.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { nmToMm, mmToNm } from '../A1_core/cad-math/units.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import korpusRulesData from './korpus3_3_rules.json';
import korpusRogowy90RulesData from './korpus_rogowy90_rules.json';
import korpusRogowy1RulesData from './korpus_rogowy1_rules.json';
import korpusSkosnyRulesData from './korpus_skosny_rules.json';

function resolveCabinetRulesForType(type?: string): any {
    const t = String(type || '').toLowerCase();
    if (t === 'korpus_rogowy90' || t.includes('rogowy90') || t.includes('rogowy_90')) {
        return korpusRogowy90RulesData;
    }
    if (t === 'korpus_rogowy1' || t.includes('rogowy1') || t.includes('rogowy_1')) {
        return korpusRogowy1RulesData;
    }
    if (t.startsWith('korpus_skosny')) {
        return korpusSkosnyRulesData;
    }
    return korpusRulesData;
}

const ABS_EDGE = { active: true, type_id: '0.008x0.022' };
const NO_EDGE = { active: false, type_id: 'none' };

/**
 * Obrzeże ABS panelu zaślepiającego tylko od strony światła (otworu drzwiowego).
 * LEFT → +X (prawa krawędź panelu), RIGHT → -X (lewa krawędź panelu).
 */
export function resolveBlindPanelEdgeBanding(blindSide?: string): Record<string, { active: boolean; type_id: string }> {
    const side = String(blindSide || 'LEFT').toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT';
    return {
        '+X': side === 'LEFT' ? ABS_EDGE : NO_EDGE,
        '-X': side === 'RIGHT' ? ABS_EDGE : NO_EDGE,
        '+Y': NO_EDGE,
        '-Y': NO_EDGE
    };
}

export type AdapterCabinetType = 'korpus3' | 'korpus_rogowy1' | 'korpus_rogowy90' | 'korpus_skosny' | 'korpus_skosny_dach' | 'korpus_skosny_lr' | 'korpus_skosny_lr_uc';

export function resolveCabinetType(raw?: string): AdapterCabinetType {
    const t = String(raw || 'korpus3').toLowerCase();
    if (t.includes('skosny_lr_uc') || t.includes('skosny-lr-uc')) return 'korpus_skosny_lr_uc';
    if (t.includes('skosny_lr') || t.includes('skosny-lr')) return 'korpus_skosny_lr';
    if (t.includes('skosny_dach') || t.includes('skosny-dach')) return 'korpus_skosny_dach';
    if (t.includes('skosny')) return 'korpus_skosny';
    if (t.includes('rogowy90') || t.includes('rogowy_90')) return 'korpus_rogowy90';
    if (t.includes('rogowy')) return 'korpus_rogowy1';
    return 'korpus3';
}

/** Wyciąga aktywny kontener z projectModel */
export function getActiveContainer(docTarget: any): any | null {
    if (!docTarget) return null;
    const doc = docTarget.document || docTarget;
    const ae = doc.activeEntity;
    if (!ae) return null;
    if (ae.type === 'container') {
        const pType = ae.generatorParams?.type || '';
        if (pType.startsWith('blok_')) {
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
        if (pType.startsWith('blok_')) {
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

export function isBlokiHoleFeature(f: any): boolean {
    if (!f) return false;
    const tid = f.params?.template_id;
    if (tid === 'SYSTEM_32' || tid === 'SINGLE' || tid === 'TRIPLE' || tid === 'ROW') return true;
    if (f.id && (typeof f.id === 'string') && (f.id.startsWith('row_hole_') || f.id.startsWith('hole_'))) return true;
    if (f.is_bloki_child || f.customProperties?.is_bloki_child || f.customProperties?.is_assembly_drilling) return true;
    return false;
}

function applyPartCustomProperties(panel: any, part: any) {
    if (!(part.customProperties || part.custom_properties)) return;
    const fromPart = part.customProperties || part.custom_properties || {};
    const currentCustom = { ...((panel as any).custom_properties || {}) };
    // Jawne usunięcie obrysu (np. wieniec LR wraca z klinu do zwykłej płyty).
    if ('outline2d' in fromPart && fromPart.outline2d == null) {
        delete currentCustom.outline2d;
        delete currentCustom.shape;
        delete currentCustom.boardThickness;
    }
    const next: Record<string, any> = {
        ...currentCustom,
        ...fromPart,
        ...(panel.materialId ? { material: panel.materialId, material_name: panel.materialName, material_code: panel.materialCode } : {})
    };
    if (fromPart.outline2d) {
        next.outline2d = fromPart.outline2d;
        next.shape = fromPart.shape || 'L_NOTCH';
    } else if ('outline2d' in fromPart) {
        delete next.outline2d;
        delete next.shape;
        delete next.boardThickness;
    }
    (panel as any).custom_properties = next;
}

/**
 * Przenosi klasyfikację planu (report_type, library_id) na domenowy PanelModel.
 * To pola strukturalne dla raportów i routingu obróbki — nie display.
 */
function applyPartClassification(panel: any, part: any) {
    if (part.report_type !== undefined) (panel as any).report_type = part.report_type;
    if (part.library_id !== undefined) (panel as any).library_id = part.library_id;
}

function rebuildPanelView(panel: any) {
    const views = ContextManager.instance.panelViews;
    if (!views || !panel) return;
    const view = views.get(panel) || (panel.id ? views.get(panel.id) : null);
    if (view && typeof view.rebuildGeometry === 'function') view.rebuildGeometry();
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

const lcsCache = new Map<string, any>();

function findLcsInModelTree(modelTree: any, role?: string, name?: string): any {
    const key = `${role || ''}|${name || ''}`;
    if (lcsCache.has(key)) return lcsCache.get(key);

    const search = (obj: any): any => {
        for (const k in obj) {
            const val = obj[k];
            if (typeof val === 'object' && val !== null) {
                if ((role && val.role === role) || (name && val.name === name)) {
                    if (val.lcs) return val.lcs;
                }
                const res = search(val);
                if (res) return res;
            }
        }
        return null;
    };

    const found = search(modelTree);
    lcsCache.set(key, found);
    return found;
}

/** Kopiuje strukturę operacji z silnika do kontenera w projekcie */
export function applyPlanToContainer(container: any, operationPlan: any) {
    const activePanelIds = new Set<string>();
    const W = container.width;
    const D = container.depth;

    const doc = ContextManager.instance.document;
    const cntNode = doc?.findNode(container.id);
    if (!cntNode) return;

    const cleanBlokiChildHoleFeatures = (node: any) => {
        for (const child of node.children) {
            if (child.domainData?.type === 'container') {
                cleanBlokiChildHoleFeatures(child);
                continue;
            }
            const panelData = child.domainData;
            if (isManualPanel(panelData)) continue;
            if (!panelData?.features?.length) continue;
            const filtered = panelData.features.filter((f: any) => (f.frozen || f.params?.frozen) || !isBlokiHoleFeature(f));
            if (filtered.length === panelData.features.length) continue;
            if (typeof panelData.setFeatures === 'function') {
                panelData.setFeatures(filtered);
            } else {
                panelData.features = filtered;
            }
        }
    };
    cleanBlokiChildHoleFeatures(cntNode);

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
        
        for (const p of candidatePanels) {
            if (isManualPanel(p)) continue;
            if (p.features && p.features.length > 0) {
                const filtered = p.features.filter((f: any) => (f.frozen || f.params?.frozen) || !isBlokiHoleFeature(f));
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
            container.features = container.features.filter((f: any) => (f.frozen || f.params?.frozen) || !isBlokiHoleFeature(f));
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
        const rules = resolveCabinetRulesForType(container?.generatorParams?.type);
        let lcs = part.lcs;
        if (!lcs && rules?.model_tree) {
            lcs = findLcsInModelTree(rules.model_tree, part.role, part.name);
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
        const roleOverride = rules?.smart_panel_integration?.role_overrides?.[part.role] || (rules?.parameters?.smart_panel_integration?.role_overrides?.[part.role]);
        let defaultEdgeBanding = part.edge_banding || roleOverride?.edge_banding;
        // BLIND_PANEL: ABS tylko od strony światła — zależne od blindSide
        if (part.role === 'BLIND_PANEL') {
            defaultEdgeBanding = resolveBlindPanelEdgeBanding(container?.generatorParams?.strona_blendy);
        }

        if (panel && panelNode) {
            if (panel.frozen) {
                panel.visible = false;
            }
            panel.name = part.name;
            panel.role = part.role;
            applyPartCustomProperties(panel, part);
            applyPartClassification(panel, part);
            panel.setDimensions(mmToNm(bbWidth), mmToNm(bbHeight), mmToNm(bbThickness));
            
            panelNode.setLocalTransform(
                new Vec3(mmToNm(cornerX), mmToNm(cornerY), mmToNm(cornerZ)),
                rotQuat
            );

            (panel as any).key = part.key;
            panel.zonePrefix = part.zonePrefix;
            (panel as any).zoneId = part.zoneId;
            (panel as any).lcs = lcs;
            const syncEdgeFromRules =
                part.role === 'BLIND_PANEL' ||
                part.role === 'LEFT_SIDE_PANEL' ||
                part.role === 'RIGHT_SIDE_PANEL' ||
                part.role === 'FRONT_PANEL' ||
                part.role === 'BOTTOM_PANEL' ||
                part.role === 'TOP_PANEL';
            if (defaultEdgeBanding && syncEdgeFromRules) {
                panel.setEdgeBanding(defaultEdgeBanding);
            } else {
                const hasActiveEdgeBanding = panel.edgeBanding && Object.values(panel.edgeBanding).some((e: any) => e?.active);
                if (defaultEdgeBanding && (!panel.edgeBanding || Object.keys(panel.edgeBanding).length === 0 || !hasActiveEdgeBanding)) {
                    panel.setEdgeBanding(defaultEdgeBanding);
                } else if (defaultEdgeBanding && (part.customProperties?.outline2d || part.custom_properties?.outline2d)) {
                    const merged = { ...(panel.edgeBanding || {}) };
                    let changed = false;
                    for (const [k, v] of Object.entries(defaultEdgeBanding)) {
                        if (merged[k] === undefined) {
                            merged[k] = v;
                            changed = true;
                        }
                    }
                    if (defaultEdgeBanding.NOTCH) {
                        merged.NOTCH = defaultEdgeBanding.NOTCH;
                        changed = true;
                    }
                    if (changed) panel.setEdgeBanding(merged);
                }
            }
            assignPlanFeatures(panel, part.features || [], true);
            // Zawsze przebuduj mesh — przy skosnym LR zmiana heightLeft musi odświeżyć bok
            // (setDimensions emituje event, ale outline/custom też wymaga jawnego rebuildu).
            rebuildPanelView(panel);
        } else {
            const rawMat = part.material;
            const isLegacyOrEmpty = !rawMat || rawMat === 'MDF_SUROWY_18' || rawMat === 'HDF_3' || rawMat === 'PLYTY_18';
            const initialMatId = isLegacyOrEmpty ? undefined : rawMat;
            const initialMatName = isLegacyOrEmpty ? undefined : part.materialName;
            const initialMatCode = isLegacyOrEmpty ? undefined : part.materialCode;

            panel = new PanelModel({
                width: mmToNm(bbWidth),
                height: mmToNm(bbHeight),
                thickness: mmToNm(bbThickness),
                role: part.role,
                name: part.name,
                ...(initialMatId ? { materialId: initialMatId } : {}),
                ...(initialMatName ? { materialName: initialMatName } : {}),
                ...(initialMatCode ? { materialCode: initialMatCode } : {})
            });
            panel.name = part.name;
            panel.role = part.role;
            (panel as any).key = part.key;
            panel.zonePrefix = part.zonePrefix;
            (panel as any).zoneId = part.zoneId;
            (panel as any).lcs = lcs;
            if (defaultEdgeBanding) {
                panel.setEdgeBanding(defaultEdgeBanding);
            }
            if (part.customProperties || part.custom_properties) {
                // Merge, nie nadpisanie — właściwy materiał z panelu ma pierwszeństwo przed legacy z JSON.
                (panel as any).custom_properties = {
                    ...((panel as any).custom_properties || {}),
                    ...(part.customProperties || part.custom_properties),
                    material: panel.materialId,
                    material_name: panel.materialName,
                    material_code: panel.materialCode
                };
            }
            applyPartClassification(panel, part);
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

    // ─── Tworzenie i synchronizacja węzłów okuć (NodeType.HARDWARE) ───
    const activeHardwareIds = new Set<string>();
    if (Array.isArray((operationPlan as any).hardware)) {
        for (const hw of (operationPlan as any).hardware) {
            const hwFullId = `${container.id}_${hw.id}`;
            let hwNode = cntNode.children.find((c: any) => c.nodeType === NodeType.HARDWARE && (c.id === hwFullId || c.id === hw.id));
            if (!hwNode) {
                hwNode = CADNode.create(NodeType.HARDWARE, hw.name, hwFullId);
                hwNode.domainData = {
                    type: 'hardware',
                    id: hwFullId,
                    name: hw.name,
                    role: hw.role || 'HARDWARE',
                    hardwareType: hw.hardwareType || 'HINGE',
                    hardwareId: hw.hardwareId,
                    side: hw.side,
                    loc: hw.loc,
                    params: hw.params,
                    custom_properties: hw.customProperties || hw.custom_properties,
                    visible: true
                } as any;
                if (doc) doc.addNode(container.id, hwNode);
                else cntNode.addChild(hwNode);
            } else {
                hwNode.name = hw.name;
                if (hwNode.domainData) {
                    (hwNode.domainData as any).hardwareId = hw.hardwareId;
                    (hwNode.domainData as any).name = hw.name;
                    (hwNode.domainData as any).loc = hw.loc;
                    (hwNode.domainData as any).params = hw.params;
                    if (hw.role) (hwNode.domainData as any).role = hw.role;
                    if (hw.customProperties) (hwNode.domainData as any).custom_properties = hw.customProperties;
                }
            }
            if (hw.loc) {
                hwNode.setLocalTransform(
                    new Vec3(mmToNm(hw.loc.x), mmToNm(hw.loc.y), mmToNm(hw.loc.z)),
                    Quat.IDENTITY
                );
            }
            activeHardwareIds.add(hwNode.id);
        }
    }
    
    if (doc) {
        const currentChildren = [...cntNode.children];
        for (const childNode of currentChildren) {
            if (childNode.nodeType === NodeType.HARDWARE) {
                if (!activeHardwareIds.has(childNode.id)) {
                    doc.removeNode(childNode.id);
                }
                continue;
            }
            const p = childNode.domainData as any;
            if (!p || p.type === 'container' || p.name?.endsWith('_SB') || p.name?.startsWith('blok_') || childNode.name?.startsWith('blok_') || isManualPanel(p)) {
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

/**
 * Uruchamia silnik i aplikuje wygenerowane części do kontenera.
 * WSZYSTKIE wymiary na wejściu w [mm] — brak zgadywania jednoski po wartości.
 */
export function runEngineAndApply(
    container: any,
    w_mm: number, wysokosc_mm: number, glebokosc_mm: number,
    zCount: 1 | 2 | 3 = 1,
    wysokosc_strefy_dolnej_mm = 0,
    wysokosc_strefy_srodkowej_mm = 0,
    cofniecie_plecow_mm?: number,
    offsets?: Record<string, number>
) {
    const gp = container?.generatorParams || {};
    // Wyjątek gizmo: A1_core/gizmo-controller zapisuje tu `backOffset`.
    const bOffset = cofniecie_plecow_mm ?? gp.cofniecie_plecow_mm ?? gp.backOffset ?? 3;
    // Wyjątek gizmo: `topPanelMode` / `traverseWidth` są własnością gizma wienca.
    const tryb_wienca_gornego = (gp.topPanelMode || 'FULL') as 'FULL' | 'TRAVERSE_H' | 'TRAVERSE_V';
    const szerokosc_trawersu_mm = gp.traverseWidth || 80;
    const cabinetType = resolveCabinetType(gp.type);
    const isCorner = cabinetType === 'korpus_rogowy1' || cabinetType === 'korpus_rogowy90';
    const isSkosny = cabinetType === 'korpus_skosny' || cabinetType === 'korpus_skosny_dach' || cabinetType === 'korpus_skosny_lr' || cabinetType === 'korpus_skosny_lr_uc';
    // Skośny: wysokość kontenera zawsze = max stron [mm].
    let h_mm = wysokosc_mm;
    if (isSkosny) {
        const front_mm = gp.wysokosc_przod_mm ?? wysokosc_mm;
        const back_mm = gp.wysokosc_tyl_mm ?? 1000;
        h_mm = Math.max(h_mm, front_mm, back_mm);
    }
    const effectiveZoneCount = (isCorner || isSkosny) ? 1 : zCount;

    if (container) {
        container.width = mmToNm(w_mm);
        container.height = mmToNm(h_mm);
        container.depth = mmToNm(glebokosc_mm);
        if (!container.generatorParams) container.generatorParams = {};
        container.generatorParams.szerokosc_mm = w_mm;
        container.generatorParams.wysokosc_mm = h_mm;
        container.generatorParams.glebokosc_mm = glebokosc_mm;
        container.generatorParams.liczba_stref = effectiveZoneCount as 1 | 2 | 3;
        container.generatorParams.wysokosc_strefy_dolnej_mm = wysokosc_strefy_dolnej_mm;
        container.generatorParams.wysokosc_strefy_srodkowej_mm = wysokosc_strefy_srodkowej_mm;
        container.generatorParams.cofniecie_plecow_mm = bOffset;
    }

    const doc = ContextManager.instance.document;
    const cntNode = (doc && container?.id) ? doc.findNode(container.id) : null;

    const plan = planCabinet({
        szerokosc_mm: w_mm,
        wysokosc_mm: h_mm,
        glebokosc_mm: glebokosc_mm,
        liczba_stref: effectiveZoneCount as 1 | 2 | 3,
        wysokosc_strefy_dolnej_mm,
        wysokosc_strefy_srodkowej_mm,
        cofniecie_plecow_mm: bOffset,
        offsets,
        container: cntNode || container,
        tryb_wienca_gornego,
        szerokosc_trawersu_mm,
        typ_korpusu: cabinetType,
        szerokosc_blendy_mm: gp.szerokosc_blendy_mm,
        strona_blendy: gp.strona_blendy,
        glebokosc_boku_lewego_mm: gp.glebokosc_boku_lewego_mm,
        glebokosc_boku_prawego_mm: gp.glebokosc_boku_prawego_mm,
        wysokosc_przod_mm: gp.wysokosc_przod_mm,
        wysokosc_tyl_mm: gp.wysokosc_tyl_mm,
        wysokosc_lewy_mm: gp.wysokosc_lewy_mm,
        wysokosc_prawy_mm: gp.wysokosc_prawy_mm
    });
    applyPlanToContainer(container, plan);

    // Po zastosowaniu planu węzły istnieją w dokumencie. Wyliczamy rowki matematycznie na podstawie macierzy:
    if (doc) {
        new SyncBackGroovesCommand(container.id).execute(doc);
        notifyKorpusRebuilt(doc, container.id);
    }
}

/** Bootstrap — reguły są importowane statycznie; zostawione dla kompatybilności init. */
export async function initializeSmartFrameEngine(): Promise<void> {
    if (typeof window !== 'undefined') {
        (window as any).korpusRules = korpusRulesData;
    }
}

export function rebuildSmartFrameContainer(container: any): boolean {
    if (!container) return false;

    const gp = container.generatorParams || {};
    const zCount = (gp.liczba_stref ?? 1) as 1 | 2 | 3;
    const bHeight = gp.wysokosc_strefy_dolnej_mm;
    const mHeight = gp.wysokosc_strefy_srodkowej_mm;
    // Wyjątek gizmo: `backOffset` zapisuje A1_core/gizmo-controller.
    const bOffset = gp.cofniecie_plecow_mm ?? gp.backOffset ?? 3;
    const offs = gp.offsets || {};

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

    const rebuild = (typeof window !== 'undefined') ? (window as any).__rebuildGeometry : null;
    if (typeof rebuild === 'function') {
        try { rebuild(); } catch {}
    }

    if (typeof window !== 'undefined' && window.document) {
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
    }

    const doc = ContextManager.instance.document;
    if (doc) {
        doc.notifyDocumentChanged();
    }

    return true;
}

/**
 * Kanoniczne DTO parametrów korpusu (UI → adapter).
 *
 * TYLKO klucze z jawną jednostką fizyczną. Brak aliasów legacy
 * (width/bottomHeight/blindWidth/bokLewy/armDepth/…) — zob. .agents/AGENTS.md.
 * Klucze `backOffset` / `topPanelMode` / `traverseWidth` są własnością
 * A1_core/gizmo-controller i spoza tego DTO są wstrzykiwane na brzegu.
 */
export interface KorpusParams {
    // Wymiary gabarytu [mm] — SSOT.
    szerokosc_mm?: number;
    wysokosc_mm?: number;
    glebokosc_mm?: number;
    liczba_stref?: 1 | 2 | 3;
    // Podział stref [mm].
    wysokosc_strefy_dolnej_mm?: number;
    wysokosc_strefy_srodkowej_mm?: number;
    // Plecy.
    cofniecie_plecow_mm?: number;
    grubosc_plecow_mm?: number;
    wpuszczenie_plecow_mm?: number;
    // Wieniec górny.
    tryb_wienca_gornego?: 'FULL' | 'TRAVERSE_H' | 'TRAVERSE_V';
    szerokosc_trawersu_mm?: number;
    // Blenda (tylko korpus_rogowy1) [mm].
    szerokosc_blendy_mm?: number;
    strona_blendy?: 'LEFT' | 'RIGHT';
    // Ramiona / boki (tylko korpus_rogowy90) [mm].
    glebokosc_boku_lewego_mm?: number;
    glebokosc_boku_prawego_mm?: number;
    // Wysokości skosu [mm] — korpus_skosny / korpus_skosny_lr.
    wysokosc_przod_mm?: number;
    wysokosc_tyl_mm?: number;
    wysokosc_lewy_mm?: number;
    wysokosc_prawy_mm?: number;

    typ_korpusu?: AdapterCabinetType;
    offsets?: Record<string, number>;
    position?: { x: number; y: number; z?: number };
}

/**
 * Kanoniczny zapis `generatorParams` korpusu — JEDYNY zapis w module.
 * Klucze legacy nie są tworzone; pola spoza typu korpusu (offsets) trafiają osobno.
 * Wyjątek: `backOffset` / `topPanelMode` / `traverseWidth` należą do
 * A1_core/gizmo-controller i są w tym miejscu tylko odczytywane (F: dług gizmo).
 */
function buildCabinetGeneratorParams(input: {
    type: string;
    typ_korpusu?: AdapterCabinetType;
    szerokosc_mm: number;
    wysokosc_mm: number;
    glebokosc_mm: number;
    liczba_stref: 1 | 2 | 3;
    wysokosc_strefy_dolnej_mm: number;
    wysokosc_strefy_srodkowej_mm: number;
    cofniecie_plecow_mm: number;
    offsets?: Record<string, number>;
    wysokosc_przod_mm?: number;
    wysokosc_tyl_mm?: number;
    wysokosc_lewy_mm?: number;
    wysokosc_prawy_mm?: number;
    szerokosc_blendy_mm?: number;
    strona_blendy?: 'LEFT' | 'RIGHT';
    glebokosc_boku_lewego_mm?: number;
    glebokosc_boku_prawego_mm?: number;
}): Record<string, any> {
    const gp: Record<string, any> = {
        type: input.type,
        typ_korpusu: input.typ_korpusu || resolveCabinetType(input.type),
        szerokosc_mm: input.szerokosc_mm,
        wysokosc_mm: input.wysokosc_mm,
        glebokosc_mm: input.glebokosc_mm,
        liczba_stref: input.liczba_stref,
        wysokosc_strefy_dolnej_mm: input.wysokosc_strefy_dolnej_mm,
        wysokosc_strefy_srodkowej_mm: input.wysokosc_strefy_srodkowej_mm,
        cofniecie_plecow_mm: input.cofniecie_plecow_mm,
        offsets: { ...(input.offsets || {}) }
    };
    if (input.wysokosc_przod_mm !== undefined) gp.wysokosc_przod_mm = input.wysokosc_przod_mm;
    if (input.wysokosc_tyl_mm !== undefined) gp.wysokosc_tyl_mm = input.wysokosc_tyl_mm;
    if (input.wysokosc_lewy_mm !== undefined) gp.wysokosc_lewy_mm = input.wysokosc_lewy_mm;
    if (input.wysokosc_prawy_mm !== undefined) gp.wysokosc_prawy_mm = input.wysokosc_prawy_mm;
    if (input.szerokosc_blendy_mm !== undefined) gp.szerokosc_blendy_mm = input.szerokosc_blendy_mm;
    if (input.strona_blendy !== undefined) gp.strona_blendy = input.strona_blendy;
    if (input.glebokosc_boku_lewego_mm !== undefined) gp.glebokosc_boku_lewego_mm = input.glebokosc_boku_lewego_mm;
    if (input.glebokosc_boku_prawego_mm !== undefined) gp.glebokosc_boku_prawego_mm = input.glebokosc_boku_prawego_mm;
    return gp;
}

/** Aktualizacja w czasie rzeczywistym przy wpisywaniu parametrów.
 *  Opcjonalnie `targetContainer` — gdy podany, NIE używa getActiveContainer
 *  (zapobiega nadpisaniu gabarytu innego korpusu).
 */
export function applyRealtimeUpdate(docTarget: any, params: KorpusParams, targetContainer?: any) {
    if (!docTarget) return;
    const doc = docTarget.document || docTarget;

    const w_mm = params.szerokosc_mm ?? 600;
    const h_mm = params.wysokosc_mm ?? 720;
    const d_mm = params.glebokosc_mm ?? 560;

    if (w_mm < 150 || h_mm < 150 || d_mm < 150) return;

    const container = targetContainer || getActiveContainer(doc);
    if (!container) return;

    const gp = container.generatorParams || {};
    // Zabezpieczenie: Typ i liczba stref istniejącego korpusu są ściśle niezmienne (immutable)
    const existingType = gp.type ? resolveCabinetType(gp.type) : undefined;
    const cabinetType = existingType || params.typ_korpusu || 'korpus3';
    const isRogowy1 = cabinetType === 'korpus_rogowy1';
    const isRogowy90 = cabinetType === 'korpus_rogowy90';
    const isSkosny = cabinetType === 'korpus_skosny' || cabinetType === 'korpus_skosny_dach' || cabinetType === 'korpus_skosny_lr' || cabinetType === 'korpus_skosny_lr_uc';
    const isSkosnyLr = cabinetType === 'korpus_skosny_lr' || cabinetType === 'korpus_skosny_lr_uc';
    const isCorner = isRogowy1 || isRogowy90;

    const existingZoneCount = gp.liczba_stref !== undefined ? Number(gp.liczba_stref) : undefined;
    const zoneCount = ((isCorner || isSkosny) ? 1 : (existingZoneCount ?? params.liczba_stref ?? 3)) as 1 | 2 | 3;
    const typeStr = cabinetType === 'korpus_skosny_lr_uc' ? 'korpus_skosny_lr_uc'
        : cabinetType === 'korpus_skosny_lr' ? 'korpus_skosny_lr'
        : cabinetType === 'korpus_skosny_dach' ? 'korpus_skosny_dach'
        : cabinetType === 'korpus_skosny' ? 'korpus_skosny'
        : isRogowy90 ? 'korpus_rogowy90'
        : isRogowy1 ? 'korpus_rogowy1'
        : (gp.type || 'korpus3_2');

    const skos_hF_mm = params.wysokosc_przod_mm ?? gp.wysokosc_przod_mm ?? h_mm;
    const skos_hB_mm = params.wysokosc_tyl_mm ?? gp.wysokosc_tyl_mm ?? 1000;
    const skos_hL_mm = params.wysokosc_lewy_mm ?? gp.wysokosc_lewy_mm ?? 1000;
    const skos_hR_mm = params.wysokosc_prawy_mm ?? gp.wysokosc_prawy_mm ?? h_mm;
    const skos_h_mm = isSkosnyLr ? Math.max(skos_hL_mm, skos_hR_mm, h_mm) : Math.max(skos_hF_mm, skos_hB_mm, h_mm);
    const bottomHeight = params.wysokosc_strefy_dolnej_mm ?? gp.wysokosc_strefy_dolnej_mm ?? (isSkosny ? skos_h_mm : h_mm);
    const middleHeight = params.wysokosc_strefy_srodkowej_mm ?? gp.wysokosc_strefy_srodkowej_mm ?? 0;
    const blindWidth = params.szerokosc_blendy_mm ?? gp.szerokosc_blendy_mm ?? 400;
    const blindSide = params.strona_blendy ?? gp.strona_blendy ?? 'LEFT';
    const bokLewy = params.glebokosc_boku_lewego_mm ?? gp.glebokosc_boku_lewego_mm ?? 600;
    const bokPrawy = params.glebokosc_boku_prawego_mm ?? gp.glebokosc_boku_prawego_mm ?? 600;
    // Wyjątek gizmo: A1_core/gizmo-controller zapisuje tu `backOffset`.
    const bOffset = params.cofniecie_plecow_mm ?? gp.cofniecie_plecow_mm ?? gp.backOffset ?? 3;

    container.width  = mmToNm(w_mm);
    container.height = mmToNm(isSkosny ? skos_h_mm : h_mm);
    container.depth  = mmToNm(d_mm);
    if (!container.generatorParams) container.generatorParams = {};
    Object.assign(container.generatorParams, buildCabinetGeneratorParams({
        type: typeStr,
        typ_korpusu: cabinetType,
        szerokosc_mm: w_mm,
        wysokosc_mm: isSkosny ? skos_h_mm : h_mm,
        glebokosc_mm: d_mm,
        liczba_stref: zoneCount,
        wysokosc_strefy_dolnej_mm: (isCorner || isSkosny) ? (isSkosny ? skos_h_mm : h_mm) : bottomHeight,
        wysokosc_strefy_srodkowej_mm: (isCorner || isSkosny) ? 0 : middleHeight,
        cofniecie_plecow_mm: bOffset,
        offsets: params.offsets,
        ...(isSkosny && !isSkosnyLr ? { wysokosc_przod_mm: skos_hF_mm, wysokosc_tyl_mm: skos_hB_mm } : {}),
        ...(isSkosnyLr ? { wysokosc_lewy_mm: skos_hL_mm, wysokosc_prawy_mm: skos_hR_mm } : {}),
        ...(isRogowy1 ? { szerokosc_blendy_mm: blindWidth, strona_blendy: blindSide } : {}),
        ...(isRogowy90 ? { glebokosc_boku_lewego_mm: bokLewy, glebokosc_boku_prawego_mm: bokPrawy } : {})
    }));
    runEngineAndApply(
        container,
        w_mm, isSkosny ? skos_h_mm : h_mm, d_mm,
        zoneCount,
        (isCorner || isSkosny) ? (isSkosny ? skos_h_mm : h_mm) : bottomHeight,
        (isCorner || isSkosny) ? 0 : middleHeight,
        bOffset, { ...(params.offsets || {}) }
    );
    document.dispatchEvent(new CustomEvent('bloki-project-changed'));
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
