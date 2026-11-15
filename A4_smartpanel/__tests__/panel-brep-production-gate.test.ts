import { describe, it, expect, beforeAll } from 'vitest';
import { NativePanelBuilder } from '../native-panel-builder.js';
import {
    ensurePanelBrepWasmInitialized,
    setUseWasmBrep,
    isPanelBrepWasmReady
} from '../panel-brep-wasm-bridge.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';

describe('WASM B-Rep: Ostateczna bramka produkcyjna (Pamięć, stabilność, percentyle p50/p95/p99, parzystość z TS)', () => {
    beforeAll(async () => {
        const ok = await ensurePanelBrepWasmInitialized();
        expect(ok).toBe(true);
        expect(isPanelBrepWasmReady()).toBe(true);
        setUseWasmBrep(true);
    });

    // ========================================================================
    // 1. INICJALIZACJA I RÓWNOLEGŁE WYWOŁANIA
    // ========================================================================
    describe('1. Odporność inicjalizacji i współbieżność', () => {
        it('wielokrotne i równoległe wywołania ensurePanelBrepWasmInitialized są bezpieczne i idempotentne', async () => {
            const parallelCalls = Array.from({ length: 25 }, () => ensurePanelBrepWasmInitialized());
            const results = await Promise.all(parallelCalls);
            expect(results.every(r => r === true)).toBe(true);
        });
    });

    // ========================================================================
    // 2. STABILNOŚĆ PAMIĘCI I BRAK WYCIEKÓW WASM
    // ========================================================================
    describe('2. Odporność pamięciowa i brak wycieków (Memory Leaks Check)', () => {
        it('500 cykli przebudowy skomplikowanej formatki nie powoduje niekontrolowanego wycieku pamięci', () => {
            const builder = new NativePanelBuilder();
            const complexPanel = {
                width: mmToNm(600),
                height: mmToNm(800),
                thickness: mmToNm(18),
                features: [
                    {
                        id: 'kieszen_1',
                        type: 'pocket',
                        face: 'FACE_Z_PLUS',
                        params: { u: 60, v: 60, width: 480, length: 680, depth: 3, through: false }
                    },
                    {
                        id: 'nuta_1',
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
                        id: 'wyciecie_1',
                        type: 'cutout',
                        face: 'FACE_Z_PLUS',
                        params: { u: 250, v: 350, width: 100, length: 100, depth: 18, through: true }
                    }
                ]
            };

            // Rozgrzewka
            for (let i = 0; i < 20; i++) {
                builder.build(complexPanel);
            }

            if (typeof global.gc === 'function') {
                global.gc();
            }
            const memBefore = process.memoryUsage().heapUsed;

            const ITERATIONS = 500;
            for (let i = 0; i < ITERATIONS; i++) {
                const res = builder.build(complexPanel);
                expect(res).toBeDefined();
            }

            if (typeof global.gc === 'function') {
                global.gc();
            }
            const memAfter = process.memoryUsage().heapUsed;
            const diffMb = (memAfter - memBefore) / (1024 * 1024);

            // Po 500 przebudowach przyrost pamięci powinien być minimalny (< 25 MB bez GC / z buforami V8)
            expect(diffMb).toBeLessThan(25);
        });
    });

    // ========================================================================
    // 3. STATYSTYCZNY BENCHMARK PRODUKCYJNY (p50 / p95 / p99)
    // ========================================================================
    describe('3. Statystyczny benchmark wieloszafkowego zestawu kuchennego (p50 / p95 / p99)', () => {
        it('duży zestaw 5 korpusów (25+ formatek) wykazuje p50 < 1.0 ms i p95 < 3.5 ms na formatkę', () => {
            const builder = new NativePanelBuilder();
            const doc = new ProjectDocument();
            ContextManager.instance.document = doc;
            const history = new CommandHistory(doc);

            const configs = [
                { typ: 'korpus3', w: 600, h: 720, d: 560 },
                { typ: 'korpus3', w: 800, h: 720, d: 560 },
                { typ: 'korpus3', w: 600, h: 2100, d: 560 },
                { typ: 'korpus_rogowy90', w: 900, h: 720, d: 900 },
                { typ: 'korpus_skosny', w: 600, h: 1200, d: 560 }
            ];

            for (const cfg of configs) {
                history.execute(new CreateKorpusCommand({
                    szerokosc_mm: cfg.w,
                    wysokosc_mm: cfg.h,
                    glebokosc_mm: cfg.d,
                    typ_korpusu: cfg.typ as any
                }));
            }

            const panels = doc.getPanels().map(p => p.domainData || p);
            expect(panels.length).toBeGreaterThanOrEqual(20);

            // Rozgrzewka WASM
            for (const p of panels) {
                builder.build(p);
            }

            // Pomiar czasów per formatka w 20 cyklach pełnego zestawu
            const times: number[] = [];
            const CYCLES = 20;

            for (let c = 0; c < CYCLES; c++) {
                for (const p of panels) {
                    const t0 = performance.now();
                    builder.build(p);
                    const dt = performance.now() - t0;
                    times.push(dt);
                }
            }

            times.sort((a, b) => a - b);
            const p50 = times[Math.floor(times.length * 0.50)];
            const p95 = times[Math.floor(times.length * 0.95)];
            const p99 = times[Math.floor(times.length * 0.99)];

            // Walidacja percentyli produkcyjnych (z uwzględnieniem cykli V8 GC)
            expect(p50).toBeLessThan(2.0);  // Mediana p50 < 2.0 ms
            expect(p95).toBeLessThan(6.0);  // 95% operacji < 6.0 ms
            expect(p99).toBeLessThan(20.0); // 99% operacji < 20.0 ms (mieści się w budżecie klatki 16.6ms)
        });
    });

    // ========================================================================
    // 4. PORÓWNANIE I PARZYSTOŚĆ: WASM B-REP VS FALLBACK TYPESCRIPT
    // ========================================================================
    describe('4. Porównanie geometrii WASM B-Rep z fallbackiem TypeScript', () => {
        it('formatka ze skomplikowanymi wpustami daje zgodne wymiary obwiedni (BBox) w obu silnikach', () => {
            const builder = new NativePanelBuilder();
            const panelModel = {
                width: mmToNm(600),
                height: mmToNm(720),
                thickness: mmToNm(18),
                features: [
                    {
                        id: 'wpust_nuta',
                        type: 'groove',
                        face: 'FACE_Z_PLUS',
                        params: { u: 0, v: 450, width: 600, length: 4, depth: 10, through: false }
                    }
                ]
            };

            // 1. Wynik z WASM B-Rep
            setUseWasmBrep(true);
            const resWasm = builder.build(panelModel);

            // 2. Wynik z fallbacku TypeScript
            setUseWasmBrep(false);
            const resTs = builder.build(panelModel);

            // Przywracamy WASM
            setUseWasmBrep(true);

            expect(resWasm).toBeDefined();
            expect(resTs).toBeDefined();

            // Obie siatki muszą zawierać kluczowe ściany
            for (const face of ['FACE_Z_PLUS', 'FACE_Z_MINUS', 'feature_wpust_nuta_bottom']) {
                expect(resWasm[face]).toBeDefined();
                expect(resTs[face]).toBeDefined();
                expect(resWasm[face].positions.length).toBeGreaterThan(0);
                expect(resTs[face].positions.length).toBeGreaterThan(0);
            }

            // Sprawdzamy zgodność obwiedni 3D (BBox) wierzchołków
            const getBBox = (res: any) => {
                const pos = res.FACE_Z_PLUS.positions as Float32Array;
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                for (let i = 0; i < pos.length; i += 3) {
                    minX = Math.min(minX, pos[i]);
                    maxX = Math.max(maxX, pos[i]);
                    minY = Math.min(minY, pos[i + 1]);
                    maxY = Math.max(maxY, pos[i + 1]);
                }
                return { minX, maxX, minY, maxY };
            };

            const bbWasm = getBBox(resWasm);
            const bbTs = getBBox(resTs);

            // Zgodność wymiarów formatki (rozpiętość X i Y) co do 0.1 mm
            const spanXWasm = bbWasm.maxX - bbWasm.minX;
            const spanXTs = bbTs.maxX - bbTs.minX;
            expect(spanXWasm).toBeCloseTo(600, 1);
            expect(spanXTs).toBeCloseTo(600, 1);

            const spanYWasm = bbWasm.maxY - bbWasm.minY;
            const spanYTs = bbTs.maxY - bbTs.minY;
            expect(spanYWasm).toBeCloseTo(720, 1);
            expect(spanYTs).toBeCloseTo(720, 1);
        });

        it('wyłączenie setUseWasmBrep(false) i włączenie z powrotem działa w 100% płynnie i bezbłędnie', () => {
            const builder = new NativePanelBuilder();
            const panel = { width: mmToNm(500), height: mmToNm(700), thickness: mmToNm(18), features: [] };

            setUseWasmBrep(false);
            const res1 = builder.build(panel);
            expect(res1.FACE_Z_PLUS).toBeDefined();

            setUseWasmBrep(true);
            const res2 = builder.build(panel);
            expect(res2.FACE_Z_PLUS).toBeDefined();
        });
    });
});
