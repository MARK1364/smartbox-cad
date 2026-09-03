/**
 * SmartPanel Web — Command Interface
 *
 * Wspólny kontrakt dla wszystkich komend modyfikujących ProjectDocument.
 * Każda trwała modyfikacja dokumentu odbywa się poprzez wykonanie komendy w CommandHistory.
 */

import { ProjectDocument } from '../project-document.js';

export interface Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    /** Wykonuje zmianę w dokumencie */
    execute(document: ProjectDocument): void;

    /** Odwraca zmianę w dokumencie */
    undo(document: ProjectDocument): void;

    /** Ponawia zmianę w dokumencie (domyślnie deleguje do execute) */
    redo?(document: ProjectDocument): void;
}
