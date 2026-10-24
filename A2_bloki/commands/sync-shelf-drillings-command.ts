/**
 * sync-shelf-drillings-command.ts
 *
 * Komenda aktualizująca nawiercenia półek i Systemu 32 na formatkach korpusu.
 * Po migracji MACHINING logika syncu leży we wspólnym rdzeniu machining-sync.ts —
 * komenda podaje tylko builder intencji i tag własności isShelfDrilling.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { buildShelvesDrillings } from '../04_shelves-drilling-builder.js';
import { buildCornerShelvesDrillings } from '../18_corner-shelves-drilling-builder.js';
import {
    emitMachiningFeatures,
    restoreMachiningFeatures,
    syncMachiningHoles,
} from '../01_machining-sync.js';

export class SyncShelfDrillingsCommand implements Command {
    readonly id: string;
    readonly label: string = 'Aktualizacja nawierceń półek';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly cabinetContainerId?: string;

    private oldFeatures: Map<string, any[]> = new Map();

    constructor(cabinetContainerId?: string) {
        this.id = `cmd_sync_shelf_drillings_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.cabinetContainerId = cabinetContainerId;
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        if (!document) return;

        // 1. Wylicz intencje nawierceń ze Bloku (Półki standardowe i narożne) — warstwa MACHINING
        const intents = [
            ...buildShelvesDrillings(document, this.cabinetContainerId),
            ...buildCornerShelvesDrillings(document, this.cabinetContainerId)
        ];

        // 2. Zidentyfikuj formatki (jeśli podano cabinetContainerId, tylko tego korpusu)
        let panels: any[];
        if (this.cabinetContainerId) {
            const cabNode = document.findNode(this.cabinetContainerId);
            if (cabNode) {
                panels = [];
                const collect = (n: any) => {
                    if (n.domainData && n.domainData.type !== 'container') panels.push(n);
                    for (const ch of n.children) collect(ch);
                };
                collect(cabNode);
            } else {
                panels = typeof document.getPanels === 'function' ? document.getPanels() : [];
            }
        } else {
            panels = typeof document.getPanels === 'function' ? document.getPanels() : [];
        }

        // 3+4. Clear starych automatów isShelfDrilling + upsert intencji — wspólny rdzeń MACHINING
        const changedNodeIds = syncMachiningHoles(
            document,
            intents,
            panels,
            'isShelfDrilling',
            this.oldFeatures,
        );

        this.affectedNodeIds.push(...Array.from(changedNodeIds));

        // 5. Powiadom panele o zmianie features, by Babylon PanelView od razu odrysował otwory
        emitMachiningFeatures(panels, changedNodeIds);

        // 6. Powiadom o zmianie dokumentu
        if (typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
    }

    undo(document: ProjectDocument): void {
        if (!document) return;
        restoreMachiningFeatures(document, this.oldFeatures);
    }
}

