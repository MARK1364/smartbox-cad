/**
 * Testy podziału kołka/konfirmatu na dwa odcinki (boczek + wieniec).
 *
 * Uruchom: npx vitest run C2_connectors/__tests__/connectors-embedment.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
    getSymbolSegments,
    getFaceHoleDepthMm,
    getFaceHoleDiameterMm,
    getEdgeHoleDiameterMm,
    isParentFaceContact,
    isThroughFaceType,
    resolveEdgeFace,
} from '../connectors-embedment.js';

describe('isParentFaceContact', () => {
    it('normalna CAD +Y (grubość) = boczek / FACE', () => {
        expect(isParentFaceContact([0, 1, 0])).toBe(true);
        expect(isParentFaceContact([0, -1, 0])).toBe(true);
    });

    it('normalna CAD +X lub +Z = czoło wieńca / EDGE', () => {
        expect(isParentFaceContact([1, 0, 0])).toBe(false);
        expect(isParentFaceContact([0, 0, 1])).toBe(false);
    });
});

describe('resolveEdgeFace', () => {
    it('normalna w grubości (Z) → najbliższe czoło FACE_X, nie FACE_Z', () => {
        expect(resolveEdgeFace([0, 0, -1], 280, 0, 600, 720)).toBe('FACE_X_PLUS');
        expect(resolveEdgeFace([0, 0, 1], -280, 0, 600, 720)).toBe('FACE_X_MINUS');
    });

    it('normalna +X zostaje czołem FACE_X', () => {
        expect(resolveEdgeFace([1, 0, 0], 0, 0, 600, 80)).toBe('FACE_X_PLUS');
    });
});

describe('getSymbolSegments', () => {
    it('kołek 8×35: 12 mm w boczku (nieprzelot) + 23 mm w wieńcu', () => {
        const s = getSymbolSegments('kolki_d8x35', 35, 18);
        expect(s.throughFace).toBe(false);
        expect(s.faceMm).toBe(12);
        expect(s.edgeMm).toBe(23);
        expect(s.faceMm + s.edgeMm).toBe(35);
        expect(s.faceDiaMm).toBe(8);
        expect(s.edgeDiaMm).toBe(8);
    });

    it('konfirmat 5×50: 18 mm przelot w boczku + 32 mm w wieńcu', () => {
        const s = getSymbolSegments('konfirmat_5x50', 50, 18);
        expect(s.throughFace).toBe(true);
        expect(s.faceMm).toBe(18);
        expect(s.edgeMm).toBe(32);
        expect(s.faceMm + s.edgeMm).toBe(50);
        expect(s.faceDiaMm).toBe(7);
        expect(s.edgeDiaMm).toBe(5);
    });

    it('konfirmat na płycie 19 mm: przelot = 19, reszta 31', () => {
        const s = getSymbolSegments('konfirmat_5x50', 50, 19);
        expect(s.faceMm).toBe(19);
        expect(s.edgeMm).toBe(31);
    });
});

describe('otwory CNC', () => {
    it('kołek w boczku nie jest przelotowy', () => {
        expect(isThroughFaceType('kolki_d8x35')).toBe(false);
        expect(getFaceHoleDepthMm('kolki_d8x35', 18)).toBe(12);
    });

    it('konfirmat w boczku jest przelotowy (głębokość = grubość)', () => {
        expect(isThroughFaceType('konfirmat_5x50')).toBe(true);
        expect(getFaceHoleDepthMm('konfirmat_5x50', 18)).toBe(18);
        expect(getFaceHoleDepthMm('konfirmat_5x50', 19)).toBe(19);
        expect(getFaceHoleDiameterMm('konfirmat_5x50')).toBe(7);
        expect(getEdgeHoleDiameterMm('konfirmat_5x50')).toBe(5);
    });
});
