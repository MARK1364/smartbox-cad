/**
 * zone-helper.ts
 *
 * Jedno źródło prawdy (SSOT) dla identyfikatorów stref w korpusach i SmartBoxach.
 * 
 * Kanoniczne identyfikatory stref:
 * - zoneId: 'SEKCJA_B' | 'SEKCJA_M' | 'SEKCJA_T'
 * - zonePrefix: 'B_' | 'M_' | 'T_'
 */

export type CanonicalZoneId = 'SEKCJA_B' | 'SEKCJA_M' | 'SEKCJA_T';
export type CanonicalZonePrefix = 'B_' | 'M_' | 'T_';

/**
 * Próbuje znormalizować wariant zapisu strefy (np. 'B', 'M', 'T', 'SEKCJA_B', 'BOTTOM', 'MID', 'TOP', 'B_')
 * do kanonicznego `CanonicalZoneId`.
 * Jeśli wartość jest niepoprawna lub nieznana, zwraca `null`.
 */
export function tryNormalizeToCanonicalZoneId(zoneInput?: string | null): CanonicalZoneId | null {
    if (!zoneInput) return null;
    const u = String(zoneInput).trim().toUpperCase();
    if (!u) return null;

    if (
        u === 'SEKCJA_T' ||
        u === 'T' ||
        u === 'TOP' ||
        u === 'T_' ||
        u === 'GORA' ||
        u === 'PAWLACZ' ||
        u === 'C'
    ) {
        return 'SEKCJA_T';
    }

    if (
        u === 'SEKCJA_M' ||
        u === 'M' ||
        u === 'MID' ||
        u === 'MIDDLE' ||
        u === 'M_' ||
        u === 'SRODEK'
    ) {
        return 'SEKCJA_M';
    }

    if (
        u === 'SEKCJA_B' ||
        u === 'B' ||
        u === 'BOTTOM' ||
        u === 'B_' ||
        u === 'DOL' ||
        u === 'A'
    ) {
        return 'SEKCJA_B';
    }

    return null;
}

/**
 * Normalizuje dowolny wariant zapisu strefy do kanonicznego `CanonicalZoneId`.
 * Domyślnie dla pustej wartości zwraca 'SEKCJA_B'.
 * Dla nieznanych wartości zwraca 'SEKCJA_B' lub rzuca/używa tryNormalize.
 */
export function normalizeToCanonicalZoneId(zoneInput?: string | null, fallback: CanonicalZoneId = 'SEKCJA_B'): CanonicalZoneId {
    const norm = tryNormalizeToCanonicalZoneId(zoneInput);
    return norm ?? fallback;
}

/**
 * Zwraca kanoniczny prefiks klucza dla danej strefy ('B_' | 'M_' | 'T_').
 */
export function getCanonicalZonePrefix(zoneInput?: string | null): CanonicalZonePrefix {
    const zoneId = normalizeToCanonicalZoneId(zoneInput);
    switch (zoneId) {
        case 'SEKCJA_T': return 'T_';
        case 'SEKCJA_M': return 'M_';
        case 'SEKCJA_B':
        default:
            return 'B_';
    }
}
