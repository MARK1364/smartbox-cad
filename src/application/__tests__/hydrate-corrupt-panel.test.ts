import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../../A1_core/project-document.js';
import { NodeType } from '../../../A1_core/cad-node/node-type.js';
import { hydratePanel } from '../project-domain.js';
import '../project-domain.js';

describe('ProjectDocument & hydratePanel — samonaprawa formatki z ujemnymi wymiarami', () => {
    it('hydratePanel naprawia ujemne wymiary (np. width=-23000000 nm)', () => {
        const raw = {
            id: 'panel_26',
            width: -23000000,
            height: 732000000,
            thickness: 18000000,
            name: 'Drzwi_Lewe',
            role: 'FRONT',
        };
        const panel = hydratePanel(raw, { id: 'panel_26', name: 'Drzwi_Lewe' });
        expect(panel.id).toBe('panel_26');
        expect(panel.width).toBeGreaterThan(0);
        expect(panel.height).toBe(732000000);
        expect(panel.thickness).toBe(18000000);
    });

    it('ProjectDocument.load wczytuje projekt nawet jeśli zawiera panel z ujemnymi wymiarami', () => {
        const doc = new ProjectDocument();
        const projectData = {
            format: 'smartpanel-project',
            version: 4,
            domainUnit: 'nm',
            id: 'doc_corrupt_test',
            name: 'Test Project',
            rootNode: {
                id: 'root_room',
                name: 'Pokój',
                nodeType: NodeType.ROOM,
                children: [
                    {
                        id: 'panel_26',
                        name: 'Drzwi_Lewe',
                        nodeType: NodeType.PART,
                        children: [],
                        domainData: {
                            id: 'panel_26',
                            name: 'Drzwi_Lewe',
                            role: 'FRONT',
                            width: -23000000,
                            height: 732000000,
                            thickness: 18000000,
                        },
                    },
                ],
            },
        };

        expect(() => doc.load(projectData)).not.toThrow();
        const node = doc.findNode('panel_26');
        expect(node).toBeDefined();
        const panelModel = node?.domainData as any;
        expect(panelModel.width).toBeGreaterThan(0);
        expect(panelModel.height).toBe(732000000);
    });
});
