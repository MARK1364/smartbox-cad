import { describe, it, expect, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { PanelModel } from '../panel-model.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { registerProjectDomain } from '../../src/application/project-domain.js';
import { ReportDataNormalizer } from '../../R1_reports/report-data-normalizer.js';
import { createRebuildGeometry } from '../../src/application/geometry-rebuild.js';
import { registerPanelViewAdapter, registerContainerViewAdapter, resetViewPort } from '../../A1_core/view-port.js';

describe('Frozen panel persistence (save/load) & skip in rendering/calculations', () => {
    it('preserves frozen and visible=false in PanelModel.toJSON / fromJSON / loadFromJSON', () => {
        const panel = new PanelModel({
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Bok lewy',
            role: 'LEFT_SIDE_PANEL',
        });
        panel.frozen = true;
        panel.visible = false;

        const json = panel.toJSON();
        expect(json.frozen).toBe(true);
        expect(json.visible).toBe(false);

        const hydrated = PanelModel.fromJSON(json);
        expect(hydrated.frozen).toBe(true);
        expect(hydrated.visible).toBe(false);

        const target = new PanelModel({
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Target',
        });
        target.loadFromJSON(json);
        expect(target.frozen).toBe(true);
        expect(target.visible).toBe(false);
    });

    it('preserves frozen panels across ProjectDocument.serialize() and load(), and excludes them from reports', () => {
        const doc = new ProjectDocument({ name: 'Biurko Test' });
        registerProjectDomain(doc);

        const cab = doc.createAssembly({
            name: 'Szafka',
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        }) as ContainerModel;

        const activePanel = doc.createPanel({
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Bok lewy',
            role: 'LEFT_SIDE_PANEL',
        }, cab.id) as PanelModel;

        const frozenPanel = doc.createPanel({
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Bok prawy (zamrożony)',
            role: 'RIGHT_SIDE_PANEL',
        }, cab.id) as PanelModel;

        frozenPanel.frozen = true;
        frozenPanel.visible = false;

        const snapshot = JSON.parse(JSON.stringify(doc.serialize()));

        const doc2 = new ProjectDocument();
        registerProjectDomain(doc2);
        doc2.load(snapshot);

        const loadedActive = doc2.findNode(activePanel.id)?.domainData as PanelModel;
        const loadedFrozenNode = doc2.findNode(frozenPanel.id)!;
        const loadedFrozen = loadedFrozenNode.domainData as PanelModel;

        expect(loadedActive.frozen).toBe(false);
        expect(loadedActive.visible).toBe(true);

        expect(loadedFrozen.frozen).toBe(true);
        expect(loadedFrozen.visible).toBe(false);
        expect(loadedFrozenNode.frozen).toBe(true);

        const reportData = ReportDataNormalizer.extractProjectData(doc2);
        expect(reportData.panels).toHaveLength(1);
        expect(reportData.panels[0].node_id).toBe(activePanel.id);
    });

    it('skips mesh building and disposes existing PanelView when panel is frozen in rebuildGeometry', () => {
        resetViewPort();
        const doc = new ProjectDocument({ name: 'Render Skip Test' });
        registerProjectDomain(doc);

        const cab = doc.createAssembly({
            name: 'Szafka',
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        }) as ContainerModel;

        const frozenPanel = doc.createPanel({
            width: mmToNm(500),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Plecy zamrożone',
            role: 'BACK_PANEL',
        }, cab.id) as PanelModel;
        frozenPanel.frozen = true;
        frozenPanel.visible = false;

        const createPanelViewSpy = vi.fn(() => ({
            root: { parent: null, setEnabled: vi.fn() },
            updateMesh: vi.fn(),
            dispose: vi.fn(),
        }));
        registerContainerViewAdapter({
            createView: () => ({
                rootNode: { setEnabled: vi.fn() },
                update: vi.fn(),
                dispose: vi.fn(),
            }),
        });
        registerPanelViewAdapter({
            createView: createPanelViewSpy,
        });

        const panelBuilderBuildSpy = vi.fn(() => ({}));
        const panelViews = new Map<any, any>();
        const containerViews = new Map<any, any>();

        const rebuildGeometry = createRebuildGeometry({
            getContext: () => ({
                document: doc,
                viewport: { scene: {}, applyRenderModeToMeshes: vi.fn(), requestRender: vi.fn() } as any,
                panelViews,
                containerViews,
                panelBuilder: { build: panelBuilderBuildSpy } as any,
                ui: { setStatus: vi.fn(), refreshFeatures: vi.fn() } as any,
            } as any),
            getGizmoController: () => null,
        });

        rebuildGeometry();

        expect(createPanelViewSpy).not.toHaveBeenCalled();
        expect(panelBuilderBuildSpy).not.toHaveBeenCalled();
        expect(panelViews.size).toBe(0);
    });
});

