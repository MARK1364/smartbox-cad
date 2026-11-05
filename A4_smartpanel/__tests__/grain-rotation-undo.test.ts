import { describe, it, expect, beforeEach } from 'vitest';
import { PanelModel, computePanelFeaturesFingerprint } from '../panel-model.js';
import { computePanelFeaturesFingerprint as computePanelFeaturesFingerprintFromView } from '../panel-view.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { SetGrainDirectionCommand } from '../../A1_core/commands/set-grain-direction-command.js';
import { ContextManager } from '../../A1_core/context-manager.js';

describe('SetGrainDirectionCommand & Undo/Redo', () => {
    let doc: ProjectDocument;
    let history: CommandHistory;

    beforeEach(() => {
        doc = new ProjectDocument();
        history = new CommandHistory(doc);
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = history;
    });

    it('powinien przełączyć kierunek usłojenia pojedynczej formatki i obsłużyć Undo/Redo przez CommandHistory', () => {
        const panel = new PanelModel({
            id: 'panel-1',
            name: 'Bok_L',
            role: 'LEFT_SIDE',
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18),
        });
        const node = new CADNode(panel.id, panel.name, NodeType.PART);
        node.domainData = panel as any;
        doc.addNode(doc.rootNode.id, node);

        const fpBefore = computePanelFeaturesFingerprintFromView(panel);
        expect(computePanelFeaturesFingerprintFromView).toBe(computePanelFeaturesFingerprint);
        expect(panel.rotate_grain).toBe(false);
        expect(panel.custom_properties.rotate_grain).toBeUndefined();

        const events: boolean[] = [];
        panel.onChange((type: string, data: any) => {
            if (type === 'grainChanged') {
                events.push(Boolean(data?.rotate_grain));
            }
        });

        const cmd = new SetGrainDirectionCommand(panel.id, !panel.rotate_grain, undefined, [panel]);
        history.execute(cmd);

        expect(panel.rotate_grain).toBe(true);
        expect(panel.custom_properties.rotate_grain).toBe(true);
        expect(computePanelFeaturesFingerprintFromView(panel)).not.toBe(fpBefore);
        expect(history.canUndo).toBe(true);
        expect(events).toEqual([true]);

        // Undo (Ctrl+Z)
        const undone = history.undo();
        expect(undone).toBe(true);
        expect(panel.rotate_grain).toBe(false);
        expect(panel.custom_properties.rotate_grain).toBe(false);
        expect(computePanelFeaturesFingerprintFromView(panel)).toBe(fpBefore);
        expect(events).toEqual([true, false]);

        // Redo (Ctrl+Y)
        const redone = history.redo();
        expect(redone).toBe(true);
        expect(panel.rotate_grain).toBe(true);
        expect(panel.custom_properties.rotate_grain).toBe(true);
        expect(computePanelFeaturesFingerprintFromView(panel)).not.toBe(fpBefore);
        expect(events).toEqual([true, false, true]);
    });

    it('powinien przywrócić indywidualne poprzednie stany usłojenia dla wielu formatek przy Undo', () => {
        const front1 = new PanelModel({
            id: 'front-1',
            name: 'Front_L',
            role: 'FRONT',
            width: mmToNm(396),
            height: mmToNm(716),
            thickness: mmToNm(18),
        });
        const front2 = new PanelModel({
            id: 'front-2',
            name: 'Front_P',
            role: 'FRONT',
            width: mmToNm(396),
            height: mmToNm(716),
            thickness: mmToNm(18),
        });
        front1.setRotateGrain(false);
        front2.setRotateGrain(true);

        const n1 = new CADNode(front1.id, front1.name, NodeType.PART);
        n1.domainData = front1 as any;
        const n2 = new CADNode(front2.id, front2.name, NodeType.PART);
        n2.domainData = front2 as any;
        doc.addNode(doc.rootNode.id, n1);
        doc.addNode(doc.rootNode.id, n2);

        const cmd = new SetGrainDirectionCommand([front1.id, front2.id], true, 'Obrót frontów', [front1, front2]);
        history.execute(cmd);

        expect(front1.rotate_grain).toBe(true);
        expect(front2.rotate_grain).toBe(true);

        history.undo();
        expect(front1.rotate_grain).toBe(false);
        expect(front2.rotate_grain).toBe(true);

        history.redo();
        expect(front1.rotate_grain).toBe(true);
        expect(front2.rotate_grain).toBe(true);
    });

    it('nie generuje duplikatu ID (np. panel_27) przy dodawaniu nowej formatki po wczytaniu projektu z wyższymi ID', () => {
        const existingPanel = new PanelModel({
            id: 'panel_27',
            name: 'Istniejąca Płyta',
            role: 'MANUAL_PANEL',
            width: mmToNm(720),
            height: mmToNm(510),
            thickness: mmToNm(18),
            engineManaged: false,
        });
        const existingNode = new CADNode(existingPanel.id, existingPanel.name, NodeType.PART);
        existingNode.domainData = existingPanel as any;
        doc.addNode(doc.rootNode.id, existingNode);

        const droppedPanel = new PanelModel({
            name: 'Nowa Płyta z Drop',
            role: 'MANUAL_PANEL',
            width: mmToNm(720),
            height: mmToNm(510),
            thickness: mmToNm(18),
            engineManaged: false,
        });

        expect(droppedPanel.id).not.toBe('panel_27');
        expect(doc.findNode(droppedPanel.id)).toBeNull();

        const droppedNode = new CADNode(droppedPanel.id, droppedPanel.name, NodeType.PART);
        droppedNode.domainData = droppedPanel as any;
        expect(() => doc.addNode(doc.rootNode.id, droppedNode)).not.toThrow();
    });
});
