/**
 * SmartPanel Web — C1_CNC Feature Edit Update
 *
 * Aplikuje edycję pojedynczej operacji przez wspólną ścieżkę updateProg(),
 * która zapisuje program z powrotem do listy formatki i powiadamia dokument.
 * Dzięki temu edycja nie zostaje wyłącznie w CAMStateStore.
 */

import type { CAMFeature } from '../dto/cam-dto.js';
import type { CNCProgramState } from '../core/cam-state-store.js';

export function applyFeatureEdit(
    updateProg: (updater: (program: CNCProgramState) => CNCProgramState) => void,
    featureId: string | null,
    updatedFeature: CAMFeature | null | undefined
): void {
    if (featureId === null || !updatedFeature) return;

    updateProg(program => {
        const targetIndex = program.features.findIndex(f => f.featureId === featureId);
        if (targetIndex < 0) return program;

        const updatedFeatures = [...program.features];
        updatedFeatures[targetIndex] = updatedFeature;
        const nextAssignments = { ...(program.toolAssignments || {}) };
        if (updatedFeature.toolId) {
            nextAssignments[updatedFeature.featureId] = updatedFeature.toolId;
        } else {
            delete nextAssignments[updatedFeature.featureId];
        }
        if (updatedFeature.featureId !== featureId) {
            delete nextAssignments[featureId];
        }
        return { ...program, features: updatedFeatures, toolAssignments: nextAssignments };
    });
}
