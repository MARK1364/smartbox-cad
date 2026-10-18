import { describe, it, expect } from 'vitest';
import { toCsv, fromCsv } from '../prices-csv';

describe('prices-csv', () => {
    it('round-trip zachowuje wszystkie pola', () => {
        const db = {
            prices_hardware: {
                H1: {
                    price: 6,
                    unit: 'szt',
                    name: 'Zawias Clip Top',
                    opis: 'bez hamulca',
                    brand: 'Blum',
                    kategoria: 'Zawiasy',
                    indeks: 'AB-1',
                },
            },
        };
        expect(fromCsv(toCsv(db))).toEqual(db);
    });

    it('escaped przecinki i cudzysłowy', () => {
        const db = {
            prices_materials: {
                M1: { price: 1.5, name: 'Dąb, biały "X"', indeks: '' },
            },
        };
        expect(fromCsv(toCsv(db))).toEqual(db);
    });

    it('auto-wykrywa separator średnik', () => {
        const csv =
            'sekcja;klucz;kategoria;indeks;nazwa;opis;producent;cena;jednostka\n' +
            'prices_services;S1;;;Cięcie;;;15;m2\n';
        const db = fromCsv(csv);
        expect((db.prices_services as any).S1.price).toBe(15);
        expect((db.prices_services as any).S1.name).toBe('Cięcie');
    });

    it('odrzuca CSV bez wymaganych kolumn', () => {
        expect(() => fromCsv('a,b\n1,2\n')).toThrow();
    });
});
