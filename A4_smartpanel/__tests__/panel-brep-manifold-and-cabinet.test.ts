import { describe, it, expect, beforeAll } from 'vitest';
import { NativePanelBuilder } from '../native-panel-builder.js';
import {
    ensurePanelBrepWasmInitialized,
    setUseWasmBrep,
    callPanelBrepDiagnostics
} from '../panel-brep-wasm-bridge.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';

describe('WASM B-Rep: Manifoldness, objętość dywergencyjna, okleinowanie ABS i rzeczywiste korpusy', () => {
    beforeAll(async () => {
        const ok = await ensurePanelBrepWasmInitialized();
        expect(ok).toBe(true);
        setUseWasmBrep(true);
    });

    // ========================================================================
    // PRIORYTET 1: Walidacja szczelności B-Rep (Manifoldness, objętość)
    // ========================================================================
    describe('1. Walidacja szczelności 2-manifold i analityczna objętość', () => {
        it('gładka formatka bez cech jest w 100% watertight i jej objętość = W * H * T', () => {
            const W = 600, H = 800, T = 18;
            const model = {
                width: mmToNm(W),
                height: mmToNm(H),
                thickness: mmToNm(T),
                features: []
            };

            const diag = callPanelBrepDiagnostics(model);
            expect(diag).toBeDefined();
            const top = diag.topology;

            // Sprawdzamy szczelność i brak anomalii topologicznych
            expect(top.watertight).toBe(true);
            expect(top.boundary_edges).toBe(0);
            expect(top.non_manifold_edges).toBe(0);
            expect(top.degenerate_faces).toBe(0);

            // Dokładna objętość prostopadłościanu: 600 * 800 * 18 = 8 640 000 mm³
            const expectedVol = W * H * T;
            expect(top.volume).toBeCloseTo(expectedVol, 1);
        });

        it('formatka z kieszenią i wpustem jest szczelna, a jej objętość odpowiada ubytkowi materiału', () => {
            const W = 500, H = 700, T = 18;
            const pocketW = 200, pocketL = 300, pocketD = 5;
            const grooveW = 500, grooveL = 4, grooveD = 10;

            const model = {
                width: mmToNm(W),
                height: mmToNm(H),
                thickness: mmToNm(T),
                features: [
                    {
                        id: 'kieszen_1',
                        type: 'pocket',
                        face: 'FACE_Z_PLUS',
                        params: { u: 100, v: 100, width: pocketW, length: pocketL, depth: pocketD, through: false }
                    },
                    {
                        id: 'wpust_1',
                        type: 'groove',
                        face: 'FACE_Z_PLUS',
                        params: { u: 0, v: 500, width: grooveW, length: grooveL, depth: grooveD, through: false }
                    }
                ]
            };

            const diag = callPanelBrepDiagnostics(model);
            expect(diag).toBeDefined();
            const top = diag.topology;

            expect(top.watertight).toBe(true);
            expect(top.boundary_edges).toBe(0);
            expect(top.non_manifold_edges).toBe(0);
            expect(top.degenerate_faces).toBe(0);

            // Objętość początkowa = 500 * 700 * 18 = 6 300 000 mm³
            // Ubytek kieszeni = 200 * 300 * 5 = 300 000 mm³
            // Ubytek wpustu = 500 * 4 * 10 = 20 000 mm³
            // Objętość końcowa = 6 300 000 - 320 000 = 5 980 000 mm³
            const expectedVol = (W * H * T) - (pocketW * pocketL * pocketD) - (grooveW * grooveL * grooveD);
            expect(top.volume).toBeCloseTo(expectedVol, 1);
        });

        it('przecinające się rewizja i kieszeń zachowują szczelność bryły i brak wiszących krawędzi', () => {
            const W = 500, H = 800, T = 18;
            const model = {
                width: mmToNm(W),
                height: mmToNm(H),
                thickness: mmToNm(T),
                features: [
                    {
                        id: 'rewizja_cutout',
                        type: 'cutout',
                        face: 'FACE_Z_PLUS',
                        params: { u: 100, v: 20, width: 120, length: 140, depth: 18, through: true }
                    },
                    {
                        id: 'ramka_pocket',
                        type: 'pocket',
                        face: 'FACE_Z_PLUS',
                        params: { u: 60, v: 60, width: 380, length: 680, depth: 3, through: false }
                    }
                ]
            };

            const diag = callPanelBrepDiagnostics(model);
            expect(diag).toBeDefined();
            const top = diag.topology;

            expect(top.watertight).toBe(true);
            expect(top.boundary_edges).toBe(0);
            expect(top.non_manifold_edges).toBe(0);
            expect(top.degenerate_faces).toBe(0);
            expect(top.volume).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // PRIORYTET 2: Pełna walidacja okleinowania ABS na rozciętych krawędziach
    // ========================================================================
    describe('2. Okleinowanie ABS: zachowanie identyfikacji boków po rozcięciach', () => {
        it('filtracja krawędzi wg edgeKey (-X, +X, +Y, -Y) zwraca dokładne segmenty technologiczne', () => {
            const builder = new NativePanelBuilder();
            const W = 564, H = 500, T = 18;

            // Bok lewy (-X) jest rozcięty wpustem o szerokości 4mm na v=450..454
            const panelModel = {
                width: mmToNm(W),
                height: mmToNm(H),
                thickness: mmToNm(T),
                features: [
                    {
                        id: 'wpust_nuta',
                        type: 'groove',
                        face: 'FACE_Z_PLUS',
                        params: { u: 0, v: 450, width: W, length: 4, depth: 10, through: false }
                    }
                ]
            };

            const res = builder.build(panelModel);
            const edges = res.edges as any[];

            // Wszystkie 4 boki formatki:
            const leftSegments = edges.filter(e => e.edgeKey === '-X' && Math.abs(e.points[0][2] - T / 2) < 0.1);
            const rightSegments = edges.filter(e => e.edgeKey === '+X' && Math.abs(e.points[0][2] - T / 2) < 0.1);
            const frontSegments = edges.filter(e => e.edgeKey === '-Y' && Math.abs(e.points[0][2] - T / 2) < 0.1);
            const backSegments = edges.filter(e => e.edgeKey === '+Y' && Math.abs(e.points[0][2] - T / 2) < 0.1);

            // Boki lewy i prawy zostały rozcięte na 2 odcinki przez wpust
            expect(leftSegments.length).toBe(2);
            expect(rightSegments.length).toBe(2);

            // Przód i tył pozostały pojedynczymi całymi odcinkami o długości W = 564mm
            expect(frontSegments.length).toBe(1);
            expect(backSegments.length).toBe(1);

            const frontLen = Math.hypot(
                frontSegments[0].points[1][0] - frontSegments[0].points[0][0],
                frontSegments[0].points[1][1] - frontSegments[0].points[0][1]
            );
            expect(frontLen).toBeCloseTo(W, 1);

            // Suma długości rozciętych segmentów lewego boku = H - 4mm = 496mm
            const totalLeftLen = leftSegments.reduce((acc, seg) => {
                return acc + Math.hypot(
                    seg.points[1][0] - seg.points[0][0],
                    seg.points[1][1] - seg.points[0][1]
                );
            }, 0);
            expect(totalLeftLen).toBeCloseTo(H - 4, 1);
        });
    });

    // ========================================================================
    // PRIORYTET 3: Rzeczywiste korpusy meblowe (SmartFrame / Korpus)
    // ========================================================================
    describe('3. Rzeczywiste korpusy meblowe z pełnym wyposażeniem', () => {
        it('korpus kuchenny standardowy: formatki wieńca i boków budują się w 100% poprawnie w WASM B-Rep', () => {
            const builder = new NativePanelBuilder();
            const document = new ProjectDocument();
            ContextManager.instance.document = document;
            const history = new CommandHistory(document);

            // Tworzymy korpus z generatora SmartFrame
            const cmd = new CreateKorpusCommand({
                szerokosc_mm: 600,
                wysokosc_mm: 720,
                glebokosc_mm: 560,
                typ_korpusu: 'korpus3',
            });
            history.execute(cmd);

            const active = document.activeEntity;
            expect(active).toBeDefined();

            // Pobieramy wszystkie formatki płytowe dokumentu
            const parts = document.getPanels();
            expect(parts.length).toBeGreaterThan(0);

            for (const node of parts) {
                const model = node.domainData || node;
                const res = builder.build(model);
                expect(res).toBeDefined();

                // Każda formatka musi posiadać poprawne lica i krawędzie
                expect(res.FACE_Z_PLUS).toBeDefined();
                expect(res.FACE_Z_MINUS).toBeDefined();
                expect(res.FACE_Z_PLUS.positions.length).toBeGreaterThan(0);
                expect(res.FACE_Z_MINUS.positions.length).toBeGreaterThan(0);
                expect(res.edges.length).toBeGreaterThanOrEqual(12);
            }
        });
    });
});
