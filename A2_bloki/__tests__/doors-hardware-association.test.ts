import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { HardwareModel } from '../../A1_core/hardware-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { applyPlanToContainer } from '../../A3_smartframe/smartframe-adapter.js';
import { buildDoorsPlan } from '../01_module-plans.js';
import { buildDoorsDrillings } from '../05_doors-drilling-builder.js';

import { update_bloki_core } from '../01_bloki-core.js';
import { Quat } from '../../A1_core/cad-math/quat.js';

describe('Doors Hardware Association Flow (End-to-End)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Doors Flow Test' });
        ContextManager.instance.document = doc;
    });

    it('wiązanie zawiasu drzwi: węzeł HARDWARE, otwory puszki we froncie i otwory prowadnika w boku wskazują dokładnie na to samo okucie', () => {
        // 1. Główny korpus szafki
        const cabinet = doc.createAssembly({ name: 'Korpus szafki' });
        const cabinetNode = doc.findNode(cabinet.id)!;

        // Bok lewy (X = -200)
        const leftPanel = new PanelModel({
            name: 'Bok Lewy',
            role: 'LEFT_SIDE_PANEL',
            width: mmToNm(600),
            height: mmToNm(2000),
            thickness: mmToNm(18)
        });
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-191), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));
        doc.addNode(cabinetNode.id, leftNode);

        // Prawy bok (X = +200)
        const rightPanel = new PanelModel({
            name: 'Bok Prawy',
            role: 'RIGHT_SIDE_PANEL',
            width: mmToNm(600),
            height: mmToNm(2000),
            thickness: mmToNm(18)
        });
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(191), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, Math.PI / 2));
        doc.addNode(cabinetNode.id, rightNode);

        // 2. Kontener modułu drzwi
        const sbContainer = new ContainerModel({
            name: 'blok_doors_strefa',
            width: mmToNm(382),
            height: mmToNm(2000),
            depth: mmToNm(600)
        });
        sbContainer.generatorParams = {
            type: 'blok_doors',
            boxType: 'DOORS',
            rodzaj_drzwi: 'LEFT',
            uzyj_zawias_1: true,
            uzyj_zawias_6: true,
            width_mm: 382,
            height_mm: 2000,
            depth_mm: 600,
            customReferences: {
                xMin: { partKey: 'Bok Lewy', face: 'FACE_Z_MINUS', panelId: leftPanel.id },
                xMax: { partKey: 'Bok Prawy', face: 'FACE_Z_PLUS', panelId: rightPanel.id }
            },
            disabledReferences: { yMin: true, yMax: true, zMin: true, zMax: true }
        };

        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        sbNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        doc.addNode(cabinetNode.id, sbNode);

        // Generujemy plan i synchronizujemy mebel
        update_bloki_core(sbContainer, doc);

        // 3. Uruchamiamy builder nawierceń korpusu pod zawiasy
        const drillingIntents = buildDoorsDrillings(doc, cabinet.id);
        expect(drillingIntents.length).toBeGreaterThan(0);

        // Przypisujemy wygenerowane cechy do boku lewego
        const sideHoles = drillingIntents
            .filter(intent => intent.targetNodeId === leftPanel.id)
            .map(intent => intent.feature);
        leftPanel.setFeatures(sideHoles);

        // 4. Weryfikacja: Węzły okucia w drzewie CADNode
        const hwNodes = sbNode.children.filter(c => c.nodeType === NodeType.HARDWARE);
        expect(hwNodes.length).toBeGreaterThanOrEqual(2);

        const bottomHinge = hwNodes.find(h => h.id.endsWith('_hinge_left_1'));
        expect(bottomHinge).toBeDefined();
        const expectedHingeId = `${sbContainer.id}_hinge_left_1`;
        expect(bottomHinge!.id).toBe(expectedHingeId);

        // 5. Weryfikacja: Front drzwi i powiązania puszki (cup) i wkrętów (screw)
        const frontNode = sbNode.children.find(c => c.nodeType === NodeType.PART);
        expect(frontNode).toBeDefined();
        const frontModel = frontNode!.domainData as PanelModel;
        expect(frontModel.features.length).toBeGreaterThan(0);

        const cupFeature = frontModel.features.find((f: any) => f.rule === 'cup' && f.drivenBy?.partKey === 'Hinge_L1');
        expect(cupFeature).toBeDefined();
        // drivenBy.nodeId na froncie wskazuje DOKŁADNIE na ten węzeł HARDWARE!
        expect(cupFeature.drivenBy.nodeId).toBe(expectedHingeId);
        expect(cupFeature.drivenBy.role).toBe('HARDWARE');
        expect(cupFeature.drivenBy.containerId).toBe(sbContainer.id);
        expect(cupFeature.generatedBy).toBe('blok_doors');

        // 6. Weryfikacja: Bok korpusu i powiązania prowadnika (mount_plate)
        const plateFeature = leftPanel.features.find((f: any) => f.rule === 'mount_plate' && f.drivenBy?.partKey === 'Hinge_L1');
        expect(plateFeature).toBeDefined();
        // drivenBy.nodeId w boku korpusu wskazuje DOKŁADNIE na ten sam węzeł HARDWARE!
        expect(plateFeature.drivenBy.nodeId).toBe(expectedHingeId);
        expect(plateFeature.drivenBy.role).toBe('HARDWARE');
        expect(plateFeature.drivenBy.containerId).toBe(sbContainer.id);
        expect(plateFeature.generatedBy).toBe('blok_doors');

        // Spójność drzewa: ID istnieje w dokumencie
        expect(doc.findNode(cupFeature.drivenBy.nodeId)).toBe(bottomHinge);
        expect(doc.findNode(plateFeature.drivenBy.nodeId)).toBe(bottomHinge);

        // 7. Weryfikacja: Klonowanie szafki i remapowanie referencji
        const clonedCabinet = doc.duplicateCADNode(cabinet.id, { x: 1000, y: 0, z: 0 });
        expect(clonedCabinet).not.toBeNull();

        const clonedDoorsNode = clonedCabinet!.children.find(c => c.domainData?.generatorParams?.type === 'blok_doors');
        expect(clonedDoorsNode).toBeDefined();

        const clonedSideNode = clonedCabinet!.children.find(c => (c.domainData as PanelModel)?.role === 'LEFT_SIDE_PANEL');
        expect(clonedSideNode).toBeDefined();
        const clonedSideFeatures = (clonedSideNode!.domainData as PanelModel).features;
        const clonedPlate = clonedSideFeatures.find((f: any) => f.rule === 'mount_plate' && f.drivenBy?.partKey === 'Hinge_L1');
        expect(clonedPlate).toBeDefined();

        const clonedFrontNode = clonedDoorsNode!.children.find(c => c.nodeType === NodeType.PART);
        expect(clonedFrontNode).toBeDefined();
        const clonedFrontFeatures = (clonedFrontNode!.domainData as PanelModel).features;
        const clonedCup = clonedFrontFeatures.find((f: any) => f.rule === 'cup' && f.drivenBy?.partKey === 'Hinge_L1');
        expect(clonedCup).toBeDefined();

        // Znajdujemy sklonowany węzeł zawiasu
        const clonedHinge = doc.findNode(clonedPlate.drivenBy.nodeId);
        expect(clonedHinge).toBeDefined();
        expect(clonedHinge!.nodeType).toBe(NodeType.HARDWARE);
        expect(clonedHinge!.id).not.toBe(expectedHingeId);
        expect(clonedDoorsNode!.children).toContain(clonedHinge);

        // OBA sklonowane elementy (bok i front) wskazują na TEN SAM NOWY węzeł sklonowanego zawiasu!
        expect(clonedPlate.drivenBy.nodeId).toBe(clonedHinge!.id);
        expect(clonedCup.drivenBy.nodeId).toBe(clonedHinge!.id);
        expect(clonedPlate.drivenBy.nodeId).not.toBe(expectedHingeId);
        expect(clonedPlate.generatedBy).toBe('blok_doors');
        expect(clonedCup.generatedBy).toBe('blok_doors');
    });
});

