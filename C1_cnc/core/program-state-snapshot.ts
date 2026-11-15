/**
 * SmartPanel Web — C1_CNC Program State Snapshot
 *
 * Snapshoty stanu programu CNC dla komend Undo/Redo. `targetPanel` jest
 * referencją cykliczną, więc nie wchodzi do snapshotu — po odtworzeniu
 * dowiązujemy go do aktualnej formatki.
 */

import type { CNCProgramState } from './cam-state-store.js';

export function snapshotProgramState(program: CNCProgramState | null | undefined): CNCProgramState | null {
    if (!program) return null;

    const { targetPanel: _targetPanel, ...rest } = program as any;
    try {
        return JSON.parse(JSON.stringify(rest)) as CNCProgramState;
    } catch {
        return {
            ...rest,
            features: Array.isArray(program.features) ? program.features.map(f => ({ ...f })) : [],
            toolAssignments: { ...(program.toolAssignments || {}) },
        } as CNCProgramState;
    }
}

function stableStringify(value: any): string {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).filter(key => key !== 'targetPanel').sort();
        return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

export function programStatesEqual(
    a: CNCProgramState | null | undefined,
    b: CNCProgramState | null | undefined
): boolean {
    if (a === b) return true;
    return stableStringify(snapshotProgramState(a)) === stableStringify(snapshotProgramState(b));
}
