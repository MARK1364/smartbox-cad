import { describe, it, expect } from 'vitest';
import {
    PRICE_SECTIONS,
    serializePriceDatabase,
    validatePriceDatabase,
} from '../prices-validate';
import prices from '../prices.json';

describe('validatePriceDatabase', () => {
    it('przyjmuje poprawny cennik produkcyjny', () => {
        expect(() => validatePriceDatabase(prices)).not.toThrow();
    });

    it('przyjmuje wpis jako liczbę oraz jako obiekt { price, unit, name }', () => {
        const db = {
            prices_materials: { A: 12.5, B: { price: 3, unit: 'm2', name: 'Płyta B' } },
        };
        expect(() => validatePriceDatabase(db)).not.toThrow();
    });

    it('odrzuca wartość niebędącą obiektem', () => {
        expect(() => validatePriceDatabase(null)).toThrow();
        expect(() => validatePriceDatabase([1, 2])).toThrow();
        expect(() => validatePriceDatabase('cennik')).toThrow();
    });

    it('odrzuca brak jakiejkolwiek znanej sekcji', () => {
        expect(() => validatePriceDatabase({ foo: {} })).toThrow(/sekcj/i);
    });

    it('odrzuca ujemną cenę', () => {
        expect(() => validatePriceDatabase({ prices_hardware: { X: -1 } })).toThrow();
        expect(() =>
            validatePriceDatabase({ prices_hardware: { X: { price: -0.5 } } })
        ).toThrow(/price/i);
    });

    it('odrzuca wpis-obiekt bez pola price', () => {
        expect(() => validatePriceDatabase({ prices_hardware: { X: { unit: 'szt' } } })).toThrow(
            /price/i
        );
    });

    it('odrzuca nie-tekstowe unit/name', () => {
        expect(() =>
            validatePriceDatabase({ prices_hardware: { X: { price: 1, unit: 5 } } })
        ).toThrow(/unit/i);
        expect(() =>
            validatePriceDatabase({ prices_hardware: { X: { price: 1, name: 5 } } })
        ).toThrow(/name/i);
    });

    it('eksportuje trzy sekcje cennika', () => {
        expect(PRICE_SECTIONS).toEqual(['prices_materials', 'prices_services', 'prices_hardware']);
    });
});

describe('serializePriceDatabase', () => {
    it('formatuje z wcięciem 4 spacji i końcowym newline', () => {
        const out = serializePriceDatabase({ prices_materials: { A: 1 } });
        expect(out.endsWith('\n')).toBe(true);
        expect(out).toContain('\n    "prices_materials"');
    });
});
