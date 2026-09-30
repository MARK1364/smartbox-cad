/**
 * T1_tlumaczenia/react.tsx
 * Jedyny plik T1 zależny od Reacta: hook przeładowujący komponent po zmianie języka.
 * Core (core.ts) zostaje czysty — silniki go importują bez Reacta w bundle.
 */
import { useEffect, useState } from 'react';
import { getLocale, onLocaleChange } from './core.ts';
import type { LocaleCode } from './types.ts';

/** Subskrypcja locale; wymusza re-render po setLocale(). */
export function useLocale(): LocaleCode {
    const [locale, setLocaleState] = useState<LocaleCode>(() => getLocale());
    useEffect(() => onLocaleChange(setLocaleState), []);
    return locale;
}
