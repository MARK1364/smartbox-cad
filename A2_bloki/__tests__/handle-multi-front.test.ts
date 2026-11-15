/**
 * A2_bloki / handles / __tests__ — handle-multi-front.test.ts
 * Testy jednostkowe wykrywania kontekstu frontów szuflad i masowego dodawania uchwytów.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import {
    detectDrawerFrontScope,
    isDrawerFrontNode,
    applySmartPartHandleWithScope,
} from '../handles/handle-multi-front.js';

describe('Handle Multi Front Detection & Application', () => {
    let doc: ProjectDocument;
    let cabinet1: CADNode;
    let cabinet2: CADNode;
    let drawersContainer1: CADNode;
    let drawersContainer2: CADNode;
    let front1A: CADNode;
    let front1B: CADNode;
    let front1C: CADNode;
    let front2A: CADNode;
    let front2B: CADNode;
    let doorNode: CADNode;

    beforeEach(() => {
        doc = new ProjectDocument();

        // Szafka 1 (3 szuflady)
        const cab1 = new ContainerModel({ name: 'Szafka_1', width: mmToNm(600), height: mmToNm(820), depth: mmToNm(500) });
        cabinet1 = CADNode.create(NodeType.ASSEMBLY, 'Szafka_1', cab1.id);
        cabinet1.domainData = cab1;
        doc.addNode(doc.rootNode.id, cabinet1);

        const drw1 = new ContainerModel({ name: 'Szuflady_1', width: mmToNm(564), height: mmToNm(720), depth: mmToNm(500) });
        drw1.generatorParams = { type: 'blok_drawers', liczba_szuflad: 3 };
        drawersContainer1 = CADNode.create(NodeType.ASSEMBLY, 'Szuflady_1', drw1.id);
        drawersContainer1.domainData = drw1;
        doc.addNode(cabinet1.id, drawersContainer1);

        const p1A = new PanelModel({ width: mmToNm(596), height: mmToNm(140), thickness: mmToNm(18), name: 'Front_0', role: 'FRONT' });
        (p1A as any).key = 'DRAWER_0_FRONT';
        front1A = CADNode.create(NodeType.PART, 'Front_0', p1A.id);
        front1A.domainData = p1A;
        doc.addNode(drawersContainer1.id, front1A);

        const p1B = new PanelModel({ width: mmToNm(596), height: mmToNm(286), thickness: mmToNm(18), name: 'Front_1', role: 'FRONT' });
        (p1B as any).key = 'DRAWER_1_FRONT';
        front1B = CADNode.create(NodeType.PART, 'Front_1', p1B.id);
        front1B.domainData = p1B;
        doc.addNode(drawersContainer1.id, front1B);

        const p1C = new PanelModel({ width: mmToNm(596), height: mmToNm(286), thickness: mmToNm(18), name: 'Front_2', role: 'FRONT' });
        (p1C as any).key = 'DRAWER_2_FRONT';
        front1C = CADNode.create(NodeType.PART, 'Front_2', p1C.id);
        front1C.domainData = p1C;
        doc.addNode(drawersContainer1.id, front1C);

        // Szafka 2 (2 szuflady)
        const cab2 = new ContainerModel({ name: 'Szafka_2', width: mmToNm(600), height: mmToNm(820), depth: mmToNm(500) });
        cabinet2 = CADNode.create(NodeType.ASSEMBLY, 'Szafka_2', cab2.id);
        cabinet2.domainData = cab2;
        doc.addNode(doc.rootNode.id, cabinet2);

        const drw2 = new ContainerModel({ name: 'Szuflady_2', width: mmToNm(564), height: mmToNm(720), depth: mmToNm(500) });
        drw2.generatorParams = { type: 'blok_drawers', liczba_szuflad: 2 };
        drawersContainer2 = CADNode.create(NodeType.ASSEMBLY, 'Szuflady_2', drw2.id);
        drawersContainer2.domainData = drw2;
        doc.addNode(cabinet2.id, drawersContainer2);

        const p2A = new PanelModel({ width: mmToNm(596), height: mmToNm(355), thickness: mmToNm(18), name: 'Front_0', role: 'FRONT' });
        (p2A as any).key = 'DRAWER_0_FRONT';
        front2A = CADNode.create(NodeType.PART, 'Front_0', p2A.id);
        front2A.domainData = p2A;
        doc.addNode(drawersContainer2.id, front2A);

        const p2B = new PanelModel({ width: mmToNm(596), height: mmToNm(355), thickness: mmToNm(18), name: 'Front_1', role: 'FRONT' });
        (p2B as any).key = 'DRAWER_1_FRONT';
        front2B = CADNode.create(NodeType.PART, 'Front_1', p2B.id);
        front2B.domainData = p2B;
        doc.addNode(drawersContainer2.id, front2B);

        // Zwykłe drzwi jednoskrzydłowe
        const pDoor = new PanelModel({ width: mmToNm(400), height: mmToNm(720), thickness: mmToNm(18), name: 'Drzwi', role: 'DOOR' });
        doorNode = CADNode.create(NodeType.PART, 'Drzwi', pDoor.id);
        doorNode.domainData = pDoor;
        doc.addNode(cabinet1.id, doorNode);
    });

    it('poprawnie rozpoznaje czy węzeł jest frontem szuflady', () => {
        expect(isDrawerFrontNode(front1A)).toBe(true);
        expect(isDrawerFrontNode(front1B)).toBe(true);
        expect(isDrawerFrontNode(front2A)).toBe(true);
        expect(isDrawerFrontNode(doorNode)).toBe(false);
    });

    it('wykrywa zasięg szuflad w module oraz w całym projekcie', () => {
        const info = detectDrawerFrontScope(doc, front1A);
        expect(info.isDrawerFront).toBe(true);
        expect(info.isMulti).toBe(true);
        expect(info.siblingFronts.length).toBe(3); // front1A, front1B, front1C
        expect(info.projectFronts.length).toBe(5); // 3 w szafce 1 + 2 w szafce 2
    });

    it('dla pojedynczego frontu (np. drzwi bez rodzeństwa) isMulti jest false', () => {
        const info = detectDrawerFrontScope(doc, doorNode);
        expect(info.isDrawerFront).toBe(false);
        expect(info.isMulti).toBe(false);
        expect(info.siblingFronts.length).toBe(1);
    });

    it('aplikuje uchwyt tylko do 1 frontu przy scope SINGLE', () => {
        const handles = applySmartPartHandleWithScope(
            doc,
            front1A,
            { totalLengthMm: 160, holeDistanceMm: 128 },
            { faceZ: -9, normalZ: -1 },
            'SINGLE'
        );
        expect(handles.length).toBe(1);
        expect(front1A.children.length).toBe(1);
        expect(front1B.children.length).toBe(0);
        expect(front1C.children.length).toBe(0);
    });

    it('aplikuje uchwyt do wszystkich 3 szuflad w module przy scope MODULE', () => {
        const handles = applySmartPartHandleWithScope(
            doc,
            front1A,
            { totalLengthMm: 160, holeDistanceMm: 128 },
            { faceZ: -9, normalZ: -1 },
            'MODULE'
        );
        expect(handles.length).toBe(3);
        expect(front1A.children.length).toBe(1);
        expect(front1B.children.length).toBe(1);
        expect(front1C.children.length).toBe(1);
        // Szafka 2 nie powinna zostać tknięta
        expect(front2A.children.length).toBe(0);
        expect(front2B.children.length).toBe(0);
    });

    it('aplikuje uchwyt do wszystkich 5 szuflad w projekcie przy scope PROJECT', () => {
        const handles = applySmartPartHandleWithScope(
            doc,
            front1A,
            { totalLengthMm: 160, holeDistanceMm: 128 },
            { faceZ: -9, normalZ: -1 },
            'PROJECT'
        );
        expect(handles.length).toBe(5);
        expect(front1A.children.length).toBe(1);
        expect(front1B.children.length).toBe(1);
        expect(front1C.children.length).toBe(1);
        expect(front2A.children.length).toBe(1);
        expect(front2B.children.length).toBe(1);
        // Drzwi nie powinny dostać uchwytu
        expect(doorNode.children.length).toBe(0);
    });

    it('podmiana uchwytu czyści poprzedni uchwyt i nie dubluje węzłów', () => {
        // Pierwsze dodanie
        applySmartPartHandleWithScope(
            doc,
            front1A,
            { totalLengthMm: 160, holeDistanceMm: 128 },
            { faceZ: -9, normalZ: -1 },
            'MODULE'
        );
        expect(front1A.children.length).toBe(1);

        // Podmiana na inny model
        applySmartPartHandleWithScope(
            doc,
            front1A,
            { totalLengthMm: 200, holeDistanceMm: 160 },
            { faceZ: -9, normalZ: -1 },
            'MODULE'
        );
        expect(front1A.children.length).toBe(1);
        const handleGenParams = (front1A.children[0].domainData as any)?.generatorParams;
        expect(handleGenParams.holeDistanceMm).toBe(160);
    });
});
