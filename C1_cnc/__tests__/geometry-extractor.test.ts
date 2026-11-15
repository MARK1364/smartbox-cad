/**
 * CNC: otwory czołowe wieńca (kołek ×23, konfirmat ×38) jako cechy CAM.
 *
 * Uruchom: npx vitest run C1_cnc/__tests__/geometry-extractor.test.ts
 */

import { describe, it, expect } from 'vitest';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';
import { CNCEngine } from '../core/cnc-engine.js';

function faceX(sign: 1 | -1, w = 600, h = 720, t = 18) {
    const cx = -w / 2, cy = -h / 2, cz = -t / 2;
    if (sign > 0) {
        return { origin: [cx + w, cy, cz + t], uAxis: [0, 0, -1], vAxis: [0, 1, 0], normal: [1, 0, 0], width: t, height: h };
    }
    return { origin: [cx, cy, cz], uAxis: [0, 0, 1], vAxis: [0, 1, 0], normal: [-1, 0, 0], width: t, height: h };
}

function mockWieniecPanel(features: any[]) {
    return {
        name: 'Wieniec_G',
        width: 600 * 1_000_000,
        height: 720 * 1_000_000,
        thickness: 18 * 1_000_000,
        features,
        getFace: (name: string) => {
            if (name === 'FACE_X_PLUS') return faceX(1);
            if (name === 'FACE_X_MINUS') return faceX(-1);
            return faceX(1);
        },
    };
}

describe('GeometryDataExtractor — otwory czołowe wieńca', () => {
    const extractor = new GeometryDataExtractor();

    it('Wykryj otwory: kołek ø8×23 i konfirmat ø5×38 na FACE_X (czoło)', () => {
        const panel = mockWieniecPanel([
            {
                id: 'e1',
                type: 'hole',
                face: 'FACE_X_PLUS',
                name: 'Otwór kołek',
                params: {
                    u: 9, v: 100, diameter: 8, depth: 23,
                    isConnectorDrilling: true, faceType: 'EDGE', connectorType: 'kolki_d8x35',
                },
            },
            {
                id: 'e2',
                type: 'hole',
                face: 'FACE_X_PLUS',
                name: 'Otwór konfirmat',
                params: {
                    u: 9, v: 164, diameter: 5, depth: 38,
                    isConnectorDrilling: true, faceType: 'EDGE', connectorType: 'konfirmat_5x50',
                },
            },
        ]);

        const res = extractor.extractPanelFeatures(panel, undefined, 'hole');
        expect(res.features.length).toBe(2);

        const dowel = res.features.find((f: any) => f.diameter === 8) as any;
        expect(dowel).toBeDefined();
        expect(dowel.depth).toBe(23);
        expect(dowel.face).toBe('FACE_X_PLUS');
        expect(dowel.through).toBeUndefined();
        expect(dowel.name).toMatch(/kołek/i);

        const conf = res.features.find((f: any) => f.diameter === 5) as any;
        expect(conf).toBeDefined();
        expect(conf.depth).toBe(38);
        expect(conf.face).toBe('FACE_X_PLUS');
        expect(conf.name).toMatch(/konfirmat/i);
        expect(conf.axis.x).toBe(-1);
    });

    it('nie scala otworów z różnych ścian (czoło vs płaszczyzna)', () => {
        const panel = mockWieniecPanel([
            {
                id: 'a', type: 'hole', face: 'FACE_X_PLUS', name: 'Otwór kołek',
                params: { u: 9, v: 100, diameter: 8, depth: 23, faceType: 'EDGE' },
            },
            {
                id: 'b', type: 'hole', face: 'FACE_X_MINUS', name: 'Otwór kołek',
                params: { u: 9, v: 100, diameter: 8, depth: 23, faceType: 'EDGE' },
            },
        ]);
        const res = extractor.extractPanelFeatures(panel, undefined, 'hole');
        expect(res.features.length).toBe(2);
    });

    it('stary otwór EDGE na FACE_Z (oś Z) jest przepinany na czoło FACE_X', () => {
        const panel = mockWieniecPanel([
            {
                id: 'old',
                type: 'hole',
                face: 'FACE_Z_PLUS',
                name: 'Otwór kołek',
                params: {
                    u: 580, v: 100, diameter: 8, depth: 23,
                    isConnectorDrilling: true, faceType: 'EDGE',
                },
            },
        ]);
        const res = extractor.extractPanelFeatures(panel, undefined, 'hole');
        expect(res.features.length).toBe(1);
        const h = res.features[0] as any;
        expect(h.face).toMatch(/^FACE_X_/);
        expect(Math.abs(h.axis.z)).toBeLessThan(0.2);
        expect(Math.abs(h.axis.x)).toBeGreaterThan(0.8);
    });

    it('ekstrahuje pocket jako PocketFeature z 4 narożnikami i zadaną głębokością', () => {
        const panel = {
            name: 'Front_Witryny',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                {
                    id: 'p1',
                    type: 'pocket',
                    name: 'Przetłoczenie 3mm',
                    face: 'FACE_Z_MINUS',
                    params: { u: 60, v: 60, width: 480, length: 600, depth: 3 }
                }
            ],
            getFace: () => ({
                origin: [-300, -360, 9],
                uAxis: [1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, 1],
                width: 600,
                height: 720
            })
        };
        const res = extractor.extractPanelFeatures(panel);
        expect(res.features).toHaveLength(1);
        const feat = res.features[0] as any;
        expect(feat.featureId).toContain('pocket_p1');
        expect(feat.depth).toBe(3);
        expect(feat.width).toBe(480);
        expect(feat.length).toBe(600);
        expect(feat.boundaryPoints).toHaveLength(4);
        expect(feat.startPoint).toBeUndefined(); // to nie jest pojedynczy liniowy rowek!
    });

    it('ekstrahuje cutout jako ContourFeature z zamkniętym obrysem (5 punktów) i pełną głębokością formatki', () => {
        const panel = {
            name: 'Front_Witryny',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                {
                    id: 'c1',
                    type: 'cutout',
                    name: 'Wycięcie na szybę',
                    face: 'FACE_Z_MINUS',
                    params: { u: 60, v: 60, width: 480, length: 600, through: true }
                }
            ],
            getFace: () => ({
                origin: [300, -360, -9],
                uAxis: [-1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, -1],
                width: 600,
                height: 720
            })
        };
        const res = extractor.extractPanelFeatures(panel);
        expect(res.features).toHaveLength(1);
        const feat = res.features[0] as any;
        expect(feat.featureId).toContain('cutout_c1');
        // Docelowy poziom Z cięcia przelotowego z FACE_Z_MINUS (z = -9 do przeciwległej powierzchni z = +9): -9 - (-1) * 18 = +9
        expect(feat.depth).toBe(9);
        expect(feat.isInnerContour).toBe(true);
        expect(feat.points).toHaveLength(5);
        expect(feat.points[0]).toEqual(feat.points[4]); // zamknięta pętla
    });

    it('ekstrahuje pocket z poprawną transformacją boundaryPoints w WCS', () => {
        const panel = {
            name: 'Płyta_Kieszeń',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                {
                    id: 'p1',
                    type: 'pocket',
                    name: 'Kieszeń montażowa',
                    face: 'FACE_Z_PLUS',
                    params: { u: 100, v: 100, width: 200, length: 150, depth: 6 }
                }
            ],
            getFace: () => ({
                origin: [-300, -360, 9],
                uAxis: [1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, 1],
                width: 600,
                height: 720
            })
        };

        const mockWcsManager = {
            updateForPanelDimensions: () => {},
            toWcsCoordinates: (pt: any) => ({ x: pt.x + 50, y: pt.y + 100, z: pt.z }),
            transformVector: (v: any) => ({ ...v }),
            getOrigin: () => ({ x: 0, y: 0, z: 0 })
        };

        const res = extractor.extractPanelFeatures(panel, mockWcsManager as any);
        expect(res.features).toHaveLength(1);
        const feat = res.features[0] as any;
        expect(feat.featureId).toContain('pocket_p1');
        expect(feat.depth).toBe(6);
        expect(feat.width).toBe(200);
        expect(feat.length).toBe(150);

        // panelBoundaryPoints są w układzie formatki (origin: -300, -360, 9)
        // p0 = -300 + 100 = -200, -360 + 100 = -260, 9
        expect(feat.panelBoundaryPoints[0]).toEqual({ x: -200, y: -260, z: 9 });

        // boundaryPoints są przesunięte przez mockWcsManager (+50, +100)
        expect(feat.boundaryPoints[0]).toEqual({ x: -150, y: -160, z: 9 });
    });

    it('ekstrahuje cutout z poprawną transformacją points, depth i normal w WCS', () => {
        const panel = {
            name: 'Front_Witryny',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                {
                    id: 'c_wcs',
                    type: 'cutout',
                    name: 'Wycięcie WCS',
                    face: 'FACE_Z_MINUS',
                    params: { u: 60, v: 60, width: 480, length: 600, through: true }
                }
            ],
            getFace: () => ({
                origin: [300, -360, -9],
                uAxis: [-1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, -1],
                width: 600,
                height: 720
            })
        };

        const mockWcsManager = {
            updateForPanelDimensions: () => {},
            toWcsCoordinates: (pt: any) => ({ x: pt.x + 10, y: pt.y + 20, z: pt.z + 50 }),
            transformVector: (v: any) => ({ x: -v.x, y: -v.y, z: -v.z }),
            getOrigin: () => ({ x: 0, y: 0, z: 0 })
        };

        const res = extractor.extractPanelFeatures(panel, mockWcsManager as any);
        expect(res.features).toHaveLength(1);
        const feat = res.features[0] as any;
        expect(feat.featureId).toContain('cutout_c_wcs');

        // panelDepth w lokalnym układzie formatki: z = -9 - (-1) * 18 = +9
        expect(feat.panelDepth).toBe(9);
        // depth w WCS przetransformowany przez toWcsCoordinates({ x, y, z = 9 }): 9 + 50 = 59
        expect(feat.depth).toBe(59);

        // punkty obrysu przesunięte w WCS (+10, +20, +50)
        expect(feat.panelPoints[0].z).toBe(-9);
        expect(feat.points[0].z).toBe(41); // -9 + 50 = 41

        // normal przetransformowany przez transformVector
        expect(feat.panelNormal).toEqual({ x: 0, y: 0, z: -1 });
        expect(feat.normal).toEqual({ x: -0, y: -0, z: 1 });
    });

    it('ekstrahuje groove jako liniowy GrooveFeature (startPoint i endPoint)', () => {
        const panel = {
            name: 'Bok_Szafki',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                {
                    id: 'g1',
                    type: 'groove',
                    name: 'Nuta pleców',
                    face: 'FACE_Z_PLUS',
                    params: { u: 20, v: 0, width: 4, length: 720, depth: 8 }
                }
            ],
            getFace: () => ({
                origin: [-300, -360, 9],
                uAxis: [1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, 1],
                width: 600,
                height: 720
            })
        };
        const res = extractor.extractPanelFeatures(panel);
        expect(res.features).toHaveLength(1);
        const feat = res.features[0] as any;
        expect(feat.featureId).toContain('groove_g1');
        expect(feat.startPoint).toBeDefined();
        expect(feat.endPoint).toBeDefined();
        expect(feat.boundaryPoints).toBeUndefined();
    });

    it('FAIL-FAST: odrzuca formatkę z wymiarami NaN lub Infinity w ekstraktorze i CNCEngine', () => {
        const nanPanel = {
            id: 'panel_nan',
            name: 'Panel_NaN',
            width: NaN,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: []
        };
        expect(() => extractor.extractPanelFeatures(nanPanel)).toThrow(/nie posiada poprawnych wymiarów fizycznych/);
        expect(() => CNCEngine.getInstance().getDimensionsMM(nanPanel)).toThrow(/nie posiada poprawnych wymiarów fizycznych/);

        const infPanel = {
            id: 'panel_inf',
            name: 'Panel_Inf',
            width: 600 * 1_000_000,
            height: Infinity,
            thickness: 18 * 1_000_000,
            features: []
        };
        expect(() => extractor.extractPanelFeatures(infPanel)).toThrow(/nie posiada poprawnych wymiarów fizycznych/);
        expect(() => CNCEngine.getInstance().getDimensionsMM(infPanel)).toThrow(/nie posiada poprawnych wymiarów fizycznych/);
    });

    it('FAIL-FAST: odrzuca nierozpoznaną ścianę formatki zamiast traktować ją jak górną (-Z)', () => {
        const panelWithBadFace = mockWieniecPanel([
            {
                id: 'bad_face_hole',
                type: 'hole',
                face: 'FACE_NIEZNANA',
                params: { u: 50, v: 50, diameter: 8, depth: 12 }
            }
        ]);
        expect(() => extractor.extractPanelFeatures(panelWithBadFace)).toThrow(/Niekanoniczna nazwa ściany/);

        const panelWithThrowingGetFace = {
            name: 'Panel_Throw',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                {
                    id: 'h_throw',
                    type: 'hole',
                    face: 'FACE_X_PLUS',
                    params: { u: 9, v: 50, diameter: 8, depth: 12 }
                }
            ],
            getFace: () => {
                throw new Error('Błąd pobierania ściany');
            }
        };
        expect(() => extractor.extractPanelFeatures(panelWithThrowingGetFace)).toThrow(/Błąd pobierania ściany/);

        const panelWithNaNFaceOrigin = {
            name: 'Panel_NaN_Origin',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                {
                    id: 'h_nan_origin',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 50, v: 50, diameter: 8, depth: 12 }
                }
            ],
            getFace: () => ({
                origin: [NaN, 0, 9],
                uAxis: [1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, 1],
                width: 600,
                height: 720
            })
        };
        expect(() => extractor.extractPanelFeatures(panelWithNaNFaceOrigin)).toThrow(/poprawnego układu ściany/);

        const panelWithZeroNormal = {
            name: 'Panel_Zero_Normal',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                {
                    id: 'h_zero_normal',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 50, v: 50, diameter: 8, depth: 12 }
                }
            ],
            getFace: () => ({
                origin: [0, 0, 9],
                uAxis: [1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, 0],
                width: 600,
                height: 720
            })
        };
        expect(() => extractor.extractPanelFeatures(panelWithZeroNormal)).toThrow(/poprawnego układu ściany/);
    });

    it('FAIL-FAST: nie maskuje jawnych zer domyślnymi parametrami dla otworu, rowka i kieszeni', () => {
        const makePanel = (feat: any) => mockWieniecPanel([feat]);

        // Otwór: diameter = 0, depth = 0, retractR = 0
        expect(() => extractor.extractPanelFeatures(makePanel({
            id: 'h_zero_dia',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 50, v: 50, diameter: 0, depth: 12 }
        }))).toThrow(/Średnica otworu musi być skończoną liczbą dodatnią/);

        expect(() => extractor.extractPanelFeatures(makePanel({
            id: 'h_zero_depth',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 50, v: 50, diameter: 8, depth: 0 }
        }))).toThrow(/Głębokość wiercenia musi być niezerową skończoną liczbą/);

        expect(() => extractor.extractPanelFeatures(makePanel({
            id: 'h_zero_retract',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 50, v: 50, diameter: 8, depth: 12, retractR: 0 }
        }))).toThrow(/Odskok bezpieczny.*retractR.*musi być skończoną liczbą dodatnią/);

        // Rowek: width = 0, depth = 0
        expect(() => extractor.extractPanelFeatures(makePanel({
            id: 'g_zero_width',
            type: 'groove',
            face: 'FACE_Z_PLUS',
            params: { u: 20, v: 0, width: 0, length: 500, depth: 8 }
        }))).toThrow(/Szerokość wpustu musi być dodatnią liczbą skończoną/);

        expect(() => extractor.extractPanelFeatures(makePanel({
            id: 'g_zero_depth',
            type: 'groove',
            face: 'FACE_Z_PLUS',
            params: { u: 20, v: 0, width: 4, length: 500, depth: 0 }
        }))).toThrow(/Głębokość wpustu nie może być zerowa ani nieskończona/);

        // Kieszeń: depth = 0, width = 0
        expect(() => extractor.extractPanelFeatures(makePanel({
            id: 'p_zero_depth',
            type: 'pocket',
            face: 'FACE_Z_PLUS',
            params: { u: 20, v: 20, width: 100, length: 100, depth: 0 }
        }))).toThrow(/Głębokość kieszeni musi być niezerową skończoną liczbą/);
    });

    it('FAIL-FAST: odrzuca otwór o współrzędnych (u, v) wykraczających poza granice ściany formatki', () => {
        const makePanel = (feat: any) => mockWieniecPanel([feat]); // 800 x 400 x 18 mm

        expect(() => extractor.extractPanelFeatures(makePanel({
            id: 'h_out_of_bounds_u',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 850, v: 100, diameter: 8, depth: 12 }
        }))).toThrow(/wykracza poza granice ściany/);

        expect(() => extractor.extractPanelFeatures(makePanel({
            id: 'h_out_of_bounds_neg',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: -5, v: 100, diameter: 8, depth: 12 }
        }))).toThrow(/wykracza poza granice ściany/);
    });

    it('nie łączy w jedną grupę otworów o różnym toolId lub retractR', () => {
        const panel = {
            name: 'Panel_Group_Test',
            width: 600 * 1_000_000,
            height: 720 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [
                {
                    id: 'h_t1',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 100, v: 100, diameter: 8, depth: 14, retractR: 5, toolId: 'tool_A' }
                },
                {
                    id: 'h_t2',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 200, v: 100, diameter: 8, depth: 14, retractR: 5, toolId: 'tool_B' }
                },
                {
                    id: 'h_r10',
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 300, v: 100, diameter: 8, depth: 14, retractR: 10, toolId: 'tool_A' }
                }
            ],
            getFace: () => ({
                origin: [-300, -360, 9],
                uAxis: [1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, 1],
                width: 600,
                height: 720
            })
        };

        const res = extractor.extractPanelFeatures(panel, undefined, 'hole');
        expect(res.features).toHaveLength(3);
        const byToolB = res.features.find((f: any) => f.toolId === 'tool_B') as any;
        expect(byToolB).toBeDefined();
        expect(byToolB.retractR).toBe(5);
        const byRetract10 = res.features.find((f: any) => f.retractR === 10) as any;
        expect(byRetract10).toBeDefined();
        expect(byRetract10.toolId).toBe('tool_A');
    });

    it('FAIL-FAST: odrzuca głębokość obróbki przekraczającą wymiar materiału (z uwzględnieniem przeboju dla otworów przelotowych)', () => {
        const makeFaceZPanel = (feat: any) => ({
            name: 'Panel_Depth_Limit',
            width: 800 * 1_000_000,
            height: 400 * 1_000_000,
            thickness: 18 * 1_000_000,
            features: [feat],
            getFace: () => ({
                origin: [-400, -200, 9],
                uAxis: [1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, 1],
                width: 800,
                height: 400
            })
        });

        // Otwór nieprzelotowy na FACE_Z_PLUS głębszy niż grubość 18 mm -> błąd
        expect(() => extractor.extractPanelFeatures(makeFaceZPanel({
            id: 'h_too_deep_blind',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 100, v: 100, diameter: 8, depth: 20, through: false }
        }))).toThrow(/wymiar materiału/);

        // Otwór jawnie nieprzelotowy (through: false) o głębokości równej grubości formatki 18 mm -> błąd
        expect(() => extractor.extractPanelFeatures(makeFaceZPanel({
            id: 'h_blind_equal_thickness',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 100, v: 100, diameter: 8, depth: 18, through: false }
        }))).toThrow(/Otwór nieprzelotowy.*wymiar materiału/);

        // Otwór o głębokości 18 mm bez jawnego through=false zostaje automatycznie sklasyfikowany jako przelotowy
        const autoThroughRes = extractor.extractPanelFeatures(makeFaceZPanel({
            id: 'h_auto_through_18',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 100, v: 100, diameter: 8, depth: 18 }
        }));
        expect((autoThroughRes.features[0] as any).through).toBe(true);

        // Otwór przelotowy z przebojem <= 5 mm (np. 20 mm przy płycie 18 mm) -> dozwolony
        const throughRes = extractor.extractPanelFeatures(makeFaceZPanel({
            id: 'h_through_ok',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 100, v: 100, diameter: 8, depth: 20, through: true }
        }));
        expect(throughRes.features).toHaveLength(1);
        expect((throughRes.features[0] as any).through).toBe(true);

        // Otwór przelotowy przekraczający grubość + 5 mm (np. 25 mm przy płycie 18 mm) -> błąd
        expect(() => extractor.extractPanelFeatures(makeFaceZPanel({
            id: 'h_through_too_deep',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 100, v: 100, diameter: 8, depth: 25, through: true }
        }))).toThrow(/przekracza wymiar materiału/);

        // Otwór oznaczony jako przelotowy (through: true), lecz płytszy niż grubość materiału (np. 8 mm przy płycie 18 mm) -> błąd
        expect(() => extractor.extractPanelFeatures(makeFaceZPanel({
            id: 'h_through_too_shallow',
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 100, v: 100, diameter: 8, depth: 8, through: true }
        }))).toThrow(/Otwór przelotowy.*mniejszą niż wymiar materiału/);

        // Kieszeń głębsza niż grubość formatki -> błąd
        expect(() => extractor.extractPanelFeatures(makeFaceZPanel({
            id: 'p_too_deep',
            type: 'pocket',
            face: 'FACE_Z_PLUS',
            params: { u: 50, v: 50, width: 100, length: 100, depth: 22 }
        }))).toThrow(/przekracza wymiar materiału/);

        // Wpust głębszy niż grubość formatki -> błąd
        expect(() => extractor.extractPanelFeatures(makeFaceZPanel({
            id: 'g_too_deep',
            type: 'groove',
            face: 'FACE_Z_PLUS',
            params: { u: 50, v: 0, width: 4, length: 400, depth: 25 }
        }))).toThrow(/przekracza wymiar materiału/);
    });
});
