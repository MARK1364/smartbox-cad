/**
 * Port otwierania modułów produkcyjnych (CNC / raport / nesting).
 * Core nie importuje src/module-data — aplikacja rejestruje handler.
 */

export type ModuleOpenScope = {
    type: 'CONTAINER' | 'PANEL';
    id: string;
    name: string;
};

export interface ModuleOpenHandler {
    openCnc(scope: ModuleOpenScope): void;
    openReport(scope: ModuleOpenScope): void;
    openNesting(scope: ModuleOpenScope): void;
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
