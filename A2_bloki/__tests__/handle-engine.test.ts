/**
 * A2_bloki — handle-engine.test.ts
 * Testy jednostkowe silnika uchwytów (moduł Bloki / FORMATKA).
 */

import { describe, it, expect } from 'vitest';
import {
    computeHandleOverhang,
    computeHandleCenterMm,
    computeHandleLayout,
    computeHandleCenterFromUV,
    computeUVFromCenter,
    rebindHandleEdge,
    createSmartPartHandle,
    syncHandleDrillings,
} from '../handles/handle-engine.js';
import { ClearHandleDrillingsCommand } from '../handles/commands/clear-handle-drillings-command.js';
import { DEFAULT_HANDLE_PARAMS } from '../handles/handle-types.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { DrawingProjectExtractor } from '../../R2_rys/drawing-project-extractor.js';

describe('A5_smartparts — Handle Engine & Overhang Calculations', () => {
    it('poprawnie wylicza wystawanie poza otwory (overhang) z każdej strony', () => {
        // Reling 200 mm z rozstawem 160 mm -> (200 - 160) / 2 = 20 mm
        expect(computeHandleOverhang({ totalLengthMm: 200, holeDistanceMm: 160 })).toBe(20);

        // Reling 168 mm z rozstawem 128 mm -> (168 - 128) / 2 = 20 mm
        expect(computeHandleOverhang({ totalLengthMm: 168, holeDistanceMm: 128 })).toBe(20);

        // Uchwyt 232 mm z rozstawem 192 mm -> 20 mm
        expect(computeHandleOverhang({ totalLengthMm: 232, holeDistanceMm: 192 })).toBe(20);

        // Gałka jednopunktowa (holeDistance = 0, średnica 30 mm) -> promień 15 mm
        expect(computeHandleOverhang({ totalLengthMm: 30, holeDistanceMm: 0 })).toBe(15);
    });

    it('wylicza środek i osie otworów w układzie poziomym (HORIZONTAL) TOP_CENTER', () => {
        const panelW = 600;
        const panelH = 360;

        const layout = computeHandleLayout({
            ...DEFAULT_HANDLE_PARAMS,
            totalLengthMm: 200,
            holeDistanceMm: 160,
            orientation: 'HORIZONTAL',
            placementPreset: 'TOP_CENTER',
            offsetEdgeYMm: 35,
            offsetEdgeXMm: 0,
        }, panelW, panelH);

        // Środek w poziomie: X=0
        expect(layout.center.x).toBe(0);
        // Środek w pionie: H/2 - 35 = 180 - 35 = 145 mm
        expect(layout.center.y).toBe(145);

        // 2 otwory pod śruby C-C 160 mm (po -80 i +80 mm)
        expect(layout.holes.length).toBe(2);
        expect(layout.holes[0].x).toBe(-80);
        expect(layout.holes[0].y).toBe(145);
        expect(layout.holes[1].x).toBe(80);
        expect(layout.holes[1].y).toBe(145);

        // Skrajne wymiary gabarytu uchwytu (200 mm szerokości)
        expect(layout.bbox.minX).toBe(-100);
        expect(layout.bbox.maxX).toBe(100);
        expect(layout.overhangMm).toBe(20);
    });

    it('wylicza osie otworów w układzie pionowym (VERTICAL) TOP_LEFT (dla drzwi)', () => {
        const panelW = 450;
        const panelH = 720;

        const layout = computeHandleLayout({
            ...DEFAULT_HANDLE_PARAMS,
            totalLengthMm: 200,
            holeDistanceMm: 160,
            orientation: 'VERTICAL',
            placementPreset: 'TOP_LEFT',
            offsetEdgeXMm: 40,
            offsetEdgeYMm: 100,
        }, panelW, panelH);

        // Położenie X: od lewej krawędzi (-halfW + 40) = -225 + 40 = -185 mm
        expect(layout.center.x).toBe(-185);
        // Położenie Y: od góry (halfH - 100) = 360 - 100 = 260 mm
        expect(layout.center.y).toBe(260);

        // Otwory pionowe: Y = center.y ± 80 mm
        expect(layout.holes.length).toBe(2);
        expect(layout.holes[0].x).toBe(-185);
        expect(layout.holes[0].y).toBe(180); // 260 - 80
        expect(layout.holes[1].x).toBe(-185);
        expect(layout.holes[1].y).toBe(340); // 260 + 80

        // Skrajne krawędzie pionowe: 260 ± 100 mm -> od 160 do 360 mm
        expect(layout.bbox.minY).toBe(160);
        expect(layout.bbox.maxY).toBe(360);
    });

    it('tworzy węzeł kontenera SmartPart Handle jako dziecko formatki', () => {
        const doc = new ProjectDocument();

        // Front szafki 600 x 360 x 18 mm
        const frontPanel = new PanelModel({
            name: 'Front_Szuflady',
            width: mmToNm(600),
            height: mmToNm(360),
            thickness: mmToNm(18),
        });
        const frontNode = CADNode.create(NodeType.PART, frontPanel.name, frontPanel.id);
        frontNode.domainData = frontPanel;
        doc.addNode(doc.rootNode.id, frontNode);

        const handleNode = createSmartPartHandle(doc, frontNode, {
            totalLengthMm: 200,
            holeDistanceMm: 160,
            placementPreset: 'TOP_CENTER',
            offsetEdgeYMm: 35,
        });

        expect(handleNode).toBeDefined();
        // Rodzicem jest węzeł formatki
        expect(handleNode!.parent?.id).toBe(frontNode.id);

        const containerData = handleNode!.domainData as any;
        expect(containerData.role).toBe('SMARTPART_HANDLE');
        expect(containerData.generatorParams.overhangMm).toBe(20);
        expect(containerData.generatorParams.holeDistanceMm).toBe(160);
        expect(containerData.generatorParams.totalLengthMm).toBe(200);

        // Zawiera węzeł okucia HARDWARE
        const hwNode = handleNode!.children.find((c: any) => c.nodeType === NodeType.HARDWARE);
        expect(hwNode).toBeDefined();
        expect((hwNode!.domainData as any).hardwareType).toBe('HANDLE');
        expect((hwNode!.domainData as any).c_c).toBe(160);

        // Tworzy nawierty montażowe pod śruby na formacie (frontPanel.features)
        expect(frontPanel.features.length).toBe(2);
        const [h1, h2] = frontPanel.features;
        expect(h1.type).toBe('hole');
        expect(h1.params.diameter).toBe(4.0);
        expect(h1.params.depth).toBe(18);
        expect(h1.params.isHandleDrilling).toBe(true);
        expect(h1.params.sourceContainerId).toBe(containerData.id);
        expect((h1 as any).drivenBy?.nodeId).toBe(hwNode!.id);
        expect((h2 as any).drivenBy?.nodeId).toBe(hwNode!.id);

        // Współrzędne (u, v) dla FACE_Z_MINUS (panelW=600, panelH=360, center=(0, 145), holes x=-80, +80):
        // u = 600/2 - hole.x; v = hole.y + 360/2 = 145 + 180 = 325 mm
        // h1 (x=-80): u = 300 - (-80) = 380 mm; v = 325 mm
        // h2 (x=+80): u = 300 - 80 = 220 mm; v = 325 mm
        expect(h1.params.u).toBe(380);
        expect(h1.params.v).toBe(325);
        expect(h2.params.u).toBe(220);
        expect(h2.params.v).toBe(325);
    });

    it('syncHandleDrillings aktualizuje lub usuwa nawierty przy zmianie parametrów', () => {
        const doc = new ProjectDocument();
        const frontPanel = new PanelModel({
            name: 'Front_Szuflady',
            width: mmToNm(600),
            height: mmToNm(360),
            thickness: mmToNm(18),
        });
        const frontNode = CADNode.create(NodeType.PART, frontPanel.name, frontPanel.id);
        frontNode.domainData = frontPanel;
        doc.addNode(doc.rootNode.id, frontNode);

        const handleNode = createSmartPartHandle(doc, frontNode, {
            totalLengthMm: 200,
            holeDistanceMm: 160,
            drillingEnabled: true,
            drillDiameterMm: 4.5,
        })!;

        const containerData = handleNode.domainData as any;
        expect(frontPanel.features.length).toBe(2);
        expect(frontPanel.features[0].params.diameter).toBe(4.5);

        // 1. Zmiana rozstawu na 128 mm
        const newParams = {
            ...DEFAULT_HANDLE_PARAMS,
            totalLengthMm: 168,
            holeDistanceMm: 128,
            drillingEnabled: true,
            drillDiameterMm: 5.0,
        };
        const newLayout = computeHandleLayout(newParams, 600, 360);
        syncHandleDrillings(doc, frontNode, containerData, newLayout, newParams, -1);

        expect(frontPanel.features.length).toBe(2);
        expect(frontPanel.features[0].params.diameter).toBe(5.0);
        // Otwory dla 128 mm (x = ±64 mm) -> u = 300 - (-64) = 364 oraz 300 - 64 = 236
        expect(frontPanel.features[0].params.u).toBe(364);
        expect(frontPanel.features[1].params.u).toBe(236);

        // 2. Wyłączenie wiercenia (drillingEnabled = false)
        syncHandleDrillings(doc, frontNode, containerData, newLayout, { ...newParams, drillingEnabled: false }, -1);
        expect(frontPanel.features.length).toBe(0);
    });

    it('ClearHandleDrillingsCommand czyści nawierty po usunięciu uchwytu', () => {
        const doc = new ProjectDocument();
        const frontPanel = new PanelModel({
            name: 'Front_Szuflady',
            width: mmToNm(600),
            height: mmToNm(360),
            thickness: mmToNm(18),
        });
        const frontNode = CADNode.create(NodeType.PART, frontPanel.name, frontPanel.id);
        frontNode.domainData = frontPanel;
        doc.addNode(doc.rootNode.id, frontNode);

        const handleNode = createSmartPartHandle(doc, frontNode, {
            totalLengthMm: 200,
            holeDistanceMm: 160,
        })!;
        expect(frontPanel.features.length).toBe(2);

        // Usunięcie nawierceń przez komendę czyszczącą
        const cmd = new ClearHandleDrillingsCommand(handleNode.id);
        cmd.execute(doc);
        expect(frontPanel.features.length).toBe(0);

        // Undo przywraca otwory
        cmd.undo(doc);
        expect(frontPanel.features.length).toBe(2);
    });

    it('drzewo obiektów (DrawingProjectExtractor) zawiera uchwyt jako dziecko formatki', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        const frontPanel = new PanelModel({
            name: 'Front_Szuflady',
            width: mmToNm(600),
            height: mmToNm(360),
            thickness: mmToNm(18),
        });
        const frontNode = CADNode.create(NodeType.PART, frontPanel.name, frontPanel.id);
        frontNode.domainData = frontPanel;
        doc.addNode(doc.rootNode.id, frontNode);

        const handleNode = createSmartPartHandle(doc, frontNode, {
            totalLengthMm: 200,
            holeDistanceMm: 160,
        })!;

        const tree = DrawingProjectExtractor.instance.extractProjectTree();
        const root = tree.rootNode;
        expect(root.children?.length).toBe(1);

        const panelTreeItem = root.children![0];
        expect(panelTreeItem.id).toBe(frontNode.id);
        expect(panelTreeItem.name).toBe('Front_Szuflady');

        // Uchwyt jest dzieckiem formatki w drzewie
        expect(panelTreeItem.children?.length).toBe(1);
        const handleTreeItem = panelTreeItem.children![0];
        expect(handleTreeItem.id).toBe(handleNode.id);
        expect(handleTreeItem.name).toContain('Uchwyt');
        expect(handleTreeItem.role).toBe('SMARTPART_HANDLE');
        expect(handleTreeItem.icon).toBe('🪝');

        // Wewnątrz uchwytu znajduje się węzeł okucia HARDWARE
        expect(handleTreeItem.children?.length).toBe(1);
        expect(handleTreeItem.children![0].type).toBe('HARDWARE');
    });

    it('poprawnie przelicza współrzędne UV na pozycję środka (X, Y) oraz z powrotem', () => {
        const panelW = 600;
        const panelH = 360;

        // 1. Kotwica U do krawędzi lewej (FACE_X_MINUS), V do krawędzi górnej (FACE_Y_PLUS)
        const pos1 = computeHandleCenterFromUV(50, 40, 'FACE_X_MINUS', 'FACE_Y_PLUS', panelW, panelH);
        expect(pos1.x).toBe(-250); // -300 + 50
        expect(pos1.y).toBe(140);  // 180 - 40

        // Konwersja odwrotna z powrotem do UV
        const uv1 = computeUVFromCenter(pos1.x, pos1.y, 'FACE_X_MINUS', 'FACE_Y_PLUS', panelW, panelH);
        expect(uv1.uMm).toBe(50);
        expect(uv1.vMm).toBe(40);

        // 2. Kotwica U do krawędzi prawej (FACE_X_PLUS), V do krawędzi dolnej (FACE_Y_MINUS)
        const pos2 = computeHandleCenterFromUV(60, 50, 'FACE_X_PLUS', 'FACE_Y_MINUS', panelW, panelH);
        expect(pos2.x).toBe(240);  // 300 - 60
        expect(pos2.y).toBe(-130); // -180 + 50

        const uv2 = computeUVFromCenter(pos2.x, pos2.y, 'FACE_X_PLUS', 'FACE_Y_MINUS', panelW, panelH);
        expect(uv2.uMm).toBe(60);
        expect(uv2.vMm).toBe(50);
    });

    it('rebindHandleEdge zachowuje niezmienne fizyczne położenie elementu przy zmianie krawędzi odniesienia', () => {
        const panelW = 600;
        const panelH = 360;

        // Początkowo 50 mm od lewej krawędzi -> X = -250 mm
        const origDistU = 50;
        const origX = computeHandleCenterFromUV(origDistU, 0, 'FACE_X_MINUS', 'FACE_Y_PLUS', panelW, panelH).x;
        expect(origX).toBe(-250);

        // Przełączenie kotwicy na krawędź prawą (FACE_X_PLUS)
        const newDistU = rebindHandleEdge('FACE_X_MINUS', 'FACE_X_PLUS', origDistU, panelW);
        expect(newDistU).toBe(550); // 600 - 50 = 550 mm

        // Sprawdzamy czy pozycja X w przestrzeni formatki nie drgnęła
        const newX = computeHandleCenterFromUV(newDistU, 0, 'FACE_X_PLUS', 'FACE_Y_PLUS', panelW, panelH).x;
        expect(newX).toBe(-250);
        expect(newX).toBe(origX);

        // Identycznie dla osi V (góra -> dół)
        const origDistV = 40;
        const origY = computeHandleCenterFromUV(0, origDistV, 'FACE_X_MINUS', 'FACE_Y_PLUS', panelW, panelH).y;
        expect(origY).toBe(140); // 180 - 40 = 140 mm

        const newDistV = rebindHandleEdge('FACE_Y_PLUS', 'FACE_Y_MINUS', origDistV, panelH);
        expect(newDistV).toBe(320); // 360 - 40 = 320 mm

        const newY = computeHandleCenterFromUV(0, newDistV, 'FACE_X_MINUS', 'FACE_Y_MINUS', panelW, panelH).y;
        expect(newY).toBe(140);
        expect(newY).toBe(origY);
    });

    it('createSmartPartHandle inicjalizuje jawne parametry UV i kotwice w generatorParams', () => {
        const doc = new ProjectDocument();
        const frontPanel = new PanelModel({
            name: 'Front_UV',
            width: mmToNm(600),
            height: mmToNm(360),
            thickness: mmToNm(18),
        });
        const frontNode = CADNode.create(NodeType.PART, frontPanel.name, frontPanel.id);
        frontNode.domainData = frontPanel;
        doc.addNode(doc.rootNode.id, frontNode);

        // Uchwyt HORIZONTAL, holeDistanceMm=160 (domyślnie z DEFAULT_HANDLE_PARAMS)
        // offsetEdgeXMm=120 → środek X = -300 + 120 = -180 mm od centrum formatki
        // Lewy otw: -180 - 80 = -260 → uMm (od lewej krawędzi) = -260 + 300 = 40 mm ✓
        // offsetEdgeYMm=35  → środek Y = 180 - 35 = 145 mm (vEdge=FACE_Y_PLUS)
        //                     vMm (do środka, oś poprzeczna) = 180 - 145 = 35 mm ✓
        const handleNode = createSmartPartHandle(doc, frontNode, {
            placementPreset: 'TOP_LEFT',
            offsetEdgeXMm: 120,
            offsetEdgeYMm: 35,
        })!;

        const gp = handleNode.domainData.generatorParams;
        expect(gp.face).toBe('FACE_Z_MINUS'); // domyślne lico z normalZ = -1
        expect(gp.uEdge).toBe('FACE_X_MINUS');
        expect(gp.vEdge).toBe('FACE_Y_PLUS');
        expect(typeof gp.uMm).toBe('number');
        expect(typeof gp.vMm).toBe('number');
        // uMm = odległość od lewej krawędzi do LEWEGO OTWORU = 40 mm
        expect(gp.uMm).toBe(40);
        // vMm = odległość od górnej krawędzi do ŚRODKA (oś poprzeczna) = 35 mm
        expect(gp.vMm).toBe(35);
    });

    it('rebindHandleEdge zachowuje tożsamą pozycję uchwytu w przestrzeni przy zmianie krawędzi', () => {
        const panelW = 600;
        const panelH = 360;
        const holeDist = 160;

        // 1. Zaczynamy z krawędzią LEWĄ (FACE_X_MINUS) i uMm = 40 mm
        const leftEdge = 'FACE_X_MINUS';
        const uMmLeft = 40;
        const centerLeft = computeHandleCenterFromUV(uMmLeft, 35, leftEdge, 'FACE_Y_PLUS', panelW, panelH, 'HORIZONTAL', holeDist);

        // 2. Przepięcie na krawędź PRAWĄ (FACE_X_PLUS)
        const rightEdge = 'FACE_X_PLUS';
        const uMmRight = rebindHandleEdge(leftEdge, rightEdge, uMmLeft, panelW, holeDist);
        expect(uMmRight).toBe(400); // 600 - 40 - 160 = 400 mm

        const centerRight = computeHandleCenterFromUV(uMmRight, 35, rightEdge, 'FACE_Y_PLUS', panelW, panelH, 'HORIZONTAL', holeDist);

        // Fizyczne położenie uchwytu (środek X, Y) musi być identyczne!
        expect(centerRight.x).toBeCloseTo(centerLeft.x, 3);
        expect(centerRight.y).toBeCloseTo(centerLeft.y, 3);

        // 3. Przepięcie powrotne PRAWA -> LEWA
        const uMmBackLeft = rebindHandleEdge(rightEdge, leftEdge, uMmRight, panelW, holeDist);
        expect(uMmBackLeft).toBe(40);

        const centerBackLeft = computeHandleCenterFromUV(uMmBackLeft, 35, leftEdge, 'FACE_Y_PLUS', panelW, panelH, 'HORIZONTAL', holeDist);
        expect(centerBackLeft.x).toBeCloseTo(centerLeft.x, 3);
    });
});

