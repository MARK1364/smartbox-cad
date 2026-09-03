/**
 * Port gizm offsetu krawędzi — Core nie zna Korpusu ani SmartBoxa.
 * Moduły A3/A2 rejestrują handlery: mapping ścian, odczyt, podgląd, zapis przez komendę.
 */

export type CadAxis = 'X' | 'Y' | 'Z';

export interface OffsetShiftSpec {
    paramSuffix: 'shiftX' | 'shiftY' | 'shiftZ';
    cadAxis: CadAxis;
    sign: 1 | -1;
}

export interface OffsetGizmoHandler {
    id: string;
    getFaceMapping(role: string): Record<string, string> | null;
    getShift(role: string): OffsetShiftSpec | null;
    resolveContainer(doc: any, panel: any): any | null;
    readOffsetMm(container: any, paramName: string, role?: string): number;
    previewOffset(container: any, paramName: string, value: number): void;
    commitOffset(container: any, paramName: string, oldValue: number, newValue: number): void;
}

const handlers: OffsetGizmoHandler[] = [];

export function registerOffsetGizmoHandler(handler: OffsetGizmoHandler): void {
    const idx = handlers.findIndex((h) => h.id === handler.id);
    if (idx >= 0) handlers[idx] = handler;
    else handlers.push(handler);
}

export function findOffsetGizmoHandler(role: string): OffsetGizmoHandler | null {
    if (!role) return null;
    for (const h of handlers) {
        if (h.getFaceMapping(role) || h.getShift(role)) return h;
    }
    return null;
}

export function resetOffsetGizmoHandlersForTests(): void {
    handlers.length = 0;
}
