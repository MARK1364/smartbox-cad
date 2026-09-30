/**
 * Zmiana parametrów SmartWall + rebuild (jedna komenda undo).
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { rebuildSmartWall } from '../smartwall-core.js';
import type { SmartWallFillMm, SmartWallPreset } from '../smartwall-types.js';

export interface SmartWallParamsSnapshotMm {
    preset: SmartWallPreset;
    roomWidth: number;
    roomDepth: number;
    wallHeight: number;
    wallThickness: number;
    singleLength?: number;
    uskokGapStart?: number;
    uskokGapEnd?: number;
    skosLength: number;
    skosHeightLeft: number;
    skosHeightRight: number;
    skosSlant: 'top' | 'bottom';
    fills: SmartWallFillMm[];
}

function readSnapshotMm(container: any): SmartWallParamsSnapshotMm {
    const gp = container.generatorParams || {};
    // gp.* zapisuje writeSnapshotNm przez mmToNm → nm. Jawnie, bez progu.
    const nmVal = (v: number | undefined, fb: number) =>
        (v == null || !Number.isFinite(v) ? fb : nmToMm(v));
    return {
        preset: (gp.preset || 'rect') as SmartWallPreset,
        roomWidth: nmVal(gp.roomWidth ?? container.width, 4000),
        roomDepth: nmVal(gp.roomDepth ?? container.depth, 3000),
        wallHeight: nmVal(gp.wallHeight ?? container.height, 2700),
        wallThickness: nmVal(gp.wallThickness, 100),
        singleLength: gp.singleLength != null ? nmVal(gp.singleLength, 3000) : undefined,
        uskokGapStart: gp.uskokGapStart != null ? nmVal(gp.uskokGapStart, 1000) : undefined,
        uskokGapEnd: gp.uskokGapEnd != null ? nmVal(gp.uskokGapEnd, 1500) : undefined,
        skosLength: nmVal(gp.skosLength, 2000),
        skosHeightLeft: nmVal(gp.skosHeightLeft, 1800),
        skosHeightRight: nmVal(gp.skosHeightRight, 900),
        skosSlant: gp.skosSlant === 'top' ? 'top' : 'bottom',
        fills: Array.isArray(gp.fills) ? gp.fills.map((f: any) => ({ ...f })) : [],
    };
}

function writeSnapshotNm(container: any, snap: SmartWallParamsSnapshotMm): void {
    if (!container.generatorParams) container.generatorParams = {};
    const gp = container.generatorParams;
    gp.preset = snap.preset;
    gp.roomWidth = mmToNm(snap.roomWidth);
    gp.roomDepth = mmToNm(snap.roomDepth);
    gp.wallHeight = mmToNm(snap.wallHeight);
    gp.wallThickness = mmToNm(snap.wallThickness);
    gp.skosLength = mmToNm(snap.skosLength);
    gp.skosHeightLeft = mmToNm(snap.skosHeightLeft);
    gp.skosHeightRight = mmToNm(snap.skosHeightRight);
    gp.skosSlant = snap.skosSlant;
    gp.fills = snap.fills.map((f) => ({ ...f }));
    if (snap.singleLength != null) gp.singleLength = mmToNm(snap.singleLength);
    else delete gp.singleLength;
    if (snap.uskokGapStart != null) gp.uskokGapStart = mmToNm(snap.uskokGapStart);
    else delete gp.uskokGapStart;
    if (snap.uskokGapEnd != null) gp.uskokGapEnd = mmToNm(snap.uskokGapEnd);
    else delete gp.uskokGapEnd;
    if (snap.preset === 'skos') {
        container.width = gp.skosLength;
        container.height = mmToNm(Math.max(snap.skosHeightLeft, snap.skosHeightRight));
        container.depth = gp.wallThickness;
    } else {
        container.width = gp.roomWidth;
        container.height = gp.wallHeight;
        container.depth = gp.roomDepth;
    }
}

export class SetSmartWallParamsCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly containerId: string;
    private readonly before: SmartWallParamsSnapshotMm;
    private readonly after: SmartWallParamsSnapshotMm;

    constructor(containerId: string, before: SmartWallParamsSnapshotMm, after: SmartWallParamsSnapshotMm) {
        this.containerId = containerId;
        this.before = before;
        this.after = after;
        this.id = `cmd_set_smartwall_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = 'Parametry SmartWall';
        this.timestamp = Date.now();
        this.affectedNodeIds = [containerId];
    }

    static snapshotFrom(container: any): SmartWallParamsSnapshotMm {
        return readSnapshotMm(container);
    }

    private apply(document: ProjectDocument, snap: SmartWallParamsSnapshotMm): void {
        const node = document.findNode(this.containerId);
        const container = node?.domainData as any;
        if (!container) return;
        writeSnapshotNm(container, snap);
        rebuildSmartWall(container, document);
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
