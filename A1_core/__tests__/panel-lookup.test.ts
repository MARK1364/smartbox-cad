import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { ContextManager } from '../context-manager.js';
import { CADNode } from '../cad-node/cad-node.js';
import { NodeType } from '../cad-node/node-type.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm } from '../cad-math/units.js';
import {
    findCabinetPanel,
    findCabinetPanels,
    type CabinetPanelRole
} from '../panel-lookup.js';

describe('Panel Lookup (findCabinetPanel / findCabinetPanels)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('resolves all 5 carpentry roles in a 1-zone cabinet', () => {
        const cabinet = doc.createContainer({ name: 'Korpus 1-strefowy' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id);
        expect(cabinetNode).toBeDefined();

        const roles: CabinetPanelRole[] = [
            'LEFT_SIDE_PANEL',
            'RIGHT_SIDE_PANEL',
            'BOTTOM_PANEL',
            'TOP_PANEL',
            'BACK_PANEL'
        ];

        for (const role of roles) {
            const res = findCabinetPanel(cabinetNode, { role });
            expect(res.status, `Failed to find role ${role}`).toBe('OK');
            expect(res.node).toBeDefined();
            expect(res.panel).toBeDefined();
            expect(res.panel?.role).toBe(role);
            expect(res.panel?.zoneId).toBe('SEKCJA_B');
            expect(res.candidatesCount).toBe(1);
        }
    });

    it('resolves specific zone panels in a 3-zone cabinet using aliases B, M, T and canonical names', () => {
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

        const cabinetNode = doc.findNode(cabinet.id);
        expect(cabinetNode).toBeDefined();

        // Strefa dolna przez alias 'B'
        const leftB = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL', zoneId: 'B' });
        expect(leftB.status).toBe('OK');
        expect(leftB.panel?.zoneId).toBe('SEKCJA_B');
        expect(leftB.panel?.zonePrefix).toBe('B_');

        // Strefa środkowa przez 'SEKCJA_M'
        const rightM = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL', zoneId: 'SEKCJA_M' });
        expect(rightM.status).toBe('OK');
        expect(rightM.panel?.zoneId).toBe('SEKCJA_M');
        expect(rightM.panel?.zonePrefix).toBe('M_');

        // Strefa górna przez 'TOP'
        const topT = findCabinetPanel(cabinetNode, { role: 'TOP_PANEL', zoneId: 'TOP' });
        expect(topT.status).toBe('OK');
        expect(topT.panel?.zoneId).toBe('SEKCJA_T');
        expect(topT.panel?.zonePrefix).toBe('T_');
    });

    it('returns MULTIPLE_FOUND when querying multi-zone cabinet without zoneId', () => {
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

        const cabinetNode = doc.findNode(cabinet.id);
        const res = findCabinetPanel(cabinetNode, { role: 'RIGHT_SIDE_PANEL' });

        expect(res.status).toBe('MULTIPLE_FOUND');
        expect(res.node).toBeNull();
        expect(res.panel).toBeNull();
        expect(res.candidatesCount).toBe(3);
        expect(res.candidateZoneIds).toEqual(['SEKCJA_B', 'SEKCJA_M', 'SEKCJA_T']);
        expect(res.message).toContain('Znaleziono 3 formatek');
    });

    it('returns INVALID_ZONE with diagnostic message when zoneId is invalid', () => {
        const cabinet = doc.createContainer({ name: 'Korpus' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id);
        const res = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL', zoneId: 'X' });

        expect(res.status).toBe('INVALID_ZONE');
        expect(res.node).toBeNull();
        expect(res.candidatesCount).toBe(0);
        expect(res.message).toContain('Nieprawidłowy identyfikator strefy: "X"');
    });

    it('returns NOT_FOUND when panel role does not exist', () => {
        const cabinet = doc.createContainer({ name: 'Korpus' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id);
        const res = findCabinetPanel(cabinetNode, { role: 'NON_EXISTING_ROLE' as any });

        expect(res.status).toBe('NOT_FOUND');
        expect(res.node).toBeNull();
        expect(res.candidatesCount).toBe(0);
    });

    it('skips SmartBox subtrees completely', () => {
        const cabinet = doc.createContainer({ name: 'Korpus' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;

        // Dodaj węzeł SmartBox pod korpusem (nazwa celowo bez żadnego sufiksu _SB)
        const sbNode = CADNode.create(NodeType.ASSEMBLY, 'ModulWewnetrznyPolki');
        sbNode.domainData = {
            type: 'container',
            generatorParams: { type: 'smartbox_shelves', boxType: 'SHELVES' }
        } as any;

        // Dodaj formatkę półki wewnątrz SmartBoxa o roli BOTTOM_PANEL
        const shelfPanel = new PanelModel({
            name: 'Polka_Wewnetrzna',
            role: 'BOTTOM_PANEL',
            zoneId: 'SEKCJA_B'
        });
        const shelfNode = CADNode.create(NodeType.PART, 'Polka_Wewnetrzna', shelfPanel.id);
        shelfNode.domainData = shelfPanel;
        sbNode.addChild(shelfNode);
        cabinetNode.addChild(sbNode);

        // Szukanie BOTTOM_PANEL w korpusie musi znaleźć wyłącznie wieniec dolny korpusu, a nie półkę SmartBoxa
        const bottom = findCabinetPanel(cabinetNode, { role: 'BOTTOM_PANEL' });
        expect(bottom.status).toBe('OK');
        expect(bottom.panel?.name).not.toBe('Polka_Wewnetrzna');
        expect(bottom.candidatesCount).toBe(1);
    });

    it('skips manual panels (engineManaged: false / isManualPanel)', () => {
        const cabinet = doc.createContainer({ name: 'Korpus' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;

        const manualPanel = new PanelModel({
            name: 'Wzmocnienie_Reczne',
            role: 'BOTTOM_PANEL',
            engineManaged: false
        });
        const manualNode = CADNode.create(NodeType.PART, 'Wzmocnienie_Reczne', manualPanel.id);
        manualNode.domainData = manualPanel;
        cabinetNode.addChild(manualNode);

        const res = findCabinetPanel(cabinetNode, { role: 'BOTTOM_PANEL' });
        expect(res.status).toBe('OK');
        expect(res.panel?.name).not.toBe('Wzmocnienie_Reczne');
        expect(res.candidatesCount).toBe(1);
    });

    it('consistently resolves panels after cabinet rebuild/update', () => {
        const cabinet = doc.createContainer({ name: 'Korpus' });
        cabinet.generatorParams = { type: 'korpus3_2', zoneCount: 1 };
        runEngineAndApply(cabinet, mmToNm(800), mmToNm(2000), mmToNm(600), 1, 0, 0, 0);

        const cabinetNode = doc.findNode(cabinet.id)!;
        const initialLeft = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL' });
        expect(initialLeft.status).toBe('OK');

        // Przebudowa o nowych wymiarach
        runEngineAndApply(cabinet, mmToNm(1000), mmToNm(2200), mmToNm(700), 1, 0, 0, 0);

        const updatedLeft = findCabinetPanel(cabinetNode, { role: 'LEFT_SIDE_PANEL' });
        expect(updatedLeft.status).toBe('OK');
        expect(updatedLeft.panel?.width).toBe(mmToNm(2200)); // H boku
        expect(updatedLeft.panel?.role).toBe('LEFT_SIDE_PANEL');
    });
});
