import { describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { ExportEngine } from '../export-engine.js';
import { collectExportNodePoses, restoreExportNodePoses, collectExportNodeVisibility, restoreExportNodeVisibility } from '../export-view-state.js';

describe('export-view-state', () => {
    it('captures and restores korpus rotation for a saved export frame', () => {
        const doc = new ProjectDocument({ name: 'Kadry' });
        const cabinet = doc.createAssembly({ name: 'Szafa', width: mmToNm(800) });
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

    it('stores distinct scene positions across multiple frames (1, 2, 3, 4) and restores each independently', () => {
        const doc = new ProjectDocument({ name: 'WieloKadr' });
        const cabinet = doc.createAssembly({ name: 'Szafa1', width: mmToNm(800) });
        const node = doc.findNode(cabinet.id)!;

        // Stan dla kadru 1: pozycja X = 0
        node.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        const kadr1Poses = collectExportNodePoses(doc);

        // Stan dla kadru 2: pozycja X = 500 mm
        node.setLocalTransform(new Vec3(mmToNm(500), 0, 0), Quat.IDENTITY);
        const kadr2Poses = collectExportNodePoses(doc);

        // Stan dla kadru 3: obrót o 90 deg i X = 1000 mm
        const rot90 = Quat.fromEulerXYZ(0, 0, Math.PI / 2);
        node.setLocalTransform(new Vec3(mmToNm(1000), 0, 0), rot90);
        const kadr3Poses = collectExportNodePoses(doc);

        // Stan dla kadru 4: obrót o 180 deg i X = 1500 mm
        const rot180 = Quat.fromEulerXYZ(0, 0, Math.PI);
        node.setLocalTransform(new Vec3(mmToNm(1500), 0, 0), rot180);
        const kadr4Poses = collectExportNodePoses(doc);

        // Bieżący stan na scenie to kadr 4
        expect(node.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(1500), 0);

        // Przywrócenie kadru 1
        restoreExportNodePoses(doc, kadr1Poses);
        expect(node.localMatrix.decompose().translation.x).toBeCloseTo(0, 0);

        // Przywrócenie kadru 2
        restoreExportNodePoses(doc, kadr2Poses);
        expect(node.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(500), 0);

        // Przywrócenie kadru 3
        restoreExportNodePoses(doc, kadr3Poses);
        expect(node.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(1000), 0);
        expect(node.localMatrix.decompose().rotation.z).toBeCloseTo(rot90.z, 4);

        // Przywrócenie kadru 4
        restoreExportNodePoses(doc, kadr4Poses);
        expect(node.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(1500), 0);
        expect(node.localMatrix.decompose().rotation.z).toBeCloseTo(rot180.z, 4);
    });

    it('captures and restores object visibility in a saved frame', () => {
        const doc = new ProjectDocument({ name: 'Widocznosc' });
        const cabinet = doc.createAssembly({ name: 'SzafaVis', width: mmToNm(800) });
        const node = doc.findNode(cabinet.id)!;
        (node.domainData as any).visible = true;

        const shown = collectExportNodeVisibility(doc);
        expect(shown.some((v) => v.nodeId === cabinet.id && v.visible === true)).toBe(true);

        (node.domainData as any).visible = false;
        const hidden = collectExportNodeVisibility(doc);
        expect(hidden.find((v) => v.nodeId === cabinet.id)?.visible).toBe(false);

        restoreExportNodeVisibility(doc, shown);
        expect((node.domainData as any).visible).toBe(true);

        restoreExportNodeVisibility(doc, hidden);
        expect((node.domainData as any).visible).toBe(false);
    });

    it('ExportEngine captures and restores node poses via saveCurrentView and applySavedView', () => {
        const doc = new ProjectDocument({ name: 'ExportEngineDoc' });
        ContextManager.instance.document = doc;

        const cabinet = doc.createAssembly({ name: 'SzafaExport', width: mmToNm(900) });
        const node = doc.findNode(cabinet.id)!;

        const engine = new ExportEngine();
        engine.savedViews = [];

        // Kadr 1: mebel w pozycji X = 100, widoczny
        node.setLocalTransform(new Vec3(mmToNm(100), 0, 0), Quat.IDENTITY);
        (node.domainData as any).visible = true;
        const view1 = engine.saveCurrentView('Kadr 1');
        expect(view1.nodePoses).toBeDefined();
        expect(view1.nodePoses![0].translationNm[0]).toBeCloseTo(mmToNm(100), 0);
        expect(view1.nodeVisibility?.find((v) => v.nodeId === cabinet.id)?.visible).toBe(true);

        // Kadr 2: mebel przestawiony na X = 800 i ukryty
        node.setLocalTransform(new Vec3(mmToNm(800), 0, 0), Quat.IDENTITY);
        (node.domainData as any).visible = false;
        const view2 = engine.saveCurrentView('Kadr 2');
        expect(view2.nodePoses![0].translationNm[0]).toBeCloseTo(mmToNm(800), 0);
        expect(view2.nodeVisibility?.find((v) => v.nodeId === cabinet.id)?.visible).toBe(false);

        // Bieżący stan to 800, ukryty
        expect(node.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(800), 0);

        // Przywrócenie widoku 1 przez applySavedView
        engine.applySavedView(view1);
        expect(node.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(100), 0);
        expect((node.domainData as any).visible).toBe(true);

        // Przywrócenie widoku 2 przez applySavedView
        engine.applySavedView(view2);
        expect(node.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(800), 0);
        expect((node.domainData as any).visible).toBe(false);
    });

    it('does nothing for empty poses', () => {
        const doc = new ProjectDocument();
        expect(restoreExportNodePoses(doc, [])).toEqual([]);
        expect(restoreExportNodePoses(doc, null)).toEqual([]);
        expect(restoreExportNodeVisibility(doc, [])).toEqual([]);
        expect(restoreExportNodeVisibility(doc, null)).toEqual([]);
    });
});

