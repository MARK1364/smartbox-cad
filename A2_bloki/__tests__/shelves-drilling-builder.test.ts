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
import { ContainerModel } from '../../A1_core/container-model.js';

describe('Shelves Drilling Builder (buildShelvesDrillings)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('generates correct side drillings on LEFT_SIDE_PANEL and RIGHT_SIDE_PANEL for 1-zone cabinet', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus 1-strefowy' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;
        const leftSide = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightSide = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        // Dodaj Bloki z 3 pĂłĹ‚kami (SINGLE)
        const sb = doc.createAssembly({
            name: 'Polki_SB',
            width: mmToNm(764),
            height: mmToNm(1964),
            depth: mmToNm(560)
        }, cabinet.id) as ContainerModel;
        sb.generatorParams = {
            type: 'blok_shelves',
            liczba_polek: 3,
            wzor_nawiercen: 'SINGLE',
            targetZone: 'B',
            otwory_przod_aktywne: false,
            otwory_tyl_aktywne: false
        };

        const intents = buildShelvesDrillings(doc, cabinet.id);
        // 3 pĂłĹ‚ki * 2 (lewa/prawa) * 2 (przĂłd/tyĹ‚) = 12 intentĂłw na bokach
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
        const cabinet = doc.createAssembly({ name: 'Korpus 3-strefowy' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 3 };
        runEngineAndApply(
            cabinet,
            1000,
            2400,
            600,
            3,
            500,
            1100,
            0
        );

        const cabinetNode = doc.findNode(cabinet.id)!;
        const leftM = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL', zoneId: 'M' }).node!;
        const rightM = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL', zoneId: 'M' }).node!;

        const sb = doc.createAssembly({
            name: 'Polki_Srodkowe',
            width: mmToNm(964),
            height: mmToNm(1100),
            depth: mmToNm(560)
        }, cabinet.id) as ContainerModel;
        sb.generatorParams = {
            type: 'blok_shelves',
            liczba_polek: 2,
            wzor_nawiercen: 'SINGLE',
            targetZone: 'M'
        };

        const intents = buildShelvesDrillings(doc, cabinet.id);
        expect(intents.length).toBeGreaterThan(0);

        const leftIntents = intents.filter(i => i.targetNodeId === leftM.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightM.id);

        expect(leftIntents).toHaveLength(4); // 2 pĂłĹ‚ki * 2 otwory
        expect(rightIntents).toHaveLength(4);
    });

    it('resolves correct zone panels by Z range when targetZone is FULL in 3-zone cabinet', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus 3-strefowy' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 3 };
        runEngineAndApply(
            cabinet,
            1000,
            2400,
            600,
            3,
            600,
            1200,
            0
        );

        const cabinetNode = doc.findNode(cabinet.id)!;
        const leftB = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL', zoneId: 'B' }).node!;
        const leftM = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL', zoneId: 'M' }).node!;
        const leftT = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL', zoneId: 'T' }).node!;

        // Bloki w strefie FULL o wysokoĹ›ci caĹ‚ego korpusu (2400 mm) z 5 pĂłĹ‚kami
        const sb = doc.createAssembly({
            name: 'Polki_Full',
            width: mmToNm(964),
            height: mmToNm(2400),
            depth: mmToNm(560)
        }, cabinet.id) as ContainerModel;
        sb.generatorParams = {
            type: 'blok_shelves',
            liczba_polek: 5,
            wzor_nawiercen: 'SINGLE',
            targetZone: 'FULL'
        };

        const intents = buildShelvesDrillings(doc, cabinet.id);
        expect(intents.length).toBeGreaterThan(0);

        // PĂłĹ‚ka 1 leĹĽy w strefie B (400mm) -> otwory na B_BOK_L
        // PĂłĹ‚ki 2,3,4 leĹĽÄ… w strefie M (800, 1200, 1600mm) -> otwory na M_BOK_L
        // PĂłĹ‚ka 5 leĹĽy w strefie T (2000mm) -> otwory na T_BOK_L
        const leftBIntents = intents.filter(i => i.targetNodeId === leftB.id);
        const leftMIntents = intents.filter(i => i.targetNodeId === leftM.id);
        const leftTIntents = intents.filter(i => i.targetNodeId === leftT.id);

        expect(leftBIntents.length).toBeGreaterThan(0);
        expect(leftMIntents.length).toBeGreaterThan(0);
        expect(leftTIntents.length).toBeGreaterThan(0);
    });

    it('handles missing side panel safely without creating intents for that side', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;
        const rightSide = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL' }).node!;
        // UsuĹ„ prawy bok ze sceny
        doc.removeNode(rightSide.id);

        const sb = doc.createAssembly({
            name: 'Polki_SB',
            width: mmToNm(764),
            height: mmToNm(1964),
            depth: mmToNm(560)
        }, cabinet.id) as ContainerModel;
        sb.generatorParams = {
            type: 'blok_shelves',
            liczba_polek: 2,
            wzor_nawiercen: 'SINGLE',
            targetZone: 'B'
        };

        const intents = buildShelvesDrillings(doc, cabinet.id);
        // Otwory powinny powstaÄ‡ tylko na lewym boku (4 otwory)
        const leftSide = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const leftIntents = intents.filter(i => i.targetNodeId === leftSide.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightSide.id);

        expect(leftIntents).toHaveLength(4);
        expect(rightIntents).toHaveLength(0);
    });

    it('regression: matches exact geometry and feature structure for TRIPLE pattern with center holes', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus 1-strefowy' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;
        const leftSide = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightSide = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        const sb = doc.createAssembly({
            name: 'Polki_Triple',
            width: mmToNm(764),
            height: mmToNm(1964),
            depth: mmToNm(560)
        }, cabinet.id) as ContainerModel;
        sb.generatorParams = {
            type: 'blok_shelves',
            liczba_polek: 1,
            wzor_nawiercen: 'TRIPLE',
            rozstaw_potrojny_z_mm: 32,
            targetZone: 'B',
            otwory_przod_aktywne: true,
            otwory_tyl_aktywne: true,
            przesuniecie_otworow_przod_x_mm: 10,
            przesuniecie_otworow_tyl_x_mm: -10
        };

        // UtwĂłrz formatkÄ™ pĂłĹ‚ki pod Blokiem
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
        // PĂłĹ‚ka: 3 poziomy * 2 otwory (front, back) = 6
        // ĹÄ…cznie: 18 intentĂłw
        expect(intents).toHaveLength(18);

        const leftIntents = intents.filter(i => i.targetNodeId === leftSide.id);
        const rightIntents = intents.filter(i => i.targetNodeId === rightSide.id);
        const shelfIntents = intents.filter(i => i.targetNodeId === shelfNode.id);

        expect(leftIntents).toHaveLength(6);
        expect(rightIntents).toHaveLength(6);
        expect(shelfIntents).toHaveLength(6);

        // SprawdĹş geometriÄ™ otworĂłw boku lewego
        const leftCenterFront = leftIntents.find(i => i.feature.id === 'shelf_1_left_front')!;
        expect(leftCenterFront).toBeDefined();
        expect(leftCenterFront.feature.face).toBe('FACE_Z_PLUS');
        expect(leftCenterFront.feature.params.diameter).toBe(5);
        expect(leftCenterFront.feature.params.depth).toBe(12);

        // Otwory na półce: TRIPLE przód/tył w pionie (V), nie w poziomie (U)
        const shelfFrontCenter = shelfIntents.find(i => i.feature.id === 'shelf_1_front_center')!;
        const shelfFrontTop = shelfIntents.find(i => i.feature.id === 'shelf_1_front_center_top')!;
        const shelfFrontBottom = shelfIntents.find(i => i.feature.id === 'shelf_1_front_center_bottom')!;
        expect(shelfFrontCenter).toBeDefined();
        expect(shelfFrontTop).toBeDefined();
        expect(shelfFrontBottom).toBeDefined();
        expect(shelfFrontCenter.feature.face).toBe('FACE_Y_PLUS');
        expect(shelfFrontTop.feature.params.u).toBe(shelfFrontCenter.feature.params.u);
        expect(shelfFrontBottom.feature.params.u).toBe(shelfFrontCenter.feature.params.u);
        expect(shelfFrontTop.feature.params.v).toBe(shelfFrontCenter.feature.params.v - 32);
        expect(shelfFrontBottom.feature.params.v).toBe(shelfFrontCenter.feature.params.v + 32);

        const shelfBackCenter = shelfIntents.find(i => i.feature.id === 'shelf_1_back_center')!;
        const shelfBackTop = shelfIntents.find(i => i.feature.id === 'shelf_1_back_center_top')!;
        const shelfBackBottom = shelfIntents.find(i => i.feature.id === 'shelf_1_back_center_bottom')!;
        expect(shelfBackCenter).toBeDefined();
        expect(shelfBackTop.feature.params.u).toBe(shelfBackCenter.feature.params.u);
        expect(shelfBackBottom.feature.params.u).toBe(shelfBackCenter.feature.params.u);
        expect(shelfBackTop.feature.params.v).toBe(shelfBackCenter.feature.params.v + 32);
        expect(shelfBackBottom.feature.params.v).toBe(shelfBackCenter.feature.params.v - 32);
    });

    it('regression: matches exact geometry and feature structure for SYSTEM_32 pattern', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus 1-strefowy' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        runEngineAndApply(cabinet, 800, 2000, 600, 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;
        const leftSide = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightSide = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        const sb = doc.createAssembly({
            name: 'Polki_Sys32',
            width: mmToNm(764),
            height: mmToNm(1000),
            depth: mmToNm(560)
        }, cabinet.id) as ContainerModel;
        sb.generatorParams = {
            type: 'blok_shelves',
            wzor_nawiercen: 'SYSTEM_32',
            rozstaw_system32_mm: 32,
            start_system32_z_mm: 100,
            liczba_otworow_system32: 5,
            targetZone: 'B'
        };

        const intents = buildShelvesDrillings(doc, cabinet.id);
        // 5 otworĂłw * 2 (front/back) * 2 (lewa/prawa) = 20 intentĂłw
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
