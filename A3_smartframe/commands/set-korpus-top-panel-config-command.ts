/**
 * Komenda zapisu konfiguracji wieńca górnego korpusu (pełny / trawersy poziome / trawersy pionowe).
 * Undo przywraca poprzednią konfigurację i przebudowuje geometrię.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { rebuildSmartFrameContainer } from '../smartframe-adapter.js';

export type TopPanelMode = 'FULL' | 'TRAVERSE_H' | 'TRAVERSE_V';

export interface TopPanelConfig {
    mode: TopPanelMode;
    width: number;
}

export class SetKorpusTopPanelConfigCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    constructor(
        readonly containerId: string,
        readonly oldConfig: TopPanelConfig,
        readonly newConfig: TopPanelConfig
    ) {
        this.id = `cmd_korpus_top_panel_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = `Konfiguracja wieńca górnego: ${newConfig.mode}`;
        this.timestamp = Date.now();
        this.affectedNodeIds = [containerId];
    }

    execute(document: ProjectDocument): void {
        this._apply(document, this.newConfig);
    }

    undo(document: ProjectDocument): void {
        this._apply(document, this.oldConfig);
    }

    private _apply(document: ProjectDocument, config: TopPanelConfig): void {
        const node = document.findNode(this.containerId);
        const data = node?.domainData as any;
        if (!data) return;
        if (!data.generatorParams) data.generatorParams = {};
        data.generatorParams.topPanelMode = config.mode;
        data.generatorParams.traverseWidth = config.width;
        rebuildSmartFrameContainer(data);
    }
}
