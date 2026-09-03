import { describe, expect, it } from 'vitest';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import {
    applyAssociativeDim,
    distanceBetweenPlanesMm,
    isAssocComplete,
    measureAssocDimMm,
} from '../associative-dim.js';
import type { PanelModel } from '../panel-model.js';

describe('associative-dim', () => {
    it('mierzy odległość między dwiema równoległymi ścianami', () => {
        const doc = new ProjectDocument();
        const a = doc.createPanel({
            width: mmToNm(100),
            height: mmToNm(200),
            thickness: mmToNm(18),
            name: 'A',
        });
        const b = doc.createPanel({
            width: mmToNm(100),
            height: mmToNm(200),
            thickness: mmToNm(18),
            name: 'B',
        });
        doc.findNode(b.id)!.setLocalTransform(new Vec3(mmToNm(400), 0, 0), Quat.IDENTITY);

        const dist = distanceBetweenPlanesMm(
            doc,
            { nodeId: a.id, face: 'FACE_X_PLUS' },
            { nodeId: b.id, face: 'FACE_X_MINUS' },
        );
        expect(dist).toBeCloseTo(300, 3);
    });

    it('przypisuje odległość + offset do szerokości płyty', () => {
        const doc = new ProjectDocument();
        const left = doc.createPanel({
            width: mmToNm(18),
            height: mmToNm(720),
            thickness: mmToNm(500),
            name: 'Bok L',
        });
        const right = doc.createPanel({
            width: mmToNm(18),
            height: mmToNm(720),
            thickness: mmToNm(500),
            name: 'Bok P',
        });
        doc.findNode(right.id)!.setLocalTransform(new Vec3(mmToNm(600), 0, 0), Quat.IDENTITY);

        const panel = doc.createPanel({
            width: mmToNm(100),
            height: mmToNm(80),
            thickness: mmToNm(18),
            name: 'Wzmocnienie',
            engineManaged: false,
        }) as PanelModel;

        panel.associativeDims = {
            width: {
                planeA: { nodeId: left.id, face: 'FACE_X_PLUS' },
                planeB: { nodeId: right.id, face: 'FACE_X_MINUS' },
                offsetMm: -2,
            },
        };

        expect(isAssocComplete(panel.associativeDims.width)).toBe(true);
        const mm = measureAssocDimMm(doc, panel.associativeDims.width);
        expect(mm).toBeCloseTo(580, 3);
        expect(applyAssociativeDim(doc, panel, 'width')).toBe(true);
        expect(panel.width).toBe(mmToNm(mm!));
    });

    it('round-trip associativeDims w JSON panelu', () => {
        const doc = new ProjectDocument();
        const panel = doc.createPanel({ name: 'Płyta' }) as PanelModel;
        panel.associativeDims = {
            width: {
                planeA: { nodeId: 'n1', face: 'FACE_X_PLUS', label: 'Bok' },
                planeB: { nodeId: 'n2', face: 'FACE_X_MINUS' },
                offsetMm: 1.5,
            },
        };
        const restored = new ProjectDocument();
        restored.load(JSON.parse(JSON.stringify(doc.serialize())));
        const copy = restored.findNode(panel.id)!.domainData as PanelModel;
        expect(copy.associativeDims?.width?.planeA?.nodeId).toBe('n1');
        expect(copy.associativeDims?.width?.offsetMm).toBe(1.5);
    });
});
