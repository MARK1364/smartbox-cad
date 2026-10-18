import { describe, it } from 'vitest';
import { ProjectDocument } from '../A1_core/project-document.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { CommandHistory } from '../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../A3_smartframe/commands/create-korpus-command.js';
import { NativePanelBuilder } from '../A4_smartpanel/native-panel-builder.js';

describe('BENCH rebuildGeometry scaling', () => {
    it('mierzy koszt przebudowy wszystkich paneli po N-tym korpusie', () => {
        const doc = new ProjectDocument();
        (ContextManager.instance as any).document = doc;
        (ContextManager.instance as any).commandHistory = new CommandHistory(doc);
        (ContextManager.instance as any).panelViews = new Map();
        (ContextManager.instance as any).containerViews = new Map();
        (ContextManager.instance as any).hardwareViews = new Map();

        const builder = new NativePanelBuilder();
        const N = 15;

        for (let i = 0; i < N; i++) {
            const cmd = new CreateKorpusCommand({
                szerokosc_mm: 600,
                wysokosc_mm: 720,
                glebokosc_mm: 560,
                liczba_stref: 1,
                wysokosc_strefy_dolnej_mm: 720,
                wysokosc_strefy_srodkowej_mm: 0,
                cofniecie_plecow_mm: 3,
                position: { x: i * 700, y: 0, z: 0 },
                typ_korpusu: 'korpus3',
            } as any);
            cmd.execute(doc);

            // TO ROBI geometry-rebuild.ts:79-121 przy KAŻDYM dodaniu:
            // for (const panel of currentPanels) { panelBuilder.build(panel); view.updateMesh(); view.renderFeatures(); }
            const panels = doc.getPanels().map((n: any) => n.domainData || n);
            const t0 = performance.now();
            let totalPositions = 0;
            for (const panel of panels) {
                const meshData = builder.build(panel);
                // updateMesh robi ComputeNormals + UV per-vertex + new Mesh per face (tu liczymy sam build)
                for (const [k, v] of Object.entries(meshData)) {
                    if (k === 'edges' || k === 'vertices') continue;
                    totalPositions += ((v as any).positions?.length || 0);
                }
                // renderFeatures: CreateLines(48pkt) + CreateCylinder(32) na OTWÓR - tu tylko liczymy features
            }
            const t1 = performance.now();
            const feats = panels.reduce((a: number, p: any) => a + (p.features?.length || 0), 0);
            console.log(`po korpusie #${i + 1}: panele=${panels.length} features=${feats} rebuild_build=${(t1 - t0).toFixed(1)}ms verts=${totalPositions}`);
        }

        // symulacja applyRenderModeToMeshes: renderFeatures woła scene.meshes.forEach DLA KAŻDEGO panelu
        // scene.meshes ~= panele * ~8 meshy (6 ścian + krawędzie + markery)
        console.log('--- model kosztu applyRenderModeToMeshes (panels * meshes) ---');
        for (const n of [1, 5, 10, 15]) {
            const panels = n * 5;
            const meshes = panels * 8;
            const ops = panels * meshes; // renderFeatures per panel * iteracja po wszystkich meshach
            console.log(`korpusy=${n} panele=${panels} meshes~${meshes} ops/rebuild~${ops}`);
        }
    }, 120000);
});
