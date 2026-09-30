/**
 * C1_cnc/__tests__/dxf-importer.test.ts
 * 
 * Testy jednostkowe importera DXF dla modułu CNC/CAM.
 */

import { describe, it, expect } from 'vitest';
import { parseDxf, parseLayerParams, importDxfToWorkpiece, inspectDxf } from '../inputs/dxf-importer.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

describe('DXF Importer - parser i konwersja technologiczna', () => {
    describe('parseLayerParams', () => {
        it('prawidłowo rozpoznaje obrys formatki', () => {
            expect(parseLayerParams('OBRYS').isOutline).toBe(true);
            expect(parseLayerParams('PANEL').isOutline).toBe(true);
            expect(parseLayerParams('OUTLINE').isOutline).toBe(true);
            expect(parseLayerParams('FORMATKA').isOutline).toBe(true);
        });

        it('dekoduje parametry wiercenia z nazwy warstwy (DRILL_D8_Z13)', () => {
            const params = parseLayerParams('DRILL_D8_Z13');
            expect(params.isDrill).toBe(true);
            expect(params.diameter).toBe(8);
            expect(params.depth).toBe(13);
        });

        it('dekoduje parametry wiercenia z polskich nazw (WIERCENIE_5_G14)', () => {
            const params = parseLayerParams('WIERCENIE_5_G14');
            expect(params.isDrill).toBe(true);
            expect(params.diameter).toBe(5);
            expect(params.depth).toBe(14);
        });

        it('dekoduje parametry wpustu (WPUST_W4_Z8, GROOVE_W6_D10)', () => {
            const wpust = parseLayerParams('WPUST_W4_Z8');
            expect(wpust.isGroove).toBe(true);
            expect(wpust.width).toBe(4);
            expect(wpust.depth).toBe(8);

            const groove = parseLayerParams('GROOVE_W6_D10');
            expect(groove.isGroove).toBe(true);
            expect(groove.width).toBe(6);
            expect(groove.depth).toBe(10);
        });
    });

    describe('parseDxf', () => {
        it('parsuje encje CIRCLE, LINE i LWPOLYLINE z sekcji ENTITIES', () => {
            const sampleDxf = `
0
SECTION
2
ENTITIES
0
CIRCLE
8
DRILL_D8_Z13
10
100.0
20
150.0
30
0.0
40
4.0
0
LINE
8
WPUST_W4_Z8
10
50.0
20
50.0
11
250.0
21
50.0
0
LWPOLYLINE
8
OBRYS
90
4
70
1
10
0.0
20
0.0
10
600.0
20
0.0
10
600.0
20
400.0
10
0.0
20
400.0
0
ENDSEC
0
EOF
`;
            const entities = parseDxf(sampleDxf);
            expect(entities).toHaveLength(3);

            const circle = entities.find(e => e.type === 'CIRCLE') as any;
            expect(circle).toBeDefined();
            expect(circle.layer).toBe('DRILL_D8_Z13');
            expect(circle.x).toBe(100);
            expect(circle.y).toBe(150);
            expect(circle.radius).toBe(4);

            const line = entities.find(e => e.type === 'LINE') as any;
            expect(line).toBeDefined();
            expect(line.layer).toBe('WPUST_W4_Z8');
            expect(line.x1).toBe(50);
            expect(line.x2).toBe(250);

            const poly = entities.find(e => e.type === 'LWPOLYLINE') as any;
            expect(poly).toBeDefined();
            expect(poly.layer).toBe('OBRYS');
            expect(poly.closed).toBe(true);
            expect(poly.vertices).toHaveLength(4);
        });
    });

    describe('importDxfToWorkpiece', () => {
        const sampleDxf = `
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
OBRYS
90
4
70
1
10
100.0
20
100.0
10
900.0
20
100.0
10
900.0
20
700.0
10
100.0
20
700.0
0
CIRCLE
8
DRILL_D8_Z13
10
200.0
20
250.0
40
4.0
0
LINE
8
WPUST_W4_Z8
10
150.0
20
300.0
11
850.0
21
300.0
0
ENDSEC
0
EOF
`;

        it('buduje kompletny CncModulePayload i CncWorkpiece z jednostkami w nanometrach', () => {
            const payload = importDxfToWorkpiece(sampleDxf, 'boczek_szafki.dxf', { defaultThicknessMm: 18 });

            expect(payload.meta.module).toBe('cnc');
            expect(payload.meta.sourceId).toBe('dxf');
            expect(payload.workpiece).toBeDefined();

            const wp = payload.workpiece;
            // Obrys 100..900 w X (800mm) i 100..700 w Y (600mm)
            expect(nmToMm(wp.width)).toBe(800);
            expect(nmToMm(wp.height)).toBe(600);
            expect(nmToMm(wp.thickness)).toBe(18);

            // Cechy technologiczne (features)
            expect(wp.features).toBeDefined();
            expect(wp.features.length).toBeGreaterThanOrEqual(2);

            // Wiercenie ø8 Z=13, znormalizowane o offset (100, 100): X=200-100=100, Y=250-100=150
            const drill = wp.features.find(f => f.type === 'hole') as any;
            expect(drill).toBeDefined();
            expect(drill.face).toBe('FACE_Z_PLUS');
            expect(drill.params.diameter).toBe(8);
            expect(drill.params.depth).toBe(13);
            expect(drill.params.x).toBe(100);
            expect(drill.params.y).toBe(150);
            expect(drill.params.u).toBe(100);
            expect(drill.params.v).toBe(150);

            // Wpust W=4 Z=8, znormalizowany o offset (100, 100)
            const groove = wp.features.find(f => f.type === 'groove') as any;
            expect(groove).toBeDefined();
            expect(groove.params.width).toBe(4);
            expect(groove.params.depth).toBe(8);
            expect(groove.params.u).toBe(50);
            expect(groove.params.startPoint.x).toBe(50);
            expect(groove.params.endPoint.x).toBe(750);
        });

        it('inspectDxf() błyskawicznie analizuje wymiary i obróbki dla modala przygotówki', () => {
            const summary = inspectDxf(sampleDxf);
            expect(summary.widthMm).toBe(800);
            expect(summary.heightMm).toBe(600);
            expect(summary.holesCount).toBe(1);
            expect(summary.groovesCount).toBe(1);
        });

        it('importuje DXF z niestandardową grubością wybraną w modalu (np. 12 mm lub 28 mm)', () => {
            const payload = importDxfToWorkpiece(sampleDxf, 'blat.dxf', {
                defaultThicknessMm: 28,
                defaultDrillDepthMm: 15
            });
            expect(nmToMm(payload.workpiece.thickness)).toBe(28);
        });

        it('obsługuje DXF bez jawnej warstwy obrysu (wyznacza formatkę z BoundingBox)', () => {
            const dxfNoOutline = `
0
SECTION
2
ENTITIES
0
CIRCLE
8
WIERCENIE_D5_Z10
10
50.0
20
50.0
40
2.5
0
CIRCLE
8
WIERCENIE_D5_Z10
10
450.0
20
650.0
40
2.5
0
ENDSEC
0
EOF
`;
            const payload = importDxfToWorkpiece(dxfNoOutline, 'prosta_plytka.dxf', { defaultThicknessMm: 18 });
            const wp = payload.workpiece;
            // Bounding box uwzględnia promień r=2.5: min=47.5, max=452.5 (szerokość 405mm) oraz min=47.5, max=652.5 (wysokość 605mm)
            expect(nmToMm(wp.width)).toBe(405);
            expect(nmToMm(wp.height)).toBe(605);
        });

        it('importuje prosty prostokąt z 4 zwykłych linii LINE (warstwa domyślna 0) bez fałszywych wpustów', () => {
            const dxf4Lines = `
0
SECTION
2
ENTITIES
0
LINE
8
0
10
0.0
20
0.0
11
500.0
21
0.0
0
LINE
8
0
10
500.0
20
0.0
11
500.0
21
700.0
0
LINE
8
0
10
500.0
20
700.0
11
0.0
21
700.0
0
LINE
8
0
10
0.0
20
700.0
11
0.0
21
0.0
0
ENDSEC
0
EOF
`;
            const payload = importDxfToWorkpiece(dxf4Lines, 'prosty_prostokat.dxf', { defaultThicknessMm: 18 });
            const wp = payload.workpiece;
            expect(nmToMm(wp.width)).toBe(500);
            expect(nmToMm(wp.height)).toBe(700);
            // 4 linie obrysu zewnętrznego nie powinny zostać zamienione na wpusty
            expect(wp.features).toHaveLength(0);
        });
    });
});
