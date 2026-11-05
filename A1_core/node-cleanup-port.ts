/**
 * Port sprzątania przy usuwaniu węzła — Core nie zna domenowych zasobów.
 * Moduły rejestrują handlery, które zwracają odwracalne komendy czyszczenia.
 */

import type { CADNode } from './cad-node/cad-node.js';
import type { Command } from './commands/command.js';

export interface NodeCleanupHandler {
    id: string;
    collectIds(node: CADNode): string[];
    createClearCommand(id: string): Command;
}

const handlers: NodeCleanupHandler[] = [];

export function registerNodeCleanupHandler(handler: NodeCleanupHandler): () => void {
    const idx = handlers.findIndex((h) => h.id === handler.id);
    if (idx >= 0) handlers[idx] = handler;
    else handlers.push(handler);
    return () => {
        const registeredIndex = handlers.indexOf(handler);
        if (registeredIndex !== -1) handlers.splice(registeredIndex, 1);
    };
}

export function collectNodeCleanupCommands(node: CADNode): Command[] {
    const cmds: Command[] = [];
    const seen = new Set<string>();
    for (const h of handlers) {
        for (const id of h.collectIds(node)) {
            const key = `${h.id}:${id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            cmds.push(h.createClearCommand(id));
        }
    }
    return cmds;
}

export function resetNodeCleanupHandlersForTests(): void {
    handlers.length = 0;
}
