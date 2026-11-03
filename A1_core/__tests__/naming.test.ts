import { describe, it, expect } from 'vitest';
import { deduplicateName } from '../naming.js';

describe('deduplicateName (wzorem Blendera)', () => {
    it('zwraca proponowaną nazwę jeśli nie ma kolizji', () => {
        expect(deduplicateName('Bok lewy', new Set())).toBe('Bok lewy');
        expect(deduplicateName('Półka', new Set(['Inna płyta']))).toBe('Półka');
    });

    it('dopisuje .001 przy pierwszej kolizji', () => {
        expect(deduplicateName('Bok lewy', new Set(['Bok lewy']))).toBe('Bok lewy.001');
    });

    it('inkrementuje istniejący przyrostek numeryczny .001 -> .002', () => {
        const existing = new Set(['Bok lewy', 'Bok lewy.001']);
        expect(deduplicateName('Bok lewy', existing)).toBe('Bok lewy.002');
        expect(deduplicateName('Bok lewy.001', existing)).toBe('Bok lewy.002');
    });

    it('znajduje pierwszą wolną lukę w numeracji', () => {
        const existing = new Set(['Bok', 'Bok.001', 'Bok.003']);
        expect(deduplicateName('Bok', existing)).toBe('Bok.002');
    });

    it('obsługuje pustą nazwę zastępując ją Obiekt', () => {
        expect(deduplicateName('', new Set())).toBe('Obiekt');
        expect(deduplicateName('   ', new Set(['Obiekt']))).toBe('Obiekt.001');
    });
});

