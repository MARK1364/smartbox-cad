/**
 * Podłącza store złączy do dokumentu, czyści grupy po usunięciu formatek
 * i synchronizuje nawiercenia złączy z panel.features (reaktywnie).
 */

import type { ProjectDocument } from '../A1_core/project-document.js';
import { ConnectorStore } from './connector-store.js';
import { ConnectorVisualizer } from './connector-visualizer.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { SyncConnectorDrillingsCommand } from '../A1_core/commands/sync-connector-drillings-command.js';

/** Debounce timer — zapobiega wielokrotnemu sync w jednej pętli zdarzeń. */
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 80;

function scheduleDrillingSync(): void {
    if (_syncTimer !== null) {
        clearTimeout(_syncTimer);
    }
    _syncTimer = setTimeout(() => {
        _syncTimer = null;
        const history = ContextManager.instance.commandHistory;
        const doc = ContextManager.instance.document;
        if (history && doc) {
            history.execute(new SyncConnectorDrillingsCommand());
        }
    }, SYNC_DEBOUNCE_MS);
}

export function attachConnectorsExtension(document: ProjectDocument): () => void {
    const store = ConnectorStore.instance;
    const offExt = store.attachTo(document);
    ConnectorVisualizer.instance.attach();

    // Reaktywna synchronizacja: zmiana w ConnectorStore → przelicz nawiercenia
    const offSync = store.onChange(() => {
        scheduleDrillingSync();
    });
    scheduleDrillingSync();

    const offDoc = document.onDocumentChanged((event) => {
        if (event.type === 'structure' || event.type === 'loaded' || event.type === 'all') {
            const ids = new Set(document.getNodesByType(NodeType.PART).map((n) => n.id));
            store.pruneMissingNodes(ids);
        }
    });

    return () => {
        if (_syncTimer !== null) {
            clearTimeout(_syncTimer);
            _syncTimer = null;
        }
        offSync();
        offExt();
        offDoc();
    };
}
