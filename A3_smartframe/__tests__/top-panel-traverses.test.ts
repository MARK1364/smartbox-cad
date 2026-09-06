import { describe, it, expect } from 'vitest';
import { Korpus3Engine } from '../smartframe-engine';
import { SetKorpusTopPanelConfigCommand } from '../commands/set-korpus-top-panel-config-command';
import { ProjectDocument } from '../../A1_core/project-document';
import { ContainerModel } from '../../A1_core/container-model';
import { CADNode } from '../../A1_core/cad-node/cad-node';
import { NodeType } from '../../A1_core/cad-node/node-type';
import { mmToNm } from '../../A1_core/cad-math/units';
import { ContextManager } from '../../A1_core/context-manager';
import { runEngineAndApply } from '../smartframe-adapter';

describe('SmartFrame Top Panel & Traverses Engine', () => {
    it('generates FULL top panel by default', () => {
        const engine = new Korpus3Engine();
        const plan = engine.plan({
            width: 1000,
            height: 2000,
            depth: 600,
            zoneCount: 1,
            topPanelMode: 'FULL'
        });

        const topParts = plan.parts.filter(p => p.role === 'TOP_PANEL');
        expect(topParts).toHaveLength(1);

        const top = topParts[0];
        expect(top.key).toContain('WIENIEC_G');
        expect(top.key).not.toContain('_T2');
        expect(top.dim.y).toBe(600); // Pełna głębokość
        expect(top.dim.z).toBe(18);  // Grubość 18 mm
        expect(top.loc.y).toBe(0);   // Wycentrowany w Y
    });

    it('generates two horizontal traverses (TRAVERSE_H) with custom width', () => {
        const engine = new Korpus3Engine();
        const plan = engine.plan({
            width: 1000,
            height: 2000,
            depth: 600,
            zoneCount: 1,
            topPanelMode: 'TRAVERSE_H',
            traverseWidth: 80
        });

        const topParts = plan.parts.filter(p => p.role === 'TOP_PANEL');
        expect(topParts).toHaveLength(2);

        const front = topParts.find(p => !p.key.endsWith('_T2'))!;
        const rear  = topParts.find(p => p.key.endsWith('_T2'))!;

        expect(front).toBeDefined();
        expect(rear).toBeDefined();

        // Wymiary poziome (leżące płasko)
        expect(front.dim.y).toBe(80);
        expect(front.dim.z).toBe(18);
        expect(rear.dim.y).toBe(80);
        expect(rear.dim.z).toBe(18);

        // Pozycje w głębokości (Y): front = -D/2 + W/2 = -260, rear = D/2 - W/2 = +260
        expect(front.loc.y).toBeCloseTo(-260);
        expect(rear.loc.y).toBeCloseTo(260);

        // Pozycje w wysokości (Z): H - 18/2 = 2000 - 9 = 1991
        expect(front.loc.z).toBeCloseTo(1991);
        expect(rear.loc.z).toBeCloseTo(1991);
    });

    it('generates two vertical traverses (TRAVERSE_V) standing on edge', () => {
        const engine = new Korpus3Engine();
        const plan = engine.plan({
            width: 1000,
            height: 2000,
            depth: 600,
            zoneCount: 1,
            topPanelMode: 'TRAVERSE_V',
            traverseWidth: 100
        });

        const topParts = plan.parts.filter(p => p.role === 'TOP_PANEL');
        expect(topParts).toHaveLength(2);

        const front = topParts.find(p => !p.key.endsWith('_T2'))!;
        const rear  = topParts.find(p => p.key.endsWith('_T2'))!;

        expect(front).toBeDefined();
        expect(rear).toBeDefined();

        // Wymiary pionowe (stojące na sztorc): Y = grubość 18 mm, Z = wysokość trawersu 100 mm
        expect(front.dim.y).toBe(18);
        expect(front.dim.z).toBe(100);
        expect(rear.dim.y).toBe(18);
        expect(rear.dim.z).toBe(100);

        // Pozycje w Y: front = -D/2 + T/2 = -300 + 9 = -291, rear = D/2 - T/2 = 300 - 9 = 291
        expect(front.loc.y).toBeCloseTo(-291);
        expect(rear.loc.y).toBeCloseTo(291);

        // Pozycje w Z: H - 100/2 = 2000 - 50 = 1950
        expect(front.loc.z).toBeCloseTo(1950);
        expect(rear.loc.z).toBeCloseTo(1950);
    });

    it('SetKorpusTopPanelConfigCommand supports execute and undo', () => {
        const doc = new ProjectDocument();
        const container = new ContainerModel({
            name: 'Korpus_Test',
            width: mmToNm(1000),
            height: mmToNm(2000),
            depth: mmToNm(600)
        });
        container.generatorParams = {
            type: 'korpus3_2',
            topPanelMode: 'FULL',
            traverseWidth: 80
        };

        const cntNode = CADNode.create(NodeType.ASSEMBLY, container.name, container.id);
        cntNode.domainData = container;
        doc.addNode(doc.rootNode.id, cntNode);

        const cmd = new SetKorpusTopPanelConfigCommand(
            container.id,
            { mode: 'FULL', width: 80 },
            { mode: 'TRAVERSE_H', width: 100 }
        );

        cmd.execute(doc);
        expect(container.generatorParams.topPanelMode).toBe('TRAVERSE_H');
        expect(container.generatorParams.traverseWidth).toBe(100);

        cmd.undo(doc);
        expect(container.generatorParams.topPanelMode).toBe('FULL');
        expect(container.generatorParams.traverseWidth).toBe(80);
    });

    it('integrates with runEngineAndApply and cuts back groove on rear traverse only', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        const cabinet = doc.createContainer({ name: 'Szafka Trawersy' });
        cabinet.generatorParams = {
            type: 'korpus3_2',
            zoneCount: 1,
            topPanelMode: 'TRAVERSE_H',
            traverseWidth: 80
        };

        runEngineAndApply(
            cabinet,
            mmToNm(1000),
            mmToNm(800),
            mmToNm(600),
            1,
            mmToNm(800),
            0
        );

        const cntNode = doc.findNode(cabinet.id)!;
        expect(cntNode).toBeDefined();

        const topPanels = cntNode.children
            .map(c => c.domainData as any)
            .filter(p => p && p.role === 'TOP_PANEL');

        expect(topPanels).toHaveLength(2);

        const frontTraverse = topPanels.find(p => !p.key.endsWith('_T2'))!;
        const rearTraverse  = topPanels.find(p => p.key.endsWith('_T2'))!;

        expect(frontTraverse).toBeDefined();
        expect(rearTraverse).toBeDefined();

        // Tylny trawers przecina się z plecami, więc posiada wpust pod plecy
        const rearGrooves = (rearTraverse.features || []).filter((f: any) => f.type === 'groove' || f.name?.includes('wpust'));
        expect(rearGrooves.length).toBeGreaterThan(0);

        // Przedni trawers leży z przodu, więc NIE posiada wpustu pod plecy
        const frontGrooves = (frontTraverse.features || []).filter((f: any) => f.type === 'groove' || f.name?.includes('wpust'));
        expect(frontGrooves).toHaveLength(0);
    });

    it('reproduces 3-zone cabinet transition from FULL to TRAVERSE_H via Command', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        const cabinet = doc.createContainer({ name: 'Korpus (SmartFrame)' });
        cabinet.width = mmToNm(1000);
        cabinet.height = mmToNm(2200);
        cabinet.depth = mmToNm(600);
        cabinet.generatorParams = {
            type: 'korpus3_2',
            zoneCount: 3,
            thickness: 18,
            backOffset: 3,
            bottomHeight: 500,
            middleHeight: 1200
        };

        const cntNode = doc.findNode(cabinet.id)!;

        // 1. Initial build (FULL)
        runEngineAndApply(
            cabinet,
            1000, 2200, 600,
            3, 500, 1200,
            3, {}
        );

        // 2. Switch to TRAVERSE_H via Command
        const cmd = new SetKorpusTopPanelConfigCommand(
            cabinet.id,
            { mode: 'FULL', width: 80 },
            { mode: 'TRAVERSE_H', width: 80 }
        );
        cmd.execute(doc);

        const hasRearTraverseH = cntNode.children.some(c => (c.domainData as any)?.key === 'T_WIENIEC_G_T2');
        expect(hasRearTraverseH).toBe(true);

        const rearH = cntNode.children.find(c => (c.domainData as any)?.key === 'T_WIENIEC_G_T2')?.domainData as any;
        expect(rearH.role).toBe('TOP_PANEL');
        expect(rearH.name).toBe('Gora_Wieniec_G_T2');

        // 3. Undo returns to FULL (rear traverse removed)
        cmd.undo(doc);
        const hasRearAfterUndo = cntNode.children.some(c => (c.domainData as any)?.key === 'T_WIENIEC_G_T2');
        expect(hasRearAfterUndo).toBe(false);

        // 4. Switch to TRAVERSE_V
        const cmdV = new SetKorpusTopPanelConfigCommand(
            cabinet.id,
            { mode: 'FULL', width: 80 },
            { mode: 'TRAVERSE_V', width: 100 }
        );
        cmdV.execute(doc);
        const hasRearTraverseV = cntNode.children.some(c => (c.domainData as any)?.key === 'T_WIENIEC_G_T2');
        expect(hasRearTraverseV).toBe(true);

        const rearV = cntNode.children.find(c => (c.domainData as any)?.key === 'T_WIENIEC_G_T2')?.domainData as any;
        expect(rearV.role).toBe('TOP_PANEL');
        expect(rearV.name).toBe('Gora_Wieniec_G_T2');
    });
});
