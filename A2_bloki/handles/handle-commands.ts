/**
 * A5_smartparts / handles — handle-commands.ts
 * Transakcyjne komendy CAD dla operacji na uchwytach SmartPart (obsługa Undo / Redo).
 */

import { Command } from '../../A1_core/commands/command.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import type { HandleParamsMm } from './handle-types.js';
import type { HandleComputedLayoutMm } from './handle-layout.js';
import { syncHandleDrillings, removeHandleDrillings } from './handle-drilling.js';
import { buildHandleParametricMesh } from './handle-mesh.js';
import { clearPanelHighlight } from './handle-visualizer.js';

export class AddSmartPartHandleCommand implements Command {
    readonly id: string;
    readonly label: string = 'Wstawienie uchwytu';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private _isExecuted: boolean = false;

    constructor(
        readonly targetPanelId: string,
        readonly cntNode: CADNode,
        readonly hwNode: CADNode,
        readonly layout: HandleComputedLayoutMm,
        readonly params: HandleParamsMm,
        readonly normalZ: number,
        readonly faceZ: number,
    ) {
        this.id = `cmd_add_handle_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.timestamp = Date.now();
        this.affectedNodeIds = [targetPanelId, cntNode.id];
    }

    execute(document: ProjectDocument): void {
        const targetPanelNode = document.findNode(this.targetPanelId);
        if (!targetPanelNode) return;

        // Jeśli węzeł jeszcze nie istnieje w drzewie, dodaj go
        if (!document.findNode(this.cntNode.id)) {
            document.addNode(this.targetPanelId, this.cntNode);
        }
        if (!document.findNode(this.hwNode.id)) {
            document.addNode(this.cntNode.id, this.hwNode);
        }

        // Synchronizuj nawierty montażowe na formacie
        syncHandleDrillings(document, targetPanelNode, this.cntNode.domainData as any, this.layout, this.params, this.normalZ);

        // Zbuduj / odśwież reprezentację 3D
        buildHandleParametricMesh(this.cntNode, this.params, this.layout, this.faceZ, this.normalZ);

        this._isExecuted = true;

        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
        }
    }

    undo(document: ProjectDocument): void {
        if (!this._isExecuted) return;

        // 1. Usuń nawierty z formatki
        removeHandleDrillings(document, this.cntNode.id);

        // 2. Usuń węzeł kontenera uchwytu z dokumentu CAD
        document.removeNode(this.cntNode.id);

        // 3. Wyczyść ewentualne podświetlenie
        const scene = ContextManager.instance?.viewport?.scene;
        if (scene) {
            clearPanelHighlight(scene);
        }

        this._isExecuted = false;

        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
        }
    }

    redo(document: ProjectDocument): void {
        this.execute(document);
    }
}
