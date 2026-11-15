import { describe, it, expect } from 'vitest';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';
import { WcsManager } from '../wcs/wcs-manager.js';
import { CAMProcessor } from '../processor/cam-processor.js';
import { ToolLibrary } from '../processor/tool-library.js';
import { CAMProject } from '../dto/cam-dto.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('C1_CNC: Z-Axis Direction Filtering (Top vs Bottom Faces)', () => {
    const extractor = new GeometryDataExtractor();
    const toolLibrary = new ToolLibrary();

    const panelWithBothSides: any = {
        id: 'panel_dual_face_test',
        name: 'Formatka Obustronna',
        role: 'LEFT_SIDE_PANEL',
        width: mmToNm(600),
        height: mmToNm(800),
        thickness: mmToNm(18),
        features: [
            // Cechy na górnej powierzchni (FACE_Z_PLUS - Strona A)
            {
                id: 'hole_top_1',
                type: 'hole',
                name: 'Otwór góra 1',
                face: 'FACE_Z_PLUS',
                params: { x: 50, y: 100, diameter: 8, depth: 12 }
            },
            {
                id: 'groove_top_1',
                type: 'groove',
                name: 'Rowek góra',
                face: 'FACE_Z_PLUS',
                params: { u: 100, v: 0, width: 4, length: 500, depth: 8 }
            },
            // Cechy na dolnej powierzchni (FACE_Z_MINUS - Strona B / spód)
            {
                id: 'hole_bottom_1',
                type: 'hole',
                name: 'Otwór spód 1',
                face: 'FACE_Z_MINUS',
                params: { x: 50, y: 100, diameter: 15, depth: 13 }
            },
            {
                id: 'groove_bottom_1',
                type: 'groove',
                name: 'Rowek spód pod LED',
                face: 'FACE_Z_MINUS',
                params: { u: 200, v: 50, width: 14, length: 600, depth: 9 }
            },
            // Otwór krawędziowy (FACE_X_PLUS - wiertło poziome)
            {
                id: 'hole_edge_1',
                type: 'hole',
                name: 'Kołek w krawędzi',
                face: 'FACE_X_PLUS',
                params: { x: 9, y: 50, diameter: 8, depth: 25 }
            }
        ]
    };

    it('w układzie standardowym (G55 / Strona A) wybiera WYŁĄCZNIE cechy górne i krawędziowe, odrzucając spód', () => {
        const wcsTop = new WcsManager('G55');
        wcsTop.updateForPanelDimensions(600, 800, 18);
        wcsTop.setRule({
            origin_corner: { X: '-', Y: '-', Z: '+' },
            directions: { X: '+', Y: '+', Z: '+' },
            rotation: { X: 0, Y: 0, Z: 0 }
        });

        const camData = extractor.extractPanelFeatures(panelWithBothSides, wcsTop);
        const features = camData.features;

        // Oczekujemy: otwór górny, rowek górny oraz otwór krawędziowy
        // Cechy dolne (hole_bottom_1, groove_bottom_1) MUSZĄ zostać odrzucone
        const names = features.map(f => f.name);
        expect(names.some(n => n?.includes('góra') || n?.includes('Otwór') && !n?.includes('spód'))).toBe(true);
        expect(names.some(n => n?.includes('Rowek góra'))).toBe(true);
        expect(names.some(n => n?.includes('Kołek w krawędzi'))).toBe(true);

        expect(names.some(n => n?.includes('spód'))).toBe(false);

        // Wszystkie otwory pionowe w programie muszą mieć wektor podejścia wrzeciona w dół (axis.z <= 0)
        for (const feat of features) {
            if ('axis' in feat && feat.axis && Math.abs(feat.axis.z) > 0.5) {
                expect(feat.axis.z).toBeLessThanOrEqual(0.1);
            }
            if ('normal' in feat && (feat as any).normal) {
                expect((feat as any).normal.z).toBeGreaterThanOrEqual(-0.1);
            }
        }
    });

    it('w układzie obróconym o 180° wokół X (obrócona formatka / Strona B) wybiera WYŁĄCZNIE cechy spodnie', () => {
        const wcsBottom = new WcsManager('G56');
        wcsBottom.updateForPanelDimensions(600, 800, 18);
        wcsBottom.setRule({
            origin_corner: { X: '-', Y: '-', Z: '-' },
            directions: { X: '+', Y: '+', Z: '+' },
            rotation: { X: 180, Y: 0, Z: 0 } // obrót o 180 wokół X
        });

        const camData = extractor.extractPanelFeatures(panelWithBothSides, wcsBottom);
        const features = camData.features;

        const names = features.map(f => f.name);
        expect(names.some(n => n?.includes('spód') || n?.includes('Rowek spód'))).toBe(true);
        expect(names.some(n => n?.includes('Rowek góra'))).toBe(false);

        // Po transformacji WCS (obrót o 180°) cechy spodnie są zwrócone ku wrzecionu (+Z ku -Z)
        for (const feat of features) {
            if ('axis' in feat && feat.axis && Math.abs(feat.axis.z) > 0.5) {
                expect(feat.axis.z).toBeLessThanOrEqual(0.1);
            }
            if ('normal' in feat && (feat as any).normal) {
                expect((feat as any).normal.z).toBeGreaterThanOrEqual(-0.1);
            }
        }
    });

    it('CAMProcessor nie generuje ścieżek wiercenia od dołu przez stół maszyny', () => {
        const wcsTop = new WcsManager('G55');
        wcsTop.updateForPanelDimensions(600, 800, 18);

        const processor = new CAMProcessor(toolLibrary);
        const camData = extractor.extractPanelFeatures(panelWithBothSides, wcsTop);
        const camProject: CAMProject = {
            projectName: 'Test_Z_Filtering',
            wcsName: 'G55',
            wcsOrigin: wcsTop.getOrigin(),
            features: camData.features,
            toolAssignments: {},
            postprocessor: 'Mach3'
        };
        const program = processor.buildCLProgram(camProject);

        expect(program).toBeDefined();
        expect(program.commands.length).toBeGreaterThan(0);

        // Żadna operacja wiercenia w CLData nie może mieć osi Z skierowanej ku górze (axis.z > 0.1)
        for (const cmd of program.commands) {
            if (cmd.type === 'CYCLE_DRILL' && cmd.drillParams?.axis) {
                expect(cmd.drillParams.axis.z).toBeLessThanOrEqual(0.1);
            }
        }
    });
});
