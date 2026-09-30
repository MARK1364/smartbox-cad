/**
 * A5_smartparts / handles — clear-handle-drillings-command.ts
 *
 * Usuwa z formatek (np. frontów) otwory wywiercone pod dany uchwyt SmartPart.
 * Zintegrowane z portem czyszczenia (A1_core/node-cleanup-port.ts) przy usuwaniu węzła.
 */

import { ProjectDocument } from '../../../A1_core/project-document.js';
import { Command } from '../../../A1_core/commands/command.js';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { SMARTPART_HANDLE_TYPE } from '../handle-types.js';

export function isHandleNode(node: CADNode): boolean {
    const data = node?.domainData as any;
    if (data?.role === 'SMARTPART_HANDLE') return true;
    const params = data?.generatorParams;
    if (params?.type === SMARTPART_HANDLE_TYPE || params?.partType === 'HANDLE') return true;
    return false;
}

export function collectHandleIds(node: CADNode): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    const walk = (n: CADNode) => {
        if (!n) return;
        if (isHandleNode(n)) {
            if (!seen.has(n.id)) {
                seen.add(n.id);
                ids.push(n.id);
            }
            const domainId = (n.domainData as any)?.id;
            if (domainId && !seen.has(domainId)) {
                seen.add(domainId);
                ids.push(domainId);
            }
        }
        for (const child of n.children || []) walk(child);
    };
    walk(node);
    return ids;
}

export class ClearHandleDrillingsCommand implements Command {
    readonly id: string;
    readonly label: string = 'Czyszczenie nawierceń po uchwycie';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly handleId: string;
    private _snapshot: Map<string, any[]> = new Map();

    constructor(handleId: string) {
        this.id = `clear_handle_drillings_${handleId}_${Date.now()}`;
        this.timestamp = Date.now();
        this.handleId = handleId;
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): boolean {
        if (!document) return false;
        const panels = typeof document.getPanels === 'function' ? document.getPanels() : [];
        for (const pNode of panels) {
            const panelModel = pNode.domainData as any;
            if (!panelModel || !Array.isArray(panelModel.features)) continue;
            const hadFeatures = panelModel.features.filter((f: any) => {
                const p = f.params || {};
                return p.sourceContainerId === this.handleId || (p.isHandleDrilling && p.handleId === this.handleId);
            });
            if (hadFeatures.length > 0) {
                this._snapshot.set(panelModel.id, [...panelModel.features]);
                const remaining = panelModel.features.filter((f: any) => {
                    const p = f.params || {};
                    return p.sourceContainerId !== this.handleId && (!p.isHandleDrilling || p.handleId !== this.handleId);
                });
                if (typeof panelModel.setFeatures === 'function') {
                    panelModel.setFeatures(remaining);
                } else {
                    panelModel.features = remaining;
                }
            }
        }
        return true;
    }

    undo(document: ProjectDocument): boolean {
        if (!document) return false;
        for (const [panelId, feats] of this._snapshot.entries()) {
            const pNode = document.findNode(panelId);
            const panelModel = pNode?.domainData as any;
            if (panelModel) {
                if (typeof panelModel.setFeatures === 'function') {
                    panelModel.setFeatures(feats);
                } else {
                    panelModel.features = feats;
                }
            }
        }
        return true;
    }
}
