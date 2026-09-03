/**
 * Słownik tłumaczeń z kluczy wewnętrznych (EN) na etykiety interfejsu użytkownika (PL).
 * Single Source of Truth dla nazewnictwa w UI.
 */
export const TRANSLATIONS: Record<string, string> = {
    // Strefy
    'ZONE_B': 'Sekcja Dolna',
    'ZONE_M': 'Sekcja Środkowa',
    'ZONE_T': 'Sekcja Górna (Pawlacz)',

    // Elementy Korpusu (Lewa Strona)
    'B_SIDE_LEFT': 'Lewy Bok (Dół)',
    'M_SIDE_LEFT': 'Lewy Bok (Środek)',
    'T_SIDE_LEFT': 'Lewy Bok (Góra)',

    // Elementy Korpusu (Prawa Strona)
    'B_SIDE_RIGHT': 'Prawy Bok (Dół)',
    'M_SIDE_RIGHT': 'Prawy Bok (Środek)',
    'T_SIDE_RIGHT': 'Prawy Bok (Góra)',

    // Elementy Korpusu (Poziome)
    'B_BOTTOM': 'Wieniec Dolny',
    'B_TOP': 'Przegroda (Dół-Środek)',
    'M_BOTTOM': 'Przegroda (Dół-Środek)',
    'M_TOP': 'Przegroda (Środek-Góra)',
    'T_BOTTOM': 'Przegroda (Środek-Góra)',
    'T_TOP': 'Wieniec Górny',

    // Plecy
    'B_BACK': 'Plecy (Dół)',
    'M_BACK': 'Plecy (Środek)',
    'T_BACK': 'Plecy (Góra)',

    // Części ogólne
    'SIDE_LEFT': 'Lewy Bok',
    'SIDE_RIGHT': 'Prawy Bok',
    'BOTTOM': 'Wieniec Dolny',
    'TOP': 'Wieniec Górny',
    'BACK': 'Plecy'
};

/**
 * Funkcja pomocnicza do tłumaczenia klucza. Jeśli nie znajdzie, zwraca klucz wejściowy.
 */
export function translateToPL(key: string): string {
    return TRANSLATIONS[key] || key;
}
