/**
 * Wysokość H w sekcji odniesień — aktywna tylko gdy brak jednej ze ścian góra/dół.
 */

export const HEIGHT_H_LOCKED_HINT =
    'Usuń odniesienie góra lub dół, aby edytować wysokość H';

/** Oba lica góra+dół mają odniesienie i żadne nie jest wyłączone → H wynika z odniesień. */
export function isBlokiHeightHLocked(
    customRefs: Record<string, any> | null | undefined,
    disabledRefs: Record<string, any> | null | undefined
): boolean {
    const bottomOn = !!customRefs?.zMin && !disabledRefs?.zMin;
    const topOn = !!customRefs?.zMax && !disabledRefs?.zMax;
    return bottomOn && topOn;
}
