import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { probeBayFromCADPoint } from '../02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../02_bloki-bay-actions.js';
import { registerBlokiModule } from '../01_register.js';
import { createRebuildGeometry } from '../../src/application/geometry-rebuild.js';
import { registerPanelViewAdapter, registerContainerViewAdapter } from '../../A1_core/view-port.js';
import { NativePanelBuilder } from '../../A4_smartpanel/native-panel-builder.js';
import { SyncShelfDrillingsCommand } from '../commands/sync-shelf-drillings-command.js';
import { SyncDoorDrillingsCommand } from '../commands/sync-door-drillings-command.js';
import { applyLibraryOperation } from '../../o1_operacji/operacje-apply.js';
import { createSmartPartHandle } from '../handles/handle-apply.js';
import { resolveHandleColor } from '../handles/handle-types.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { ensurePanelHasCncProgram } from '../../C1_cnc/core/cam-auto-program.js';

describe('Szafa 2500x800x560 - generowanie modelu 3D', () => {
    it('tworzy pełnoprawną szafę z korpusem, półkami i 2 frontami', () => {
        const doc = new ProjectDocument({ name: 'Szafa 2500x800x560' });
        (ContextManager.instance as any).document = doc;
        (ContextManager.instance as any).commandHistory = new CommandHistory(doc);
        const panelViews = new Map<any, any>();
        const containerViews = new Map<any, any>();
        (ContextManager.instance as any).panelViews = panelViews;
        (ContextManager.instance as any).containerViews = containerViews;
        (ContextManager.instance as any).hardwareViews = new Map();
        registerBlokiModule();

        registerPanelViewAdapter({
            createView: (_scene: any, _panel: any) => ({
                lastWidth: 0,
                lastHeight: 0,
                lastThickness: 0,
                lastFeaturesFingerprint: '',
                updateMesh: () => {},
                renderFeatures: () => {},
                _updateTransform: () => {},
                setPanelVisible: () => {},
                dispose: () => {}
            })
        });

        registerContainerViewAdapter({
            createView: (_scene: any, _container: any) => ({
                rootNode: { setEnabled: () => {} },
                update: () => {},
                dispose: () => {}
            })
        });

        const panelBuilder = new NativePanelBuilder();
        const ctx: any = {
            document: doc,
            viewport: {
                scene: {},
                applyRenderModeToMeshes: () => {},
                requestRender: () => {}
            },
            panelViews,
            containerViews,
            panelBuilder,
            ui: { setStatus: () => {}, refreshFeatures: () => {} }
        };

        const rebuild = createRebuildGeometry({
            getContext: () => ctx,
            getGizmoController: () => null
        });

        // 1. Utwórz korpus szafy: 2500 x 800 x 560 mm
        const cmdKorpus = new CreateKorpusCommand({
            typ_korpusu: 'korpus3',
            szerokosc_mm: 800,
            wysokosc_mm: 2500,
            glebokosc_mm: 560,
            liczba_stref: 1,
            wysokosc_strefy_dolnej_mm: 2500,
            wysokosc_strefy_srodkowej_mm: 0,
            cofniecie_plecow_mm: 3,
            position: { x: 0, y: 0, z: 0 },
        } as any);
        cmdKorpus.execute(doc);

        const containers = doc.getContainers();
        expect(containers.length).toBe(1);
        const cabinetNode = doc.findNode(containers[0].id)!;
        expect(cabinetNode).toBeDefined();

        // 2. Wykryj wnękę (bay) wewnątrz korpusu
        // Korpus ma z od 0 do 2500, środek z = 1250, x = 0, y = 0
        const bayForDoors = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1250 });
        expect(bayForDoors).toBeDefined();

        // 3. Wstaw moduł półek (np. 5 półek)
        const shelvesOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SHELVES')!;
        const shelvesNode = createBlokInDetectedBay(doc, bayForDoors!, shelvesOpt, {
            liczba_polek: 5,
            odsuniecie_przod_mm: 20,
            wzor_nawiercen: 'TRIPLE',
            rozstaw_potrojny_z_mm: 32
        });
        expect(shelvesNode).toBeDefined();

        // 4. Wstaw drzwi dwuskrzydłowe (DOUBLE)
        const doorsOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'DOORS')!;
        const doorsNode = createBlokInDetectedBay(doc, bayForDoors!, doorsOpt, {
            rodzaj_drzwi: 'DOUBLE',
            szczelina_mm: 3,
        });
        expect(doorsNode).toBeDefined();

        // 5. Synchronizacja wierceń
        new SyncShelfDrillingsCommand(cabinetNode.id).execute(doc);
        new SyncDoorDrillingsCommand(cabinetNode.id).execute(doc);

        // 6. Dodanie rewizji 15x150 mm na lewym boku (od dołu 150 mm, od przodu 300 mm)
        const panelNodes = doc.getPanels();
        const leftSideNode = panelNodes.find(p => (p.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;
        expect(leftSideNode).toBeDefined();
        const leftSideModel = leftSideNode.domainData as PanelModel;

        const rewizjaFeat = applyLibraryOperation(leftSideModel, 'rewizja', 'FACE_Z_MINUS', {
            widthMm: 15,
            heightMm: 150,
            uMm: 300,
            vMm: 150,
            through: true,
            uEdge: 'FACE_X_MINUS',
            vEdge: 'FACE_Y_MINUS'
        });
        expect(rewizjaFeat).not.toBeNull();
        expect(rewizjaFeat!.type).toBe('cutout');
        expect(rewizjaFeat!.params.through).toBe(true);

        // 7. Konwersja frontów na ramki aluminiowe ze szkłem (Z1_BLACK) oraz dodanie 2 uchwytów Easty 160
        const leftDoorNode = panelNodes.find(p => p.name === 'Drzwi_Lewe')!;
        const rightDoorNode = panelNodes.find(p => p.name === 'Drzwi_Prawe')!;
        expect(leftDoorNode).toBeDefined();
        expect(rightDoorNode).toBeDefined();

        const leftDoorModel = leftDoorNode.domainData as PanelModel;
        const rightDoorModel = rightDoorNode.domainData as PanelModel;

        // Przekształcenie frontów w ramki aluminiowe z profilem Z-1 Czarny Mat i szkłem Antisol Grafit
        leftDoorModel.convertToAluFrame('Z1_BLACK');
        rightDoorModel.convertToAluFrame('Z1_BLACK');

        expect(leftDoorModel.isAluFrame()).toBe(true);
        expect(rightDoorModel.isAluFrame()).toBe(true);
        expect(leftDoorModel.getFrameComponents()).toHaveLength(5); // 4 profile + 1 tafla szkła
        expect(rightDoorModel.getFrameComponents()).toHaveLength(5);

        const doorHMm = nmToMm(leftDoorModel.height);

        // Lewy front: krawędź środkowa to FACE_X_PLUS (prawa strona lewych drzwi)
        const leftHandleNode = createSmartPartHandle(doc, leftDoorNode, {
            seriesId: 'easy',
            handleType: 'BAR',
            producerId: 'rejs',
            holeDistanceMm: 160,
            totalLengthMm: 194,
            depthMm: 28,
            thicknessMm: 12,
            colorId: 'black',
            color: resolveHandleColor('black').color,
            orientation: 'VERTICAL',
            uEdge: 'FACE_X_PLUS',
            vEdge: 'FACE_Y_MINUS',
            uMm: 40,
            vMm: (doorHMm / 2) - 80,
            placementPreset: 'CUSTOM'
        });
        expect(leftHandleNode).toBeDefined();

        // Prawy front: krawędź środkowa to FACE_X_MINUS (lewa strona prawych drzwi)
        const rightHandleNode = createSmartPartHandle(doc, rightDoorNode, {
            seriesId: 'easy',
            handleType: 'BAR',
            producerId: 'rejs',
            holeDistanceMm: 160,
            totalLengthMm: 194,
            depthMm: 28,
            thicknessMm: 12,
            colorId: 'black',
            color: resolveHandleColor('black').color,
            orientation: 'VERTICAL',
            uEdge: 'FACE_X_MINUS',
            vEdge: 'FACE_Y_MINUS',
            uMm: 40,
            vMm: (doorHMm / 2) - 80,
            placementPreset: 'CUSTOM'
        });
        expect(rightHandleNode).toBeDefined();

        // 8. Weryfikacja elementów
        console.log(`Wygenerowano ${panelNodes.length} formatek (panele korpusu, półki, fronty alu).`);

        // Weryfikacja frontów i ich nawierceń pod uchwyty
        const frontPanels = panelNodes.filter(p => (p.domainData as any)?.role === 'FRONT');
        console.log(`Liczba frontów: ${frontPanels.length}`);
        expect(frontPanels.length).toBe(2);
        expect((frontPanels[0].domainData as any).panelForm).toBe('ALU_FRAME');
        expect((frontPanels[1].domainData as any).panelForm).toBe('ALU_FRAME');

        // Każdy front powinien mieć nawierty zawiasowe + nawierty uchwytu (2 otwory przelotowe)
        const leftDoorFeatures = (leftDoorNode.domainData as any).features || [];
        const handleHoles = leftDoorFeatures.filter((f: any) => f.generatedBy === 'blok_handles' || f.params?.isHandleDrilling);
        console.log(`Liczba otworów pod uchwyt na lewym froncie: ${handleHoles.length}`);
        expect(handleHoles.length).toBe(2);

        // Weryfikacja półek
        const shelfPanels = panelNodes.filter(p => {
            const role = (p.domainData as any)?.role;
            return role === 'SHELF_PANEL' || role === 'SHELF';
        });
        console.log(`Liczba półek: ${shelfPanels.length}`);
        expect(shelfPanels.length).toBe(5);

        // Weryfikacja okuć (zawiasy + 2 uchwyty)
        const hardwareNodes = doc.getNodesByType(NodeType.HARDWARE);
        console.log(`Liczba okuć (zawiasy + uchwyty): ${hardwareNodes.length}`);
        expect(hardwareNodes.length).toBe(26); // 24 (zawiasy i podpórki) + 2 (uchwyty)

        // Dołącz programy CNC dla formatek z obróbkami (Bok_L, Bok_P itp.)
        for (const p of panelNodes) {
            const m = p.domainData as any;
            if (m && m.features && m.features.length > 0) {
                ensurePanelHasCncProgram(m);
            }
        }

        const rightBok = panelNodes.find(p => (p.domainData as any)?.role === 'RIGHT_SIDE_PANEL');
        expect(rightBok).toBeDefined();
        const rightBokModel = rightBok!.domainData as any;
        expect(rightBokModel.cncPrograms).toHaveLength(1);

        const holeFeatures = rightBokModel.cncPrograms[0].features.filter((f: any) => 'diameter' in f);
        const totalDrillHits = holeFeatures.reduce(
            (sum: number, f: any) => sum + (f.holeCount || f.positions?.length || 1), 0
        );
        expect(totalDrillHits).toBe(34); // 30 otworów półek + 4 otwory zawiasów
        const grooveFeatures = rightBokModel.cncPrograms[0].features.filter((f: any) => 'startPoint' in f);
        expect(grooveFeatures).toHaveLength(1); // 1 wpust pod plecy

        // Zapisz zaktualizowany projekt do pliku .spp.json w folderze projektu web
        const serialized = doc.serialize();
        const outPath = path.resolve(process.cwd(), 'szafa_2500x800x560.spp.json');
        fs.writeFileSync(outPath, JSON.stringify(serialized, null, 2), 'utf-8');
        console.log(`Pomyślnie zaktualizowano i zapisano plik projektu do: ${outPath}`);

        // Weryfikacja odczytu projektu (roundtrip)
        const loadedDoc = new ProjectDocument();
        const fileContent = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
        loadedDoc.load(fileContent);
        expect(loadedDoc.getPanels().length).toBe(12);
        expect(loadedDoc.getNodesByType(NodeType.HARDWARE).length).toBe(26);
        const loadedLeftBok = loadedDoc.getPanels().find(p => (p.domainData as any)?.role === 'LEFT_SIDE_PANEL');
        const loadedCutouts = (loadedLeftBok?.domainData as any)?.features?.filter((f: any) => f.type === 'cutout');
        expect(loadedCutouts.length).toBe(1);

        const loadedLeftDoor = loadedDoc.getPanels().find(p => p.name === 'Drzwi_Lewe');
        expect((loadedLeftDoor?.domainData as any)?.panelForm).toBe('ALU_FRAME');
        expect((loadedLeftDoor?.domainData as any)?.frameTemplateId).toBe('Z1_BLACK');

        // Weryfikacja przetrwania programów CNC po załadowaniu projektu z dysku
        const loadedRightBok = loadedDoc.getPanels().find(p => (p.domainData as any)?.role === 'RIGHT_SIDE_PANEL');
        const loadedRightModel = loadedRightBok?.domainData as any;
        expect(loadedRightModel.cncPrograms).toBeDefined();
        expect(loadedRightModel.cncPrograms.length).toBe(1);
        const loadedHoleFeatures = loadedRightModel.cncPrograms[0].features.filter((f: any) => 'diameter' in f);
        const loadedHits = loadedHoleFeatures.reduce(
            (sum: number, f: any) => sum + (f.holeCount || f.positions?.length || 1), 0
        );
        expect(loadedHits).toBe(34);
        expect(loadedRightModel.cncPrograms[0].name).toBe('Program_Bok_P');
    });
});
