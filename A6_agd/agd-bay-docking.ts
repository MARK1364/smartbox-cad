/**
 * A6_agd — agd-bay-docking.ts
 *
 * Dokowanie urządzeń AGD (SmartAppliance) we wnękach korpusu meblowego (Cabinet Bay).
 * Kontener AGD przyjmuje gabaryty wnęki (szerokość i głębokość wnęki meblowej),
 * baza to dolna półka/wieniec (Z=0), boki wnęki pozycjonują sprzęt idealnie symetrycznie (X=0),
 * a góra wnęki jest elastyczna/informacyjna (wysokość wnęki lub wysokość frontu).
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../A1_core/container-model.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { ContextManager } from '../A1_core/context-manager.js';
import type { DetectedBay } from '../A2_bloki/02_bloki-bay-detector.js';
import {
    SMART_APPLIANCE_TYPE,
    DEFAULT_MICROWAVE_PARAMS,
    DEFAULT_OVEN_PARAMS,
    type ApplianceKind,
    type MicrowaveParamsMm,
    type ApplianceTemplateItem,
} from './smart-appliance-types.js';
import { rebuildSmartAppliance } from './smart-appliance-core.js';

export interface DockApplianceOptions {
    kind?: ApplianceKind;
    name?: string;
    params?: Partial<MicrowaveParamsMm>;
    template?: ApplianceTemplateItem;
}

export function createSmartApplianceInDetectedBay(
    document: ProjectDocument,
    bay: DetectedBay,
    options: DockApplianceOptions = {}
): CADNode | null {
    if (!document || !bay) return null;

    const kind: ApplianceKind = options.kind || options.template?.kind || 'MICROWAVE';
    const defaultName = kind === 'MICROWAVE' ? 'Mikrofala' : 'Piekarnik';
    const name = options.name || options.template?.name || defaultName;

    const defaults = kind === 'MICROWAVE' ? DEFAULT_MICROWAVE_PARAMS : DEFAULT_OVEN_PARAMS;
    const mergedParams: MicrowaveParamsMm = {
        ...DEFAULT_MICROWAVE_PARAMS,
        ...defaults,
        ...(options.template?.defaultParams || {}),
        ...(options.params || {}),
    };

    const parentId = bay.parentCabinetId;
    const targetParentId = parentId || document.rootNode.id;

    // Kontener AGD ma gabaryty wnęki meblowej:
    // Szerokość: światło wnęki (od lewego do prawego boku)
    // Głębokość: głębokość wnęki
    // Wysokość: wysokość strefy/wnęki (jeśli jest górna półka) lub dopasowana do frontu
    const bayWidthNm = bay.boundsNm.width;
    const bayDepthNm = bay.boundsNm.depth;
    const bayHeightNm = bay.boundsNm.height > 0 ? bay.boundsNm.height : mmToNm(mergedParams.frontHeight);

    const container = new ContainerModel({
        name,
        width: bayWidthNm,
        height: bayHeightNm,
        depth: bayDepthNm,
    });

    (container as any).role = 'APPLIANCE';

    const leftRef = bay.boundary.left;
    const rightRef = bay.boundary.right;
    const bottomRef = bay.boundary.bottom;
    const topRef = bay.boundary.top;
    const backRef = bay.boundary.back;
    const frontRef = bay.boundary.front || leftRef;

    const customReferences = {
        xMin: { partKey: leftRef?.nodeName || 'Bok Lewy', face: leftRef?.face || 'FACE_Z_PLUS', panelId: leftRef?.nodeId },
        xMax: { partKey: rightRef?.nodeName || 'Bok Prawy', face: rightRef?.face || 'FACE_Z_PLUS', panelId: rightRef?.nodeId },
        zMin: { partKey: bottomRef?.nodeName || 'Dół', face: bottomRef?.face || 'FACE_Z_PLUS', panelId: bottomRef?.nodeId },
        zMax: { partKey: topRef?.nodeName || 'Góra', face: topRef?.face || 'FACE_Z_MINUS', panelId: topRef?.nodeId },
        yMin: { partKey: frontRef?.nodeName || 'Przód', face: frontRef?.face || 'FACE_X_PLUS', panelId: frontRef?.nodeId },
        yMax: { partKey: backRef?.nodeName || 'Tył', face: backRef?.face || 'FACE_Z_PLUS', panelId: backRef?.nodeId }
    };

    // detectedBay w generatorParams jest odchudzone — boundary jest już w generatorParams.boundary (SSOT)
    const slimDetectedBay = { ...bay };
    delete (slimDetectedBay as any).boundary;

    container.generatorParams = {
        type: SMART_APPLIANCE_TYPE,
        kind,
        boxType: 'APPLIANCE',
        parentContainerId: parentId,
        boundary: bay.boundary,
        detectedBay: slimDetectedBay,
        side_references_bloki: 'INNER',
        customReferences,
        bayWidthMm: Math.round(nmToMm(bayWidthNm)),
        bayHeightMm: Math.round(nmToMm(bayHeightNm)),
        bayDepthMm: Math.round(nmToMm(bayDepthNm)),
        ...mergedParams,
    };

    const cntNode = CADNode.create(NodeType.ASSEMBLY, container.name, container.id);
    cntNode.domainData = container;

    // Wyznacz lokalną pozycję kontenera w szafce (analogicznie do Bloki):
    // Lokalne Z=0 kontenera to spód wnęki (półka bazowa),
    // a X=0 to środek szerokości wnęki, Y=0 to środek głębokości wnęki.
    const parentNode = document.findNode(targetParentId);
    const bottomZMm = bay.boundary?.bottom?.planeCoordMm ?? (bay.centerWorldMm.z - bay.boundsMm.height / 2);

    let localPosNm = new Vec3(
        mmToNm(bay.centerWorldMm.x),
        mmToNm(bay.centerWorldMm.y),
        mmToNm(bottomZMm)
    );

    if (parentNode && parentNode.id !== document.rootNode.id) {
        const parentWorldInv = parentNode.getWorldMatrix().invert();
        localPosNm = parentWorldInv.transformPoint(localPosNm);
    }

    cntNode.setLocalTransform(localPosNm, Quat.IDENTITY);

    // Podepnij kontener pod szafkę
    document.addNode(targetParentId, cntNode);

    // Zbuduj geometrię B-rep mikrofali / piekarnika
    rebuildSmartAppliance(container, document);

    document.setActiveEntity?.(container);
    document.emitChange?.('all');

    if (typeof window !== 'undefined') {
        if (typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
        window.dispatchEvent(new CustomEvent('bloki-project-changed'));
        if (typeof (window as any).__rebuildGeometry === 'function') {
            (window as any).__rebuildGeometry('Zadokowano AGD we wnęce');
        }
        ContextManager.instance.viewport?.requestRender?.(10);
        window.dispatchEvent(new CustomEvent('bloki-properties-update', {
            detail: { kind: 'container', containerId: container.id }
        }));
    }

    return cntNode;
}
