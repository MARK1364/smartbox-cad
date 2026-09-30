import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import {
    validateReferenceFaceOrientation,
    resolveManualReferenceFace,
    getPanelFaceDominantAxis,
    update_bloki_core,
} from '../bloki-core.js';

describe('Bloki Orientation & Parallelism Validation', () => {
    let doc: ProjectDocument;
    let cabinetNode: CADNode;
    let cabinet: ContainerModel;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        cabinet = doc.createAssembly({ name: 'Korpus_Rogowy90' }) as ContainerModel;
        cabinet.width = mmToNm(900);
        cabinet.height = mmToNm(720);
        cabinet.depth = mmToNm(900);
        cabinet.generatorParams = { type: 'korpus_rogowy1' };
        cabinetNode = doc.findNode(cabinet.id)!;
    });

    it('validates parallelism between xMin and xMax in standard X axis', () => {
        // Bok L (normalna w X): rotacja [90, 0, 90] stawia formatkę pionowo z grubością w X
        const rotSideX = Quat.fromEulerXYZ(0, Math.PI / 2, 0);
        const leftPanel = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        leftPanel.role = 'LEFT_SIDE_PANEL';
        const leftNode = CADNode.create(NodeType.PART, 'Bok_L', leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-441), 0, mmToNm(360)), rotSideX);
        doc.addNode(cabinet.id, leftNode);

        // Bok P (normalna w X)
        const rightPanel = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        rightPanel.role = 'RIGHT_SIDE_PANEL';
        const rightNode = CADNode.create(NodeType.PART, 'Bok_P', rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(441), 0, mmToNm(360)), rotSideX);
        doc.addNode(cabinet.id, rightNode);

        // Bok w osi Y (np. BOK_Y w ramieniu szafki narożnej) - normalna w Y: rotacja [90, 0, 0]
        const rotSideY = Quat.fromEulerXYZ(Math.PI / 2, 0, 0);
        const armYPanel = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        armYPanel.role = 'FRONT_PANEL';
        const armYNode = CADNode.create(NodeType.PART, 'Bok_Y', armYPanel.id);
        armYNode.domainData = armYPanel;
        armYNode.setLocalTransform(new Vec3(0, mmToNm(-441), mmToNm(360)), rotSideY);
        doc.addNode(cabinet.id, armYNode);

        // 1. Pierwszy wybór xMin: bok w osi X jest poprawny
        const val1 = validateReferenceFaceOrientation(leftPanel, leftNode, cabinetNode, 'FACE_Z_PLUS', 'xMin');
        expect(val1.valid).toBe(true);
        expect(val1.dominantAxis).toBe('x');

        const existingRefs = {
            xMin: { panelId: leftNode.id, face: 'FACE_Z_PLUS' }
        };

        // 2. Drugi wybór xMax: bok równoległy (Bok_P w osi X) jest poprawny
        const val2 = validateReferenceFaceOrientation(rightPanel, rightNode, cabinetNode, 'FACE_Z_MINUS', 'xMax', existingRefs);
        expect(val2.valid).toBe(true);
        expect(val2.dominantAxis).toBe('x');

        // 3. Drugi wybór xMax: próba wskazania boku w osi Y musi zostać ODRZUCONA (brak równoległości)
        const valInvalid = validateReferenceFaceOrientation(armYPanel, armYNode, cabinetNode, 'FACE_Z_MINUS', 'xMax', existingRefs);
        expect(valInvalid.valid).toBe(false);
        expect(valInvalid.errorMsg).toContain('Bok lewy i bok prawy muszą być do siebie równoległe');
    });

    it('allows rotated 90 deg shelves when xMin is picked in Y axis and enforces parallelism for xMax', () => {
        const rotSideY = Quat.fromEulerXYZ(Math.PI / 2, 0, 0);
        const rotSideX = Quat.fromEulerXYZ(0, Math.PI / 2, 0);

        // Bok w ramieniu Y narożnika (normalna w osi Y)
        const sideY1 = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        const nodeY1 = CADNode.create(NodeType.PART, 'Bok_Y1', sideY1.id);
        nodeY1.domainData = sideY1;
        nodeY1.setLocalTransform(new Vec3(0, mmToNm(-441), mmToNm(360)), rotSideY);
        doc.addNode(cabinet.id, nodeY1);

        // Przeciwległa ścianka w ramieniu Y (również w osi Y)
        const sideY2 = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        const nodeY2 = CADNode.create(NodeType.PART, 'Bok_Y2', sideY2.id);
        nodeY2.domainData = sideY2;
        nodeY2.setLocalTransform(new Vec3(0, mmToNm(-141), mmToNm(360)), rotSideY);
        doc.addNode(cabinet.id, nodeY2);

        // Ściana w osi X
        const sideX = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        const nodeX = CADNode.create(NodeType.PART, 'Bok_X', sideX.id);
        nodeX.domainData = sideX;
        nodeX.setLocalTransform(new Vec3(mmToNm(441), 0, mmToNm(360)), rotSideX);
        doc.addNode(cabinet.id, nodeX);

        // 1. Wybór xMin w osi Y jest akceptowany (dla obrotu o 90°)
        const val1 = validateReferenceFaceOrientation(sideY1, nodeY1, cabinetNode, 'FACE_Z_PLUS', 'xMin');
        expect(val1.valid).toBe(true);
        expect(val1.dominantAxis).toBe('y');

        const existingRefs = {
            xMin: { panelId: nodeY1.id, face: 'FACE_Z_PLUS' }
        };

        // 2. Drugi bok xMax w osi Y jest w 100% poprawny (równoległy)
        const val2 = validateReferenceFaceOrientation(sideY2, nodeY2, cabinetNode, 'FACE_Z_MINUS', 'xMax', existingRefs);
        expect(val2.valid).toBe(true);
        expect(val2.dominantAxis).toBe('y');

        // 3. Wskazanie boku w osi X dla xMax jest odrzucane (nierównoległe do xMin)
        const val3 = validateReferenceFaceOrientation(sideX, nodeX, cabinetNode, 'FACE_Z_MINUS', 'xMax', existingRefs);
        expect(val3.valid).toBe(false);
        expect(val3.errorMsg).toContain('Bok lewy i bok prawy muszą być do siebie równoległe');
    });

    it('enforces perpendicularity between sides and front/back', () => {
        const rotSideY = Quat.fromEulerXYZ(Math.PI / 2, 0, 0);
        const rotSideX = Quat.fromEulerXYZ(0, Math.PI / 2, 0);

        // Bok w osi Y
        const sideY = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        const nodeY = CADNode.create(NodeType.PART, 'Bok_Y', sideY.id);
        nodeY.domainData = sideY;
        nodeY.setLocalTransform(new Vec3(0, mmToNm(-441), mmToNm(360)), rotSideY);
        doc.addNode(cabinet.id, nodeY);

        // Ściana w osi X (plecy w ramieniu Y)
        const backX = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        const nodeBackX = CADNode.create(NodeType.PART, 'Plecy_X', backX.id);
        nodeBackX.domainData = backX;
        nodeBackX.setLocalTransform(new Vec3(mmToNm(-441), 0, mmToNm(360)), rotSideX);
        doc.addNode(cabinet.id, nodeBackX);

        const existingRefs = {
            xMin: { panelId: nodeY.id, face: 'FACE_Z_PLUS' } // Bok jest w osi Y
        };

        // Tył yMax w osi X jest poprawny (prostopadły do boku w osi Y)
        const valBack = validateReferenceFaceOrientation(backX, nodeBackX, cabinetNode, 'FACE_Z_PLUS', 'yMax', existingRefs);
        expect(valBack.valid).toBe(true);
        expect(valBack.dominantAxis).toBe('x');

        // Próba wskazania ściany w osi Y jako tył (równoległej do boków!) musi być odrzucona
        const valInvalid = validateReferenceFaceOrientation(sideY, nodeY, cabinetNode, 'FACE_Z_PLUS', 'yMax', existingRefs);
        expect(valInvalid.valid).toBe(false);
        expect(valInvalid.errorMsg).toContain('Przód i tył muszą być prostopadłe do boków szafki');
    });

    it('maps thin edge face (FACE_X) to main face for manual side reference pick', () => {
        const rotSideY = Quat.fromEulerXYZ(Math.PI / 2, 0, 0);
        const sidePanel = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        sidePanel.role = 'LEFT_SIDE_PANEL';
        const sideNode = CADNode.create(NodeType.PART, 'Bok_L', sidePanel.id);
        sideNode.domainData = sidePanel;
        sideNode.setLocalTransform(new Vec3(0, mmToNm(-441), mmToNm(360)), rotSideY);
        doc.addNode(cabinet.id, sideNode);

        const edgeAxis = getPanelFaceDominantAxis(sidePanel, sideNode, cabinetNode, 'FACE_Y_PLUS');
        expect(edgeAxis).toBe('z');

        const resolved = resolveManualReferenceFace(sidePanel, sideNode, cabinetNode, 'FACE_Y_PLUS', 'xMin');
        expect(resolved.mapped).toBe(true);
        expect(resolved.face === 'FACE_Z_PLUS' || resolved.face === 'FACE_Z_MINUS').toBe(true);

        const val = validateReferenceFaceOrientation(
            sidePanel,
            sideNode,
            cabinetNode,
            resolved.face,
            'xMin',
            {},
            { manualPick: true }
        );
        expect(val.valid).toBe(true);
        expect(val.dominantAxis).toBe('y');
    });

    it('manual pick accepts side ref even when auto bay left mismatched pair on xMax', () => {
        const rotSideY = Quat.fromEulerXYZ(Math.PI / 2, 0, 0);
        const rotSideX = Quat.fromEulerXYZ(0, Math.PI / 2, 0);

        const sideY = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        const nodeY = CADNode.create(NodeType.PART, 'Bok_Y', sideY.id);
        nodeY.domainData = sideY;
        nodeY.setLocalTransform(new Vec3(0, mmToNm(-441), mmToNm(360)), rotSideY);
        doc.addNode(cabinet.id, nodeY);

        const sideX = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        const nodeX = CADNode.create(NodeType.PART, 'Bok_X', sideX.id);
        nodeX.domainData = sideX;
        nodeX.setLocalTransform(new Vec3(mmToNm(441), 0, mmToNm(360)), rotSideX);
        doc.addNode(cabinet.id, nodeX);

        const autoRefs = {
            xMax: { panelId: nodeX.id, face: 'FACE_Z_MINUS' },
        };

        const resolved = resolveManualReferenceFace(sideY, nodeY, cabinetNode, 'FACE_Y_PLUS', 'xMin');
        const valStrict = validateReferenceFaceOrientation(
            sideY,
            nodeY,
            cabinetNode,
            resolved.face,
            'xMin',
            autoRefs
        );
        expect(valStrict.valid).toBe(false);

        const valManual = validateReferenceFaceOrientation(
            sideY,
            nodeY,
            cabinetNode,
            resolved.face,
            'xMin',
            autoRefs,
            { manualPick: true }
        );
        expect(valManual.valid).toBe(true);
    });

    it('accepts L-notch OUTLINE_SIDE on wieniec as a side reference', () => {
        const outline2d = [
            [0, 0],
            [882, 0],
            [882, 600],
            [600, 600],
            [600, 882],
            [0, 882]
        ];
        const wieniec = new PanelModel({
            width: mmToNm(882),
            height: mmToNm(882),
            thickness: mmToNm(18),
            role: 'BOTTOM_PANEL',
            name: 'Wieniec_D'
        });
        wieniec.custom_properties.outline2d = outline2d;
        wieniec.custom_properties.shape = 'L_NOTCH';
        const wieniecNode = CADNode.create(NodeType.PART, 'Wieniec_D', wieniec.id);
        wieniecNode.domainData = wieniec;
        wieniecNode.setLocalTransform(new Vec3(0, 0, mmToNm(9)), Quat.IDENTITY);
        doc.addNode(cabinet.id, wieniecNode);

        expect(() => getPanelFaceDominantAxis(wieniec, wieniecNode, cabinetNode, 'OUTLINE_SIDE_3')).not.toThrow();
        expect(getPanelFaceDominantAxis(wieniec, wieniecNode, cabinetNode, 'OUTLINE_SIDE_3')).toBe('x');

        const fromWall = resolveManualReferenceFace(
            wieniec, wieniecNode, cabinetNode, 'OUTLINE_SIDE_3', 'xMin'
        );
        expect(fromWall.face).toBe('OUTLINE_SIDE_3');
        expect(fromWall.mapped).toBe(false);

        const val = validateReferenceFaceOrientation(
            wieniec, wieniecNode, cabinetNode, fromWall.face, 'xMin', {}, { manualPick: true }
        );
        expect(val.valid).toBe(true);
        expect(val.dominantAxis).toBe('x');

        const fromCap = resolveManualReferenceFace(
            wieniec, wieniecNode, cabinetNode, 'FACE_Z_PLUS', 'xMin', null, { u: 600, v: 740 }
        );
        expect(fromCap.face).toBe('OUTLINE_SIDE_3');
        expect(fromCap.mapped).toBe(true);
    });

    it('update_bloki_core uses wieniec L-notch wall as xMin bound', () => {
        const outline2d = [
            [0, 0],
            [882, 0],
            [882, 600],
            [600, 600],
            [600, 882],
            [0, 882]
        ];
        const wieniec = new PanelModel({
            width: mmToNm(882),
            height: mmToNm(882),
            thickness: mmToNm(18),
            role: 'BOTTOM_PANEL',
            name: 'Wieniec_D'
        });
        wieniec.custom_properties.outline2d = outline2d;
        const wieniecNode = CADNode.create(NodeType.PART, 'Wieniec_D', wieniec.id);
        wieniecNode.domainData = wieniec;
        wieniecNode.setLocalTransform(new Vec3(0, 0, mmToNm(9)), Quat.IDENTITY);
        doc.addNode(cabinet.id, wieniecNode);

        const sbContainer = new ContainerModel({
            width: mmToNm(300),
            height: mmToNm(700),
            depth: mmToNm(400),
            name: 'blok_polki'
        });
        sbContainer.generatorParams = {
            type: 'blok_shelves',
            boxType: 'SHELVES',
            parentContainerId: cabinet.id,
            width_mm: 300,
            height_mm: 700,
            depth_mm: 400,
            customReferences: {
                // NOTCH pionowy u=600 → X = -441+600 = 159; zewnętrzne +X u=882 → X = 441
                xMin: { panelId: wieniecNode.id, face: 'OUTLINE_SIDE_3' },
                xMax: { panelId: wieniecNode.id, face: 'OUTLINE_SIDE_1' },
                zMin: { panelId: wieniecNode.id, face: 'FACE_Z_PLUS' }
            },
            disabledReferences: { yMin: true, yMax: true, zMax: true }
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        sbNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        doc.addNode(cabinet.id, sbNode);

        expect(update_bloki_core(sbContainer, doc)).toBe(true);
        const widthMm = nmToMm(sbContainer.width);
        expect(widthMm).toBeGreaterThan(250);
        expect(widthMm).toBeLessThan(320);
    });

    it('yMin z BOK_L (ściana frontowa) bierze INNER, nie środek ani −D/2', () => {
        // Jak BOK_L rogowy90: środek na −D/2+t/2, LCS Z→y, CADNode bez rotacji
        const t = 18;
        const D = 900;
        const bokL = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(t),
            role: 'LEFT_SIDE_PANEL',
            name: 'Dol_Bok_L'
        });
        (bokL as any).lcs = {
            mapping: { X: 'x', Y: 'z', Z: 'y' },
            rotation: [0, 0, 0],
            faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
        };
        (bokL as any).custom_properties = { corner_arm: 'Y' };
        const bokLNode = CADNode.create(NodeType.PART, 'Dol_Bok_L', bokL.id);
        bokLNode.domainData = bokL;
        bokLNode.setLocalTransform(
            new Vec3(mmToNm(-150), mmToNm(-D / 2 + t / 2), mmToNm(360)),
            Quat.IDENTITY
        );
        doc.addNode(cabinet.id, bokLNode);

        const back = new PanelModel({
            width: mmToNm(864),
            height: mmToNm(684),
            thickness: mmToNm(3),
            role: 'BACK_PANEL',
            name: 'Dol_Plecy_Y'
        });
        const backNode = CADNode.create(NodeType.PART, 'Dol_Plecy_Y', back.id);
        backNode.domainData = back;
        backNode.setLocalTransform(new Vec3(0, mmToNm(D / 2 - 1.5), mmToNm(360)), Quat.IDENTITY);
        doc.addNode(cabinet.id, backNode);

        const sbContainer = new ContainerModel({
            width: mmToNm(400),
            height: mmToNm(700),
            depth: mmToNm(500),
            name: 'blok_drzwi_narozne'
        });
        sbContainer.generatorParams = {
            type: 'blok_corner_doors',
            boxType: 'CORNER_DOORS',
            parentContainerId: cabinet.id,
            width_mm: 400,
            height_mm: 700,
            depth_mm: 500,
            customReferences: {
                yMin: { panelId: bokLNode.id, face: 'FACE_Z_PLUS', partKey: 'Dol_Bok_L' },
                yMax: { panelId: backNode.id, face: 'FACE_Z_PLUS', partKey: 'Dol_Plecy_Y' },
            },
            disabledReferences: { xMin: true, xMax: true, zMin: true, zMax: true }
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        sbNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        doc.addNode(cabinet.id, sbNode);

        expect(update_bloki_core(sbContainer, doc)).toBe(true);

        // INNER BOK_L = środek + t/2 = −D/2 + t = −450 + 18 = −432 (nie środek −441, nie −450)
        const sbPos = sbNode.localMatrix.decompose().translation;
        const halfD = nmToMm(sbContainer.depth) / 2;
        const frontY = nmToMm(sbPos.y) - halfD;
        expect(frontY).toBeCloseTo(-D / 2 + t, 0);
        expect(frontY).not.toBeCloseTo(-D / 2 + t / 2, 0); // nie środek płyty
        expect(frontY).not.toBeCloseTo(-D / 2, 0); // nie sztywne −D/2
    });

    it('update_bloki_core automatically rotates Bloki by 90 deg when sides are in Y axis', () => {
        const rotSideY = Quat.fromEulerXYZ(Math.PI / 2, 0, 0);
        const rotSideX = Quat.fromEulerXYZ(0, Math.PI / 2, 0);

        // Bok 1 w osi Y przy Y = -441
        const sideY1 = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        const nodeY1 = CADNode.create(NodeType.PART, 'Bok_Y1', sideY1.id);
        nodeY1.domainData = sideY1;
        nodeY1.setLocalTransform(new Vec3(0, mmToNm(-441), mmToNm(360)), rotSideY);
        doc.addNode(cabinet.id, nodeY1);

        // Bok 2 w osi Y przy Y = -141
        const sideY2 = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        const nodeY2 = CADNode.create(NodeType.PART, 'Bok_Y2', sideY2.id);
        nodeY2.domainData = sideY2;
        nodeY2.setLocalTransform(new Vec3(0, mmToNm(-141), mmToNm(360)), rotSideY);
        doc.addNode(cabinet.id, nodeY2);

        // Plecy w osi X przy X = -441
        const backX = new PanelModel({ width: mmToNm(720), height: mmToNm(600), thickness: mmToNm(18) });
        const nodeBackX = CADNode.create(NodeType.PART, 'Plecy_X', backX.id);
        nodeBackX.domainData = backX;
        nodeBackX.setLocalTransform(new Vec3(mmToNm(-441), 0, mmToNm(360)), rotSideX);
        doc.addNode(cabinet.id, nodeBackX);

        // Dół w osi Z przy Z = 18
        const bottomZ = new PanelModel({ width: mmToNm(900), height: mmToNm(900), thickness: mmToNm(18) });
        const nodeBottomZ = CADNode.create(NodeType.PART, 'Wieniec_D', bottomZ.id);
        nodeBottomZ.domainData = bottomZ;
        nodeBottomZ.setLocalTransform(new Vec3(0, 0, mmToNm(9)), Quat.IDENTITY);
        doc.addNode(cabinet.id, nodeBottomZ);

        // Tworzymy Bloki
        const sbContainer = new ContainerModel({ width: mmToNm(300), height: mmToNm(700), depth: mmToNm(400), name: 'blok_polki' });
        sbContainer.generatorParams = {
            type: 'blok_shelves',
            boxType: 'SHELVES',
            parentContainerId: cabinet.id,
            width_mm: 300,
            height_mm: 700,
            depth_mm: 400,
            customReferences: {
                xMin: { panelId: nodeY1.id, face: 'FACE_Z_PLUS' }, // normal w Y
                xMax: { panelId: nodeY2.id, face: 'FACE_Z_MINUS' }, // normal w Y
                yMax: { panelId: nodeBackX.id, face: 'FACE_Z_PLUS' }, // normal w X (tył)
                zMin: { panelId: nodeBottomZ.id, face: 'FACE_Z_PLUS' }
            },
            disabledReferences: { yMin: true, zMax: true }
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        sbNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        doc.addNode(cabinet.id, sbNode);

        const ok = update_bloki_core(sbContainer, doc);
        expect(ok).toBe(true);

        // Sprawdź, czy szerokość została wyliczona wzdłuż osi Y (między -441 a -141 -> ok. 300 mm)
        const widthMm = nmToMm(sbContainer.width);
        expect(widthMm).toBeGreaterThan(250);
        expect(widthMm).toBeLessThan(350);

        // Sprawdź obrót kontenera Bloki - musi mieć obrót 90 deg wokół Z
        const { rotation } = sbNode.localMatrix.decompose();
        const euler = rotation.toEulerXYZ();
        expect(Math.abs(euler.z)).toBeCloseTo(Math.PI / 2, 1);
    });
});
