/**
 * Klient dev-API cennika (Vite). Zapisywany plik: R1_reports/prices.json.
 * Przy zapisie poprzednia wersja trafia do R1_reports/prices.backup.json
 * (kopia awaryjna — przywracana ręcznie przez podmianę pliku w folderze).
 * Wszystkie funkcje są odporne na brak backendu — zwracają błąd zamiast rzucać.
 */

import { validatePriceDatabase, type PriceDatabase } from './prices-validate.js';

export interface PricesApiResult {
    ok: boolean;
    error?: string;
}

export async function fetchPricesFromServer(): Promise<PriceDatabase | null> {
    try {
        const res = await fetch('/api/prices', { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.ok || !data.prices) return null;
        validatePriceDatabase(data.prices);
        return data.prices as PriceDatabase;
    } catch {
        return null;
    }
}

export async function savePricesToServer(prices: PriceDatabase): Promise<PricesApiResult> {
    try {
        const res = await fetch('/api/prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prices }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
            return { ok: false, error: data?.error || `HTTP ${res.status}` };
        }
        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: String(err?.message || err) };
    }
}

