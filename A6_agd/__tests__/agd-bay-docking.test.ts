/**
 * A6_agd — agd-bay-docking.test.ts
 * Testy inteligentnego dokowania AGD we wnękach szafki (Cabinet Bay).
 */

import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { createSmartApplianceInDetectedBay } from '../agd-bay-docking.js';
import type { DetectedBay } from '../../A2_bloki/bloki-bay-detector.js';

describe('A6_agd — Smart Appliance Bay Docking', () => {
    function createMockCabinetWithBay(doc: ProjectDocument): { cabNode: CADNode; mockBay: DetectedBay } {
        // Tworzymy szafkę o szerokości 600 mm, wysokości 2000 mm, głębokości 560 mm
        const cabContainer = new ContainerModel({
            name: 'Slup_Piekarnikowy',
            width: mmToNm(600),
            height: mmToNm(2000),
            depth: mmToNm(560),
        });
        const cabNode = CADNode.create(NodeType.ASSEMBLY, cabContainer.name, cabContainer.id);
        cabNode.domainData = cabContainer;
        doc.addNode(doc.rootNode.id, cabNode);

        // Symulacja wykrytej wnęki we słupku na wysokości Z=720 mm (nad szafką dolną / szufladami)
        // Szerokość wnęki: 564 mm (dla szafki 600 z boków 18)
        // Wysokość wnęki: 390 mm
        // Głębokość wnęki: 540 mm
        const mockBay: DetectedBay = {
            parentCabinetId: cabNode.id,
            boundsMm: {
                width: 564,
                height: 390,
                depth: 540,
            },
            boundsNm: {
                width: mmToNm(564),
                height: mmToNm(390),
                depth: mmToNm(540),
            },
            centerWorldMm: {
                x: 300,
                y: 270,
                z: 720 + 390 / 2,
            },
            boundary: {
                left: { nodeId: 'bok_l', nodeName: 'Bok Lewy', face: 'FACE_Z_PLUS', worldPointMm: { x: 18, y: 0, z: 720 }, planeCoordMm: 18 },
                right: { nodeId: 'bok_r', nodeName: 'Bok Prawy', face: 'FACE_Z_PLUS', worldPointMm: { x: 582, y: 0, z: 720 }, planeCoordMm: 582 },
                bottom: { nodeId: 'polka_dol', nodeName: 'Polka Dolna', face: 'FACE_Z_PLUS', worldPointMm: { x: 300, y: 0, z: 720 }, planeCoordMm: 720 },
                top: { nodeId: 'polka_gora', nodeName: 'Polka Gorna', face: 'FACE_Z_MINUS', worldPointMm: { x: 300, y: 0, z: 1110 }, planeCoordMm: 1110 },
                back: { nodeId: 'plecy', nodeName: 'Plecy', face: 'FACE_Z_PLUS', worldPointMm: { x: 300, y: 540, z: 720 }, planeCoordMm: 540 },
                front: { nodeId: 'front_ref', nodeName: 'Przód', face: 'FACE_X_PLUS', worldPointMm: { x: 300, y: 0, z: 720 }, planeCoordMm: 0 },
                frontPlaneYMm: 0,
            },
        };

        return { cabNode, mockBay };
    }

    it('dokuje mikrofalówkę we wnęce słupka jako podwęzeł szafki', () => {
        const doc = new ProjectDocument();
        const { cabNode, mockBay } = createMockCabinetWithBay(doc);

        const agdNode = createSmartApplianceInDetectedBay(doc, mockBay, {
            kind: 'MICROWAVE',
            params: {
                frontHeight: 380,
                nalGoraMicro: 20,
                nalDolneMicro: 8,
                corpusWidth: 560,
                frontWidth: 595,
            },
        });

        expect(agdNode).toBeDefined();
        // Węzeł AGD jest dzieckiem korpusu szafki
        expect(agdNode!.parent?.id).toBe(cabNode.id);

        const container = agdNode!.domainData as ContainerModel;
        expect(container).toBeDefined();
        expect((container as any).role).toBe('APPLIANCE');

        // Kontener przyjmuje gabaryty wnęki
        expect(nmToMm(container.width)).toBe(564);
        expect(nmToMm(container.height)).toBe(390);

        // Zawiera 2 panele B-rep: front i korpus
        expect(agdNode!.children.length).toBe(2);
        const corpus = agdNode!.children.find((c: any) => c.domainData?.role === 'APPLIANCE_CORPUS');
        const front = agdNode!.children.find((c: any) => c.domainData?.role === 'APPLIANCE_FRONT');

        expect(corpus).toBeDefined();
        expect(front).toBeDefined();

        // Symetryczne wycentrowanie w osi X wewnątrz kontenera wnęki (X=0)
        const corpusTrans = corpus!.localMatrix.decompose().translation;
        const frontTrans = front!.localMatrix.decompose().translation;

        expect(corpusTrans.x).toBe(0);
        expect(frontTrans.x).toBe(0);

        // Baza korpusu Z=0 (dolna krawędź leży na półce Z=0, środek to wysokość/2)
        // Wysokość korpusu: 380 - 20 - 8 = 352 mm. Środek = 176 mm
        expect(nmToMm(corpus!.domainData.height)).toBe(352);
        expect(nmToMm(corpusTrans.z)).toBe(176);

        // Front w Z: środek Z = (380/2) - 8 = 182 mm
        expect(nmToMm(front!.domainData.height)).toBe(380);
        expect(nmToMm(frontTrans.z)).toBe(182);

        // Pozycja kontenera: środek wnęki w Y (270 mm) i półka bazowa w Z (720 mm)
        const agdNodeTrans = agdNode!.localMatrix.decompose().translation;
        expect(nmToMm(agdNodeTrans.x)).toBe(300);
        expect(nmToMm(agdNodeTrans.y)).toBe(270);
        expect(nmToMm(agdNodeTrans.z)).toBe(720);

        // Pozycje paneli B-rep w Y względem kontenera (głębokość wnęki 540 mm, lico = -270 mm):
        // Korpus (320 mm) wchodzi w głąb wnęki (+Y): środek = -270 + 160 = -110 mm
        // Front (20 mm) wychodzi na zewnątrz (-Y): środek = -270 - 10 = -280 mm
        expect(nmToMm(corpusTrans.y)).toBe(-110);
        expect(nmToMm(frontTrans.y)).toBe(-280);

        // Referencje do ścian wnęki (lewa, prawa, spód, góra)
        expect(container.generatorParams.customReferences.xMin.panelId).toBe('bok_l');
        expect(container.generatorParams.customReferences.xMax.panelId).toBe('bok_r');
        expect(container.generatorParams.customReferences.zMin.panelId).toBe('polka_dol');
        expect(container.generatorParams.customReferences.zMax.panelId).toBe('polka_gora');
    });

    it('dokuje piekarnik we wnęce i zachowuje relacje wymiarowe', () => {
        const doc = new ProjectDocument();
        const { cabNode, mockBay } = createMockCabinetWithBay(doc);

        const agdNode = createSmartApplianceInDetectedBay(doc, mockBay, {
            kind: 'OVEN',
            params: {
                frontHeight: 596,
                nalGoraMicro: 20,
                nalDolneMicro: 0,
                corpusWidth: 560,
                frontWidth: 595,
            },
        });

        expect(agdNode).toBeDefined();
        expect(agdNode!.name).toBe('Piekarnik');

        const corpus = agdNode!.children.find((c: any) => c.domainData?.role === 'APPLIANCE_CORPUS');
        expect(nmToMm(corpus!.domainData.height)).toBe(576); // 596 - 20 - 0 = 576 mm
    });
});
