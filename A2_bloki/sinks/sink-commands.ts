/**
 * A2_bloki / sinks — sink-commands.ts
 * Transakcyjne komendy CAD dla operacji na zlewach SmartPart (obsługa Undo / Redo).
 */

import type { Command } from '../../A1_core/commands/command.js';
import type { ProjectDocument } from '../../A1_core/project-document.js';
import type { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import type { SinkParamsMm, SinkComputedLayoutMm } from './sink-types.js';
import { syncSinkCutout, removeSinkCutout } from './sink-cutout.js';
import { buildSinkParametricMesh, disposeSinkVisual } from './sink-mesh.js';

export class AddSmartPartSinkCommand implements Command {
    readonly id: string;
    readonly label: string = 'Wstawienie zlewu';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private _isExecuted: boolean = false;

    constructor(
        readonly targetPanelId: string,
        readonly cntNode: CADNode,
        readonly hwNode: CADNode,
        readonly layout: SinkComputedLayoutMm,
        readonly params: SinkParamsMm,
        readonly normalZ: number = 1,
        readonly faceZ: number = 0
    ) {
        this.id = `cmd_add_sink_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.timestamp = Date.now();
        this.affectedNodeIds = [targetPanelId, cntNode.id];
    }

    execute(document: ProjectDocument): void {
        const targetPanelNode = document.findNode(this.targetPanelId);
        if (!targetPanelNode) return;

        if (!document.findNode(this.cntNode.id)) {
            document.addNode(this.targetPanelId, this.cntNode);
        }
        if (!document.findNode(this.hwNode.id)) {
            document.addNode(this.cntNode.id, this.hwNode);
        }

        // Synchronizuj wycięcie komory zlewu na formacie
        syncSinkCutout(document, targetPanelNode, this.cntNode.domainData as any, this.params, this.layout);

        // Zbuduj reprezentację 3D
        buildSinkParametricMesh(this.cntNode, this.params, this.layout, this.faceZ, this.normalZ);

        this._isExecuted = true;

        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
        }
    }

    undo(document: ProjectDocument): void {
        if (!this._isExecuted) return;

        const targetPanelNode = document.findNode(this.targetPanelId);
        if (targetPanelNode) {
            removeSinkCutout(targetPanelNode, this.cntNode.id);
        }

        const scene = ContextManager.instance?.viewport?.scene || (typeof window !== 'undefined' ? (window as any)?.__cad_scene : null);
        if (scene) {
            disposeSinkVisual(scene, this.cntNode.id);
        }

        if (document.findNode(this.hwNode.id)) {
            document.removeNode(this.hwNode.id);
        }
        if (document.findNode(this.cntNode.id)) {
            document.removeNode(this.cntNode.id);
        }

        this._isExecuted = false;

        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
        }
    }
}
