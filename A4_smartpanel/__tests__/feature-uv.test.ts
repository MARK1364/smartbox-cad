import { describe, it, expect } from 'vitest';
import { hasFeatureParamsUV, readFeatureUV } from '../native_core/feature-uv.js';

describe('readFeatureUV — jeden czytnik u/x', () => {
    it('preferuje kanoniczne u/v nad aliasem x/y', () => {
        expect(readFeatureUV({ u: 10, v: 20, x: 1, y: 2 })).toEqual({ u: 10, v: 20 });
    });

    it('bierze legacy x/y gdy brak u/v', () => {
        expect(readFeatureUV({ x: 15, y: 25 })).toEqual({ u: 15, v: 25 });
    });

    it('widok i mesh: ten sam fallback loc gdy brak params UV', () => {
        expect(readFeatureUV({}, { x: 3, y: 4 })).toEqual({ u: 3, v: 4 });
        expect(readFeatureUV(null, { x: 3, y: 4 })).toEqual({ u: 3, v: 4 });
    });

    it('hasFeatureParamsUV tylko z params (bez loc)', () => {
        expect(hasFeatureParamsUV({ u: 1 })).toBe(true);
        expect(hasFeatureParamsUV({ x: 1 })).toBe(true);
        expect(hasFeatureParamsUV({})).toBe(false);
        expect(hasFeatureParamsUV(null)).toBe(false);
    });
});
