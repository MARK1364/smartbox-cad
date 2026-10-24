/**
 * CNC: otwory czołowe wieńca (kołek ×23, konfirmat ×38) jako cechy CAM.
 *
 * Uruchom: npx vitest run C1_cnc/__tests__/geometry-extractor.test.ts
 */

import { describe, it, expect } from 'vitest';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';

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
});
