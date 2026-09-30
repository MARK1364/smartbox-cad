/**
 * A6_agd — smart-appliance-core.ts
 *
 * Rdzeń generatora parametrycznych urządzeń AGD (SmartAppliance).
 * Buduje i synchronizuje węzły B-rep (PanelModel) wewnątrz kontenera CADNode (ASSEMBLY).
 *
 * Wszystkie panele posiadają:
 * - Pełną geometrię B-rep z 6 ścianami (FACE_*)
 * - excludeFromProduction: true (ochrona przed cięciem na piłę / CAM)
 * - Pełną zgodność z S2 Solver (więzy, relacje płaszczyzn, odległości)
 * - Obsługę narzędzi PMI (asocjacyjne wymiary)
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../A1_core/container-model.js';
import { PanelModel } from '../A4_smartpanel/panel-model.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import {
    SMART_APPLIANCE_TYPE,
    DEFAULT_MICROWAVE_PARAMS,
    DEFAULT_OVEN_PARAMS,
    type MicrowaveParamsMm,
    type ApplianceKind,
    isSmartApplianceContainer,
} from './smart-appliance-types.js';
import { planMicrowave, type AppliancePartPlanMm } from './microwave-engine.js';

export function ensureSmartApplianceGeneratorParams(container: ContainerModel, kind: ApplianceKind = 'MICROWAVE'): void {
    if (!container.generatorParams) {
        container.generatorParams = {};
    }
    container.generatorParams.type = SMART_APPLIANCE_TYPE;
    if (!container.generatorParams.kind) {
        container.generatorParams.kind = kind;
    }
    const defaults = kind === 'MICROWAVE' ? DEFAULT_MICROWAVE_PARAMS : DEFAULT_OVEN_PARAMS;
    for (const [key, val] of Object.entries(defaults)) {
        if (container.generatorParams[key] === undefined) {
            container.generatorParams[key] = val;
        }
    }
}

export function getApplianceParamsMm(container: ContainerModel): MicrowaveParamsMm {
    const gp = container.generatorParams || {};
    // Kanoniczne pola `*Mm` są w mm; pola bez sufiksu w gp trzymają nm (tak je zapisuje
    // agd-bay-docking). Jawnie, bez progu heurystyki.
    const mmVal = (v: any, fallback: number): number => {
        if (v == null || !Number.isFinite(Number(v))) return fallback;
        return Number(v);
    };
    const nmVal = (v: any, fallback: number): number => {
        if (v == null || !Number.isFinite(Number(v))) return fallback;
        return nmToMm(Number(v));
    };

    const isBayDocked = Boolean(gp.detectedBay || gp.boundary || gp.parentContainerId);
    const bayDepthVal = gp.bayDepthMm != null ? gp.bayDepthMm : (gp.bayDepth != null ? nmVal(gp.bayDepth, 0) : undefined);
    const parsedBayDepth = (isBayDocked && bayDepthVal != null) ? mmVal(bayDepthVal, 0) : undefined;

    return {
        // rebuildSmartAppliance zapisuje te pola prosto z mm (patrz niżej).
        frontHeight: mmVal(gp.frontHeight, DEFAULT_MICROWAVE_PARAMS.frontHeight),
        nalGoraMicro: mmVal(gp.nalGoraMicro, DEFAULT_MICROWAVE_PARAMS.nalGoraMicro),
        nalDolneMicro: mmVal(gp.nalDolneMicro, DEFAULT_MICROWAVE_PARAMS.nalDolneMicro),
        frontWidth: mmVal(gp.frontWidth, DEFAULT_MICROWAVE_PARAMS.frontWidth),
        frontDepth: mmVal(gp.frontDepth, DEFAULT_MICROWAVE_PARAMS.frontDepth),
        corpusWidth: mmVal(gp.corpusWidth, DEFAULT_MICROWAVE_PARAMS.corpusWidth),
        corpusDepth: mmVal(gp.corpusDepth, DEFAULT_MICROWAVE_PARAMS.corpusDepth),
        bayDepth: parsedBayDepth && parsedBayDepth > 0 ? parsedBayDepth : undefined,
    };
}

/**
 * Przebudowuje i synchronizuje panele B-rep urządzenia AGD.
 */
export function rebuildSmartAppliance(container: ContainerModel, docTarget?: any): boolean {
    if (!isSmartApplianceContainer(container)) return false;
    ensureSmartApplianceGeneratorParams(container);

    const doc = docTarget || ContextManager.instance.document;
    if (!doc) return false;

    const cntNode = doc.findNode(container.id);
    if (!cntNode) return false;

    const p = getApplianceParamsMm(container);
    const { parts, corpusHeight } = planMicrowave(p);

    // Zaktualizuj gabaryty kontenera w domenowych jednostkach (nm)
    const isBayDocked = Boolean(container.generatorParams?.detectedBay || container.generatorParams?.boundary || container.generatorParams?.parentContainerId);
    if (isBayDocked && container.generatorParams?.bayWidthMm) {
        container.width = mmToNm(container.generatorParams.bayWidthMm);
        container.height = mmToNm(container.generatorParams.bayHeightMm || p.frontHeight);
        container.depth = mmToNm(container.generatorParams.bayDepthMm || (p.corpusDepth + p.frontDepth));
    } else {
        container.width = mmToNm(Math.max(p.frontWidth, p.corpusWidth));
        container.height = mmToNm(p.frontHeight);
        container.depth = mmToNm(p.corpusDepth + p.frontDepth);
    }

    if (container.generatorParams) {
        container.generatorParams.corpusHeight = corpusHeight;
        container.generatorParams.frontHeight = p.frontHeight;
        container.generatorParams.nalGoraMicro = p.nalGoraMicro;
        container.generatorParams.nalDolneMicro = p.nalDolneMicro;
        container.generatorParams.frontWidth = p.frontWidth;
        container.generatorParams.frontDepth = p.frontDepth;
        container.generatorParams.corpusWidth = p.corpusWidth;
        container.generatorParams.corpusDepth = p.corpusDepth;
    }

    const activeIds = new Set<string>();

    for (const part of parts) {
        // Znajdź istniejący panel B-rep po partKey
        let panelNode = cntNode.children.find((c: any) => {
            const d = c.domainData;
            return d && d.custom_properties?.partKey === part.custom_properties.partKey;
        });

        let panel = panelNode ? (panelNode.domainData as PanelModel) : null;

        // Wymiary B-rep w mm: X=szerokość, Z=wysokość, Y=grubość
        const bbWidth = part.dim.x;
        const bbHeight = part.dim.z;
        const bbThickness = part.dim.y;

        if (panel && panelNode) {
            panel.name = part.name;
            panel.role = part.role;
            panel.color = { ...part.color };
            panel.setDimensions(mmToNm(bbWidth), mmToNm(bbHeight), mmToNm(bbThickness));
            panel.custom_properties = {
                ...(panel.custom_properties || {}),
                ...part.custom_properties,
            };
            panelNode.name = part.name;
            panelNode.setLocalTransform(
                new Vec3(mmToNm(part.loc.x), mmToNm(part.loc.y), mmToNm(part.loc.z)),
                Quat.IDENTITY
            );
            activeIds.add(panel.id);
        } else {
            // Utwórz nowy panel B-rep
            panel = new PanelModel({
                width: mmToNm(bbWidth),
                height: mmToNm(bbHeight),
                thickness: mmToNm(bbThickness),
                role: part.role,
                name: part.name,
                color: { ...part.color },
            });
            panel.custom_properties = {
                ...(panel.custom_properties || {}),
                ...part.custom_properties,
            };
            panel.parentId = container.id;

            panelNode = CADNode.create(NodeType.PART, panel.name, panel.id);
            panelNode.domainData = panel;
            panelNode.setLocalTransform(
                new Vec3(mmToNm(part.loc.x), mmToNm(part.loc.y), mmToNm(part.loc.z)),
                Quat.IDENTITY
            );

            doc.addNode(container.id, panelNode);
            activeIds.add(panel.id);
        }
    }

    // Usuń niepotrzebne węzły
    for (const child of [...cntNode.children]) {
        if (child.nodeType !== NodeType.PART) continue;
        const d = child.domainData as any;
        if (d?.custom_properties?.domain === 'appliance_part' && !activeIds.has(d?.id)) {
            doc.removeNode(child.id);
        }
    }

    doc.emitChange?.('dimensions');
    if (typeof window !== 'undefined') {
        if (typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
        window.dispatchEvent(new CustomEvent('bloki-project-changed'));
        if (typeof (window as any).__rebuildGeometry === 'function') {
            (window as any).__rebuildGeometry('Zaktualizowano AGD');
        }
        ContextManager.instance.viewport?.requestRender?.(10);
    }
    return true;
}

export interface CreateApplianceOptions {
    kind?: ApplianceKind;
    name?: string;
    position?: { x: number; y: number; z?: number };
    params?: Partial<MicrowaveParamsMm>;
    targetCabinetId?: string;
}

/**
 * Tworzy i wstawia nowe parametryczne urządzenie AGD do projektu CAD.
 */
export function createSmartAppliance(
    options: CreateApplianceOptions = {},
    docTarget?: any
): CADNode | null {
    const doc = docTarget || ContextManager.instance.document;
    if (!doc) return null;

    const kind = options.kind || 'MICROWAVE';
    const name = options.name || (kind === 'MICROWAVE' ? 'Mikrofala' : 'Piekarnik');

    const mergedParams: MicrowaveParamsMm = {
        ...DEFAULT_MICROWAVE_PARAMS,
        ...(options.params || {}),
    };

    const container = new ContainerModel({
        name,
        width: mmToNm(mergedParams.frontWidth),
        height: mmToNm(mergedParams.frontHeight),
        depth: mmToNm(mergedParams.corpusDepth + mergedParams.frontDepth),
    });

    (container as any).role = 'APPLIANCE';
    container.generatorParams = {
        type: SMART_APPLIANCE_TYPE,
        kind,
        ...mergedParams,
    };

    const cntNode = CADNode.create(NodeType.ASSEMBLY, container.name, container.id);
    cntNode.domainData = container;

    const posX = options.position?.x ?? 0;
    const posY = options.position?.y ?? 0;
    const posZ = options.position?.z ?? 0;

    cntNode.setLocalTransform(
        new Vec3(mmToNm(posX), mmToNm(posY), mmToNm(posZ)),
        Quat.IDENTITY
    );

    // Podepnij pod docelową szafkę lub do korzenia pokoju
    const parentId = options.targetCabinetId || doc.rootNode?.id || 'root_room';
    doc.addNode(parentId, cntNode);

    // Zbuduj geometrię paneli B-rep
    rebuildSmartAppliance(container, doc);

    // Ustaw jako aktywny element i odśwież widok
    doc.setActiveEntity?.(container);
    doc.emitChange?.('all');

    // Powiadom o zmianie w aplikacji CAD i natychmiast przebuduj geometrię 3D
    if (typeof window !== 'undefined') {
        if (typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
        window.dispatchEvent(new CustomEvent('bloki-project-changed'));
        if (typeof (window as any).__rebuildGeometry === 'function') {
            (window as any).__rebuildGeometry('Wstawiono AGD');
        }
        ContextManager.instance.viewport?.requestRender?.(10);
        window.dispatchEvent(new CustomEvent('bloki-properties-update', {
            detail: { kind: 'container', containerId: container.id }
        }));
    }

    return cntNode;
}
