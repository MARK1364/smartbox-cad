/**
 * Port Korpusu — Core nie importuje A3.
 * A3 rejestruje silnik; A2 nasłuchuje przebudowy korpusu (nawierty).
 */

import type { Command } from './commands/command.js';
import type { ProjectDocument } from './project-document.js';

export interface KorpusCreateParams {
    width: number;
    height: number;
    depth: number;
    zoneCount: 1 | 2 | 3;
    bottomHeight: number;
    middleHeight: number;
    offsets?: Record<string, number>;
}

export interface CabinetModule {
    rebuild(container: any): boolean;
    createKorpus(doc: any, params: KorpusCreateParams): void;
    createSyncBackGroovesCommand(containerId: string): Command;
}

let cabinetModule: CabinetModule | null = null;
const rebuiltListeners: Array<(doc: ProjectDocument, containerId: string) => void> = [];

export function registerCabinetModule(mod: CabinetModule): void {
    cabinetModule = mod;
}

export function getCabinetModule(): CabinetModule | null {
    return cabinetModule;
}

export function registerKorpusRebuiltListener(
    fn: (doc: ProjectDocument, containerId: string) => void
): void {
    rebuiltListeners.push(fn);
}

export function notifyKorpusRebuilt(doc: ProjectDocument, containerId: string): void {
    for (const fn of rebuiltListeners) fn(doc, containerId);
}

export function resetCabinetPortForTests(): void {
    cabinetModule = null;
    rebuiltListeners.length = 0;
}
