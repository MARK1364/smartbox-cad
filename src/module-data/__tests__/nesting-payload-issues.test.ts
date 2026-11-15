import { describe, expect, it } from 'vitest';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../../A1_core/cad-node/node-type.js';
import { mmToNm } from '../../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../../A1_core/project-document.js';
import { PanelModel } from '../../../A4_smartpanel/panel-model.js';
import { extractNestingPayload } from '../cad-extract.js';

describe('nesting module payload validation', () => {
    it('passes skipped PanelModel issues to the standalone nesting page', () => {
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

        const payload = extractNestingPayload(
            { type: 'PROJECT', id: 'ALL', name: 'Projekt' },
            document,
        );

        expect(payload.parts).toEqual([]);
        expect(payload.issues).toEqual([
            expect.objectContaining({
                node_id: node.id,
                reason: expect.stringContaining('width, height, thickness'),
            }),
        ]);
    });
});
