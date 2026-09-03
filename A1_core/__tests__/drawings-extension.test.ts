import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { attachDrawingsExtension, DRAWINGS_DOCUMENT_SECTION } from '../drawings-document-extension.js';
import { ExportEngine } from '../../E1_export/export-engine.js';
import { ExportEngineV3 } from '../../E3_export/export-engine.js';
import { ExportEngineV2 } from '../../E2_export/export-engine-v2.js';

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

const samplePlaced = {
    id: 'm1',
    nodeId: 'panel_1',
    nodeName: 'Bok',
    nodeType: 'PART',
    width: 600,
    height: 720,
    depth: 18,
    thickness: 18,
    angleName: 'Przód',
    showPMI: true,
    position: [120, 80, 0] as [number, number, number],
};

describe('extensions.drawings', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Drawings' });
        attachDrawingsExtension(doc);
        ExportEngine.instance.replaceSavedViews([]);
        ExportEngineV3.instance.replaceSavedViews([]);
        ExportEngineV2.instance.restoreLayout(null);
    });

    afterEach(() => {
        ExportEngine.instance.replaceSavedViews([]);
        ExportEngineV3.instance.replaceSavedViews([]);
        ExportEngineV2.instance.restoreLayout(null);
    });

    it('stores E1/E3 sheets and E2 layout under extensions.drawings', () => {
        ExportEngine.instance.replaceSavedViews([sampleSheet]);
        ExportEngineV3.instance.replaceSavedViews([{ ...sampleSheet, id: 'e3_1', name: 'E3 arkusz' }]);
        ExportEngineV2.instance.restoreLayout({
            paperFormat: 'A3_LANDSCAPE',
            includePMI: false,
            notes: 'układ',
            placedModels: [samplePlaced],
        });

        expect(ExportEngineV2.instance.placedModels).toHaveLength(0);

        const json = JSON.parse(JSON.stringify(doc.serialize()));
        expect(json).not.toHaveProperty('drawings');
        const drawings = json.extensions[DRAWINGS_DOCUMENT_SECTION];
        expect(drawings.version).toBe(1);
        expect(drawings.e1.sheets).toHaveLength(1);
        expect(drawings.e1.sheets[0].name).toBe('Rzut przód');
        expect(drawings.e1.sheets[0].thumbnail).toBeUndefined();
        expect(drawings.e3.sheets[0].id).toBe('e3_1');
        expect(drawings.e2.paperFormat).toBe('A3_LANDSCAPE');
        expect(drawings.e2.placedModels[0].nodeId).toBe('panel_1');
        expect(drawings.e2.placedModels[0].rootNode).toBeUndefined();
        expect(drawings.e2.placedModels[0].position).toEqual([120, 80, 0]);
    });

    it('round-trips drawings through load() without ghost E2 models', () => {
        const panel = doc.createPanel({ name: 'Bok' });
        ExportEngine.instance.replaceSavedViews([sampleSheet]);
        ExportEngineV2.instance.restoreLayout({
            paperFormat: 'A3_LANDSCAPE',
            notes: 'układ',
            placedModels: [{ ...samplePlaced, nodeId: panel.id }],
        });
        const json = JSON.parse(JSON.stringify(doc.serialize()));

        ExportEngine.instance.replaceSavedViews([]);
        ExportEngineV2.instance.restoreLayout(null);
        const restored = new ProjectDocument();
        attachDrawingsExtension(restored);
        restored.load(json);

        expect(ExportEngine.instance.savedViews).toHaveLength(1);
        expect(ExportEngine.instance.savedViews[0].name).toBe('Rzut przód');
        expect(ExportEngine.instance.savedViews[0].cameraAlpha).toBe(1.1);
        expect(ExportEngineV2.instance.paperFormat).toBe('A3_LANDSCAPE');
        expect(ExportEngineV2.instance.notes).toBe('układ');
        expect(ExportEngineV2.instance.placedModels).toHaveLength(0);

        const rebuilt = ExportEngineV2.instance.rebuildPendingModels(restored);
        expect(rebuilt).toBe(0);
        expect(ExportEngineV2.instance.placedModels).toHaveLength(0);

        const again = JSON.parse(JSON.stringify(restored.serialize()));
        expect(again.extensions[DRAWINGS_DOCUMENT_SECTION].e1.sheets[0].name).toBe('Rzut przód');
        expect(again.extensions[DRAWINGS_DOCUMENT_SECTION].e2.placedModels[0].nodeId).toBe(panel.id);
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
