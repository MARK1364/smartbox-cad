/**
 * Hooki SelectionTool — Core nie importuje A8 PMI ani S2 solver.
 * Rejestracja w warstwie aplikacji / modułach.
 */

export interface SelectionToolHooks {
    /** Delete (np. aktywny wymiar PMI). */
    deleteActiveAnnotation?: () => void;
    /** Escape podczas picka więzów — true = obsłużone. */
    cancelActivePick?: () => boolean;
}

let hooks: SelectionToolHooks = {};

export function registerSelectionToolHooks(partial: SelectionToolHooks): void {
    hooks = { ...hooks, ...partial };
}

export function getSelectionToolHooks(): SelectionToolHooks {
    return hooks;
}

export function resetSelectionToolHooksForTests(): void {
    hooks = {};
}
