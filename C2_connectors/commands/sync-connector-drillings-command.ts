/**
 * sync-connector-drillings-command.ts
 *
 * Komenda aktualizująca nawiercenia złączy (kołki, konfirmaty, minifixy)
 * na formatkach korpusu.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { buildConnectorDrillings } from '../connectors-drilling-builder.js';

export class SyncConnectorDrillingsCommand implements Command {
    readonly id: string;
    readonly label: string = 'Aktualizacja nawierceń złączy';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private oldFeatures: Map<string, any[]> = new Map();

    constructor() {
        this.id = `cmd_sync_conn_drillings_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        if (!document) return;

        const intents = buildConnectorDrillings(document);
        const panels = typeof document.getPanels === 'function' ? document.getPanels() : [];
        const changedNodeIds = new Set<string>();
        const snapshots = new Map<string, any[]>();

        document.transaction(() => {
            for (const panelNode of panels) {
                const data = panelNode.domainData as any;
                if (!data || !Array.isArray(data.features)) continue;

                const initialLen = data.features.length;
                const remainingFeatures = data.features.filter((feature: any) => {
                    if (feature.frozen || feature.params?.frozen) return true;
                    return !(feature.type === 'hole' && feature.params?.isConnectorDrilling);
                });
                if (remainingFeatures.length !== initialLen) {
                    this.snapshotFeatures(snapshots, panelNode.id, data.features);
                    data.features = remainingFeatures;
                    changedNodeIds.add(panelNode.id);
                }
            }

            for (const intent of intents) {
                const targetNode = document.findNode(intent.targetNodeId);
                if (!targetNode || !targetNode.domainData) continue;

                const data = targetNode.domainData as any;
                const features = Array.isArray(data.features) ? data.features : [];
                if (features.some((feature: any) => feature?.id === intent.feature.id)) continue;

                this.snapshotFeatures(snapshots, targetNode.id, features);
                data.features = features;
                data.features.push(intent.feature);
                changedNodeIds.add(targetNode.id);
            }

            this.emitAfterCommit(document, panels, changedNodeIds);
            if (typeof document.notifyDocumentChanged === 'function') {
                document.notifyDocumentChanged();
            }
        }, () => {
            this.restoreSnapshotData(document, snapshots);
        });

        this.affectedNodeIds.push(...Array.from(changedNodeIds));
        for (const [panelId, features] of snapshots) {
            if (!this.oldFeatures.has(panelId)) {
                this.oldFeatures.set(panelId, features);
            }
        }
    }

    undo(document: ProjectDocument): void {
        if (!document) return;
        const currentFeatures = new Map<string, any[]>();

        document.transaction(() => {
            for (const [nodeId, oldFeats] of this.oldFeatures.entries()) {
                const node = document.findNode(nodeId);
                if (node && node.domainData) {
                    const data = node.domainData as any;
                    currentFeatures.set(nodeId, JSON.parse(JSON.stringify(data.features || [])));
                    data.features = JSON.parse(JSON.stringify(oldFeats));
                }
            }

            this.emitAfterCommit(
                document,
                Array.from(this.oldFeatures.keys())
                    .map((nodeId) => document.findNode(nodeId))
                    .filter((node): node is CADNode => node !== null),
                new Set(this.oldFeatures.keys()),
            );
            if (typeof document.notifyDocumentChanged === 'function') {
                document.notifyDocumentChanged();
            }
        }, () => {
            this.restoreSnapshotData(document, currentFeatures);
        });
    }

    private snapshotFeatures(target: Map<string, any[]>, panelId: string, features: any[]): void {
        if (!target.has(panelId)) {
            target.set(panelId, JSON.parse(JSON.stringify(features)));
        }
    }

    private restoreSnapshotData(document: ProjectDocument, snapshots: Map<string, any[]>): void {
        for (const [nodeId, features] of snapshots) {
            const node = document.findNode(nodeId);
            if (node?.domainData) {
                (node.domainData as any).features = JSON.parse(JSON.stringify(features));
            }
        }
    }

    private emitAfterCommit(
        document: ProjectDocument,
        panels: Array<CADNode | null>,
        changedNodeIds: Set<string>,
    ): void {
        document.afterCommit(() => {
            for (const panelNode of panels) {
                if (!panelNode || !changedNodeIds.has(panelNode.id)) continue;
                const data = panelNode.domainData as any;
                if (typeof data?.setFeatures === 'function') {
                    data.setFeatures(data.features);
                } else if (typeof data?._emit === 'function') {
                    data._emit('features', { features: data.features });
                }
            }
        });
    }
}
