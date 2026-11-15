import { describe, expect, it } from 'vitest';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { extractNestingData, getNestingBlockReason } from '../core/nesting-data.js';

describe('nesting source data', () => {
    it('returns validation issues and blocks a plan when a project has an incomplete panel', () => {
        const document = new ProjectDocument();
        const panel = new PanelModel({
            width: mmToNm(431),
            height: mmToNm(807),
            thickness: mmToNm(23),
            name: 'Niekompletny bok',
            role: 'SIDE_PANEL',
        });
        panel.width = undefined as unknown as number;
        const node = CADNode.create(NodeType.PART, panel.name, panel.id);
        node.domainData = panel;
        document.addNode(document.rootNode.id, node);

        const validPanel = new PanelModel({
            width: mmToNm(430),
            height: mmToNm(800),
            thickness: mmToNm(18),
            name: 'Poprawny bok',
            role: 'SIDE_PANEL',
        });
        const validNode = CADNode.create(NodeType.PART, validPanel.name, validPanel.id);
        validNode.domainData = validPanel;
        document.addNode(document.rootNode.id, validNode);

        const data = extractNestingData(document);
        expect(data.parts).toHaveLength(1);
        expect(data.parts[0].sourceNodeId).toBe(validNode.id);
        expect(data.issues).toEqual([
            expect.objectContaining({
                node_id: node.id,
                reason: expect.stringContaining('width, height, thickness'),
            }),
        ]);
        expect(getNestingBlockReason(data.issues, data.parts.length)).toMatch(/niekompletnymi danymi/);
    });

    it('returns no fabricated parts or issues for a project without panels', () => {
        const data = extractNestingData(new ProjectDocument());

        expect(data.parts).toEqual([]);
        expect(data.issues).toEqual([]);
        expect(getNestingBlockReason(data.issues, data.parts.length)).toBe('Brak formatek do rozkroju.');
    });
});
