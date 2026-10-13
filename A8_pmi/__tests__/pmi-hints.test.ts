import { describe, it, expect, beforeEach } from 'vitest';
import pmiTekst from '../pmi_tekst.json';
import { tx, setLocale } from '../../T1_tlumaczenia/core';

describe('PMI Hints i Tooltips (zgodność z Blender addon)', () => {
    beforeEach(() => { setLocale('pl'); });
    it('klucze kroków wymiarowania i pomiaru istnieją i są przetłumaczone na pl, en, de', () => {
        const expectedKeys = [
            'hints.step1_title',
            'hints.step1_desc',
            'hints.step2_title',
            'hints.step2_desc',
            'hints.step2_ctrl_desc',
            'hints.measure_step1_title',
            'hints.measure_step1_desc',
            'hints.measure_step2_title',
            'hints.measure_step2_desc',
        ];

        for (const key of expectedKeys) {
            expect(pmiTekst, `Brak klucza ${key} w pmi_tekst.json`).toHaveProperty(key);
            const entry = (pmiTekst as any)[key];
            expect(entry.pl).toBeDefined();
            expect(entry.en).toBeDefined();
            expect(entry.de).toBeDefined();
        }
    });

    it('tytuły kroków odpowiadają układowi dwuetapowemu KROK 1 i KROK 2 (bez frazy "Wymiarowanie CAD")', () => {
        expect(tx(pmiTekst, 'hints.step1_title', 'pmi')).toBe('KROK 1');
        expect(tx(pmiTekst, 'hints.step1_desc', 'pmi')).toContain('Kliknij jeden element lub wybierz dwa z CTRL');
        expect(tx(pmiTekst, 'hints.step2_title', 'pmi')).toBe('KROK 2');
        expect(tx(pmiTekst, 'hints.step2_desc', 'pmi')).toContain('Przeciągnij wymiar w danym kierunku XYZ');
        expect(tx(pmiTekst, 'hints.measure_step1_title', 'pmi')).toBe('KROK 1');
        expect(tx(pmiTekst, 'hints.measure_step2_title', 'pmi')).toBe('KROK 2');

        const allPmiStrings = JSON.stringify(pmiTekst);
        expect(allPmiStrings.includes('Wymiarowanie CAD')).toBe(false);
    });

    it('opis KROK 2 zawiera wariant z wciśniętym klawiszem CTRL zgodny z Blenderem', () => {
        const ctrlDescPl = tx(pmiTekst, 'hints.step2_ctrl_desc', 'pmi');
        expect(ctrlDescPl).toContain('TRZYMASZ CTRL');
        expect(ctrlDescPl).toContain('Precyzyjny wybór');
    });

    it('tytuł menu PPM wymiarowania jest przetłumaczony na pl, en, de', () => {
        const entry = (pmiTekst as any)['menu.title'];
        expect(entry.pl.length).toBeGreaterThan(0);
        expect(entry.en.length).toBeGreaterThan(0);
        expect(entry.de.length).toBeGreaterThan(0);
        expect(tx(pmiTekst, 'menu.title', 'pmi')).toBe('Kierunek linii wymiarowej');
    });
});
