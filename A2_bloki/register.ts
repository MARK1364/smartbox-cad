/**
 * Rejestracja A2 w Core: gizmy offsetu + sprzątanie nawierceń przy usunięciu węzła.
 */

import { registerNodeCleanupHandler } from '../A1_core/node-cleanup-port.js';
import { registerBlokiOffsetGizmo } from './bloki-offset-gizmo.js';
import {
    ClearBlokiDrillingsCommand,
    collectBlokiIds
} from './commands/clear-blok-drillings-command.js';
import { registerKorpusRebuiltListener } from '../A1_core/cabinet-port.js';
import { SyncShelfDrillingsCommand } from './commands/sync-shelf-drillings-command.js';
import { SyncDoorDrillingsCommand } from './commands/sync-door-drillings-command.js';
import { SyncSkosneDoorsDrillingsCommand } from './commands/sync-skosne-doors-drillings-command.js';
import { SyncDrawerDrillingsCommand } from './commands/sync-drawer-drillings-command.js';
import { SyncFlapsDrillingsCommand } from './commands/sync-flaps-drillings-command.js';
import { SyncTubesDrillingsCommand } from './commands/sync-tubes-drillings-command.js';
import { SyncHangersDrillingsCommand } from './commands/sync-hangers-drillings-command.js';
import { BlokiBayController } from './bloki-bay-controller.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { update_bloki_core } from './bloki-core.js';

import { registerAllBlokiModules } from './bootstrap-bloki-modules.js';

export function registerBlokiModule(): void {
    registerAllBlokiModules();
    registerBlokiOffsetGizmo();
    ContextManager.instance.blokiBayController = new BlokiBayController();
    registerNodeCleanupHandler({
        id: 'A2_bloki',
        collectIds: collectBlokiIds,
        createClearCommand: (id) => new ClearBlokiDrillingsCommand(id)
    });
    registerKorpusRebuiltListener((doc, cabinetId) => {
        // 1. Zaktualizuj geometrię i wymiary powiązanych bloków (Live Update / Asocjacja)
        const containers = typeof doc.getContainers === 'function' ? doc.getContainers() : [];
        for (const cNode of containers) {
            const container = cNode.domainData as any;
            const gp = container?.generatorParams;
            // Czy to blok? — strukturalnie: boxType obecne (także 'EMPTY')
            // albo kod taksonomii typu z rodziny `blok_*`. Nigdy po `name`.
            const isBlok = Boolean(gp?.boxType) || (typeof gp?.type === 'string' && gp.type.startsWith('blok_'));
            if (
                container &&
                (gp?.parentContainerId === cabinetId || cNode.parent?.id === cabinetId) &&
                isBlok
            ) {
                update_bloki_core(container, doc);
            }
        }

        // 2. Synchronizuj nawiercenia okuć dla zaktualizowanych mebli
        new SyncShelfDrillingsCommand(cabinetId).execute(doc);
        new SyncDoorDrillingsCommand(cabinetId).execute(doc);
        new SyncSkosneDoorsDrillingsCommand(cabinetId).execute(doc);
        new SyncDrawerDrillingsCommand(cabinetId).execute(doc);
        new SyncFlapsDrillingsCommand(cabinetId).execute(doc);
        new SyncTubesDrillingsCommand(cabinetId).execute(doc);
        new SyncHangersDrillingsCommand(cabinetId).execute(doc);
    });
}
