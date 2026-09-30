import { describe, it, expect } from 'vitest';
import { resolveModulePlugin } from '../bloki-core.js';
import { registerAllBlokiModules } from '../bootstrap-bloki-modules.js';
import { SmartModuleRegistry } from '../core/smart-module-registry.js';

/**
 * Kontrakt fail-fast na granicy domeny: `boxType` musi mieć wtyczkę.
 * Brak wtyczki = literówka w parametrze albo moduł pominięty w bootstrapie —
 * ma zatrzymać build czytelnym błędem, a nie wygenerować pustego bloku po cichu.
 */
describe('A2_bloki — resolveModulePlugin (fail-fast)', () => {
    it('rzuca czytelny błąd dla nieznanego boxType', () => {
        expect(() => resolveModulePlugin('DORSZIWNI')).toThrowError(/Nieznany boxType "DORSZIWNI"/);
    });

    it('wymienia w komunikacie plik bootstrapu, żeby błąd był naprawialny', () => {
        expect(() => resolveModulePlugin('DORSZIWNI')).toThrowError(/bootstrap-bloki-modules\.ts/);
    });

    it('traktuje EMPTY jako legalny sentinel pustego bloku (nie błąd, brak wtyczki)', () => {
        expect(resolveModulePlugin('EMPTY')).toBeNull();
    });

    it('samodzielnie rejestruje moduły przy pierwszym wywołaniu (bootstrap bez register.ts)', () => {
        expect(resolveModulePlugin('DOORS')?.id).toBe('DOORS');
        expect(resolveModulePlugin('SHELVES')?.id).toBe('SHELVES');
    });

    it('rejestr z bootstrapu ma 11 unikalnych id i nie zawiera sentinela EMPTY', () => {
        registerAllBlokiModules();
        const ids = SmartModuleRegistry.getActiveModules().map(p => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(11);
        expect(ids).not.toContain('EMPTY' as never);
    });
});