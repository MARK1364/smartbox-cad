import { describe, it, expect, beforeAll } from 'vitest';
import { NativePanelBuilder } from '../native-panel-builder.js';
import {
    ensurePanelBrepWasmInitialized,
    setUseWasmBrep,
    isPanelBrepWasmReady
} from '../panel-brep-wasm-bridge.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

describe('Porównanie pozycjonowania korpusu w 3D: TS vs WASM B-Rep', () => {
    beforeAll(async () => {
        await ensurePanelBrepWasmInitialized();
    });

    it('porównuje BBoxy i środki ciężkości formatek korpusu w układzie świata (World Space)', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const history = new CommandHistory(doc);

        const cmd = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 }
        });
        history.execute(cmd);

        const panels = doc.getPanels();
        expect(panels.length).toBeGreaterThan(0);

        const builder = new NativePanelBuilder();

        console.log(`\n=== PORÓWNANIE FORMATEK KORPUSU (Liczba formatek: ${panels.length}) ===`);

        for (const node of panels) {
            const model = node.domainData || node;
            const mat = node.getWorldMatrix ? node.getWorldMatrix() : node.localMatrix;

            // 1. Wynik TS
            setUseWasmBrep(false);
            const resTs = builder.build(model);

            // 2. Wynik WASM
            setUseWasmBrep(true);
            const resWasm = builder.build(model);

            const getMeshStats = (res: any) => {
                const positions: number[] = [];
                for (const [key, val] of Object.entries(res)) {
                    if (key === 'edges' || key === 'vertices') continue;
                    const pos = (val as any)?.positions;
                    if (pos) {
                        for (let i = 0; i < pos.length; i++) positions.push(pos[i]);
                    }
                }
                let minX = Infinity, maxX = -Infinity;
                let minY = Infinity, maxY = -Infinity;
                let minZ = Infinity, maxZ = -Infinity;

                // Przeliczamy też do World Space przez mat
                let wMinX = Infinity, wMaxX = -Infinity;
                let wMinY = Infinity, wMaxY = -Infinity;
                let wMinZ = Infinity, wMaxZ = -Infinity;

                for (let i = 0; i < positions.length; i += 3) {
                    const lx = positions[i];
                    const ly = positions[i + 1];
                    const lz = positions[i + 2];
                    minX = Math.min(minX, lx); maxX = Math.max(maxX, lx);
                    minY = Math.min(minY, ly); maxY = Math.max(maxY, ly);
                    minZ = Math.min(minZ, lz); maxZ = Math.max(maxZ, lz);

                    if (mat) {
                        const wPt = mat.transformPoint(new Vec3(lx * 1e6, ly * 1e6, lz * 1e6));
                        const wx = nmToMm(wPt.x);
                        const wy = nmToMm(wPt.y);
                        const wz = nmToMm(wPt.z);
                        wMinX = Math.min(wMinX, wx); wMaxX = Math.max(wMaxX, wx);
                        wMinY = Math.min(wMinY, wy); wMaxY = Math.max(wMaxY, wy);
                        wMinZ = Math.min(wMinZ, wz); wMaxZ = Math.max(wMaxZ, wz);
                    }
                }

                return {
                    local: { minX, maxX, minY, maxY, minZ, maxZ },
                    world: { wMinX, wMaxX, wMinY, wMaxY, wMinZ, wMaxZ },
                    count: positions.length / 3
                };
            };

            const statsTs = getMeshStats(resTs);
            const statsWasm = getMeshStats(resWasm);

            console.log(`\nPanel: "${node.name}" (${(model as any).role}):`);
            console.log(`  Local TS:   X[${statsTs.local.minX.toFixed(1)}, ${statsTs.local.maxX.toFixed(1)}] Y[${statsTs.local.minY.toFixed(1)}, ${statsTs.local.maxY.toFixed(1)}] Z[${statsTs.local.minZ.toFixed(1)}, ${statsTs.local.maxZ.toFixed(1)}]`);
            console.log(`  Local WASM: X[${statsWasm.local.minX.toFixed(1)}, ${statsWasm.local.maxX.toFixed(1)}] Y[${statsWasm.local.minY.toFixed(1)}, ${statsWasm.local.maxY.toFixed(1)}] Z[${statsWasm.local.minZ.toFixed(1)}, ${statsWasm.local.maxZ.toFixed(1)}]`);
            expect(statsWasm.local.minX).toBeCloseTo(statsTs.local.minX, 1);
            expect(statsWasm.local.maxX).toBeCloseTo(statsTs.local.maxX, 1);
            expect(statsWasm.local.minY).toBeCloseTo(statsTs.local.minY, 1);
            expect(statsWasm.local.maxY).toBeCloseTo(statsTs.local.maxY, 1);
            expect(statsWasm.local.minZ).toBeCloseTo(statsTs.local.minZ, 1);
            expect(statsWasm.local.maxZ).toBeCloseTo(statsTs.local.maxZ, 1);

            expect(statsWasm.world.wMinX).toBeCloseTo(statsTs.world.wMinX, 1);
            expect(statsWasm.world.wMaxX).toBeCloseTo(statsTs.world.wMaxX, 1);
            expect(statsWasm.world.wMinY).toBeCloseTo(statsTs.world.wMinY, 1);
            expect(statsWasm.world.wMaxY).toBeCloseTo(statsTs.world.wMaxY, 1);
            expect(statsWasm.world.wMinZ).toBeCloseTo(statsTs.world.wMinZ, 1);
            expect(statsWasm.world.wMaxZ).toBeCloseTo(statsTs.world.wMaxZ, 1);
        }
    });
});
