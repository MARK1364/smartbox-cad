/**
 * cabinet-thickness.ts
 *
 * Czysta funkcja rozwiązywania grubości formatek korpusu.
 * Zgodność z .agents/AGENTS.md:
 *  - SSOT jednostek: grubości w mm na poziomie DTO / planu (mmToNm na brzegu domeny).
 *  - Ścisły SSOT: brak sztywnych, cichych podmian 18 mm / 3 mm.
 *  - Wartości grubości pochodzą wyłącznie z nadpisań parametrów, modeli sceny lub reguł JSON.
 */

import { nmToMm, rulesMToMm } from '../../A1_core/cad-math/units.js';

export function getRootSubcomponents(rules: any): Record<string, any> {
    if (!rules || !rules.model_tree) return {};
    const firstKey = Object.keys(rules.model_tree)[0];
    if (!firstKey) return {};
    return rules.model_tree[firstKey]?.subcomponents || {};
}

export interface CabinetThicknessLookupContext {
    rules?: any;
    baseRules?: any;
    thicknessOverrides?: Record<string, number>;
    targetContainer?: any;
    document?: any;
}

/**
 * Przeszukuje drzewo model_tree w regułach w poszukiwaniu definicji formatki
 * odpowiadającej zadanym kandydatom kluczy / ról i zwraca jej zdefiniowaną grubość w mm.
 */
function findThicknessInRules(rules: any, candidates: string[]): number | undefined {
    if (!rules || !rules.model_tree) return undefined;
    const upperCandidates = candidates.map(c => c.toUpperCase());

    function searchSubcomponents(comps: Record<string, any>): number | undefined {
        for (const [key, comp] of Object.entries(comps)) {
            if (!comp) continue;
            const subClean = key.includes('_') ? key.slice(key.indexOf('_') + 1) : key;
            const keyUpper = key.toUpperCase();
            const cleanUpper = subClean.toUpperCase();
            const roleUpper = (comp.role || '').toUpperCase();
            const nameUpper = (comp.name || '').toUpperCase();

            const matches = upperCandidates.some(c =>
                c === keyUpper || c === cleanUpper || c === roleUpper || c === nameUpper
            );

            if (matches && comp.thickness !== undefined && comp.thickness !== null) {
                const num = parseFloat(comp.thickness);
                if (!isNaN(num)) {
                    return rulesMToMm(num);
                }
            }

            if (comp.subcomponents) {
                const res = searchSubcomponents(comp.subcomponents);
                if (res !== undefined) return res;
            }
        }
        return undefined;
    }

    for (const root of Object.values(rules.model_tree) as any[]) {
        if (root && root.subcomponents) {
            const res = searchSubcomponents(root.subcomponents);
            if (res !== undefined) return res;
        }
    }
    return undefined;
}

/**
 * Rozwiązuje bazową grubość płyty korpusu z reguł (np. z elementu BOK_L lub LEFT_SIDE_PANEL).
 */
export function resolveCarcassBoardThicknessFromRules(rules: any): number | undefined {
    if (!rules) return undefined;
    // 1. Sprawdź czy reguły mają jawny default board_thickness
    const defBoardTh = rules.parameters?.defaults?.board_thickness;
    if (defBoardTh !== undefined && defBoardTh !== null) {
        const num = parseFloat(defBoardTh);
        if (!isNaN(num)) return rulesMToMm(num);
    }
    // 2. Pobierz z lewego lub prawego boku w model_tree
    const sideTh = findThicknessInRules(rules, ['LEFT_SIDE_PANEL', 'BOK_L', 'RIGHT_SIDE_PANEL', 'BOK_P']);
    if (sideTh !== undefined) return sideTh;
    return undefined;
}

/**
 * Rozwiązuje grubość formatki w mm:
 * 1. Z jawnej mapy nadpisań (thicknessOverrides)
 * 2. Z dzieci przekazanego kontenera (targetContainer.children)
 * 3. Z reguł JSON (rules / baseRules)
 * Zwraca undefined, jeśli formatka nie ma zdefiniowanej grubości (brak cichych fallbacków).
 */
export function resolveCabinetPartThickness(
    partKey: string,
    zonePrefix: string = '',
    ctx: CabinetThicknessLookupContext
): number | undefined {
    const cleanKey = partKey.replace(/^(B_|M_|T_)/i, '');
    const targetUpper = partKey.toUpperCase();
    const cleanUpper = cleanKey.toUpperCase();

    // 1. Jawne nadpisania grubości
    if (ctx.thicknessOverrides) {
        if (ctx.thicknessOverrides[partKey] !== undefined) return ctx.thicknessOverrides[partKey];
        if (ctx.thicknessOverrides[cleanKey] !== undefined) return ctx.thicknessOverrides[cleanKey];
        if (ctx.thicknessOverrides[targetUpper] !== undefined) return ctx.thicknessOverrides[targetUpper];
        if (ctx.thicknessOverrides[cleanUpper] !== undefined) return ctx.thicknessOverrides[cleanUpper];
    }

    // 2. Dzieci przekazanego kontenera (jeśli istnieje)
    let cntNode = ctx.targetContainer;
    if (cntNode && !cntNode.children && cntNode.id) {
        const doc = (typeof window !== 'undefined' ? (window as any).__cad_document : null) || ctx.document;
        if (doc && typeof doc.findNode === 'function') {
            cntNode = doc.findNode(cntNode.id);
        }
    }
    if (cntNode && cntNode.children) {
        const prefixedTarget = (zonePrefix && !targetUpper.startsWith(zonePrefix.toUpperCase()))
            ? (zonePrefix + partKey).toUpperCase()
            : targetUpper;

        const child = cntNode.children.find((c: any) => {
            const p = c.domainData || c;
            if (!p) return false;
            const pName = (p.name || '').toUpperCase();
            const pRole = (p.role || '').toUpperCase();
            const pKey = ((p as any).key || '').toUpperCase();
            const pZone = p.zonePrefix || '';

            if (zonePrefix && pZone && pZone !== zonePrefix) {
                return false;
            }

            return pKey === prefixedTarget || pName === prefixedTarget || pKey === targetUpper || pName === targetUpper ||
                   (pZone === zonePrefix && (pRole === targetUpper || pRole === cleanUpper));
        });

        if (child) {
            const p = child.domainData || child;
            if (p.custom_properties && p.custom_properties.thickness_mm !== undefined) {
                return p.custom_properties.thickness_mm;
            }
            if (p.custom_properties && p.custom_properties.thickness !== undefined) {
                return nmToMm(p.custom_properties.thickness);
            }
            if (p.thickness) {
                return nmToMm(p.thickness);
            }
        }
    }

    // 3. Reguły JSON (rules / baseRules)
    const candidateKeys = [partKey, cleanKey];
    if (zonePrefix) {
        candidateKeys.push(zonePrefix + cleanKey);
        candidateKeys.push(zonePrefix + partKey);
    }
    const fromRules = findThicknessInRules(ctx.rules, candidateKeys) ??
                      findThicknessInRules(ctx.baseRules, candidateKeys);
    if (fromRules !== undefined) {
        return fromRules;
    }

    return undefined;
}

/**
 * Wymaga wyznaczenia grubości formatki (SSOT lub bazowej płyty korpusu).
 * Rzuca błąd (fail-fast), jeśli w konfiguracji i regułach brakuje informacji o grubości.
 */
export function requireCabinetPartThickness(
    partKey: string,
    zonePrefix: string = '',
    ctx: CabinetThicknessLookupContext,
    candidateAliases: string[] = []
): number {
    const allKeys = [partKey, ...candidateAliases];
    for (const key of allKeys) {
        const th = resolveCabinetPartThickness(key, zonePrefix, ctx);
        if (th !== undefined) return th;
    }

    // Jeśli to formatka korpusu (nie plecy), sprawdź bazową grubość płyty korpusu z reguł
    const upper = partKey.toUpperCase();
    const isBack = upper.includes('PLECY') || upper.includes('BACK');
    if (!isBack) {
        const boardTh = resolveCarcassBoardThicknessFromRules(ctx.rules) ??
                        resolveCarcassBoardThicknessFromRules(ctx.baseRules);
        if (boardTh !== undefined) return boardTh;
    }

    throw new Error(
        `[cabinet-thickness] Brak zdefiniowanej grubości dla formatki "${partKey}" (strefa: "${zonePrefix}"). ` +
        `W CAD zabronione są sztywne podmiany. Upewnij się, że reguły JSON lub parametry korpusu definiują grubość.`
    );
}
