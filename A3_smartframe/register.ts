/**
 * Rejestracja A3 SmartFrame w Core: CabinetModule + gizmo offsetu korpusu.
 */

import { registerCabinetModule, registerKorpusRebuiltListener, CabinetModule, KorpusCreateParams } from '../A1_core/cabinet-port.js';
import { registerKorpusOffsetGizmo } from './korpus-offset-gizmo.js';
import { rebuildSmartFrameContainer, initializeSmartFrameEngine } from './smartframe-adapter.js';
import { CreateKorpusCommand } from './commands/create-korpus-command.js';
import { SyncBackGroovesCommand } from './commands/sync-back-grooves-command.js';
import { SetKorpusTopPanelConfigCommand } from './commands/set-korpus-top-panel-config-command.js';
import { Command } from '../A1_core/commands/command.js';
import { ContextManager } from '../A1_core/context-manager.js';

export const smartFrameCabinetModule: CabinetModule = {
    rebuild(container: any): boolean {
        return rebuildSmartFrameContainer(container);
    },
    createKorpus(doc: any, params: KorpusCreateParams): void {
        const cmd = new CreateKorpusCommand(params);
        const history = ContextManager.instance.commandHistory;
        if (history && typeof history.execute === 'function') {
            history.execute(cmd);
        } else if (doc) {
            cmd.execute(doc);
        }
    },
    createSyncBackGroovesCommand(containerId: string): Command {
        return new SyncBackGroovesCommand(containerId);
    },
    createSetTopPanelConfigCommand(containerId: string, oldConfig: any, newConfig: any): Command {
        return new SetKorpusTopPanelConfigCommand(containerId, oldConfig, newConfig);
    }
};

export function registerSmartFrameModule(): void {
    registerCabinetModule(smartFrameCabinetModule);
    registerKorpusOffsetGizmo();
}
