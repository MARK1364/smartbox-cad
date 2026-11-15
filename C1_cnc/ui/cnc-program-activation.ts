/**
 * SmartPanel Web — C1_CNC Program Activation Update
 *
 * Buduje jeden kompletny zestaw pól do aktywacji programu CNC. Dzięki temu
 * przełączenie programu wywołuje jedno updateProg() i publikuje jedną spójną
 * rewizję dokumentu zamiast trzech stanów pośrednich.
 */

import type { CNCProgramState } from '../core/cam-state-store.js';

export function applyProgramActivation(
    updateProg: (updates: Partial<CNCProgramState>) => void,
    program: Partial<CNCProgramState> | null | undefined
): void {
    if (!program) return;
    updateProg({
        wcsName: program.wcsName || 'G55',
        cornerIndex: typeof program.cornerIndex === 'number' ? program.cornerIndex : -1,
        postprocessor: program.postprocessor || 'Mach3',
    });
}
