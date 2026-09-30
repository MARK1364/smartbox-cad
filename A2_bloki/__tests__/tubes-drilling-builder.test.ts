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
import { buildTubesDrillings } from '../tubes-drilling-builder.js';
import { SyncTubesDrillingsCommand } from '../commands/sync-tubes-drillings-command.js';
import { ClearBlokiDrillingsCommand } from '../commands/clear-blok-drillings-command.js';

describe('Tubes Drilling Builder (buildTubesDrillings)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('generates correct drillings for tube holders on left and right side panels', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        const cabinetNode = doc.findNode(cabinet.id)!;
        cabinetNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

        // Bok lewy: 500x720x18
        const leftPanel = new PanelModel({
            name: 'Bok Lewy',
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18)
        });
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-291), 0, mmToNm(360)), Quat.IDENTITY);
        doc.addNode(cabinet.id, leftNode);

        // Bok prawy: 500x720x18
        const rightPanel = new PanelModel({
            name: 'Bok Prawy',
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18)
        });
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(291), 0, mmToNm(360)), Quat.IDENTITY);
        doc.addNode(cabinet.id, rightNode);

        // Kontener drążka
        const tubesContainer = doc.createAssembly({
            name: 'Drazek_Zestaw',
            width: mmToNm(564),
            height: mmToNm(720),
            depth: mmToNm(500)
        }, cabinet.id) as ContainerModel;
        const tubesNode = doc.findNode(tubesContainer.id)!;
        tubesNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        tubesContainer.generatorParams = {
            type: 'blok_tubes',
            odstep_gora_mm: 60,
            srednica_drazka_mm: 25,
            pokaz_polke: false,
            customReferences: {
                xMin: { panelId: leftNode.id, face: 'FACE_Z_PLUS' },
                xMax: { panelId: rightNode.id, face: 'FACE_Z_PLUS' }
            }
        };

        const intents = buildTubesDrillings(doc, cabinet.id);

        // 2 uchwyty rozety (lewy i prawy), po 2 otwory na rozetę = 4 otwory
        expect(intents.length).toBe(4);

        const leftIntents = intents.filter(i => i.targetNodeId === leftNode.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightNode.id);
        expect(leftIntents.length).toBe(2);
        expect(rightIntents.length).toBe(2);

        for (const intent of intents) {
            expect(intent.feature.params.isTubeDrilling).toBe(true);
            expect(intent.feature.params.sourceContainerId).toBe(tubesNode.id);
            expect(intent.feature.params.diameter).toBe(3.5);
            expect(intent.feature.params.depth).toBe(12);
        }

        // Środek wnęki w głębokości: 500 / 2 = 250 mm
        // Otwory rozety w odległościach: 250 - 16 = 234 mm i 250 + 16 = 266 mm od przodu
        const leftUCoords = leftIntents.map(i => i.feature.params.u).sort((a, b) => a - b);
        expect(leftUCoords[0]).toBeCloseTo(234, 1);
        expect(leftUCoords[1]).toBeCloseTo(266, 1);

        // Wysokość V: dół panelu w Z to 0, góra to 720. Drążek z odstep_gora_mm = 60 ma Z = 720 - 60 = 660
        expect(leftIntents[0].feature.params.v).toBeCloseTo(660, 1);
    });

    it('generates shelf pin holes when pokaz_polke is true', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        const cabinetNode = doc.findNode(cabinet.id)!;
        cabinetNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

        const leftPanel = new PanelModel({
            name: 'Bok Lewy',
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18)
        });
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-291), 0, mmToNm(360)), Quat.IDENTITY);
        doc.addNode(cabinet.id, leftNode);

        const rightPanel = new PanelModel({
            name: 'Bok Prawy',
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18)
        });
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(291), 0, mmToNm(360)), Quat.IDENTITY);
        doc.addNode(cabinet.id, rightNode);

        const tubesContainer = doc.createAssembly({
            name: 'Drazek_Zestaw',
            width: mmToNm(564),
            height: mmToNm(720),
            depth: mmToNm(500)
        }, cabinet.id) as ContainerModel;
        const tubesNode = doc.findNode(tubesContainer.id)!;
        tubesNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        tubesContainer.generatorParams = {
            type: 'blok_tubes',
            odstep_gora_mm: 50,
            pokaz_polke: true,
            przestrzen_nad_polka_mm: 100,
            grubosc_polki_mm: 18,
            customReferences: {
                xMin: { panelId: leftNode.id, face: 'FACE_Z_PLUS' },
                xMax: { panelId: rightNode.id, face: 'FACE_Z_PLUS' }
            }
        };

        const intents = buildTubesDrillings(doc, cabinet.id);

        // 4 otwory rozet (2x lewy, 2x prawy) + 4 otwory podpórek półki (2x lewy, 2x prawy) = 8
        expect(intents.length).toBe(8);

        const shelfPinIntents = intents.filter(i => i.feature.params.template_id === 'STANDARD_SHELF_PIN_5MM');
        expect(shelfPinIntents.length).toBe(4);
        expect(shelfPinIntents[0].feature.params.diameter).toBe(5);
    });

    it('SyncTubesDrillingsCommand synchronizes and ClearBlokiDrillingsCommand cleans up features', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        const cabinetNode = doc.findNode(cabinet.id)!;
        cabinetNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

        const leftPanel = new PanelModel({
            name: 'Bok Lewy',
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18)
        });
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-291), 0, mmToNm(360)), Quat.IDENTITY);
        doc.addNode(cabinet.id, leftNode);

        const tubesContainer = doc.createAssembly({
            name: 'Drazek_Zestaw',
            width: mmToNm(564),
            height: mmToNm(720),
            depth: mmToNm(500)
        }, cabinet.id) as ContainerModel;
        const tubesNode = doc.findNode(tubesContainer.id)!;
        tubesNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        tubesContainer.generatorParams = {
            type: 'blok_tubes',
            customReferences: {
                xMin: { panelId: leftNode.id, face: 'FACE_Z_PLUS' }
            }
        };

        const syncCmd = new SyncTubesDrillingsCommand(cabinet.id);
        syncCmd.execute(doc);

        const lpData = leftNode.domainData as PanelModel;
        expect(lpData.features.length).toBe(2);
        expect(lpData.features[0].params.isTubeDrilling).toBe(true);

        const clearCmd = new ClearBlokiDrillingsCommand(tubesContainer.id);
        clearCmd.execute(doc);

        expect(lpData.features.length).toBe(0);
    });

    it('generates correct drillings when side panel is rotated by 180 degrees in cabinet', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        const cabinetNode = doc.findNode(cabinet.id)!;
        cabinetNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

        // Panel obrócony o 180° w osi Z: Quat.fromEuler(0, 0, Math.PI)
        const leftPanel = new PanelModel({
            name: 'Bok Lewy Obrócony',
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18)
        });
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        const rot180 = Quat.fromEulerXYZ(0, 0, Math.PI);
        leftNode.setLocalTransform(new Vec3(mmToNm(-291), 0, mmToNm(360)), rot180);
        doc.addNode(cabinet.id, leftNode);

        const tubesContainer = doc.createAssembly({
            name: 'Drazek_Zestaw',
            width: mmToNm(564),
            height: mmToNm(720),
            depth: mmToNm(500)
        }, cabinet.id) as ContainerModel;
        const tubesNode = doc.findNode(tubesContainer.id)!;
        tubesNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        tubesContainer.generatorParams = {
            type: 'blok_tubes',
            odstep_gora_mm: 60,
            customReferences: {
                xMin: { panelId: leftNode.id, face: 'FACE_Z_PLUS' }
            }
        };

        const intents = buildTubesDrillings(doc, cabinet.id);
        expect(intents.length).toBe(2);

        // Przy obrocie o 180° wokół Z, oś U jest odwrócona,
        // więc calcFaceUFromFront poprawnie zamienia odległości (500 - dist):
        // 500 - 266 = 234, 500 - 234 = 266
        const uCoords = intents.map(i => i.feature.params.u).sort((a, b) => a - b);
        expect(uCoords[0]).toBeCloseTo(234, 1);
        expect(uCoords[1]).toBeCloseTo(266, 1);
    });
});

