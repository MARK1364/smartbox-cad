import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { buildFlapsDrillings } from '../12_flaps-drilling-builder.js';

describe('Flaps Drilling Builder (buildFlapsDrillings)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('generates correct drillings on bottom wieniec (FACE_Z_PLUS) for bottom flap', () => {
        // Korpus mebla: szerokość 800, wysokość 720, głębokość 500
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        const cabinetNode = doc.findNode(cabinet.id)!;
        cabinetNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

        // Wieniec dolny: 764 x 500 x 18 mm, leży na dole
        const bottomPanel = new PanelModel({
            name: 'Wieniec Dolny',
            width: mmToNm(764),
            height: mmToNm(500),
            thickness: mmToNm(18)
        });
        const bottomNode = CADNode.create(NodeType.PART, bottomPanel.name, bottomPanel.id);
        bottomNode.domainData = bottomPanel;
        bottomNode.setLocalTransform(new Vec3(0, 0, mmToNm(9)), Quat.IDENTITY);
        doc.addNode(cabinet.id, bottomNode);

        // Kontener klapy dolnej
        const flapContainer = doc.createAssembly({
            name: 'Klapa_Dolna',
            width: mmToNm(764),
            height: mmToNm(360),
            depth: mmToNm(500)
        }, cabinet.id) as ContainerModel;
        const flapNode = doc.findNode(flapContainer.id)!;
        flapNode.setLocalTransform(new Vec3(0, 0, mmToNm(180)), Quat.IDENTITY);
        flapContainer.generatorParams = {
            type: 'blok_flaps',
            kierunek_klapy: 'BOTTOM',
            odsuniecie_zawiasu_lewe_mm: 80,
            odsuniecie_zawiasu_prawe_mm: 80,
            boundary: {
                bottom: { nodeId: bottomNode.id, face: 'FACE_Z_PLUS' }
            }
        };

        const intents = buildFlapsDrillings(doc, cabinet.id);
        // 2 zawiasy (lewy, prawy) * 2 otwory prowadnika = 4 intenty
        expect(intents).toHaveLength(4);

        for (const intent of intents) {
            expect(intent.targetNodeId).toBe(bottomNode.id);
            expect(intent.feature.face).toBe('FACE_Z_PLUS');
            expect(intent.feature.params.isFlapDrilling).toBe(true);
            // Otwór prowadnika leży 37 mm od frontu
            expect(intent.feature.params.v).toBeCloseTo(37, 1);
        }

        const leftIntents = intents.filter(i => i.feature.params.sourcePartId === 'HINGE_BL');
        const rightIntents = intents.filter(i => i.feature.params.sourcePartId === 'HINGE_BR');

        expect(leftIntents).toHaveLength(2);
        expect(rightIntents).toHaveLength(2);
        expect(leftIntents[0].feature.drivenBy.nodeId).toBe(`${flapNode.id}_hinge_hinge_bl`);
        expect(rightIntents[0].feature.drivenBy.nodeId).toBe(`${flapNode.id}_hinge_hinge_br`);

        // Środek zawiasu lewego to 80 mm, otwory leżą w 80 - 16 = 64 oraz 80 + 16 = 96 mm
        const leftUs = leftIntents.map(i => i.feature.params.u).sort((a, b) => a - b);
        expect(leftUs[0]).toBeCloseTo(64, 1);
        expect(leftUs[1]).toBeCloseTo(96, 1);

        // Środek zawiasu prawego to 684 mm, otwory leżą w 684 - 16 = 668 oraz 684 + 16 = 700 mm
        const rightUs = rightIntents.map(i => i.feature.params.u).sort((a, b) => a - b);
        expect(rightUs[0]).toBeCloseTo(668, 1);
        expect(rightUs[1]).toBeCloseTo(700, 1);
    });

    it('generates correct drillings on top wieniec (FACE_Z_MINUS) for top flap with proper orientation', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        const cabinetNode = doc.findNode(cabinet.id)!;
        cabinetNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

        // Wieniec górny: 764 x 500 x 18 mm, leży na górze (Z = 711)
        const topPanel = new PanelModel({
            name: 'Wieniec Gorny',
            width: mmToNm(764),
            height: mmToNm(500),
            thickness: mmToNm(18)
        });
        const topNode = CADNode.create(NodeType.PART, topPanel.name, topPanel.id);
        topNode.domainData = topPanel;
        topNode.setLocalTransform(new Vec3(0, 0, mmToNm(711)), Quat.IDENTITY);
        doc.addNode(cabinet.id, topNode);

        // Kontener klapy górnej
        const flapContainer = doc.createAssembly({
            name: 'Klapa_Gorna',
            width: mmToNm(764),
            height: mmToNm(360),
            depth: mmToNm(500)
        }, cabinet.id) as ContainerModel;
        const flapNode = doc.findNode(flapContainer.id)!;
        flapNode.setLocalTransform(new Vec3(0, 0, mmToNm(540)), Quat.IDENTITY);
        flapContainer.generatorParams = {
            type: 'blok_flaps',
            kierunek_klapy: 'TOP',
            odsuniecie_zawiasu_lewe_mm: 80,
            odsuniecie_zawiasu_prawe_mm: 80,
            boundary: {
                top: { nodeId: topNode.id, face: 'FACE_Z_MINUS' }
            }
        };

        const intents = buildFlapsDrillings(doc, cabinet.id);
        expect(intents).toHaveLength(4);

        for (const intent of intents) {
            expect(intent.targetNodeId).toBe(topNode.id);
            expect(intent.feature.face).toBe('FACE_Z_MINUS');
            // Otwór prowadnika leży 37 mm od frontu
            expect(intent.feature.params.v).toBeCloseTo(37, 1);
        }

        const leftIntents = intents.filter(i => i.feature.params.sourcePartId === 'HINGE_TL');
        const rightIntents = intents.filter(i => i.feature.params.sourcePartId === 'HINGE_TR');

        expect(leftIntents).toHaveLength(2);
        expect(rightIntents).toHaveLength(2);

        // Na FACE_Z_MINUS oś U biegnie od prawej do lewej:
        // Lewy zawias w świecie (X = -302 mm) odpowiada środkowi U = 684 mm (otwory: 668 i 700 mm)
        // Prawy zawias w świecie (X = +302 mm) odpowiada środkowi U = 80 mm (otwory: 64 i 96 mm)
        const leftTopUs = leftIntents.map(i => i.feature.params.u).sort((a, b) => a - b);
        expect(leftTopUs[0]).toBeCloseTo(668, 1);
        expect(leftTopUs[1]).toBeCloseTo(700, 1);

        const rightTopUs = rightIntents.map(i => i.feature.params.u).sort((a, b) => a - b);
        expect(rightTopUs[0]).toBeCloseTo(64, 1);
        expect(rightTopUs[1]).toBeCloseTo(96, 1);
    });

    it('generates correct drillings when bottom wieniec is rotated by 180 degrees in cabinet', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        const cabinetNode = doc.findNode(cabinet.id)!;
        cabinetNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

        // Wieniec dolny obrócony o 180 deg wokół Z
        const bottomPanel = new PanelModel({
            name: 'Wieniec Dolny 180',
            width: mmToNm(764),
            height: mmToNm(500),
            thickness: mmToNm(18)
        });
        const bottomNode = CADNode.create(NodeType.PART, bottomPanel.name, bottomPanel.id);
        bottomNode.domainData = bottomPanel;
        bottomNode.setLocalTransform(new Vec3(0, 0, mmToNm(9)), Quat.fromEulerXYZ(0, 0, Math.PI));
        doc.addNode(cabinet.id, bottomNode);

        const flapContainer = doc.createAssembly({
            name: 'Klapa_Dolna',
            width: mmToNm(764),
            height: mmToNm(360),
            depth: mmToNm(500)
        }, cabinet.id) as ContainerModel;
        const flapNode = doc.findNode(flapContainer.id)!;
        flapNode.setLocalTransform(new Vec3(0, 0, mmToNm(180)), Quat.IDENTITY);
        flapContainer.generatorParams = {
            type: 'blok_flaps',
            kierunek_klapy: 'BOTTOM',
            odsuniecie_zawiasu_lewe_mm: 80,
            odsuniecie_zawiasu_prawe_mm: 80,
            boundary: {
                bottom: { nodeId: bottomNode.id, face: 'FACE_Z_PLUS' }
            }
        };

        const intents = buildFlapsDrillings(doc, cabinet.id);
        expect(intents).toHaveLength(4);

        for (const intent of intents) {
            expect(intent.targetNodeId).toBe(bottomNode.id);
            expect(intent.feature.face).toBe('FACE_Z_PLUS');
            // Przy obrocie o 180 deg, fizyczny front mebla odpowiada lokalnej krawędzi V = 500 - 37 = 463 mm!
            expect(intent.feature.params.v).toBeCloseTo(463, 1);
        }
    });
});
