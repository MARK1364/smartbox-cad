import { describe, it, expect, beforeEach } from 'vitest';
import { SmartModuleRegistry } from '../core/smart-module-registry.js';
import type { SmartModulePlugin } from '../core/smart-module-plugin.js';
import { shelvesPlugin } from '../plugins/shelves-plugin.js';
import { drawersPlugin } from '../plugins/drawers-plugin.js';
import { registerAllBlokiModules } from '../01_bootstrap-bloki-modules.js';

describe('SmartModuleRegistry', () => {
    beforeEach(() => {
        SmartModuleRegistry.clear();
    });

    it('poprawnie rejestruje i pobiera wtyczki', () => {
        SmartModuleRegistry.register(shelvesPlugin);
        const plugin = SmartModuleRegistry.get('SHELVES');
        expect(plugin).toBeDefined();
        expect(plugin?.id).toBe('SHELVES');
        expect(plugin?.meta.category).toBe('internal');
    });

    it('zwraca domyślne parametry z użyciem kluczy kanonicznych (bez aliasów legacy)', () => {
        SmartModuleRegistry.register(shelvesPlugin);
        const plugin = SmartModuleRegistry.get('SHELVES');
        const defaultParams = plugin?.getDefaultParams();
        expect(defaultParams).toHaveProperty('liczba_polek');
        expect(defaultParams).not.toHaveProperty('shelfCount');
        expect(defaultParams).toHaveProperty('odsuniecie_przod_mm');
        expect(defaultParams).not.toHaveProperty('offsetFront_mm');
    });

    it('obsługuje rejestrację masową przez registerAllBlokiModules', () => {
        registerAllBlokiModules();
        const active = SmartModuleRegistry.getActiveModules();
        expect(active.length).toBeGreaterThanOrEqual(10);
        expect(SmartModuleRegistry.get('DOORS')).toBeDefined();
        expect(SmartModuleRegistry.get('DRAWERS')).toBeDefined();
        expect(SmartModuleRegistry.get('LED_INTERNAL')).toBeDefined();
    });

    it('filtruje nieaktywne moduły gdy flaga enabled zwraca false', () => {
        const dummyDisabledPlugin: SmartModulePlugin<{ test: boolean }> = {
            id: 'TUBES',
            meta: { label: 'Drążek', labelKey: 'test', description: 'Testowy opis', category: 'internal', order: 99 },
            enabled: false,
            buildPlan: () => ({ parts: [] }),
            getDefaultParams: () => ({ test: true }),
            UIComponent: () => null
        };

        SmartModuleRegistry.register(dummyDisabledPlugin);
        expect(SmartModuleRegistry.get('TUBES')).toBeDefined();
        expect(SmartModuleRegistry.isModuleEnabled('TUBES')).toBe(false);

        const active = SmartModuleRegistry.getActiveModules();
        expect(active.some(p => p.id === 'TUBES')).toBe(false);
    });

    it('wykonuje buildPlan i zwraca czystą geometrię meblową', () => {
        SmartModuleRegistry.register(shelvesPlugin);
        const plugin = SmartModuleRegistry.get('SHELVES')!;
        const plan = plugin.buildPlan({ liczba_polek: 2, odsuniecie_przod_mm: 10, grubosc_polki_mm: 18 }, { width_mm: 600, height_mm: 800, depth_mm: 500 });
        expect(plan).toBeDefined();
        expect(Array.isArray(plan.parts)).toBe(true);
        expect(plan.parts.length).toBe(2);
    });
});
