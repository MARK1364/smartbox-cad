import { describe, it, expect } from 'vitest';
import {
    resolveCabinetPartThickness,
    requireCabinetPartThickness,
    resolveCarcassBoardThicknessFromRules
} from '../geometry/cabinet-thickness.js';
import korpus3Rules from '../korpus3_3_rules.json';
import korpusSkosnyRules from '../korpus_skosny_rules.json';

describe('cabinet-thickness (SSOT & Fail-Fast)', () => {
    it('poprawnie pobiera grubość z reguł dla standardowego korpusu (boki 18 mm, plecy 3 mm)', () => {
        const ctx = { rules: korpus3Rules };
        const bokTh = requireCabinetPartThickness('BOK_L', 'B_', ctx);
        const plecyTh = requireCabinetPartThickness('PLECY', 'B_', ctx);

        expect(bokTh).toBe(18);
        expect(plecyTh).toBe(3);
    });

    it('poprawnie pobiera grubość pleców 18 mm dla korpusu skośnego z reguł (brak sztywnego 3 mm)', () => {
        const ctx = { rules: korpusSkosnyRules };
        const plecyTh = requireCabinetPartThickness('PLECY', 'B_', ctx);

        expect(plecyTh).toBe(18);
    });

    it('priorytetyzuje jawne nadpisania (thicknessOverrides)', () => {
        const ctx = {
            rules: korpus3Rules,
            thicknessOverrides: {
                BOK_L: 19,
                PLECY: 4
            }
        };

        expect(requireCabinetPartThickness('BOK_L', 'B_', ctx)).toBe(19);
        expect(requireCabinetPartThickness('PLECY', 'B_', ctx)).toBe(4);
    });

    it('fail-fast: rzuca błąd, gdy brak danych w regułach i brak nadpisań (zero cichych podmian 18 mm / 3 mm)', () => {
        const emptyCtx = { rules: {} };

        // Dla nieistniejącego elementu w pustym kontekście CAD musi rzucić błąd, a nie zgadywać 18 mm
        expect(() => {
            requireCabinetPartThickness('NIEZNANY_ELEMENT', '', emptyCtx);
        }).toThrow(/Brak zdefiniowanej grubości/);

        // Dla pleców w pustym kontekście CAD musi rzucić błąd, a nie zgadywać 3 mm
        expect(() => {
            requireCabinetPartThickness('PLECY', '', emptyCtx);
        }).toThrow(/Brak zdefiniowanej grubości/);
    });

    it('resolveCabinetPartThickness zwraca undefined przy braku definicji (brak zgadywania)', () => {
        const emptyCtx = { rules: {} };
        const th = resolveCabinetPartThickness('NIEZNANA_FORMATKA', '', emptyCtx);
        expect(th).toBeUndefined();
    });
});
