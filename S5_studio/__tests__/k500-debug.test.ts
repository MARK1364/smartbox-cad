import { describe, it, expect } from 'vitest';
import k500 from '../../B1_biblioteka/zawieszki/k500.json';
import {
    bayFrameFromDetectedBay,
    resolveStudioPlacementWorldMm,
    resolveStudioPlacementInContainerMm,
} from '../../A2_bloki/hangers/smartpart-bay-placement.js';
import { normalizeSmartPartToCadCoords } from '../index.js';
import type { DetectedBay } from '../../A2_bloki/02_bloki-bay-detector.js';

describe('k500 debug', () => {
    it('sprawdza wartości w k500.json', () => {
        const part = k500.parts[0];
        console.log('k500 raw part:', part);
        expect(part.refZ).toBe('TOP');
        expect(part.offsetZ_mm).toBe(30);
    });

    it('sprawdza pozycje k500 w korpusie', () => {
        const def = normalizeSmartPartToCadCoords(k500 as any);
        console.log('k500 normalized part:', def.parts[0]);

        const bayDims = { widthMm: 564, heightMm: 600, depthMm: 330 };
        const p1 = resolveStudioPlacementInContainerMm(bayDims, def.parts[0]);
        console.log('k500 container pos:', p1);

        const bay: DetectedBay = {
            boundsMm: { width: 564, height: 600, depth: 330 },
            boundsNm: { width: 0, height: 0, depth: 0 },
            centerWorldMm: { x: 0, y: 0, z: 300 },
            boundary: {
                left: { nodeId: 'L', planeCoordMm: -282, face: 'FACE_Z_PLUS', nodeName: 'Bok L', worldPointMm: { x: -282, y: 0, z: 300 } },
                right: { nodeId: 'R', planeCoordMm: 282, face: 'FACE_Z_PLUS', nodeName: 'Bok R', worldPointMm: { x: 282, y: 0, z: 300 } },
                back: { nodeId: 'B', planeCoordMm: 165, face: 'FACE_Z_PLUS', nodeName: 'Plecy', worldPointMm: { x: 0, y: 165, z: 300 } },
                front: { nodeId: 'F', planeCoordMm: -165, face: 'FACE_Y_MINUS', nodeName: 'Przod', worldPointMm: { x: 0, y: -165, z: 300 } },
                top: { nodeId: 'T', planeCoordMm: 600, face: 'FACE_Z_MINUS', nodeName: 'Wieniec', worldPointMm: { x: 0, y: 0, z: 600 } },
                bottom: { nodeId: 'Bo', planeCoordMm: 0, face: 'FACE_Z_PLUS', nodeName: 'Dno', worldPointMm: { x: 0, y: 0, z: 0 } },
            },
        };

        const frame = bayFrameFromDetectedBay(bay);
        const w1 = resolveStudioPlacementWorldMm(frame, def.parts[0]);
        console.log('k500 world pos:', w1);
    });

    it('sprawdza createSmartPartHangersInBay z k500', async () => {
        const { ProjectDocument } = await import('../../A1_core/project-document.js');
        const { createSmartPartHangersInBay, updateSmartPartHangersGroup } = await import('../../A2_bloki/hangers/hanger-apply.js');
        const { hangerItemToTemplate, buildHangerCatalog } = await import('../../A2_bloki/01_smartparts-catalog.js');

        const catalog = buildHangerCatalog();
        const k500Item = catalog.find((i) => i.id === 'k500' || i.id === 'sp:k500' || i.name === 'k500');
        console.log('k500 catalog item found:', k500Item?.id, k500Item?.name, 'parts:', k500Item?.definition?.parts);

        const doc = new ProjectDocument();
        const bay: DetectedBay = {
            boundsMm: { width: 564, height: 600, depth: 330 },
            boundsNm: { width: 0, height: 0, depth: 0 },
            centerWorldMm: { x: 0, y: 0, z: 300 },
            parentCabinetId: doc.rootNode.id,
            boundary: {
                left: { nodeId: 'L', planeCoordMm: -282, face: 'FACE_Z_PLUS', nodeName: 'Bok L', worldPointMm: { x: -282, y: 0, z: 300 } },
                right: { nodeId: 'R', planeCoordMm: 282, face: 'FACE_Z_PLUS', nodeName: 'Bok R', worldPointMm: { x: 282, y: 0, z: 300 } },
                back: { nodeId: 'B', planeCoordMm: 165, face: 'FACE_Z_PLUS', nodeName: 'Plecy', worldPointMm: { x: 0, y: 165, z: 300 } },
                front: { nodeId: 'F', planeCoordMm: -165, face: 'FACE_Y_MINUS', nodeName: 'Przod', worldPointMm: { x: 0, y: -165, z: 300 } },
                top: { nodeId: 'T', planeCoordMm: 600, face: 'FACE_Z_MINUS', nodeName: 'Wieniec', worldPointMm: { x: 0, y: 0, z: 600 } },
                bottom: { nodeId: 'Bo', planeCoordMm: 0, face: 'FACE_Z_PLUS', nodeName: 'Dno', worldPointMm: { x: 0, y: 0, z: 0 } },
            },
        };

        if (k500Item) {
            const template = hangerItemToTemplate(k500Item);
            console.log('template definition parts:', template.definition?.parts);
            const groupNode = createSmartPartHangersInBay(doc, bay, template);
            expect(groupNode).not.toBeNull();
            console.log('groupNode children:', groupNode?.children?.map((c) => ({
                id: c.id,
                name: c.name,
                pos: c.localMatrix.decompose().translation,
            })));
        }
    });
});

