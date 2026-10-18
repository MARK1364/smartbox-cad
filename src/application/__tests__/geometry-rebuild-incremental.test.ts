import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectDocument } from '../../../A1_core/project-document.js';
import { PanelModel } from '../../../A4_smartpanel/panel-model.js';
import { mmToNm } from '../../../A1_core/cad-math/units.js';
import { createRebuildGeometry } from '../geometry-rebuild.js';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../../A1_core/cad-node/node-type.js';
import { registerPanelViewAdapter } from '../../../A1_core/view-port.js';

describe('geometry-rebuild incremental', () => {
    beforeEach(() => {
        registerPanelViewAdapter({
            createView: (_scene: any, _panel: any) => ({
                lastWidth: 0,
                lastHeight: 0,
                lastThickness: 0,
                lastFeaturesFingerprint: '',
                updateMesh: vi.fn(),
                renderFeatures: vi.fn(),
                _updateTransform: vi.fn(),
                setPanelVisible: vi.fn(),
                dispose: vi.fn()
            })
        });
    });

    it('przebudowuje tylko nowe lub brudne panele, omijając niezmienione', () => {
        const doc = new ProjectDocument();
        const p1 = new PanelModel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) });
        const p2 = new PanelModel({ width: mmToNm(564), height: mmToNm(560), thickness: mmToNm(18) });

        const n1 = CADNode.create(NodeType.PART, 'P1', p1.id);
        n1.domainData = p1;
        doc.addNode(doc.rootNode.id, n1);

        const n2 = CADNode.create(NodeType.PART, 'P2', p2.id);
        n2.domainData = p2;
        doc.addNode(doc.rootNode.id, n2);

        const panelViews = new Map<any, any>();
        const containerViews = new Map<any, any>();

        const buildSpy = vi.fn().mockReturnValue({
            FACE_Z_PLUS: { positions: [0, 0, 0], indices: [0] }
        });

        const mockPanelBuilder = { build: buildSpy };
        const mockUi = { setStatus: vi.fn(), refreshFeatures: vi.fn() };
        const mockViewport = {
            scene: {},
            applyRenderModeToMeshes: vi.fn(),
            requestRender: vi.fn()
        };

        const ctx: any = {
            document: doc,
            viewport: mockViewport,
            panelViews,
            containerViews,
            panelBuilder: mockPanelBuilder,
            ui: mockUi
        };

        const rebuildGeometry = createRebuildGeometry({
            getContext: () => ctx,
            getGizmoController: () => null
        });

        // 1. Pierwszy rebuild - oba panele są nowe, więc buildSpy wołane 2x
        rebuildGeometry();
        expect(buildSpy).toHaveBeenCalledTimes(2);
        expect(mockViewport.applyRenderModeToMeshes).toHaveBeenCalledTimes(1);

        // 2. Drugi rebuild bez zmian w modelu - żaden panel nie powinien być przebudowany
        buildSpy.mockClear();
        mockViewport.applyRenderModeToMeshes.mockClear();
        rebuildGeometry();
        expect(buildSpy).toHaveBeenCalledTimes(0);
        expect(mockViewport.applyRenderModeToMeshes).toHaveBeenCalledTimes(0);

        // 3. Dodanie trzeciego panelu - tylko trzeci panel powinien być przebudowany
        const p3 = new PanelModel({ width: mmToNm(800), height: mmToNm(400), thickness: mmToNm(18) });
        const n3 = CADNode.create(NodeType.PART, 'P3', p3.id);
        n3.domainData = p3;
        doc.addNode(doc.rootNode.id, n3);

        buildSpy.mockClear();
        mockViewport.applyRenderModeToMeshes.mockClear();
        rebuildGeometry();
        expect(buildSpy).toHaveBeenCalledTimes(1);
        expect(buildSpy).toHaveBeenCalledWith(p3);
        expect(mockViewport.applyRenderModeToMeshes).toHaveBeenCalledTimes(1);

        // 4. Zmiana wymiaru panelu p1 - tylko p1 powinien być przebudowany
        p1.width = mmToNm(650);
        buildSpy.mockClear();
        mockViewport.applyRenderModeToMeshes.mockClear();
        rebuildGeometry();
        expect(buildSpy).toHaveBeenCalledTimes(1);
        expect(buildSpy).toHaveBeenCalledWith(p1);
        expect(mockViewport.applyRenderModeToMeshes).toHaveBeenCalledTimes(1);
    });
});
