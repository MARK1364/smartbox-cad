/**
 * A2_bloki / handles — handle-multi-front.ts
 *
 * Wykrywanie kontekstu frontów szuflad w szafce / projekcie
 * oraz masowe aplikowanie uchwytów z zachowaniem dynamicznych referencji UV.
 */

import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { type HandleParamsMm } from './handle-types.js';
import { createSmartPartHandle } from './handle-apply.js';
import { isHandleNode, ClearHandleDrillingsCommand } from './commands/clear-handle-drillings-command.js';

export type HandleApplyScope = 'SINGLE' | 'MODULE' | 'PROJECT';

export interface DrawerFrontScopeInfo {
    targetNode: CADNode;
    isDrawerFront: boolean;
    siblingFronts: CADNode[];
    projectFronts: CADNode[];
    isMulti: boolean;
}

/**
 * Sprawdza czy dany węzeł formatki jest frontem szuflady.
 */
export function isDrawerFrontNode(node: CADNode): boolean {
    if (!node) return false;
    const role = (node.domainData as any)?.role || (node as any).role;
    if (role !== 'FRONT') return false;

    const key = (node.domainData as any)?.key || '';
    if (typeof key === 'string' && key.startsWith('DRAWER_')) return true;

    const parentType = (node.parent?.domainData as any)?.generatorParams?.type || '';
    if (typeof parentType === 'string' && parentType.includes('drawer')) return true;

    const parentRole = (node.parent?.domainData as any)?.role || '';
    if (typeof parentRole === 'string' && parentRole.includes('DRAWER')) return true;

    const name = node.name || '';
    if (name.startsWith('Front_')) return true;

    return false;
}

/**
 * Wykrywa kontekst formatki: czy jest frontem szuflady, ile szuflad jest w danym module
 * oraz ile szuflad jest w całym projekcie.
 */
export function detectDrawerFrontScope(doc: ProjectDocument, targetPanelNode: CADNode): DrawerFrontScopeInfo {
    const isFront = (targetPanelNode.domainData as any)?.role === 'FRONT' || (targetPanelNode as any).role === 'FRONT';
    const isDrawer = isFront && isDrawerFrontNode(targetPanelNode);

    let siblingFronts: CADNode[] = [];
    if (targetPanelNode.parent) {
        siblingFronts = (targetPanelNode.parent.children || []).filter(c => {
            const r = (c.domainData as any)?.role || (c as any).role;
            return r === 'FRONT';
        });
    }

    if (siblingFronts.length === 0) {
        siblingFronts = [targetPanelNode];
    }

    const projectFronts: CADNode[] = [];
    if (doc) {
        const allNodes: CADNode[] = typeof (doc as any).getAllNodes === 'function'
            ? (doc as any).getAllNodes()
            : [];

        if (allNodes.length === 0 && doc.rootNode) {
            const walk = (n: CADNode) => {
                allNodes.push(n);
                for (const ch of n.children || []) walk(ch);
            };
            walk(doc.rootNode);
        }

        for (const n of allNodes) {
            if (isDrawerFrontNode(n)) {
                projectFronts.push(n);
            }
        }
    }

    return {
        targetNode: targetPanelNode,
        isDrawerFront: isDrawer,
        siblingFronts,
        projectFronts,
        isMulti: siblingFronts.length > 1,
    };
}

/**
 * Usuwa istniejące uchwyty SmartPart z danej formatki i czyści powiązane z nimi nawierty.
 */
export function removeExistingHandlesFromPanel(doc: ProjectDocument, panelNode: CADNode): void {
    if (!doc || !panelNode) return;
    const handles = (panelNode.children || []).filter(isHandleNode);
    for (const h of handles) {
        try {
            new ClearHandleDrillingsCommand(h.id).execute(doc);
        } catch { /* ignore */ }
        doc.removeNode(h.id);
    }
}

/**
 * Aplikuje uchwyt do frontów zgodnie z wybranym zakresem (pojedynczy, cały moduł, cały projekt).
 */
export function applySmartPartHandleWithScope(
    doc: ProjectDocument,
    targetPanelNode: CADNode,
    params: Partial<HandleParamsMm>,
    surface: any,
    scope: HandleApplyScope
): CADNode[] {
    if (!doc || !targetPanelNode) return [];

    const scopeInfo = detectDrawerFrontScope(doc, targetPanelNode);
    let targets: CADNode[] = [];

    switch (scope) {
        case 'MODULE':
            targets = scopeInfo.siblingFronts.length > 0 ? scopeInfo.siblingFronts : [targetPanelNode];
            break;
        case 'PROJECT':
            targets = scopeInfo.projectFronts.length > 0 ? scopeInfo.projectFronts : [targetPanelNode];
            break;
        case 'SINGLE':
        default:
            targets = [targetPanelNode];
            break;
    }

    const createdHandles: CADNode[] = [];
    for (const panel of targets) {
        removeExistingHandlesFromPanel(doc, panel);
        const handle = createSmartPartHandle(doc, panel, params, surface);
        if (handle) {
            createdHandles.push(handle);
        }
    }

    return createdHandles;
}
