import { describe, it, expect } from 'vitest';
import { DrawProjectionEngine, ProjectableCabinet } from '../draw-projection';
import { DrawDimensionsEngine } from '../draw-dimensions';
import { DrawSheetSVGGenerator } from '../draw-sheet-svg';
import { DrawHLREngine } from '../draw-hlr-engine';

describe('D1_draw Module Tests', () => {
    const mockCabinet: ProjectableCabinet = {
        width: 800,
        height: 720,
        depth: 560,
        name: 'Szafka Testowa',
        parts: [
            {
                id: 'bok_l',
                name: 'Bok Lewy',
                role: 'SIDE_L',
                material: 'Laminat 18mm',
                thickness: 18,
                dim: { x: 18, y: 720, z: 560 },
                loc: { x: -391, y: 0, z: 0 },
            },
            {
                id: 'bok_p',
                name: 'Bok Prawy',
                role: 'SIDE_R',
                material: 'Laminat 18mm',
                thickness: 18,
                dim: { x: 18, y: 720, z: 560 },
                loc: { x: 391, y: 0, z: 0 },
            },
            {
                id: 'wieniec_d',
                name: 'Wieniec Dolny',
                role: 'BOTTOM',
                material: 'Laminat 18mm',
                thickness: 18,
                dim: { x: 764, y: 18, z: 560 },
                loc: { x: 0, y: -351, z: 0 },
            },
            {
                id: 'wieniec_g',
                name: 'Wieniec Górny',
                role: 'TOP',
                material: 'Laminat 18mm',
                thickness: 18,
                dim: { x: 764, y: 18, z: 560 },
                loc: { x: 0, y: 351, z: 0 },
            },
        ],
    };

    it('generates multi-view 2D projections correctly', () => {
        const result = DrawProjectionEngine.generateViewsForCabinet(mockCabinet, 0.1);
        expect(result.views.length).toBe(4); // FRONT, TOP, RIGHT, ISO

        const frontView = result.views.find((v) => v.projection === 'FRONT');
        expect(frontView).toBeDefined();
        expect(frontView?.rects.length).toBe(4);
        expect(frontView?.widthMm).toBe(800);
        expect(frontView?.heightMm).toBe(720);

        const topView = result.views.find((v) => v.projection === 'TOP');
        expect(topView).toBeDefined();
        expect(topView?.heightMm).toBe(560); // depth

        expect(result.bomRows.length).toBe(4);
    });

    it('generates auto dimensions correctly', () => {
        const result = DrawProjectionEngine.generateViewsForCabinet(mockCabinet, 0.1);
        DrawDimensionsEngine.generateAutoDimensions(
            result.views,
            mockCabinet.width,
            mockCabinet.height,
            mockCabinet.depth,
            mockCabinet.parts
        );

        const frontView = result.views.find((v) => v.projection === 'FRONT');
        expect(frontView?.dimensions.length).toBeGreaterThanOrEqual(2); // overall W and H
        const wDim = frontView?.dimensions.find((d) => d.orientation === 'HORIZONTAL');
        expect(wDim?.valueMm).toBe(800);
        expect(wDim?.text).toBe('800');
    });

    it('generates full SVG sheet with ISO 7200 title block and BOM', () => {
        const result = DrawProjectionEngine.generateViewsForCabinet(mockCabinet, 0.1);
        DrawDimensionsEngine.generateAutoDimensions(
            result.views,
            mockCabinet.width,
            mockCabinet.height,
            mockCabinet.depth,
            mockCabinet.parts
        );

        const gen = new DrawSheetSVGGenerator('A3_LANDSCAPE');
        gen.views = result.views;
        gen.bomRows = result.bomRows;
        gen.titleBlock.furnitureName = 'Szafka Testowa';

        const svg = gen.generateSvg();
        expect(svg).toContain('<svg');
        expect(svg).toContain('TABELKA RYSUNKOWA ISO 7200');
        expect(svg).toContain('TABELA ZESTAWIENIA FORMATER (BOM)');
        expect(svg).toContain('Szafka Testowa');
        expect(svg).toContain('</svg>');
    });

    it('HLR rysuje krawędzie zasłonięte jako linie kreskowane', () => {
        const cabinetWithOcclusion: ProjectableCabinet = {
            width: 800,
            height: 720,
            depth: 560,
            name: 'Korpus z przegrodą',
            parts: [
                {
                    id: 'front',
                    name: 'Ściana przednia',
                    role: 'FRONT',
                    material: 'Laminat 18mm',
                    thickness: 18,
                    dim: { x: 800, y: 720, z: 18 },
                    loc: { x: 0, y: 0, z: 271 },
                },
                {
                    id: 'rear',
                    name: 'Przegroda tylna',
                    role: 'DIVIDER',
                    material: 'Laminat 18mm',
                    thickness: 18,
                    dim: { x: 200, y: 200, z: 18 },
                    loc: { x: 0, y: 0, z: -200 },
                },
            ],
        };

        const view = DrawProjectionEngine.generateSingleView(cabinetWithOcclusion, 'FRONT', 0.1, 0, 0);
        expect(view.segments && view.segments.length).toBeGreaterThan(0);
        const hidden = view.segments!.filter((s) => s.isHidden);
        const visible = view.segments!.filter((s) => !s.isHidden);
        expect(visible.length).toBeGreaterThan(0);
        expect(hidden.length).toBeGreaterThan(0);
        expect(hidden.every((s) => s.dashArray === '2,1.5')).toBe(true);
    });

    it('izometria to jeden rysunek HLR, bez zdublowanych wielokątów', () => {
        const view = DrawProjectionEngine.generateSingleView(mockCabinet, 'ISO', 0.1, 0, 0);
        expect(view.projection).toBe('ISO');
        expect(view.segments && view.segments.length).toBeGreaterThan(0);
        expect(view.polygons === undefined || view.polygons.length === 0).toBe(true);

        const gen = new DrawSheetSVGGenerator('A4_LANDSCAPE');
        gen.views = [view];
        const svg = gen.generateSvg();
        expect(svg).not.toContain('<polygon');
        expect((svg.match(/<line /g) || []).length).toBeGreaterThan(0);
    });

    it('ISO: sześcian ma 9 krawędzi ciągłych (przód) i 3 kreskowane (tył)', () => {
        const cubePart = {
            id: 'cube',
            name: 'Sześcian',
            role: 'PANEL' as const,
            material: 'Laminat',
            thickness: 200,
            dim: { x: 200, y: 200, z: 200 },
            loc: { x: 0, y: 0, z: 0 },
        };
        const { segments } = DrawHLREngine.computeHLR([cubePart], 'ISO');
        const hidden = segments.filter((s) => s.isHidden);
        const visible = segments.filter((s) => !s.isHidden);
        expect(visible.length).toBe(9);
        expect(hidden.length).toBe(3);
        expect(hidden.every((s) => s.dashArray === '2,1.5')).toBe(true);
        expect(visible.every((s) => !s.dashArray)).toBe(true);
    });

    it('ISO: krawędzie najbliższe kamery nie są kreskowane', () => {
        const view = DrawProjectionEngine.generateSingleView(mockCabinet, 'ISO', 0.1, 0, 0);
        const hidden = (view.segments || []).filter((s) => s.isHidden);
        const visible = (view.segments || []).filter((s) => !s.isHidden);
        expect(visible.length).toBeGreaterThan(hidden.length);
        const visLen = visible.reduce((acc, s) => acc + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0);
        const hidLen = hidden.reduce((acc, s) => acc + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0);
        expect(visLen).toBeGreaterThan(hidLen);
    });
});
