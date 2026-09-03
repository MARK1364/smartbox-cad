import { describe, expect, it } from 'vitest';
import { normalizeToCanonicalZoneId, getCanonicalZonePrefix } from '../zone-helper.js';

describe('Zone Helper (Canonical zone identifiers)', () => {
    it('normalizes various input strings to canonical zoneId', () => {
        expect(normalizeToCanonicalZoneId('B')).toBe('SEKCJA_B');
        expect(normalizeToCanonicalZoneId('BOTTOM')).toBe('SEKCJA_B');
        expect(normalizeToCanonicalZoneId('SEKCJA_B')).toBe('SEKCJA_B');
        expect(normalizeToCanonicalZoneId('b_')).toBe('SEKCJA_B');
        expect(normalizeToCanonicalZoneId('')).toBe('SEKCJA_B');
        expect(normalizeToCanonicalZoneId(undefined)).toBe('SEKCJA_B');

        expect(normalizeToCanonicalZoneId('M')).toBe('SEKCJA_M');
        expect(normalizeToCanonicalZoneId('MID')).toBe('SEKCJA_M');
        expect(normalizeToCanonicalZoneId('MIDDLE')).toBe('SEKCJA_M');
        expect(normalizeToCanonicalZoneId('SEKCJA_M')).toBe('SEKCJA_M');
        expect(normalizeToCanonicalZoneId('srodek')).toBe('SEKCJA_M');
        expect(normalizeToCanonicalZoneId('M_')).toBe('SEKCJA_M');

        expect(normalizeToCanonicalZoneId('T')).toBe('SEKCJA_T');
        expect(normalizeToCanonicalZoneId('TOP')).toBe('SEKCJA_T');
        expect(normalizeToCanonicalZoneId('SEKCJA_T')).toBe('SEKCJA_T');
        expect(normalizeToCanonicalZoneId('gora')).toBe('SEKCJA_T');
        expect(normalizeToCanonicalZoneId('pawlacz')).toBe('SEKCJA_T');
        expect(normalizeToCanonicalZoneId('T_')).toBe('SEKCJA_T');
        expect(normalizeToCanonicalZoneId('C')).toBe('SEKCJA_T');
    });

    it('provides correct canonical prefixes', () => {
        expect(getCanonicalZonePrefix('B')).toBe('B_');
        expect(getCanonicalZonePrefix('SEKCJA_B')).toBe('B_');
        expect(getCanonicalZonePrefix('M')).toBe('M_');
        expect(getCanonicalZonePrefix('SEKCJA_M')).toBe('M_');
        expect(getCanonicalZonePrefix('T')).toBe('T_');
        expect(getCanonicalZonePrefix('SEKCJA_T')).toBe('T_');
    });
});
