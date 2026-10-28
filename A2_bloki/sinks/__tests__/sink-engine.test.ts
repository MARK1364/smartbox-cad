import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../../A1_core/project-document.js';
import { CommandHistory } from '../../../A1_core/commands/command-history.js';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../../../A4_smartpanel/panel-model.js';
import { mmToNm, nmToMm } from '../../../A1_core/cad-math/units.js';
import {
    normalizeSinkParams,
    computeSinkLayout,
    DEFAULT_SINK_PARAMS,
} from '../sink-types.js';
import { createSmartPartSink } from '../sink-apply.js';
import { isSmartPartDefinition } from '../../../B1_biblioteka/zawieszki/hangers-from-catalog.js';
import zlewStudioJson from '../../../B1_biblioteka/zlewy/zlew_nakladany.json';

describe('SmartPart Sink (Zlew) Engine & Studio standard', () => {
    it('definicja JSON w B1_biblioteka/zlewy/zlew_nakladany.json jest zgodna ze standardem Studio', () => {
        expect(zlewStudioJson.units).toBe('mm');
        expect(zlewStudioJson.type).toBe('CUSTOM');
        expect(isSmartPartDefinition(zlewStudioJson)).toBe(true);

        // Posiada dwa prostopadłościany: kołnierz (wysokość 30 mm) oraz komorę
        expect(zlewStudioJson.parts.length).toBe(2);
        const kolnierz = zlewStudioJson.parts.find(p => p.id.includes('kolnierz'));
        const komora = zlewStudioJson.parts.find(p => p.id.includes('komora'));

        expect(kolnierz).toBeDefined();
        expect(kolnierz?.widthMm).toBe(600);
        expect(kolnierz?.heightMm).toBe(30); // wysoki na 30 mm kołnierz
        expect(kolnierz?.depthMm).toBe(500);

        expect(komora).toBeDefined();
        // Komora mniejsza o 10 mm z każdej strony (580 x 480)
        expect(komora?.widthMm).toBe(580);
        expect(komora?.depthMm).toBe(480);

        // Posiada cięcie w formacie o wymiarach komory
        expect(zlewStudioJson.cuts.length).toBeGreaterThanOrEqual(1);
        const cut = zlewStudioJson.cuts[0];
        expect(cut.widthMm).toBe(580);
        expect(cut.heightMm).toBe(480);
    });

    it('normalizeSinkParams poprawnie normalizuje parametry i centruje na formacie', () => {
        const params = normalizeSinkParams({}, 1000, 600);
        expect(params.szerokosc_mm).toBe(600);
        expect(params.glebokosc_mm).toBe(500);
        expect(params.wysokosc_kolnierza_mm).toBe(30);
        expect(params.margines_komory_mm).toBe(10);
        expect(params.u_mm).toBe(500);
        expect(params.v_mm).toBe(300);
    });

    it('computeSinkLayout wylicza wymiary kołnierza, komory i wycięcia przelotowego', () => {
        const params = normalizeSinkParams({
            szerokosc_mm: 800,
            glebokosc_mm: 500,
            wysokosc_kolnierza_mm: 30,
            margines_komory_mm: 10,
            u_mm: 400,
            v_mm: 300,
        });

        const layout = computeSinkLayout(params);

        // Kołnierz zewnętrzny
        expect(layout.kolnierzWidthMm).toBe(800);
        expect(layout.kolnierzDepthMm).toBe(500);
        expect(layout.kolnierzHeightMm).toBe(30);

        // Komora wpuszczana: mniejsza po 10 mm z każdej strony
        expect(layout.komoraWidthMm).toBe(780);
        expect(layout.komoraDepthMm).toBe(480);

        // Wycięcie odpowiadające komorze
        expect(layout.cutoutWidthMm).toBe(780);
        expect(layout.cutoutLengthMm).toBe(480);
        expect(layout.cutoutUMm).toBe(400 - 780 / 2);
        expect(layout.cutoutVMm).toBe(300 - 480 / 2);
    });

    it('createSmartPartSink przypina zlew do formatki i generuje wycięcie przelotowe (cutout, through: true)', () => {
        const doc = new ProjectDocument();

        // Tworzymy formatkę docelową (np. blat meblowy 1000x600x38 mm)
        const panelModel = new PanelModel({
            name: 'Blat',
            width: mmToNm(1000),
            height: mmToNm(600),
            thickness: mmToNm(38),
        });
        const panelNode = CADNode.create(NodeType.PART, panelModel.name, panelModel.id);
        panelNode.domainData = panelModel;
        doc.addNode(doc.rootNode.id, panelNode);

        // Wstawiamy zlew
        const sinkNode = createSmartPartSink(doc, panelNode, {
            szerokosc_mm: 600,
            glebokosc_mm: 500,
            wysokosc_kolnierza_mm: 30,
            margines_komory_mm: 10,
            u_mm: 500,
            v_mm: 300,
        });

        expect(sinkNode).not.toBeNull();
        expect(sinkNode?.domainData?.name).toBe('Zlew');
        expect((sinkNode?.domainData as any)?.role).toBe('SMARTPART_SINK');
        expect((sinkNode?.domainData as any)?.is_blok).toBe(true);

        // Formatka blatu ma teraz cechę obróbczą cutout
        const features = (panelModel as any).features;
        expect(features.length).toBe(1);

        const cutoutFeat = features[0];
        expect(cutoutFeat.type).toBe('cutout');
        expect(cutoutFeat.params.through).toBe(true);
        expect(cutoutFeat.params.width).toBe(580);
        expect(cutoutFeat.params.length).toBe(480);
        expect(cutoutFeat.params.depth).toBe(38);
        expect(cutoutFeat.params.isSinkCutout).toBe(true);
    });

    it('undo w AddSmartPartSinkCommand cofa wycięcie z formatki i usuwa węzeł', () => {
        const doc = new ProjectDocument();
        const history = new CommandHistory(doc);
        (doc as any).history = history;

        const panelModel = new PanelModel({
            name: 'Blat',
            width: mmToNm(1000),
            height: mmToNm(600),
            thickness: mmToNm(38),
        });
        const panelNode = CADNode.create(NodeType.PART, panelModel.name, panelModel.id);
        panelNode.domainData = panelModel;
        doc.addNode(doc.rootNode.id, panelNode);

        const sinkNode = createSmartPartSink(doc, panelNode, {
            szerokosc_mm: 600,
            glebokosc_mm: 500,
        });

        expect(sinkNode).not.toBeNull();
        expect((panelModel as any).features.length).toBe(1);

        // Undo przez CommandHistory
        history.undo();

        expect((panelModel as any).features.length).toBe(0);
        expect(doc.findNode(sinkNode!.id)).toBeNull();
    });

    it('highlightSinkSurface tworzy podgląd kołnierza i komory, a clearSinkHighlight go sprząta', async () => {
        const { highlightSinkSurface, clearSinkHighlight, SINK_FLANGE_GHOST_NAME, SINK_BASIN_GHOST_NAME } = await import('../sink-visualizer.js');

        const disposed: string[] = [];
        const meshes: Record<string, any> = {};

        const fakeScene = {
            getMeshByName: (name: string) => meshes[name] || null,
        };

        const fakeB = {
            MeshBuilder: {
                CreateBox: (name: string, opts: any) => {
                    const m = {
                        name,
                        opts,
                        parent: null,
                        position: { set: () => {} },
                        rotation: { set: () => {} },
                        material: null,
                        enableEdgesRendering: () => {},
                        dispose: () => disposed.push(name),
                    };
                    meshes[name] = m;
                    return m;
                }
            },
            StandardMaterial: class {
                name: string;
                diffuseColor: any;
                emissiveColor: any;
                alpha: number = 1;
                disableLighting: boolean = false;
                constructor(name: string) { this.name = name; }
            },
            Color3: class { constructor(public r: number, public g: number, public b: number) {} },
            Color4: class { constructor(public r: number, public g: number, public b: number, public a: number) {} },
        };

        (globalThis as any).BABYLON = fakeB;

        const fakeSurface: any = {
            widthMm: 1000,
            heightMm: 600,
            thicknessMm: 38,
            localCoordMm: { x: 500, y: 300 },
            faceZ: 19,
            normalZ: 1,
            pickedMesh: { parent: {} },
        };

        highlightSinkSurface(fakeScene, fakeSurface, {
            szerokosc_mm: 600,
            glebokosc_mm: 500,
        });

        expect(meshes[SINK_FLANGE_GHOST_NAME]).toBeDefined();
        expect(meshes[SINK_BASIN_GHOST_NAME]).toBeDefined();

        clearSinkHighlight(fakeScene);

        expect(disposed).toContain(SINK_FLANGE_GHOST_NAME);
        expect(disposed).toContain(SINK_BASIN_GHOST_NAME);
    });

    it('współosiowość: model 3D, kontener CAD i wycięcie cutout pokrywają się w tym samym punkcie', () => {
        const doc = new ProjectDocument();
        const panelModel = new PanelModel({
            name: 'Blat',
            width: mmToNm(1200),
            height: mmToNm(600),
            thickness: mmToNm(38),
        });
        const panelNode = CADNode.create(NodeType.PART, panelModel.name, panelModel.id);
        panelNode.domainData = panelModel;
        doc.addNode(doc.rootNode.id, panelNode);

        // Użytkownik klika w punkcie localX = +100 mm, localY = -50 mm na górnym licu (faceZ = +19 mm)
        const sinkNode = createSmartPartSink(doc, panelNode, {
            szerokosc_mm: 600,
            glebokosc_mm: 500,
            wysokosc_kolnierza_mm: 30,
            margines_komory_mm: 10,
        }, {
            faceZ: 19,
            normalZ: 1,
            localCoordMm: { x: 100, y: -50 },
        });

        expect(sinkNode).not.toBeNull();
        const gp = (sinkNode?.domainData as any)?.generatorParams;

        // Środek w UV: panel 1200x600, localX=100 -> u = 700 mm; localY=-50 -> v = 250 mm
        expect(gp.u_mm).toBe(700);
        expect(gp.v_mm).toBe(250);
        expect(gp.localX).toBe(100);
        expect(gp.localY).toBe(-50);

        // Kontener CADNode: transformacja (CAD X = localX = 100, CAD Y = faceZ = 19, CAD Z = localY = -50)
        const { translation } = sinkNode!.localMatrix.decompose();
        expect(Math.round(nmToMm(translation.x))).toBe(100);
        expect(Math.round(nmToMm(translation.y))).toBe(19);
        expect(Math.round(nmToMm(translation.z))).toBe(-50);

        // Wycięcie na formatce:
        const cutout = (panelModel as any).features[0];
        expect(cutout.type).toBe('cutout');
        // Środek wycięcia: cutout.params.u + width/2 = (700 - 580/2) + 580/2 = 700 mm
        const cutoutCenterU = cutout.params.u + cutout.params.width / 2;
        const cutoutCenterV = cutout.params.v + cutout.params.length / 2;
        expect(cutoutCenterU).toBe(700);
        expect(cutoutCenterV).toBe(250);
    });

    it('ukrywanie: model.visible = false usuwa meshe zlewu z widoku 3D', async () => {
        const { syncSinkMeshesFromDocument } = await import('../sink-mesh.js');
        const doc = new ProjectDocument();
        const panelModel = new PanelModel({
            name: 'Blat',
            width: mmToNm(1200),
            height: mmToNm(600),
            thickness: mmToNm(38),
        });
        const panelNode = CADNode.create(NodeType.PART, panelModel.name, panelModel.id);
        panelNode.domainData = panelModel;
        doc.addNode(doc.rootNode.id, panelNode);

        const sinkNode = createSmartPartSink(doc, panelNode, {
            szerokosc_mm: 600,
            glebokosc_mm: 500,
        });

        // Ustawienie widoczności na false
        (sinkNode!.domainData as any).visible = false;

        const disposed: string[] = [];
        const fakeScene: any = {
            getMeshByName: (name: string) => {
                if (name.includes('sink_')) {
                    return { dispose: () => disposed.push(name) };
                }
                return null;
            },
            getTransformNodeByName: (name: string) => {
                if (name.includes('sink_')) {
                    return { dispose: () => disposed.push(name) };
                }
                return null;
            },
        };

        (globalThis as any).__cad_scene = fakeScene;

        try {
            syncSinkMeshesFromDocument(doc);
            expect(disposed).toContain(`sink_root_${sinkNode!.id}`);
        } finally {
            delete (globalThis as any).__cad_scene;
        }
    });

    it('edycja parametrów: zmiana gabarytów zewnętrznych, głębokości i marginesu aktualizuje domenę i wycięcie', async () => {
        const { syncSinkCutout } = await import('../sink-cutout.js');
        const doc = new ProjectDocument();
        const panelModel = new PanelModel({
            name: 'Blat',
            width: mmToNm(1600),
            height: mmToNm(700),
            thickness: mmToNm(38),
        });
        const panelNode = CADNode.create(NodeType.PART, panelModel.name, panelModel.id);
        panelNode.domainData = panelModel;
        doc.addNode(doc.rootNode.id, panelNode);

        const sinkNode = createSmartPartSink(doc, panelNode, {
            szerokosc_mm: 600,
            glebokosc_mm: 500,
            margines_komory_mm: 10,
            glebokosc_komory_mm: 180,
        });

        const container = sinkNode!.domainData as any;
        expect(nmToMm(container.width)).toBe(600);
        expect(nmToMm(container.height)).toBe(500);

        // Użytkownik edytuje gabaryt zewnętrzny na 800x600, margines na 40 mm, głębokość komory na 220 mm
        const updatedParams = normalizeSinkParams({
            ...container.generatorParams,
            szerokosc_mm: 800,
            glebokosc_mm: 600,
            margines_komory_mm: 40,
            glebokosc_komory_mm: 220,
        });

        const layout = computeSinkLayout(updatedParams);
        expect(layout.kolnierzWidthMm).toBe(800);
        expect(layout.kolnierzDepthMm).toBe(600);
        expect(layout.komoraWidthMm).toBe(800 - 2 * 40); // 720 mm
        expect(layout.komoraDepthMm).toBe(600 - 2 * 40); // 520 mm
        expect(layout.komoraHeightMm).toBe(220);

        // Aktualizacja kontenera
        container.width = mmToNm(layout.kolnierzWidthMm);
        container.height = mmToNm(layout.kolnierzDepthMm);
        container.depth = mmToNm(layout.kolnierzHeightMm + layout.komoraHeightMm);
        expect(nmToMm(container.width)).toBe(800);
        expect(nmToMm(container.height)).toBe(600);
        expect(nmToMm(container.depth)).toBe(30 + 220);

        // Synchronizacja wycięcia na formatce
        syncSinkCutout(doc, panelNode, container, updatedParams, layout);

        const cutout = (panelModel as any).features[0];
        expect(cutout.params.width).toBe(720);
        expect(cutout.params.length).toBe(520);
        expect(cutout.params.through).toBe(true);
    });

    it('kotwiczenie krawędzi: resolveSinkAbsoluteCenter poprawnie przelicza pozycje od lewej/prawej i przodu/tyłu', async () => {
        const { resolveSinkAbsoluteCenter } = await import('../sink-types.js');
        const panelWMm = 1200;
        const panelHMm = 600;

        // Od lewej krawędzi 300 mm, od dołu (przodu) 200 mm
        const leftBottom = resolveSinkAbsoluteCenter({
            u_mm: 300,
            v_mm: 200,
            uEdge: 'FACE_X_MINUS',
            vEdge: 'FACE_Y_MINUS',
        } as any, panelWMm, panelHMm);
        expect(leftBottom.uAbsMm).toBe(300);
        expect(leftBottom.vAbsMm).toBe(200);

        // Przełączenie na kotwiczenie od prawej i od tyłu:
        // Pozycja środka pozostaje na (300, 200), więc wymiar od prawej = 1200 - 300 = 900 mm, od góry = 600 - 200 = 400 mm
        const rightTop = resolveSinkAbsoluteCenter({
            u_mm: 900,
            v_mm: 400,
            uEdge: 'FACE_X_PLUS',
            vEdge: 'FACE_Y_PLUS',
        } as any, panelWMm, panelHMm);
        expect(rightTop.uAbsMm).toBe(300);
        expect(rightTop.vAbsMm).toBe(200);
    });
});
