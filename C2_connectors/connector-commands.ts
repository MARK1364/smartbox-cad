/**
 * Komendy C2 — dodawanie / usuwanie / regeneracja grup złączy (Ctrl+Z).
 */

import type { Command } from '../A1_core/commands/command.js';
import { ContextManager } from '../A1_core/context-manager.js';
import type { ConnectorGroup } from './connectors-types.js';
import { ConnectorStore } from './connector-store.js';

function nextCommandId(kind: string): string {
    return `cmd_conn_${kind}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export function executeConnectorCommand(command: Command): void {
    const history = ContextManager.instance.commandHistory;
    if (history) {
        history.execute(command);
        return;
    }
    command.execute(null as any);
}

export class AddConnectorGroupCommand implements Command {
    readonly id = nextCommandId('add');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];
    private readonly store: ConnectorStore;
    private readonly group: ConnectorGroup;

    constructor(store: ConnectorStore, group: ConnectorGroup, label = 'Dodano złącza') {
        this.store = store;
        this.group = JSON.parse(JSON.stringify(group));
        this.label = label;
        this.affectedNodeIds = [group.parentObjectId];
    }

    execute(): void {
        if (!this.store.get(this.group.id)) {
            this.store.addGroup(JSON.parse(JSON.stringify(this.group)));
        }
    }

    undo(): void {
        this.store.removeGroup(this.group.id);
    }
}

export class RemoveConnectorGroupCommand implements Command {
    readonly id = nextCommandId('del');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];
    private readonly store: ConnectorStore;
    private readonly snapshot: ConnectorGroup;

    constructor(store: ConnectorStore, group: ConnectorGroup, label = 'Usunięto złącza') {
        this.store = store;
        this.snapshot = JSON.parse(JSON.stringify(group));
        this.label = label;
        this.affectedNodeIds = [group.parentObjectId];
    }

    execute(): void {
        this.store.removeGroup(this.snapshot.id);
    }

    undo(): void {
        if (!this.store.get(this.snapshot.id)) {
            this.store.addGroup(JSON.parse(JSON.stringify(this.snapshot)));
        }
    }
}

export class ReplaceConnectorGroupCommand implements Command {
    readonly id = nextCommandId('upd');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];
    private readonly store: ConnectorStore;
    private readonly before: ConnectorGroup;
    private readonly after: ConnectorGroup;

    constructor(store: ConnectorStore, before: ConnectorGroup, after: ConnectorGroup, label = 'Zaktualizowano złącza') {
        this.store = store;
        this.before = JSON.parse(JSON.stringify(before));
        this.after = JSON.parse(JSON.stringify(after));
        this.label = label;
        this.affectedNodeIds = [after.parentObjectId];
    }

    execute(): void {
        this.store.replaceGroup(this.after.id, JSON.parse(JSON.stringify(this.after)));
    }

    undo(): void {
        this.store.replaceGroup(this.before.id, JSON.parse(JSON.stringify(this.before)));
    }
}
