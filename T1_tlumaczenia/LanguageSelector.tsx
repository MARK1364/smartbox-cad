/**
 * T1_tlumaczenia/LanguageSelector.tsx
 * Przełącznik języka pl/en/de. Zapis do localStorage, <html lang>, re-render przez useLocale().
 * Nazwy własne języków (Polski/English/Deutsch) — nie tłumaczymy.
 */
import React from 'react';
import { getLocale, getSupportedLocales, setLocale } from './core.js';
import type { LocaleCode } from './types.js';
import { useLocale } from './react.js';

const NATIVE_NAMES: Record<LocaleCode, string> = {
    pl: 'Polski',
    en: 'English',
    de: 'Deutsch',
};

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
    const locale = useLocale();

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
            }}
            title="Język / Language / Sprache"
        >
            {!compact && (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {locale === 'pl' ? 'Język:' : locale === 'de' ? 'Sprache:' : 'Language:'}
                </span>
            )}
            {getSupportedLocales().map((code) => (
                <button
                    key={code}
                    type="button"
                    onClick={() => setLocale(code)}
                    title={NATIVE_NAMES[code]}
                    style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: getLocale() === code ? 700 : 400,
                        background: getLocale() === code ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                        border: getLocale() === code ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '4px',
                        color: '#e4e4e7',
                        cursor: 'pointer',
                    }}
                >
                    {code.toUpperCase()}
                </button>
            ))}
        </div>
    );
}
