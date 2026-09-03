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
});
