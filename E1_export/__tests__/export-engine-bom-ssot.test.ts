import { afterEach, describe, expect, it } from 'vitest';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { ExportEngine } from '../export-engine.js';

const originalDocument = ContextManager.instance.document;

afterEach(() => {
    ContextManager.instance.document = originalDocument;
});

describe('ExportEngine drawing-sheet BOM — PanelModel SSOT', () => {
    it('uses normalized PanelModel dimensions, material and edge data', () => {
        const document = new ProjectDocument();
        const panel = new PanelModel({
            width: mmToNm(431),
            height: mmToNm(807),
            thickness: mmToNm(23),
            name: 'SSOT bok',
            role: 'SIDE_PANEL',
        });
        panel.materialId = 'SSOT_MATERIAL_X';
        panel.edgeBanding = {
            '+X': { active: true, type_id: 'SSOT_EDGE' },
            '-X': { active: false, type_id: 'none' },
            '+Y': { active: false, type_id: 'none' },
            '-Y': { active: false, type_id: 'none' },
        };
        const node = CADNode.create(NodeType.PART, panel.name, panel.id);
        node.domainData = panel;
        document.addNode(document.rootNode.id, node);
        ContextManager.instance.document = document;

        expect(new ExportEngine().extractBOMRows()).toEqual([
            {
                name: 'SSOT bok',
                material: 'SSOT_MATERIAL_X',
                length: 807,
                width: 431,
                thickness: 23,
                qty: 1,
                edge_config: panel.edgeBanding,
            },
        ]);
    });

    it('fails with the missing PanelModel fields instead of using node params or defaults', () => {
        const document = new ProjectDocument();
        const panel = new PanelModel({
            width: mmToNm(431),
            height: mmToNm(807),
            thickness: mmToNm(23),
            name: 'Incomplete bok',
            role: 'SIDE_PANEL',
        });
        panel.width = undefined as unknown as number;
        const node = CADNode.create(NodeType.PART, panel.name, panel.id);
        node.domainData = panel;
        (node as any).params = {
            width: mmToNm(560),
            height: mmToNm(720),
            thickness: mmToNm(18),
            material: 'LEGACY_MATERIAL',
        };
        document.addNode(document.rootNode.id, node);
        ContextManager.instance.document = document;

        expect(() => new ExportEngine().extractBOMRows()).toThrow(
            /Incomplete bok .* Brak wymaganych dodatnich wymiarów PanelModel/,
        );
    });
});
