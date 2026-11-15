import { describe, expect, it } from 'vitest';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { GlobalReportsEngineWeb } from '../global-reports-engine.js';
import { HtmlReportsGeneratorWeb } from '../html-reports-generator.js';
import { ReportDataNormalizer } from '../report-data-normalizer.js';

function createDocumentWithPanel(): { document: ProjectDocument; panel: PanelModel; node: CADNode } {
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
    return { document, panel, node };
}

describe('R1_reports — PanelModel SSOT', () => {
    it('uses the same PanelModel dimensions, material and edge data in report, BOM and CSV outputs', () => {
        const { document } = createDocumentWithPanel();
        const extracted = ReportDataNormalizer.extractProjectData(document);
        expect(extracted.issues).toEqual([]);
        expect(extracted.panels).toHaveLength(1);

        const row = extracted.panels[0];
        expect(row).toMatchObject({
            length_mm: 807,
            width_mm: 431,
            thickness_mm: 23,
            material: 'SSOT_MATERIAL_X',
        });
        expect(row.edge_config['+X']).toEqual({ active: true, type_id: 'SSOT_EDGE' });

        const engine = new GlobalReportsEngineWeb();
        const priced = extracted.panels.map((panel) => engine.calculatePartPricing(panel));
        const summary = engine.calculateGlobalSummary(priced);
        const generator = new HtmlReportsGeneratorWeb(engine);
        const reportHtml = generator.generateFullProjectReport('SSOT', summary, priced, [], extracted.issues);
        const bomHtml = generator.generateOrderReportHtml('SSOT', extracted.panels);
        const csv = generator.generateCsv(extracted.panels, 'detailed');

        expect(reportHtml).toContain('807 × 431 × 23');
        expect(reportHtml).toContain('Drukuj / PDF');
        for (const output of [reportHtml, bomHtml]) {
            expect(output).toContain('SSOT MATERIAL X');
        }
        expect(bomHtml).toContain('807 mm');
        expect(bomHtml).toContain('431 mm');
        expect(csv).toContain(';807;0;431;1;1;');
        expect(csv).toContain('"SSOT MATERIAL X";23');
    });

    it('reports missing PanelModel dimensions instead of reading CADNode params or inventing defaults', () => {
        const { document, panel, node } = createDocumentWithPanel();
        panel.width = undefined as unknown as number;
        (node as any).params = {
            width: mmToNm(720),
            height: mmToNm(560),
            thickness: mmToNm(18),
            materialId: 'PARALLEL_NODE_MATERIAL',
        };

        const extracted = ReportDataNormalizer.extractProjectData(document);
        expect(extracted.panels).toEqual([]);
        expect(extracted.issues).toEqual([
            expect.objectContaining({
                node_id: node.id,
                reason: expect.stringContaining('width, height, thickness'),
            }),
        ]);

        const summary = new GlobalReportsEngineWeb().calculateGlobalSummary([]);
        const html = new HtmlReportsGeneratorWeb().generateFullProjectReport(
            'Incomplete',
            summary,
            [],
            [],
            extracted.issues,
        );
        expect(html).toContain('Pominięto 1 formatkę');
        expect(html).toContain('width, height, thickness');
        expect(html).not.toContain('720 × 560 × 18');
        expect(html).not.toContain('PARALLEL_NODE_MATERIAL');
    });
});
