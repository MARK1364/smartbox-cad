/**
 * C1_cnc/__tests__/dxf-panel-exporter.test.ts
 * 
 * Testy jednostkowe eksportera formatki meblowej do formatu AutoCAD ASCII DXF.
 */

import { describe, it, expect } from 'vitest';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { generatePanelDxf, getPanelDimensionsMm, resolvePanelOutline2D } from '../exporters/dxf-panel-exporter.js';
import { parseDxfAscii, parseLayerParams, importDxfToWorkpiece } from '../inputs/dxf-importer.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { SyncShelfDrillingsCommand } from '../../A2_bloki/commands/sync-shelf-drillings-command.js';
import { probeBayFromCADPoint } from '../../A2_bloki/02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../../A2_bloki/02_bloki-bay-actions.js';

describe('DXF Panel Exporter (Uniwersalny Standard Stolarski)', () => {

    const testPanel = {
        id: 'panel_boczek_1',
        name: 'Boczek Lewy',
        role: 'SIDE_PANEL',
        width: mmToNm(600),
        height: mmToNm(800),
        thickness: mmToNm(18),
        features: [
            // Wiercenie pionowe nieprzelotowe (np. podpórka fi 5)
            {
                id: 'hole_shelf_1',
                type: 'hole',
                face: 'FACE_Z_PLUS',
                params: { u: 37, v: 120, diameter: 5, depth: 13 }
            },
            // Wiercenie przelotowe (np. konfirmat fi 7)
            {
                id: 'hole_through_1',
                type: 'hole',
                face: 'FACE_Z_PLUS',
                params: { u: 37, v: 50, diameter: 7, depth: 18, through: true }
            },
            // Wiercenie krawędziowe w lewej krawędzi (np. kołek w czole)
            {
                id: 'hole_edge_left_1',
                type: 'hole',
                face: 'FACE_X_MINUS',
                params: { v: 64, diameter: 8, depth: 30 }
            },
            // Wiercenie krawędziowe w górnej krawędzi
            {
                id: 'hole_edge_top_1',
                type: 'hole',
                face: 'FACE_Y_PLUS',
                params: { u: 100, diameter: 8, depth: 30 }
            },
            // Nuta pod plecy (rowek wzdłuż krawędzi)
            {
                id: 'groove_back_1',
                type: 'groove',
                face: 'FACE_Z_PLUS',
                params: { u: 20, v: 0, width: 4, length: 800, depth: 8 }
            },
            // Kieszeń / wybranie (pocket)
            {
                id: 'pocket_1',
                type: 'pocket',
                face: 'FACE_Z_PLUS',
                params: { u: 200, v: 300, width: 50, length: 60, depth: 10 }
            },
            // Wycięcie przelotowe (cutout)
            {
                id: 'cutout_inner_1',
                type: 'cutout',
                face: 'FACE_Z_PLUS',
                params: { u: 300, v: 400, width: 80, length: 120 }
            }
        ]
    };

    describe('Wymiary i obrys formatki', () => {
        it('getPanelDimensionsMm poprawnie przelicza wymiary z nm na mm', () => {
            const dims = getPanelDimensionsMm(testPanel);
            expect(dims.width).toBe(600);
            expect(dims.height).toBe(800);
            expect(dims.thickness).toBe(18);
        });

        it('rzuca błąd przy braku formatki lub nieprawidłowych wymiarach', () => {
            expect(() => getPanelDimensionsMm(null)).toThrow(/Brak referencji do formatki/);
            expect(() => getPanelDimensionsMm({ width: -10, height: 100, thickness: 18 })).toThrow(/nie posiada poprawnych wymiarów/);
        });

        it('resolvePanelOutline2D generuje prostokątny obrys dla standardowej płyty', () => {
            const { outline } = resolvePanelOutline2D(testPanel, 600, 800, 18);
            expect(outline).toEqual([
                [0, 0],
                [600, 0],
                [600, 800],
                [0, 800]
            ]);
        });

        it('resolvePanelOutline2D uwzględnia custom_properties.outline2d dla formatki L', () => {
            const panelL = {
                ...testPanel,
                custom_properties: {
                    outline2d: [[0, 0], [800, 0], [800, 500], [400, 500], [400, 800], [0, 800]]
                }
            };
            const { outline } = resolvePanelOutline2D(panelL, 800, 800, 18);
            expect(outline.length).toBe(6);
            expect(outline[2]).toEqual([800, 500]);
        });
    });

    describe('generatePanelDxf - struktura i zgodność ze standardem stolarskim', () => {
        it('generuje kompletny i poprawny plik AutoCAD ASCII DXF (AC1015 / mm)', () => {
            const dxf = generatePanelDxf(testPanel);

            expect(dxf).toContain('SECTION');
            expect(dxf).toContain('HEADER');
            expect(dxf).toContain('$ACADVER');
            expect(dxf).toContain('AC1015');
            expect(dxf).toContain('$INSUNITS');
            expect(dxf).toContain('4'); // 4 = mm
            expect(dxf).toContain('$EXTMAX');
            expect(dxf).toContain('600.000');
            expect(dxf).toContain('800.000');
            expect(dxf).toContain('18.000');
            expect(dxf).toContain('TABLES');
            expect(dxf).toContain('ENTITIES');
            expect(dxf).toContain('EOF');
        });

        it('zawiera warstwę OBRYS ze zdefiniowaną zamkniętą polilinią 2D', () => {
            const dxf = generatePanelDxf(testPanel);
            expect(dxf).toContain('OBRYS');

            const parsed = parseDxfAscii(dxf);
            const outlinePoly = parsed.entities.find(e => e.type === 'LWPOLYLINE' && e.layer === 'OBRYS');
            expect(outlinePoly).toBeDefined();
            expect(outlinePoly?.type).toBe('LWPOLYLINE');
            if (outlinePoly?.type === 'LWPOLYLINE') {
                expect(outlinePoly.closed).toBe(true);
                expect(outlinePoly.vertices.length).toBe(4);
            }
        });

        it('koduje parametry otworów w nazwach warstw (DRILL_D5_Z13, DRILL_D7_THROUGH)', () => {
            const dxf = generatePanelDxf(testPanel);
            const parsed = parseDxfAscii(dxf);

            // Wiercenie fi 5 głębokość 13
            const hole5 = parsed.entities.find(e => e.layer === 'DRILL_D5_Z13');
            expect(hole5).toBeDefined();
            expect(hole5?.type).toBe('CIRCLE');
            if (hole5?.type === 'CIRCLE') {
                expect(hole5.x).toBeCloseTo(37, 2);
                expect(hole5.y).toBeCloseTo(120, 2);
                expect(hole5.radius).toBeCloseTo(2.5, 2);
            }

            const parsedParams5 = parseLayerParams('DRILL_D5_Z13');
            expect(parsedParams5.diameter).toBe(5);
            expect(parsedParams5.depth).toBe(13);

            // Otwór przelotowy fi 7
            const holeThrough = parsed.entities.find(e => e.layer === 'DRILL_D7_THROUGH');
            expect(holeThrough).toBeDefined();
            if (holeThrough?.type === 'CIRCLE') {
                expect(holeThrough.radius).toBeCloseTo(3.5, 2);
            }
        });

        it('generuje wiercenia krawędziowe (punkty wejścia i linie osi) na warstwach DRILL_EDGE_*', () => {
            const dxf = generatePanelDxf(testPanel);
            const parsed = parseDxfAscii(dxf);

            // Wiercenie w lewej krawędzi (X=0)
            const leftHoleCircle = parsed.entities.find(e => e.type === 'CIRCLE' && e.layer === 'DRILL_EDGE_LEFT_D8_Z30');
            const leftHoleLine = parsed.entities.find(e => e.type === 'LINE' && e.layer === 'DRILL_EDGE_LEFT_D8_Z30');

            expect(leftHoleCircle).toBeDefined();
            expect(leftHoleLine).toBeDefined();

            if (leftHoleCircle?.type === 'CIRCLE') {
                expect(leftHoleCircle.x).toBeCloseTo(0, 2);
                expect(leftHoleCircle.y).toBeCloseTo(64, 2);
                expect(leftHoleCircle.radius).toBeCloseTo(4, 2);
            }
            if (leftHoleLine?.type === 'LINE') {
                expect(leftHoleLine.x1).toBeCloseTo(0, 2);
                expect(leftHoleLine.y1).toBeCloseTo(64, 2);
                expect(leftHoleLine.x2).toBeCloseTo(30, 2);
                expect(leftHoleLine.y2).toBeCloseTo(64, 2);
            }

            // Wiercenie w górnej krawędzi (Y=800)
            const topHoleCircle = parsed.entities.find(e => e.type === 'CIRCLE' && e.layer === 'DRILL_EDGE_TOP_D8_Z30');
            const topHoleLine = parsed.entities.find(e => e.type === 'LINE' && e.layer === 'DRILL_EDGE_TOP_D8_Z30');

            expect(topHoleCircle).toBeDefined();
            expect(topHoleLine).toBeDefined();

            if (topHoleCircle?.type === 'CIRCLE') {
                expect(topHoleCircle.x).toBeCloseTo(100, 2);
                expect(topHoleCircle.y).toBeCloseTo(800, 2);
            }
            if (topHoleLine?.type === 'LINE') {
                expect(topHoleLine.x1).toBeCloseTo(100, 2);
                expect(topHoleLine.y1).toBeCloseTo(800, 2);
                expect(topHoleLine.x2).toBeCloseTo(100, 2);
                expect(topHoleLine.y2).toBeCloseTo(770, 2); // 800 - 30 mm
            }
        });

        it('generuje rowki nuty na warstwie GROOVE_W4_Z8 z osią frezowania i obrysem', () => {
            const dxf = generatePanelDxf(testPanel);
            const parsed = parseDxfAscii(dxf);

            const grooveLine = parsed.entities.find(e => e.type === 'LINE' && e.layer === 'GROOVE_W4_Z8');
            const grooveBox = parsed.entities.find(e => e.type === 'LWPOLYLINE' && e.layer === 'GROOVE_W4_Z8');

            expect(grooveLine).toBeDefined();
            expect(grooveBox).toBeDefined();

            // Oś środkowa rowka o szerokości 4mm zaczynającego się w u=20mm to X = 22mm
            if (grooveLine?.type === 'LINE') {
                expect(grooveLine.x1).toBeCloseTo(22, 2);
                expect(grooveLine.x2).toBeCloseTo(22, 2);
                expect(grooveLine.y1).toBeCloseTo(0, 2);
                expect(grooveLine.y2).toBeCloseTo(800, 2);
            }
        });

        it('generuje kieszeń (POCKET_Z10) i wycięcie przelotowe (CUTOUT)', () => {
            const dxf = generatePanelDxf(testPanel);
            const parsed = parseDxfAscii(dxf);

            const pocket = parsed.entities.find(e => e.type === 'LWPOLYLINE' && e.layer === 'POCKET_Z10');
            const cutout = parsed.entities.find(e => e.type === 'LWPOLYLINE' && e.layer === 'CUTOUT');

            expect(pocket).toBeDefined();
            expect(cutout).toBeDefined();
        });

        it('obsługuje wiercenia od spodu (FACE_Z_MINUS) z lustrzanym odbiciem współrzędnej X', () => {
            const panelWithBackHole = {
                ...testPanel,
                features: [
                    {
                        id: 'back_hole',
                        type: 'hole',
                        face: 'FACE_Z_MINUS',
                        params: { u: 100, v: 200, diameter: 35, depth: 12.5 }
                    }
                ]
            };

            const dxf = generatePanelDxf(panelWithBackHole);
            const parsed = parseDxfAscii(dxf);

            const backHole = parsed.entities.find(e => e.layer === 'DRILL_BACK_D35_Z12.5');
            expect(backHole).toBeDefined();
            if (backHole?.type === 'CIRCLE') {
                // Formatka ma szerokość 600 mm, u = 100 mm od lewej strony B -> X = 600 - 100 = 500 mm
                expect(backHole.x).toBeCloseTo(500, 2);
                expect(backHole.y).toBeCloseTo(200, 2);
                expect(backHole.radius).toBeCloseTo(17.5, 2);
            }
        });

        it('rozwija szablony wielootworowe (template_id: SYSTEM_32)', () => {
            const panelWithRow = {
                ...testPanel,
                features: [
                    {
                        id: 'sys32_holes',
                        type: 'hole',
                        face: 'FACE_Z_PLUS',
                        params: {
                            u: 37,
                            v: 100,
                            diameter: 5,
                            depth: 13,
                            template_id: 'SYSTEM_32',
                            count: 5,
                            spacing: 32
                        }
                    }
                ]
            };

            const dxf = generatePanelDxf(panelWithRow);
            const parsed = parseDxfAscii(dxf);

            const sys32Circles = parsed.entities.filter(e => e.type === 'CIRCLE' && e.layer === 'DRILL_D5_Z13');
            expect(sys32Circles.length).toBe(5);
            for (let i = 0; i < 5; i++) {
                const c = sys32Circles[i];
                if (c.type === 'CIRCLE') {
                    expect(c.x).toBeCloseTo(37, 2);
                    expect(c.y).toBeCloseTo(100 + i * 32, 2);
                }
            }
        });

        it('poprawnie obsługuje węzeł typu CADNode jako wejście (node.domainData)', () => {
            const cadNode = {
                id: 'node_1',
                name: 'Boczek CADNode',
                domainData: testPanel
            };

            const dxf = generatePanelDxf(cadNode);
            expect(dxf).toContain('OBRYS');
            expect(dxf).toContain('DRILL_D5_Z13');
            expect(dxf).toContain('EOF');
        });

        it('kompatybilność dwukierunkowa: importDxfToWorkpiece poprawnie importuje wyeksportowany DXF', () => {
            const dxf = generatePanelDxf(testPanel);
            const payload = importDxfToWorkpiece(dxf, 'Boczek_Lewy.dxf', { defaultThicknessMm: 18 });

            expect(payload.workpiece).toBeDefined();
            // workpiece trzyma wymiary w nanometrach (SSOT domeny CAD)
            expect(payload.workpiece.width).toBe(mmToNm(600));
            expect(payload.workpiece.height).toBe(mmToNm(800));
            expect(payload.workpiece.thickness).toBe(mmToNm(18));
            expect(payload.workpiece.features.length).toBeGreaterThan(0);
        });

        it('eksport szafy z półkami (Bok_P) i import z powrotem do CNC z zachowaniem WCS i nieprzelotowych otworów', async () => {
            const doc = new ProjectDocument();
            ContextManager.instance.document = doc;
            ContextManager.instance.commandHistory = new CommandHistory(doc);
            ContextManager.instance.panelViews.clear();

            new CreateKorpusCommand({
                szerokosc_mm: 800,
                wysokosc_mm: 2000,
                glebokosc_mm: 560,
                liczba_stref: 1
            } as any).execute(doc);

            const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 });
            const shelvesOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SHELVES')!;
            createBlokInDetectedBay(doc, bay!, shelvesOpt, {
                liczba_polek: 3,
                wzor_nawiercen: 'SINGLE',
                odsuniecie_przod_mm: 50
            });

            const cabinet = doc.getContainers()[0];
            new SyncShelfDrillingsCommand(cabinet.id).execute(doc);

            const rightPanelNode = doc.getPanels().find(p => (p.domainData as any)?.role === 'RIGHT_SIDE_PANEL')!;
            const rightPanel = rightPanelNode.domainData as any;

            // Eksport do DXF
            const dxf = generatePanelDxf(rightPanel);
            const parsed = parseDxfAscii(dxf);

            // Wymiary WCS w nagłówku DXF (obrócenie o 90 stopni: długa oś 2000mm wzdłuż X)
            expect(parsed.headerExtMax).toBeDefined();
            expect(parsed.headerExtMax?.x).toBeCloseTo(2000, 1);
            expect(parsed.headerExtMax?.y).toBeCloseTo(560, 1);
            expect(parsed.headerExtMax?.z).toBeCloseTo(18, 1);

            // Import z powrotem do CNC
            const imported = importDxfToWorkpiece(dxf, 'Bok_P.dxf');
            expect(imported.workpiece.width).toBe(mmToNm(2000));
            expect(imported.workpiece.height).toBe(mmToNm(560));
            expect(imported.workpiece.thickness).toBe(mmToNm(18));

            // Weryfikacja otworów: 6 otworów pod półki, żaden nie może być przelotowy!
            const holes = imported.workpiece.features.filter(f => f.type === 'hole');
            expect(holes.length).toBe(6);
            for (const h of holes) {
                expect(h.params.through).toBe(false);
                expect(h.params.diameter).toBe(5);
                expect(h.params.depth).toBe(12);
            }

            // Weryfikacja nuty pod plecy: 1 wpust wzdłuż długiej krawędzi formatki (oś X)
            const grooves = imported.workpiece.features.filter(f => f.type === 'groove');
            expect(grooves.length).toBe(1);
            const g = grooves[0];
            expect(g.params.width).toBeCloseTo(1986, 1);   // rozpiętość wzdłuż U (długa oś WCS)
            expect(g.params.length).toBe(3);               // szerokość frezu wzdłuż V
            expect(g.params.depth).toBe(11);
            expect(g.params.u).toBeCloseTo(7, 1);
            expect(g.params.v).toBeCloseTo(0, 1);

            // Brak fałszywych profili konturowych powstałych ze zdublowanego obrysu wpustu
            const contours = imported.workpiece.features.filter(f => f.type === 'contour');
            expect(contours.length).toBe(0);

            // ─── INWARIANT GEOMETRYCZNY: cecha CAD (WCS) == cecha po imporcie DXF ───
            // Porównujemy PROSTOKĄTY OBRÓBKI we wspólnym układzie (WCS, róg formatki = 0,0),
            // a nie same parametry — dzięki temu zamiana width/length lub lustro osi wyłapie test.
            const { GeometryDataExtractor } = await import('../geometry/geometry-extractor.js');
            const { WcsManager } = await import('../wcs/wcs-manager.js');
            const { WcsRulesMapper } = await import('../wcs/wcs-rules-mapper.js');
            const pW = nmToMm(rightPanel.width), pH = nmToMm(rightPanel.height), pT = nmToMm(rightPanel.thickness);
            const wcs = new WcsManager('G55');
            wcs.updateForPanelDimensions(pW, pH, pT);
            wcs.setRule(WcsRulesMapper.getRuleForRole(rightPanel.role)!);
            const cornersWcs = [-1, 1].flatMap(sx => [-1, 1].map(sy =>
                wcs.toWcsCoordinates({ x: sx * pW / 2, y: sy * pH / 2, z: pT / 2 })));
            const minX = Math.min(...cornersWcs.map(c => c.x));
            const minY = Math.min(...cornersWcs.map(c => c.y));

            type Rect = [number, number, number, number];
            const norm = (r: Rect): Rect => r.map(v => Math.round(v * 10) / 10) as Rect;
            const cadFeatures = new GeometryDataExtractor().extractPanelFeatures(rightPanel, wcs).features as any[];

            // Wpust: prostokąt CAD z osi + szerokości frezu
            const cadGroove = cadFeatures.find(f => 'startPoint' in f)!;
            const gx1 = cadGroove.startPoint.x - minX, gy1 = cadGroove.startPoint.y - minY;
            const gx2 = cadGroove.endPoint.x - minX, gy2 = cadGroove.endPoint.y - minY;
            const hw = cadGroove.width / 2;
            const cadRect = norm([
                Math.min(gx1, gx2) - (Math.abs(gx2 - gx1) < Math.abs(gy2 - gy1) ? hw : 0),
                Math.min(gy1, gy2) - (Math.abs(gx2 - gx1) < Math.abs(gy2 - gy1) ? 0 : hw),
                Math.max(gx1, gx2) + (Math.abs(gx2 - gx1) < Math.abs(gy2 - gy1) ? hw : 0),
                Math.max(gy1, gy2) + (Math.abs(gx2 - gx1) < Math.abs(gy2 - gy1) ? 0 : hw),
            ]);
            // Wpust po imporcie: prostokąt u,v,width(U),length(V) — tak go rysuje mesh CAD
            const impRect = norm([g.params.u, g.params.v, g.params.u + g.params.width, g.params.v + g.params.length]);
            expect(impRect).toEqual(cadRect);

            // Otwory: zbiór środków musi być identyczny
            const key = (x: number, y: number) => `${Math.round(x * 10) / 10}|${Math.round(y * 10) / 10}`;
            const cadHoles = cadFeatures.filter(f => 'diameter' in f)
                .flatMap((f: any) => (f.positions ?? [f.position]).map((p: any) => key(p.x - minX, p.y - minY))).sort();
            const impHoles = holes.map(h => key(h.params.u, h.params.v)).sort();
            expect(impHoles).toEqual(cadHoles);
        });

        // ═════════════════════════════════════════════════════════════════════════
        // KONTRAKT UKŁADÓW: CAD(LCS) → CAM(WCS) → DXF → import.
        // Przejście LCS→WCS to ruch sztywny (obrót/odbicie + przesunięcie), więc musi zachować:
        //   1) odstępy między cechami (każdy z każdym),
        //   2) odległości cech od krawędzi formatki,
        //   3) odstęp otwór ↔ oś wpustu.
        // Pomiar robimy NAJPIERW w LCS (surowe cechy CAD), POTEM w WCS (cechy CAM)
        // i porównujemy różnice. Ten sam pomiar wykonujemy po imporcie DXF.
        // ═════════════════════════════════════════════════════════════════════════
        type P = { x: number; y: number };
        type Seg = { a: P; b: P };
        interface Layout { holes: P[]; groove: Seg; W: number; H: number }

        const buildCabinetPanel = (role: string): any => {
            const doc = new ProjectDocument();
            ContextManager.instance.document = doc;
            ContextManager.instance.commandHistory = new CommandHistory(doc);
            ContextManager.instance.panelViews.clear();
            new CreateKorpusCommand({ szerokosc_mm: 800, wysokosc_mm: 2000, glebokosc_mm: 560, liczba_stref: 1 } as any).execute(doc);
            const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: 1000 });
            createBlokInDetectedBay(doc, bay!, BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SHELVES')!, {
                liczba_polek: 3, wzor_nawiercen: 'SINGLE', odsuniecie_przod_mm: 50
            });
            new SyncShelfDrillingsCommand(doc.getContainers()[0].id).execute(doc);
            return doc.getPanels().find(p => (p.domainData as any)?.role === role)!.domainData as any;
        };

        /** Oś wpustu z prostokąta u,v,width(U),length(V) — tak, jak rysuje go mesh CAD. */
        const grooveAxisFromRect = (g: { u: number; v: number; width: number; length: number }): Seg =>
            g.width < g.length
                ? { a: { x: g.u + g.width / 2, y: g.v }, b: { x: g.u + g.width / 2, y: g.v + g.length } }
                : { a: { x: g.u, y: g.v + g.length / 2 }, b: { x: g.u + g.width, y: g.v + g.length / 2 } };

        /** KROK 1: położenie cech CAD w LCS (u,v na FACE_Z_PLUS). */
        const layoutFromLcs = async (panel: any): Promise<Layout> => {
            const { getGrooveParamsMm } = await import('../../A1_core/groove-params.js');
            const holes: P[] = [];
            let groove: Seg | null = null;
            for (const f of panel.features) {
                expect(f.face).toBe('FACE_Z_PLUS');
                if (f.type === 'hole') holes.push({ x: f.params.u, y: f.params.v });
                else if (f.type === 'groove') groove = grooveAxisFromRect(getGrooveParamsMm(f.params));
            }
            expect(holes.length).toBe(6);
            expect(groove).not.toBeNull();
            return { holes, groove: groove!, W: nmToMm(panel.width), H: nmToMm(panel.height) };
        };

        /** KROK 2: położenie cech CAM w WCS; róg formatki w WCS sprowadzony do (0,0). */
        const layoutFromWcs = async (panel: any, camFeatures: any[]): Promise<Layout> => {
            const { WcsManager } = await import('../wcs/wcs-manager.js');
            const { WcsRulesMapper } = await import('../wcs/wcs-rules-mapper.js');
            const W = nmToMm(panel.width), H = nmToMm(panel.height), T = nmToMm(panel.thickness);
            const wcs = new WcsManager('G55');
            wcs.updateForPanelDimensions(W, H, T);
            wcs.setRule(WcsRulesMapper.getRuleForRole(panel.role)!);
            const cs = [-1, 1].flatMap(sx => [-1, 1].map(sy =>
                wcs.toWcsCoordinates({ x: sx * W / 2, y: sy * H / 2, z: T / 2 })));
            const minX = Math.min(...cs.map(c => c.x)), maxX = Math.max(...cs.map(c => c.x));
            const minY = Math.min(...cs.map(c => c.y)), maxY = Math.max(...cs.map(c => c.y));
            const g = camFeatures.find(f => 'startPoint' in f);
            expect(g).toBeDefined();
            return {
                holes: camFeatures.filter(f => 'diameter' in f)
                    .flatMap((f: any) => (f.positions ?? [f.position]).map((p: any) => ({ x: p.x - minX, y: p.y - minY }))),
                groove: {
                    a: { x: g.startPoint.x - minX, y: g.startPoint.y - minY },
                    b: { x: g.endPoint.x - minX, y: g.endPoint.y - minY }
                },
                W: maxX - minX, H: maxY - minY
            };
        };

        const measure = (L: Layout) => {
            const dist = (p: P, q: P) => Math.hypot(p.x - q.x, p.y - q.y);
            const distToLine = (p: P, s: Seg) => {
                const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
                return Math.abs(dy * (p.x - s.a.x) - dx * (p.y - s.a.y)) / Math.hypot(dx, dy);
            };
            const r2 = (n: number) => Math.round(n * 100) / 100;
            const num = (a: number, b: number) => a - b;
            const pts = [...L.holes, L.groove.a, L.groove.b];
            const pair: number[] = [];
            for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) pair.push(r2(dist(pts[i], pts[j])));
            return {
                pairGaps: pair.sort(num),
                edgeGaps: pts.map(p => [p.x, L.W - p.x, p.y, L.H - p.y].sort(num).map(r2).join('/')).sort(),
                holeToGroove: L.holes.map(h => r2(distToLine(h, L.groove))).sort(num),
                grooveLen: r2(dist(L.groove.a, L.groove.b)),
                size: [r2(L.W), r2(L.H)].sort(num)
            };
        };

        const expectSameGaps = (actual: Layout, expected: Layout) => {
            const a = measure(actual), e = measure(expected);
            expect(a.size).toEqual(e.size);
            expect(a.pairGaps).toEqual(e.pairGaps);
            expect(a.edgeGaps).toEqual(e.edgeGaps);
            expect(a.holeToGroove).toEqual(e.holeToGroove);
            expect(a.grooveLen).toBe(e.grooveLen);
        };

        it.each(['RIGHT_SIDE_PANEL', 'LEFT_SIDE_PANEL'])('inwariant odstępów LCS→WCS→DXF dla %s', async (role) => {
            const { GeometryDataExtractor } = await import('../geometry/geometry-extractor.js');
            const { WcsManager } = await import('../wcs/wcs-manager.js');
            const { WcsRulesMapper } = await import('../wcs/wcs-rules-mapper.js');
            const { getGrooveParamsMm } = await import('../../A1_core/groove-params.js');

            const panel = buildCabinetPanel(role);
            const lcs = await layoutFromLcs(panel);

            const wcs = new WcsManager('G55');
            wcs.updateForPanelDimensions(nmToMm(panel.width), nmToMm(panel.height), nmToMm(panel.thickness));
            wcs.setRule(WcsRulesMapper.getRuleForRole(role)!);
            const cam = new GeometryDataExtractor().extractPanelFeatures(panel, wcs).features as any[];
            expectSameGaps(await layoutFromWcs(panel, cam), lcs);

            const imp = importDxfToWorkpiece(generatePanelDxf(panel), `${role}.dxf`).workpiece;
            const ig = getGrooveParamsMm(imp.features.find(f => f.type === 'groove')!.params);
            expectSameGaps({
                holes: imp.features.filter(f => f.type === 'hole').map(h => ({ x: h.params.u, y: h.params.v })),
                groove: grooveAxisFromRect(ig),
                W: nmToMm(imp.width), H: nmToMm(imp.height)
            }, lcs);
        });

        // Ścieżka NORMALNA: CAD → PPM „Otwórz w CNC” → snapshot → sesja (JSON) → hydrate w nowym
        // dokumencie strony CNC → program CNC (buildDefaultCncProgramForPanel) → cechy w WCS.
        it.each(['RIGHT_SIDE_PANEL', 'LEFT_SIDE_PANEL'])('inwariant odstępów w trybie normalnym CAD→CNC (PPM) dla %s', async (role) => {
            const { snapshotPanelForCnc, hydrateCncWorkpiece } = await import('../../src/module-data/cad-extract');
            const { buildDefaultCncProgramForPanel } = await import('../core/cam-auto-program.js');

            const cadPanel = buildCabinetPanel(role);
            const lcsCad = await layoutFromLcs(cadPanel);

            // sesja między stronami = serializacja JSON
            const snapshot = JSON.parse(JSON.stringify(snapshotPanelForCnc(cadPanel)));
            const cncDoc = new ProjectDocument();
            const cncPanel = hydrateCncWorkpiece(cncDoc, snapshot);

            // 1) hydratacja nie może ruszyć cech w LCS
            expect(cncPanel.role).toBe(role);
            expectSameGaps(await layoutFromLcs(cncPanel), lcsCad);

            // 2) program CNC strony CNC: cechy w WCS muszą zachować odstępy z LCS
            const prog = buildDefaultCncProgramForPanel(cncPanel)!;
            expect(prog).not.toBeNull();
            expectSameGaps(await layoutFromWcs(cncPanel, prog.features as any[]), lcsCad);
        });
    });
});
