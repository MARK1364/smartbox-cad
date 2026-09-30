/**
 * Rejestracja modułu A5_smartparts w Core:
 * - Rejestracja handlera sprzątania nawierceń uchwytów przy usuwaniu węzła.
 */

import { registerNodeCleanupHandler } from '../A1_core/node-cleanup-port.js';
import {
    ClearHandleDrillingsCommand,
    collectHandleIds
} from './handles/commands/clear-handle-drillings-command.js';

export function registerSmartPartsModule(): void {
    registerNodeCleanupHandler({
        id: 'A5_smartparts_handles',
        collectIds: collectHandleIds,
        createClearCommand: (id) => new ClearHandleDrillingsCommand(id)
    });
}
