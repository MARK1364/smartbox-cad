import { describe, it, expect } from 'vitest';
import {
    resolveProcessingPath,
    mapLegacyCategoryName,
} from '../material-processing.js';

describe('A7_material — routing ścieżki obróbki (kody, nie nazwy)', () => {
    it('płyta meblowa PART -> SAW_CNC', () => {
        expect(resolveProcessingPath({ nodeType: 'PART', role: 'SHELF', materialCategory: 'BOARD' })).toBe('SAW_CNC');
        expect(resolveProcessingPath({ nodeType: 'PART', role: 'FRONT', materialCategory: 'Płyta Wiórowa' })).toBe('SAW_CNC');
        expect(resolveProcessingPath({ nodeType: 'PART', role: 'SIDE_PANEL', materialCategory: 'Płyty laminowane' })).toBe('SAW_CNC');
    });

    it('lustro i szkło PART -> GLASS_SHOP (nie piła)', () => {
        expect(resolveProcessingPath({ nodeType: 'PART', role: 'MIRROR', materialCategory: 'MIRROR' })).toBe('GLASS_SHOP');
        expect(resolveProcessingPath({ nodeType: 'PART', role: 'FRONT', materialCategory: 'Lustro' })).toBe('GLASS_SHOP');
        expect(resolveProcessingPath({ nodeType: 'PART', materialCategory: 'Szkło Antisol' })).toBe('GLASS_SHOP');
    });

    it('pianka PART -> UPHOLSTERY (nóż, brak obrzeża)', () => {
        expect(resolveProcessingPath({ nodeType: 'PART', role: 'FOAM', materialCategory: 'FOAM' })).toBe('UPHOLSTERY');
        expect(resolveProcessingPath({ nodeType: 'PART', materialCategory: 'Pianka tapicerska' })).toBe('UPHOLSTERY');
    });

    it('okucie HARDWARE -> PURCHASE (nigdy piła)', () => {
        expect(resolveProcessingPath({ nodeType: 'HARDWARE', role: 'HINGE', library_id: 'BLUM_71B3550' })).toBe('PURCHASE');
        expect(resolveProcessingPath({ nodeType: 'HARDWARE', role: 'LED', library_id: 'LED_PROFILE_WPUSZCZANY' })).toBe('PURCHASE');
    });

    it('nieznane -> UNRESOLVED, nie zgadywanie', () => {
        expect(resolveProcessingPath(null)).toBe('UNRESOLVED');
        expect(resolveProcessingPath({ nodeType: 'PART', materialCategory: 'Inne' })).toBe('UNRESOLVED');
        expect(resolveProcessingPath({ nodeType: 'PART' })).toBe('UNRESOLVED');
        expect(resolveProcessingPath({ nodeType: 'ASSEMBLY', role: 'BLOKI' })).toBe('UNRESOLVED');
    });

    it('mapLegacyCategoryName: literówki z/bez ogonków mapują tak samo', () => {
        expect(mapLegacyCategoryName('Płyta Wiórowa')).toBe('BOARD');
        expect(mapLegacyCategoryName('plyta wiorowa')).toBe('BOARD');
        expect(mapLegacyCategoryName('MDF')).toBe('BOARD');
    });
});
