/**
 * Port Korpusu — Core nie importuje A3.
 * A3 rejestruje silnik; A2 nasłuchuje przebudowy korpusu (nawierty).
 */

import type { Command } from './commands/command.js';
import type { ProjectDocument } from './project-document.js';

/**
 * Kanoniczne DTO tworzenia korpusu (Core nie importuje A3, więc kontrakt jest tu).
 *
 * Wymiary są WYMAGANE i w [mm]. Zero aliasów legacy — pole bez wartości to błąd
 * walidacji, nie podpowiedź do zgadywania. Zob. .agents/AGENTS.md.
 */
export interface KorpusCreateParams {
    szerokosc_mm: number;
    wysokosc_mm: number;
    glebokosc_mm: number;
    liczba_stref?: 1 | 2 | 3;
    wysokosc_strefy_dolnej_mm?: number;
    wysokosc_strefy_srodkowej_mm?: number;
    cofniecie_plecow_mm?: number;
    szerokosc_blendy_mm?: number;
    strona_blendy?: 'LEFT' | 'RIGHT';
    glebokosc_boku_lewego_mm?: number;
    glebokosc_boku_prawego_mm?: number;
    wysokosc_przod_mm?: number;
    wysokosc_tyl_mm?: number;
    wysokosc_lewy_mm?: number;
    wysokosc_prawy_mm?: number;
    typ_korpusu?: 'korpus3' | 'korpus_rogowy1' | 'korpus_rogowy90' | 'korpus_skosny' | 'korpus_skosny_dach' | 'korpus_skosny_lr' | 'korpus_skosny_lr_uc';
    offsets?: Record<string, number>;
    position?: { x: number; y: number; z?: number };
}

export type TopPanelMode = 'FULL' | 'TRAVERSE_H' | 'TRAVERSE_V';

export interface CabinetModule {
    rebuild(container: any): boolean;
    createKorpus(doc: any, params: KorpusCreateParams): void;
    createSyncBackGroovesCommand(containerId: string): Command;
    createSetTopPanelConfigCommand?(
        containerId: string,
        oldConfig: { mode: TopPanelMode; width: number },
        newConfig: { mode: TopPanelMode; width: number }
    ): Command;
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
