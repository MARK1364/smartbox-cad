import { describe, it, expect } from 'vitest';
import { korpusDefaultsForTypeMm } from '../korpus-defaults.js';

describe('korpusDefaultsForTypeMm', () => {
    it('korpus3: osobne defaults z JSON', () => {
        const d = korpusDefaultsForTypeMm('korpus3');
        expect(d.szerokosc_mm).toBe(1000);
        expect(d.wysokosc_mm).toBe(2200);
        expect(d.glebokosc_mm).toBe(600);
        expect(d.liczba_stref).toBe(3);
    });

    it('korpus_rogowy90: nie dziedziczy gabarytu korpus3 (H≠2200)', () => {
        const d = korpusDefaultsForTypeMm('korpus_rogowy90');
        expect(d.szerokosc_mm).toBe(880);
        expect(d.wysokosc_mm).toBe(720);
        expect(d.glebokosc_mm).toBe(880);
        expect(d.liczba_stref).toBe(1);
        expect(d.glebokosc_boku_lewego_mm).toBe(510);
        expect(d.glebokosc_boku_prawego_mm).toBe(510);
    });

    it('korpus_rogowy1: własne defaults z JSON', () => {
        const d = korpusDefaultsForTypeMm('korpus_rogowy1');
        expect(d.szerokosc_mm).toBe(800);
        expect(d.wysokosc_mm).toBe(2200);
        expect(d.glebokosc_mm).toBe(600);
        expect(d.szerokosc_blendy_mm).toBe(400);
        expect(d.strona_blendy).toBe('LEFT');
        expect(d.liczba_stref).toBe(1);
    });
});
