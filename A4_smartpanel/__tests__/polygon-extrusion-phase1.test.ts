import { describe, it, expect } from 'vitest';
import {
    classifyOutlineSegmentEdge,
    ensureCCW,
    computePolygonSignedArea,
    profileUVToLCS,
    buildPolygonPanelTopology,
    BrepEdgeData
} from '../native_core/polygon-extrusion';
import { buildMeshFromPanel } from '../native_core/mesh_builder';
import { mmToNm } from '../../A1_core/cad-math/units';

describe('Faza 1: polygon-extrusion kontrakt UV↔LCS, units nm i klasyfikacja segmentów', () => {

    describe('1. Klasyfikacja segmentów (Wektor + Położenie + Provenance)', () => {
        const plateW = 800;
        const plateD = 600;

        it('klasyfikuje krawędzie nominalne formatki na bazie wektora n i pozycji', () => {
            // Dolna krawędź (-Y): (0, 0) -> (W, 0), normalna skierowana w dół (ny = -1)
            expect(classifyOutlineSegmentEdge(0, 0, plateW, 0, plateW, plateD, 'NOMINAL')).toBe('-Y');

            // Prawa krawędź (+X): (W, 0) -> (W, D), normalna skierowana w prawo (nx = +1)
            expect(classifyOutlineSegmentEdge(plateW, 0, plateW, plateD, plateW, plateD, 'NOMINAL')).toBe('+X');

            // Górna krawędź (+Y): (W, D) -> (0, D), normalna skierowana w górę (ny = +1)
            expect(classifyOutlineSegmentEdge(plateW, plateD, 0, plateD, plateW, plateD, 'NOMINAL')).toBe('+Y');

            // Lewa krawędź (-X): (0, D) -> (0, 0), normalna skierowana w lewo (nx = -1)
            expect(classifyOutlineSegmentEdge(0, plateD, 0, 0, plateW, plateD, 'NOMINAL')).toBe('-X');
        });

        it('klasyfikuje segmenty wewnętrznego wcięcia L jako NOTCH', () => {
            // Wcięcie L: segment wewnętrzny równoległy do X na v=400 (nie na brzegu 0 ani 600)
            expect(classifyOutlineSegmentEdge(800, 400, 500, 400, plateW, plateD, 'NOMINAL')).toBe('NOTCH');

            // Wcięcie L: segment wewnętrzny równoległy do Y na u=500 (nie na brzegu 0 ani 800)
            expect(classifyOutlineSegmentEdge(500, 400, 500, 600, plateW, plateD, 'NOMINAL')).toBe('NOTCH');
        });

        it('segment o pochodzeniu CUTOUT na nominalnym brzegu formatki klasyfikowany jest jako NOTCH (brak obrzeża)', () => {
            // Segment leżący na granicy -Y, ale pochodzący z wycięcia/rewizji
            expect(classifyOutlineSegmentEdge(0, 0, plateW, 0, plateW, plateD, 'CUTOUT')).toBe('NOTCH');
        });

        it('segmenty skośne (pod kątem) klasyfikowane są jako NOTCH', () => {
            // Skos dachu / trapezu od (0, 200) do (plateW, plateD)
            expect(classifyOutlineSegmentEdge(0, 200, plateW, plateD, plateW, plateD, 'NOMINAL')).toBe('NOTCH');
        });
    });

    describe('2. Normalizacja orientacji CCW (ensureCCW)', () => {
        it('pozostawia kontur zorientowany CCW bez zmian', () => {
            const ccw = [[0, 0], [800, 0], [800, 600], [0, 600]];
            expect(computePolygonSignedArea(ccw)).toBeGreaterThan(0);
            const normalized = ensureCCW(ccw);
            expect(normalized).toEqual(ccw);
        });

        it('odwraca kontur zdefiniowany w kierunku CW do CCW', () => {
            const cw = [[0, 0], [0, 600], [800, 600], [800, 0]];
            expect(computePolygonSignedArea(cw)).toBeLessThan(0);
            const normalized = ensureCCW(cw);
            expect(computePolygonSignedArea(normalized)).toBeGreaterThan(0);
            expect(normalized[0]).toEqual([800, 0]);
            expect(normalized[1]).toEqual([800, 600]);
        });
    });

    describe('3. Adapter UV ↔ LCS 3D (profileUVToLCS)', () => {
        const W = 800;
        const H = 600;
        const T = 18;

        it('mapuje (0, 0) na FACE_Z_PLUS na lewy-dolny narożnik w Z=+T/2', () => {
            const ptLCS = profileUVToLCS(0, 0, 'PLUS', 0, W, H, T);
            // X = 0 - W/2 = -400, Y = 0 - H/2 = -300, Z = +T/2 = +9
            expect(ptLCS).toEqual([-400, -300, 9]);
        });

        it('mapuje (W, H) na FACE_Z_PLUS na prawy-górny narożnik w Z=+T/2', () => {
            const ptLCS = profileUVToLCS(W, H, 'PLUS', 0, W, H, T);
            expect(ptLCS).toEqual([400, 300, 9]);
        });

        it('mapuje punkt na FACE_Z_MINUS z identycznymi (X, Y) w LCS oraz Z=-T/2', () => {
            const ptTop = profileUVToLCS(250, 150, 'PLUS', 0, W, H, T);
            const ptBottom = profileUVToLCS(250, 150, 'MINUS', 0, W, H, T);
            expect(ptTop[0]).toBe(ptBottom[0]);
            expect(ptTop[1]).toBe(ptBottom[1]);
            expect(ptTop[2]).toBe(9);
            expect(ptBottom[2]).toBe(-9);
        });

        it('uwzględnia zagłębienie depthOffset w głąb materiału dla obu lic', () => {
            const depth = 5;
            const ptTop = profileUVToLCS(0, 0, 'PLUS', depth, W, H, T);
            const ptBottom = profileUVToLCS(0, 0, 'MINUS', depth, W, H, T);
            // Na licu Z+, depthOffset idzie wzdłuż wektora -Z (9 - 5 = 4)
            expect(ptTop[2]).toBe(4);
            // Na licu Z-, depthOffset idzie wzdłuż wektora +Z (-9 + 5 = -4)
            expect(ptBottom[2]).toBe(-4);
        });
    });

    describe('4. Obsługa jednostek domenowych outline2d_nm (SSOT)', () => {
        it('buduje siatkę z profilu przekazanego bezpośrednio jako outline2d_nm w nanometrach', () => {
            const W_mm = 600;
            const H_mm = 400;
            const T_mm = 18;

            const outline2d_nm: Array<[number, number]> = [
                [mmToNm(0), mmToNm(0)],
                [mmToNm(W_mm), mmToNm(0)],
                [mmToNm(W_mm), mmToNm(H_mm)],
                [mmToNm(0), mmToNm(H_mm)]
            ];

            const topo = buildPolygonPanelTopology({
                outline2d_nm,
                plateW: W_mm,
                plateD: H_mm,
                thickness: T_mm
            });

            expect(topo.FACE_Z_PLUS).toBeDefined();
            expect(topo.FACE_Z_MINUS).toBeDefined();
            expect(topo.OUTLINE_SIDE_0).toBeDefined();
            expect(topo.edges.length).toBeGreaterThanOrEqual(12);
        });

        it('buildMeshFromPanel przetwarza custom_properties.outline2d_nm w nm', () => {
            const W_mm = 882;
            const H_mm = 882;
            const T_mm = 18;

            const outline2d_nm: Array<[number, number]> = [
                [mmToNm(0), mmToNm(0)],
                [mmToNm(882), mmToNm(0)],
                [mmToNm(882), mmToNm(600)],
                [mmToNm(600), mmToNm(600)],
                [mmToNm(600), mmToNm(882)],
                [mmToNm(0), mmToNm(882)]
            ];

            const mesh = buildMeshFromPanel({
                role: 'BOTTOM_PANEL',
                width: mmToNm(W_mm),
                height: mmToNm(H_mm),
                thickness: mmToNm(T_mm),
                custom_properties: { outline2d_nm, shape: 'L_NOTCH' }
            });

            const sides = Object.keys(mesh).filter((k) => k.startsWith('OUTLINE_SIDE_'));
            expect(sides.length).toBe(6);
            expect(mesh.OUTLINE_SIDE_0.edgeKey).toBe('-Y');
            expect(mesh.OUTLINE_SIDE_1.edgeKey).toBe('+X');
            expect(mesh.OUTLINE_SIDE_2.edgeKey).toBe('NOTCH');
            expect(mesh.OUTLINE_SIDE_3.edgeKey).toBe('NOTCH');
            expect(mesh.OUTLINE_SIDE_4.edgeKey).toBe('+Y');
            expect(mesh.OUTLINE_SIDE_5.edgeKey).toBe('-X');
        });
    });

    describe('5. Stabilne aliasy 12 nominalnych krawędzi prostopadłościanu B-rep', () => {
        it('generuje aliasy dol_przod, dol_tyl, gora_przod, etc. dla prostokąta N=4', () => {
            const W = 600;
            const H = 400;
            const T = 18;
            const outline2d = [[0, 0], [W, 0], [W, H], [0, H]];

            const topo = buildPolygonPanelTopology({
                outline2d,
                plateW: W,
                plateD: H,
                thickness: T
            });

            const edges = topo.edges as BrepEdgeData[];
            const aliasMap = new Map<string, BrepEdgeData>();
            for (const e of edges) {
                if (e.alias) {
                    aliasMap.set(e.alias, e);
                }
            }

            // Krawędzie poziome lica roboczego (Z+)
            expect(aliasMap.has('dol_przod')).toBe(true);
            expect(aliasMap.get('dol_przod')?.faces).toEqual(['FACE_Z_PLUS', 'OUTLINE_SIDE_0']);
            expect(aliasMap.has('przod_prawo')).toBe(true);
            expect(aliasMap.has('gora_przod')).toBe(true);
            expect(aliasMap.has('przod_lewo')).toBe(true);

            // Krawędzie poziome lica tylnego (Z-)
            expect(aliasMap.has('dol_tyl')).toBe(true);
            expect(aliasMap.get('dol_tyl')?.faces).toEqual(['FACE_Z_MINUS', 'OUTLINE_SIDE_0']);
            expect(aliasMap.has('tyl_prawo')).toBe(true);
            expect(aliasMap.has('gora_tyl')).toBe(true);
            expect(aliasMap.has('tyl_lewo')).toBe(true);

            // 4 krawędzie pionowe narożników formatki
            expect(aliasMap.has('dol_lewo')).toBe(true);
            expect(aliasMap.has('dol_prawo')).toBe(true);
            expect(aliasMap.has('gora_prawo')).toBe(true);
            expect(aliasMap.has('gora_lewo')).toBe(true);

            // Łącznie 12 unikalnych aliasów nominalnych
            expect(aliasMap.size).toBe(12);
        });
    });
});
