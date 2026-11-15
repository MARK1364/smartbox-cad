/**
 * Test: updateCustomSmartPartParams przebudowuje features po zmianie offsetu.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
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
import { UpdateCustomSmartPartParamsCommand } from '../update-custom-smartpart-params-command.js';

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

    it('parametry SmartPart są cofane i ponawiane razem z wymiarami i cechami', () => {
        const node = applyCustomSmartPartToPanel(doc, {
            definition: nozkaPkg(),
            targetPanelNode: panelNode,
            pickUvMm: { u: 300, v: 280 },
        })!;
        const container = node.domainData as any;
        const panel = panelNode.domainData as PanelModel;
        const beforeValues = { ...container.generatorParams.paramValues };
        const beforeFeatures = panel.features.map((feature) => ({ ...feature, params: { ...feature.params } }));
        const beforeWidth = container.width;
        const history = new CommandHistory(doc);

        history.execute(new UpdateCustomSmartPartParamsCommand(
            container,
            beforeValues,
            { ...beforeValues, offset_lewy_mm: 80 },
        ));
        expect(container.generatorParams.paramValues.offset_lewy_mm).toBe(80);
        expect(panel.features).not.toEqual(beforeFeatures);

        expect(history.undo()).toBe(true);
        expect(container.generatorParams.paramValues).toEqual(beforeValues);
        expect(container.width).toBe(beforeWidth);
        expect(panel.features).toEqual(beforeFeatures);

        expect(history.redo()).toBe(true);
        expect(container.generatorParams.paramValues.offset_lewy_mm).toBe(80);
        expect(panel.features).not.toEqual(beforeFeatures);
    });

    it('rollbackuje parametry i cechy, gdy aktualizacja cech zawiedzie', () => {
        const node = applyCustomSmartPartToPanel(doc, {
            definition: nozkaPkg(),
            targetPanelNode: panelNode,
            pickUvMm: { u: 300, v: 280 },
        })!;
        const container = node.domainData as any;
        const panel = panelNode.domainData as PanelModel;
        const beforeParams = JSON.parse(JSON.stringify(container.generatorParams));
        const beforeDimensions = [container.width, container.height, container.depth];
        const beforeFeatures = panel.features.map((feature) => ({ ...feature, params: { ...feature.params } }));
        const setFeatures = vi.spyOn(panel, 'setFeatures').mockImplementationOnce(() => {
            throw new Error('test SmartPart feature update failure');
        });
        const history = new CommandHistory(doc);

        expect(() => history.execute(new UpdateCustomSmartPartParamsCommand(
            container,
            { ...beforeParams.paramValues },
            { ...beforeParams.paramValues, offset_lewy_mm: 80 },
        ))).toThrow('test SmartPart feature update failure');

        expect(history.canUndo).toBe(false);
        expect(container.generatorParams).toEqual(beforeParams);
        expect([container.width, container.height, container.depth]).toEqual(beforeDimensions);
        expect(panel.features).toEqual(beforeFeatures);
        setFeatures.mockRestore();
    });

    it('rollbackuje zmianę, gdy przebudowa geometrii po aktualizacji zawiedzie', () => {
        const node = applyCustomSmartPartToPanel(doc, {
            definition: nozkaPkg(),
            targetPanelNode: panelNode,
            pickUvMm: { u: 300, v: 280 },
        })!;
        const container = node.domainData as any;
        const panel = panelNode.domainData as PanelModel;
        const beforeParams = JSON.parse(JSON.stringify(container.generatorParams));
        const beforeFeatures = panel.features.map((feature) => ({ ...feature, params: { ...feature.params } }));
        const history = new CommandHistory(doc);

        expect(() => history.execute(new UpdateCustomSmartPartParamsCommand(
            container,
            { ...beforeParams.paramValues },
            { ...beforeParams.paramValues, offset_lewy_mm: 80 },
            () => { throw new Error('test SmartPart geometry rebuild failure'); },
        ))).toThrow('test SmartPart geometry rebuild failure');

        expect(history.canUndo).toBe(false);
        expect(container.generatorParams).toEqual(beforeParams);
        expect(panel.features).toEqual(beforeFeatures);
    });
});
