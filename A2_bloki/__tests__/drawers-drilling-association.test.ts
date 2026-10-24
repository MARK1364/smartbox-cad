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
import { buildDrawersDrillings } from '../09_drawers-drilling-builder.js';

describe('Drawers Drilling Association', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('drivenBy.nodeId wskazuje na rzeczywiste węzły prowadnic L/P', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        const cabinetNode = doc.findNode(cabinet.id)!;

        const addSide = (name: string, xNm: number) => {
            const panel = new PanelModel({
                name,
                width: mmToNm(500),
                height: mmToNm(720),
                thickness: mmToNm(18),
            });
            const node = CADNode.create(NodeType.PART, panel.name, panel.id);
            node.domainData = panel;
            node.setLocalTransform(new Vec3(xNm, 0, 0), Quat.IDENTITY);
            doc.addNode(cabinet.id, node);
            return node;
        };

        const leftNode = addSide('Bok Lewy', mmToNm(-291));
        const rightNode = addSide('Bok Prawy', mmToNm(291));

        const sbContainer = doc.createAssembly({
            name: 'Szuflady',
            width: mmToNm(564),
            height: mmToNm(720),
            depth: mmToNm(500),
        }, cabinetNode.id) as ContainerModel;
        const sbNode = doc.findNode(sbContainer.id)!;
        sbContainer.generatorParams = {
            type: 'blok_drawers',
            boxType: 'DRAWERS',
            liczba_szuflad: 1,
            konfiguracje_prowadnic: { 1: { system: 'M94', length: '500' } },
            boundary: {
                left: { nodeId: leftNode.id, face: 'FACE_Z_PLUS' },
                right: { nodeId: rightNode.id, face: 'FACE_Z_PLUS' },
            },
        };

        const railL = CADNode.create(NodeType.HARDWARE, 'Prowadnica 1L', `${sbNode.id}_drawer_1_rail_L`);
        const railR = CADNode.create(NodeType.HARDWARE, 'Prowadnica 1P', `${sbNode.id}_drawer_1_rail_R`);
        doc.addNode(sbNode.id, railL);
        doc.addNode(sbNode.id, railR);

        const intents = buildDrawersDrillings(doc, cabinetNode.id);
        expect(intents.length).toBeGreaterThan(0);

        for (const intent of intents) {
            const drivenNode = doc.findNode(intent.feature.drivenBy.nodeId);
            expect(drivenNode).not.toBeNull();
            expect(drivenNode!.nodeType).toBe(NodeType.HARDWARE);

            if (intent.targetNodeId === leftNode.id) {
                expect(intent.feature.drivenBy.nodeId).toBe(railL.id);
            } else if (intent.targetNodeId === rightNode.id) {
                expect(intent.feature.drivenBy.nodeId).toBe(railR.id);
            } else {
                throw new Error(`Nieoczekiwany targetNodeId: ${intent.targetNodeId}`);
            }
        }
    });
});
