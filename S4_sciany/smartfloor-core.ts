/**
 * smartfloor-core — rebuild SmartFloor: 1× PART (FLOOR) pod kontenerem.
 * Kontener stoi bezpośrednio pod ROOM (obok SmartWall, nie w środku).
 * Płyta pozioma: W×D×T, góra na Z=0 → środek na Z=-T/2.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { PanelModel, isManualPanel } from '../A4_smartpanel/panel-model.js';
import { WALL_SURFACE_EDGE_BANDING } from './walls-engine.js';
import {
    SMARTFLOOR_TYPE,
    FLOOR_DEFAULT_COLOR,
    isSmartFloorContainer,
    isFloorPart,
    type SmartFloorParamsMm,
} from './smartfloor-types.js';

export function ensureSmartFloorGeneratorParams(container: any): void {
    if (!container.generatorParams) container.generatorParams = {};
    container.generatorParams.type = SMARTFLOOR_TYPE;
}

function gpMm(container: any): SmartFloorParamsMm {
    const gp = container.generatorParams || {};
    // Wszystko stamtąd jest w nm: gp.floor* = container.* (zob. applyFloor, niżej),
    // a container.* to model CAD. Jawnie, bez progu heurystyki.
    const nmVal = (v: number | undefined, fallback: number) =>
        (v == null || !Number.isFinite(v) ? fallback : nmToMm(v));
    return {
        floorWidth: nmVal(gp.floorWidth ?? container.width, 4000),
        floorDepth: nmVal(gp.floorDepth ?? container.depth, 3000),
        floorThickness: nmVal(gp.floorThickness ?? container.height, 50),
    };
}

function applyFloorToPanel(panel: PanelModel, p: SmartFloorParamsMm): void {
    panel.name = 'Podłoga';
    panel.role = 'FLOOR';
    (panel as any).key = 'FLOOR';
    panel.setDimensions(mmToNm(p.floorWidth), mmToNm(p.floorDepth), mmToNm(p.floorThickness));
    panel.setEdgeBanding(WALL_SURFACE_EDGE_BANDING);
    (panel as any).color = { ...FLOOR_DEFAULT_COLOR };
    if ((panel as any).frozen) {
        panel.visible = false;
    }
    (panel as any).custom_properties = {
        ...(panel.custom_properties || {}),
        excludeFromProduction: true,
        domain: 'floor_segment',
        shape: 'floor',
    };
}

/**
 * Synchronizuje dziecko FLOOR z parametrami kontenera.
 * Zwraca true gdy kontener jest smartfloor i przebudowa się wykonała.
 */
export function rebuildSmartFloor(container: any, doc?: any): boolean {
    if (!isSmartFloorContainer(container)) return false;
    ensureSmartFloorGeneratorParams(container);

    const document = doc || ContextManager.instance.document;
    const cntNode = document?.findNode(container.id);
    if (!cntNode) return false;

    const p = gpMm(container);
    container.width = mmToNm(p.floorWidth);
    container.depth = mmToNm(p.floorDepth);
    container.height = mmToNm(p.floorThickness);
    // gp w nm (SSOT)
    container.generatorParams.floorWidth = container.width;
    container.generatorParams.floorDepth = container.depth;
    container.generatorParams.floorThickness = container.height;

    // Góra płyty na Z=0 (równo ze spodem ścian) → środek na -T/2.
    // Rx90 jak półka w Bloki: kładzie formatkę płasko (grubość → góra).
    const loc = new Vec3(0, 0, mmToNm(-p.floorThickness / 2));
    const flatRot = Quat.fromEulerXYZ(Math.PI / 2, 0, 0);

    let panel = cntNode.children
        .map((c: any) => c.domainData)
        .find((d: any) => d && !isManualPanel(d) && ((d as any).key === 'FLOOR' || isFloorPart(d)));

    const panelNode = panel ? document.findNode(panel.id) : null;

    if (panel && panelNode) {
        applyFloorToPanel(panel, p);
        panelNode.name = 'Podłoga';
        panelNode.setLocalTransform(loc, flatRot);
    } else {
        panel = new PanelModel({
            width: mmToNm(p.floorWidth),
            height: mmToNm(p.floorDepth),
            thickness: mmToNm(p.floorThickness),
            role: 'FLOOR',
            name: 'Podłoga',
            color: { ...FLOOR_DEFAULT_COLOR },
        });
        applyFloorToPanel(panel, p);
        const node = CADNode.create(NodeType.PART, panel.name, panel.id);
        node.domainData = panel;
        node.setLocalTransform(loc, flatRot);
        document.addNode(container.id, node);
    }

    for (const child of [...cntNode.children]) {
        if (child.nodeType !== NodeType.PART) continue;
        const d = child.domainData as any;
        if (isManualPanel(d)) continue;
        if (d?.id !== (panel as PanelModel).id) {
            document.removeNode(child.id);
        }
    }

    return true;
}

export function syncAllSmartFloors(doc: any, containers: any[]): void {
    for (const c of containers) {
        if (isSmartFloorContainer(c)) {
            rebuildSmartFloor(c, doc);
        }
    }
}
