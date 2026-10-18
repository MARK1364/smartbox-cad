/**
 * Wspólna walidacja i serializacja cennika (R1_reports/prices.json).
 * Używane zarówno przez dev-API (Vite, Node), jak i edytor w przeglądarce —
 * dlatego zero zależności od node/vite.
 */

export const PRICE_SECTIONS = ['prices_materials', 'prices_services', 'prices_hardware'] as const;

export type PriceSection = (typeof PRICE_SECTIONS)[number];

export interface PriceEntry {
    price: number;
    unit?: string;
    name?: string;
    /** Dodatkowa informacja / podpowiedź (np. „bez hamulca”, „300mm”). */
    opis?: string;
    brand?: string;
    /** Kategoria produktu (np. „Zawiasy”, „Szuflady”). */
    kategoria?: string;
    /** Indeks / kod produktu nadawany przez firmę (opcjonalny). */
    indeks?: string;
}

export type PriceDatabase = Partial<Record<PriceSection, Record<string, number | PriceEntry>>>;

/**
 * Waliduje cały cennik. Rzuca Error z czytelnym komunikatem przy pierwszym błędzie.
 * Kontrakt: obiekt z co najmniej jedną sekcją, każda sekcja to mapa
 * klucz → liczba albo { price, unit?, name?, opis?, brand?, kategoria?, indeks? }.
 */
export function validatePriceDatabase(db: any): asserts db is PriceDatabase {
    if (!db || typeof db !== 'object' || Array.isArray(db)) {
        throw new Error('Cennik musi być obiektem JSON.');
    }
    const present = PRICE_SECTIONS.filter((s) => db[s] !== undefined);
    if (present.length === 0) {
        throw new Error(`Cennik musi zawierać sekcję: ${PRICE_SECTIONS.join(', ')}.`);
    }
    for (const section of present) {
        const block = db[section];
        if (!block || typeof block !== 'object' || Array.isArray(block)) {
            throw new Error(`Sekcja „${section}” musi być obiektem.`);
        }
        for (const [key, value] of Object.entries(block)) {
            if (typeof value === 'number') {
                if (!Number.isFinite(value) || value < 0) {
                    throw new Error(`[${section}] „${key}”: cena musi być liczbą ≥ 0.`);
                }
                continue;
            }
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                throw new Error(`[${section}] „${key}”: wpis musi być liczbą albo obiektem { price, unit?, name?, opis?, brand?, kategoria?, indeks? }.`);
            }
            const entry = value as any;
            if (typeof entry.price !== 'number' || !Number.isFinite(entry.price) || entry.price < 0) {
                throw new Error(`[${section}] „${key}”: pole „price” musi być liczbą ≥ 0.`);
            }
            if (entry.unit !== undefined && typeof entry.unit !== 'string') {
                throw new Error(`[${section}] „${key}”: pole „unit” musi być tekstem.`);
            }
            if (entry.name !== undefined && typeof entry.name !== 'string') {
                throw new Error(`[${section}] „${key}”: pole „name” musi być tekstem.`);
            }
            if (entry.opis !== undefined && typeof entry.opis !== 'string') {
                throw new Error(`[${section}] „${key}”: pole „opis” musi być tekstem.`);
            }
            if (entry.brand !== undefined && typeof entry.brand !== 'string') {
                throw new Error(`[${section}] „${key}”: pole „brand” musi być tekstem.`);
            }
            if (entry.kategoria !== undefined && typeof entry.kategoria !== 'string') {
                throw new Error(`[${section}] „${key}”: pole „kategoria” musi być tekstem.`);
            }
            if (entry.indeks !== undefined && typeof entry.indeks !== 'string') {
                throw new Error(`[${section}] „${key}”: pole „indeks” musi być tekstem.`);
            }
        }
    }
}

/** Serializacja z wcięciem zgodnym z ręcznie utrzymywanym plikiem (4 spacje + końcowy newline). */
export function serializePriceDatabase(db: any): string {
    return JSON.stringify(db, null, 4) + '\n';
}
