import { describe, it, expect } from 'vitest';
import {
    getBlokiRefFacePlacement,
    BLOKI_REF_SIDE_LABELS,
} from '../bloki-ref-plane-hint.js';

describe('Bloki ref plane hint geometry', () => {
    const W = 800;
    const H = 600;
    const D = 400;

    it('maps all six side keys to human labels', () => {
        expect(BLOKI_REF_SIDE_LABELS.xMin).toBe('Bok Lewy');
        expect(BLOKI_REF_SIDE_LABELS.xMax).toBe('Bok Prawy');
        expect(BLOKI_REF_SIDE_LABELS.yMin).toBe('Przód');
        expect(BLOKI_REF_SIDE_LABELS.yMax).toBe('Tył');
        expect(BLOKI_REF_SIDE_LABELS.zMin).toBe('Dół');
        expect(BLOKI_REF_SIDE_LABELS.zMax).toBe('Góra');
    });

    it('places left/right faces on X extremes with depth×height planes', () => {
        const left = getBlokiRefFacePlacement('xMin', W, H, D);
        expect(left.lx).toBe(-W / 2);
        expect(left.planeW).toBe(D);
        expect(left.planeH).toBe(H);
        expect(left.ry).toBeCloseTo(-Math.PI / 2);

        const right = getBlokiRefFacePlacement('xMax', W, H, D);
        expect(right.lx).toBe(W / 2);
        expect(right.ry).toBeCloseTo(Math.PI / 2);
    });

    it('places front/back faces on Z extremes with width×height planes', () => {
        const front = getBlokiRefFacePlacement('yMin', W, H, D);
        expect(front.lz).toBe(-D / 2);
        expect(front.planeW).toBe(W);
        expect(front.planeH).toBe(H);
        expect(front.ry).toBeCloseTo(Math.PI);

        const back = getBlokiRefFacePlacement('yMax', W, H, D);
        expect(back.lz).toBe(D / 2);
        expect(back.ry).toBeCloseTo(0);
    });

    it('places bottom/top faces on Y extremes with width×depth planes', () => {
        const bottom = getBlokiRefFacePlacement('zMin', W, H, D);
        expect(bottom.ly).toBe(0);
        expect(bottom.planeW).toBe(W);
        expect(bottom.planeH).toBe(D);
        expect(bottom.rx).toBeCloseTo(-Math.PI / 2);

        const top = getBlokiRefFacePlacement('zMax', W, H, D);
        expect(top.ly).toBe(H);
        expect(top.rx).toBeCloseTo(Math.PI / 2);
    });
});
