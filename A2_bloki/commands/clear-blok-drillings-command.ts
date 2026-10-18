/**
 * clear-blok-drillings-command.ts
 *
 * Usuwa z formatek korpusu WSZYSTKIE automatyczne obróbki (nawiercenia + frezowania LED)
 * pochodzące ze wskazanego kontenera Bloki (dopasowanie po params.sourceContainerId).
 *
 * Potrzebna, bo SyncShelfDrillingsCommand i SyncDoorDrillingsCommand czyszczą tylko
 * własny typ otworów (isShelfDrilling / isDoorDrilling). Po zmianie modułu Bloku
 * (np. DRZWI -> WIENIEC) sync poprzedniego modułu już się nie uruchamia, więc bez tej
 * komendy jego obróbki zostawałyby na boczkach na zawsze.
 *
 * Flaga isLedGroove (frezowania LED z machining-intent) objęta automatami od razu,
 * by wpusty LED nie zostawały osierocone po zmianie/usunięciu modułu Bloki.
 *
 * Ta sama komenda odpala się przy usunięciu Bloku (RemoveNodeCommand), zanim
 * węzeł zniknie z drzewa — inaczej otwory na bokach korpusu zostają osierocone.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';

/** Czy węzeł (lub jego domainData) to kontener Bloki. */
export function isBlokiNode(node: CADNode): boolean {
    const data = node?.domainData as any;
    const params = data?.generatorParams;
    if (!params) return false;
    const type = String(params.type || '');
    return type.startsWith('blok_') || !!params.boxType;
}

/**
 * Zbiera ID wszystkich Bloków w poddrzewie (włącznie z samym węzłem).
 * Zwraca zarówno CADNode.id, jak i domainData.id — builder zapisuje sourceContainerId
 * jako CADNode.id, a core czyści po ContainerModel.id; przy zgodności to jeden wpis.
 */
export function collectBlokiIds(node: CADNode): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    const walk = (n: CADNode) => {
        if (!n) return;
        if (isBlokiNode(n)) {
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

export class ClearBlokiDrillingsCommand implements Command {
    readonly id: string;
    readonly label: string = 'Czyszczenie nawierceń po module Bloki';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly blokContainerId: string;
    readonly notifyViews: boolean;

    private oldFeatures: Map<string, any[]> = new Map();

    constructor(blokContainerId: string, notifyViews: boolean = true) {
        this.id = `cmd_clear_bloki_drillings_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.blokContainerId = blokContainerId;
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
        this.notifyViews = notifyViews;
    }

    execute(document: ProjectDocument): void {
        if (!document || !this.blokContainerId) return;

        const panels = typeof document.getPanels === 'function' ? document.getPanels() : [];
        const changedNodeIds = new Set<string>();

        for (const panelNode of panels) {
            const data = panelNode.domainData as any;
            if (!data || !Array.isArray(data.features)) continue;

            if (!this.oldFeatures.has(panelNode.id)) {
                this.oldFeatures.set(panelNode.id, JSON.parse(JSON.stringify(data.features)));
            }

            const initialLen = data.features.length;
            data.features = data.features.filter((f: any) => {
                if (f.frozen || f.params?.frozen) return true; // Zachowaj zamrożone
                const fromThisBox = f.params?.sourceContainerId === this.blokContainerId;
                const isAuto = f.params?.isShelfDrilling || f.params?.isDoorDrilling || f.params?.isDrawerDrilling || f.params?.isFlapDrilling || f.params?.isTubeDrilling || f.params?.isConnectorDrilling || f.params?.isHangerDrilling || f.params?.isLedGroove || f.params?.isSmartPartFeature;
                return !(fromThisBox && isAuto);
            });

            if (data.features.length !== initialLen) {
                changedNodeIds.add(panelNode.id);
            }
        }

        this.affectedNodeIds.push(...Array.from(changedNodeIds));

        // Odśwież widoki formatek tylko gdy włączone (pomijane gdy zaraz następuje syncDrillings)
        if (this.notifyViews) {
            for (const panelNode of panels) {
                if (!changedNodeIds.has(panelNode.id)) continue;
                const data = panelNode.domainData as any;
                if (typeof data.setFeatures === 'function') {
                    data.setFeatures(data.features);
                } else if (typeof data._emit === 'function') {
                    data._emit('features', { features: data.features });
                }
            }
        }

        if (changedNodeIds.size > 0 && typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
    }

    undo(document: ProjectDocument): void {
        if (!document) return;

        for (const [nodeId, oldFeats] of this.oldFeatures.entries()) {
            const node = document.findNode(nodeId);
            if (!node || !node.domainData) continue;

            const data = node.domainData as any;
            data.features = JSON.parse(JSON.stringify(oldFeats));
            if (typeof data.setFeatures === 'function') {
                data.setFeatures(data.features);
            } else if (typeof data._emit === 'function') {
                data._emit('features', { features: data.features });
            }
        }

        if (typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
    }
}
