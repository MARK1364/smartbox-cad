/**
 * sync-drawer-drillings-command.ts
 *
 * Komenda aktualizująca nawiercenia prowadnic szuflad na formatkach korpusu.
 * Para z SyncDoorDrillingsCommand — czyści wyłącznie isDrawerDrilling.
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';
import { buildDrawersDrillings } from '../../A2_smartbox/drawers-drilling-builder.js';

export class SyncDrawerDrillingsCommand implements Command {
    readonly id: string;
    readonly label: string = 'Aktualizacja nawierceń szuflad';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly cabinetContainerId?: string;

    private oldFeatures: Map<string, any[]> = new Map();

    constructor(cabinetContainerId?: string) {
        this.id = `cmd_sync_drawer_drillings_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.cabinetContainerId = cabinetContainerId;
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        if (!document) return;

        const intents = buildDrawersDrillings(document, this.cabinetContainerId);
        const panels = typeof document.getPanels === 'function' ? document.getPanels() : [];
        const changedNodeIds = new Set<string>();

        for (const panelNode of panels) {
            const data = panelNode.domainData as any;
            if (data && data.features && Array.isArray(data.features)) {
                if (!this.oldFeatures.has(panelNode.id)) {
                    this.oldFeatures.set(panelNode.id, JSON.parse(JSON.stringify(data.features)));
                }

                const initialLen = data.features.length;
                data.features = data.features.filter((f: any) => {
                    if (f.frozen || f.params?.frozen) return true;
                    return !(f.type === 'hole' && f.params?.isDrawerDrilling);
                });

                if (data.features.length !== initialLen) {
                    changedNodeIds.add(panelNode.id);
                }
            }
        }

        for (const intent of intents) {
            const targetNode = document.findNode(intent.targetNodeId);
            if (!targetNode || !targetNode.domainData) continue;

            const data = targetNode.domainData as any;
            if (!data.features) data.features = [];

            if (!this.oldFeatures.has(targetNode.id)) {
                this.oldFeatures.set(targetNode.id, JSON.parse(JSON.stringify(data.features)));
            }

            data.features.push(intent.feature);
            changedNodeIds.add(targetNode.id);
        }

        this.affectedNodeIds.push(...Array.from(changedNodeIds));

        for (const panelNode of panels) {
            if (changedNodeIds.has(panelNode.id)) {
                const data = panelNode.domainData as any;
                if (typeof data.setFeatures === 'function') {
                    data.setFeatures(data.features);
                } else if (typeof data._emit === 'function') {
                    data._emit('features', { features: data.features });
                }
            }
        }

        if (typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
    }

    undo(document: ProjectDocument): void {
        if (!document) return;

        for (const [nodeId, oldFeats] of this.oldFeatures.entries()) {
            const node = document.findNode(nodeId);
            if (node && node.domainData) {
                const data = node.domainData as any;
                data.features = JSON.parse(JSON.stringify(oldFeats));
                if (typeof data.setFeatures === 'function') {
                    data.setFeatures(data.features);
                } else if (typeof data._emit === 'function') {
                    data._emit('features', { features: data.features });
                }
            }
        }

        if (typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
    }
}
