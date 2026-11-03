/**
 * Centralny moduł unikalności nazw (wzorem Blendera).
 *
 * Pilnuje, aby nazwy obiektów w scenie były unikalne, automatycznie
 * dopisując przyrostki numeryczne .001, .002, .003 przy kolizji.
 */

/**
 * Generuje unikalną nazwę wzorem Blendera (np. "Bok" -> "Bok.001" -> "Bok.002").
 *
 * @param desiredName Proponowana nazwa
 * @param existingNames Zbiór istniejących nazw (z wyłączeniem obiektu aktualnie modyfikowanego)
 */
export function deduplicateName(desiredName: string, existingNames: Iterable<string>): string {
    const trimmed = (desiredName || '').trim() || 'Obiekt';
    const namesSet = existingNames instanceof Set ? existingNames : new Set(existingNames);

    if (!namesSet.has(trimmed)) {
        return trimmed;
    }

    // Sprawdź, czy nazwa kończy się już przyrostkiem .NNN (np. .001, .042)
    const match = trimmed.match(/^(.*?)\.(\d{3,})$/);
    let baseName = trimmed;
    let counter = 1;

    if (match) {
        baseName = match[1];
        counter = parseInt(match[2], 10) + 1;
    }

    while (true) {
        const suffix = String(counter).padStart(3, '0');
        const candidate = `${baseName}.${suffix}`;
        if (!namesSet.has(candidate)) {
            return candidate;
        }
        counter++;
    }
}

