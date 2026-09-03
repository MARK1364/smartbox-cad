import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { buildShelvesDrillings } from '../shelves-drilling-builder.js';
import { findCabinetPanel } from '../../A1_core/panel-lookup.js';

describe('Shelves Drilling Builder (buildShelvesDrillings)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('generates correct side drillings on LEFT_SIDE_PANEL and RIGHT_SIDE_PANEL for 1-zone cabinet', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 1-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;
        const leftSide = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightSide = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        // Dodaj SmartBox z 3 półkami (SINGLE)
        const sb = doc.createContainer({
            name: 'Polki_SB',
            width: mmToNm(764),
            height: mmToNm(1964),
            depth: mmToNm(560)
        }, cabinet.id);
        sb.generatorParams = {
            type: 'smartbox_shelves',
            shelfCount: 3,
            holePattern: 'SINGLE',
            targetZone: 'B',
            frontHoles: false,
            backHoles: false
        };

        const intents = buildShelvesDrillings(doc, cabinet.id);
        // 3 półki * 2 (lewa/prawa) * 2 (przód/tył) = 12 intentów na bokach
        expect(intents).toHaveLength(12);

        const leftIntents = intents.filter(i => i.targetNodeId === leftSide.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightSide.id);

        expect(leftIntents).toHaveLength(6);
        expect(rightIntents).toHaveLength(6);

        for (const intent of intents) {
            expect(intent.feature.face).toBe('FACE_Z_PLUS');
            expect(intent.feature.params.diameter).toBe(5);
            expect(intent.feature.params.depth).toBe(12);
            expect(intent.feature.params.isShelfDrilling).toBe(true);
            expect(intent.feature.params.u).toBeGreaterThanOrEqual(0);
            expect(intent.feature.params.v).toBeGreaterThanOrEqual(0);
        }
    });

    it('targets only zone M side panels in a 3-zone cabinet when targetZone is M', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 3-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 3 };
        runEngineAndApply(
            cabinet,
            mmToNm(1000),
            mmToNm(2400),
            mmToNm(600),
            3,
            mmToNm(500),
            mmToNm(1100),
            0
        );

        const cabinetNode = doc.findNode(cabinet.id)!;
        const leftM = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL', zoneId: 'M' }).node!;
        const rightM = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL', zoneId: 'M' }).node!;

        const sb = doc.createContainer({
            name: 'Polki_Srodkowe',
            width: mmToNm(964),
            height: mmToNm(1100),
            depth: mmToNm(560)
        }, cabinet.id);
        sb.generatorParams = {
            type: 'smartbox_shelves',
            shelfCount: 2,
            holePattern: 'SINGLE',
            targetZone: 'M'
        };

        const intents = buildShelvesDrillings(doc, cabinet.id);
        expect(intents.length).toBeGreaterThan(0);

        const leftIntents = intents.filter(i => i.targetNodeId === leftM.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightM.id);

        expect(leftIntents).toHaveLength(4); // 2 półki * 2 otwory
        expect(rightIntents).toHaveLength(4);
    });

    it('resolves correct zone panels by Z range when targetZone is FULL in 3-zone cabinet', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 3-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 3 };
        runEngineAndApply(
            cabinet,
            mmToNm(1000),
            mmToNm(2400),
            mmToNm(600),
            3,
            mmToNm(600),
            mmToNm(1200),
            0
        );

        const cabinetNode = doc.findNode(cabinet.id)!;
        const leftB = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL', zoneId: 'B' }).node!;
        const leftM = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL', zoneId: 'M' }).node!;
        const leftT = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL', zoneId: 'T' }).node!;

        // SmartBox w strefie FULL o wysokości całego korpusu (2400 mm) z 5 półkami
        const sb = doc.createContainer({
            name: 'Polki_Full',
            width: mmToNm(964),
            height: mmToNm(2400),
            depth: mmToNm(560)
        }, cabinet.id);
        sb.generatorParams = {
            type: 'smartbox_shelves',
            shelfCount: 5,
            holePattern: 'SINGLE',
            targetZone: 'FULL'
        };

        const intents = buildShelvesDrillings(doc, cabinet.id);
        expect(intents.length).toBeGreaterThan(0);

        // Półka 1 leży w strefie B (400mm) -> otwory na B_BOK_L
        // Półki 2,3,4 leżą w strefie M (800, 1200, 1600mm) -> otwory na M_BOK_L
        // Półka 5 leży w strefie T (2000mm) -> otwory na T_BOK_L
        const leftBIntents = intents.filter(i => i.targetNodeId === leftB.id);
        const leftMIntents = intents.filter(i => i.targetNodeId === leftM.id);
        const leftTIntents = intents.filter(i => i.targetNodeId === leftT.id);

        expect(leftBIntents.length).toBeGreaterThan(0);
        expect(leftMIntents.length).toBeGreaterThan(0);
        expect(leftTIntents.length).toBeGreaterThan(0);
    });

    it('handles missing side panel safely without creating intents for that side', () => {
        const cabinet = doc.createContainer({ name: 'Korpus' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;
        const rightSide = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL' }).node!;
        // Usuń prawy bok ze sceny
        doc.removeNode(rightSide.id);

        const sb = doc.createContainer({
            name: 'Polki_SB',
            width: mmToNm(764),
            height: mmToNm(1964),
            depth: mmToNm(560)
        }, cabinet.id);
        sb.generatorParams = {
            type: 'smartbox_shelves',
            shelfCount: 2,
            holePattern: 'SINGLE',
            targetZone: 'B'
        };

        const intents = buildShelvesDrillings(doc, cabinet.id);
        // Otwory powinny powstać tylko na lewym boku (4 otwory)
        const leftSide = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const leftIntents = intents.filter(i => i.targetNodeId === leftSide.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightSide.id);

        expect(leftIntents).toHaveLength(4);
        expect(rightIntents).toHaveLength(0);
    });

    it('regression: matches exact geometry and feature structure for TRIPLE pattern with center holes', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 1-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;
        const leftSide = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightSide = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        const sb = doc.createContainer({
            name: 'Polki_Triple',
            width: mmToNm(764),
            height: mmToNm(1964),
            depth: mmToNm(560)
        }, cabinet.id);
        sb.generatorParams = {
            type: 'smartbox_shelves',
            shelfCount: 1,
            holePattern: 'TRIPLE',
            tripleZOffset: 32,
            targetZone: 'B',
            frontHoles: true,
            backHoles: true,
            frontOffsetX: 10,
            backOffsetX: -10
        };

        // Utwórz formatkę półki pod SmartBoxem
        const shelfPanel = new PanelModel({
            name: 'Polka_1',
            role: 'SHELF',
            width: mmToNm(763),
            height: mmToNm(550),
            thickness: mmToNm(18)
        });
        const shelfNode = CADNode.create(NodeType.PART, 'Polka_1', shelfPanel.id);
        shelfNode.domainData = shelfPanel;
        const sbCADNode = doc.findNode(sb.id)!;
        sbCADNode.addChild(shelfNode);

        const intents = buildShelvesDrillings(doc, cabinet.id);

        // Bok lewy: 3 poziomy (center, top, bottom) * 2 otwory (front, back) = 6
        // Bok prawy: 3 poziomy * 2 otwory = 6
        // Półka: 3 poziomy * 2 otwory (front, back) = 6
        // Łącznie: 18 intentów
        expect(intents).toHaveLength(18);

        const leftIntents = intents.filter(i => i.targetNodeId === leftSide.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightSide.id);
        const shelfIntents = intents.filter(i => i.targetNodeId === shelfNode.id);

        expect(leftIntents).toHaveLength(6);
        expect(rightIntents).toHaveLength(6);
        expect(shelfIntents).toHaveLength(6);

        // Sprawdź geometrię otworów boku lewego
        const leftCenterFront = leftIntents.find(i => i.feature.id === 'shelf_1_left_front')!;
        expect(leftCenterFront).toBeDefined();
        expect(leftCenterFront.feature.face).toBe('FACE_Z_PLUS');
        expect(leftCenterFront.feature.params.diameter).toBe(5);
        expect(leftCenterFront.feature.params.depth).toBe(12);

        // Sprawdź otwory na samej półce
        const shelfFrontCenter = shelfIntents.find(i => i.feature.id === 'shelf_1_front_center')!;
        expect(shelfFrontCenter).toBeDefined();
        expect(shelfFrontCenter.feature.face).toBe('FACE_Y_PLUS');
    });

    it('regression: matches exact geometry and feature structure for SYSTEM_32 pattern', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 1-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;
        const leftSide = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightSide = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        const sb = doc.createContainer({
            name: 'Polki_Sys32',
            width: mmToNm(764),
            height: mmToNm(1000),
            depth: mmToNm(560)
        }, cabinet.id);
        sb.generatorParams = {
            type: 'smartbox_shelves',
            holePattern: 'SYSTEM_32',
            system32Spacing: 32,
            system32StartOffset: 100,
            system32HoleCount: 5,
            targetZone: 'B'
        };

        const intents = buildShelvesDrillings(doc, cabinet.id);
        // 5 otworów * 2 (front/back) * 2 (lewa/prawa) = 20 intentów
        expect(intents).toHaveLength(20);

        const leftIntents = intents.filter(i => i.targetNodeId === leftSide.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightSide.id);

        expect(leftIntents).toHaveLength(10);
        expect(rightIntents).toHaveLength(10);

        for (let k = 0; k < 5; k++) {
            expect(leftIntents.some(i => i.feature.id === `sys32_left_front_${k}`)).toBe(true);
            expect(leftIntents.some(i => i.feature.id === `sys32_left_back_${k}`)).toBe(true);
            expect(rightIntents.some(i => i.feature.id === `sys32_right_front_${k}`)).toBe(true);
            expect(rightIntents.some(i => i.feature.id === `sys32_right_back_${k}`)).toBe(true);
        }
    });
});
