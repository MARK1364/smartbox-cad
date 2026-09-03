/**
 * SmartPanel Web — System Jednostek (Nanometry)
 *
 * Jednostką wewnętrzną systemu CAD są NANOMETRY (nm) jako liczba całkowita.
 *
 * Dlaczego nm?
 *   - Precyzja submilimetrowa bez zmiennoprzecinkowych błędów zaokrągleń
 *   - 1 mm = 1 000 000 nm  →  typowy wymiar płyty (600 mm) = 600 000 000 nm (mieści się w safe integer JS: 2^53)
 *   - OCCT pracuje wewnętrznie w metrach → konwersja: nm / 1e9
 *   - Babylon.js renderuje w mm (1 jednostka = 1 mm) → konwersja: nm / 1e6
 *
 * Zasada:
 *   Model domenowy (PanelModel, ContainerModel, PartJSON) — wartości w nm (integer)
 *   UI wejście/wyjście — milimetry (number, float)
 *   OCCT API — metry (number, float)
 *   Babylon scena — milimetry (number, float)
 */

/** Wewnętrzna jednostka systemu — nanometry (nm) jako integer */
export type Nanometers = number; // Zawsze integer!

/** Współczynniki konwersji DO nanometrów */
export const TO_NM = {
    mm:   1_000_000,        // 1 mm = 1 000 000 nm
    cm:   10_000_000,       // 1 cm = 10 000 000 nm
    m:    1_000_000_000,    // 1 m  = 1 000 000 000 nm
    inch: 25_400_000,       // 1" = 25.4 mm = 25 400 000 nm
} as const;

/** Aliasy dla wstecznej kompatybilności (TO_MICRONS było złą nazwą, teraz TO_NM) */
export const TO_MICRONS = TO_NM;

/** Narzędzia do bezpiecznej konwersji jednostek */
export const unit = {
    // ── Konwersja Z innych jednostek NA nanometry ──────────────────────────
    fromMM:   (mm: number): Nanometers   => Math.round(mm   * TO_NM.mm),
    fromCM:   (cm: number): Nanometers   => Math.round(cm   * TO_NM.cm),
    fromM:    (m: number): Nanometers    => Math.round(m    * TO_NM.m),
    fromInch: (inch: number): Nanometers => Math.round(inch * TO_NM.inch),

    // ── Konwersja Z nanometrów NA inne jednostki ───────────────────────────
    toMM:    (nm: Nanometers): number => nm / TO_NM.mm,
    toCM:    (nm: Nanometers): number => nm / TO_NM.cm,
    toM:     (nm: Nanometers): number => nm / TO_NM.m,
    toInch:  (nm: Nanometers): number => nm / TO_NM.inch,

    // ── Formatowanie dla UI ────────────────────────────────────────────────
    displayMM:    (nm: Nanometers): string => `${(nm / TO_NM.mm).toFixed(1)} mm`,
    displayInch:  (nm: Nanometers): string => `${(nm / TO_NM.inch).toFixed(3)}"`,
    displayM:     (nm: Nanometers): string => `${(nm / TO_NM.m).toFixed(4)} m`,

    // ── Dla OCCT (silnik B-Rep pracuje w metrach) ──────────────────────────
    toOCCT:  (nm: Nanometers): number => nm / TO_NM.m,
    fromOCCT:(m: number): Nanometers  => Math.round(m * TO_NM.m),

    // ── Dla Babylon.js (scena w mm, 1 jednostka = 1 mm) ───────────────────
    toBabylon:  (nm: Nanometers): number => nm / TO_NM.mm,
    fromBabylon:(mm: number): Nanometers => Math.round(mm * TO_NM.mm),

    // ── Pomocnicze ─────────────────────────────────────────────────────────
    /** Bezpieczne zaokrąglenie do nm z dowolnego floata */
    snap: (nm: number): Nanometers => Math.round(nm),

    /** Sprawdza czy wartość jest w bezpiecznym zakresie JS integer (do ~9 metrów) */
    isSafe: (nm: Nanometers): boolean => Number.isSafeInteger(nm),
};

// Alias dla tych którzy importowali stary typ 'Microns'
export type Microns = Nanometers;
