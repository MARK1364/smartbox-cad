import { describe, it, expect } from 'vitest';
import {
    hingeAlignHandedness,
    hingeArmDir,
    resolveHingeAlignAxes
} from '../hinge-align.js';

/** FACE_Z_PLUS — u=X, v=Y, n=Z */
const U: [number, number, number] = [1, 0, 0];
const V: [number, number, number] = [0, 1, 0];
const N: [number, number, number] = [0, 0, 1];

describe('resolveHingeAlignAxes', () => {
    it('keeps right-handed basis for door left/right and flap top/bottom', () => {
        for (const ori of ['left', 'right', 'top', 'bottom'] as const) {
            const axes = resolveHingeAlignAxes(U, V, N, ori);
            expect(hingeAlignHandedness(axes)).toBeCloseTo(1, 6);
        }
    });

    it('points flap arm toward top/bottom wreath edge (along ±v)', () => {
        const topArm = hingeArmDir(resolveHingeAlignAxes(U, V, N, 'top'));
        const bottomArm = hingeArmDir(resolveHingeAlignAxes(U, V, N, 'bottom'));
        expect(topArm[0]).toBeCloseTo(0);
        expect(topArm[1]).toBeCloseTo(1);
        expect(topArm[2]).toBeCloseTo(0);
        expect(bottomArm[0]).toBeCloseTo(0);
        expect(bottomArm[1]).toBeCloseTo(-1);
        expect(bottomArm[2]).toBeCloseTo(0);
    });

    it('points door arm toward left/right side edge (along ±u)', () => {
        const leftArm = hingeArmDir(resolveHingeAlignAxes(U, V, N, 'left'));
        const rightArm = hingeArmDir(resolveHingeAlignAxes(U, V, N, 'right'));
        expect(leftArm[0]).toBeCloseTo(-1);
        expect(leftArm[1]).toBeCloseTo(0);
        expect(leftArm[2]).toBeCloseTo(0);
        expect(rightArm[0]).toBeCloseTo(1);
        expect(rightArm[1]).toBeCloseTo(0);
        expect(rightArm[2]).toBeCloseTo(0);
    });
});
