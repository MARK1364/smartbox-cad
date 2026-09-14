/**
 * SmartPanel Web — QuickPick Events
 * 
 * Zdarzenia i helpery wyzwalania okna QuickPick na scenie 3D.
 */

import type { QuickPickRequest } from './quick-pick-types.js';

export const CAD_OPEN_QUICK_PICK = 'cad-open-quick-pick';
export const CAD_CLOSE_QUICK_PICK = 'cad-close-quick-pick';

export function openQuickPick(request: QuickPickRequest): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(CAD_OPEN_QUICK_PICK, { detail: request }));
}

export function closeQuickPick(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(CAD_CLOSE_QUICK_PICK));
}
