import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { runEngineAndApply } from '../smartframe-adapter.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { findCabinetPanel } from '../../A1_core/panel-lookup.js';
import { SyncBackGroovesCommand } from '../commands/sync-back-grooves-command.js';
import '../../src/application/project-domain.js';

describe('skosny-back-grooves (wpusty dookoła na 4 formatkach szafki skośnej)', () => {
    it('generuje wpusty na wszystkich 4 formatkach korpus_skosny_lr_uc', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosna' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_skosny_lr_uc',
            liczba_stref: 1,
            szerokosc_mm: 1200,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            wysokosc_lewy_mm: 1000,
            wysokosc_prawy_mm: 2200,
            cofniecie_plecow_mm: 3
        };

        runEngineAndApply(cabinet, 1200, 2200, 600, 1, 0, 0, 3);

        const cabNode = doc.findNode(cabinet.id)!;
        const botNode = findCabinetPanel(cabNode, { role: 'BOTTOM_PANEL' }).node!;
        const topNode = findCabinetPanel(cabNode, { role: 'TOP_PANEL' }).node!;
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        const botGrooves = (botNode.domainData as any).features?.filter((f: any) => f.type === 'groove' && f.params?.isBackGroove);
        const topGrooves = (topNode.domainData as any).features?.filter((f: any) => f.type === 'groove' && f.params?.isBackGroove);
        const leftGrooves = (leftNode.domainData as any).features?.filter((f: any) => f.type === 'groove' && f.params?.isBackGroove);
        const rightGrooves = (rightNode.domainData as any).features?.filter((f: any) => f.type === 'groove' && f.params?.isBackGroove);

        expect(botGrooves).toHaveLength(1);
        expect(topGrooves).toHaveLength(1);
        expect(leftGrooves).toHaveLength(1);
        expect(rightGrooves).toHaveLength(1);

        const bgBot = botGrooves[0].params;
        const bgTop = topGrooves[0].params;
        const bgLeft = leftGrooves[0].params;
        const bgRight = rightGrooves[0].params;

        // Wieniec dolny: u=0, width = 1200 - 36 = 1164, v = 600 - 3 = 597, length = 3, depth = 11
        expect(bgBot.u).toBeCloseTo(0);
        expect(bgBot.width).toBeCloseTo(1164);
        expect(bgBot.v).toBeCloseTo(597);
        expect(bgBot.length).toBeCloseTo(3);
        expect(bgBot.depth).toBeCloseTo(11);

        // Wieniec górny (dach): u=0, width = slopeLen ≈ 1646.145, v = 597, length = 3, depth = 11
        const slopeLen = Math.hypot(1164, 1164 * ((2200 - 1000) / 1200));
        expect(bgTop.u).toBeCloseTo(0);
        expect(bgTop.width).toBeCloseTo(slopeLen);
        expect(bgTop.v).toBeCloseTo(597);
        expect(bgTop.length).toBeCloseTo(3);
        expect(bgTop.depth).toBeCloseTo(11);

        // Bok lewy: u = 3 - 3 = 0, width = 3, v_start = 18 - 11 = 7, depth = 11
        expect(bgLeft.u).toBeCloseTo(0);
        expect(bgLeft.width).toBeCloseTo(3);
        expect(bgLeft.v).toBeCloseTo(7);
        expect(bgLeft.depth).toBeCloseTo(11);
        expect(bgLeft.length).toBeGreaterThan(900);
        expect(bgLeft.length).toBeLessThan(1050);

        // Bok prawy: u = 600 - 3 = 597, width = 3, v_start = 7, depth = 11
        expect(bgRight.u).toBeCloseTo(597);
        expect(bgRight.width).toBeCloseTo(3);
        expect(bgRight.v).toBeCloseTo(7);
        expect(bgRight.depth).toBeCloseTo(11);
        expect(bgRight.length).toBeGreaterThan(2100);
        expect(bgRight.length).toBeLessThan(2200);
    });

    it('asocjacyjnie reaguje na zmianę offsetów gizm i cofnięcia pleców', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosna' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_skosny_lr_uc',
            liczba_stref: 1,
            szerokosc_mm: 1200,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            wysokosc_lewy_mm: 1000,
            wysokosc_prawy_mm: 2200,
            cofniecie_plecow_mm: 18,
            offsets: {
                'B_PLECY_-X': 15,
                'B_PLECY_+X': 14,
                'B_PLECY_-Y': 13,
                'B_PLECY_+Y': 12
            }
        };

        runEngineAndApply(cabinet, 1200, 2200, 600, 1, 0, 0, 18);

        const cabNode = doc.findNode(cabinet.id)!;
        const botNode = findCabinetPanel(cabNode, { role: 'BOTTOM_PANEL' }).node!;
        const topNode = findCabinetPanel(cabNode, { role: 'TOP_PANEL' }).node!;
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        const bgBot = (botNode.domainData as any).features.find((f: any) => f.params?.isBackGroove).params;
        const bgTop = (topNode.domainData as any).features.find((f: any) => f.params?.isBackGroove).params;
        const bgLeft = (leftNode.domainData as any).features.find((f: any) => f.params?.isBackGroove).params;
        const bgRight = (rightNode.domainData as any).features.find((f: any) => f.params?.isBackGroove).params;

        // Głębokości odpowiadają offsetom
        expect(bgLeft.depth).toBeCloseTo(15);
        expect(bgRight.depth).toBeCloseTo(14);
        expect(bgBot.depth).toBeCloseTo(13);
        expect(bgTop.depth).toBeCloseTo(12);

        // Pozycje cofnięcia (18 mm od tyłu)
        expect(bgBot.v).toBeCloseTo(600 - 18);
        expect(bgTop.v).toBeCloseTo(600 - 18);
        expect(bgLeft.u).toBeCloseTo(18 - 3);
        expect(bgRight.u).toBeCloseTo(600 - 18);
    });

    it('nie generuje wpustów, gdy plecy są ukryte', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosna' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_skosny_lr_uc',
            liczba_stref: 1,
            szerokosc_mm: 1200,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            wysokosc_lewy_mm: 1000,
            wysokosc_prawy_mm: 2200,
            cofniecie_plecow_mm: 3
        };

        runEngineAndApply(cabinet, 1200, 2200, 600, 1, 0, 0, 3);

        const cabNode = doc.findNode(cabinet.id)!;
        const backNode = findCabinetPanel(cabNode, { role: 'BACK_PANEL' }).node!;
        (backNode.domainData as any).visible = false;

        // Uruchamiamy ponowną synchronizację wpustów
        new SyncBackGroovesCommand(cabinet.id).execute(doc);

        const botNode = findCabinetPanel(cabNode, { role: 'BOTTOM_PANEL' }).node!;
        const botGrooves = (botNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove) || [];
        expect(botGrooves).toHaveLength(0);
    });

    it('generuje wpusty na wszystkich 4 formatkach korpus_skosny_lr', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosnaLR' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_skosny_lr',
            liczba_stref: 1,
            szerokosc_mm: 1200,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            wysokosc_lewy_mm: 1000,
            wysokosc_prawy_mm: 2200,
            cofniecie_plecow_mm: 3
        };

        runEngineAndApply(cabinet, 1200, 2200, 600, 1, 0, 0, 3);

        const cabNode = doc.findNode(cabinet.id)!;
        const botNode = findCabinetPanel(cabNode, { role: 'BOTTOM_PANEL' }).node!;
        const topNode = findCabinetPanel(cabNode, { role: 'TOP_PANEL' }).node!;
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        const botGrooves = (botNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        const topGrooves = (topNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        const leftGrooves = (leftNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        const rightGrooves = (rightNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);

        expect(botGrooves).toHaveLength(1);
        expect(topGrooves).toHaveLength(1);
        expect(leftGrooves).toHaveLength(1);
        expect(rightGrooves).toHaveLength(1);
    });

    it('generuje wpusty na wszystkich 4 formatkach korpus_skosny_dach', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosnaDach' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_skosny_dach',
            liczba_stref: 1,
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            wysokosc_przod_mm: 2200,
            wysokosc_tyl_mm: 1000,
            cofniecie_plecow_mm: 18
        };

        runEngineAndApply(cabinet, 800, 2200, 600, 1, 0, 0, 18);

        const cabNode = doc.findNode(cabinet.id)!;
        const botNode = findCabinetPanel(cabNode, { role: 'BOTTOM_PANEL' }).node!;
        const topNode = findCabinetPanel(cabNode, { role: 'TOP_PANEL' }).node!;
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        const botGrooves = (botNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        const topGrooves = (topNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        const leftGrooves = (leftNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        const rightGrooves = (rightNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);

        expect(botGrooves).toHaveLength(1);
        expect(topGrooves).toHaveLength(1);
        expect(leftGrooves).toHaveLength(1);
        expect(rightGrooves).toHaveLength(1);

        const bgBot = botGrooves[0].params;
        const bgTop = topGrooves[0].params;

        // Wieniec dolny: u=0, width = 800 - 36 = 764, v = 600 - 18 = 582, length = 3, depth = 11
        expect(bgBot.u).toBeCloseTo(0);
        expect(bgBot.width).toBeCloseTo(764);
        expect(bgBot.v).toBeCloseTo(582);
        expect(bgBot.length).toBeCloseTo(3);
        expect(bgBot.depth).toBeCloseTo(11);

        // Wieniec górny: u=0, width = 764, v tuż przy tylnej krawędzi (slopeLen - 18*k_skos ≈ 1301.39), length = 3*k_skos ≈ 6.71
        const slopeD = Math.hypot(600, 1200);
        const kSkos = slopeD / 600;
        expect(bgTop.u).toBeCloseTo(0);
        expect(bgTop.width).toBeCloseTo(764);
        expect(bgTop.v).toBeCloseTo(slopeD - 18 * kSkos, 1);
        expect(bgTop.length).toBeCloseTo(3 * kSkos, 1);
        expect(bgTop.depth).toBeCloseTo(11);
    });
});
