/**
 * machining-sync.ts — wspólny mechanizm aplikacji intencji obróbki (MACHINING)
 * na formatakach korpusu (snapshot → clear własnych automatów → upsert → emit → undo).
 *
 * Pierwotnie kod był zduplikowany w SyncDoorDrillingsCommand / SyncFlapsDrillingsCommand
 * (i wcześniej SyncShelfDrillingsCommand); po migracji doors/flaps to JEDEN punkt
 * przepływu — kolejne moduły (półki, przegrody, tubes, drawers) podłączają się
 * przekazując builder intencji + tag własności, bez kopiowania commanda.
 */

import type { ProjectDocument } from '../A1_core/project-document.js';
import type { MachiningHoleOwnerTag } from './01_machining-intent.js';
import { isOwnedHole } from './01_machining-intent.js';

/** Luźny kształt intencji (wystarczy targetNodeId + feature) — warstwa sync jest agnostyczna. */
export interface MachiningSyncIntent {
    targetNodeId: string;
    feature: any;
}

/**
 * Wspólne kroki syncu nawiercenia (1:1 semantyka SyncFlapsDrillingsCommand):
 *   1. snapshot formatek objętych zmianą (lazy — raz, przy pierwszym kontakcie),
 *   2. czyszczenie własnych automatów (ownerTag) na formatach scope — zamrożone zostają,
 *   3. upsert cech z intencji na formatach docelowych,
 * @returns zbiór zmienionych nodeId (do affectedNodeIds + emit).
 */
export function syncMachiningHoles(
    document: ProjectDocument,
    intents: readonly MachiningSyncIntent[],
    panels: any[],
    ownerTag: MachiningHoleOwnerTag,
    oldFeatures: Map<string, any[]>,
): Set<string> {
    void document;
    const changedNodeIds = new Set<string>();

    // 1. Czyszczenie starych automatów modułu (scope — wszystkie formatki korpusu)
    for (const panelNode of panels) {
        const data = panelNode.domainData as any;
        if (!data || !Array.isArray(data.features) || data.features.length === 0) continue;
        const hasRemovable = data.features.some(
            (f: any) => isOwnedHole(f, ownerTag) && !(f.frozen || f.params?.frozen),
        );
        if (!hasRemovable) continue;

        if (!oldFeatures.has(panelNode.id)) {
            oldFeatures.set(panelNode.id, JSON.parse(JSON.stringify(data.features)));
        }

        const initialLen = data.features.length;
        data.features = data.features.filter((f: any) => {
            if (f.frozen || f.params?.frozen) return true; // Zachowaj zamrożone
            return !isOwnedHole(f, ownerTag);
        });
        if (data.features.length !== initialLen) {
            changedNodeIds.add(panelNode.id);
        }
    }

    // 2. Upsert nowych cech na formatach docelowych
    for (const intent of intents) {
        if (!intent?.targetNodeId || !intent.feature) continue;
        const targetNode = typeof (document as any)?.findNode === 'function'
            ? (document as any).findNode(intent.targetNodeId)
            : null;
        if (!targetNode || !targetNode.domainData) continue;

        const data = targetNode.domainData as any;
        if (!data.features) data.features = [];

        if (!oldFeatures.has(targetNode.id)) {
            oldFeatures.set(targetNode.id, JSON.parse(JSON.stringify(data.features)));
        }

        data.features.push(intent.feature);
        changedNodeIds.add(targetNode.id);
    }

    return changedNodeIds;
}

/**
 * Aplikuje plany frezowań wpustów (grooves) na formatkach:
 * snapshot formatek objętych planem -> aplikacja planu -> zwraca changedNodeIds.
 */
export function syncMachiningGroovePlans(
    document: ProjectDocument,
    plans: readonly { ownerId: string; panels: any[] }[],
    applyPlanFn: (doc: any, plan: any) => void,
    oldFeatures: Map<string, any[]>,
): Set<string> {
    const changedNodeIds = new Set<string>();
    for (const plan of plans) {
        for (const panelPlan of plan.panels || []) {
            const node = typeof (document as any)?.findNode === 'function'
                ? (document as any).findNode(panelPlan.targetNodeId)
                : null;
            const data = node?.domainData as any;
            if (!data || !Array.isArray(data.features)) continue;
            if (!oldFeatures.has(node.id)) {
                oldFeatures.set(node.id, JSON.parse(JSON.stringify(data.features)));
            }
            changedNodeIds.add(node.id);
        }
        applyPlanFn(document, plan);
    }
    return changedNodeIds;
}

/** Sformatowane zmiany features na formatach SCOPE — odświeżenie Babylon PanelView. */
export function emitMachiningFeatures(
    panels: any[],
    changedNodeIds: Set<string>,
): void {
    for (const panelNode of panels) {
        if (!panelNode || !changedNodeIds.has(panelNode.id)) continue;
        const data = panelNode.domainData as any;
        if (!data) continue;
        if (typeof data.setFeatures === 'function') {
            data.setFeatures(data.features);
        } else if (typeof data._emit === 'function') {
            data._emit('features', { features: data.features });
        }
    }
}

/** Undo: odtworzenie snapshotów oldFeatures (i formatki emit). */
export function restoreMachiningFeatures(
    document: ProjectDocument,
    oldFeatures: Map<string, any[]>,
): void {
    for (const [nodeId, oldFeats] of oldFeatures.entries()) {
        const node = typeof (document as any)?.findNode === 'function'
            ? (document as any).findNode(nodeId)
            : null;
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

    if (typeof (document as any)?.notifyDocumentChanged === 'function') {
        (document as any).notifyDocumentChanged();
    }
}
