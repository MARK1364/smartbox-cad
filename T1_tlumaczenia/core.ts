/**
 * T1_tlumaczenia/core.ts
 * Centralny store locale + resolver tekstów z *_tekst.json.
 *
 * Zasady:
 * - ZERO zależności od Reacta — używane w silnikach, adapterach i loaderze HTML.
 * - Identyfikatory techniczne (Polka_1, shelfCount, Drazek_fi25) NIGDY tędy nie przechodzą.
 * - Fallback: aktywny -> en (vice-baza) -> pl (baza) -> ''.
 * - Kompletność pilnuje skrypt i18n-check, nie runtime.
 */

import {
    DEFAULT_LOCALE,
    FALLBACK_LOCALE,
    LOCALE_STORAGE_KEY,
    SUPPORTED_LOCALES,
    isLocaleCode,
    type LocaleCode,
    type LocalizedString,
    type ModuleTexts,
} from './types.ts';

export type { LocaleCode, LocalizedString, ModuleTexts } from './types.ts';

let currentLocale: LocaleCode = DEFAULT_LOCALE;
let warnedKeys = new Set<string>();

type Listener = (locale: LocaleCode) => void;
const listeners = new Set<Listener>();

function detectInitialLocale(): LocaleCode {
    try {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
        if (isLocaleCode(stored)) return stored;
    } catch { /* tryb prywatny / brak DOM — ignoruj */ }
    try {
        const short = typeof navigator !== 'undefined' ? (navigator.language || '').split('-')[0]?.toLowerCase() : '';
        if (isLocaleCode(short)) return short;
    } catch { /* ignoruj */ }
    return DEFAULT_LOCALE;
}

currentLocale = detectInitialLocale();
if (typeof document !== 'undefined') {
    try { document.documentElement.lang = currentLocale; } catch { /* ignoruj */ }
}

export function getLocale(): LocaleCode {
    return currentLocale;
}

export function getSupportedLocales(): readonly LocaleCode[] {
    return SUPPORTED_LOCALES;
}

export function setLocale(code: LocaleCode): void {
    if (!isLocaleCode(code) || code === currentLocale) return;
    currentLocale = code;
    try { localStorage?.setItem(LOCALE_STORAGE_KEY, code); } catch { /* ignoruj */ }
    if (typeof document !== 'undefined') {
        try { document.documentElement.lang = code; } catch { /* ignoruj */ }
    }
    listeners.forEach((fn) => { try { fn(code); } catch (e) { console.error('[T1] locale listener failed:', e); } });
}

export function onLocaleChange(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}

/** Resolver pojedynczego wpisu {pl,en,de}. String przepuszcza bez zmian. */
export function resolveEntry(entry: LocalizedString | string | null | undefined, debugKey = ''): string {
    if (entry === null || entry === undefined) return '';
    if (typeof entry === 'string') return entry;
    const hit = entry[currentLocale] ?? entry[FALLBACK_LOCALE] ?? entry[DEFAULT_LOCALE] ?? '';
    if (hit === '' && debugKey && !warnedKeys.has(debugKey)) {
        warnedKeys.add(debugKey);
        console.warn(`[T1] missing translation for key "${debugKey}" (locale=${currentLocale})`);
    }
    return hit;
}

/**
 * Główne API modułów: tekst spod klucza z pliku *_tekst.json.
 *   tx(tubesTekst, 'offset_top.label')  // "Dystans od góry:" | "Distance from top:" | ...
 *   tx(dividersTekst, 'section.label_template', NS, { n: 3 })  // "Wnęka 3:" | "Bay 3:" | ...
 * Placeholdery {nazwa} podmieniane z `vars`. Liczby formatuj poza tx (format.ts).
 */
export function tx(
    dict: ModuleTexts | null | undefined,
    key: string,
    debugNs = '',
    vars?: Record<string, string | number>
): string {
    if (!dict) return '';
    const entry = dict[key];
    if (!entry) {
        const full = debugNs ? `${debugNs}.${key}` : key;
        if (!warnedKeys.has(full)) {
            warnedKeys.add(full);
            console.warn(`[T1] missing key "${full}" (locale=${currentLocale})`);
        }
        return '';
    }
    let out = resolveEntry(entry, debugNs ? `${debugNs}.${key}` : key);
    if (vars) {
        for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    }
    return out;
}

/** Tylko do testów: czyści cache ostrzeżeń o brakach. */
export function __resetWarnCacheForTests(): void {
    warnedKeys = new Set<string>();
}
