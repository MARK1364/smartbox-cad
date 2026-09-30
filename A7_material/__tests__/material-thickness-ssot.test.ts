import { describe, it, expect } from 'vitest';
import { materialDatabase, resolveCatalogThicknessMm } from '../material-database.js';

describe('A7 resolveCatalogThicknessMm / getMaterialInfo Fail-Fast', () => {
    it('bierze grubość z item.thickness_mm', () => {
        expect(resolveCatalogThicknessMm('CUSTOM', { thickness_mm: 28 }, 18)).toBe(28);
    });

    it('bierze grubość z sufiksu id gdy brak thickness_mm', () => {
        expect(resolveCatalogThicknessMm('W1100_ST9_10', {}, 18)).toBe(10);
    });

    it('bierze grubość z default_thickness_mm grupy gdy brak item i sufiksu', () => {
        expect(resolveCatalogThicknessMm('LACOBEL_CZARNY', {}, 4)).toBe(4);
    });

    it('rzuca błąd gdy brak jakiegokolwiek źródła grubości', () => {
        expect(() => resolveCatalogThicknessMm('NO_THICKNESS_AT_ALL', {}, undefined))
            .toThrow(/nie ma poprawnej grubości/);
        expect(() => resolveCatalogThicknessMm('BAD', { thickness_mm: 0 }, 0))
            .toThrow(/nie ma poprawnej grubości/);
    });

    it('getMaterialInfo bez sufiksu i bez fallbackThickness zwraca thickness_mm = 0 (nie 18)', () => {
        const info = materialDatabase.getMaterialInfo('NiestandardowyBezGrubosci');
        expect(info.thickness_mm).toBe(0);
    });

    it('getMaterialInfo po nazwie dekoru bez grubości nie dziedziczy 18 z katalogu', () => {
        const info = materialDatabase.getMaterialInfo('Biały Alpejski');
        expect(info.thickness_mm).toBe(0);
        expect(info.code).toBe('W1100 ST9');
    });

    it('getMaterialInfo z jawną grubością ustawia thickness_mm', () => {
        const info = materialDatabase.getMaterialInfo('Biały Alpejski', 16);
        expect(info.thickness_mm).toBe(16);
    });

    it('getMaterialById zachowuje grubość z katalogu (W1100_ST9_18 → 18)', () => {
        expect(materialDatabase.getMaterialById('W1100_ST9_18')?.thickness_mm).toBe(18);
        expect(materialDatabase.getMaterialById('HDF_BIALY_3')?.thickness_mm).toBe(3);
        expect(materialDatabase.getMaterialById('LACOBEL_CZARNY')?.thickness_mm).toBe(4);
    });
});
