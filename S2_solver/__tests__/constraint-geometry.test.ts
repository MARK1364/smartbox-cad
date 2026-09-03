/**
 * Testy rozwiązywania kotwic na geometrię lokalną.
 *
 * Uruchom: npx vitest run S2_solver  (z katalogu web/)
 *
 * Pilnują dwóch różnych konwencji bryły lokalnej: panel jest wyśrodkowany we
 * wszystkich osiach, a kontener stoi dolną płaszczyzną na Z = 0.
 */

import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import {
    faceAnchorLabel,
    getLocalBoxMm,
    mapLocalMmToNode,
    namedFaceFromPick,
    nearestSmartFrameFace,
    resolveAnchor,
    resolveAnchorQuadMm,
    resolveCornerLocalMm,
    resolveFaceLocalMm,
    snapPickToSmartFrame,
} from '../constraint-geometry.js';
import { makeAnchor } from '../constraint-types.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';

function docWithPanel() {
    const document = new ProjectDocument();
    const panel = document.createPanel({
        width: mmToNm(600),
        height: mmToNm(400),
        thickness: mmToNm(18),
    });
    return { document, node: document.findNode(panel.id)! };
}

function docWithContainer() {
    const document = new ProjectDocument();
    const container = document.createContainer({
        width: mmToNm(600),
        height: mmToNm(720),
        depth: mmToNm(500),
    });
    return { document, node: document.findNode(container.id)! };
}

describe('Bryła lokalna', () => {
    it('panel jest wyśrodkowany we wszystkich osiach (Y = grubość, Z = wysokość)', () => {
        const { node } = docWithPanel();
        expect(getLocalBoxMm(node)).toEqual({
            min: [-300, -9, -200],
            max: [300, 9, 200],
        });
    });

    it('kontener stoi dolną płaszczyzną na Z = 0', () => {
        const { node } = docWithContainer();
        expect(getLocalBoxMm(node)).toEqual({
            min: [-300, -250, 0],
            max: [300, 250, 720],
        });
    });

    it('węzeł bez danych domenowych nie ma bryły', () => {
        const document = new ProjectDocument();
        expect(getLocalBoxMm(document.rootNode)).toBeNull();
        expect(getLocalBoxMm(null)).toBeNull();
    });
});

describe('Narożniki', () => {
    it('numeracja bitowa: 0 to minimum, 7 to maksimum', () => {
        const { node } = docWithPanel();
        expect(resolveCornerLocalMm(node, 0)).toEqual([-300, -9, -200]);
        expect(resolveCornerLocalMm(node, 7)).toEqual([300, 9, 200]);
    });

    it('bit 0 przełącza X, bit 1 Y, bit 2 Z', () => {
        const { node } = docWithPanel();
        expect(resolveCornerLocalMm(node, 1)).toEqual([300, -9, -200]);
        expect(resolveCornerLocalMm(node, 2)).toEqual([-300, 9, -200]);
        expect(resolveCornerLocalMm(node, 4)).toEqual([-300, -9, 200]);
    });

    it('odrzuca indeks poza zakresem', () => {
        const { node } = docWithPanel();
        expect(resolveCornerLocalMm(node, -1)).toBeNull();
        expect(resolveCornerLocalMm(node, 8)).toBeNull();
    });
});

describe('Ściany', () => {
    it('środek i normalna ściany panelu', () => {
        const { node } = docWithPanel();
        expect(resolveFaceLocalMm(node, 'FACE_Z_PLUS')).toEqual([
            [0, 9, 0],
            [0, 1, 0],
        ]);
        expect(resolveFaceLocalMm(node, 'FACE_X_MINUS')).toEqual([
            [-300, 0, 0],
            [-1, 0, 0],
        ]);
        expect(resolveFaceLocalMm(node, 'FACE_Y_PLUS')).toEqual([
            [0, 0, 200],
            [0, 0, 1],
        ]);
    });

    it('dolna ściana kontenera leży na Z = 0', () => {
        const { node } = docWithContainer();
        expect(resolveFaceLocalMm(node, 'FACE_Z_MINUS')).toEqual([
            [0, 0, 0],
            [0, 0, -1],
        ]);
        expect(resolveFaceLocalMm(node, 'FACE_Z_PLUS')).toEqual([
            [0, 0, 720],
            [0, 0, 1],
        ]);
    });

    it('akceptuje aliasy nazw ścian tak jak reszta aplikacji', () => {
        const { node } = docWithPanel();
        // Aliasy są panelowe: front = FACE_Z_PLUS = CAD +Y (grubość),
        // top = FACE_Y_PLUS = CAD +Z (wysokość).
        expect(resolveFaceLocalMm(node, 'front')).toEqual(resolveFaceLocalMm(node, 'FACE_Z_PLUS'));
        expect(resolveFaceLocalMm(node, 'top')).toEqual(resolveFaceLocalMm(node, 'FACE_Y_PLUS'));
    });

    it('odrzuca nieznaną nazwę ściany', () => {
        const { node } = docWithPanel();
        expect(resolveFaceLocalMm(node, 'FACE_W_PLUS')).toBeNull();
    });
});

describe('resolveAnchor', () => {
    it('kotwica OBJECT wskazuje początek układu lokalnego', () => {
        const { node } = docWithPanel();
        expect(resolveAnchor(node, makeAnchor({ nodeId: node.id, kind: 'OBJECT' }))).toEqual({
            localPointMm: [0, 0, 0],
            localNormal: null,
        });
    });

    it('kotwica VERTEX nie ma normalnej', () => {
        const { node } = docWithPanel();
        const resolved = resolveAnchor(
            node,
            makeAnchor({ nodeId: node.id, kind: 'VERTEX', cornerIndex: 7 }),
        );
        expect(resolved).toEqual({ localPointMm: [300, 9, 200], localNormal: null });
    });

    it('kotwica FACE ma normalną', () => {
        const { node } = docWithPanel();
        const resolved = resolveAnchor(
            node,
            makeAnchor({ nodeId: node.id, kind: 'FACE', faceName: 'FACE_Y_PLUS' }),
        );
        expect(resolved).toEqual({ localPointMm: [0, 0, 200], localNormal: [0, 0, 1] });
    });

    it('FACE bez normalnej z picka używa ściany z faceName', () => {
        const { node } = docWithContainer();
        const resolved = resolveAnchor(
            node,
            makeAnchor({
                nodeId: node.id,
                kind: 'FACE',
                faceName: 'FACE_Z_PLUS',
                localPointMm: [12, 34, 56],
            }),
        );
        expect(resolved).toEqual({
            localPointMm: [0, 0, 720],
            localNormal: [0, 0, 1],
        });
    });

    it('kotwica FACE na formatce używa ściany panelu (front = +Z), nie AABB korpusu', () => {
        const document = new ProjectDocument();
        const container = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const panel = document.createPanel(
            { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) },
            container.id,
        );
        const node = document.findNode(panel.id)!;
        expect(resolveAnchor(node, makeAnchor({ nodeId: node.id, kind: 'FACE', faceName: 'front' }))).toEqual({
            localPointMm: [0, 9, 0],
            localNormal: [0, 1, 0],
        });
        expect(resolveAnchor(node, makeAnchor({ nodeId: node.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }))).toEqual({
            localPointMm: [0, 9, 0],
            localNormal: [0, 1, 0],
        });
    });

    it('utracona formatka nie degraduje kotwicy do ściany korpusu', () => {
        const document = new ProjectDocument();
        const container = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const cab = document.findNode(container.id)!;
        const panel = document.createPanel(
            { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) },
            container.id,
        );
        const panelNode = document.findNode(panel.id)!;
        // Front korpusu: formatka obrócona o 90° wokół X, normalna świata −Y.
        panelNode.setLocalTransform(
            new Vec3(0, mmToNm(-241), mmToNm(360)),
            Quat.fromEulerXYZ(Math.PI / 2, 0, 0),
        );

        const anchor = makeAnchor({
            nodeId: cab.id,
            kind: 'FACE',
            faceName: 'FACE_Z_PLUS',
            sourceNodeId: panelNode.id,
            localPointMm: [0, -250, 360],
            localNormalMm: [0, -1, 0],
        });

        expect(resolveAnchor(cab, anchor, panelNode)?.localNormal?.[1]).toBeCloseTo(-1);

        // SmartFrame zregenerował formatkę pod nowym ID.
        document.removeNode(panelNode.id);
        const stale = resolveAnchor(cab, anchor, null);
        expect(stale?.localNormal).toEqual([0, -1, 0]);
        expect(stale?.localPointMm).toEqual([0, -250, 360]);
    });

    it('bez snapshotu utracona formatka daje null, nie zgadywaną ścianę', () => {
        const { document, node } = docWithContainer();
        const anchor = makeAnchor({
            nodeId: node.id,
            kind: 'FACE',
            faceName: 'FACE_Z_PLUS',
            sourceNodeId: 'panel_ktorego_nie_ma',
        });
        expect(resolveAnchor(node, anchor, null)).toBeNull();
        expect(document.findNode('panel_ktorego_nie_ma')).toBeNull();
    });

    it('żywa formatka odświeża płaszczyznę snapshotu w LCS korpusu', () => {
        const { document, node } = docWithContainer();
        const panel = document.createPanel(
            { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) },
            node.id,
        );
        const panelNode = document.findNode(panel.id)!;
        const snapshot = makeAnchor({
            nodeId: node.id,
            kind: 'FACE',
            faceName: 'FACE_Z_PLUS',
            sourceNodeId: panelNode.id,
            localPointMm: [12, -250, 40],
            localNormalMm: [0, 1, 0],
        });
        const resolved = resolveAnchor(node, snapshot, panelNode);
        expect(resolved?.localPointMm).toEqual([12, 9, 40]);
        expect(resolved?.localNormal).toEqual([0, 1, 0]);
    });

    it('kotwica FACE automatycznie podąża za zmianą wymiarów formatki', () => {
        const { node } = docWithPanel();
        const panel = node.domainData as any;
        const anchor = makeAnchor({
            nodeId: node.id,
            kind: 'FACE',
            faceName: 'FACE_Z_PLUS',
            localPointMm: [120, 9, 80],
            localNormalMm: [0, 1, 0],
        });

        expect(resolveAnchor(node, anchor)?.localPointMm).toEqual([120, 9, 80]);

        panel.setDimensions(mmToNm(800), mmToNm(500), mmToNm(38));

        const refreshed = resolveAnchor(node, anchor);
        expect(refreshed?.localPointMm).toEqual([120, 19, 80]);
        expect(refreshed?.localNormal).toEqual([0, 1, 0]);
    });

    it('prostokąt zapisany w kotwicy jest używany bez odtwarzania z AABB', () => {
        const { node } = docWithContainer();
        const quad = resolveAnchorQuadMm(
            node,
            makeAnchor({
                nodeId: node.id,
                kind: 'FACE',
                faceName: 'FACE_Y_MINUS',
                localPointMm: [10, -240, 100],
                localNormalMm: [0, -1, 0],
                localUAxisMm: [1, 0, 0],
                localVAxisMm: [0, 0, 1],
                quadWidthMm: 123,
                quadHeightMm: 456,
            }),
        )!;
        expect(quad.normal).toEqual([0, -1, 0]);
        expect(quad.width).toBe(123);
        expect(quad.height).toBe(456);
        // Środek podglądu jest rzutowany na aktualną płaszczyznę bryły.
        expect(quad.center[0]).toBeCloseTo(0);
        expect(quad.center[1]).toBeCloseTo(-250);
        expect(quad.center[2]).toBeCloseTo(360);
    });

    it('pusta nazwa ściany nie staje się cicho górną ścianą', () => {
        const { node } = docWithContainer();
        expect(resolveFaceLocalMm(node, '')).toBeNull();
        expect(resolveFaceLocalMm(node, '   ')).toBeNull();
    });

    it('zwraca null dla nieaktualnej kotwicy', () => {
        const { node } = docWithPanel();
        expect(
            resolveAnchor(node, makeAnchor({ nodeId: node.id, kind: 'VERTEX', cornerIndex: 99 })),
        ).toBeNull();
        expect(resolveAnchor(null, makeAnchor({ nodeId: 'x', kind: 'OBJECT' }))).toBeNull();
    });
});

describe('Snap do bryły węzła', () => {
    it('przednia krawędź korpusu + widok z przodu → ściana PRZÓD, nie tył', () => {
        const { node } = docWithContainer();
        const box = getLocalBoxMm(node)!;
        // Krawędź: lewy-przód (Y− i X−), kamera patrzy w głąb (+Y).
        const point: [number, number, number] = [box.min[0], box.min[1], 360];
        const viewDirCad: [number, number, number] = [0, 1, 0];
        expect(nearestSmartFrameFace(box, point, viewDirCad)).toBe('FACE_Y_MINUS');
    });

    it('snap FACE na korpusie zapisuje kanoniczną ścianę korpusu', () => {
        const { node } = docWithContainer();
        const snapped = snapPickToSmartFrame(node, 'FACE', [-300, -250, 360], [0, 1, 0]);
        expect(snapped?.faceName).toBe('FACE_Y_MINUS');
        expect(snapped?.localNormalMm).toEqual([0, -1, 0]);
    });

    it('normalna trafionej powierzchni bije kierunek kamery', () => {
        const { node } = docWithContainer();
        // Klik w dolną krawędź przednią: dno i przód remisują na odległość,
        // a kamera patrzy w głąb, więc heurystyka wybrałaby przód.
        const edgePoint: [number, number, number] = [0, -250, 0];
        const viewDirCad: [number, number, number] = [0, 1, 0];
        expect(snapPickToSmartFrame(node, 'FACE', edgePoint, viewDirCad)?.faceName).toBe('FACE_Y_MINUS');

        const withNormal = snapPickToSmartFrame(node, 'FACE', edgePoint, viewDirCad, [0, 0, -1]);
        expect(withNormal?.faceName).toBe('FACE_Z_MINUS');
        expect(withNormal?.localNormalMm).toEqual([0, 0, -1]);
        expect(withNormal?.localPointMm).toEqual([0, 0, 0]);
    });

    it('zdegenerowana normalna wraca do heurystyki odległości', () => {
        const { node } = docWithContainer();
        const snapped = snapPickToSmartFrame(node, 'FACE', [0, -250, 360], [0, 1, 0], [0, 0, 0]);
        expect(snapped?.faceName).toBe('FACE_Y_MINUS');
    });

    it('snap krawędzi formatki zostaje na formatce (front = CAD +Y, nazwa FACE_Z_PLUS)', () => {
        const { node } = docWithPanel();
        const snapped = snapPickToSmartFrame(node, 'FACE', [0, 9, 0], [0, -1, 0], [0, 1, 0]);
        expect(snapped?.faceName).toBe('FACE_Z_PLUS');
        expect(snapped?.localNormalMm).toEqual([0, 1, 0]);
        expect(snapped?.localPointMm).toEqual([0, 9, 0]);
    });
});

describe('Mapowanie ściany formatki do LCS korpusu', () => {
    it('przesunięta formatka: front panelu ląduje w LCS korpusu, nie na AABB korpusu', () => {
        const document = new ProjectDocument();
        const container = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const panel = document.createPanel(
            { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) },
            container.id,
        );
        const cab = document.findNode(container.id)!;
        const panelNode = document.findNode(panel.id)!;
        panelNode.setLocalTransform(new Vec3(mmToNm(100), mmToNm(40), mmToNm(200)), Quat.IDENTITY);

        const mapped = mapLocalMmToNode(panelNode, cab, [0, 9, 0], [0, 1, 0]);
        expect(mapped.localPointMm[0]).toBeCloseTo(100);
        expect(mapped.localPointMm[1]).toBeCloseTo(49);
        expect(mapped.localPointMm[2]).toBeCloseTo(200);
        expect(mapped.localNormalMm).toEqual([0, 1, 0]);

        const resolved = resolveAnchor(
            cab,
            makeAnchor({
                nodeId: cab.id,
                kind: 'FACE',
                faceName: 'front',
                sourceNodeId: panelNode.id,
            }),
            panelNode,
        );
        expect(resolved?.localPointMm[0]).toBeCloseTo(100);
        expect(resolved?.localPointMm[1]).toBeCloseTo(49);
        expect(resolved?.localNormal).toEqual([0, 1, 0]);
    });
});

describe('Prostokąt podglądu = geometria solvera', () => {
    function cabinetWithFront() {
        const document = new ProjectDocument();
        const container = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const cab = document.findNode(container.id)!;
        const panel = document.createPanel(
            { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) },
            container.id,
        );
        const panelNode = document.findNode(panel.id)!;
        panelNode.setLocalTransform(new Vec3(0, mmToNm(-241), mmToNm(360)), Quat.IDENTITY);
        return { document, cab, panelNode };
    }

    it('normalna prostokąta jest tą samą normalną, którą dostaje solver', () => {
        const { cab, panelNode } = cabinetWithFront();
        const anchor = makeAnchor({
            nodeId: cab.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
            sourceNodeId: panelNode.id,
        });
        const resolved = resolveAnchor(cab, anchor, panelNode)!;
        const quad = resolveAnchorQuadMm(cab, anchor, panelNode)!;

        expect(quad.normal[0]).toBeCloseTo(resolved.localNormal![0]);
        expect(quad.normal[1]).toBeCloseTo(resolved.localNormal![1]);
        expect(quad.normal[2]).toBeCloseTo(resolved.localNormal![2]);
        expect(quad.center).toEqual(resolved.localPointMm);
        // Front korpusu (Y−), nie góra.
        expect(quad.normal[1]).toBeCloseTo(-1);
    });

    it('podgląd jest wyśrodkowany na klikniętej ścianie, nie na punkcie picka', () => {
        const { cab, panelNode } = cabinetWithFront();
        const face = resolveFaceLocalMm(panelNode, 'FACE_Z_MINUS')!;
        const mapped = mapLocalMmToNode(panelNode, cab, face[0]);
        const pick: [number, number, number] = [12, -250, 40];
        const quad = resolveAnchorQuadMm(
            cab,
            makeAnchor({
                nodeId: cab.id,
                kind: 'FACE',
                faceName: 'FACE_Z_MINUS',
                sourceNodeId: panelNode.id,
                localPointMm: pick,
                localNormalMm: [0, -1, 0],
                localUAxisMm: [1, 0, 0],
                localVAxisMm: [0, 0, 1],
                quadWidthMm: 600,
                quadHeightMm: 720,
            }),
            panelNode,
        )!;

        expect(quad.center[0]).toBeCloseTo(mapped.localPointMm[0], 5);
        expect(quad.center[1]).toBeCloseTo(pick[1], 5);
        expect(quad.center[2]).toBeCloseTo(mapped.localPointMm[2], 5);
        expect(quad.center[0]).not.toBeCloseTo(pick[0], 0);
        expect(quad.center[2]).not.toBeCloseTo(pick[2], 0);
        expect(quad.width).toBe(600);
        expect(quad.height).toBe(720);
    });

    it('osie styczne są prostopadłe do normalnej i do siebie', () => {
        const { cab, panelNode } = cabinetWithFront();
        const quad = resolveAnchorQuadMm(
            cab,
            makeAnchor({
                nodeId: cab.id,
                kind: 'FACE',
                faceName: 'FACE_Z_MINUS',
                sourceNodeId: panelNode.id,
            }),
            panelNode,
        )!;
        const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        expect(dot(quad.uAxis, quad.normal)).toBeCloseTo(0);
        expect(dot(quad.vAxis, quad.normal)).toBeCloseTo(0);
        expect(dot(quad.uAxis, quad.vAxis)).toBeCloseTo(0);
        expect(quad.width).toBeCloseTo(600);
        expect(quad.height).toBeCloseTo(720);
    });

    it('kotwica na samej bryle daje prostokąt bryły', () => {
        const { node } = docWithContainer();
        const quad = resolveAnchorQuadMm(
            node,
            makeAnchor({ nodeId: node.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
        )!;
        expect(quad.normal).toEqual([0, -1, 0]);
        expect(quad.center).toEqual([0, -250, 360]);
        expect(Math.max(quad.width, quad.height)).toBeCloseTo(720);
        expect(Math.min(quad.width, quad.height)).toBeCloseTo(600);
    });
});

describe('Etykiety ścian', () => {
    it('FACE_Z_PLUS na formatce to front, na korpusie to góra — z osią ±', () => {
        expect(faceAnchorLabel('FACE_Z_PLUS', NodeType.PART)).toBe('front (+Z)');
        expect(faceAnchorLabel('FACE_Z_PLUS', NodeType.ASSEMBLY)).toBe('góra (+Z)');
        expect(faceAnchorLabel('FACE_Y_MINUS', NodeType.ASSEMBLY)).toBe('przód (-Y)');
        expect(faceAnchorLabel('front', NodeType.PART)).toBe('front (+Z)');
        expect(faceAnchorLabel('back', NodeType.PART)).toBe('tył (-Z)');
        expect(faceAnchorLabel('FACE_X_PLUS', NodeType.ASSEMBLY)).toBe('prawy (+X)');
        expect(faceAnchorLabel('FACE_X_MINUS', NodeType.PART)).toBe('lewy (-X)');
    });
});

describe('Dosuń ściany — OUTER vs odwrócona normalna mesha', () => {
    function cabinetWithLeftSide() {
        const document = new ProjectDocument();
        const container = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const cab = document.findNode(container.id)!;
        const panel = document.createPanel(
            { width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18) },
            container.id,
        );
        const side = document.findNode(panel.id)!;
        // Boczek L: Rz(−90), OUTER = FACE_Z_MINUS → świat −X.
        side.setLocalTransform(
            new Vec3(mmToNm(-300 + 9), 0, mmToNm(360)),
            Quat.fromEulerXYZ(0, 0, -Math.PI / 2),
        );
        return { document, cab, side };
    }

    it('namedFaceFromPick: back/OUTER to CAD −Y grubości, nie INNER', () => {
        const { node } = docWithPanel();
        const outer = namedFaceFromPick(node, 'back', [10, 0, 20])!;
        const inner = namedFaceFromPick(node, 'front', [10, 0, 20])!;
        expect(outer.localNormalMm).toEqual([0, -1, 0]);
        expect(outer.localPointMm[1]).toBeCloseTo(-9);
        expect(inner.localNormalMm).toEqual([0, 1, 0]);
        expect(inner.localPointMm[1]).toBeCloseTo(9);
    });

    it('odwrócona normalna getNormal() nie przenosi kotwicy na INNER', () => {
        const { cab, side } = cabinetWithLeftSide();
        const outer = resolveFaceLocalMm(side, 'FACE_Z_MINUS')!;
        const inverted: [number, number, number] = [-outer[1][0], -outer[1][1], -outer[1][2]];
        const mapped = mapLocalMmToNode(side, cab, outer[0], inverted);

        const resolved = resolveAnchor(
            cab,
            makeAnchor({
                nodeId: cab.id,
                kind: 'FACE',
                faceName: 'FACE_Z_MINUS',
                sourceNodeId: side.id,
                localPointMm: mapped.localPointMm,
                localNormalMm: mapped.localNormalMm ?? undefined,
            }),
            side,
        )!;

        expect(resolved.localNormal![0]).toBeCloseTo(-1);
        expect(resolved.localPointMm[0]).toBeCloseTo(-300);
        expect(resolved.localPointMm[0]).not.toBeCloseTo(-282, 0);
    });

    it('podgląd FLUSH siada na OUTER boczka, nie na INNER', () => {
        const { cab, side } = cabinetWithLeftSide();
        const outer = resolveFaceLocalMm(side, 'FACE_Z_MINUS')!;
        const inverted: [number, number, number] = [-outer[1][0], -outer[1][1], -outer[1][2]];
        const mapped = mapLocalMmToNode(side, cab, outer[0], inverted);

        const quad = resolveAnchorQuadMm(
            cab,
            makeAnchor({
                nodeId: cab.id,
                kind: 'FACE',
                faceName: 'FACE_Z_MINUS',
                sourceNodeId: side.id,
                localPointMm: mapped.localPointMm,
                localNormalMm: mapped.localNormalMm ?? undefined,
            }),
            side,
        )!;

        expect(quad.normal[0]).toBeCloseTo(-1);
        expect(quad.center[0]).toBeCloseTo(-300);
    });
});
