import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { attachMaterialsExtension, collectUsedMaterials, MATERIALS_DOCUMENT_SECTION } from '../materials-document-extension.js';
import { materialDatabase } from '../material-database.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';

describe('extensions.materials', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Material overlay' });
        attachMaterialsExtension(doc);
    });

    it('writes only materials referenced by panels, under extensions.materials', () => {
        const panel = doc.createPanel({ name: 'Bok' }) as PanelModel;
        panel.materialId = 'W1100_ST9_18';
        panel.setEdgeBand('+X', { type_id: 'ABS_0.8x22', name: 'ABS 0.8' });

        const json = JSON.parse(JSON.stringify(doc.serialize()));
        expect(json).not.toHaveProperty('materials');
        const section = json.extensions[MATERIALS_DOCUMENT_SECTION];
        expect(section.version).toBe(1);
        expect(section.materials.some((m: any) => m.id === 'W1100_ST9_18')).toBe(true);
        expect(section.edgeBandings.some((e: any) => e.id === 'ABS_0.8x22')).toBe(true);
        expect(section.materials.length).toBeLessThan(materialDatabase.getAllMaterials().length);
    });

    it('round-trips overlay and merges unknown ids into the catalog', () => {
        const panel = doc.createPanel({ name: 'Custom' }) as PanelModel;
        panel.materialId = 'CUSTOM_PROJECT_MAT';
        panel.materialName = 'Koronka projektowa';
        panel.materialCode = 'CUST 01';
        panel.color = { r: 0.2, g: 0.4, b: 0.1 };

        const json = JSON.parse(JSON.stringify(doc.serialize()));
        const overlay = collectUsedMaterials(doc);
        expect(overlay.materials.some((m) => m.id === 'CUSTOM_PROJECT_MAT')).toBe(true);

        const restored = new ProjectDocument();
        attachMaterialsExtension(restored);
        restored.load(json);

        expect(materialDatabase.getMaterialById('CUSTOM_PROJECT_MAT')?.name).toBe('Koronka projektowa');
        const restoredPanel = restored.findNode(panel.id)!.domainData as PanelModel;
        expect(restoredPanel.materialId).toBe('CUSTOM_PROJECT_MAT');
    });

    it('omits materials from undo snapshots', () => {
        const panel = doc.createPanel({ name: 'Bok' }) as PanelModel;
        panel.materialId = 'W1100_ST9_18';
        expect(doc.serialize().extensions[MATERIALS_DOCUMENT_SECTION].materials.length).toBeGreaterThan(0);
        expect(doc.serialize({ snapshot: true }).extensions?.[MATERIALS_DOCUMENT_SECTION]).toBeUndefined();
    });
});
