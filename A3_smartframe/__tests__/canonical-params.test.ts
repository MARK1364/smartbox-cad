import { describe, expect, it } from 'vitest';
import {
    assertCanonicalCabinetParams,
    CANONICAL_CABINET_PARAM_KEYS,
    LEGACY_CABINET_PARAM_ALIASES
} from '../smartframe-types.js';
import { normalizeCabinetParams, planCabinet } from '../smartframe-engine.js';

describe('Kontrakt parametrów korpusu — zero kompatybilności wstecznej', () => {
    it('słownik aliasów nie zawiera nazw kanonicznych', () => {
        for (const canonical of CANONICAL_CABINET_PARAM_KEYS) {
            expect(LEGACY_CABINET_PARAM_ALIASES[canonical]).toBeUndefined();
        }
    });

    it('każdy alias wskazuje nazwę kanoniczną, która istnieje w kontrakcie', () => {
        const known = new Set(CANONICAL_CABINET_PARAM_KEYS);
        for (const [alias, canonical] of Object.entries(LEGACY_CABINET_PARAM_ALIASES)) {
            expect(known.has(canonical), `${alias} → ${canonical}`).toBe(true);
        }
    });

    it('strażnik odrzuca wycofane nazwy i podpowiada kanoniczną', () => {
        expect(() => assertCanonicalCabinetParams({ zoneCount: 3 })).toThrow(/zoneCount → liczba_stref/);
        expect(() => assertCanonicalCabinetParams({ bottomHeight: 500 })).toThrow(/bottomHeight → wysokosc_strefy_dolnej_mm/);
        expect(() => assertCanonicalCabinetParams({ bokLewy: 600 })).toThrow(/bokLewy → glebokosc_boku_lewego_mm/);
        expect(() => assertCanonicalCabinetParams({ blindWidth: 400 })).toThrow(/blindWidth → szerokosc_blendy_mm/);
        expect(() => assertCanonicalCabinetParams({ armDepth: 600 })).toThrow(/armDepth → glebokosc_boku_lewego_mm/);
        expect(() => assertCanonicalCabinetParams({ corner_nailer_width: 100 })).toThrow(/corner_nailer_width → szerokosc_listwy_naroznej_mm/);
        expect(() => assertCanonicalCabinetParams({ nailerWidth: 100 })).toThrow(/nailerWidth → szerokosc_listwy_naroznej_mm/);
    });

    it('strażnik przepuszcza kanoniczne wejście i wartości undefined', () => {
        expect(() => assertCanonicalCabinetParams({ liczba_stref: 3, typ_korpusu: 'korpus3' })).not.toThrow();
        // Alias z wartością undefined nie jest błędem — pole po prostu nie występuje.
        expect(() => assertCanonicalCabinetParams({ zoneCount: undefined })).not.toThrow();
        expect(() => assertCanonicalCabinetParams(null)).not.toThrow();
    });

    it('planCabinet propaguje wycofany klucz jako błąd (fail-fast)', () => {
        expect(() => planCabinet({ width: 800, height: 2000, depth: 600 } as any)).toThrow(/width → szerokosc_mm/);
    });

    it('normalize zwraca DTO wyłącznie z kluczami kanonicznymi', () => {
        const norm = normalizeCabinetParams({ szerokosc_mm: 800, wysokosc_mm: 2000, glebokosc_mm: 600, liczba_stref: 3 });
        for (const key of Object.keys(norm)) {
            if (key === 'container') continue; // referencja do sceny, nie pole DTO
            expect(CANONICAL_CABINET_PARAM_KEYS).toContain(key);
        }
        expect(norm.szerokosc_mm).toBe(800);
        expect(norm.liczba_stref).toBe(3);
    });

    it('domyślne wartości są jawne, nie zgadywane z aliasów', () => {
        const norm = normalizeCabinetParams({});
        expect(norm.szerokosc_mm).toBe(600);
        expect(norm.wysokosc_mm).toBe(720);
        expect(norm.glebokosc_mm).toBe(560);
        expect(norm.typ_korpusu).toBe('korpus3');
        expect(norm.strona_blendy).toBe('LEFT');
        expect(norm.tryb_wienca_gornego).toBe('FULL');
    });
});
