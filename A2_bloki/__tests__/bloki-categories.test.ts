import { describe, it, expect } from 'vitest';
import {
    BLOKI_INTERNAL_OPTIONS,
    BLOKI_EXTERNAL_OPTIONS,
    BLOKI_PANEL_OPTIONS,
    BLOKI_ALL_OPTIONS,
    type BlokiCategory
} from '../bloki-bay-actions.js';
import {
    MODULE_TYPES,
    INTERNAL_MODULE_TYPES,
    EXTERNAL_MODULE_TYPES,
    PANEL_MODULE_TYPES
} from '../ui/BlokiFloatingWindow.js';

describe('Bloki Categories (Internal vs External vs Panel)', () => {
    it('partitions Bloki options into internal, external and panel categories', () => {
        expect(BLOKI_INTERNAL_OPTIONS.length).toBeGreaterThanOrEqual(7);
        expect(BLOKI_EXTERNAL_OPTIONS.length).toBeGreaterThanOrEqual(1);
        expect(BLOKI_PANEL_OPTIONS.length).toBeGreaterThanOrEqual(1);
        expect(BLOKI_ALL_OPTIONS.length).toBe(
            BLOKI_INTERNAL_OPTIONS.length + BLOKI_EXTERNAL_OPTIONS.length + BLOKI_PANEL_OPTIONS.length
        );

        // Wszystkie wewnętrzne mają kategorię 'internal'
        for (const opt of BLOKI_INTERNAL_OPTIONS) {
            expect(opt.category).toBe('internal');
        }

        // Wszystkie zewnętrzne mają kategorię 'external'
        for (const opt of BLOKI_EXTERNAL_OPTIONS) {
            expect(opt.category).toBe('external');
        }

        // Wszystkie powierzchniowe mają kategorię 'panel'
        for (const opt of BLOKI_PANEL_OPTIONS) {
            expect(opt.category).toBe('panel');
        }

        // Blendy (PANELS) są w zewnętrznych
        expect(BLOKI_EXTERNAL_OPTIONS.some(o => o.id === 'PANELS')).toBe(true);
        // Uchwyty (HANDLES) i Zawieszki (HANGERS) są w panelowych
        expect(BLOKI_PANEL_OPTIONS.some(o => o.id === 'HANDLES')).toBe(true);
        expect(BLOKI_PANEL_OPTIONS.some(o => o.id === 'HANGERS')).toBe(true);
        // Półki (SHELVES), Drzwi (DOORS), Szuflady (DRAWERS) są w wewnętrznych
        expect(BLOKI_INTERNAL_OPTIONS.some(o => o.id === 'SHELVES')).toBe(true);
        expect(BLOKI_INTERNAL_OPTIONS.some(o => o.id === 'DOORS')).toBe(true);
        expect(BLOKI_INTERNAL_OPTIONS.some(o => o.id === 'SKOSNE_DOORS')).toBe(true);
        expect(BLOKI_INTERNAL_OPTIONS.some(o => o.id === 'CORNER_DOORS')).toBe(true);
        expect(BLOKI_INTERNAL_OPTIONS.some(o => o.id === 'DRAWERS')).toBe(true);
    });

    it('MODULE_TYPES in BlokiFloatingWindow matches internal, external and panel definitions', () => {
        expect(INTERNAL_MODULE_TYPES.length).toBeGreaterThanOrEqual(7);
        expect(EXTERNAL_MODULE_TYPES.length).toBeGreaterThanOrEqual(1);
        expect(PANEL_MODULE_TYPES.length).toBeGreaterThanOrEqual(2);

        expect(MODULE_TYPES['PANELS']?.category).toBe('external');
        expect(MODULE_TYPES['HANDLES']?.category).toBe('panel');
        expect(MODULE_TYPES['HANGERS']?.category).toBe('panel');
        expect(MODULE_TYPES['SHELVES']?.category).toBe('internal');
        expect(MODULE_TYPES['DOORS']?.category).toBe('internal');
        expect(MODULE_TYPES['SKOSNE_DOORS']?.category).toBe('internal');
        expect(MODULE_TYPES['DRAWERS']?.category).toBe('internal');
        expect(MODULE_TYPES['FLAPS']?.category).toBe('internal');
        expect(MODULE_TYPES['DIVIDERS']?.category).toBe('internal');
        expect(MODULE_TYPES['TUBES']?.category).toBe('internal');
        expect(MODULE_TYPES['SHELF']?.category).toBe('internal');
    });
});
