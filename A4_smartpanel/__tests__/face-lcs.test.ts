import { describe, expect, it } from 'vitest';
import { calcFaceUFromBack, calcFaceUFromFront, calcFaceVFromFront, computeFaceData, localTo3D, local3DToFaceUV, point3DToFaceUV } from '../native_core/face-lcs.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../panel-model.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';

describe('face-lcs — calcFaceUFromFront', () => {
    const widthMm = 560;
    const heightMm = 720;
    const thicknessMm = 18;
    const frontDistMm = 37;

    it('calculates correct U for left side panel (rot -90 deg)', () => {
        const leftPanel = new PanelModel({
            name: 'Bok Lewy',
            width: mmToNm(widthMm),
            height: mmToNm(heightMm),
            thickness: mmToNm(thicknessMm)
        });
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        // Rotacja lewego boku w szafce: [0, 0, -90 deg]
        leftNode.setLocalTransform(new Vec3(0, 0, 0), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));

        // Ściana wewnętrzna lewego boku (FACE_Z_PLUS):
        // U=0 jest z tyłu, U=560 z przodu -> 37 mm od przodu to U = 523
        const uInner = calcFaceUFromFront(leftNode, 'FACE_Z_PLUS', widthMm, frontDistMm, 'left');
        expect(uInner).toBe(523);

        // Ściana zewnętrzna lewego boku (FACE_Z_MINUS):
        // U=0 jest z przodu, U=560 z tyłu -> 37 mm od przodu to U = 37
        const uOuter = calcFaceUFromFront(leftNode, 'FACE_Z_MINUS', widthMm, frontDistMm, 'left');
        expect(uOuter).toBe(37);
    });

    it('calculates correct U for right side panel (rot +90 deg)', () => {
        const rightPanel = new PanelModel({
            name: 'Bok Prawy',
            width: mmToNm(widthMm),
            height: mmToNm(heightMm),
            thickness: mmToNm(thicknessMm)
        });
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        // Rotacja prawego boku w szafce: [0, 0, +90 deg]
        rightNode.setLocalTransform(new Vec3(0, 0, 0), Quat.fromEulerXYZ(0, 0, Math.PI / 2));

        // Ściana wewnętrzna prawego boku (FACE_Z_PLUS):
        // U=0 jest z przodu, U=560 z tyłu -> 37 mm od przodu to U = 37
        const uInner = calcFaceUFromFront(rightNode, 'FACE_Z_PLUS', widthMm, frontDistMm, 'right');
        expect(uInner).toBe(37);

        // Ściana zewnętrzna prawego boku (FACE_Z_MINUS):
        // U=0 jest z tyłu, U=560 z przodu -> 37 mm od przodu to U = 523
        const uOuter = calcFaceUFromFront(rightNode, 'FACE_Z_MINUS', widthMm, frontDistMm, 'right');
        expect(uOuter).toBe(523);
    });

    it('calcFaceUFromBack correctly calculates U from back edge for left and right panels', () => {
        const leftPanel = new PanelModel({
            name: 'Bok Lewy',
            width: mmToNm(widthMm),
            height: mmToNm(heightMm),
            thickness: mmToNm(thicknessMm)
        });
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(0, 0, 0), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));

        const rightPanel = new PanelModel({
            name: 'Bok Prawy',
            width: mmToNm(widthMm),
            height: mmToNm(heightMm),
            thickness: mmToNm(thicknessMm)
        });
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(0, 0, 0), Quat.fromEulerXYZ(0, 0, Math.PI / 2));

        const backDistMm = 50;

        // Bok lewy (FACE_Z_PLUS): U=0 jest z tyłu, U=560 z przodu
        // 50 mm od tyłu to U = 50
        const uLeftBack = calcFaceUFromBack(leftNode, 'FACE_Z_PLUS', widthMm, backDistMm, 'left');
        expect(uLeftBack).toBe(50);

        // Bok prawy (FACE_Z_PLUS): U=0 jest z przodu, U=560 z tyłu
        // 50 mm od tyłu to U = 560 - 50 = 510
        const uRightBack = calcFaceUFromBack(rightNode, 'FACE_Z_PLUS', widthMm, backDistMm, 'right');
        expect(uRightBack).toBe(510);
    });


    it('produces identical 3D world Y coordinate for left and right side panels', () => {
        // Obliczamy współrzędne 3D dla lewego i prawego boku
        const leftPanel = new PanelModel({
            name: 'Bok Lewy',
            width: mmToNm(widthMm),
            height: mmToNm(heightMm),
            thickness: mmToNm(thicknessMm)
        });
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-291), 0, 0), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));

        const rightPanel = new PanelModel({
            name: 'Bok Prawy',
            width: mmToNm(widthMm),
            height: mmToNm(heightMm),
            thickness: mmToNm(thicknessMm)
        });
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(291), 0, 0), Quat.fromEulerXYZ(0, 0, Math.PI / 2));

        const uLeft = calcFaceUFromFront(leftNode, 'FACE_Z_PLUS', widthMm, frontDistMm, 'left');
        const uRight = calcFaceUFromFront(rightNode, 'FACE_Z_PLUS', widthMm, frontDistMm, 'right');

        // Zamiana na 3D w układzie płyty
        const fdL = computeFaceData('FACE_Z_PLUS', widthMm, heightMm, thicknessMm);
        const pt3dL = localTo3D(fdL, uLeft, 200);
        const worldPtL = leftNode.localMatrix.transformPoint(new Vec3(mmToNm(pt3dL[0]), mmToNm(pt3dL[1]), mmToNm(pt3dL[2])));

        const fdR = computeFaceData('FACE_Z_PLUS', widthMm, heightMm, thicknessMm);
        const pt3dR = localTo3D(fdR, uRight, 200);
        const worldPtR = rightNode.localMatrix.transformPoint(new Vec3(mmToNm(pt3dR[0]), mmToNm(pt3dR[1]), mmToNm(pt3dR[2])));

        // W układzie korpusu szafki: przód to -280 mm, tył to +280 mm
        // Obie pozycje muszą wynosić dokładnie -243 mm (-280 + 37)
        expect(nmToMm(worldPtL.y)).toBeCloseTo(-243, 1);
        expect(nmToMm(worldPtR.y)).toBeCloseTo(-243, 1);
    });

    it('falls back safely when targetNode is null or lacks localMatrix', () => {
        expect(calcFaceUFromFront(null, 'FACE_Z_PLUS', widthMm, frontDistMm, 'left')).toBe(523);
        expect(calcFaceUFromFront(null, 'FACE_Z_PLUS', widthMm, frontDistMm, 'right')).toBe(37);
    });

    describe('wieniec horizontal panels (local3DToFaceUV, point3DToFaceUV, calcFaceVFromFront)', () => {
        const wieniecW = 600;
        const wieniecD = 500;
        const wieniecT = 18;

        it('inverts localTo3D via local3DToFaceUV exactly', () => {
            const fd = computeFaceData('FACE_Z_PLUS', wieniecW, wieniecD, wieniecT);
            const pt3d = localTo3D(fd, 80, 37);
            const uv = local3DToFaceUV(fd, pt3d as [number, number, number]);
            expect(uv.u).toBeCloseTo(80, 5);
            expect(uv.v).toBeCloseTo(37, 5);

            const fdMinus = computeFaceData('FACE_Z_MINUS', wieniecW, wieniecD, wieniecT);
            const pt3dMinus = localTo3D(fdMinus, 120, 50);
            const uvMinus = local3DToFaceUV(fdMinus, pt3dMinus as [number, number, number]);
            expect(uvMinus.u).toBeCloseTo(120, 5);
            expect(uvMinus.v).toBeCloseTo(50, 5);
        });

        it('projects world 3D hinge holes correctly onto bottom wieniec (FACE_Z_PLUS) and top wieniec (FACE_Z_MINUS)', () => {
            // Wieniec dolny: z = 0, brak obrotu, środek w (0, 0, 0)
            const bottomPanel = new PanelModel({
                name: 'Wieniec Dolny',
                width: mmToNm(wieniecW),
                height: mmToNm(wieniecD),
                thickness: mmToNm(wieniecT)
            });
            const bottomNode = CADNode.create(NodeType.PART, bottomPanel.name, bottomPanel.id);
            bottomNode.domainData = bottomPanel;
            bottomNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

            // Zawias lewy leży przy X = -220, Y = -250 + 37 = -213 (37 mm od frontu)
            // Zawias prawy leży przy X = +220, Y = -213
            const leftHoleWorld: [number, number, number] = [-220, -213, 18];
            const rightHoleWorld: [number, number, number] = [220, -213, 18];

            const uvBottomLeft = point3DToFaceUV(bottomNode, 'FACE_Z_PLUS', leftHoleWorld)!;
            const uvBottomRight = point3DToFaceUV(bottomNode, 'FACE_Z_PLUS', rightHoleWorld)!;

            // Na FACE_Z_PLUS: X=-300 to U=0, więc X=-220 -> U=80; X=+220 -> U=520
            expect(uvBottomLeft.u).toBeCloseTo(80, 1);
            expect(uvBottomLeft.v).toBeCloseTo(37, 1);
            expect(uvBottomRight.u).toBeCloseTo(520, 1);
            expect(uvBottomRight.v).toBeCloseTo(37, 1);

            // Wieniec górny: leży na z = 700, brak obrotu
            const topPanel = new PanelModel({
                name: 'Wieniec Górny',
                width: mmToNm(wieniecW),
                height: mmToNm(wieniecD),
                thickness: mmToNm(wieniecT)
            });
            const topNode = CADNode.create(NodeType.PART, topPanel.name, topPanel.id);
            topNode.domainData = topPanel;
            topNode.setLocalTransform(new Vec3(0, 0, mmToNm(700)), Quat.IDENTITY);

            // Na FACE_Z_MINUS (spód wieńca górnego):
            // Oś U biegnie od prawej do lewej (X=+300 to U=0).
            // Punkt lewy w świecie X=-220 odpowiada U = 300 - (-220) = 520!
            // Punkt prawy w świecie X=+220 odpowiada U = 300 - 220 = 80!
            // V odpowiada Y=-250 -> V=0, więc Y=-213 -> V=37.
            const uvTopLeft = point3DToFaceUV(topNode, 'FACE_Z_MINUS', [-220, -213, 700])!;
            const uvTopRight = point3DToFaceUV(topNode, 'FACE_Z_MINUS', [220, -213, 700])!;

            expect(uvTopLeft.u).toBeCloseTo(520, 1);
            expect(uvTopLeft.v).toBeCloseTo(37, 1);
            expect(uvTopRight.u).toBeCloseTo(80, 1);
            expect(uvTopRight.v).toBeCloseTo(37, 1);
        });

        it('projects correctly when wieniec is rotated by 180 degrees (Z-rot = PI)', () => {
            const rotPanel = new PanelModel({
                name: 'Wieniec Obrocony',
                width: mmToNm(wieniecW),
                height: mmToNm(wieniecD),
                thickness: mmToNm(wieniecT)
            });
            const rotNode = CADNode.create(NodeType.PART, rotPanel.name, rotPanel.id);
            rotNode.domainData = rotPanel;
            // Obrót o 180 deg wokół Z
            rotNode.setLocalTransform(new Vec3(0, 0, 0), Quat.fromEulerXYZ(0, 0, Math.PI));

            // Fizyczny punkt otworu przy froncie mebla: Y = -213 (37 mm od frontu -250), X = -220
            const uv = point3DToFaceUV(rotNode, 'FACE_Z_PLUS', [-220, -213, 0])!;
            // Ze względu na obrót o 180 deg, lokalna krawędź formatki będąca z przodu to teraz Y=+250 (V=500-37=463)
            expect(uv.v).toBeCloseTo(463, 1);
            // Wyznaczając współrzędną przez point3DToFaceUV, po wycięciu CNC i obróceniu formatki o 180 deg
            // otwór znajdzie się w dokładnie właściwym punkcie mebla!
        });

        it('calcFaceVFromFront correctly identifies front vs back edge based on orientation', () => {
            const nodeNormal = CADNode.create(NodeType.PART, 'Normal');
            nodeNormal.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
            // Bez obrotu: Y rośnie do tyłu, więc V=0 jest z przodu -> zwraca 37
            expect(calcFaceVFromFront(nodeNormal, 'FACE_Z_PLUS', wieniecD, 37)).toBe(37);

            const nodeRot180 = CADNode.create(NodeType.PART, 'Rot180');
            nodeRot180.setLocalTransform(new Vec3(0, 0, 0), Quat.fromEulerXYZ(0, 0, Math.PI));
            // Obrót o 180 deg: oś V biegnie w stronę przodu mebla -> zwraca 500 - 37 = 463
            expect(calcFaceVFromFront(nodeRot180, 'FACE_Z_PLUS', wieniecD, 37)).toBe(463);
        });
    });
});
