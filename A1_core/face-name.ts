/**
 * Kanoniczne nazwy ścian LCS formatki — warstwa rdzenia.
 * Zero aliasów (`front`, `+Z`, …); mapowanie aliasów należy do UI przed wejściem tutaj.
 */

export type FaceName =
    | 'FACE_X_PLUS'
    | 'FACE_X_MINUS'
    | 'FACE_Y_PLUS'
    | 'FACE_Y_MINUS'
    | 'FACE_Z_PLUS'
    | 'FACE_Z_MINUS';

export const FACE_NAMES: FaceName[] = [
    'FACE_X_PLUS',
    'FACE_X_MINUS',
    'FACE_Y_PLUS',
    'FACE_Y_MINUS',
    'FACE_Z_PLUS',
    'FACE_Z_MINUS',
];

export function normalizeFaceName(name: string): FaceName {
    if (!name) throw new Error('Brak nazwy ściany. Użyj jednej z: ' + FACE_NAMES.join(', '));
    const key = name.trim().toUpperCase();
    const matched = FACE_NAMES.find((f) => f === key);
    if (!matched) {
        throw new Error(
            `Niekanoniczna nazwa ściany: "${name}". Dozwolone: ${FACE_NAMES.join(', ')}. ` +
                `Zero kompatybilności wstecznej — porada: .agents/AGENTS.md`
        );
    }
    return matched;
}
