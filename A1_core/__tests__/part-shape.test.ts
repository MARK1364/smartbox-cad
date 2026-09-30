import { describe, expect, it } from 'vitest';
import {
    CYLINDER_SHAPE,
    isCylindricalPart,
    isTubeRodPart,
    readPartRole,
    readPartShape
} from '../cad-node/part-shape.js';

describe('Klasyfikacja bryły (part-shape) — bez heurystyki nazw', () => {
    // `name` nie wchodzi w kontrakt PartShapeSource — tu celowo, by udowodnić,
    // że klasyfikator ignoruje warstwę display.
    const withName = (model: Record<string, any>) => model as any;
    it('rozpoznaje walce po roli', () => {
        expect(isCylindricalPart({ role: 'TUBE_ROD' })).toBe(true);
        expect(isCylindricalPart({ role: 'HOLDER' })).toBe(true);
        // Rodziny ról: prefiks kodu, nie dowolny podciąg.
        expect(isCylindricalPart({ role: 'TUBE_ROD_LEFT' })).toBe(true);
        expect(isCylindricalPart({ role: 'HOLDER_FRONT' })).toBe(true);
        expect(isCylindricalPart({ role: 'CUSTOM_HOLDER' })).toBe(false);
    });

    it('rozpoznaje walce po jawnej fladze custom_properties.shape', () => {
        expect(isCylindricalPart({ role: 'OTHER', custom_properties: { shape: 'CYLINDER' } })).toBe(true);
        expect(isCylindricalPart({ role: 'OTHER', customProperties: { shape: 'cylinder' } })).toBe(true);
    });

    it('NIE rozpoznaje walca po nazwie (drazek / uchwyt / rozeta)', () => {
        expect(isCylindricalPart(withName({ role: 'SHELF_PANEL', name: 'Drazek_fi25' }))).toBe(false);
        expect(isCylindricalPart(withName({ role: 'FRONT', name: 'Uchwyt_Lewy' }))).toBe(false);
        expect(isCylindricalPart(withName({ role: 'TOP_PANEL', name: 'Rozeta drazka fi25' }))).toBe(false);
        expect(isCylindricalPart(withName({ role: 'SPACER', name: 'drazek' }))).toBe(false);
    });

    it('nie myli zwykłych profili LED (shape BOX) z walcem', () => {
        expect(isCylindricalPart({ role: 'LED', custom_properties: { shape: 'BOX' } })).toBe(false);
        expect(isCylindricalPart({ role: 'LED' })).toBe(false);
    });

    it('rozpoznaje okucie-rurę po hardwareType', () => {
        expect(isCylindricalPart({ nodeType: 'HARDWARE', role: 'HARDWARE', hardwareType: 'TUBE' })).toBe(true);
        expect(isCylindricalPart({ nodeType: 'HARDWARE', hardwareType: 'RAIL' })).toBe(false);
    });

    it('drążek odróżniony od uchwytu/rozety po roli', () => {
        expect(isTubeRodPart({ role: 'TUBE_ROD' })).toBe(true);
        expect(isTubeRodPart({ role: 'HOLDER' })).toBe(false);
        expect(isTubeRodPart({ role: 'HOLDER', custom_properties: { shape: CYLINDER_SHAPE } })).toBe(false);
    });

    it('normalizuje rolę i kod bryły', () => {
        expect(readPartRole({ role: ' tube_rod ' })).toBe('TUBE_ROD');
        expect(readPartRole({ role: null })).toBe('');
        expect(readPartShape({ custom_properties: { shape: ' l_notch ' } })).toBe('L_NOTCH');
        expect(readPartShape({})).toBe('');
    });

    it('obsługuje brak modelu', () => {
        expect(isCylindricalPart(null)).toBe(false);
        expect(isCylindricalPart(undefined)).toBe(false);
        expect(isTubeRodPart(null)).toBe(false);
    });
});
