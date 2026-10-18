/**
 * sync-flaps-drillings-command.ts
 *
 * Komenda aktualizująca nawiercenia prowadników zawiasów klap na formatkach korpusu.
 * Po migracji MACHINING logika syncu (snapshot → clear → upsert → emit → undo) leży we
 * wspólnym rdzeniu machining-sync.ts — komenda podaje tylko builder intencji i tag własności.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { buildFlapsDrillings } from '../12_flaps-drilling-builder.js';
import {
    emitMachiningFeatures,
    restoreMachiningFeatures,
    syncMachiningHoles,
} from '../01_machining-sync.js';

export class SyncFlapsDrillingsCommand implements Command {
    readonly id: string;
    readonly label: string = 'Aktualizacja nawierceń zawiasów klap';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly cabinetContainerId?: string;

    private oldFeatures: Map<string, any[]> = new Map();

    constructor(cabinetContainerId?: string) {
        this.id = `cmd_sync_flaps_drillings_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.cabinetContainerId = cabinetContainerId;
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        if (!document) return;

        // 1. Wylicz intencje nawierceń ze Bloku (Klapy) — warstwa MACHINING
        const intents = buildFlapsDrillings(document, this.cabinetContainerId);

        // 2. Zidentyfikuj formatki scope (korpus, jeśli podano)
        let panels = typeof document.getPanels === 'function' ? document.getPanels() : [];
        if (this.cabinetContainerId) {
            panels = panels.filter((p: any) =>
                p.parent?.id === this.cabinetContainerId ||
                p.domainData?.cabinetId === this.cabinetContainerId ||
                p.parentContainerId === this.cabinetContainerId
            );
        }

        // 3+4. Clear własnych automatów + upsert intencji — wspólny rdzeń MACHINING
        const changedNodeIds = syncMachiningHoles(
            document,
            intents,
            panels,
            'isFlapDrilling',
            this.oldFeatures,
        );

        this.affectedNodeIds.push(...Array.from(changedNodeIds));

        // 5. Powiadom panele o zmianie features (Babylon PanelView)
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
