/**
 * Po zmianie wymiarów płyty przelicz UV operacji z biblioteki.
 */

import type { ProjectDocument } from '../A1_core/project-document.js';
import { applyAllLibraryOperations } from './operacje-apply.js';

export function attachOperacjeExtension(document: ProjectDocument): () => void {
    const off = document.onDocumentChanged((event: { type?: string }) => {
        if (event.type === 'dimensions' || event.type === 'loaded' || event.type === 'all') {
            applyAllLibraryOperations(document);
        }
    });
    return typeof off === 'function' ? off : () => {};
}
