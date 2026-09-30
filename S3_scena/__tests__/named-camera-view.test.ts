import { describe, expect, it } from 'vitest';
import { namedCameraView, orthoParallaxMm, TOP_BETA, BOTTOM_BETA, WORLD_Y_UP } from '../named-camera-view.js';

describe('named camera view — pionowy rzut z góry', () => {
    it('GÓRA: beta ≈ 0.00001, up = +Y', () => {
        const top = namedCameraView('top');
        expect(top.beta).toBe(TOP_BETA);
        expect(top.up).toEqual(WORLD_Y_UP);
    });

    it('DÓŁ: beta ≈ π', () => {
        expect(namedCameraView('bottom').beta).toBe(BOTTOM_BETA);
    });

    it('beta=0.00001 daje mikroskopijny parallax (< 0.01 mm) na 700 mm', () => {
        const shift = orthoParallaxMm(702, TOP_BETA);
        expect(shift).toBeLessThan(0.01);
        expect(shift).toBeGreaterThan(0.005);
    });
});