/**
 * C1_cnc/__tests__/panel-html-preview.test.ts
 * 
 * Testy jednostkowe generatora podglądu HTML i kart technologicznych formatki (WCS, wymiary otworów, okleinowanie).
 */

import { describe, it, expect } from 'vitest';
import { generatePanelDxf } from '../exporters/dxf-panel-exporter.js';
import { extractPanelPreviewData, renderPanelSvg, generatePanelsHtmlPreview } from '../exporters/panel-html-preview.js';
import { importDxfToWorkpiece, parseDxfAscii } from '../inputs/dxf-importer.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { applyLibraryOperation, bindOperationEdge } from '../../o1_operacji/operacje-apply.js';

describe('Panel HTML Preview & Dimensioned DXF Export', () => {
    const mockPanel = {
        id: 'panel_test_1',
        name: 'Bok Lewy Szafki',
        role: 'SIDE_LEFT',
        width: mmToNm(560),
        height: mmToNm(720),
        thickness: mmToNm(18),
        material: 'Dąb Craft Złoty 18mm',
        features: [
            {
                id: 'hole_p1',
                type: 'hole',
                face: 'FACE_Z_PLUS',
                params: {
                    u: 37,
                    v: 100,
                    diameter: 5,
                    depth: 13,
                    through: false
                }
            },
            {
                id: 'hole_p2',
                type: 'hole',
                face: 'FACE_Z_PLUS',
                params: {
                    u: 37,
                    v: 600,
                    diameter: 5,
                    depth: 13,
                    through: false
                }
            },
            {
                id: 'groove_nut',
                type: 'groove',
                face: 'FACE_Z_PLUS',
                params: {
                    u: 20,
                    v: 0,
                    width: 4,
                    depth: 8,
                    length: 720
                }
            }
        ],
        edgeBanding: {
            '+X': { active: true, name: 'ABS Dąb 1.0', thickness_mm: 1.0 },
            '-X': { active: true, name: 'ABS Dąb 0.8', thickness_mm: 0.8 },
            '-Y': { active: false, name: 'Brak', thickness_mm: 0 },
            '+Y': { active: false, name: 'Brak', thickness_mm: 0 }
        }
    };

    it('generatePanelDxf z flagą includeDimensions generuje warstwę WYMIARY_OTWORY z tekstami współrzędnych i znacznikami', () => {
        const dxf = generatePanelDxf(mockPanel, { includeDimensions: true });

        // Warstwa wymiarowa
        expect(dxf).toContain('WYMIARY_OTWORY');

        // Teksty współrzędnych otworów w DXF
        expect(dxf).toContain('X=');
        expect(dxf).toContain('Y=');
        expect(dxf).toContain('%%C5x13');

        // Encja TEXT
        expect(dxf).toContain('TEXT');
    });

    it('extractPanelPreviewData poprawnie wyciąga geometrię WCS, otwory i okleinowanie', () => {
        const preview = extractPanelPreviewData(mockPanel, 'Szafka_Dolna_1');

        expect(preview.id).toBe('panel_test_1');
        expect(preview.name).toBe('Bok Lewy Szafki');
        expect(preview.containerName).toBe('Szafka_Dolna_1');
        expect(preview.dimensions.width).toBe(720);
        expect(preview.dimensions.height).toBe(560);
        expect(preview.dimensions.thickness).toBe(18);

        // Otwory
        expect(preview.holes.length).toBeGreaterThanOrEqual(2);
        expect(preview.holes[0].diameter).toBe(5);
        expect(preview.holes[0].depth).toBe(13);

        // Okleinowanie (bok leży poziomo: -Y = Przód, -X = Dół)
        const edgeFront = preview.edges.find(e => e.edgeKey === '-Y');
        expect(edgeFront?.active).toBe(true);
        expect(edgeFront?.thicknessMm).toBe(1.0);

        const edgeBottom = preview.edges.find(e => e.edgeKey === '-X');
        expect(edgeBottom?.active).toBe(false);

        // Zawartość DXF
        expect(preview.dxfContent).toContain('OBRYS');
        expect(preview.dxfFilename).toBe('Bok_Lewy_Szafki.dxf');
    });

    it('renderPanelSvg generuje prawdziwy rysunek techniczny z bazą (0,0) bez G55, klasycznym wymiarowaniem i linią odsuniętą obrzeża', () => {
        const preview = extractPanelPreviewData(mockPanel);
        const svg = renderPanelSvg(preview);

        expect(svg).toContain('<svg');
        expect(svg).toContain('polygon');
        // Usunięcie opisów G55 i maszynowych BAZA CNC
        expect(svg).not.toContain('G55');
        expect(svg).not.toContain('BAZA CNC');
        // Czysta baza odniesienia (0, 0)
        expect(svg).toContain('(0, 0)');
        expect(svg).toContain('+X');
        expect(svg).toContain('+Y');
        // Linia przerywana równoległa obrzeża (1.0 mm)
        expect(svg).toContain('ABS 1 mm');
        expect(svg).toMatch(/data-edge-banding="-Y"[^>]*stroke-dasharray="\d+\s+\d+"/);
        // Wymiary gabarytowe
        expect(svg).toContain('560 mm');
        expect(svg).toContain('720 mm');
        // Klasyczne linie wymiarowe i oznaczenia otworów bez tabelki
        expect(svg).toContain('⌀5×13');
        expect(svg).toContain('37');
        // Usunięcie zasłaniającej tabliczki metryczki z rzutu formatki
        expect(svg).not.toContain('title_block');
    });

    it('generatePanelsHtmlPreview generuje profesjonalny rysunek techniczny HTML z Zoom & Pan, bez G55 i ze zwartym nagłówkiem', () => {
        const preview = extractPanelPreviewData(mockPanel, 'Szafka_1');
        const html = generatePanelsHtmlPreview([preview], 'Rysunek Techniczny Formatki');

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('Rysunek Techniczny Formatki');
        expect(html).toContain('Bok Lewy Szafki');
        expect(html).toContain('DXF');
        // Usunięcie kodów maszynowych G55
        expect(html).not.toContain('G55');
        expect(html).not.toContain('BAZA CNC');
        // Zwarty nagłówek w jeden ciągły rząd
        expect(html).toContain('panel-header-compact');
        expect(html).toContain('topbar-compact');
        // Obsługa Zoom & Pan
        expect(html).toContain('zoom-toolbar');
        expect(html).toContain('btn-zoom-in');
        expect(html).toContain('btn-zoom-out');
        expect(html).toContain('btn-zoom-reset');
        expect(html).toContain('addEventListener(\'wheel\'');
        expect(html).toContain('addEventListener(\'pointermove\'');
        // Brak zbędnych tabel ze współrzędnymi i obrzeżami (prezentacja bezpośrednio na rysunku SVG)
        expect(html).not.toContain('<table');
        expect(html).not.toContain('tables-grid');
        expect(html).toContain('⌀5');
    });

    it('dla boków korpusu punkt zerowy (0, 0) jest na dole i z przodu, a operacje rewizji są w pełni zwymiarowane', () => {
        const mockSideWithRewizja = {
            id: 'panel_bok_p',
            name: 'Bok Prawy',
            role: 'RIGHT_SIDE_PANEL',
            width: mmToNm(560), // Głębokość korpusu w LCS (oś X formatki)
            height: mmToNm(2000), // Wysokość korpusu w LCS (oś Y formatki)
            thickness: mmToNm(18),
            features: [
                {
                    id: 'hole_zawias_1',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 37, v: 100, diameter: 5, depth: 13 }
                },
                {
                    id: 'op_rewizja_1',
                    type: 'cutout',
                    name: 'Rewizja pod rury',
                    face: 'FACE_Z_PLUS',
                    params: {
                        library_id: 'rewizja',
                        u: 250,
                        v: 120,
                        width: 140,
                        length: 80,
                        through: true
                    }
                }
            ],
            edgeBanding: {
                '-X': { active: true, name: 'ABS 1.0', thickness_mm: 1.0 },
                '+X': { active: false, name: 'Brak', thickness_mm: 0 },
                '-Y': { active: true, name: 'ABS 0.8', thickness_mm: 0.8 },
                '+Y': { active: false, name: 'Brak', thickness_mm: 0 }
            }
        };

        const preview = extractPanelPreviewData(mockSideWithRewizja, 'Szafa_1');

        // Baza odniesienia dla boku: na dole i z przodu (formatka położona poziomo jak na stole CNC / DXF)
        expect(preview.isSidePanel).toBe(true);
        expect(preview.wcsOriginLabel).toContain('dół-przód');
        // Orientacja płaska (pozioma): W = 2000 (wysokość / dół-góra), H = 560 (głębokość / przód-tył)
        expect(preview.dxfWidth).toBe(2000);
        expect(preview.dxfHeight).toBe(560);

        // Ekstrakcja rewizji (bez opisów słownych na rysunku)
        expect(preview.cutouts.length).toBe(1);
        const rewizja = preview.cutouts[0];
        expect(rewizja.width).toBe(80);
        expect(rewizja.height).toBe(140);
        expect(rewizja.isThrough).toBe(true);

        // Renderowanie rzutu SVG
        const svg = renderPanelSvg(preview);

        // Baza (0, 0) i brak nieprofesjonalnych opisów słownych
        expect(svg).toContain('(0, 0)');
        expect(svg).not.toContain('DÓŁ-PRZÓD');
        expect(svg).toContain('PRZÓD: ABS 1 mm');
        expect(svg).toContain('DÓŁ: ABS 0.8 mm');
        expect(svg).not.toContain('Rewizja pod rury');
        expect(svg).not.toContain('140×80');
        expect(svg).not.toContain('(Głębokość)');
        expect(svg).not.toContain('(Wysokość)');
        expect(svg).not.toContain('(W głąb)');
        expect(svg).not.toContain('(W górę)');

        // Zwymiarowanie wycięcia: gabaryty i położenie od bazy (0, 0)
        expect(svg).toContain('140');
        expect(svg).toContain('80');
        expect(svg).toContain('250');
        expect(svg).toContain('120');
    });

    it('rewizja przypięta referencją od przodu boku (LEFT_SIDE_PANEL i RIGHT_SIDE_PANEL) ląduje z przodu zarówno w DXF jak i na podglądzie SVG', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
        new CreateKorpusCommand({ szerokosc_mm: 800, wysokosc_mm: 2000, glebokosc_mm: 560, liczba_stref: 1 } as any).execute(doc);

        for (const role of ['LEFT_SIDE_PANEL', 'RIGHT_SIDE_PANEL'] as const) {
            const panel = doc.getPanels().find(p => (p.domainData as any)?.role === role)!.domainData as any;
            applyLibraryOperation(panel, 'rewizja', 'FACE_Z_PLUS', {
                uMm: 80,
                vMm: 100,
                widthMm: 100,
                heightMm: 60,
            });
            const bound = bindOperationEdge(panel, 'rewizja', 'przod', 'u', 'FACE_Z_PLUS');
            expect(bound).not.toBeNull();

            // 1. Podgląd HTML/SVG (formatka położona płasko jak DXF): (0,0) = Dół-Przód, oś X = od dołu (v), oś Y = od przodu (u -> 30..130)
            const preview = extractPanelPreviewData(panel, 'Szafa_1');
            expect(preview.cutouts.length).toBe(1);
            expect(preview.cutouts[0].x).toBeCloseTo(70, 1);
            expect(preview.cutouts[0].y).toBeCloseTo(30, 1);

            // 2. Nuta pod plecy leży przy górnej krawędzi rysunku płaskiego (y > 500 mm od przodu)
            expect(preview.grooves.length).toBe(1);
            expect(preview.grooves[0].y1).toBeGreaterThan(500);

            // 3. DXF: baza (0,0) = Dół-Przód, wycięcie na Y = 30..130 (przód), a nie Y > 400 (plecy)
            const dxf = generatePanelDxf(panel);
            const imp = importDxfToWorkpiece(dxf, `${role}.dxf`).workpiece;
            const impGroove = imp.features.find(f => f.type === 'groove')!;
            expect(impGroove.params.v).toBeGreaterThan(500);

            const parsed = parseDxfAscii(dxf);
            const cutoutPoly = parsed.entities.find((e: any) => e.type === 'LWPOLYLINE' && e.layer === 'CUTOUT') as any;
            expect(cutoutPoly).toBeDefined();
            const ys = cutoutPoly.vertices.map((pt: any) => pt.y);
            expect(Math.min(...ys)).toBeCloseTo(30, 1);
            expect(Math.max(...ys)).toBeCloseTo(130, 1);

            // 4. Obrzeże z korpusu (type_id bez thickness_mm) renderuje przerywane linie równoległe na właściwych krawędziach
            const svg = renderPanelSvg(preview);
            const frontEdge = preview.edges.find(e => e.edgeKey === '-Y');
            const backEdge = preview.edges.find(e => e.edgeKey === '+Y');
            expect(frontEdge?.active).toBe(true);
            expect(frontEdge?.thicknessMm).toBeCloseTo(0.8, 2);
            expect(backEdge?.active).toBe(false);
            expect(svg).toMatch(/data-edge-banding="-Y"[^>]*stroke-dasharray="\d+\s+\d+"/);
            expect(svg).not.toContain('data-edge-banding="+Y"');
        }
    });

    it('przerywana linia obrzeża leży na zewnątrz obrysu, a gęste wymiary bazowe nie nachodzą na siebie', () => {
        const densePanel = {
            id: 'dense_panel_1',
            name: 'Front_Gesty',
            role: 'FRONT',
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(18),
            edgeBanding: {
                '-Y': { active: true, thickness_mm: 1.0 },
                '+Y': { active: true, thickness_mm: 2.0 },
                '-X': { active: true, thickness_mm: 0.8 },
                '+X': { active: false, thickness_mm: 0 },
            },
            features: [
                { id: 'h1', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 100, v: 37, diameter: 5, depth: 13 } },
                { id: 'h2', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 118, v: 50, diameter: 5, depth: 13 } },
                { id: 'h3', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 136, v: 68, diameter: 5, depth: 13 } },
                { id: 'h4', type: 'hole', face: 'FACE_Z_PLUS', params: { u: 154, v: 86, diameter: 5, depth: 13 } },
            ],
        };

        const preview = extractPanelPreviewData(densePanel);
        const svg = renderPanelSvg(preview);

        // Wyciągnij obrys prostokąta formatki w układzie SVG
        const polyMatch = svg.match(/<polygon points="([^"]+)"/);
        expect(polyMatch).toBeTruthy();
        const polyPts = polyMatch![1].trim().split(/\s+/).map(p => p.split(',').map(Number));
        const outlineMinX = Math.min(...polyPts.map(p => p[0]));
        const outlineMaxY = Math.max(...polyPts.map(p => p[1])); // w SVG Y=0 formatki jest na dole (max Y)
        const outlineMinY = Math.min(...polyPts.map(p => p[1]));

        // Sprawdź, że przerywane linie obrzeża (-Y na dole, +Y na górze, -X po lewej) leżą NA ZEWNĄTRZ obrysu
        const ebBottomY = Number(svg.match(/data-edge-banding="-Y"[^>]*y1="([^"]+)"/)![1]);
        const ebTopY = Number(svg.match(/data-edge-banding="\+Y"[^>]*y1="([^"]+)"/)![1]);
        const ebLeftX = Number(svg.match(/data-edge-banding="-X"[^>]*x1="([^"]+)"/)![1]);
        expect(ebBottomY).toBeGreaterThan(outlineMaxY);
        expect(ebTopY).toBeLessThan(outlineMinY);
        expect(ebLeftX).toBeLessThan(outlineMinX);

        // Sprawdź, że wszystkie linie wymiarów bazowych X (100, 118, 136, 154) leżą poniżej linii obrzeża -Y oraz na odrębnych torach Y
        const xDimLineMatches = Array.from(svg.matchAll(/<!-- Wymiar bazowy X=[\d.]+ przy grocie -->[\s\S]*?<line[^>]*y1="([^"]+)"[^>]*class="tech-line"/g));
        const xDimLineYs = xDimLineMatches.map(m => Number(m[1]));
        expect(xDimLineYs.length).toBe(4);
        for (const ly of xDimLineYs) {
            expect(ly).toBeGreaterThan(ebBottomY + 20);
        }
        // Gęsto położone wymiary X nie mieszczą się na 1 torze — co najmniej 2 różne tory Y, a sąsiednie nie współdzielą tego samego toru
        expect(new Set(xDimLineYs).size).toBeGreaterThanOrEqual(2);
        expect(xDimLineYs[0]).not.toBe(xDimLineYs[1]);
        expect(xDimLineYs[1]).not.toBe(xDimLineYs[2]);
        expect(xDimLineYs[2]).not.toBe(xDimLineYs[3]);

        // Analogicznie dla gęstych wymiarów bazowych Y (37, 50, 68, 86) — tory X poza obrzeżem -X i z różnymi X
        const yDimLineMatches = Array.from(svg.matchAll(/<!-- Wymiar bazowy Y=[\d.]+ przy grocie -->[\s\S]*?<line[^>]*x1="([^"]+)"[^>]*class="tech-line"/g));
        const yDimLineXs = yDimLineMatches.map(m => Number(m[1]));
        expect(yDimLineXs.length).toBe(4);
        for (const lx of yDimLineXs) {
            expect(lx).toBeLessThan(ebLeftX - 20);
        }
        expect(new Set(yDimLineXs).size).toBeGreaterThanOrEqual(2);
        expect(yDimLineXs[0]).not.toBe(yDimLineXs[1]);
        expect(yDimLineXs[1]).not.toBe(yDimLineXs[2]);
        expect(yDimLineXs[2]).not.toBe(yDimLineXs[3]);
    });
});
