/**
 * Import/eksport cennika do CSV (R1_reports/prices.json ↔ plik .csv).
 * Płaski format: jeden wiersz = jedna pozycja, kolumna „sekcja” wskazuje blok.
 * Obsługa cudzysłowów oraz separatora „,” lub „;” (auto-wykrywanie — Excel PL).
 */

import {
    PRICE_SECTIONS,
    validatePriceDatabase,
    type PriceDatabase,
    type PriceEntry,
    type PriceSection,
} from './prices-validate.js';

const COLUMNS = [
    'sekcja',
    'klucz',
    'kategoria',
    'indeks',
    'nazwa',
    'opis',
    'producent',
    'cena',
    'jednostka',
] as const;

function csvEscape(value: string): string {
    if (value.includes(',') || value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

/** Serializuje cały cennik (wszystkie sekcje) do CSV. */
export function toCsv(db: PriceDatabase): string {
    const lines: string[] = [COLUMNS.join(',')];
    for (const section of PRICE_SECTIONS) {
        const block = db[section];
        if (!block) continue;
        for (const [key, value] of Object.entries(block)) {
            const entry: PriceEntry = typeof value === 'number' ? { price: value } : value;
            const row = [
                section,
                key,
                entry.kategoria || '',
                entry.indeks || '',
                entry.name || '',
                entry.opis || '',
                entry.brand || '',
                String(Number.isFinite(entry.price) ? entry.price : 0),
                entry.unit || '',
            ];
            lines.push(row.map(csvEscape).join(','));
        }
    }
    return lines.join('\n') + '\n';
}

function detectDelimiter(text: string): string {
    const firstLine = text.split(/\r?\n/)[0] || '';
    const semi = (firstLine.match(/;/g) || []).length;
    const comma = (firstLine.match(/,/g) || []).length;
    return semi > comma ? ';' : ',';
}

function parseCsv(text: string, delimiter: string): string[][] {
    const src = text.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQuotes) {
            if (c === '"') {
                if (src[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === delimiter) {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && src[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            rows.push(row);
            row = [];
        } else {
            field += c;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

/** Parsuje CSV do cennika. Rzuca Error z czytelnym komunikatem przy błędzie. */
export function fromCsv(text: string): PriceDatabase {
    const delimiter = detectDelimiter(text);
    const rows = parseCsv(text, delimiter).filter((r) => r.some((c) => c.trim() !== ''));
    if (rows.length === 0) throw new Error('Plik CSV jest pusty.');

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    if (idx('sekcja') < 0 || idx('klucz') < 0) {
        throw new Error(`CSV musi mieć kolumny: ${COLUMNS.join(', ')}.`);
    }
    const col = (r: string[], name: string): string => {
        const i = idx(name);
        return i >= 0 ? r[i] ?? '' : '';
    };

    const db: PriceDatabase = {};
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const section = col(r, 'sekcja').trim() as PriceSection;
        const key = col(r, 'klucz').trim();
        if (!key) continue;
        if (!PRICE_SECTIONS.includes(section)) {
            throw new Error(`Nieznana sekcja „${section}” w wierszu ${i + 1}.`);
        }
        const priceRaw = col(r, 'cena').trim().replace(',', '.');
        const price = priceRaw === '' ? 0 : Number(priceRaw);
        if (!Number.isFinite(price) || price < 0) {
            throw new Error(`Nieprawidłowa cena w wierszu ${i + 1}: „${col(r, 'cena')}”.`);
        }

        const entry: PriceEntry = { price };
        const kategoria = col(r, 'kategoria').trim();
        const name = col(r, 'nazwa').trim();
        const opis = col(r, 'opis').trim();
        const brand = col(r, 'producent').trim();
        const unit = col(r, 'jednostka').trim();
        if (kategoria) entry.kategoria = kategoria;
        entry.indeks = col(r, 'indeks').trim();
        if (name) entry.name = name;
        if (opis) entry.opis = opis;
        if (brand) entry.brand = brand;
        if (unit) entry.unit = unit;

        const block = db[section] ?? (db[section] = {});
        block[key] = entry;
    }

    validatePriceDatabase(db);
    return db;
}
