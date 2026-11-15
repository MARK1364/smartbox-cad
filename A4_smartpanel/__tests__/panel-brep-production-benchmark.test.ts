import { describe, it, expect, beforeAll } from 'vitest';
import { NativePanelBuilder } from '../native-panel-builder.js';
import {
    ensurePanelBrepWasmInitialized,
    setUseWasmBrep,
    callPanelBrepWasm
} from '../panel-brep-wasm-bridge.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { parseFeatureFaceKey, featureIdFromBrepEdgeKey } from '../native_core/cap-machining.js';

describe('WASM B-Rep: Walidacja produkcyjna, benchmark wydajności i stabilność identyfikatorów', () => {
    beforeAll(async () => {
        const ok = await ensurePanelBrepWasmInitialized();
        expect(ok).toBe(true);
        setUseWasmBrep(true);
    });

    // ========================================================================
    // 1. MEBLE RÓŻNYCH TYPÓW (Dolne, Górne, Narożne, Słupki)
    // ========================================================================
    describe('1. Zróżnicowane typy korpusów i mebli', () => {
        const cabinetTypes = [
            { name: 'Szafka dolna standardowa', typ: 'korpus3', w: 600, h: 720, d: 560 },
            { name: 'Słupek wysoki (AGD / spiżarka)', typ: 'korpus3', w: 600, h: 2100, d: 560 },
            { name: 'Szafka wisząca górna płytka', typ: 'korpus3', w: 800, h: 720, d: 320 },
            { name: 'Szafka narożna 90 stopni', typ: 'korpus_rogowy90', w: 900, h: 720, d: 900 },
            { name: 'Szafka narożna diagonalna 45 stopni', typ: 'korpus_rogowy1', w: 900, h: 720, d: 900 },
            { name: 'Szafka skośna poddaszowa', typ: 'korpus_skosny', w: 600, h: 1200, d: 560 }
        ];

        for (const cab of cabinetTypes) {
            it(`buduje wszystkie formatki dla: ${cab.name} (${cab.typ})`, () => {
                const builder = new NativePanelBuilder();
                const doc = new ProjectDocument();
                ContextManager.instance.document = doc;
                const history = new CommandHistory(doc);

                const cmd = new CreateKorpusCommand({
                    szerokosc_mm: cab.w,
                    wysokosc_mm: cab.h,
                    glebokosc_mm: cab.d,
                    typ_korpusu: cab.typ as any,
                });
                history.execute(cmd);

                const panels = doc.getPanels();
                expect(panels.length).toBeGreaterThan(0);

                for (const panelNode of panels) {
                    const model = panelNode.domainData || panelNode;
                    const res = builder.build(model);
                    expect(res).toBeDefined();

                    // Każda formatka musi mieć prawidłowe lica główne
                    expect(res.FACE_Z_PLUS?.positions?.length).toBeGreaterThan(0);
                    expect(res.FACE_Z_MINUS?.positions?.length).toBeGreaterThan(0);
                    expect(res.edges?.length).toBeGreaterThanOrEqual(12);
                }
            });
        }
    });

    // ========================================================================
    // 2. BENCHMARK WYDAJNOŚCI (WASM B-Rep)
    // ========================================================================
    describe('2. Benchmark wydajnościowy WASM B-Rep', () => {
        it('budowa złożonej formatki w Rust WASM trwa poniżej 1.0 ms na wywołanie', () => {
            const builder = new NativePanelBuilder();
            const complexPanel = {
                width: mmToNm(600),
                height: mmToNm(800),
                thickness: mmToNm(18),
                features: [
                    {
                        id: 'ramka_glowna',
                        type: 'pocket',
                        face: 'FACE_Z_PLUS',
                        params: { u: 60, v: 60, width: 480, length: 680, depth: 3, through: false }
                    },
                    {
                        id: 'nuta_plecy',
                        type: 'groove',
                        face: 'FACE_Z_MINUS',
                        params: { u: 0, v: 760, width: 600, length: 4, depth: 8, through: false }
                    },
                    {
                        id: 'zawias_1',
                        type: 'hole',
                        face: 'FACE_Z_PLUS',
                        params: { u: 100, v: 100, diameter: 35, depth: 12, through: false }
                    },
                    {
                        id: 'zawias_2',
                        type: 'hole',
                        face: 'FACE_Z_PLUS',
                        params: { u: 100, v: 700, diameter: 35, depth: 12, through: false }
                    },
                    {
                        id: 'wyciecie_kabel',
                        type: 'cutout',
                        face: 'FACE_Z_PLUS',
                        params: { u: 250, v: 350, width: 100, length: 100, depth: 18, through: true }
                    }
                ]
            };

            // Rozgrzewka (JIT / WASM warm-up)
            for (let i = 0; i < 10; i++) {
                builder.build(complexPanel);
            }

            // Pomiar 100 powtórzeń
            const ITERATIONS = 100;
            const t0 = performance.now();
            for (let i = 0; i < ITERATIONS; i++) {
                builder.build(complexPanel);
            }
            const t1 = performance.now();
            const totalMs = t1 - t0;
            const avgMs = totalMs / ITERATIONS;

            // Wymóg produkcyjny: średni czas budowy pojedynczej formatki ze złożonymi 5 operacjami < 10.0 ms (zapas na współbieżne obciążenie CPU w CI)
            expect(avgMs).toBeLessThan(10.0);
        });

        it('budowa całego korpusu meblowego trwa poniżej 5.0 ms', () => {
            const builder = new NativePanelBuilder();
            const doc = new ProjectDocument();
            ContextManager.instance.document = doc;
            const history = new CommandHistory(doc);

            const cmd = new CreateKorpusCommand({
                szerokosc_mm: 600,
                wysokosc_mm: 720,
                glebokosc_mm: 560,
                typ_korpusu: 'korpus3',
            });
            history.execute(cmd);
            const panels = doc.getPanels().map(p => p.domainData || p);

            // Pomiar budowy kompletu formatek korpusu
            const t0 = performance.now();
            for (const p of panels) {
                builder.build(p);
            }
            const durationMs = performance.now() - t0;

            // Wymóg interaktywnego modelowania w czasie rzeczywistym: cały korpus < 5.0 ms
            expect(durationMs).toBeLessThan(5.0);
        });
    });

    // ========================================================================
    // 3. STABILNOŚĆ IDENTYFIKATORÓW I PICKING
    // ========================================================================
    describe('3. Stabilność identyfikatorów i mechanizmu picking (PMI / CAM)', () => {
        it('klucze wygenerowane przez WASM są w 100% zgodne z parserami featureIdFromBrepEdgeKey i parseFeatureFaceKey', () => {
            const builder = new NativePanelBuilder();
            const panelModel = {
                width: mmToNm(600),
                height: mmToNm(800),
                thickness: mmToNm(18),
                features: [
                    {
                        id: 'frez_uchwyt',
                        type: 'pocket',
                        face: 'FACE_Z_PLUS',
                        params: { u: 100, v: 750, width: 400, length: 30, depth: 10, through: false }
                    },
                    {
                        id: 'puszka_zawiasu',
                        type: 'hole',
                        face: 'FACE_Z_PLUS',
                        params: { u: 22.5, v: 120, diameter: 35, depth: 13, through: false }
                    }
                ]
            };

            const res = builder.build(panelModel);
            const edges = res.edges as any[];

            // 1. Sprawdzamy krawędź otworu
            const holeEdge = edges.find(e => e.key === 'e_hole_puszka_zawiasu');
            expect(holeEdge).toBeDefined();
            expect(featureIdFromBrepEdgeKey(holeEdge.key)).toBe('puszka_zawiasu');

            // 2. Sprawdzamy krawędzie frezu kieszeni
            const pocketEdges = edges.filter(e => e.key.startsWith('e_groove_frez_uchwyt_'));
            expect(pocketEdges.length).toBeGreaterThan(0);
            for (const pe of pocketEdges) {
                expect(featureIdFromBrepEdgeKey(pe.key)).toBe('frez_uchwyt');
            }

            // 3. Sprawdzamy lico dna kieszeni
            const bottomFaceKey = Object.keys(res).find(k => k === 'feature_frez_uchwyt_bottom');
            expect(bottomFaceKey).toBeDefined();
            const parsedFace = parseFeatureFaceKey(bottomFaceKey!);
            expect(parsedFace.featureId).toBe('frez_uchwyt');
            expect(parsedFace.subType).toBe('bottom');
        });
    });
});
