import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectDocument } from '../A1_core/project-document.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { CommandHistory } from '../A1_core/commands/command-history.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { mmToNm } from '../A1_core/cad-math/units.js';
import { CreateKorpusCommand } from '../A3_smartframe/commands/create-korpus-command.js';
import { probeBayFromCADPoint } from '../A2_bloki/02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../A2_bloki/02_bloki-bay-actions.js';
import { registerBlokiModule } from '../A2_bloki/01_register.js';
import { createRebuildGeometry } from '../src/application/geometry-rebuild.js';
import { registerProjectDomain } from '../src/application/project-domain.js';
import { registerPanelViewAdapter, registerContainerViewAdapter } from '../A1_core/view-port.js';
import { NativePanelBuilder } from '../A4_smartpanel/native-panel-builder.js';
import { rebuildSmartFrameContainer } from '../A3_smartframe/smartframe-adapter.js';

describe('generator przykładowej kuchni liniowej', () => {
    it('zapisuje gotowy projekt kuchni do spp.json', () => {
        const doc = new ProjectDocument({ name: 'Kuchnia liniowa — przykład', domainUnit: 'nm' });
        registerProjectDomain(doc);
        (ContextManager.instance as any).document = doc;
        (ContextManager.instance as any).commandHistory = new CommandHistory(doc);
        const panelViews = new Map<any, any>();
        const containerViews = new Map<any, any>();
        (ContextManager.instance as any).panelViews = panelViews;
        (ContextManager.instance as any).containerViews = containerViews;
        (ContextManager.instance as any).hardwareViews = new Map();
        registerBlokiModule();

        registerPanelViewAdapter({
            createView: () => ({
                lastWidth: 0, lastHeight: 0, lastThickness: 0,
                lastFeaturesFingerprint: '', updateMesh: () => {}, renderFeatures: () => {},
                _updateTransform: () => {}, setPanelVisible: () => {}, dispose: () => {}
            })
        });
        registerContainerViewAdapter({
            createView: () => ({ rootNode: { setEnabled: () => {} }, update: () => {}, dispose: () => {} })
        });

        const ctx: any = {
            document: doc,
            viewport: { scene: {}, applyRenderModeToMeshes: () => {}, requestRender: () => {} },
            panelViews, containerViews, panelBuilder: new NativePanelBuilder(),
            ui: { setStatus: () => {}, refreshFeatures: () => {} }
        };
        createRebuildGeometry({ getContext: () => ctx, getGizmoController: () => null });

        const baseUnits = [
            { name: '01 Szafka zlewozmywakowa', x: 300, content: 'doors' },
            { name: '02 Szuflady', x: 900, content: 'drawers' },
            { name: '03 Wneka na piekarnik', x: 1500, content: 'open' },
            { name: '04 Szafka dolna', x: 2100, content: 'doors' }
        ];
        const upperUnits = [300, 900, 1500].map((x, i) => ({
            name: `Gorna ${i + 1}`, x, content: 'doors'
        }));
        const doorOption = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'DOORS')!;
        const drawerOption = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'DRAWERS')!;

        const createUnit = (unit: { name: string; x: number; content: string }, upper: boolean) => {
            const height = upper ? 720 : 720;
            const depth = upper ? 320 : 560;
            const z = upper ? 1450 : 0;
            new CreateKorpusCommand({
                typ_korpusu: 'korpus3',
                szerokosc_mm: 600,
                wysokosc_mm: height,
                glebokosc_mm: depth,
                liczba_stref: 1,
                wysokosc_strefy_dolnej_mm: height,
                wysokosc_strefy_srodkowej_mm: 0,
                cofniecie_plecow_mm: 3,
                position: { x: unit.x, y: 0, z }
            } as any).execute(doc);

            const cabinet = doc.getContainers().at(-1)!;
            cabinet.name = unit.name;
            const probe = probeBayFromCADPoint(doc, {
                x: unit.x,
                y: 0,
                z: z + height / 2
            });
            if (!probe) throw new Error(`Nie znaleziono wnęki dla ${unit.name}`);

            if (unit.content === 'doors') {
                createBlokInDetectedBay(doc, probe, doorOption, {
                    rodzaj_drzwi: 'DOUBLE', szczelina_mm: 3
                });
            } else if (unit.content === 'drawers') {
                createBlokInDetectedBay(doc, probe, drawerOption, {
                    liczba_szuflad: 3, szczelina_wspolna_mm: 3
                });
            }
        };

        baseUnits.forEach(unit => createUnit(unit, false));
        upperUnits.forEach(unit => createUnit(unit, true));

        // CreateKorpusCommand tworzy parametryczne korpusy; wygeneruj ich płyty
        // tak samo jak robi to adapter SmartFrame po zmianie parametrów w UI.
        for (const node of doc.getContainers()) {
            const model = node.domainData as any;
            if (model?.generatorParams?.typ_korpusu === 'korpus3') {
                rebuildSmartFrameContainer(model);
            }
        }

        // Jeden ciągły blat nad czterema dolnymi modułami.
        const countertop = doc.createPanel({
            width: mmToNm(2400), height: mmToNm(600), thickness: mmToNm(38),
            name: 'Blat roboczy 2400x600', role: 'COUNTERTOP',
            engineManaged: false, materialId: 'BLAT_DREWNO'
        });
        const countertopNode = doc.findNode(countertop.id)!;
        countertopNode.setLocalTransform(new Vec3(mmToNm(1200), 0, mmToNm(720 + 19)));

        const panels = doc.getPanels();
        expect(doc.getContainers().filter(n => (n.domainData as any)?.generatorParams?.typ_korpusu === 'korpus3')).toHaveLength(7);
        expect(panels.some(p => p.name === 'Blat roboczy 2400x600')).toBe(true);

        // Zachowaj zgodność z nazwą pliku przez selektor projektu w ProjectFileIO.
        doc.metadata = {
            ...doc.metadata,
            appVersion: '1.0.0',
            savedAt: new Date().toISOString()
        };

        const output = path.resolve(process.cwd(), 'Kuchnia_liniowa_demo.spp.json');
        fs.writeFileSync(output, JSON.stringify(doc.serialize(), null, 2), 'utf8');

        const restored = new ProjectDocument();
        restored.load(JSON.parse(fs.readFileSync(output, 'utf8')));
        expect(restored.getContainers().filter(n => (n.domainData as any)?.generatorParams?.typ_korpusu === 'korpus3')).toHaveLength(7);
        expect(restored.getPanels().length).toBeGreaterThan(25);
    });
});
