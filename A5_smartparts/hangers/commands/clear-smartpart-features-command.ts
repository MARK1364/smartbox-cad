/**
 * Czyści cechy obróbcze SmartParta na formatkach + meshe sceny po usunięciu grupy/Parta.
 */

import { ProjectDocument } from '../../../A1_core/project-document.js';
import { Command } from '../../../A1_core/commands/command.js';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { ContextManager } from '../../../A1_core/context-manager.js';
import { SMARTPART_HANGER_TYPE, SMARTPART_HANGERS_GROUP_TYPE } from '../hanger-types.js';

export function isHangersGroupNode(node: CADNode): boolean {
    const data = node?.domainData as any;
    if (!data) return false;
    if (data.role === 'SMARTPART_HANGERS') return true;
    const t = data.generatorParams?.type;
    return t === SMARTPART_HANGERS_GROUP_TYPE;
}

export function isHangerPartNode(node: CADNode): boolean {
    const data = node?.domainData as any;
    if (!data) return false;
    if (data.role === 'SMARTPART_HANGER') return true;
    return data.generatorParams?.type === SMARTPART_HANGER_TYPE;
}

/** ID kontenerów źródłowych (grupa / part) — cechy na panelach mają sourceContainerId = id grupy. */
export function collectSmartPartSourceIds(node: CADNode): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    const push = (id: string | undefined) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        ids.push(id);
    };
    const walk = (n: CADNode) => {
        if (!n) return;
        if (isHangersGroupNode(n)) {
            push(n.id);
            push((n.domainData as any)?.id);
        }
        if (isHangerPartNode(n)) {
            push(n.id);
            push((n.domainData as any)?.generatorParams?.groupId);
        }
        for (const child of n.children || []) walk(child);
    };
    walk(node);
    return ids;
}

function disposeSceneVisualsForNodeIds(nodeIds: string[]): void {
    const scene = ContextManager.instance?.viewport?.scene
        || (typeof window !== 'undefined' ? (window as any).__cad_scene : null);
    if (!scene || nodeIds.length === 0) return;
    const idSet = new Set(nodeIds);
    const syncAdapter = (ContextManager.instance as any)?.sceneSyncAdapter;
    for (const id of idSet) {
        syncAdapter?.unbindById?.(id);
    }
    const belongs = (obj: any): boolean => {
        if (!obj) return false;
        const meta = obj.metadata || {};
        if (meta.nodeId && idSet.has(meta.nodeId)) return true;
        if (meta.model?.id && idSet.has(meta.model.id)) return true;
        const name = String(obj.name || '');
        for (const id of idSet) {
            if (
                name === id
                || name === `hanger_glb_${id}`
                || name.startsWith(`mesh_part_${id}`)
                || name.startsWith(`mesh_cut_${id}`)
            ) return true;
        }
        return false;
    };
    const tryDispose = (obj: any) => {
        try { obj?.dispose?.(false, true); } catch { /* ignore */ }
    };
    for (const mesh of [...(scene.meshes || [])]) {
        if (belongs(mesh)) tryDispose(mesh);
    }
    for (const tn of [...(scene.transformNodes || [])]) {
        if (belongs(tn)) tryDispose(tn);
    }
}

/** Wszystkie id węzłów poddrzewa (do sprzątania mesh). */
export function collectSubtreeNodeIds(node: CADNode): string[] {
    const ids: string[] = [];
    const walk = (n: CADNode) => {
        if (!n) return;
        ids.push(n.id);
        const did = (n.domainData as any)?.id;
        if (did && did !== n.id) ids.push(did);
        for (const child of n.children || []) walk(child);
    };
    walk(node);
    return ids;
}

export class ClearSmartPartFeaturesCommand implements Command {
    readonly id: string;
    readonly label: string = 'Czyszczenie cech SmartPart';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly sourceId: string;
    private _snapshot: Map<string, any[]> = new Map();
    private _meshNodeIds: string[];

    constructor(sourceId: string, meshNodeIds: string[] = []) {
        this.id = `clear_sp_features_${sourceId}_${Date.now()}`;
        this.timestamp = Date.now();
        this.sourceId = sourceId;
        this.affectedNodeIds = [];
        this._meshNodeIds = meshNodeIds;
    }

    execute(document: ProjectDocument): boolean {
        if (!document) return false;
        // Węzeł jeszcze w drzewie (cleanup przed removeNode) — zbierz całe poddrzewo do dispose mesh
        const liveNode = document.findNode(this.sourceId);
        const meshIds = liveNode
            ? collectSubtreeNodeIds(liveNode)
            : (this._meshNodeIds.length > 0 ? this._meshNodeIds : [this.sourceId]);
        disposeSceneVisualsForNodeIds(meshIds);

        const panels = typeof document.getPanels === 'function' ? document.getPanels() : [];
        for (const pNode of panels) {
            const panelModel = pNode.domainData as any;
            if (!panelModel || !Array.isArray(panelModel.features)) continue;
            const had = panelModel.features.filter((f: any) => {
                const p = f.params || {};
                return p.sourceContainerId === this.sourceId
                    || (p.isSmartPartFeature && p.smartPartId === this.sourceId);
            });
            if (had.length === 0) continue;
            this._snapshot.set(panelModel.id, [...panelModel.features]);
            const remaining = panelModel.features.filter((f: any) => {
                const p = f.params || {};
                return p.sourceContainerId !== this.sourceId
                    && !(p.isSmartPartFeature && p.smartPartId === this.sourceId);
            });
            if (typeof panelModel.setFeatures === 'function') panelModel.setFeatures(remaining);
            else panelModel.features = remaining;
        }
        return true;
    }

    undo(document: ProjectDocument): boolean {
        if (!document) return false;
        for (const [panelId, feats] of this._snapshot.entries()) {
            const pNode = document.findNode(panelId);
            const panelModel = pNode?.domainData as any;
            if (!panelModel) continue;
            if (typeof panelModel.setFeatures === 'function') panelModel.setFeatures(feats);
            else panelModel.features = feats;
        }
        return true;
    }
}
