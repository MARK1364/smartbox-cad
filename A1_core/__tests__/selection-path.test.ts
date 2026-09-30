import { describe, it, expect, beforeEach } from 'vitest';
import { mmToNm } from '../cad-math/units.js';
import { ProjectDocument } from '../project-document.js';
import '../../src/application/project-domain.js';
import { NodeType } from '../cad-node/node-type.js';
import { buildSelectionChain, findFeatureOwner, resolveFeatureId } from '../selection-path.js';

describe('selection-path', () => {
    let doc: ProjectDocument;
    let korpus: any;
    let panel: any;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Test' });
        korpus = doc.createAssembly({ name: 'Korpus' });
        panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'BOK_L' }, korpus.id);
        panel.features = [{ id: 'g_back', type: 'groove', name: 'Przetłoczenie' }];
    });

    it('panel ma type "part" — właściciel operacji i tak zostaje znaleziony', () => {
        expect(panel.type).toBe('part');
        const owner = findFeatureOwner(doc, 'g_back');
        expect(owner?.node.id).toBe(panel.id);
        expect(owner?.feature.type).toBe('groove');
    });

    it('ścieżka zaznaczonej operacji: korpus → panel → operacja', () => {
        doc.setActiveEntity(panel);
        const { nodes, owner } = buildSelectionChain(doc, 'g_back');
        expect(nodes.map(n => n.id)).toEqual([korpus.id, panel.id]);
        expect(nodes.map(n => n.nodeType)).toEqual([NodeType.ASSEMBLY, NodeType.PART]);
        expect(owner?.feature.id).toBe('g_back');
    });

    it('operacja znika ze ścieżki, gdy aktywny jest inny obiekt', () => {
        doc.setActiveEntity(korpus);
        expect(resolveFeatureId(doc, 'g_back')).toBeNull();
        expect(buildSelectionChain(doc, 'g_back').owner).toBeNull();
    });

    it('nieistniejąca operacja nie trafia do ścieżki', () => {
        doc.setActiveEntity(panel);
        expect(resolveFeatureId(doc, 'brak')).toBeNull();
        const { nodes, owner } = buildSelectionChain(doc, 'brak');
        expect(owner).toBeNull();
        expect(nodes.map(n => n.id)).toEqual([korpus.id, panel.id]);
    });

    it('bez operacji ścieżka idzie od activeEntity w górę', () => {
        doc.setActiveEntity(panel);
        expect(buildSelectionChain(doc, null).nodes.map(n => n.id)).toEqual([korpus.id, panel.id]);
        doc.setActiveEntity(korpus);
        expect(buildSelectionChain(doc, null).nodes.map(n => n.id)).toEqual([korpus.id]);
    });
});
