import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { ContextManager } from '../context-manager.js';
import { GizmoController } from '../gizmo-controller.js';
import { CADNode } from '../cad-node/cad-node.js';
import { NodeType } from '../cad-node/node-type.js';

describe('Gizmo Visibility Control', () => {
    let doc: ProjectDocument;
    let gizmoCtrl: GizmoController;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Gizmo Visibility Test' });
        ContextManager.instance.document = doc;
        gizmoCtrl = new GizmoController();
        ContextManager.instance.gizmoController = gizmoCtrl;
    });

    it('isEntityVisible returns true for visible panels and containers', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);

        expect(gizmoCtrl.isEntityVisible(panel)).toBe(true);
        expect(gizmoCtrl.isEntityVisible(container)).toBe(true);
    });

    it('isEntityVisible returns false when panel.visible is false', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: false };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);

        expect(gizmoCtrl.isEntityVisible(panel)).toBe(false);
    });

    it('isEntityVisible returns false when parent container is hidden', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);

        (container as any).visible = false;
        expect(gizmoCtrl.isEntityVisible(panel)).toBe(false);
    });

    it('isEntityVisible returns false when container.generatorParams.visible is false', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);

        (container as any).generatorParams = { visible: false };
        expect(gizmoCtrl.isEntityVisible(panel)).toBe(false);
    });

    it('isEntityVisible returns false when panel is frozen', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true, frozen: true };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);

        expect(gizmoCtrl.isEntityVisible(panel)).toBe(false);
    });

    it('clearFaceGizmos resets all internal gizmo states', () => {
        gizmoCtrl.clearFaceGizmos();
        expect((gizmoCtrl as any).activeFaceGizmoSpheres).toEqual([]);
        expect((gizmoCtrl as any).activeGizmoSphere).toBeNull();
        expect((gizmoCtrl as any).isEditingFaceGizmo).toBe(false);
        expect((gizmoCtrl as any).isDraggingFaceGizmo).toBe(false);
    });

    it('hideGizmos callback in ContextManager calls clearFaceGizmos', () => {
        let cleared = false;
        const origClear = gizmoCtrl.clearFaceGizmos.bind(gizmoCtrl);
        gizmoCtrl.clearFaceGizmos = () => {
            cleared = true;
            origClear();
        };

        gizmoCtrl.init();
        expect(typeof ContextManager.instance.hideGizmos).toBe('function');
        ContextManager.instance.hideGizmos!();
        expect(cleared).toBe(true);
    });
});
