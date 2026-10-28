/**
 * A2_bloki/commands/sync-hangers-drillings-command.ts
 *
 * Komenda aktualizująca nawiercenia i wycięcia zawieszek na formatkach korpusu.
 * Po migracji MACHINING logika syncu leży we wspólnym rdzeniu machining-sync.ts —
 * komenda podaje tylko builder intencji i tag własności isHangerDrilling.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { buildHangersDrillings } from '../17_hangers-drilling-builder.js';
import {
    emitMachiningFeatures,
    restoreMachiningFeatures,
    syncMachiningHoles,
} from '../01_machining-sync.js';

export class SyncHangersDrillingsCommand implements Command {
    readonly id: string;
    readonly label: string = 'Aktualizacja nawierceń zawieszek';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly cabinetContainerId?: string;

    private oldFeatures: Map<string, any[]> = new Map();

    constructor(cabinetContainerId?: string) {
        this.id = `cmd_sync_hangers_drillings_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.cabinetContainerId = cabinetContainerId;
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        if (!document) return;

        // 1. Wylicz intencje nawierceń ze Bloku (Zawieszki) — warstwa MACHINING
        const intents = buildHangersDrillings(document, this.cabinetContainerId);

        // 2. Zidentyfikuj formatki scope (korpus, jeśli podano)
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

        // 3+4. Clear starych automatów isHangerDrilling + upsert intencji — wspólny rdzeń MACHINING
        const changedNodeIds = syncMachiningHoles(
            document,
            intents,
            panels,
            'isHangerDrilling',
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
