/**
 * Leftover localStorage arkuszy z czasów sprzed `extensions.drawings`.
 *
 * SSOT jest plik projektu. Te klucze służą wyłącznie jako mostek:
 * przy otwarciu starego pliku bez sekcji rysunków wciągamy leftover,
 * a kolejny Zapisz projektu przepisuje arkusze do `.spp.json`.
 * Nowy projekt ich nie wczytuje.
 */

export const LEGACY_E1_SHEETS_KEYS = [
    'smartbox_cad_manual_sheets_v3',
    'smartbox_cad_export_saved_views',
    'smartbox_cad_export_saved_views_v1',
    'smartbox_cad_manual_sheets_v2',
] as const;

export const LEGACY_E3_VIEWS_KEY = 'smartbox_cad_manual_sheets_v3_e3';
export const LEGACY_E3_MULTI_SHEETS_KEY = 'smartbox_cad_e3_sheets_v1';
export const LEGACY_E3_CURRENT_SHEET_KEY = 'smartbox_cad_e3_current_sheet_id';

export const LEGACY_EXPORT_STORAGE_KEYS = [
    ...LEGACY_E1_SHEETS_KEYS,
    LEGACY_E3_VIEWS_KEY,
    LEGACY_E3_MULTI_SHEETS_KEY,
    LEGACY_E3_CURRENT_SHEET_KEY,
] as const;

function readJsonArray(key: string): any[] {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function readLegacyE1Sheets(): any[] {
    for (const key of LEGACY_E1_SHEETS_KEYS) {
        const sheets = readJsonArray(key);
        if (sheets.length > 0) return sheets;
    }
    return [];
}

export function readLegacyE3Views(): any[] {
    return readJsonArray(LEGACY_E3_VIEWS_KEY);
}

export function readLegacyE3MultiSheets(): any[] {
    return readJsonArray(LEGACY_E3_MULTI_SHEETS_KEY);
}

export function readLegacyE3CurrentSheetId(): string | null {
    if (typeof localStorage === 'undefined') return null;
    try {
        return localStorage.getItem(LEGACY_E3_CURRENT_SHEET_KEY);
    } catch {
        return null;
    }
}

export function clearLegacyExportStorage(): void {
    if (typeof localStorage === 'undefined') return;
    for (const key of LEGACY_EXPORT_STORAGE_KEYS) {
        try {
            localStorage.removeItem(key);
        } catch {
            /* ignore quota / private mode */
        }
    }
}
