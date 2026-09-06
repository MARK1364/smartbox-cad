import { describe, it, expect } from 'vitest';
import {
    SMARTBOX_INTERNAL_OPTIONS,
    SMARTBOX_EXTERNAL_OPTIONS,
    SMARTBOX_ALL_OPTIONS,
    type SmartBoxCategory
} from '../smartbox-bay-actions.js';
import {
    MODULE_TYPES,
    INTERNAL_MODULE_TYPES,
    EXTERNAL_MODULE_TYPES
} from '../ui/SmartBoxFloatingWindow.js';

describe('SmartBox Categories (Internal vs External)', () => {
    it('partitions SmartBox options into internal and external categories', () => {
        expect(SMARTBOX_INTERNAL_OPTIONS.length).toBeGreaterThanOrEqual(7);
        expect(SMARTBOX_EXTERNAL_OPTIONS.length).toBeGreaterThanOrEqual(1);
        expect(SMARTBOX_ALL_OPTIONS.length).toBe(
            SMARTBOX_INTERNAL_OPTIONS.length + SMARTBOX_EXTERNAL_OPTIONS.length
        );

        // Wszystkie wewnętrzne mają kategorię 'internal'
        for (const opt of SMARTBOX_INTERNAL_OPTIONS) {
            expect(opt.category).toBe('internal');
        }

        // Wszystkie zewnętrzne mają kategorię 'external'
        for (const opt of SMARTBOX_EXTERNAL_OPTIONS) {
            expect(opt.category).toBe('external');
        }

        // Blendy (PANELS) są w zewnętrznych
        expect(SMARTBOX_EXTERNAL_OPTIONS.some(o => o.id === 'PANELS')).toBe(true);
        // Półki (SHELVES), Drzwi (DOORS), Szuflady (DRAWERS) są w wewnętrznych
        expect(SMARTBOX_INTERNAL_OPTIONS.some(o => o.id === 'SHELVES')).toBe(true);
        expect(SMARTBOX_INTERNAL_OPTIONS.some(o => o.id === 'DOORS')).toBe(true);
        expect(SMARTBOX_INTERNAL_OPTIONS.some(o => o.id === 'DRAWERS')).toBe(true);
    });

    it('MODULE_TYPES in SmartBoxFloatingWindow matches internal and external definitions', () => {
        expect(INTERNAL_MODULE_TYPES.length).toBeGreaterThanOrEqual(7);
        expect(EXTERNAL_MODULE_TYPES.length).toBeGreaterThanOrEqual(1);

        expect(MODULE_TYPES['PANELS']?.category).toBe('external');
        expect(MODULE_TYPES['SHELVES']?.category).toBe('internal');
        expect(MODULE_TYPES['DOORS']?.category).toBe('internal');
        expect(MODULE_TYPES['DRAWERS']?.category).toBe('internal');
        expect(MODULE_TYPES['FLAPS']?.category).toBe('internal');
        expect(MODULE_TYPES['DIVIDERS']?.category).toBe('internal');
        expect(MODULE_TYPES['TUBES']?.category).toBe('internal');
        expect(MODULE_TYPES['SHELF']?.category).toBe('internal');
    });
});
