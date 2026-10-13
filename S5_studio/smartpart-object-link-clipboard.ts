/**
 * Schowek parametru ID obiektu (Part / wycięcie) z drzewa Studio.
 * „Kopiuj parametr ID” → Panel aplikacji → „Wklej parametr ID” na Check (frozen).
 */

export type ObjectLinkClipboard = {
    targetType: 'PART' | 'CUT';
    targetId: string;
    /** Nazwa do etykiety checka */
    label: string;
};

let clipboard: ObjectLinkClipboard | null = null;
const listeners = new Set<() => void>();

function notify(): void {
    listeners.forEach((fn) => fn());
}

/** Kopiuj parametr ID Parta lub wycięcia — do powiązania check → frozen. */
export function copyObjectLink(opts: {
    targetType: 'PART' | 'CUT';
    targetId: string;
    label: string;
}): ObjectLinkClipboard {
    clipboard = {
        targetType: opts.targetType,
        targetId: opts.targetId,
        label: String(opts.label || opts.targetId).trim() || opts.targetId,
    };
    notify();
    return clipboard;
}

export function getObjectLinkClipboard(): ObjectLinkClipboard | null {
    return clipboard;
}

export function clearObjectLinkClipboard(): void {
    if (!clipboard) return;
    clipboard = null;
    notify();
}

export function subscribeObjectLinkClipboard(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
