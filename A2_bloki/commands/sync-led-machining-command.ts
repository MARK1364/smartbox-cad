/**
 * sync-led-machining-command.ts
 *
 * Komenda aktualizacji obróbek (machining) LED WEWNĘTRZNEGO na formatkach korpusu.
 * Po migracji MACHINING logika snapshotu, emitu i undo leży we wspólnym rdzeniu
 * machining-sync.ts — komenda dostarcza tylko plany intencji wpustów.
 *
 * LED ZEWNĘTRZNY (kanał) pominięty celowo: rdzeń złożeniowy (led-external-channel-engine),
 * nie podmoduł Bloku — dołączy do machining po migracji jego frezowań na intencje.
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import {
    applyBlokiLedInternalGroovePlan,
    buildBlokiLedInternalGroovePlan,
} from '../13_led-internal-engine.js';
import {
    emitMachiningFeatures,
    restoreMachiningFeatures,
    syncMachiningGroovePlans,
} from '../01_machining-sync.js';

function findBlokContainers(
    document: ProjectDocument,
    ownerId?: string,
): any[] {
    const containers = typeof document.getContainers === 'function' ? document.getContainers() : [];
    const matched = containers.filter((c: any) => {
        const p = c.domainData?.generatorParams;
        if (c.domainData?.visible === false) return false;
        if (ownerId) {
            return c.id === ownerId
                || c.domainData?.id === ownerId
                || p?.parentContainerId === ownerId
                || p?.sourceContainerId === ownerId;
        }
        return p?.type === 'blok_led_internal' || p?.boxType === 'LED_INTERNAL';
    });
    return matched;
}

export class SyncLedMachiningCommand implements Command {
    readonly id: string;
    readonly label: string = 'Aktualizacja frezowań LED wewnętrznego';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly ownerId?: string;

    private oldFeatures: Map<string, any[]> = new Map();
    private plans: { ownerId: string; panels: any[] }[] = [];

    constructor(ownerId?: string) {
        this.id = `cmd_sync_led_machining_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.ownerId = ownerId;
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        if (!document) return;

        this.plans = findBlokContainers(document, this.ownerId)
            .map((c: any) => buildBlokiLedInternalGroovePlan(c, document))
            .filter(Boolean) as { ownerId: string; panels: any[] }[];
        if (this.plans.length === 0) return;

        // 1+2. Snapshot formatek + aplikacja planów frezowań LED — wspólny rdzeń MACHINING
        const changedNodeIds = syncMachiningGroovePlans(
            document,
            this.plans,
            applyBlokiLedInternalGroovePlan,
            this.oldFeatures,
        );

        this.affectedNodeIds.push(...Array.from(changedNodeIds));

        // 3. Powiadom panele o zmianie features (Babylon PanelView)
        const changedPanels = Array.from(changedNodeIds)
            .map(id => document.findNode(id))
            .filter(Boolean);
        emitMachiningFeatures(changedPanels, changedNodeIds);

        // 4. Powiadom o zmianie dokumentu
        if (changedNodeIds.size > 0 && typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
    }

    undo(document: ProjectDocument): void {
        if (!document) return;
        restoreMachiningFeatures(document, this.oldFeatures);
    }
}
