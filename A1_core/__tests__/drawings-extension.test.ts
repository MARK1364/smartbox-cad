import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { attachDrawingsExtension, DRAWINGS_DOCUMENT_SECTION } from '../drawings-document-extension.js';
import { ExportEngine } from '../../E1_export/export-engine.js';
import { ExportEngineV3 } from '../../E3_export/export-engine.js';

const sampleSheet = {
    id: 'view_test_1',
    name: 'Rzut przód',
    createdAt: '2026-08-22T00:00:00.000Z',
    paperFormat: 'A4_LANDSCAPE' as const,
    projectionType: 'ORTHO' as const,
    cameraAlpha: 1.1,
    cameraBeta: 0.7,
    cameraRadius: 1600,
    cameraTarget: [10, 20, 30] as [number, number, number],
    notes: 'test',
    includeBOM: false,
    includePMI: true,
    titleBlock: { projectName: 'Szafa test' },
    thumbnail: 'data:image/png;base64,AAAA',
};

describe('extensions.drawings', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Drawings' });
        attachDrawingsExtension(doc);
        ExportEngine.instance.replaceSavedViews([]);
        ExportEngineV3.instance.replaceSavedViews([]);
    });

    afterEach(() => {
        ExportEngine.instance.replaceSavedViews([]);
        ExportEngineV3.instance.replaceSavedViews([]);
    });

    it('stores E1/E3 sheets under extensions.drawings', () => {
        ExportEngine.instance.replaceSavedViews([sampleSheet]);
        ExportEngineV3.instance.replaceSavedViews([{ ...sampleSheet, id: 'e3_1', name: 'E3 arkusz' }]);

        const json = JSON.parse(JSON.stringify(doc.serialize()));
        expect(json).not.toHaveProperty('drawings');
        const drawings = json.extensions[DRAWINGS_DOCUMENT_SECTION];
        expect(drawings.version).toBe(1);
        expect(drawings.e1.sheets).toHaveLength(1);
        expect(drawings.e1.sheets[0].name).toBe('Rzut przód');
        expect(drawings.e1.sheets[0].thumbnail).toBeUndefined();
        expect(drawings.e3.sheets[0].id).toBe('e3_1');
    });

    it('round-trips drawings through load()', () => {
        ExportEngine.instance.replaceSavedViews([sampleSheet]);
        const json = JSON.parse(JSON.stringify(doc.serialize()));

        ExportEngine.instance.replaceSavedViews([]);
        const restored = new ProjectDocument();
        attachDrawingsExtension(restored);
        restored.load(json);

        expect(ExportEngine.instance.savedViews).toHaveLength(1);
        expect(ExportEngine.instance.savedViews[0].name).toBe('Rzut przód');
        expect(ExportEngine.instance.savedViews[0].cameraAlpha).toBe(1.1);

        const again = JSON.parse(JSON.stringify(restored.serialize()));
        expect(again.extensions[DRAWINGS_DOCUMENT_SECTION].e1.sheets[0].name).toBe('Rzut przód');
    });

    it('omits drawings from undo snapshots and keeps live sheets on snapshot load', () => {
        ExportEngine.instance.replaceSavedViews([sampleSheet]);
        const full = doc.serialize();
        expect(full.extensions?.[DRAWINGS_DOCUMENT_SECTION].e1.sheets).toHaveLength(1);

        const snap = doc.serialize({ snapshot: true });
        expect(snap.extensions?.[DRAWINGS_DOCUMENT_SECTION]).toBeUndefined();

        doc.load(snap, { snapshot: true });
        expect(ExportEngine.instance.savedViews).toHaveLength(1);
        expect(ExportEngine.instance.savedViews[0].name).toBe('Rzut przód');
    });
});
