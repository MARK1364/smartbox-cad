/**
 * Filtrowanie pozycji cennika (UI edytora). Czyste funkcje — bez zależności od React.
 * Filtr działa po polach danych (klucz, nazwa, jednostka, producent), nigdy po stringach sterujących.
 */

import type { PriceEntry } from './prices-validate.js';

export type PriceValue = number | PriceEntry;

export interface PriceFilter {
    /** Szukanie tekstowe w kluczu, nazwie, jednostce i producencie. */
    query?: string;
    /** Producent (dokładne dopasowanie); pusty = wszyscy. */
    brand?: string;
    /** Jednostka (dokładne dopasowanie); pusty = wszystkie. */
    unit?: string;
}

function entryString(value: PriceValue, field: 'name' | 'unit' | 'brand'): string {
    if (typeof value !== 'object' || value === null) return '';
    const raw = (value as PriceEntry)[field];
    return typeof raw === 'string' ? raw : '';
}

export function collectBrands(entries: [string, PriceValue][]): string[] {
    const set = new Set<string>();
    for (const [, value] of entries) {
        const brand = entryString(value, 'brand');
        if (brand) set.add(brand);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pl'));
}

export function collectUnits(entries: [string, PriceValue][]): string[] {
    const set = new Set<string>();
    for (const [, value] of entries) {
        const unit = entryString(value, 'unit');
        if (unit) set.add(unit);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pl'));
}

export function filterPriceEntries(
    entries: [string, PriceValue][],
    filter: PriceFilter
): [string, PriceValue][] {
    const query = (filter.query || '').trim().toLowerCase();
    const brand = (filter.brand || '').trim();
    const unit = (filter.unit || '').trim();
    if (!query && !brand && !unit) return entries;

    return entries.filter(([key, value]) => {
        if (brand && entryString(value, 'brand') !== brand) return false;
        if (unit && entryString(value, 'unit') !== unit) return false;
        if (query) {
            const haystack = [
                key,
                entryString(value, 'name'),
                entryString(value, 'unit'),
                entryString(value, 'brand'),
            ]
                .join(' ')
                .toLowerCase();
            if (!haystack.includes(query)) return false;
        }
        return true;
    });
}
