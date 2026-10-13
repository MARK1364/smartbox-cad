/**
 * Schowek pola Parta → Panel aplikacji (jak Copy Driver w Blenderze).
 * Kopiujesz z Właściwości (Odstęp X/Y/Z…), wklejasz na kontrolkę w Panelu aplikacji.
 */

import type { SmartPartBindingField, SmartPartTargetType } from './smartpart-studio-types.js';

export type DrivingFieldClipboard = {
    targetType: SmartPartTargetType;
    targetId: string;
    field: SmartPartBindingField;
    /** Etykieta do nowego inputu / podpowiedzi */
    label: string;
    /** Aktualna wartość [mm] — default nowego parametru */
    valueMm: number;
    /** Dla wygody (jeśli targetType === 'PART') */
    partId?: string;
};

let clipboard: DrivingFieldClipboard | null = null;
const listeners = new Set<() => void>();

function notify(): void {
    listeners.forEach((fn) => fn());
}

/** Kopiuj z Właściwości Parta, Cięcia lub Kontenera (pole sterowane). */
export function copyDrivingParameter(opts: {
    targetType?: SmartPartTargetType;
    targetId?: string;
    partId?: string;
    field: SmartPartBindingField;
    label: string;
    valueMm: number;
}): DrivingFieldClipboard {
    const targetType = opts.targetType || (opts.partId ? 'PART' : 'MAIN');
    const targetId = opts.targetId || opts.partId || 'main_container';
    clipboard = {
        targetType,
        targetId,
        partId: targetType === 'PART' ? targetId : opts.partId,
        field: opts.field,
        label: (opts.label || opts.field).replace(/\s*\[mm\]\s*$/i, '').trim() || opts.field,
        valueMm: Number.isFinite(opts.valueMm) ? opts.valueMm : 0,
    };
    notify();
    return clipboard;
}

export function getDrivingParameterClipboard(): DrivingFieldClipboard | null {
    return clipboard;
}

export function clearDrivingParameterClipboard(): void {
    if (!clipboard) return;
    clipboard = null;
    notify();
}

export function subscribeDrivingParameterClipboard(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
