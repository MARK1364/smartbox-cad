import { describe, it, expect, beforeEach } from 'vitest';
import { priceStore, PRICES_OVERRIDE_KEY } from '../price-store';
import { storageAdapter } from '../../src/storage/storage-adapter';

const SAMPLE = {
    prices_hardware: { TEST_ZAWIAS: { price: 7.25, unit: 'szt', name: 'Test zawias' } },
} as const;

describe('PriceStore', () => {
    beforeEach(() => {
        storageAdapter.removeItem(PRICES_OVERRIDE_KEY);
        priceStore.reset();
    });

    it('domyślny cennik pochodzi z prices.json (zawiera Podpórkę fi 5)', () => {
        const hw = priceStore.defaults().prices_hardware || {};
        expect(hw['PODPORKA_FI5']).toBeTruthy();
    });

    it('startuje z cen domyślnych bez nadpisania', () => {
        expect(priceStore.isOverridden).toBe(false);
        expect(priceStore.prices.prices_hardware?.['PODPORKA_FI5']).toBeTruthy();
    });

    it('setPrices waliduje, aktualizuje ceny i utrwala override', () => {
        priceStore.setPrices(SAMPLE);
        expect(priceStore.prices.prices_hardware?.['TEST_ZAWIAS']).toEqual(SAMPLE.prices_hardware.TEST_ZAWIAS);
        expect(priceStore.isOverridden).toBe(true);
        expect(storageAdapter.getItem(PRICES_OVERRIDE_KEY)).toContain('TEST_ZAWIAS');
    });

    it('applyPrices bez persist nie tworzy override', () => {
        priceStore.applyPrices(SAMPLE);
        expect(priceStore.prices.prices_hardware?.['TEST_ZAWIAS']).toBeTruthy();
        expect(priceStore.isOverridden).toBe(false);
    });

    it('reset przywraca ceny domyślne i usuwa override', () => {
        priceStore.setPrices(SAMPLE);
        priceStore.reset();
        expect(priceStore.isOverridden).toBe(false);
        expect(priceStore.prices.prices_hardware?.['TEST_ZAWIAS']).toBeUndefined();
        expect(priceStore.prices.prices_hardware?.['PODPORKA_FI5']).toBeTruthy();
    });

    it('powiadamia subskrybentów, a unsubscribe odłącza', () => {
        let calls = 0;
        const unsubscribe = priceStore.subscribe(() => {
            calls++;
        });
        priceStore.setPrices(SAMPLE);
        expect(calls).toBe(1);
        unsubscribe();
        priceStore.reset();
        expect(calls).toBe(1);
    });

    it('odrzuca niepoprawny cennik i nie zmienia aktualnych cen', () => {
        const before = JSON.stringify(priceStore.prices);
        expect(() => priceStore.setPrices({})).toThrow();
        expect(JSON.stringify(priceStore.prices)).toBe(before);
    });
});
