/**
 * smartbox-bay-actions.ts
 *
 * Akcje tworzenia i konfiguracji SmartBoxa na podstawie wykrytej wnęki.
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../A1_core/container-model.js';
import { AddNodeCommand } from '../A1_core/commands/add-node-command.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { mmToNm } from '../A1_core/cad-math/units.js';
import type { DetectedBay } from './smartbox-bay-detector.js';
import { update_smartbox_core } from './smartbox-core.js';

export interface SmartBoxOption {
    id: string;
    type: string;
    label: string;
    icon?: string;
    description?: string;
}

export interface SmartBoxModalParams {
    shelfCount?: number;
    shelfOffsetFrontMm?: number;
    drawerCount?: number;
    drawerGapMm?: number;
    doorType?: 'SINGLE_LEFT' | 'SINGLE_RIGHT' | 'DOUBLE';
    doorGapMm?: number;
    flapType?: 'UP' | 'DOWN';
    dividerCount?: number;
    tubeOffsetTopMm?: number;
}

export function createSmartBoxInDetectedBay(
    document: ProjectDocument,
    bay: DetectedBay,
    option: SmartBoxOption,
    params?: SmartBoxModalParams
): CADNode | null {
    if (!document || !bay) return null;

    const sbName = option.id === 'EMPTY' ? 'SmartBox' : `SmartBox_${option.label}`;
    const parentId = bay.parentCabinetId;
    const targetParentId = parentId || document.rootNode.id;

    // 1. Tworzymy domenowy ContainerModel
    const sbContainer = new ContainerModel({
        name: sbName,
        width: bay.boundsNm.width,
        height: bay.boundsNm.height,
        depth: bay.boundsNm.depth
    });

    const leftRef = bay.boundary.left;
    const rightRef = bay.boundary.right;
    const bottomRef = bay.boundary.bottom;
    const topRef = bay.boundary.top;
    const backRef = bay.boundary.back;
    const frontRef = bay.boundary.front || leftRef;

    sbContainer.generatorParams = {
        type: option.type,
        boxType: option.id,
        parentContainerId: parentId,
        boundary: bay.boundary,
        customReferences: {
            xMin: { partKey: leftRef.nodeName || 'Bok Lewy', face: leftRef.face || 'FACE_Z_PLUS', panelId: leftRef.nodeId },
            xMax: { partKey: rightRef.nodeName || 'Bok Prawy', face: rightRef.face || 'FACE_Z_PLUS', panelId: rightRef.nodeId },
            zMin: { partKey: bottomRef.nodeName || 'Dół', face: bottomRef.face || 'FACE_Z_PLUS', panelId: bottomRef.nodeId },
            zMax: { partKey: topRef.nodeName || 'Góra', face: topRef.face || 'FACE_Z_MINUS', panelId: topRef.nodeId },
            yMin: { partKey: frontRef.nodeName || 'Przód', face: frontRef.face || 'FACE_Y_MINUS', panelId: frontRef.nodeId },
            yMax: { partKey: backRef.nodeName || 'Tył', face: backRef.face || 'FACE_Z_PLUS', panelId: backRef.nodeId }
        },
        offsets: {
            xMin: 0,
            xMax: 0,
            yMin: 0,
            yMax: 0,
            zMin: 0,
            zMax: 0
        },
        shelfCount: params?.shelfCount ?? (option.id === 'SHELVES' ? 3 : undefined),
        shelfOffsetFrontMm: params?.shelfOffsetFrontMm,
        drawerCount: params?.drawerCount ?? (option.id === 'DRAWERS' ? 3 : undefined),
        drawerGapMm: params?.drawerGapMm,
        doorType: params?.doorType ?? (option.id === 'DOORS' ? 'SINGLE_LEFT' : undefined),
        doorGapMm: params?.doorGapMm,
        flapType: params?.flapType,
        dividerCount: params?.dividerCount,
        tubeOffsetTopMm: params?.tubeOffsetTopMm,
    };

    // 2. Tworzymy węzeł CADNode dla kontenera
    const sbNode = CADNode.create(NodeType.ASSEMBLY, sbName, sbContainer.id);
    sbNode.domainData = sbContainer;

    // 3. Pozycja lokalna TRS względem nadrzędnego korpusu (a nie ślepe współrzędne świata)
    // Ważne: w CAD i ContainerView lokalne Z=0 kontenera to jego spód (nie środek geometryczny wysokości).
    const parentNode = document.findNode(targetParentId);
    const bottomZMm = bay.boundary?.bottom?.planeCoordMm ?? (bay.centerWorldMm.z - bay.boundsMm.height / 2);
    let localPosNm = new Vec3(mmToNm(bay.centerWorldMm.x), mmToNm(bay.centerWorldMm.y), mmToNm(bottomZMm));
    if (parentNode && parentNode.id !== document.rootNode.id) {
        const parentWorldInv = parentNode.getWorldMatrix().invert();
        localPosNm = parentWorldInv.transformPoint(localPosNm);
    }
    sbNode.setLocalTransform(localPosNm, Quat.IDENTITY);

    // 4. Dodanie do dokumentu przez CommandHistory (wsparcie Undo/Redo)
    const cmdHist = ContextManager.instance.commandHistory;
    const addCmd = new AddNodeCommand(targetParentId, sbNode, undefined, `Wstawienie SmartBox: ${option.label}`);
    if (cmdHist) {
        cmdHist.execute(addCmd);
    } else {
        document.addNode(targetParentId, sbNode);
    }

    // 5. Wygenerowanie geometrii wewnętrznej (półki/szuflady) i synchronizacja nawierceń
    update_smartbox_core(sbContainer, document);

    document.setActiveEntity(sbContainer);
    if (typeof window !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
        window.document.dispatchEvent(new CustomEvent('smartbox-properties-update'));
    }

    return sbNode;
}
