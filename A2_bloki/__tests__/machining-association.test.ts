import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { HardwareModel } from '../../A1_core/hardware-model.js';
import { buildHoleMachiningIntent, buildGrooveMachiningIntent } from '../01_machining-intent.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('Machining Association (drivenBy + rule + generatedBy) Contract', () => {
    it('buildHoleMachiningIntent dołącza drivenBy, rule oraz generatedBy do cechy', () => {
        const intent = buildHoleMachiningIntent({
            targetNodeId: 'panel_left',
            id: 'shelf_1_left_front',
            face: 'FACE_Z_PLUS',
            side: 'FACE_Z_PLUS',
            template_id: 'SINGLE',
            drivenBy: {
                nodeId: 'shelf_1_node',
                role: 'SHELF_PANEL',
                partKey: 'Polka_1',
                containerId: 'container_shelves_1',
            },
            rule: 'shelf_pin',
            generatedBy: 'blok_shelves',
            u: 50,
            v: 120,
            diameter: 5,
            depth: 12,
            ownerTag: 'isShelfDrilling',
            sourceContainerId: 'container_shelves_1',
            sourcePartId: 'Polka_1',
        });

        expect(intent.targetNodeId).toBe('panel_left');
        expect(intent.feature.id).toBe('shelf_1_left_front');
        expect(intent.feature.rule).toBe('shelf_pin');
        expect(intent.feature.generatedBy).toBe('blok_shelves');
        expect(intent.feature.drivenBy).toEqual({
            nodeId: 'shelf_1_node',
            role: 'SHELF_PANEL',
            partKey: 'Polka_1',
            containerId: 'container_shelves_1',
        });
        // Kompatybilny cache parametrów w mm
        expect(intent.feature.params.u).toBe(50);
        expect(intent.feature.params.u_mm).toBe(50);
        expect(intent.feature.params.v).toBe(120);
        expect(intent.feature.params.v_mm).toBe(120);
        expect(intent.feature.params.isShelfDrilling).toBe(true);
    });

    it('PanelModel.toJSON() i fromJSON() transparentnie zachowują drivenBy, rule i generatedBy', () => {
        const panel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(18),
            role: 'LEFT_SIDE_PANEL',
            name: 'Bok Lewy',
        });

        panel.addFeature({
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: {
                u: 100,
                v: 200,
                diameter: 5,
                depth: 12,
            },
        });

        // Wzbogacamy cechę o drivenBy, rule i generatedBy
        (panel.features[0] as any).drivenBy = {
            nodeId: 'hinge_node_1',
            role: 'HARDWARE',
            hardwareType: 'HINGE',
            partKey: 'Hinge_L1',
        };
        (panel.features[0] as any).rule = 'mount_plate';
        (panel.features[0] as any).generatedBy = 'blok_doors';

        const json = panel.toJSON();
        expect(json.features[0].drivenBy).toEqual({
            nodeId: 'hinge_node_1',
            role: 'HARDWARE',
            hardwareType: 'HINGE',
            partKey: 'Hinge_L1',
        });
        expect(json.features[0].rule).toBe('mount_plate');
        expect(json.features[0].generatedBy).toBe('blok_doors');

        // Deserializacja
        const restored = new PanelModel({ width: mmToNm(600), height: mmToNm(800), thickness: mmToNm(18) });
        restored.fromJSON(json);

        expect(restored.features[0].drivenBy).toEqual(json.features[0].drivenBy);
        expect(restored.features[0].rule).toBe('mount_plate');
        expect(restored.features[0].generatedBy).toBe('blok_doors');
    });

    it('ProjectDocument.duplicateCADNode() remapuje referencje drivenBy.nodeId oraz containerId na nowe węzły', () => {
        const doc = new ProjectDocument();

        // Tworzymy strukturę: szafka -> [bok, okucie]
        const cabinet = doc.createAssembly({ name: 'Szafka', width: mmToNm(600) }) as ContainerModel;
        const cabinetNode = doc.findNode(cabinet.id)!;

        const hw = new HardwareModel({ id: 'hw_hinge_1', name: 'Zawias' });
        const hwNode = new CADNode('hw_hinge_1', 'Zawias', NodeType.HARDWARE);
        hwNode.domainData = hw;
        doc.addNode(cabinetNode.id, hwNode);

        const panel = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(18),
            name: 'Bok Lewy',
            role: 'LEFT_SIDE_PANEL',
        }, cabinet.id) as PanelModel;
        const sideNode = doc.findNode(panel.id)!;

        panel.features = [
            {
                id: 'hinge_hole_1',
                type: 'hole',
                face: 'FACE_Z_PLUS',
                drivenBy: {
                    nodeId: 'hw_hinge_1',
                    role: 'HARDWARE',
                    hardwareType: 'HINGE',
                    partKey: 'Hinge_L1',
                    containerId: cabinet.id,
                },
                rule: 'mount_plate',
                generatedBy: 'blok_doors',
                params: {
                    u: 37,
                    v: 120,
                    sourceContainerId: cabinet.id,
                },
            },
        ];

        // Klonujemy całą szafkę
        const clonedCabinet = doc.duplicateCADNode(cabinetNode.id, { x: 1000, y: 0, z: 0 });
        expect(clonedCabinet).not.toBeNull();
        expect(clonedCabinet!.id).not.toBe(cabinet.id);

        // Znajdź sklonowane dzieci
        const clonedHw = clonedCabinet!.children.find(c => c.nodeType === NodeType.HARDWARE);
        const clonedSide = clonedCabinet!.children.find(c => c.nodeType === NodeType.PART);

        expect(clonedHw).toBeDefined();
        expect(clonedSide).toBeDefined();
        expect(clonedHw!.id).not.toBe('hw_hinge_1');
        expect(clonedSide!.id).not.toBe(panel.id);

        // Sprawdź remapowanie drivenBy w cechach sklonowanego boku
        const clonedFeatures = (clonedSide!.domainData as PanelModel).features;
        expect(clonedFeatures).toHaveLength(1);
        expect(clonedFeatures[0].drivenBy.nodeId).toBe(clonedHw!.id);
        expect(clonedFeatures[0].drivenBy.containerId).toBe(clonedCabinet!.id);
        expect(clonedFeatures[0].params.sourceContainerId).toBe(clonedCabinet!.id);
        expect(clonedFeatures[0].rule).toBe('mount_plate');
        expect(clonedFeatures[0].generatedBy).toBe('blok_doors');
    });
});
