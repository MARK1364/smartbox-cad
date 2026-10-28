import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { runEngineAndApply } from '../smartframe-adapter.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { findCabinetPanel } from '../../A1_core/panel-lookup.js';
import { SyncBackGroovesCommand } from '../commands/sync-back-grooves-command.js';
import '../../src/application/project-domain.js';
import { NativePanelBuilder } from '../../A4_smartpanel/native-panel-builder.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

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

        // NativePanelBuilder: wieniec ze scietym ukosem (ucios) ma wyciety wpust pod plecy na przestrzal (bez trojkatow na FACE_Y_PLUS)
        const builder = new NativePanelBuilder();
        const meshTop = builder.build(topNode.domainData);
        expect(meshTop.FACE_Z_PLUS).toBeDefined();
        expect(meshTop.FACE_Z_PLUS.indices.length).toBeGreaterThan(0);
        const topGrooveFeat = (topNode.domainData as any).features?.find((f: any) => f.params?.isBackGroove);
        expect(topGrooveFeat).toBeDefined();
        expect(meshTop[`feature_${topGrooveFeat.id}_bottom`]).toBeDefined();
        expect(meshTop[`feature_${topGrooveFeat.id}_w0`]).toBeDefined();
        expect(meshTop[`feature_${topGrooveFeat.id}_w1`]).toBeUndefined();
        expect(meshTop[`feature_${topGrooveFeat.id}_w2`]).toBeUndefined();
        expect(meshTop[`feature_${topGrooveFeat.id}_w3`]).toBeUndefined();

        // Tylna sciana FACE_Y_PLUS musi miec dokladnie 4 wierzcholki (1 quad ponizej dna wpustu z <= -2), zero pozostawionego trojkata
        expect(meshTop.FACE_Y_PLUS.positions.length).toBe(12);
        expect(meshTop.FACE_Y_PLUS.indices.length).toBe(6);
        for (let i = 2; i < meshTop.FACE_Y_PLUS.positions.length; i += 3) {
            expect(meshTop.FACE_Y_PLUS.positions[i]).toBeLessThanOrEqual(-2 + 1e-3);
        }

        // Boczki: gorna scianka wpustu (_w2) w boczku lewym i prawym jest scieta pod katem wienca (45°: spadek/wznios 11 mm na glebokosci 11 mm)
        const meshLeft = builder.build(leftNode.domainData);
        const leftFeatId = leftGrooves[0].id;
        const w2PosL = meshLeft[`feature_${leftFeatId}_w2`]?.positions as number[];
        expect(w2PosL).toBeDefined();
        const ysL = [w2PosL[1], w2PosL[4], w2PosL[7], w2PosL[10]];
        expect(Math.max(...ysL) - Math.min(...ysL)).toBeCloseTo(11, 2);
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

        // Wieniec górny: metoda CAD wyciągnięcia profilu trapezu na ściance bocznej przez szerokość wieńca
        expect(topGrooves[0].face).toBe('FACE_Z_PLUS');
        expect(bgTop.u).toBeCloseTo(0);
        expect(bgTop.width).toBeCloseTo(764);
        expect(bgTop.v).toBeCloseTo(0);
        expect(bgTop.length).toBeCloseTo(3); // wysokość trapezu = grubość pleców HDF (3 mm)
        expect(bgTop.depth).toBeCloseTo(11); // podstawa trapezu = margines górny pleców overlap_G (11 mm)

        const topCustom = (topNode.domainData as any).custom_properties?.backGrooveTrapezoid || (topNode.domainData as any).customProperties?.backGrooveTrapezoid;
        expect(topCustom).toBeDefined();
        expect(topCustom.grubosc_plecow_mm).toBe(3);
        expect(topCustom.margines_gorny_plecow_mm).toBeCloseTo(11);

        // Chrzest bojowy NativePanelBuilder: wieniec górny z wyciągniętym trapezem
        const builder = new NativePanelBuilder();
        const mesh = builder.build(topNode.domainData);
        expect(mesh.FACE_Z_PLUS).toBeDefined();
        expect(mesh.FACE_Z_MINUS).toBeDefined();
        expect(mesh.FACE_X_PLUS).toBeDefined();
        expect(mesh.FACE_X_MINUS).toBeDefined();
        expect(mesh.feature_feat_back_groove_bottom).toBeDefined();
        expect(mesh.feature_feat_back_groove_wall_front).toBeDefined();
        // Wpust U: cofniecie 18 mm > 3 mm (za plecami zostaje pasek sufitu 15 mm)
        expect(mesh.feature_feat_back_groove_wall_back).toBeDefined();

        // Dlugosc zewnetrzna dachu FACE_Z_MINUS zawsze wynosi pelne 1341.64 mm (wieniec sie NIE skraca)
        const zMinusPos = mesh.FACE_Z_MINUS.positions;
        const roofLen = Math.hypot(zMinusPos[3] - zMinusPos[0], zMinusPos[4] - zMinusPos[1], zMinusPos[5] - zMinusPos[2]);
        const p0_y = zMinusPos[1];
        const p1_y = zMinusPos[7];
        const p0_z = zMinusPos[2];
        const p1_z = zMinusPos[8];
        const spanLen = Math.hypot(p1_y - p0_y, p1_z - p0_z);
        expect(spanLen).toBeCloseTo(Math.hypot(600, 2200 - 1000), 1);

        // Gdy cofniecie <= 3 mm (brak materialu za plecami) -> powstaje schodek L (brak tylnej scianki)
        topCustom.backOffset = 3;
        const meshL = builder.build(topNode.domainData);
        expect(meshL.feature_feat_back_groove_bottom).toBeDefined();
        expect(meshL.feature_feat_back_groove_wall_front).toBeDefined();
        expect(meshL.feature_feat_back_groove_wall_back).toBeUndefined();
    });

    it('asocjacyjnie usuwa schodek L i cechę wpustu z wieńca górnego, gdy plecy spadną poniżej wieńca', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosnaDachDrop' }) as ContainerModel;
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

        // Generujemy szafkę
        runEngineAndApply(cabinet, 800, 2200, 600, 1, 0, 0, 18);

        const cabNode = doc.findNode(cabinet.id)!;
        const backNode = findCabinetPanel(cabNode, { role: 'BACK_PANEL' }).node!;
        const topNode = findCabinetPanel(cabNode, { role: 'TOP_PANEL' }).node!;

        // Początkowo wieniec ma wpust i schodek L
        let topGrooves = (topNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove) || [];
        expect(topGrooves).toHaveLength(1);
        expect((topNode.domainData as any).custom_properties?.backGrooveTrapezoid).toBeDefined();

        // Użytkownik ciągnie plecy w dół o 20 mm (poniżej dolnej krawędzi wieńca)
        const currentPos = backNode.localMatrix.decompose().translation;
        backNode.setTranslation(new Vec3(
            currentPos.x,
            currentPos.y,
            currentPos.z - 20000000 // -20 mm w nm
        ));

        // Uruchamiamy synchronizację wpustów
        new SyncBackGroovesCommand(cabinet.id).execute(doc);

        // Wpust na wieńcu górnym powinien zniknąć!
        topGrooves = (topNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove) || [];
        expect(topGrooves).toHaveLength(0);
        expect((topNode.domainData as any).custom_properties?.backGrooveTrapezoid).toBeUndefined();

        // NativePanelBuilder buduje pełną płytę bez schodka L
        const builder = new NativePanelBuilder();
        const mesh = builder.build(topNode.domainData);
        expect(mesh.feature_feat_back_groove_bottom).toBeUndefined();
    });
    it('asocjacyjnie przesuwa wpust na wiencu przy przesuwaniu plecow wzdluz Y i przelacza miedzy U a L bez skracania wienca', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosnaDachShiftY' }) as ContainerModel;
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
        const backNode = findCabinetPanel(cabNode, { role: 'BACK_PANEL' }).node!;
        const topNode = findCabinetPanel(cabNode, { role: 'TOP_PANEL' }).node!;
        const builder = new NativePanelBuilder();
        let mesh = builder.build(topNode.domainData);
        expect(mesh.feature_feat_back_groove_wall_back).toBeDefined();
        const pos1 = backNode.localMatrix.decompose().translation;
        backNode.setTranslation(new Vec3(pos1.x, pos1.y + 16000000, pos1.z));
        new SyncBackGroovesCommand(cabinet.id).execute(doc);
        mesh = builder.build(topNode.domainData);
        expect(mesh.feature_feat_back_groove_bottom).toBeDefined();
        expect(mesh.feature_feat_back_groove_wall_front).toBeDefined();
        expect(mesh.feature_feat_back_groove_wall_back).toBeUndefined();
        const zMinusPos = mesh.FACE_Z_MINUS.positions;
        const spanLen = Math.hypot(zMinusPos[7] - zMinusPos[1], zMinusPos[8] - zMinusPos[2]);
        expect(spanLen).toBeCloseTo(Math.hypot(600, 2200 - 1000), 1);
    });
    it('asocjacyjnie wydluza rowek na boczkach, gdy plecy przesuwaja sie w glab szafki pod wyzszy wieniec', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaBoczkiElongate' }) as ContainerModel;
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
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;
        let leftGrooves = (leftNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        let rightGrooves = (rightNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        const initialLenL = leftGrooves[0].params.length;
        const initialLenR = rightGrooves[0].params.length;
        cabinet.generatorParams.cofniecie_plecow_mm = 118;
        runEngineAndApply(cabinet, 800, 2200, 600, 1, 0, 0, 118);
        leftGrooves = (leftNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        rightGrooves = (rightNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        const newLenL = leftGrooves[0].params.length;
        const newLenR = rightGrooves[0].params.length;
        expect(newLenL).toBeGreaterThan(initialLenL + 195);
        expect(newLenL).toBeLessThan(initialLenL + 205);
        expect(newLenR).toBeCloseTo(newLenL, 1);
        expect(leftGrooves[0].params.u).toBeCloseTo(118 - 3, 1);
        expect(rightGrooves[0].params.u).toBeCloseTo(600 - 118, 1);
    });
    it('docina formatki (boki i wienca) do plecow w szafce skosnej, gdy margines plecow >= grubosc plyty', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosnaDocinanie' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_skosny_dach',
            liczba_stref: 1,
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            wysokosc_przod_mm: 2200,
            wysokosc_tyl_mm: 1000,
            cofniecie_plecow_mm: 18,
            offsets: {
                'Plecy_-X': 18,
                'Plecy_+X': 11,
                'Plecy_-Y': 18,
                'Plecy_+Y': 18
            }
        };
        runEngineAndApply(cabinet, 800, 2200, 600, 1, 0, 0, 18);
        const cabNode = doc.findNode(cabinet.id)!;
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;
        const botNode = findCabinetPanel(cabNode, { role: 'BOTTOM_PANEL' }).node!;
        const topNode = findCabinetPanel(cabNode, { role: 'TOP_PANEL' }).node!;
        const leftOutline = (leftNode.domainData as any).custom_properties?.outline2d || (leftNode.domainData as any).customProperties?.outline2d;
        expect(leftOutline[1][0]).toBeCloseTo(582, 0);
        expect(nmToMm(leftNode.localMatrix.decompose().translation.y)).toBeCloseTo(-9, 0);
        const leftGrooves = (leftNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove) || [];
        expect(leftGrooves).toHaveLength(0);

        const rightOutline = (rightNode.domainData as any).custom_properties?.outline2d || (rightNode.domainData as any).customProperties?.outline2d;
        expect(rightOutline[1][0]).toBeCloseTo(600, 0);
        const rightGrooves = (rightNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove) || [];
        expect(rightGrooves).toHaveLength(1);

        const botH = nmToMm(botNode.domainData.height || (botNode.domainData as any).length || 0);
        expect(botH).toBeCloseTo(582, 0);
        expect(nmToMm(botNode.localMatrix.decompose().translation.y)).toBeCloseTo(-9, 0);
        const botGrooves = (botNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove) || [];
        expect(botGrooves).toHaveLength(0);

        const expectedSlopeCut = Math.hypot(582, (582 / 600) * (2200 - 1000));
        const topH = nmToMm(topNode.domainData.height || (topNode.domainData as any).length || 0);
        expect(topH).toBeCloseTo(expectedSlopeCut, 0);
        expect((topNode.domainData as any).custom_properties?.backGrooveTrapezoid).toBeUndefined();
    });
    it('zarys wpustow w boczkach nie wychodzi poza obrys boczku przy skosie dachu i duzym marginesie gornym', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosnaTopBound' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_skosny_dach',
            liczba_stref: 1,
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            wysokosc_przod_mm: 2200,
            wysokosc_tyl_mm: 1000,
            cofniecie_plecow_mm: 18,
            offsets: {
                'Plecy_+Y': 60 // duzy margines gorny plecow
            }
        };

        runEngineAndApply(cabinet, 800, 2200, 600, 1, 0, 0, 18);

        const cabNode = doc.findNode(cabinet.id)!;
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        const leftGrooves = (leftNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        const rightGrooves = (rightNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);

        const bgLeft = leftGrooves[0].params;
        const bgRight = rightGrooves[0].params;

        // Boki przy skosie przod(2200)-tyl(1000) maja wysokosc na u=15..18 mm rowna max 1030 mm
        const topEdge_L = bgLeft.v + bgLeft.length;
        const topEdge_R = bgRight.v + bgRight.length;

        expect(topEdge_L).toBeLessThanOrEqual(1030.01);
        expect(topEdge_R).toBeLessThanOrEqual(1030.01);
    });

    it('zarys wpustow w boczkach korpus_skosny_lr_uc uwzglednia rozne sciete krawedzie boku lewego i prawego', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosnaLrTopBound' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_skosny_lr_uc',
            liczba_stref: 1,
            szerokosc_mm: 1200,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            wysokosc_lewy_mm: 1000,
            wysokosc_prawy_mm: 2200,
            cofniecie_plecow_mm: 3,
            offsets: {
                'B_PLECY_+Y': 60 // duzy margines gorny plecow
            }
        };

        runEngineAndApply(cabinet, 1200, 2200, 600, 1, 0, 0, 3);

        const cabNode = doc.findNode(cabinet.id)!;
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;

        const leftGrooves = (leftNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);
        const rightGrooves = (rightNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove);

        const bgLeft = leftGrooves[0].params;
        const bgRight = rightGrooves[0].params;

        // BOK_L: na licu wewnętrznym (Z+) max wysokość to hL(1000) + uskok(18) = 1018 mm,
        // a na dnie wpustu (głębokość 11 mm) ścianka opada pod kątem wieńca o 11*tan(45°)=11 mm do 1007 mm
        const topEdge_L = bgLeft.v + bgLeft.length;
        // BOK_P: na licu wewnętrznym (Z+) max wysokość to hR(2200) - uskok(18) = 2182 mm
        const topEdge_R = bgRight.v + bgRight.length;

        expect(topEdge_L).toBeLessThanOrEqual(1018.01);
        expect(topEdge_R).toBeLessThanOrEqual(2182.01);

        // NativePanelBuilder z hasEdgeCutConfig: krawedzie mesha nie przekraczaja beveled box,
        // a dno wpustu na glebokosci 11 mm konczy sie na wysokosci 1007 mm (y = 1007 - 1018/2 = 498)
        const builder = new NativePanelBuilder();
        const meshL = builder.build(leftNode.domainData);
        const meshR = builder.build(rightNode.domainData);

        expect(meshL.FACE_Z_PLUS).toBeDefined();
        expect(meshR.FACE_Z_PLUS).toBeDefined();

        const leftFeatId = leftGrooves[0].id;
        const botPosL = meshL[`feature_${leftFeatId}_bottom`]?.positions as number[];
        expect(botPosL).toBeDefined();
        const maxBotYL = Math.max(botPosL[1], botPosL[4], botPosL[7], botPosL[10]);
        expect(maxBotYL + 1018 / 2).toBeCloseTo(1007, 1);
    });

    it('usuwa wpusty z boczkow i wiencow gdy offset plecow jest ujemny (np. -10 mm — plecy cofnięte poza formatkę)', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'SzafkaSkosnaNegOffset' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_skosny_lr_uc',
            liczba_stref: 1,
            szerokosc_mm: 1200,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            wysokosc_lewy_mm: 1000,
            wysokosc_prawy_mm: 2200,
            cofniecie_plecow_mm: 3,
            offsets: {
                'B_PLECY_-X': -10,
                'B_PLECY_+X': -10,
                'B_PLECY_-Y': -10,
                'B_PLECY_+Y': -10
            }
        };

        runEngineAndApply(cabinet, 1200, 2200, 600, 1, 0, 0, 3);

        const cabNode = doc.findNode(cabinet.id)!;
        const leftNode = findCabinetPanel(cabNode, { role: 'LEFT_SIDE_PANEL' }).node!;
        const rightNode = findCabinetPanel(cabNode, { role: 'RIGHT_SIDE_PANEL' }).node!;
        const botNode = findCabinetPanel(cabNode, { role: 'BOTTOM_PANEL' }).node!;
        const topNode = findCabinetPanel(cabNode, { role: 'TOP_PANEL' }).node!;

        const leftGrooves = (leftNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove) || [];
        const rightGrooves = (rightNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove) || [];
        const botGrooves = (botNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove) || [];
        const topGrooves = (topNode.domainData as any).features?.filter((f: any) => f.params?.isBackGroove) || [];

        expect(leftGrooves).toHaveLength(0);
        expect(rightGrooves).toHaveLength(0);
        expect(botGrooves).toHaveLength(0);
        expect(topGrooves).toHaveLength(0);
    });
});
