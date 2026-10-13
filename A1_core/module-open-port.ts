/**
 * Port otwierania modułów produkcyjnych (CNC / raport / nesting / SmartParts Studio).
 * Core nie importuje src/module-data — aplikacja rejestruje handler.
 */

export type ModuleOpenScope = {
    type: 'CONTAINER' | 'PANEL' | 'PROJECT';
    id: string;
    name: string;
};

export interface ModuleOpenHandler {
    openCnc(scope: ModuleOpenScope): void;
    openReport(scope: ModuleOpenScope): void;
    openNesting(scope: ModuleOpenScope): void;
    /** Osobne okno SmartParts Studio (jak CNC). */
    openSmartPartsStudio?(opts?: { scope?: ModuleOpenScope; packageId?: string }): void;
}

let handler: ModuleOpenHandler | null = null;

export function registerModuleOpenHandler(h: ModuleOpenHandler): void {
    handler = h;
}

export function getModuleOpenHandler(): ModuleOpenHandler | null {
    return handler;
}

export function resetModuleOpenHandlerForTests(): void {
    handler = null;
}
