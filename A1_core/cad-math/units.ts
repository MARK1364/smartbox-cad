/**
 * SmartPanel Web — CAD Math: Units (Konwersja Jednostek)
 *
 * Jedno miejsce dla przeliczania jednostek. Bez zgadywania (`n < 2`, `n > 100_000`).
 *
 *   Domena CAD / CADNode / silniki / pliki zapisu  →  Nanometry (nm) [SSOT]
 *   UI / Formularze                                 →  Milimetry (mm)
 *   JSON rules i Biblioteki/okucia                  →  Metry (m) — rulesMToNm do silnika, rulesMToMm tylko do UI
 *   Postprocesory CNC                               →  Milimetry (mm) / Cale (inch)
 *
 * 1 mm = 1,000,000 nm (10^6)
 * 1 m  = 1,000 mm
 * 1 inch = 25.4 mm = 25,400,000 nm
 *
 * Zero zależności od Babylon.js, OCCT, DOM.
 */

/** Przelicznik milimetry → nanometry (1 mm = 1 000 000 nm) */
export const MM_TO_NM_FACTOR = 1_000_000;

/** Przelicznik nanometry → milimetry */
export const NM_TO_MM_FACTOR = 1 / MM_TO_NM_FACTOR;

/** Przelicznik metry (JSON rules / okucia) → milimetry — tylko UI */
export const M_TO_MM_FACTOR = 1_000;

/** Przelicznik metry (JSON rules / okucia) → nanometry (silnik) */
export const M_TO_NM_FACTOR = 1_000_000_000;

/** Przelicznik cale → nanometry (1 inch = 25.4 mm = 25 400 000 nm) */
export const INCH_TO_NM_FACTOR = 25.4 * MM_TO_NM_FACTOR;

/** Przelicznik nanometry → cale */
export const NM_TO_INCH_FACTOR = 1 / INCH_TO_NM_FACTOR;

/**
 * Konwertuje milimetry do nanometrów.
 * @param mm Wartość w milimetrach
 * @returns Wartość w nanometrach (zaokrąglona do liczby całkowitej)
 */
export function mmToNm(mm: number): number {
    return Math.round(mm * MM_TO_NM_FACTOR);
}

/**
 * Konwertuje nanometry do milimetrów. Źródło MUSI być w nm (model CAD).
 */
export function nmToMm(nm: number): number {
    return nm * NM_TO_MM_FACTOR;
}

/**
 * JSON rules / katalog okuć (metry) → nm. Źródło MUSI być w metrach (np. 0.018 → 18_000_000).
 * Brak / NaN → fallback w nanometrach (domyślnie 0).
 */
export function rulesMToNm(meters: number | undefined | null, fallbackNm = 0): number {
    if (meters === undefined || meters === null || !Number.isFinite(Number(meters))) return fallbackNm;
    return Math.round(Number(meters) * M_TO_NM_FACTOR);
}

/**
 * JSON rules z Blendera (metry) → mm. Tylko UI. Źródło MUSI być w metrach (np. 0.018 → 18).
 * Brak / NaN → fallback (domyślnie 0).
 */
export function rulesMToMm(meters: number | undefined | null, fallback = 0): number {
    if (meters === undefined || meters === null || !Number.isFinite(Number(meters))) return fallback;
    return Number(meters) * M_TO_MM_FACTOR;
}

/**
 * Konwertuje cale do nanometrów.
 * @param inch Wartość w calach
 * @returns Wartość w nanometrach (zaokrąglona do liczby całkowitej)
 */
export function inchToNm(inch: number): number {
    return Math.round(inch * INCH_TO_NM_FACTOR);
}

/**
 * Konwertuje nanometry do cali.
 * @param nm Wartość w nanometrach
 * @returns Wartość w calach
 */
export function nmToInch(nm: number): number {
    return nm * NM_TO_INCH_FACTOR;
}
