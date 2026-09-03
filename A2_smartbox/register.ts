/**
 * Rejestracja A2 w Core: gizmy offsetu + sprzątanie nawierceń przy usunięciu węzła.
 */

import { registerNodeCleanupHandler } from '../A1_core/node-cleanup-port.js';
import { registerSmartBoxOffsetGizmo } from './smartbox-offset-gizmo.js';
import {
    ClearSmartBoxDrillingsCommand,
    collectSmartBoxIds
} from './commands/clear-smartbox-drillings-command.js';
import { registerKorpusRebuiltListener } from '../A1_core/cabinet-port.js';
import { SyncShelfDrillingsCommand } from './commands/sync-shelf-drillings-command.js';
import { SyncDoorDrillingsCommand } from './commands/sync-door-drillings-command.js';
import { SyncDrawerDrillingsCommand } from './commands/sync-drawer-drillings-command.js';
import { SyncFlapsDrillingsCommand } from './commands/sync-flaps-drillings-command.js';
import { SmartBoxBayController } from './smartbox-bay-controller.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { update_smartbox_core } from './smartbox-core.js';

export function registerSmartBoxModule(): void {
    registerSmartBoxOffsetGizmo();
    ContextManager.instance.smartBoxBayController = new SmartBoxBayController();
    registerNodeCleanupHandler({
        id: 'A2_smartbox',
        collectIds: collectSmartBoxIds,
        createClearCommand: (id) => new ClearSmartBoxDrillingsCommand(id)
    });
    registerKorpusRebuiltListener((doc, cabinetId) => {
        // 1. Zaktualizuj geometrię i wymiary powiązanych SmartBoxów (Live Update / Asocjacja)
        const containers = typeof doc.getContainers === 'function' ? doc.getContainers() : [];
        for (const cNode of containers) {
            const container = cNode.domainData as any;
            if (
                container &&
                (container.generatorParams?.parentContainerId === cabinetId || cNode.parent?.id === cabinetId) &&
                (container.generatorParams?.boxType || container.name?.includes('SmartBox'))
            ) {
                update_smartbox_core(container, doc);
            }
        }

        // 2. Synchronizuj nawiercenia okuć dla zaktualizowanych mebli
        new SyncShelfDrillingsCommand(cabinetId).execute(doc);
        new SyncDoorDrillingsCommand(cabinetId).execute(doc);
        new SyncDrawerDrillingsCommand(cabinetId).execute(doc);
        new SyncFlapsDrillingsCommand(cabinetId).execute(doc);
    });
}
