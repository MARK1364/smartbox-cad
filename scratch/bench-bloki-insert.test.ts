import { describe, it } from 'vitest';
import { ProjectDocument } from '../A1_core/project-document.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { CommandHistory } from '../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../A3_smartframe/commands/create-korpus-command.js';
import { probeBayFromCADPoint } from '../A2_bloki/02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../A2_bloki/02_bloki-bay-actions.js';
import { registerBlokiModule } from '../A2_bloki/01_register.js';
import { createRebuildGeometry } from '../src/application/geometry-rebuild.js';
import { registerPanelViewAdapter, registerContainerViewAdapter } from '../A1_core/view-port.js';
import { NativePanelBuilder } from '../A4_smartpanel/native-panel-builder.js';

describe('BENCH wstawianie bloków + geometry-rebuild', () => {
    it('mierzy czas wstawienia bloku i przebudowy sceny przy N korpusach', () => {
        const doc = new ProjectDocument();
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

        const shelvesOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SHELVES')!;

        const N = 15;
        for (let i = 0; i < N; i++) {
            // 1. Dodajemy korpus
            const cmd = new CreateKorpusCommand({
                szerokosc_mm: 800,
                wysokosc_mm: 720,
                glebokosc_mm: 560,
                liczba_stref: 1,
                wysokosc_strefy_dolnej_mm: 720,
                wysokosc_strefy_srodkowej_mm: 0,
                cofniecie_plecow_mm: 3,
                position: { x: i * 900, y: 0, z: 0 },
                typ_korpusu: 'korpus3',
            } as any);
            cmd.execute(doc);
            rebuild();

            // 2. Wykrywamy wnękę w tym korpusie
            const tBay0 = performance.now();
            const bay = probeBayFromCADPoint(doc, { x: i * 900, y: 0, z: 360 })!;
            const tBay1 = performance.now();

            // 3. Wstawiamy blok
            const tInsert0 = performance.now();
            const sbNode = createBlokInDetectedBay(doc, bay, shelvesOpt, { liczba_polek: 2 });
            const tInsert1 = performance.now();

            // 4. Przebudowujemy geometrię po wstawieniu bloku
            const tRebuild0 = performance.now();
            rebuild();
            const tRebuild1 = performance.now();

            const panelsCount = doc.getPanels().length;
            console.log(
                `korpus #${i + 1} (${panelsCount} paneli): ` +
                `bay=${(tBay1 - tBay0).toFixed(2)}ms | ` +
                `insert=${(tInsert1 - tInsert0).toFixed(2)}ms | ` +
                `rebuild=${(tRebuild1 - tRebuild0).toFixed(2)}ms | ` +
                `TOTAL=${(tBay1 - tBay0 + tInsert1 - tInsert0 + tRebuild1 - tRebuild0).toFixed(2)}ms`
            );
        }
    }, 120000);
});
