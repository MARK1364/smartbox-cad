/**
 * Testy jednostkowe math3d.
 *
 * Uruchom: npx vitest run S2_solver
 */

import { describe, it, expect } from 'vitest';
import {
    applyRotationToQuat,
    applyRotationToQuatTo,
    averageQuaternions,
    localToWorldPoint,
    localToWorldPointTo,
    quatDot,
    quatNorm,
    rotateVec3ByQuat,
    rotateVec3ByQuatTo,
    rotationBetweenNormals,
    rotationBetweenNormalsTo,
    rotationsCompatiblePure,
    safeNormalize,
    vec3Add,
    vec3AddTo,
    vec3Dot,
    vec3Len,
    vec3Normalize,
    vec3Scale,
    vec3ScaleTo,
    vec3Sub,
    vec3SubTo,
} from '../core/math3d.js';

describe('Kwaterniony — operacje podstawowe', () => {
    it('normalizacja kwaternionu jednostkowego', () => {
        const n = quatNorm([1, 0, 0, 0]);
        expect(n[0]).toBeCloseTo(1.0);
        expect(n[1]).toBeCloseTo(0.0);
        expect(n[2]).toBeCloseTo(0.0);
        expect(n[3]).toBeCloseTo(0.0);
    });

    it('normalizacja dowolnego kwaternionu', () => {
        const n = quatNorm([2, 0, 0, 0]);
        expect(n[0]).toBeCloseTo(1.0);
        expect(n[1]).toBe(0);
    });

    it('normalizacja zerowego kwaternionu daje identity', () => {
        const n = quatNorm([0, 0, 0, 0]);
        expect(n[0]).toBeCloseTo(1.0);
        expect(n[1]).toBeCloseTo(0.0);
    });

    it('iloczyn skalarny identity z identity = 1', () => {
        expect(quatDot([1, 0, 0, 0], [1, 0, 0, 0])).toBeCloseTo(1.0);
    });

    it('iloczyn skalarny prostopadłych kwaternionów = 0', () => {
        expect(quatDot([1, 0, 0, 0], [0, 1, 0, 0])).toBeCloseTo(0.0);
    });
});

describe('rotationBetweenNormals', () => {
    it('ten sam kierunek daje identity', () => {
        const q = rotationBetweenNormals([1, 0, 0], [1, 0, 0]);
        expect(q[0]).toBeCloseTo(1.0, 5);
        expect(q[1]).toBeCloseTo(0.0, 5);
    });

    it('obrót o 90° wokół Z (X → Y)', () => {
        const q = rotationBetweenNormals([1, 0, 0], [0, 1, 0]);
        expect(q[0]).toBeCloseTo(0.70710678, 5);
        expect(q[3]).toBeCloseTo(0.70710678, 5);
    });

    it('obrót o 180° (X → -X) daje w ≈ 0', () => {
        const q = rotationBetweenNormals([1, 0, 0], [-1, 0, 0]);
        expect(Math.abs(q[0])).toBeCloseTo(0.0, 3);
    });

    it('odchyłka 0,02° nie jest tożsamością — solver ma czym dociągnąć', () => {
        const rad = (0.02 * Math.PI) / 180;
        const q = rotationBetweenNormals([1, 0, 0], [Math.cos(rad), Math.sin(rad), 0]);
        const angle = 2 * Math.acos(Math.min(Math.abs(q[0]), 1));
        expect(angle).toBeGreaterThan(1e-6);
        expect(angle).toBeCloseTo(rad, 5);
    });
});

describe('Operacje na wektorach', () => {
    it('odejmowanie', () => {
        expect(vec3Sub([3, 4, 5], [1, 2, 3])).toEqual([2, 2, 2]);
    });

    it('dodawanie', () => {
        expect(vec3Add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    });

    it('skalowanie', () => {
        expect(vec3Scale([1, 2, 3], 2.0)).toEqual([2, 4, 6]);
    });

    it('iloczyn skalarny', () => {
        expect(vec3Dot([1, 2, 3], [4, 5, 6])).toBe(32);
    });

    it('długość', () => {
        expect(vec3Len([3, 4, 0])).toBeCloseTo(5.0);
    });

    it('normalizacja', () => {
        const n = vec3Normalize([3, 4, 0]);
        expect(n[0]).toBeCloseTo(0.6);
        expect(n[1]).toBeCloseTo(0.8);
        expect(n[2]).toBeCloseTo(0.0);
    });
});

describe('Aplikowanie rotacji', () => {
    it('aplikacja identity nie zmienia rotacji', () => {
        const next = applyRotationToQuat([1, 0, 0, 0], [1, 0, 0, 0]);
        expect(next[0]).toBeCloseTo(1.0);
        expect(next[1]).toBeCloseTo(0.0);
    });

    it('aplikacja rotacji 90° wokół Z', () => {
        const delta = [0.70710678, 0, 0, 0.70710678] as const;
        const next = applyRotationToQuat([1, 0, 0, 0], [...delta]);
        expect(next[0]).toBeCloseTo(delta[0], 5);
        expect(next[3]).toBeCloseTo(delta[3], 5);
    });

    it('rotacja identity nie zmienia wektora', () => {
        const result = rotateVec3ByQuat([1, 2, 3], [1, 0, 0, 0]);
        expect(result[0]).toBeCloseTo(1.0);
        expect(result[1]).toBeCloseTo(2.0);
        expect(result[2]).toBeCloseTo(3.0);
    });
});

describe('Kompatybilność rotacji', () => {
    it('identyczne rotacje są kompatybilne', () => {
        expect(rotationsCompatiblePure([1, 0, 0, 0], [1, 0, 0, 0], 0.01)).toBe(true);
    });

    it('rotacje różniące się o 90° nie są kompatybilne', () => {
        expect(
            rotationsCompatiblePure([1, 0, 0, 0], [0.70710678, 0, 0, 0.70710678], 0.01),
        ).toBe(false);
    });
});

describe('Transformacje przestrzenne', () => {
    it('bez rotacji to sama translacja', () => {
        expect(localToWorldPoint([1, 2, 3], [10, 20, 30], [1, 0, 0, 0])).toEqual([11, 22, 33]);
    });

    it('punkt lokalny (0,0,0) trafia w location', () => {
        expect(localToWorldPoint([0, 0, 0], [5, 10, 15], [1, 0, 0, 0])).toEqual([5, 10, 15]);
    });
});

describe('Funkcje pomocnicze', () => {
    it('safeNormalize dla prawidłowego wektora', () => {
        const result = safeNormalize([3, 4, 0], [0, 0, 1]);
        expect(result[0]).toBeCloseTo(0.6);
        expect(result[1]).toBeCloseTo(0.8);
    });

    it('safeNormalize dla zera zwraca fallback', () => {
        const fallback = [0, 0, 1] as [number, number, number];
        expect(safeNormalize([0, 0, 0], fallback)).toEqual(fallback);
    });

    it('averageQuaternions dla pustej listy daje identity', () => {
        const result = averageQuaternions([]);
        expect(result[0]).toBeCloseTo(1.0);
        expect(result[1]).toBeCloseTo(0.0);
    });

    it('averageQuaternions dla jednego kwaternionu zwraca go bez zmian', () => {
        const result = averageQuaternions([[1, 0, 0, 0]]);
        expect(result[0]).toBeCloseTo(1.0);
    });
});

describe('Zero-Allocation _to operacje in-place', () => {
    it('vec3SubTo, vec3AddTo, vec3ScaleTo modyfikują out bez alokacji', () => {
        const out: [number, number, number] = [0, 0, 0];
        const v1: [number, number, number] = [10, 20, 30];
        const v2: [number, number, number] = [1, 2, 3];

        const rSub = vec3SubTo(v1, v2, out);
        expect(rSub).toBe(out);
        expect(out).toEqual([9, 18, 27]);

        const rAdd = vec3AddTo(out, v2, out);
        expect(rAdd).toBe(out);
        expect(out).toEqual([10, 20, 30]);

        const rScale = vec3ScaleTo(out, 0.5, out);
        expect(rScale).toBe(out);
        expect(out).toEqual([5, 10, 15]);
    });

    it('rotateVec3ByQuatTo i localToWorldPointTo działają in-place', () => {
        const v: [number, number, number] = [1, 0, 0];
        const rot90z: [number, number, number, number] = [0.70710678, 0, 0, 0.70710678];
        const out: [number, number, number] = [0, 0, 0];

        rotateVec3ByQuatTo(v, rot90z, out);
        expect(out[0]).toBeCloseTo(0.0, 4);
        expect(out[1]).toBeCloseTo(1.0, 4);
        expect(out[2]).toBeCloseTo(0.0, 4);

        localToWorldPointTo(v, [10, 20, 30], rot90z, out);
        expect(out[0]).toBeCloseTo(10.0, 4);
        expect(out[1]).toBeCloseTo(21.0, 4);
        expect(out[2]).toBeCloseTo(30.0, 4);
    });

    it('rotationBetweenNormalsTo i applyRotationToQuatTo', () => {
        const outQ: [number, number, number, number] = [0, 0, 0, 0];
        const tmpV0: [number, number, number] = [0, 0, 0];
        const tmpV1: [number, number, number] = [0, 0, 0];

        rotationBetweenNormalsTo([1, 0, 0], [0, 1, 0], outQ, tmpV0, tmpV1);
        expect(outQ[0]).toBeCloseTo(0.70710678, 4);
        expect(outQ[3]).toBeCloseTo(0.70710678, 4);

        const currentRot: [number, number, number, number] = [1, 0, 0, 0];
        applyRotationToQuatTo(currentRot, outQ, currentRot);
        expect(currentRot[0]).toBeCloseTo(0.70710678, 4);
        expect(currentRot[3]).toBeCloseTo(0.70710678, 4);
    });
});

