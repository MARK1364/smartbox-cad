import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import {
    buildRogowy90CornerDoorsReferences,
    applyCornerDoorsDefaultRefs,
    buildCornerDoorsAutoRefsPatch,
} from '../07_corner-doors-refs.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { createBlokInDetectedBay } from '../02_bloki-bay-actions.js';
import { probeRogowy90BayFromCADPoint } from '../../A3_smartframe/rogowy90-bay.js';
import { getOutlineFaceCoordinate } from '../01_bloki-core.js';

describe('corner doors references (rogowy90)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    function buildCab() {
        const cabinet = doc.createAssembly({ name: 'Rogowy90' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_rogowy90',
            liczba_stref: 1,
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600,
        };
        runEngineAndApply(cabinet, 900, 720, 900, 1, 0, 0, 0);
        return doc.findNode(cabinet.id)!;
    }

    it('domyślne refs (4+2): xMin/yMax automatycznie ze ścianek NOTCH wieńca dolnego', () => {
        const refs = buildRogowy90CornerDoorsReferences(buildCab());
        expect(refs).not.toBeNull();
        expect(refs!.xMin).toBeDefined();
        expect(refs!.yMax).toBeDefined();
        expect(refs!.xMin!.partKey.toUpperCase()).toMatch(/WIENIEC_D/);
        expect(refs!.yMax!.partKey.toUpperCase()).toMatch(/WIENIEC_D/);
        expect(refs!.xMin!.face).toMatch(/^OUTLINE_SIDE_\d+$/);
        expect(refs!.yMax!.face).toMatch(/^OUTLINE_SIDE_\d+$/);
        expect(refs!.xMax.partKey.toUpperCase()).toMatch(/BOK_P/);
        expect(refs!.yMin.partKey.toUpperCase()).toMatch(/BOK_L/);
        expect(refs!.zMin.face).toBe('FACE_Z_PLUS');
        expect(refs!.zMax.face).toBe('FACE_Z_PLUS'); // INNER spód wieńca góry
    });

    it('współrzędne ścianek wcięcia są w układzie świata mimo rotX=90/rotY=180 wieńca', () => {
        const cabNode = buildCab();
        const wieniec = cabNode.children.find((c: any) => c.domainData?.role === 'BOTTOM_PANEL')!;
        const panel = wieniec.domainData as any;
        expect(Number(panel.lcs?.rotation?.[0])).toBe(90);
        expect(Math.abs(Number(panel.lcs?.rotation?.[1]))).toBe(180);

        const refs = buildRogowy90CornerDoorsReferences(cabNode)!;
        const xMinCoord = getOutlineFaceCoordinate(panel, wieniec, cabNode, refs.xMin!.face, 'x')!;
        const yMaxCoord = getOutlineFaceCoordinate(panel, wieniec, cabNode, refs.yMax!.face, 'y')!;
        expect(xMinCoord).toBeCloseTo(150, 5);
        expect(yMaxCoord).toBeCloseTo(-150, 5);
    });

    it('wykrywa ścianki wcięcia po wierzchołku wklęsłym (niezależnie od skali outline2d)', () => {
        const cabNode = buildCab();
        const wieniec = cabNode.children.find((c: any) => c.domainData?.role === 'BOTTOM_PANEL')!;
        const panel = wieniec.domainData as any;
        const orig = panel.custom_properties.outline2d as number[][];
        panel.custom_properties.outline2d = orig.map(([u, v]) => [u * 1_000_000, v * 1_000_000]);

        const refs = buildRogowy90CornerDoorsReferences(cabNode);
        expect(refs?.xMin?.partKey.toUpperCase()).toMatch(/WIENIEC_D/);
        expect(refs?.yMax?.partKey.toUpperCase()).toMatch(/WIENIEC_D/);
        expect(refs?.xMin?.face).toMatch(/^OUTLINE_SIDE_\d+$/);
        expect(refs?.yMax?.face).toMatch(/^OUTLINE_SIDE_\d+$/);
    });

    it('applyCornerDoorsDefaultRefs → innerL_wieniec z automatycznym wcięciem L', () => {
        const applied = applyCornerDoorsDefaultRefs(buildCab());
        expect(applied?.cornerAt).toBe('innerL_wieniec');
        expect(applied?.customReferences.xMin?.face).toMatch(/^OUTLINE_SIDE_\d+$/);
        expect(applied?.customReferences.yMax?.face).toMatch(/^OUTLINE_SIDE_\d+$/);
        expect(applied?.customReferences.yMin.partKey.toUpperCase()).toMatch(/BOK_L/);
        expect(applied?.customReferences.xMax.partKey.toUpperCase()).toMatch(/BOK_P/);
        expect(applied?.customReferences.zMax.face).toBe('FACE_Z_PLUS');
    });

    it('buildCornerDoorsAutoRefsPatch uzupełnia refy przy zmianie modułu i zdejmuje disabled', () => {
        const cabNode = buildCab();
        const container = {
            generatorParams: {
                parentContainerId: cabNode.id,
                customReferences: {
                    zMax: { partKey: 'STARY', face: 'FACE_Z_PLUS', panelId: 'stary-id' },
                },
                disabledReferences: { xMin: true, yMax: true, zMax: true },
            },
        };

        const patch = buildCornerDoorsAutoRefsPatch(container, doc);
        expect(patch).not.toBeNull();
        expect(patch!.customReferences.xMin!.face).toMatch(/^OUTLINE_SIDE_\d+$/);
        expect(patch!.customReferences.yMax!.face).toMatch(/^OUTLINE_SIDE_\d+$/);
        expect(patch!.customReferences.xMax.partKey.toUpperCase()).toMatch(/BOK_P/);
        expect(patch!.customReferences.yMin.partKey.toUpperCase()).toMatch(/BOK_L/);
        expect(patch!.customReferences.zMax.partKey).not.toBe('STARY');
        expect(patch!.disabledReferences.xMin).toBeUndefined();
        expect(patch!.disabledReferences.yMax).toBeUndefined();
        expect(patch!.disabledReferences.zMax).toBeUndefined();
    });

    it('buildCornerDoorsAutoRefsPatch zwraca null poza korpusem rogowym', () => {
        const plain = doc.createAssembly({ name: 'Prosty' }) as ContainerModel;
        plain.generatorParams = { type: 'korpus' };
        const cabNode = doc.findNode(plain.id)!;
        const container = { generatorParams: { parentContainerId: cabNode.id } };
        expect(buildCornerDoorsAutoRefsPatch(container, doc)).toBeNull();
    });

    it('createBlokInDetectedBay z CORNER_DOORS używa ścianek wcięcia L (xMin/yMax) i tworzy drzwi narożne', () => {
        const cabNode = buildCab();
        const bay = probeRogowy90BayFromCADPoint(doc, { x: 250, y: 0, z: 360 });
        expect(bay).not.toBeNull();

        const blokNode = createBlokInDetectedBay(doc, bay!, {
            id: 'CORNER_DOORS',
            label: 'Drzwi narożne',
            category: 'internal'
        } as any);

        expect(blokNode).not.toBeNull();
        const gp = (blokNode!.domainData as any)?.generatorParams;
        expect(gp).toBeDefined();
        expect(gp.type).toBe('blok_corner_doors');
        expect(gp.customReferences.xMin.face).toMatch(/^OUTLINE_SIDE_\d+$/);
        expect(gp.customReferences.yMax.face).toMatch(/^OUTLINE_SIDE_\d+$/);
        expect(gp.disabledReferences?.xMin).not.toBe(true);
        expect(gp.disabledReferences?.yMax).not.toBe(true);

        // Gabaryt bloku rozpięty między ścianką pionową (xMin) a poziomą (yMax) wcięcia.
        const sb = blokNode!.domainData as ContainerModel;
        const pos = blokNode!.localMatrix.decompose().translation;
        expect(nmToMm(pos.x) - nmToMm(sb.width) / 2).toBeCloseTo(150, 0);
        expect(nmToMm(pos.y) + nmToMm(sb.depth) / 2).toBeCloseTo(-150, 0);
        expect(gp.width_mm).toBeGreaterThan(0);
        expect(gp.depth_mm).toBeGreaterThan(0);
        expect(gp.height_mm).toBeGreaterThan(0);
        // Drzwi prawe i lewe powinny zostać wygenerowane wewnątrz węzła
        expect(blokNode!.children.length).toBeGreaterThan(0);
    });
});
