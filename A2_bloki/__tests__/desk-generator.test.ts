import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { korpusOffsetGizmoHandler } from '../../A3_smartframe/korpus-offset-gizmo.js';
import { registerOffsetGizmoHandler } from '../../A1_core/offset-gizmo-port.js';
import { probeBayFromCADPoint } from '../02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../02_bloki-bay-actions.js';
import { registerBlokiModule } from '../01_register.js';
import { registerPanelViewAdapter, registerContainerViewAdapter } from '../../A1_core/view-port.js';
import { NativePanelBuilder } from '../../A4_smartpanel/native-panel-builder.js';
import { createRebuildGeometry } from '../../src/application/geometry-rebuild.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';

describe('Biurko z 1-strefowego korpusu modyfikowane gizmami', () => {
    it('tworzy korpus 1-strefowy i modyfikuje formatki gizmami jak człowiek', () => {
        const doc = new ProjectDocument({ name: 'Biurko 1000x550x750 (1 Strefa + Gizma)' });
        (ContextManager.instance as any).document = doc;
        (ContextManager.instance as any).commandHistory = new CommandHistory(doc);
        const panelViews = new Map<any, any>();
        const containerViews = new Map<any, any>();
        (ContextManager.instance as any).panelViews = panelViews;
        (ContextManager.instance as any).containerViews = containerViews;
        (ContextManager.instance as any).hardwareViews = new Map();
        registerBlokiModule();
        registerOffsetGizmoHandler(korpusOffsetGizmoHandler);

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

        // =========================================================================
        // KROK 1: Człowiek wstawia ZWYKŁY KORPUS 1-STREFOWY (1000 x 550 x 750 mm)
        // =========================================================================
        const cmdKorpus = new CreateKorpusCommand({
            typ_korpusu: 'korpus3',
            szerokosc_mm: 1000,
            wysokosc_mm: 750,
            glebokosc_mm: 550,
            liczba_stref: 1, // BAZA: 1 STREFA!
            cofniecie_plecow_mm: 3,
            grubosc_plecow_mm: 18, // Plecy zmienione na płytę 18mm
            position: { x: 0, y: 0, z: 0 },
        } as any);

        cmdKorpus.execute(doc);
        rebuild();

        const containers = doc.getContainers();
        expect(containers.length).toBe(1);
        const container = containers[0];
        const cabinetNode = doc.findNode(container.id)!;
        expect(cabinetNode).toBeDefined();

        // =========================================================================
        // KROK 2: Człowiek modyfikuje formatki gizmami (korpusOffsetGizmoHandler):
        // =========================================================================

        // 2a. Gizmo Wieniec Górny (Blat):
        // Wyciągamy krawędzie blatu poza obrys boczków:
        korpusOffsetGizmoHandler.commitOffset(container, 'Wieniec_G_+X', 0, 30); // wysunięcie przodu o 30 mm
        korpusOffsetGizmoHandler.commitOffset(container, 'Wieniec_G_+Y', 0, 38); // wysunięcie w prawo (18mm bok + 20mm nadwieszenia)
        korpusOffsetGizmoHandler.commitOffset(container, 'Wieniec_G_-Y', 0, 38); // wysunięcie w lewo (18mm bok + 20mm nadwieszenia)

        // Podnosimy wieniec górny gizmami osi Z do góry, aby zostawić wnękę na szufladę (140 mm):
        korpusOffsetGizmoHandler.commitOffset(container, 'Wieniec_G_shiftZ', 0, 140);

        // 2b. Gizmo Plecy:
        // Cofamy plecy o 80 mm do środka korpusu:
        korpusOffsetGizmoHandler.commitOffset(container, 'backOffset', 3, 80);

        // Przeciągamy dolną krawędź pleców w górę, aby otrzymać pas stężający 300 mm:
        // W 1 strefie wysokość wewnętrzna to 750 - 18 - 18 = 714 mm.
        // Żeby pas miał 300 mm, podciągamy dół o -(714 - 300) = -414 mm:
        korpusOffsetGizmoHandler.commitOffset(container, 'Plecy_-Y', 11, -414);

        // Przebudowa geometrii po interakcji z gizmami
        rebuild();

        // =========================================================================
        // KROK 3: Człowiek wstawia moduł szuflady we wnękę
        // =========================================================================
        // Wykrywamy wnękę korpusu
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 400 });
        expect(bay).toBeDefined();

        // Wstawiamy 1 szufladę Blum
        const drawersOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'DRAWERS')!;
        const drawersNode = createBlokInDetectedBay(doc, bay!, drawersOpt, {
            liczba_szuflad: 1,
            szczelina_wspolna_mm: 3
        });
        expect(drawersNode).toBeDefined();
        rebuild();

        // =========================================================================
        // KROK 4: Weryfikacja formatek wygenerowanych przez silnik
        // =========================================================================
        const panels = doc.getPanels();
        console.log('=== FORMATEKI BIURKA ZBUDOWANEGO Z 1-STREFOWEGO KORPUSU ZA POMOCĄ GIZM ===');
        for (const p of panels) {
            const m = p.domainData as PanelModel;
            console.log(`Formatka: ${p.name.padEnd(25)} Szer: ${nmToMm(m.width)}mm, Wys: ${nmToMm(m.height)}mm, Grubość: ${nmToMm(m.thickness)}mm, Rola: ${m.role}`);
        }

        // Boki (pełne nogi biurka)
        const leftBok = panels.find(p => (p.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;
        const rightBok = panels.find(p => (p.domainData as any)?.role === 'RIGHT_SIDE_PANEL')!;
        expect(leftBok).toBeDefined();
        expect(rightBok).toBeDefined();
        expect(nmToMm((leftBok.domainData as PanelModel).height)).toBe(750); // pełna wysokość 750 mm!
        expect(nmToMm((rightBok.domainData as PanelModel).height)).toBe(750);

        // Blat wyciągnięty gizmami
        const topBlat = panels.find(p => (p.domainData as any)?.role === 'TOP_PANEL')!;
        expect(topBlat).toBeDefined();
        expect(nmToMm((topBlat.domainData as PanelModel).width)).toBe(1040); // 964 + 38 + 38 = 1040 mm
        expect(nmToMm((topBlat.domainData as PanelModel).height)).toBe(580); // 550 + 30 = 580 mm

        // Pas stężający z pleców
        const plecy = panels.find(p => (p.domainData as any)?.role === 'BACK_PANEL')!;
        expect(plecy).toBeDefined();
        expect(nmToMm((plecy.domainData as PanelModel).height)).toBeCloseTo(300, 0); // dokładnie pas 300 mm!
        expect(nmToMm((plecy.domainData as PanelModel).thickness)).toBe(18); // grubość 18 mm!

        // Zapis projektu do pliku .spp.json
        const serialized = doc.serialize();
        const outPath = path.resolve(process.cwd(), 'biurko_1strefa_gizma.spp.json');
        fs.writeFileSync(outPath, JSON.stringify(serialized, null, 2), 'utf-8');
        console.log(`Pomyślnie zapisano projekt biurka 1-strefowego do: ${outPath}`);
    });
});
