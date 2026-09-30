/**
 * Ścieżka zaznaczenia: gałąź w górę drzewa CAD (korpus → … → panel → operacja).
 * Etykiety zostają w widoku — tutaj tylko struktura.
 */

import { NodeType } from './cad-node/node-type';
import type { CADNode } from './cad-node/cad-node';
import type { ProjectDocument } from './project-document';

export type FeatureOwner = { node: CADNode; feature: any };

export type SelectionChain = {
    /** Przodkowie od najwyższego złożenia do panelu włącznie (bez ROOM). */
    nodes: CADNode[];
    owner: FeatureOwner | null;
};

/**
 * Panel-właściciel operacji. Szukamy po węzłach PART, bo `domainData.type`
 * panelu to 'part' — porównania z 'panel' są zawodne.
 */
export function findFeatureOwner(
    doc: ProjectDocument,
    featureId: string | null | undefined,
): FeatureOwner | null {
    if (!featureId) return null;
    const parts: CADNode[] = typeof (doc as any).getPanels === 'function' ? (doc as any).getPanels() : [];
    for (const node of parts) {
        const feats = (node.domainData as any)?.features;
        if (!Array.isArray(feats)) continue;
        const feature = feats.find((f: any) => f?.id === featureId);
        if (feature) return { node, feature };
    }
    return null;
}

/** Operacja jest ważna dopóki istnieje i dopóki jej panel pozostaje aktywny. */
export function resolveFeatureId(
    doc: ProjectDocument,
    featureId: string | null | undefined,
): string | null {
    if (!featureId) return null;
    const owner = findFeatureOwner(doc, featureId);
    if (!owner) return null;
    const activeId = (doc.activeEntity as any)?.id;
    if (activeId && activeId !== owner.node.id) return null;
    return featureId;
}

export function buildSelectionChain(
    doc: ProjectDocument,
    featureId: string | null | undefined,
): SelectionChain {
    const owner = findFeatureOwner(doc, resolveFeatureId(doc, featureId));

    // Operacja wyznacza gałąź nawet zanim activeEntity zdąży się zsynchronizować.
    let base: CADNode | null = owner?.node ?? null;
    if (!base) {
        const active = doc.activeEntity as any;
        const nodeId = active?.id || active?.smartId?.uid;
        base = nodeId ? doc.findNode(nodeId) : null;
    }
    if (!base) return { nodes: [], owner: null };

    const nodes: CADNode[] = [];
    let cur: CADNode | null = base;
    while (cur && cur.nodeType !== NodeType.ROOM) {
        nodes.unshift(cur);
        cur = cur.parent;
    }
    return { nodes, owner };
}
