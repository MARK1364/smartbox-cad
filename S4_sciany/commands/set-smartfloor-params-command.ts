/**
 * Zmiana wymiarów SmartFloor + rebuild (jedna komenda undo).
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { rebuildSmartFloor } from '../smartfloor-core.js';
import type { SmartFloorParamsMm } from '../smartfloor-types.js';

export type SmartFloorParamsSnapshotMm = SmartFloorParamsMm;

function readSnapshotMm(container: any): SmartFloorParamsSnapshotMm {
    const gp = container.generatorParams || {};
    // gp.floor* zapisuje writeSnapshotNm przez mmToNm → nm. Jawnie, bez progu.
    const nmVal = (v: number | undefined, fb: number) =>
        (v == null || !Number.isFinite(v) ? fb : nmToMm(v));
    return {
        floorWidth: nmVal(gp.floorWidth ?? container.width, 4000),
        floorDepth: nmVal(gp.floorDepth ?? container.depth, 3000),
        floorThickness: nmVal(gp.floorThickness ?? container.height, 50),
    };
}

function writeSnapshotNm(container: any, snap: SmartFloorParamsSnapshotMm): void {
    if (!container.generatorParams) container.generatorParams = {};
    const gp = container.generatorParams;
    gp.floorWidth = mmToNm(snap.floorWidth);
    gp.floorDepth = mmToNm(snap.floorDepth);
    gp.floorThickness = mmToNm(snap.floorThickness);
    container.width = gp.floorWidth;
    container.depth = gp.floorDepth;
    container.height = gp.floorThickness;
}

export class SetSmartFloorParamsCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly containerId: string;
    private readonly before: SmartFloorParamsSnapshotMm;
    private readonly after: SmartFloorParamsSnapshotMm;

    constructor(containerId: string, before: SmartFloorParamsSnapshotMm, after: SmartFloorParamsSnapshotMm) {
        this.containerId = containerId;
        this.before = before;
        this.after = after;
        this.id = `cmd_set_smartfloor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = 'Wymiary podłogi';
        this.timestamp = Date.now();
        this.affectedNodeIds = [containerId];
    }

    static snapshotFrom(container: any): SmartFloorParamsSnapshotMm {
        return readSnapshotMm(container);
    }

    private apply(document: ProjectDocument, snap: SmartFloorParamsSnapshotMm): void {
        const node = document.findNode(this.containerId);
        const container = node?.domainData as any;
        if (!container) return;
        writeSnapshotNm(container, snap);
        rebuildSmartFloor(container, document);
        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    }

    execute(document: ProjectDocument): void {
        this.apply(document, this.after);
    }

    undo(document: ProjectDocument): void {
        this.apply(document, this.before);
    }
}
