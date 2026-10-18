/**
 * Test: updateCustomSmartPartParams przebudowuje features po zmianie offsetu.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import {
    applyCustomSmartPartToPanel,
    updateCustomSmartPartParams,
    SMARTPART_CUSTOM_TYPE,
    type SmartPartPackageDefinition,
} from '../index.js';

function nozkaPkg(): SmartPartPackageDefinition {
    const part = (id: string, refX: 'LEFT' | 'RIGHT', refY: 'FRONT' | 'BACK') => ({
        id,
        name: id,
        widthMm: 50,
        depthMm: 50,
        heightMm: 100,
        xMm: 0,
        yMm: 0,
        zMm: 0,
        refX,
        offsetX_mm: 50,
        refY,
        offsetY_mm: 60,
        refZ: 'BOTTOM' as const,
        offsetZ_mm: 50,
        colorHex: '#aaa',
    });
    return {
        id: 'sp:Nozka_Test',
        name: 'Nozka test',
        units: 'mm',
        version: '1.0',
        type: 'CUSTOM',
        cutsFrame: 'PART',
        mainContainer: { widthMm: 600, depthMm: 560, heightMm: 100 },
        parts: [
            part('lp', 'LEFT', 'FRONT'),
            part('pp', 'RIGHT', 'FRONT'),
        ],
        cuts: [
            {
                id: 'c1',
                name: 'otwor',
                type: 'HOLE',
                diameterMm: 5,
                lengthMm: 120,
                xMm: 0,
                yMm: 0,
                zMm: 0,
                axis: 'Z',
                direction: 1,
                partId: 'lp',
            },
        ],
        parameters: [
            { key: 'offset_lewy_mm', type: 'number', default_mm: 50, min_mm: 0, max_mm: 300, label: 'Offset lewy' },
        ],
        bindings: [
            { paramKey: 'offset_lewy_mm', partId: 'lp', field: 'offsetX_mm' },
        ],
        updatedAt: 0,
    };
}

describe('A5_smartparts — panel SMARTPART (nóżki)', () => {
    let doc: ProjectDocument;
    let panelNode: CADNode;

    beforeEach(() => {
        doc = new ProjectDocument();
        const panel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(560),
            thickness: mmToNm(18),
            name: 'Wieniec',
        });
        panelNode = new CADNode(panel.id, 'Wieniec', NodeType.PART);
        panelNode.domainData = panel;
        doc.addNode(doc.rootNode.id, panelNode);
    });

    it('apply zapisuje definition + paramValues i generuje feature', () => {
        const node = applyCustomSmartPartToPanel(doc, {
            definition: nozkaPkg(),
            targetPanelNode: panelNode,
            pickUvMm: { u: 300, v: 280 },
        });
        expect(node).toBeTruthy();
        const gp = (node!.domainData as any).generatorParams;
        expect(gp.type).toBe(SMARTPART_CUSTOM_TYPE);
        expect(gp.definition?.parameters?.length).toBe(1);
        expect(gp.paramValues.offset_lewy_mm).toBe(50);
        const features = (panelNode.domainData as any).features || [];
        const holes = features.filter((f: any) => f.params?.sourceContainerId === (node!.domainData as any).id);
        expect(holes.length).toBeGreaterThanOrEqual(1);
    });

    it('updateCustomSmartPartParams zmienia pozycję otworu po offset_lewy', () => {
        const node = applyCustomSmartPartToPanel(doc, {
            definition: nozkaPkg(),
            targetPanelNode: panelNode,
            pickUvMm: { u: 300, v: 280 },
        })!;
        const container = node.domainData as any;
        const before = ((panelNode.domainData as any).features as any[])
            .find((f) => f.params?.sourceContainerId === container.id);

        const ok = updateCustomSmartPartParams(doc, container, { offset_lewy_mm: 80 });
        expect(ok).toBe(true);
        expect(container.generatorParams.paramValues.offset_lewy_mm).toBe(80);
        expect(container.generatorParams.parts.find((p: any) => p.id === 'lp').offsetX_mm).toBe(80);

        const after = ((panelNode.domainData as any).features as any[])
            .find((f) => f.params?.sourceContainerId === container.id);
        expect(after).toBeTruthy();
        // part abs X: -300+80 = -220; cut lokalnie 0 → u = 300 + (-220)
        expect(after.params.u).toBe(300 - 220);
        expect(after.params.u).not.toBe(before.params.u);
    });
});
