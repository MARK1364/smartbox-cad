import { describe, it, expect } from 'vitest';
import { normalizeShelvesParams } from '../shelves-engine.js';
import { normalizeDoorsParams } from '../doors-engine.js';
import { normalizeDrawersParams } from '../drawers-engine.js';
import { normalizeFlapsParams } from '../flaps-engine.js';
import { normalizePanelsParams } from '../panels-engine.js';
import { normalizeShelfParams } from '../shelf-engine.js';
import { normalizeTubesParams } from '../tubes-engine.js';
import { resolveRuleThicknessMm } from '../bloki-rules-helper.js';

describe('A2_bloki SSOT & Fail-Fast Thickness', () => {
    const dummyDims = { width_mm: 600, height_mm: 720, depth_mm: 560 };

    it('półki: pobierają grubość z reguł lub respektują nadpisany parametr', () => {
        const def = normalizeShelvesParams({}, dummyDims);
        expect(def.grubosc_polki_mm).toBe(18);

        const custom = normalizeShelvesParams({ grubosc_polki_mm: 22 }, dummyDims);
        expect(custom.grubosc_polki_mm).toBe(22);
    });

    it('drzwi: pobierają grubość frontu z reguł lub respektują nadpisany parametr', () => {
        const def = normalizeDoorsParams({}, dummyDims);
        expect(def.grubosc_frontu_mm).toBe(18);

        const custom = normalizeDoorsParams({ grubosc_frontu_mm: 19 }, dummyDims);
        expect(custom.grubosc_frontu_mm).toBe(19);
    });

    it('szuflady: pobierają grubość frontu i dystansów z reguł lub respektują nadpisanie', () => {
        const def = normalizeDrawersParams({ dystans_lewy_mm: 18, dystans_prawy_mm: 18 }, dummyDims);
        expect(def.grubosc_frontu_mm).toBe(18);
        expect(def.dystans_lewy_mm).toBe(18);
        expect(def.dystans_prawy_mm).toBe(18);

        const custom = normalizeDrawersParams({
            grubosc_frontu_mm: 16,
            dystans_lewy_mm: 25
        }, dummyDims);
        expect(custom.grubosc_frontu_mm).toBe(16);
        expect(custom.dystans_lewy_mm).toBe(25);
    });

    it('klapy: pobierają grubość klapy z reguł lub respektują nadpisanie', () => {
        const def = normalizeFlapsParams({}, dummyDims);
        expect(def.grubosc_frontu_mm).toBe(18);

        const custom = normalizeFlapsParams({ grubosc_frontu_mm: 22 }, dummyDims);
        expect(custom.grubosc_frontu_mm).toBe(22);
    });

    it('blendy: pobierają grubość blendy z reguł lub respektują nadpisanie', () => {
        const def = normalizePanelsParams({}, dummyDims);
        expect(def.grubosc_blendy_mm).toBe(18);

        const custom = normalizePanelsParams({ grubosc_blendy_mm: 19 }, dummyDims);
        expect(custom.grubosc_blendy_mm).toBe(19);
    });

    it('wieniec i drążek: pobierają grubość płyty z reguł lub respektują nadpisanie', () => {
        const shelf = normalizeShelfParams({}, dummyDims);
        expect(shelf.grubosc_wienca_mm).toBe(18);

        const tubes = normalizeTubesParams({}, dummyDims);
        expect(tubes.grubosc_polki_mm).toBe(18);
    });

    it('fail-fast: resolveRuleThicknessMm rzuca błąd w przypadku braku definicji w regułach', () => {
        expect(() => {
            resolveRuleThicknessMm({}, ['NIEZNANY_ELEMENT'], 'thickness', 'test_module');
        }).toThrow(/Brak zdefiniowanej grubości/);

        expect(() => {
            resolveRuleThicknessMm(null as any, [], 'thickness', 'test_module');
        }).toThrow(/Brak reguł JSON/);
    });
});
