/**
 * SmartPanel Web — C1_CNC Command Execution Guard
 *
 * Trwałe zmiany programów CNC wykonujemy wyłącznie przez historię komend.
 * Brak historii lub dokumentu nie jest po cichu zastępowany bezpośrednim
 * wywołaniem command.execute() — operacja jest wtedy blokowana.
 */

import type { Command } from '../../A1_core/commands/command.js';
import type { CommandHistory } from '../../A1_core/commands/command-history.js';
import type { ProjectDocument } from '../../A1_core/project-document.js';

export function executeCncCommand(
    history: CommandHistory | null | undefined,
    document: ProjectDocument | null | undefined,
    command: Command
): boolean {
    if (!history || !document) return false;
    history.execute(command);
    return true;
}
