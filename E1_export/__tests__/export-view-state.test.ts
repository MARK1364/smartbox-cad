import { describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { collectExportNodePoses, restoreExportNodePoses } from '../export-view-state.js';

describe('export-view-state', () => {
    it('captures and restores korpus rotation for a saved export frame', () => {
        const doc = new ProjectDocument({ name: 'Kadry' });
        const cabinet = doc.createContainer({ name: 'Szafa', width: mmToNm(800) });
        const node = doc.findNode(cabinet.id)!;
        expect(node.nodeType).toBe(NodeType.ASSEMBLY);

        const front = collectExportNodePoses(doc);
        expect(front).toHaveLength(1);
        expect(front[0].nodeId).toBe(cabinet.id);

        const turned = Quat.fromEulerXYZ(0, 0, Math.PI / 2);
        const { translation, scale } = node.localMatrix.decompose();
        node.setLocalTransform(translation, turned, scale);

        const side = collectExportNodePoses(doc);
        const sideQuat = side[0].rotationQuat;
        expect(Math.abs(sideQuat[2])).toBeGreaterThan(0.4);

        restoreExportNodePoses(doc, front);
        const { rotation: back } = node.localMatrix.decompose();
        expect(back.z).toBeCloseTo(0, 5);
        expect(back.w).toBeCloseTo(1, 5);

        restoreExportNodePoses(doc, side);
        const { rotation: again } = node.localMatrix.decompose();
        expect(again.z).toBeCloseTo(turned.z, 5);
        expect(again.w).toBeCloseTo(turned.w, 5);
    });

    it('does nothing for empty poses', () => {
        const doc = new ProjectDocument();
        expect(restoreExportNodePoses(doc, [])).toEqual([]);
        expect(restoreExportNodePoses(doc, null)).toEqual([]);
    });
});
