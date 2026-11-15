import { afterEach, describe, expect, it } from 'vitest';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { mmToNm } from '../A1_core/cad-math/units.js';
import { ProjectDocument } from '../A1_core/project-document.js';
import { PanelModel } from '../A4_smartpanel/panel-model.js';
import { DrawingProjectExtractor } from './drawing-project-extractor.js';

describe('DrawingProjectExtractor PanelModel SSOT', () => {
    const originalDocument = ContextManager.instance.document;

    afterEach(() => {
        ContextManager.instance.document = originalDocument;
    });

    it('omits incomplete panels and reports missing PanelModel and groove data', () => {
        const document = new ProjectDocument({ name: 'Rysunek SSOT' });
        const validPanel = new PanelModel({
            width: mmToNm(431),
            height: mmToNm(807),
            thickness: mmToNm(23),
            name: 'Poprawny bok',
            role: 'SIDE_PANEL',
        });
        validPanel.materialId = 'SSOT_MATERIAL_X';
        validPanel.materialName = 'Materiał SSOT';
        validPanel.features.push({
            id: 'missing-height-groove',
            type: 'groove',
            params: { u: 10, v: 20, width: 4, depth: 8 },
        });
        validPanel.features.push({
            id: 'connector-hole',
            type: 'hole',
            face: 'FACE_X_PLUS',
            params: { u: 24.6, v: 55.3, diameter: 8, depth: 25 },
        });
        validPanel.features.push({
            id: 'fractional-groove',
            type: 'groove',
            params: { u: 12.4, v: 23.7, width: 4.5, length: 31.2, depth: 6.8 },
        });
        validPanel.features.push({
            id: 'incomplete-hole',
            type: 'hole',
            params: { diameter: 8, depth: 25 },
        });
        const validNode = CADNode.create(NodeType.PART, validPanel.name, validPanel.id);
        validNode.domainData = validPanel;
        document.addNode(document.rootNode.id, validNode);

        const invalidPanel = new PanelModel({
            width: mmToNm(560),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Niekompletny bok',
            role: 'SIDE_PANEL',
        });
        invalidPanel.width = undefined as unknown as number;
        const invalidNode = CADNode.create(NodeType.PART, invalidPanel.name, invalidPanel.id);
        invalidNode.domainData = invalidPanel;
        document.addNode(document.rootNode.id, invalidNode);
        ContextManager.instance.document = document;

        const tree = DrawingProjectExtractor.instance.extractProjectTree();
        const mappedValidNode = tree.rootNode.children?.find((node) => node.id === validNode.id);
        const mappedInvalidNode = tree.rootNode.children?.find((node) => node.id === invalidNode.id);

        expect(mappedValidNode).toMatchObject({
            width: 431,
            height: 807,
            thickness: 23,
            material: 'Materiał SSOT',
            dataValid: true,
        });
        expect(mappedValidNode?.holes).toEqual([
            {
                id: 'connector-hole',
                x: 24.6,
                y: 55.3,
                diameter: 8,
                depth: 25,
                face: 'FACE_X_PLUS',
                frozen: false,
            },
        ]);
        expect(mappedValidNode?.grooves).toEqual([
            expect.objectContaining({
                id: 'fractional-groove',
                x: 12.4,
                y: 23.7,
                width: 4.5,
                height: 31.2,
                depth: 6.8,
            }),
        ]);
        expect(mappedInvalidNode).toMatchObject({
            width: 0,
            height: 0,
            thickness: 0,
            material: undefined,
            dataValid: false,
        });
        expect(tree.standaloneParts.map((part) => part.id)).toEqual([validNode.id]);
        expect(tree.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                node_id: invalidNode.id,
                reason: expect.stringContaining('width'),
            }),
            expect.objectContaining({
                node_id: validNode.id,
                feature_id: 'missing-height-groove',
                reason: expect.stringContaining('wysokość/długość'),
            }),
            expect.objectContaining({
                node_id: validNode.id,
                feature_id: 'incomplete-hole',
                reason: expect.stringContaining('pozycja U/X, pozycja V/Y, ściana'),
            }),
        ]));
    });

    it('marks a PART without domainData invalid and reports the missing PanelModel', () => {
        const document = new ProjectDocument({ name: 'Brak domainData' });
        const node = CADNode.create(NodeType.PART, 'Osierocona formatka', 'orphan-part');
        document.addNode(document.rootNode.id, node);
        ContextManager.instance.document = document;

        const tree = DrawingProjectExtractor.instance.extractProjectTree();
        const mappedNode = tree.rootNode.children?.find((child) => child.id === node.id);

        expect(mappedNode).toMatchObject({
            width: 0,
            height: 0,
            depth: 0,
            thickness: 0,
            dataValid: false,
            partCount: 0,
        });
        expect(tree.standaloneParts).toEqual([]);
        expect(tree.issues).toContainEqual({
            node_id: node.id,
            node_name: 'Osierocona formatka',
            reason: 'Brak danych PanelModel w CADNode.domainData.',
        });
    });
});
