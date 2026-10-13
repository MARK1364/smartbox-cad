import { describe, expect, it } from 'vitest';
import {
    clampWorldDiameter,
    pixelsPerMM,
    worldSizeForPx,
} from '../pmi-screen-scale';

describe('pmi-screen-scale (stałe px jak pro CAD)', () => {
    it('ortho: pxPerMM = renderH / orthoH', () => {
        expect(pixelsPerMM({ renderH: 900, cameraMode: 1, orthoH: 1800 })).toBeCloseTo(0.5, 6);
    });

    it('perspektywa: dalej = mniej px na mm', () => {
        const near = pixelsPerMM({ renderH: 900, cameraMode: 0, orthoH: 0, distanceToCamera: 300, cameraFov: 0.8 });
        const far = pixelsPerMM({ renderH: 900, cameraMode: 0, orthoH: 0, distanceToCamera: 3000, cameraFov: 0.8 });
        expect(near).toBeGreaterThan(0);
        expect(far).toBeGreaterThan(0);
        expect(near / far).toBeCloseTo(10, 1);
    });

    it('worldSizeForPx daje stałe px: daleko grubszy świat, blisko cieńszy', () => {
        const farMM = worldSizeForPx(4, 0.36, 2.4);
        const nearMM = worldSizeForPx(4, 3.55, 2.4);
        expect(farMM).toBeCloseTo(11.1, 1);
        expect(nearMM).toBeCloseTo(1.13, 2);
        // Rzeczywiste px po przemnożeniu wracają do 4
        expect(farMM * 0.36).toBeCloseTo(4, 6);
        expect(nearMM * 3.55).toBeCloseTo(4, 6);
    });

    it('worldSizeForPx zwraca fallback przy zepsutej kamerze', () => {
        expect(worldSizeForPx(4, 0, 2.4)).toBe(2.4);
        expect(worldSizeForPx(4, NaN, 2.4)).toBe(2.4);
    });

    it('clampWorldDiameter: daleko podbija do minPx, blisko obcina do maxPx', () => {
        // Daleko (0.36 px/mm): 2mm to 0.7px -> podbij do 2.5px = 6.9mm
        expect(clampWorldDiameter(2.0, 0.36, 2.5, 7)).toBeCloseTo(2.5 / 0.36, 6);
        // Blisko (5 px/mm): 2mm to 10px -> obetnij do 7px = 1.4mm
        expect(clampWorldDiameter(2.0, 5, 2.5, 7)).toBeCloseTo(7 / 5, 6);
        // Środek: suwak bez zmian
        expect(clampWorldDiameter(2.0, 2, 2.5, 7)).toBeCloseTo(2.0, 6);
    });

    it('clampWorldDiameter zwraca suwak przy braku kamery', () => {
        expect(clampWorldDiameter(2.0, 0, 2.5, 7)).toBe(2.0);
    });
});
