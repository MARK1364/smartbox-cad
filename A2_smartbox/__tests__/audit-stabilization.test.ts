import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { InsertSmartBoxCommand } from '../smartbox-bay-actions.js';
import { buildBackGrooves, type PanelState } from '../../A3_smartframe/back-groove-builder.js';

describe('SmartBox & SmartFrame Audit Stabilization', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('InsertSmartBoxCommand.undo cleanly removes drilling features from adjacent panels', () => {
        // 1. Tworzymy korpus z dwoma bokami
        const cabinet = doc.createContainer({ name: 'Korpus' });
        cabinet.width = mmToNm(800);
        cabinet.height = mmToNm(2000);
        cabinet.depth = mmToNm(600);
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        const cabinetNode = doc.findNode(cabinet.id)!;

        const leftPanel = new PanelModel({ width: mmToNm(600), height: mmToNm(2000), thickness: mmToNm(18) });
        leftPanel.role = 'LEFT_SIDE_PANEL';
        leftPanel.name = 'Bok_L';
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));
        doc.addNode(cabinet.id, leftNode);

        const rightPanel = new PanelModel({ width: mmToNm(600), height: mmToNm(2000), thickness: mmToNm(18) });
        rightPanel.role = 'RIGHT_SIDE_PANEL';
        rightPanel.name = 'Bok_P';
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, Math.PI / 2));
        doc.addNode(cabinet.id, rightNode);

        // 2. Wstawiamy SmartBox Drzwi (Doors)
        const sbContainer = new ContainerModel({ width: mmToNm(764), height: mmToNm(2000), depth: mmToNm(600), name: 'smartbox_drzwi' });
        sbContainer.generatorParams = {
            type: 'smartbox_doors',
            boxType: 'DOORS',
            parentContainerId: cabinet.id,
            customReferences: {
                xMin: { panelId: leftNode.id, face: 'FACE_Z_PLUS' },
                xMax: { panelId: rightNode.id, face: 'FACE_Z_MINUS' }
            },
            doorType: 'SINGLE_LEFT'
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;

        const cmd = new InsertSmartBoxCommand(cabinet.id, sbNode, 'Wstaw Drzwi');
        cmd.execute(doc);

        // Upewniamy się, że nawiercenia pod zawiasy zostały dodane do lewego boku
        expect(leftPanel.features.length).toBeGreaterThan(0);
        expect(leftPanel.features.some(f => f.params?.isDoorDrilling || f.params?.sourceContainerId === sbNode.id)).toBe(true);

        // 3. Wykonujemy UNDO
        cmd.undo(doc);

        // Węzeł SmartBox powinien zniknąć, a nawiercenia na lewym boku zostać wyczyszczone
        expect(doc.findNode(sbNode.id)).toBeNull();
        const remainingDoorHoles = leftPanel.features.filter(f => f.params?.isDoorDrilling || f.params?.sourceContainerId === sbNode.id);
        expect(remainingDoorHoles.length).toBe(0);
    });

    it('buildBackGrooves generates back grooves for PARTITION and MANUAL_PANEL roles', () => {
        const panels: PanelState[] = [
            {
                id: 'B_PLECY',
                role: 'BACK_PANEL',
                dim_nm: { x: mmToNm(1000), y: mmToNm(2000), z: mmToNm(3) },
                localMatrix: Mat4.fromTRS(new Vec3(0, mmToNm(280), mmToNm(1000)), Quat.IDENTITY),
                zonePrefix: ''
            },
            {
                id: 'B_PRZEGRODA',
                role: 'PARTITION',
                dim_nm: { x: mmToNm(600), y: mmToNm(2000), z: mmToNm(18) },
                localMatrix: Mat4.fromTRS(new Vec3(0, 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2)),
                zonePrefix: ''
            }
        ];

        const grooves = buildBackGrooves(panels);
        expect(grooves.length).toBeGreaterThan(0);
        expect(grooves[0].targetNodeId).toBe('B_PRZEGRODA');
    });
});
