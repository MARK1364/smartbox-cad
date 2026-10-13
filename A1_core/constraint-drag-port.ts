/**
 * Port dragowania z więzami — Core nie importuje S2.
 * S2 rejestruje adapter wokół ConstraintDragGroup + ConstraintStore.
 */

import type { Command } from './commands/command.js';
import type { ProjectDocument } from './project-document.js';

export interface ConstraintDragPort {
    begin(document: ProjectDocument, nodeId: string): void;
    propagateTransform(document: ProjectDocument, draggedNodeId: string): void;
    buildTransformCommands(document: ProjectDocument, label: string): Command[];
    restoreInitial(document: ProjectDocument): void;
    end(): void;
    getAffectedNodeIds?(): Set<string>;
}

let port: ConstraintDragPort | null = null;

export function registerConstraintDragPort(p: ConstraintDragPort): void {
    port = p;
}

export function getConstraintDragPort(): ConstraintDragPort | null {
    return port;
}

export function resetConstraintDragPortForTests(): void {
    port = null;
}
