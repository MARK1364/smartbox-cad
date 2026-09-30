/**
 * T1_tlumaczenia/types.ts
 * Faza 1: pl (baza) + en (vice-baza) + de. Cyrylica (ru/bg/uk) później
 * jako dopisane klucze w *_tekst.json — bez zmian API.
 */

export type LocaleCode = 'pl' | 'en' | 'de';

export const SUPPORTED_LOCALES: readonly LocaleCode[] = ['pl', 'en', 'de'] as const;

/** Język źródłowy — komplet kluczy zawsze po polsku. */
export const DEFAULT_LOCALE: LocaleCode = 'pl';

/** Vice-baza — drugi fallback po aktywnym języku. */
export const FALLBACK_LOCALE: LocaleCode = 'en';

export const LOCALE_STORAGE_KEY = 'cad.locale';

/**
 * Format wpisów w *_tekst.json:
 *   "shelf_count.label": { "pl": "Ilość półek", "en": "Shelf count", "de": "Regalanzahl" }
 * `pl` wymagane. Braki en/de wyłapuje skrypt i18n-check.
 */
export type LocalizedString = {
    pl: string;
    en?: string;
    de?: string;
    [extraLang: string]: string | undefined;
};

/** Cały plik *_tekst.json jednego modułu. */
export type ModuleTexts = Record<string, LocalizedString>;

export function isLocaleCode(v: unknown): v is LocaleCode {
    return v === 'pl' || v === 'en' || v === 'de';
}
