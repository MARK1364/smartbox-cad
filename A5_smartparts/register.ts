/**
 * Rejestracja modułu A5_smartparts w Core:
 * - sprzątanie nawierceń uchwytów (A2_bloki/handles) / cech zawieszek przy usuwaniu węzła
 * - hydrator FEATURE dla cięć SmartPart (toJSON)
 */

import { NodeType } from '../A1_core/cad-node/node-type.js';
import { registerDefaultHydrator } from '../A1_core/domain-registry.js';
import { registerNodeCleanupHandler } from '../A1_core/node-cleanup-port.js';
import {
    ClearHandleDrillingsCommand,
    collectHandleIds,
} from '../A2_bloki/handles/commands/clear-handle-drillings-command.js';
import {
    ClearSmartPartFeaturesCommand,
    collectSmartPartSourceIds,
    collectSubtreeNodeIds,
    isHangersGroupNode,
} from './hangers/commands/clear-smartpart-features-command.js';
import { SmartPartCutModel, isSmartPartCutDomain } from './hangers/smartpart-cut-model.js';
import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import type { ProjectDocument } from '../A1_core/project-document.js';

function collectHangerCleanupEntries(node: CADNode): Array<{ sourceId: string; meshIds: string[] }> {
    const out: Array<{ sourceId: string; meshIds: string[] }> = [];
    const meshIds = collectSubtreeNodeIds(node);
    for (const sourceId of collectSmartPartSourceIds(node)) {
        out.push({ sourceId, meshIds });
    }
    // Cała grupa: zawsze czyść po id węzła grupy (sourceContainerId w cechach)
    if (isHangersGroupNode(node)) {
        out.push({ sourceId: node.id, meshIds });
    }
    return out;
}

function hydrateFeatureDomain(raw: any, nodeJson: any): any {
    if (isSmartPartCutDomain(raw)) {
        const cut = SmartPartCutModel.fromJSON(raw);
        cut.id = nodeJson.id || cut.id;
        if (!cut.name) cut.name = nodeJson.name || cut.name;
        return cut;
    }
    // Inne FEATURE — plain object z toJSON awaryjnym (serialize fail-fast)
    if (raw && typeof raw.toJSON !== 'function') {
        return {
            ...raw,
            toJSON() {
                const { toJSON: _t, ...rest } = this as any;
                return { ...rest };
            },
        };
    }
    return raw;
}

export function registerSmartPartsModule(document?: ProjectDocument): void {
    registerNodeCleanupHandler({
        id: 'A5_smartparts_handles',
        collectIds: collectHandleIds,
        createClearCommand: (id) => new ClearHandleDrillingsCommand(id),
    });

    // Unikalne sourceId → jedna komenda; meshIds zbierane w execute (węzeł jeszcze w drzewie)
    registerNodeCleanupHandler({
        id: 'A5_smartparts_hangers',
        collectIds: (node) => {
            const seen = new Set<string>();
            const ids: string[] = [];
            for (const e of collectHangerCleanupEntries(node)) {
                if (seen.has(e.sourceId)) continue;
                seen.add(e.sourceId);
                ids.push(e.sourceId);
            }
            return ids;
        },
        createClearCommand: (id) => new ClearSmartPartFeaturesCommand(id, [id]),
    });

    registerDefaultHydrator(NodeType.FEATURE, hydrateFeatureDomain);
    // ProjectDocument powstaje przed startModules — dopnij hydrator do żywej instancji
    if (document && typeof document.registerHydrator === 'function') {
        document.registerHydrator(NodeType.FEATURE, hydrateFeatureDomain);
    }
}
