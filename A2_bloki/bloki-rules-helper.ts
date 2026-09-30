/**
 * bloki-rules-helper.ts
 *
 * Czyste funkcje pobierania grubości formatek z reguł modułów Bloki (A2).
 * Zgodność z .agents/AGENTS.md:
 *  - Ścisły SSOT: brak sztywnych podmian 18 mm.
 *  - Zasada fail-fast: rzucenie błędu w przypadku braku definicji.
 */

import { rulesMToMm } from '../A1_core/cad-math/units.js';

/**
 * Przeszukuje reguły modułu JSON w poszukiwaniu grubości formatki w mm:
 * 1. parameters.defaults[defaultParamKey] (np. 'front_thickness', 'thickness', 'spacer_thickness')
 * 2. Przeszukanie model_tree w poszukiwaniu pasującego klucza/roli
 * 3. Jeśli nie znaleziono -> rzuca błąd (fail-fast)
 */
export function resolveRuleThicknessMm(
    rules: any,
    candidateKeys: string[] = [],
    defaultParamKey: string = 'thickness',
    moduleName: string = 'Bloki'
): number {
    if (!rules) {
        throw new Error(`[${moduleName}] Brak reguł JSON modułu do wyznaczenia grubości formatki.`);
    }

    // 1. Sprawdź parameters.defaults
    const defs = rules.parameters?.defaults;
    if (defs) {
        const val = defs[defaultParamKey] ?? defs.thickness ?? defs.front_thickness ?? defs.spacer_thickness;
        if (val !== undefined && val !== null) {
            const num = parseFloat(val);
            if (!isNaN(num)) return rulesMToMm(num);
        }
    }

    // 2. Przeszukaj model_tree
    if (rules.model_tree) {
        const upperCandidates = candidateKeys.map(k => k.toUpperCase());

        function searchComps(comps: Record<string, any>): number | undefined {
            for (const [key, comp] of Object.entries(comps)) {
                if (!comp) continue;
                const keyUpper = key.toUpperCase();
                const roleUpper = (comp.role || '').toUpperCase();
                const nameUpper = (comp.name || '').toUpperCase();

                const matches = upperCandidates.length === 0 || upperCandidates.some(c =>
                    c === keyUpper || c === roleUpper || c === nameUpper || keyUpper.includes(c)
                );

                if (matches && comp.thickness !== undefined && comp.thickness !== null) {
                    const num = parseFloat(comp.thickness);
                    if (!isNaN(num)) return rulesMToMm(num);
                }

                if (comp.subcomponents) {
                    const found = searchComps(comp.subcomponents);
                    if (found !== undefined) return found;
                }
            }
            return undefined;
        }

        for (const root of Object.values(rules.model_tree) as any[]) {
            if (root && root.subcomponents) {
                const found = searchComps(root.subcomponents);
                if (found !== undefined) return found;
            }
        }
    }

    throw new Error(
        `[${moduleName}] Brak zdefiniowanej grubości w regułach JSON (kandydaci: ${candidateKeys.join(', ') || defaultParamKey}). ` +
        `W CAD zabronione są sztywne podmiany 18 mm. Zdefiniuj grubość w regułach lub parametrach.`
    );
}
