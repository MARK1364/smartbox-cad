/**
 * Po zmianie wymiarów płyty przelicz UV operacji z biblioteki.
 */

import type { ProjectDocument } from '../A1_core/project-document.js';
import { applyAllLibraryOperations } from './operacje-apply.js';
import { LedChannelStore } from '../A5_smartparts/led/led-channel-store.js';

export function attachOperacjeExtension(document: ProjectDocument): () => void {
    const unreg = document.registerExtension('ledChannels', LedChannelStore.instance);
    const off = document.onDocumentChanged((event: { type?: string }) => {
        if (
            event.type === 'dimensions' ||
            event.type === 'loaded' ||
            event.type === 'all' ||
            event.type === 'transform' ||
            event.type === 'structure'
        ) {
            applyAllLibraryOperations(document);
            LedChannelStore.instance.syncAll();
        }
    });
    return () => {
        if (typeof unreg === 'function') unreg();
        if (typeof off === 'function') off();
    };
}

