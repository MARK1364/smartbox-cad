/**
 * clear-smartbox-drillings-command.ts
 *
 * Usuwa z formatek korpusu WSZYSTKIE automatyczne nawiercenia pochodzące
 * ze wskazanego kontenera SmartBox (dopasowanie po params.sourceContainerId).
 *
 * Potrzebna, bo SyncShelfDrillingsCommand i SyncDoorDrillingsCommand czyszczą tylko
 * własny typ otworów (isShelfDrilling / isDoorDrilling). Po zmianie modułu SmartBoxa
 * (np. DRZWI -> WIENIEC) sync poprzedniego modułu już się nie uruchamia, więc bez tej
 * komendy jego otwory zostawałyby na boczkach na zawsze.
 *
 * Ta sama komenda odpala się przy usunięciu SmartBoxa (RemoveNodeCommand), zanim
 * węzeł zniknie z drzewa — inaczej otwory na bokach korpusu zostają osierocone.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';

/** Czy węzeł (lub jego domainData) to kontener SmartBox. */
export function isSmartBoxNode(node: CADNode): boolean {
    const data = node?.domainData as any;
    const params = data?.generatorParams;
    if (!params) return false;
    const type = String(params.type || '');
    return type.startsWith('smartbox_') || !!params.boxType;
}

/**
 * Zbiera ID wszystkich SmartBoxów w poddrzewie (włącznie z samym węzłem).
 * Zwraca zarówno CADNode.id, jak i domainData.id — builder zapisuje sourceContainerId
 * jako CADNode.id, a core czyści po ContainerModel.id; przy zgodności to jeden wpis.
 */
export function collectSmartBoxIds(node: CADNode): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    const walk = (n: CADNode) => {
        if (!n) return;
        if (isSmartBoxNode(n)) {
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

export class ClearSmartBoxDrillingsCommand implements Command {
    readonly id: string;
    readonly label: string = 'Czyszczenie nawierceń po module SmartBox';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly smartBoxContainerId: string;

    private oldFeatures: Map<string, any[]> = new Map();

    constructor(smartBoxContainerId: string) {
        this.id = `cmd_clear_smartbox_drillings_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.smartBoxContainerId = smartBoxContainerId;
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        if (!document || !this.smartBoxContainerId) return;

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
                const fromThisBox = f.params?.sourceContainerId === this.smartBoxContainerId;
                const isAuto = f.params?.isShelfDrilling || f.params?.isDoorDrilling || f.params?.isDrawerDrilling || f.params?.isFlapDrilling || f.params?.isConnectorDrilling;
                return !(fromThisBox && isAuto);
            });

            if (data.features.length !== initialLen) {
                changedNodeIds.add(panelNode.id);
            }
        }

        this.affectedNodeIds.push(...Array.from(changedNodeIds));

        // Odśwież widoki formatek, by Babylon przestał rysować usunięte otwory
        for (const panelNode of panels) {
            if (!changedNodeIds.has(panelNode.id)) continue;
            const data = panelNode.domainData as any;
            if (typeof data.setFeatures === 'function') {
                data.setFeatures(data.features);
            } else if (typeof data._emit === 'function') {
                data._emit('features', { features: data.features });
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
