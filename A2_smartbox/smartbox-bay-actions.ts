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

export type SmartBoxCategory = 'internal' | 'external';

export interface SmartBoxOption {
    id: string;
    type: string;
    label: string;
    category: SmartBoxCategory;
    icon?: string;
    description?: string;
}

export const SMARTBOX_INTERNAL_OPTIONS: SmartBoxOption[] = [
    { id: 'SHELVES', type: 'smartbox_shelves', label: 'Półki', category: 'internal' },
    { id: 'DOORS', type: 'smartbox_doors', label: 'Drzwi', category: 'internal' },
    { id: 'DRAWERS', type: 'smartbox_drawers', label: 'Szuflady', category: 'internal' },
    { id: 'FLAPS', type: 'smartbox_flaps', label: 'Klapy', category: 'internal' },
    { id: 'DIVIDERS', type: 'smartbox_dividers', label: 'Przegrody', category: 'internal' },
    { id: 'TUBES', type: 'smartbox_tubes', label: 'Drążek', category: 'internal' },
    { id: 'SHELF', type: 'smartbox_shelf', label: 'Wieniec', category: 'internal' }
];

export const SMARTBOX_EXTERNAL_OPTIONS: SmartBoxOption[] = [
    { id: 'PANELS', type: 'smartbox_panels', label: 'Blendy', category: 'external' }
];

export const SMARTBOX_ALL_OPTIONS: SmartBoxOption[] = [
    ...SMARTBOX_INTERNAL_OPTIONS,
    ...SMARTBOX_EXTERNAL_OPTIONS
];

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

export const SMARTBOX_CATEGORY_NAMES: Record<string, string> = {
    'EMPTY': 'smartbox_',
    'SHELVES': 'smartbox_polki',
    'DRAWERS': 'smartbox_szuflady',
    'DOORS': 'smartbox_drzwi',
    'TUBES': 'smartbox_drazek',
    'SHELF': 'smartbox_wieniec',
    'DIVIDERS': 'smartbox_przegrody',
    'FLAPS': 'smartbox_klapy',
    'PANELS': 'smartbox_blendy'
};

import { Command } from '../A1_core/commands/command.js';
import { SyncShelfDrillingsCommand } from '../A1_core/commands/sync-shelf-drillings-command.js';
import { SyncDoorDrillingsCommand } from '../A1_core/commands/sync-door-drillings-command.js';
import { SyncDrawerDrillingsCommand } from '../A1_core/commands/sync-drawer-drillings-command.js';
import { SyncFlapsDrillingsCommand } from '../A1_core/commands/sync-flaps-drillings-command.js';
import { ClearSmartBoxDrillingsCommand } from '../A1_core/commands/clear-smartbox-drillings-command.js';

export class InsertSmartBoxCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[] = [];

    private _addCmd: AddNodeCommand;
    private _targetParentId: string;
    private _sbNode: CADNode;
    private _sbContainer: ContainerModel;

    constructor(targetParentId: string, sbNode: CADNode, label: string) {
        this.id = `cmd_insert_smartbox_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = label;
        this.timestamp = Date.now();
        this._targetParentId = targetParentId;
        this._sbNode = sbNode;
        this._sbContainer = sbNode.domainData as ContainerModel;
        this._addCmd = new AddNodeCommand(targetParentId, sbNode, undefined, label);
        this.affectedNodeIds.push(sbNode.id);
    }

    execute(document: ProjectDocument): void {
        this._addCmd.execute(document);
        update_smartbox_core(this._sbContainer, document);
    }

    undo(document: ProjectDocument): void {
        new ClearSmartBoxDrillingsCommand(this._sbNode.id).execute(document);
        this._addCmd.undo(document);
        new SyncShelfDrillingsCommand(this._targetParentId).execute(document);
        new SyncDoorDrillingsCommand(this._targetParentId).execute(document);
        new SyncDrawerDrillingsCommand(this._targetParentId).execute(document);
        new SyncFlapsDrillingsCommand(this._targetParentId).execute(document);
    }

    redo(document: ProjectDocument): void {
        this._addCmd.execute(document);
        update_smartbox_core(this._sbContainer, document);
    }
}

export function createSmartBoxInDetectedBay(
    document: ProjectDocument,
    bay: DetectedBay,
    option: SmartBoxOption,
    params?: SmartBoxModalParams
): CADNode | null {
    if (!document || !bay) return null;

    const sbName = SMARTBOX_CATEGORY_NAMES[option.id] || (option.id === 'EMPTY' ? 'smartbox_' : `smartbox_${(option.label || option.id).toLowerCase()}`);
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

    const isExternal = option.category === 'external' || option.id === 'PANELS';

    sbContainer.generatorParams = {
        type: option.type,
        boxType: option.id,
        parentContainerId: parentId,
        boundary: bay.boundary,
        targetZone: isExternal ? 'FULL' : undefined,
        side_references_smartbox: isExternal ? 'OUTER' : 'INNER',
        customReferences: {
            xMin: { partKey: leftRef.nodeName || 'Bok Lewy', face: leftRef.face || leftRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: leftRef.nodeId },
            xMax: { partKey: rightRef.nodeName || 'Bok Prawy', face: rightRef.face || rightRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: rightRef.nodeId },
            zMin: { partKey: bottomRef.nodeName || 'Dół', face: bottomRef.face || bottomRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: bottomRef.nodeId },
            zMax: { partKey: topRef.nodeName || 'Góra', face: topRef.face || topRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_MINUS'), panelId: topRef.nodeId },
            yMin: { partKey: frontRef.nodeName || 'Przód', face: frontRef.face || frontRef.faceName || 'FACE_X_PLUS', panelId: frontRef.nodeId },
            yMax: { partKey: backRef.nodeName || 'Tył', face: backRef.face || backRef.faceName || (isExternal ? 'FACE_Z_MINUS' : 'FACE_Z_PLUS'), panelId: backRef.nodeId }
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
    const insertCmd = new InsertSmartBoxCommand(targetParentId, sbNode, `Wstawienie SmartBox: ${option.label}`);
    if (cmdHist) {
        cmdHist.execute(insertCmd);
    } else {
        document.addNode(targetParentId, sbNode);
        update_smartbox_core(sbContainer, document);
    }

    document.setActiveEntity(sbContainer);
    if (typeof window !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
        window.document.dispatchEvent(new CustomEvent('smartbox-properties-update'));
    }

    return sbNode;
}
