import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { buildDoorsDrillings } from '../doors-drilling-builder.js';
import { update_smartbox_core } from '../smartbox-core.js';
import { ContainerModel } from '../../A1_core/container-model.js';

describe('Doors Drilling Builder (buildDoorsDrillings)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('generates hinge plate drillings directly on PARTITION panel when customReferences are set', () => {
        const cabinet = doc.createContainer({ name: 'Korpus z przegroda' });
        const cabinetNode = doc.findNode(cabinet.id)!;

        // 1. Lewy bok (X = -400)
        const leftPanel = new PanelModel({
            name: 'Bok Lewy',
            role: 'LEFT_SIDE_PANEL',
            width: mmToNm(600),
            height: mmToNm(2000),
            thickness: mmToNm(18)
        });
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));
        doc.addNode(cabinetNode.id, leftNode);

        // 2. Przegroda pionowa w środku (X = 0)
        const partitionPanel = new PanelModel({
            name: 'Przegroda Srodkowa',
            role: 'PARTITION',
            width: mmToNm(600),
            height: mmToNm(2000),
            thickness: mmToNm(18)
        });
        const partitionNode = CADNode.create(NodeType.PART, partitionPanel.name, partitionPanel.id);
        partitionNode.domainData = partitionPanel;
        partitionNode.setLocalTransform(new Vec3(0, 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));
        doc.addNode(cabinetNode.id, partitionNode);

        // 3. Prawy bok (X = +400)
        const rightPanel = new PanelModel({
            name: 'Bok Prawy',
            role: 'RIGHT_SIDE_PANEL',
            width: mmToNm(600),
            height: mmToNm(2000),
            thickness: mmToNm(18)
        });
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, Math.PI / 2));
        doc.addNode(cabinetNode.id, rightNode);

        // 4. Wstawiamy SmartBox z drzwiami lewostronnymi w PRAWEJ wnęce (między przegrodą a prawym bokiem)
        // Lewą ścianą tej wnęki jest PRZEGRODA (prawa strona przegrody to FACE_Z_MINUS)
        const sbContainer = new ContainerModel({
            name: 'smartbox_doors_prawa_strefa',
            width: mmToNm(382),
            height: mmToNm(2000),
            depth: mmToNm(600)
        });
        sbContainer.generatorParams = {
            type: 'smartbox_doors',
            boxType: 'DOORS',
            doorType: 'LEFT',
            door_type: 'LEFT',
            use_hinge_1: true,
            use_hinge_6: true,
            customReferences: {
                xMin: { partKey: 'Przegroda Srodkowa', face: 'FACE_Z_MINUS', panelId: partitionPanel.id },
                xMax: { partKey: 'Bok Prawy', face: 'FACE_Z_PLUS', panelId: rightPanel.id }
            }
        };

        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        sbNode.setLocalTransform(new Vec3(mmToNm(195.5), 0, 0), Quat.IDENTITY);
        doc.addNode(cabinetNode.id, sbNode);

        // Generujemy plan i synchronizujemy
        update_smartbox_core(sbContainer, doc);

        // 5. Sprawdzamy czy nawiercenia zawiasów trafiły na PRZEGRODĘ!
        const intents = buildDoorsDrillings(doc, cabinet.id);
        expect(intents.length).toBeGreaterThan(0);

        const partitionIntents = intents.filter(i => i.targetNodeId === partitionPanel.id);
        expect(partitionIntents.length).toBeGreaterThan(0);

        // Prowadnik powinien być nawiercony na wskazanej ścianie FACE_Z_MINUS
        for (const intent of partitionIntents) {
            expect(intent.feature.face).toBe('FACE_Z_MINUS');
            expect(intent.feature.params.isDoorDrilling).toBe(true);
            expect(intent.feature.params.u).toBeGreaterThan(0);
            expect(intent.feature.params.v).toBeGreaterThan(0);
        }

        // Prawy bok nie powinien dostać zawiasów (drzwi są lewe)
        const rightIntents = intents.filter(i => i.targetNodeId === rightPanel.id);
        expect(rightIntents).toHaveLength(0);
    });
});
