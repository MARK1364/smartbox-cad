import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { classifyOutlineSegmentEdge } from '../../A4_smartpanel/native_core/polygon-extrusion.js';
import {
    getPanelFaceDominantAxis,
    update_bloki_core,
} from '../01_bloki-core.js';

/**
 * TyĹ‚ Bloku na Ĺ›ciance wciÄ™cia L wieĹ„ca.
 * Rx(90) na wÄ™Ĺşle wieĹ„ca nie moĹĽe zwinÄ…Ä‡ CAD Y do Ĺ›rodka pĹ‚yty (~staĹ‚e odsuniÄ™cie).
 */
describe('bloki yMax na wciÄ™ciu L wieĹ„ca', () => {
    let doc: ProjectDocument;
    let cabinet: ContainerModel;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();

        cabinet = doc.createAssembly({ name: 'Rogowy90' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_rogowy90',
            liczba_stref: 1,
            glebokosc_boku_lewego_mm: 510,
            glebokosc_boku_prawego_mm: 510,
        };
        runEngineAndApply(cabinet, 880, 720, 880, 1, 0, 0, 0);
    });

    function findWieniec(): CADNode {
        const cntNode = doc.findNode(cabinet.id)!;
        const node = cntNode.children.find((c: any) => c.domainData?.role === 'BOTTOM_PANEL');
        expect(node).toBeDefined();
        return node!;
    }

    function notchFaces(wieniecNode: CADNode): { yFace: string; xFace: string } {
        const panel = wieniecNode.domainData as any;
        const outline = panel.custom_properties.outline2d as number[][];
        const plateW = nmToMm(panel.width);
        const plateD = nmToMm(panel.height);
        let yFace = '';
        let xFace = '';
        for (let i = 0; i < outline.length; i++) {
            const [u0, v0] = outline[i];
            const [u1, v1] = outline[(i + 1) % outline.length];
            if (classifyOutlineSegmentEdge(u0, v0, u1, v1, plateW, plateD) !== 'NOTCH') continue;
            const face = `OUTLINE_SIDE_${i}`;
            const axis = getPanelFaceDominantAxis(panel, wieniecNode, doc.findNode(cabinet.id), face);
            if (axis === 'y') yFace = face;
            if (axis === 'x') xFace = face;
        }
        expect(yFace).toBeTruthy();
        expect(xFace).toBeTruthy();
        return { yFace, xFace };
    }

    const SB_DIMS = { width_mm: 400, height_mm: 700, depth_mm: 500 };

    function disabledForMissingRefs(customReferences: Record<string, unknown>) {
        const disabled: Record<string, true> = {};
        for (const side of ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'] as const) {
            if (!customReferences[side]) disabled[side] = true;
        }
        return disabled;
    }

    function makeSb(customReferences: any) {
        const sb = new ContainerModel({
            width: mmToNm(SB_DIMS.width_mm),
            height: mmToNm(SB_DIMS.height_mm),
            depth: mmToNm(SB_DIMS.depth_mm),
            name: 'blok_polki'
        });
        sb.generatorParams = {
            type: 'blok_shelves',
            boxType: 'SHELVES',
            parentContainerId: cabinet.id,
            ...SB_DIMS,
            customReferences,
            disabledReferences: disabledForMissingRefs(customReferences),
            offsets: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 }
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sb.name, sb.id);
        sbNode.domainData = sb;
        sbNode.setLocalTransform(new Vec3(0, 0, 0));
        doc.addNode(cabinet.id, sbNode);
        return { sb, sbNode };
    }

    it('poziomy NOTCH ma oś Y (nie Z z Rx(90) wieńca)', () => {
        const wieniec = findWieniec();
        const { yFace, xFace } = notchFaces(wieniec);
        const cab = doc.findNode(cabinet.id);
        expect(getPanelFaceDominantAxis(wieniec.domainData, wieniec, cab, yFace)).toBe('y');
        expect(getPanelFaceDominantAxis(wieniec.domainData, wieniec, cab, xFace)).toBe('x');
    });

    it('yMax na poziomym NOTCH — tył SB na ścianie wcięcia, bez sztywnego odsunięcia', () => {
        const wieniec = findWieniec();
        const { yFace, xFace } = notchFaces(wieniec);
        const cntNode = doc.findNode(cabinet.id)!;
        const bokL = cntNode.children.find((c: any) =>
            String(c.domainData?.key || c.name || '').toUpperCase().includes('BOK_L')
        )!;

        const { sb, sbNode } = makeSb({
            yMin: { panelId: bokL.id, face: 'FACE_Z_PLUS', partKey: bokL.name },
            yMax: { panelId: wieniec.id, face: yFace, partKey: wieniec.name },
            xMax: { panelId: wieniec.id, face: xFace, partKey: wieniec.name },
        });

        expect(update_bloki_core(sb, doc)).toBe(true);

        const pos = sbNode.localMatrix.decompose().translation;
        const backY = nmToMm(pos.y) + nmToMm(sb.depth) / 2;
        const panel = wieniec.domainData as any;
        const outline = panel.custom_properties.outline2d as number[][];
        const idx = parseInt(yFace.replace('OUTLINE_SIDE_', ''), 10);
        const [u0, v0] = outline[idx];
        const [u1, v1] = outline[(idx + 1) % outline.length];
        const vm = (v0 + v1) / 2;
        const locY = nmToMm(wieniec.localMatrix.decompose().translation.y);
        const plateD = nmToMm(panel.height);
        const rotX = Number(panel.lcs?.rotation?.[0]) || 0;
        const expectedY = rotX > 0 ? locY - (vm - plateD / 2) : locY + (vm - plateD / 2);

        expect(backY).toBeCloseTo(expectedY, 0);
        expect(Math.abs(backY - locY)).toBeGreaterThan(20);
    });

    it('brak rozwiązanej referencji yMax — ostrzeżenie i przerwanie (bez fallbacku gabarytu)', () => {
        const wieniec = findWieniec();
        const cntNode = doc.findNode(cabinet.id)!;
        const bokL = cntNode.children.find((c: any) =>
            String(c.domainData?.key || c.name || '').toUpperCase().includes('BOK_L')
        )!;

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { sb } = makeSb({
            yMin: { panelId: bokL.id, face: 'FACE_Z_PLUS', partKey: bokL.name },
            yMax: { panelId: 'nieistniejacy-panel', face: 'OUTLINE_SIDE_99', partKey: 'brak' },
        });
        const widthBefore = sb.width;

        expect(update_bloki_core(sb, doc)).toBe(false);
        expect(sb.width).toBe(widthBefore);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('to samo odsunięcie 0 przy innym gabarycie (nie sztywne 50 mm)', () => {
        cabinet.generatorParams = {
            ...cabinet.generatorParams,
            glebokosc_boku_lewego_mm: 400,
            glebokosc_boku_prawego_mm: 400,
        };
        runEngineAndApply(cabinet, 1000, 720, 1000, 1, 0, 0, 0);

        const wieniec = findWieniec();
        const { yFace } = notchFaces(wieniec);
        const cntNode = doc.findNode(cabinet.id)!;
        const bokL = cntNode.children.find((c: any) =>
            String(c.domainData?.key || c.name || '').toUpperCase().includes('BOK_L')
        )!;

        const { sb, sbNode } = makeSb({
            yMin: { panelId: bokL.id, face: 'FACE_Z_PLUS', partKey: bokL.name },
            yMax: { panelId: wieniec.id, face: yFace, partKey: wieniec.name },
        });

        expect(update_bloki_core(sb, doc)).toBe(true);
        const pos = sbNode.localMatrix.decompose().translation;
        const backY = nmToMm(pos.y) + nmToMm(sb.depth) / 2;
        const panel = wieniec.domainData as any;
        const outline = panel.custom_properties.outline2d as number[][];
        const idx = parseInt(yFace.replace('OUTLINE_SIDE_', ''), 10);
        const [, v0] = outline[idx];
        const [, v1] = outline[(idx + 1) % outline.length];
        const vm = (v0 + v1) / 2;
        const locY = nmToMm(wieniec.localMatrix.decompose().translation.y);
        const plateD = nmToMm(panel.height);
        const rotX = Number(panel.lcs?.rotation?.[0]) || 0;
        const expectedY = rotX > 0 ? locY - (vm - plateD / 2) : locY + (vm - plateD / 2);
        expect(backY).toBeCloseTo(expectedY, 0);
    });
});
