import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectDocument } from '../A1_core/project-document.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { CommandHistory } from '../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../A3_smartframe/commands/create-korpus-command.js';
import { korpusOffsetGizmoHandler } from '../A3_smartframe/korpus-offset-gizmo.js';
import { registerOffsetGizmoHandler } from '../A1_core/offset-gizmo-port.js';
import { probeBayFromCADPoint } from '../A2_bloki/02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../A2_bloki/02_bloki-bay-actions.js';
import { registerBlokiModule } from '../A2_bloki/01_register.js';
import { registerPanelViewAdapter, registerContainerViewAdapter } from '../A1_core/view-port.js';
import { NativePanelBuilder } from '../A4_smartpanel/native-panel-builder.js';
import { createRebuildGeometry } from '../src/application/geometry-rebuild.js';
import { SyncBackGroovesCommand } from '../A3_smartframe/commands/sync-back-grooves-command.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { PanelModel } from '../A4_smartpanel/panel-model.js';

describe('Biurko z 1-strefowego korpusu - dokładne wytyczne użytkownika', () => {
    it('tworzy biurko z blatem +20mm na boki (+2mm nadwieszenia), boki -18mm, wieniec dolny w górę na szufladę 150mm, plecy 18mm cofnięte 2cm', () => {
        const doc = new ProjectDocument({ name: 'Biurko 1000x550x750' });
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
            createView: () => ({
                lastWidth: 0, lastHeight: 0, lastThickness: 0, lastFeaturesFingerprint: '',
                updateMesh: () => {}, renderFeatures: () => {}, _updateTransform: () => {},
                setPanelVisible: () => {}, dispose: () => {}
            })
        });

        registerContainerViewAdapter({
            createView: () => ({
                rootNode: { setEnabled: () => {} }, update: () => {}, dispose: () => {}
            })
        });

        const panelBuilder = new NativePanelBuilder();
        const ctx: any = {
            document: doc,
            viewport: { scene: {}, applyRenderModeToMeshes: () => {}, requestRender: () => {} },
            panelViews,
            containerViews,
            panelBuilder,
            ui: { setStatus: () => {}, refreshFeatures: () => {} }
        };

        const rebuild = createRebuildGeometry({
            getContext: () => ctx,
            getGizmoController: () => null
        });

        // 1. Zwykły korpus 1-strefowy: 1000 x 550 x 750 mm
        const cmdKorpus = new CreateKorpusCommand({
            typ_korpusu: 'korpus3',
            szerokosc_mm: 1000,
            wysokosc_mm: 750,
            glebokosc_mm: 550,
            liczba_stref: 1,
            cofniecie_plecow_mm: 20, // cofnięte do środka o 2 cm (20 mm)
            grubosc_plecow_mm: 18,
            position: { x: 0, y: 0, z: 0 },
        } as any);

        cmdKorpus.execute(doc);
        rebuild();

        const container = doc.getContainers()[0];

        // 2. Modyfikacje gizmami:
        // a) Wieniec górny: wysunięty na boki o 20 mm -> wystaje po 2 mm poza boczki (964 + 20 + 20 = 1004 mm)
        korpusOffsetGizmoHandler.commitOffset(container, 'Wieniec_G_+Y', 0, 20); // prawo +20 mm
        korpusOffsetGizmoHandler.commitOffset(container, 'Wieniec_G_-Y', 0, 20); // lewo +20 mm
        korpusOffsetGizmoHandler.commitOffset(container, 'Wieniec_G_+X', 0, 20); // przód +20 mm (opcjonalny ładny okap)

        // b) Boki odsunięte o 18 mm w dół (górna krawędź boku obniżona o 18 mm, by blat 18 mm leżał na bokach):
        korpusOffsetGizmoHandler.commitOffset(container, 'Bok_L_+Y', 0, -18);
        korpusOffsetGizmoHandler.commitOffset(container, 'Bok_P_+Y', 0, -18);

        // c) Wieniec dolny przesunięty do góry, aby pod blatem powstała wnęka 150 mm na szufladę:
        // Blat ma spód na Z = 732 mm. Wnęka 150 mm -> góra wieńca dolnego na Z = 582 mm.
        // Domyślny wieniec dolny ma górę na Z = 18 mm. Przesunięcie w górę: 582 - 18 = 564 mm.
        korpusOffsetGizmoHandler.commitOffset(container, 'Wieniec_D_shiftZ', 0, -564);

        // d) Plecy zmienione na 18 mm i cofnięte 2 cm (20 mm) do środka:
        korpusOffsetGizmoHandler.commitOffset(container, 'backOffset', 3, 20);
        // Pas stężający z tyłu (300 mm wysokości) pod wieńcem dolnym:
        korpusOffsetGizmoHandler.commitOffset(container, 'Plecy_-Y', 11, -414);

        // Synchronizacja wpustów pod plecy po zmianie geometrii i offsetów:
        new SyncBackGroovesCommand(container.id).execute(doc);

        rebuild();

        // 3. Wstawienie modułu szuflady Blum we wnękę 150 mm
        const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 650 });
        if (bay) {
            const drawersOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'DRAWERS');
            if (drawersOpt) {
                createBlokInDetectedBay(doc, bay, drawersOpt, {
                    liczba_szuflad: 1,
                    szczelina_wspolna_mm: 3
                });
            }
        }
        rebuild();

        // 4. Zapisanie projektu
        const serialized = doc.serialize();
        const outPath = path.resolve(process.cwd(), 'biurko_1strefa_gizma.spp.json');
        fs.writeFileSync(outPath, JSON.stringify(serialized, null, 2), 'utf-8');
        console.log('--- SUKCES: ZAPISANO BIURKO WEDŁUG WYTYCZNYCH DO:', outPath);

        const panels = doc.getPanels();
        console.log('=== LISTA WYGENEROWANYCH FORMATEK ===');
        for (const p of panels) {
            const m = p.domainData as PanelModel;
            console.log(`Formatka: ${p.name.padEnd(20)} Szer: ${nmToMm(m.width)}mm, Wys: ${nmToMm(m.height)}mm, Gr: ${nmToMm(m.thickness)}mm`);
        }
    });
});
