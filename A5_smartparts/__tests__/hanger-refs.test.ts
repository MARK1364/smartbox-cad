import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { resolveHangersReferenceBoxMm } from '../hangers/hanger-apply.js';
import { resolveStudioPlacementInContainerMm } from '../hangers/smartpart-bay-placement.js';

function addPanel(
    doc: ProjectDocument,
    cabinetId: string,
    name: string,
    role: string,
    w: number, h: number, t: number,
    x: number, y: number, z: number,
) {
    const panel = new PanelModel({
        width: mmToNm(w),
        height: mmToNm(h),
        thickness: mmToNm(t),
        role,
        name,
    });
    const node = CADNode.create(NodeType.PART, name, panel.id);
    node.domainData = panel;
    node.setLocalTransform(new Vec3(mmToNm(x), mmToNm(y), mmToNm(z)), Quat.IDENTITY);
    doc.addNode(cabinetId, node);
    return node;
}

describe('SmartParts — główny kontener czyta ściany korpusu jak Blok', () => {
    let doc: ProjectDocument;
    let cabinetId: string;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.width = mmToNm(600);
        cabinet.height = mmToNm(720);
        cabinet.depth = mmToNm(350);
        cabinet.generatorParams = { type: 'korpus3_1' };
        cabinetId = cabinet.id;
        // Wnęka: X −282..282, Y −165..165, Z 18..700
        addPanel(doc, cabinetId, 'Bok_L', 'LEFT_SIDE_PANEL', 350, 720, 18, -291, 0, 360);
        addPanel(doc, cabinetId, 'Bok_P', 'RIGHT_SIDE_PANEL', 350, 720, 18, 291, 0, 360);
        addPanel(doc, cabinetId, 'Dno', 'BOTTOM_PANEL', 564, 330, 18, 0, 0, 9);
        addPanel(doc, cabinetId, 'Wieniec', 'TOP_PANEL', 564, 330, 18, 0, 0, 709);
        addPanel(doc, cabinetId, 'Plecy', 'BACK_PANEL', 564, 700, 18, 0, 174, 360);
        addPanel(doc, cabinetId, 'Przod', 'FRONT_PANEL', 564, 700, 18, 0, -174, 360);
    });

    function group(offsets: Record<string, number> = {}) {
        const container = new ContainerModel({
            name: 'SmartParts',
            width: mmToNm(100),
            height: mmToNm(100),
            depth: mmToNm(100),
        });
        const byName = (name: string) =>
            doc.rootNode.children[0].children.find((n) => n.name === name)!;
        container.generatorParams = {
            type: 'smartpart_hangers',
            parentContainerId: cabinetId,
            isSmartPart: true,
            width_mm: 564,
            height_mm: 682,
            depth_mm: 330,
            maxHeight: 682,
            offsets: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0, ...offsets },
            disabledReferences: {},
            customReferences: {
                xMin: { panelId: byName('Bok_L').id, face: 'FACE_Z_PLUS', partKey: 'Bok_L' },
                xMax: { panelId: byName('Bok_P').id, face: 'FACE_Z_PLUS', partKey: 'Bok_P' },
                yMin: { panelId: byName('Przod').id, face: 'FACE_Y_PLUS', partKey: 'Przod' },
                yMax: { panelId: byName('Plecy').id, face: 'FACE_Z_PLUS', partKey: 'Plecy' },
                zMin: { panelId: byName('Dno').id, face: 'FACE_Z_PLUS', partKey: 'Dno' },
                zMax: { panelId: byName('Wieniec').id, face: 'FACE_Z_PLUS', partKey: 'Wieniec' },
            },
        };
        return container;
    }

    it('góra i dół wieńca zamykają kontener; offset zMax schodzi ze ściany', () => {
        const plain = resolveHangersReferenceBoxMm(group(), doc);
        expect(plain).not.toBeNull();
        expect(plain!.zMin).toBeCloseTo(18, 0);
        expect(plain!.zMax).toBeCloseTo(700, 0);
        expect(plain!.heightMm).toBeCloseTo(682, 0);
        expect(plain!.posZ).toBeCloseTo(18, 0);

        const inset = resolveHangersReferenceBoxMm(group({ zMax: 30, zMin: 10 }), doc);
        expect(inset).not.toBeNull();
        expect(inset!.zMax).toBeCloseTo(670, 0);
        expect(inset!.zMin).toBeCloseTo(28, 0);
        expect(inset!.heightMm).toBeCloseTo(642, 0);
    });

    it('Part refZ TOP ze Studia (p40: offset 50) liczy od góry tej ramki', () => {
        const box = resolveHangersReferenceBoxMm(group(), doc)!;
        const pos = resolveStudioPlacementInContainerMm(
            { widthMm: box.widthMm, heightMm: box.heightMm, depthMm: box.depthMm },
            { refX: 'LEFT', offsetX_mm: 10, refY: 'FRONT', offsetY_mm: 100, refZ: 'TOP', offsetZ_mm: 50 },
        );
        expect(pos.z).toBeCloseTo(box.heightMm - 50, 0);
        expect(pos.z).toBeGreaterThan(box.heightMm / 2);
    });

    it('obniżenie wieńca zmniejsza kontener; Part TOP zostaje 30 mm pod nowym sufitem', () => {
        const before = resolveHangersReferenceBoxMm(group(), doc)!;
        const wieniec = doc.rootNode.children[0].children.find((n) => n.name === 'Wieniec')!;
        wieniec.setLocalTransform(new Vec3(0, 0, mmToNm(500)), Quat.IDENTITY);
        const after = resolveHangersReferenceBoxMm(group(), doc)!;
        expect(after.heightMm).toBeLessThan(before.heightMm - 100);
        expect(after.zMax).toBeCloseTo(491, 0);
        const pos = resolveStudioPlacementInContainerMm(
            { widthMm: after.widthMm, heightMm: after.heightMm, depthMm: after.depthMm },
            { refX: 'LEFT', offsetX_mm: 10, refY: 'FRONT', offsetY_mm: 30, refZ: 'TOP', offsetZ_mm: 30 },
        );
        expect(pos.z).toBeCloseTo(after.heightMm - 30, 0);
        expect(pos.z).toBeGreaterThan(after.heightMm * 0.7);
    });

    it('offset zMax 300 obniża ramkę i Part TOP+50 jedzie z górą kontenera', () => {
        const plain = resolveHangersReferenceBoxMm(group(), doc)!;
        const inset = resolveHangersReferenceBoxMm(group({ zMax: 300 }), doc)!;
        expect(inset.heightMm).toBeCloseTo(plain.heightMm - 300, 0);
        expect(inset.zMax).toBeCloseTo(plain.zMax - 300, 0);
        const partPlain = resolveStudioPlacementInContainerMm(
            { widthMm: plain.widthMm, heightMm: plain.heightMm, depthMm: plain.depthMm },
            { refZ: 'TOP', offsetZ_mm: 50 },
        );
        const partInset = resolveStudioPlacementInContainerMm(
            { widthMm: inset.widthMm, heightMm: inset.heightMm, depthMm: inset.depthMm },
            { refZ: 'TOP', offsetZ_mm: 50 },
        );
        // Lokalne Z maleje o 300 (góra kontenera bliżej dna); Part zostaje 50 mm pod nową górą
        expect(partInset.z).toBeCloseTo(partPlain.z - 300, 0);
        expect(partInset.z).toBeCloseTo(inset.heightMm - 50, 0);
    });

    it('zMax wskazujący na bok (nie wieniec) nie daje Part TOP na środku korpusu', () => {
        const byName = (name: string) =>
            doc.rootNode.children[0].children.find((n) => n.name === name)!;
        const c = group();
        // Symulacja złej referencji z detektora: góra = Bok_L (Z ≈ środek)
        c.generatorParams.customReferences.zMax = {
            panelId: byName('Bok_L').id,
            face: 'FACE_Y_PLUS',
            partKey: 'Bok_L',
        };
        const box = resolveHangersReferenceBoxMm(c, doc)!;
        expect(box.heightMm).toBeGreaterThan(600);
        expect(box.zMax).toBeCloseTo(700, 0);
        const pos = resolveStudioPlacementInContainerMm(
            { widthMm: box.widthMm, heightMm: box.heightMm, depthMm: box.depthMm },
            { refZ: 'TOP', offsetZ_mm: 50, zMm: 250 },
        );
        expect(pos.z).toBeCloseTo(box.heightMm - 50, 0);
        expect(pos.z).toBeGreaterThan(box.heightMm * 0.8);
    });
});
