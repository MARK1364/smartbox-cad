/**
 * A5_smartparts / studio — smartpart-params.ts
 * Czysty rdzeń parametrów SmartParta (bez UI, bez Babylon, bez efektów ubocznych).
 *
 * Panel edycji w aplikacji = lista `parameters` z pakietu JSON.
 * Powiązania (`bindings`) wskazują, które pole (Part, Cut, MainContainer) czyta wartość parametru.
 *
 * Jednostki: mm. Błędne dane → czytelny wyjątek (fail-fast), bez cichych poprawek.
 */

import type {
    MainContainerDims,
    SmartPartBinding,
    SmartPartBindingField,
    SmartPartBodyItem,
    SmartPartCut,
    SmartPartPackageDefinition,
    SmartPartParameter,
    SmartPartTargetType,
    XRefWall,
} from './smartpart-studio-types.js';
import {
    computeAbsoluteFromReference,
    cutOrientFromRefs,
    partDimsAsMain,
} from './smartpart-studio-types.js';

export type SmartPartParamValues = Record<string, number | string | boolean>;

const NUMBER_FIELDS = new Set<SmartPartBindingField>([
    'offsetX_mm',
    'offsetY_mm',
    'offsetZ_mm',
    'widthMm',
    'heightMm',
    'depthMm',
    'diameterMm',
    'lengthMm',
]);

const CHECK_FIELDS = new Set<SmartPartBindingField>(['frozen']);

/** true / 1 / "true" — jak z UI lub JSON. */
export function isSmartPartCheckOn(raw: unknown): boolean {
    return raw === true || raw === 1 || raw === 'true';
}

/**
 * Tylko powiązania check → frozen (bez przeliczania geometrii).
 * Używane w Studio gdy pełny resolve rzuci, żeby zamrażanie i tak działało.
 */
export function applyFrozenBindings(
    def: SmartPartPackageDefinition,
    values: SmartPartParamValues = {},
): SmartPartPackageDefinition {
    const bindings = (def.bindings ?? []).filter((b) => b.field === 'frozen');
    if (bindings.length === 0) return def;

    const params = new Map((def.parameters ?? []).map((p) => [p.key, p] as const));
    const defaults = defaultSmartPartParamValues(def);
    const effective = (key: string) => (key in values ? values[key] : defaults[key]);

    const parts = (def.parts ?? []).map((part) => {
        const b = bindings.find((x) => {
            const t = resolveBindingTarget(x);
            return t.targetType === 'PART' && t.targetId === part.id;
        });
        if (!b) return part;
        const p = params.get(b.paramKey);
        if (!p || p.type !== 'check') return part;
        return { ...part, frozen: isSmartPartCheckOn(effective(b.paramKey)) };
    });

    const cuts = (def.cuts ?? []).map((cut) => {
        const b = bindings.find((x) => {
            const t = resolveBindingTarget(x);
            return t.targetType === 'CUT' && t.targetId === cut.id;
        });
        let next = cut;
        if (b) {
            const p = params.get(b.paramKey);
            if (p?.type === 'check') {
                next = { ...cut, frozen: isSmartPartCheckOn(effective(b.paramKey)) };
            }
        }
        const owner = parts.find((p) => p.id === next.partId)
            ?? (parts.length === 1 && !next.partId ? parts[0] : undefined);
        if (owner?.frozen === true && next.frozen !== true) {
            return { ...next, frozen: true };
        }
        return next;
    });

    const partBody = def.partBody
        ? parts.find((p) => p.id === def.partBody!.id) ?? def.partBody
        : def.partBody;
    return { ...def, parts, cuts, partBody };
}

/** Wartości domyślne wszystkich parametrów pakietu. */
export function defaultSmartPartParamValues(def: Pick<SmartPartPackageDefinition, 'parameters'>): SmartPartParamValues {
    const out: SmartPartParamValues = {};
    for (const p of def.parameters ?? []) {
        if (p.type === 'number') out[p.key] = p.default_mm;
        else if (p.type === 'check') out[p.key] = p.default === true;
        else out[p.key] = p.default;
    }
    return out;
}

/** Pomocnicze odczytanie typu i id celu z powiązania. */
export function resolveBindingTarget(b: SmartPartBinding): { targetType: SmartPartTargetType; targetId: string } {
    const targetType = b.targetType || (b.partId ? 'PART' : (b.targetId === 'main_container' ? 'MAIN' : 'PART'));
    const targetId = b.targetId || b.partId || 'main_container';
    return { targetType, targetId };
}

/**
 * Walidacja kontraktu parametrów i powiązań. Rzuca Error z opisem pierwszego problemu.
 * Pakiet bez `parameters` i `bindings` jest zawsze poprawny.
 */
export function assertValidSmartPartParams(def: SmartPartPackageDefinition): void {
    const params = def.parameters ?? [];
    const bindings = def.bindings ?? [];
    const keys = new Set<string>();

    for (const p of params) {
        if (!p.key) throw new Error('SmartPart: parametr bez klucza');
        if (keys.has(p.key)) throw new Error(`SmartPart: zduplikowany parametr "${p.key}"`);
        keys.add(p.key);
        if (p.type === 'list') {
            if (!Array.isArray(p.options) || p.options.length === 0) {
                throw new Error(`SmartPart: lista "${p.key}" nie ma opcji`);
            }
            if (!p.options.some((o) => o.key === p.default)) {
                throw new Error(`SmartPart: domyślna wartość listy "${p.key}" nie istnieje w opcjach`);
            }
        } else if (p.type === 'number') {
            if (p.min_mm !== undefined && p.max_mm !== undefined && p.min_mm > p.max_mm) {
                throw new Error(`SmartPart: parametr "${p.key}" ma min_mm > max_mm`);
            }
        } else if (p.type === 'check') {
            if (typeof (p as any).default !== 'boolean') {
                throw new Error(`SmartPart: check "${(p as any).key}" wymaga default boolean`);
            }
        } else {
            throw new Error(`SmartPart: nieznany typ parametru "${(p as any).key}"`);
        }
    }

    const partIds = new Set((def.parts ?? []).map((x) => x.id));
    const cutIds = new Set((def.cuts ?? []).map((c) => c.id));

    for (const b of bindings) {
        const p = params.find((x) => x.key === b.paramKey);
        if (!p) throw new Error(`SmartPart: powiązanie wskazuje nieznany parametr "${b.paramKey}"`);
        const { targetType, targetId } = resolveBindingTarget(b);

        if (targetType === 'MAIN') {
            // Kontener główny
        } else if (targetType === 'CUT') {
            if (!cutIds.has(targetId)) throw new Error(`SmartPart: powiązanie wskazuje nieznane cięcie "${targetId}"`);
        } else {
            if (!partIds.has(targetId)) throw new Error(`SmartPart: powiązanie wskazuje nieznany part "${targetId}"`);
        }

        if (b.field === 'glbPath') {
            if (p.type !== 'list') throw new Error(`SmartPart: pole glbPath wymaga parametru typu list ("${b.paramKey}")`);
        } else if (CHECK_FIELDS.has(b.field)) {
            if (p.type !== 'check') throw new Error(`SmartPart: pole ${b.field} wymaga parametru typu check ("${b.paramKey}")`);
            if (targetType === 'MAIN') throw new Error(`SmartPart: frozen nie dotyczy Kontenera głównego`);
        } else if (NUMBER_FIELDS.has(b.field)) {
            if (p.type !== 'number') throw new Error(`SmartPart: pole ${b.field} wymaga parametru typu number ("${b.paramKey}")`);
        } else {
            throw new Error(`SmartPart: nieznane pole powiązania "${(b as SmartPartBinding).field}"`);
        }
    }
}

function clampNumber(p: Extract<SmartPartParameter, { type: 'number' }>, v: number): number {
    let x = Number.isFinite(v) ? v : p.default_mm;
    if (p.min_mm !== undefined) x = Math.max(p.min_mm, x);
    if (p.max_mm !== undefined) x = Math.min(p.max_mm, x);
    return x;
}

/** Pobiera aktualną wartość pola z geometrii (do synchronizacji domyślnych wartości). */
function getTargetFieldValue(def: SmartPartPackageDefinition, b: SmartPartBinding): number | undefined {
    const { targetType, targetId } = resolveBindingTarget(b);
    if (targetType === 'MAIN') {
        return Number((def.mainContainer as any)[b.field]);
    }
    if (targetType === 'CUT') {
        const cut = (def.cuts ?? []).find((c) => c.id === targetId);
        return cut ? Number((cut as any)[b.field]) : undefined;
    }
    const part = (def.parts ?? []).find((p) => p.id === targetId);
    return part ? Number((part as any)[b.field]) : undefined;
}

/**
 * Ujednolicenie defaultów parametrów z aktualną geometrią partów/cięć/kontenera (bindings).
 * Zapobiega sytuacji rozjazdu wizualnego i cięć formatki.
 */
export function syncParameterDefaultsFromBindings(
    def: SmartPartPackageDefinition,
): SmartPartPackageDefinition {
    const bindings = def.bindings ?? [];
    const parameters = def.parameters ?? [];
    if (bindings.length === 0 || parameters.length === 0) return def;

    let changed = false;
    const nextParams = parameters.map((p) => {
        if (p.type !== 'number') return p;
        const b = bindings.find((x) => x.paramKey === p.key && NUMBER_FIELDS.has(x.field));
        if (!b) return p;
        const geo = getTargetFieldValue(def, b);
        if (geo === undefined || !Number.isFinite(geo)) return p;
        if (p.default_mm === geo) return p;
        changed = true;
        return { ...p, default_mm: geo };
    });
    return changed ? { ...def, parameters: nextParams } : def;
}

/** Wartości startowe: najpierw default parametru, potem nadpisanie z geometrii (binding). */
export function initialSmartPartParamValues(def: SmartPartPackageDefinition): SmartPartParamValues {
    const synced = syncParameterDefaultsFromBindings(def);
    const out = defaultSmartPartParamValues(synced);
    for (const b of synced.bindings ?? []) {
        if (!NUMBER_FIELDS.has(b.field)) continue;
        const geo = getTargetFieldValue(synced, b);
        if (geo !== undefined && Number.isFinite(geo)) out[b.paramKey] = geo;
    }
    return out;
}

/**
 * Zwraca NOWY pakiet z wartościami parametrów wstawionymi do kontenera, partów i cięć
 * oraz przeliczonymi pozycjami bezwzględnymi. Wejście nie jest mutowane.
 */
export function resolveSmartPartParams(
    def: SmartPartPackageDefinition,
    values: SmartPartParamValues = {},
): SmartPartPackageDefinition {
    const bindings = def.bindings ?? [];
    if (bindings.length === 0) return def;

    assertValidSmartPartParams(def);

    const params = new Map((def.parameters ?? []).map((p) => [p.key, p] as const));
    const defaults = defaultSmartPartParamValues(def);
    const effective = (key: string): number | string | boolean =>
        (key in values ? values[key] : defaults[key]);

    // 1. Kontener Główny
    let mainContainer = { ...def.mainContainer };
    const mainBindings = bindings.filter((b) => resolveBindingTarget(b).targetType === 'MAIN');
    for (const b of mainBindings) {
        const p = params.get(b.paramKey)!;
        if (p.type === 'number') {
            const v = clampNumber(p, Number(effective(b.paramKey)));
            (mainContainer as any)[b.field] = v;
        }
    }

    // 2. Partsy
    const parts: SmartPartBodyItem[] = (def.parts ?? []).map((part) => {
        const mine = bindings.filter((b) => {
            const { targetType, targetId } = resolveBindingTarget(b);
            return targetType === 'PART' && targetId === part.id;
        });
        if (mine.length === 0) return part;

        const next: SmartPartBodyItem = { ...part };
        for (const b of mine) {
            const p = params.get(b.paramKey)!;
            const raw = effective(b.paramKey);
            if (b.field === 'glbPath' && p.type === 'list') {
                const opt = p.options.find((o) => o.key === String(raw));
                if (!opt) throw new Error(`SmartPart: nieznana opcja "${String(raw)}" listy "${p.key}"`);
                next.glbPath = opt.glbPath;
            } else if (b.field === 'frozen' && p.type === 'check') {
                next.frozen = isSmartPartCheckOn(raw);
            } else if (p.type === 'number') {
                const v = clampNumber(p, Number(raw));
                (next as any)[b.field] = v;
            }
        }

        if (mine.some((b) => b.field === 'heightMm')) {
            next.heightMm = Math.min(next.heightMm, mainContainer.heightMm);
        }

        if (mine.some((b) => b.field === 'heightMm') && !mine.some((b) => b.field === 'offsetZ_mm')) {
            if (next.refZ === 'BOTTOM' || next.refZ === 'TOP') {
                next.offsetZ_mm = next.heightMm / 2;
            }
        }

        const abs = computeAbsoluteFromReference(
            mainContainer,
            next.refX,
            next.offsetX_mm ?? 0,
            next.refY,
            next.offsetY_mm ?? 0,
            next.refZ,
            next.offsetZ_mm ?? 0,
        );
        next.xMm = abs.xMm;
        next.yMm = abs.yMm;
        next.zMm = abs.zMm;
        return next;
    });

    // 3. Cięcia (HOLE / POCKET) w LCS parta
    const cuts: SmartPartCut[] = (def.cuts ?? []).map((cut) => {
        const mine = bindings.filter((b) => {
            const { targetType, targetId } = resolveBindingTarget(b);
            return targetType === 'CUT' && targetId === cut.id;
        });
        const ownerPart = parts.find((p) => p.id === cut.partId)
            ?? (parts.length === 1 && !cut.partId ? parts[0] : undefined);

        if (mine.length === 0) {
            // Zamrożony Part → wycięcia też zamrożone (Studio / CNC)
            return ownerPart?.frozen === true ? { ...cut, frozen: true } : cut;
        }

        const next: SmartPartCut = { ...cut };
        for (const b of mine) {
            const p = params.get(b.paramKey)!;
            const raw = effective(b.paramKey);
            if (b.field === 'frozen' && p.type === 'check') {
                next.frozen = isSmartPartCheckOn(raw);
            } else if (p.type === 'number') {
                const v = clampNumber(p, Number(raw));
                (next as any)[b.field] = v;
            }
        }

        if (ownerPart?.frozen === true) {
            next.frozen = true;
        }

        // Przeliczenie pozycji w LCS Parta
        const parentPart = ownerPart ?? parts[0];
        const partContainer = partDimsAsMain(parentPart || { widthMm: 100, heightMm: 100, depthMm: 100 });
        const abs = computeAbsoluteFromReference(
            partContainer,
            next.refX || 'CENTER',
            next.offsetX_mm ?? 0,
            next.refY || 'CENTER',
            next.offsetY_mm ?? 0,
            next.refZ || 'CENTER',
            next.offsetZ_mm ?? 0,
        );
        next.xMm = abs.xMm;
        next.yMm = abs.yMm;
        next.zMm = abs.zMm;
        return next;
    });

    const partBody = def.partBody ? parts.find((p) => p.id === def.partBody!.id) ?? def.partBody : def.partBody;
    return { ...def, mainContainer, parts, cuts, partBody };
}

/** Znajdź powiązanie dowolnego celu (PART / CUT / MAIN). */
export function getBinding(
    def: Pick<SmartPartPackageDefinition, 'bindings'>,
    targetType: SmartPartTargetType,
    targetId: string,
    field: SmartPartBindingField,
): SmartPartBinding | undefined {
    return (def.bindings ?? []).find((b) => {
        const resolved = resolveBindingTarget(b);
        return resolved.targetType === targetType && resolved.targetId === targetId && b.field === field;
    });
}

/** Znajdź powiązanie pola parta (skrót dla PART). */
export function getPartFieldBinding(
    def: Pick<SmartPartPackageDefinition, 'bindings'>,
    partId: string,
    field: SmartPartBindingField,
): SmartPartBinding | undefined {
    return getBinding(def, 'PART', partId, field);
}

/** Klucz parametru z etykiety (snake_case + _mm dla liczb). */
export function makeNumberParamKey(label: string): string {
    const base = String(label || 'param')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || 'param';
    return base.endsWith('_mm') ? base : `${base}_mm`;
}

/** Ustaw / zamień powiązanie dowolnego elementu z parametrem. */
export function upsertBinding(
    def: SmartPartPackageDefinition,
    target: { targetType?: SmartPartTargetType; targetId?: string; partId?: string; field: SmartPartBindingField },
    paramKey: string,
): SmartPartPackageDefinition {
    const targetType = target.targetType || (target.partId ? 'PART' : 'MAIN');
    const targetId = target.targetId || target.partId || 'main_container';
    const bindings = (def.bindings ?? []).filter((b) => {
        const resolved = resolveBindingTarget(b);
        return !(resolved.targetType === targetType && resolved.targetId === targetId && b.field === target.field);
    });
    bindings.push({
        paramKey,
        targetType,
        targetId,
        field: target.field,
        partId: targetType === 'PART' ? targetId : undefined,
    });
    return { ...def, bindings };
}

/** Ustaw / zamień powiązanie pola parta z parametrem. */
export function upsertPartFieldBinding(
    def: SmartPartPackageDefinition,
    partId: string,
    field: SmartPartBindingField,
    paramKey: string,
): SmartPartPackageDefinition {
    return upsertBinding(def, { targetType: 'PART', targetId: partId, partId, field }, paramKey);
}

/** Usuń powiązanie dowolnego elementu. */
export function removeBinding(
    def: SmartPartPackageDefinition,
    targetType: SmartPartTargetType,
    targetId: string,
    field: SmartPartBindingField,
): SmartPartPackageDefinition {
    const bindings = (def.bindings ?? []).filter((b) => {
        const resolved = resolveBindingTarget(b);
        return !(resolved.targetType === targetType && resolved.targetId === targetId && b.field === field);
    });
    return { ...def, bindings: bindings.length > 0 ? bindings : undefined };
}

/** Usuń powiązanie pola parta. */
export function removePartFieldBinding(
    def: SmartPartPackageDefinition,
    partId: string,
    field: SmartPartBindingField,
): SmartPartPackageDefinition {
    return removeBinding(def, 'PART', partId, field);
}

/** Dodaj parametr liczbowy (mm) — unikalny klucz. */
export function addNumberParameter(
    def: SmartPartPackageDefinition,
    opts: { key?: string; label: string; default_mm: number; min_mm?: number; max_mm?: number },
): SmartPartPackageDefinition {
    const existing = new Set((def.parameters ?? []).map((p) => p.key));
    let key = opts.key || makeNumberParamKey(opts.label);
    if (existing.has(key)) {
        let i = 2;
        while (existing.has(`${key}_${i}`)) i += 1;
        key = `${key}_${i}`;
    }
    const param: SmartPartParameter = {
        key,
        type: 'number',
        label: opts.label,
        default_mm: opts.default_mm,
        min_mm: opts.min_mm ?? 0,
        max_mm: opts.max_mm ?? 300,
    };
    return { ...def, parameters: [...(def.parameters ?? []), param] };
}

/** Klucz parametru check (snake_case, bez _mm). */
export function makeCheckParamKey(label: string): string {
    const base = String(label || 'check')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || 'check';
    return base.replace(/_mm$/, '') || 'check';
}

/** Dodaj parametr check (boolean) — np. zamrożenie Part/wycięcia. */
export function addCheckParameter(
    def: SmartPartPackageDefinition,
    opts: { key?: string; label: string; default?: boolean },
): SmartPartPackageDefinition {
    const existing = new Set((def.parameters ?? []).map((p) => p.key));
    let key = opts.key || makeCheckParamKey(opts.label);
    if (existing.has(key)) {
        let i = 2;
        while (existing.has(`${key}_${i}`)) i += 1;
        key = `${key}_${i}`;
    }
    const param: SmartPartParameter = {
        key,
        type: 'check',
        label: opts.label,
        default: opts.default === true,
    };
    return { ...def, parameters: [...(def.parameters ?? []), param] };
}

/** Dodaj parametr listy (np. typ modelu / GLB). */
export function addListParameter(
    def: SmartPartPackageDefinition,
    opts: {
        key?: string;
        label: string;
        default?: string;
        options?: { key: string; label?: string; glbPath: string }[];
    },
): SmartPartPackageDefinition {
    const existing = new Set((def.parameters ?? []).map((p) => p.key));
    let key = opts.key || makeNumberParamKey(opts.label).replace(/_mm$/, '');
    if (existing.has(key)) {
        let i = 2;
        while (existing.has(`${key}_${i}`)) i += 1;
        key = `${key}_${i}`;
    }
    const options = opts.options?.length
        ? opts.options
        : [
            { key: 'opcja_a', label: 'Opcja A', glbPath: '' },
            { key: 'opcja_b', label: 'Opcja B', glbPath: '' },
        ];
    const param: SmartPartParameter = {
        key,
        type: 'list',
        label: opts.label,
        default: opts.default || options[0].key,
        options,
    };
    return { ...def, parameters: [...(def.parameters ?? []), param] };
}

/** Zmiana kolejności parametrów (formularz UI). */
export function reorderParameters(
    def: SmartPartPackageDefinition,
    fromIndex: number,
    toIndex: number,
): SmartPartPackageDefinition {
    const list = [...(def.parameters ?? [])];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) return def;
    const [item] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
    return { ...def, parameters: list };
}

/** Usuń parametr i wszystkie jego powiązania. */
export function removeParameter(def: SmartPartPackageDefinition, paramKey: string): SmartPartPackageDefinition {
    const parameters = (def.parameters ?? []).filter((p) => p.key !== paramKey);
    const bindings = (def.bindings ?? []).filter((b) => b.paramKey !== paramKey);
    return {
        ...def,
        parameters: parameters.length > 0 ? parameters : undefined,
        bindings: bindings.length > 0 ? bindings : undefined,
    };
}

/**
 * Odwraca (lustrzanie / flip) położenie i orientację cięcia (HOLE / POCKET) względem zadanej osi CAD.
 * Jeśli odniesienie do ściany jest ustawione (np. LEFT <-> RIGHT, FRONT <-> BACK, BOTTOM <-> TOP),
 * zamienia ścianę referencyjną z zachowaniem offsetu od przeciwległej ściany.
 * Jeśli odniesieniem jest CENTER, inwertuje znak offsetu (lub xMm/yMm/zMm).
 * Dla osi cięcia odwraca również kierunek (direction).
 */
export function flipSmartPartCut<T extends SmartPartCut>(
    cut: T,
    axis: 'X' | 'Y' | 'Z',
    partDims: { widthMm: number; heightMm: number; depthMm: number }
): T {
    const cloned = { ...cut };
    let refX = cloned.refX || 'CENTER';
    let refY = cloned.refY || 'CENTER';
    let refZ = cloned.refZ || 'CENTER';
    let offX = cloned.offsetX_mm ?? cloned.xMm;
    let offY = cloned.offsetY_mm ?? cloned.yMm;
    let offZ = cloned.offsetZ_mm ?? cloned.zMm;

    if (axis === 'X') {
        if (refX === 'LEFT') {
            refX = 'RIGHT';
        } else if (refX === 'RIGHT') {
            refX = 'LEFT';
        } else {
            offX = -offX;
        }
    } else if (axis === 'Y') {
        if (refY === 'FRONT') {
            refY = 'BACK';
        } else if (refY === 'BACK') {
            refY = 'FRONT';
        } else {
            offY = -offY;
        }
    } else if (axis === 'Z') {
        if (refZ === 'BOTTOM') {
            refZ = 'TOP';
        } else if (refZ === 'TOP') {
            refZ = 'BOTTOM';
        } else {
            offZ = -offZ;
        }
    }

    const abs = computeAbsoluteFromReference(partDims, refX, offX, refY, offY, refZ, offZ);
    cloned.refX = refX;
    cloned.refY = refY;
    cloned.refZ = refZ;
    cloned.offsetX_mm = offX;
    cloned.offsetY_mm = offY;
    cloned.offsetZ_mm = offZ;
    cloned.xMm = abs.xMm;
    cloned.yMm = abs.yMm;
    cloned.zMm = abs.zMm;

    // Przeliczenie orientacji
    let orient = cutOrientFromRefs(cloned);
    if (orient.axis === axis) {
        // Jeśli cięcie było wiercone/wypuszczane wzdłuż tej samej osi, odwróć kierunek wysuwu
        orient = { axis: orient.axis, direction: (orient.direction === 1 ? -1 : 1) as 1 | -1 };
    }
    cloned.axis = orient.axis;
    cloned.direction = orient.direction;

    return cloned;
}

/**
 * Zamienia oznaczenie strony w nazwie (Lewy <-> Prawy, (L) <-> (P)).
 */
export function mirrorName(name: string): string {
    if (name.includes('(L)')) return name.replace('(L)', '(P)');
    if (name.includes('(P)')) return name.replace('(P)', '(L)');
    if (/lew([yae])/i.test(name)) {
        return name.replace(/lew([yae])/gi, (m, ending) => {
            const isUpper = m[0] === 'L';
            return (isUpper ? 'Praw' : 'praw') + ending;
        });
    }
    if (/praw([yae])/i.test(name)) {
        return name.replace(/praw([yae])/gi, (m, ending) => {
            const isUpper = m[0] === 'P';
            return (isUpper ? 'Lew' : 'lew') + ending;
        });
    }
    return `${name} (P)`;
}

/**
 * Duplikuje Part z symetrycznym odbiciem w osi X korpusu (Lewy <-> Prawy)
 * wraz ze wszystkimi jego otworami i wycięciami (odwrócony zwrot wiercenia w boki).
 */
export function mirrorClonePart(
    part: SmartPartBodyItem,
    mainContainer: MainContainerDims,
    cuts: SmartPartCut[],
    newPartId: string,
    allocCutId: (index: number) => string
): { mirroredPart: SmartPartBodyItem; mirroredCuts: SmartPartCut[] } {
    let refX: XRefWall = part.refX || 'CENTER';
    let offX = part.offsetX_mm ?? part.xMm;
    if (refX === 'LEFT') {
        refX = 'RIGHT';
    } else if (refX === 'RIGHT') {
        refX = 'LEFT';
    } else {
        offX = -offX;
    }

    const abs = computeAbsoluteFromReference(
        mainContainer,
        refX,
        offX,
        part.refY || 'CENTER',
        part.offsetY_mm ?? part.yMm,
        part.refZ || 'CENTER',
        part.offsetZ_mm ?? part.zMm
    );

    const mirroredPart: SmartPartBodyItem = {
        ...part,
        id: newPartId,
        name: mirrorName(part.name || 'Part'),
        refX,
        offsetX_mm: offX,
        xMm: abs.xMm,
        yMm: abs.yMm,
        zMm: abs.zMm,
        mirroredFrom: part.id,
        mirrorAxis: 'X',
    };

    const partDims = {
        widthMm: mirroredPart.widthMm,
        heightMm: mirroredPart.heightMm,
        depthMm: mirroredPart.depthMm,
    };

    const mirroredCuts = cuts
        .filter((c) => c.partId === part.id)
        .map((c, idx) => {
            const flipped = flipSmartPartCut(c, 'X', partDims);
            return {
                ...flipped,
                id: allocCutId(idx),
                partId: newPartId,
                name: mirrorName(c.name || 'Cut'),
                mirroredFrom: c.id,
                mirrorAxis: 'X',
            } as SmartPartCut;
        });

    return { mirroredPart, mirroredCuts };
}

/**
 * Automatyczna synchronizacja asocjacyjnych bliźniaków lustrzanych (SSOT).
 * Wszystkie części i wycięcia z `mirroredFrom` aktualizują swoje wymiary, położenie i otwory
 * zgodnie ze stanem części źródłowej.
 */
export function syncAssociativeMirrors(def: SmartPartPackageDefinition): SmartPartPackageDefinition {
    if (!def.parts || def.parts.length === 0) return def;

    const hasMirrored = def.parts.some((p) => !!p.mirroredFrom) || def.cuts.some((c) => !!c.mirroredFrom);
    if (!hasMirrored) return def;

    const updatedParts = def.parts.map((part) => {
        if (!part.mirroredFrom) return part;
        const sourcePart = def.parts.find((p) => p.id === part.mirroredFrom);
        if (!sourcePart) {
            const detached = { ...part };
            delete detached.mirroredFrom;
            delete detached.mirrorAxis;
            return detached;
        }

        const axis = part.mirrorAxis || 'X';
        let refX: XRefWall = sourcePart.refX || 'CENTER';
        let offX = sourcePart.offsetX_mm ?? sourcePart.xMm;

        if (axis === 'X') {
            if (refX === 'LEFT') refX = 'RIGHT';
            else if (refX === 'RIGHT') refX = 'LEFT';
            else offX = -offX;
        }

        let refY = sourcePart.refY || 'CENTER';
        let offY = sourcePart.offsetY_mm ?? sourcePart.yMm;
        if (axis === 'Y') {
            if (refY === 'FRONT') refY = 'BACK';
            else if (refY === 'BACK') refY = 'FRONT';
            else offY = -offY;
        }

        let refZ = sourcePart.refZ || 'CENTER';
        let offZ = sourcePart.offsetZ_mm ?? sourcePart.zMm;
        if (axis === 'Z') {
            if (refZ === 'BOTTOM') refZ = 'TOP';
            else if (refZ === 'TOP') refZ = 'BOTTOM';
            else offZ = -offZ;
        }

        const abs = computeAbsoluteFromReference(
            def.mainContainer,
            refX,
            offX,
            refY,
            offY,
            refZ,
            offZ
        );

        return {
            ...part,
            widthMm: sourcePart.widthMm,
            heightMm: sourcePart.heightMm,
            depthMm: sourcePart.depthMm,
            colorHex: sourcePart.colorHex,
            glbPath: sourcePart.glbPath,
            frozen: sourcePart.frozen,
            refX,
            offsetX_mm: offX,
            refY,
            offsetY_mm: offY,
            refZ,
            offsetZ_mm: offZ,
            xMm: abs.xMm,
            yMm: abs.yMm,
            zMm: abs.zMm,
        };
    });

    // 1. Zbieramy cięcia niezależne (niebędące asocjacyjnymi klonami z mirroredFrom)
    const independentCuts = def.cuts.filter((c) => {
        const parentPart = updatedParts.find((p) => p.id === c.partId);
        return !parentPart?.mirroredFrom && !c.mirroredFrom;
    });

    const newMirroredCuts: SmartPartCut[] = [];

    updatedParts.forEach((mirroredPart) => {
        if (!mirroredPart.mirroredFrom) return;
        const sourcePart = updatedParts.find((p) => p.id === mirroredPart.mirroredFrom);
        if (!sourcePart) return;

        const axis = mirroredPart.mirrorAxis || 'X';
        const sourceCuts = independentCuts.filter((c) => c.partId === sourcePart.id);
        const existingForThis = def.cuts.filter((c) => c.partId === mirroredPart.id);

        const partDims = {
            widthMm: mirroredPart.widthMm,
            heightMm: mirroredPart.heightMm,
            depthMm: mirroredPart.depthMm,
        };

        sourceCuts.forEach((sCut, idx) => {
            const existing = existingForThis.find((c) => c.mirroredFrom === sCut.id);
            const cutId = existing ? existing.id : `cut_${mirroredPart.id}_${sCut.id || idx}`;
            const flipped = flipSmartPartCut(sCut, axis, partDims);
            newMirroredCuts.push({
                ...flipped,
                id: cutId,
                partId: mirroredPart.id,
                mirroredFrom: sCut.id,
                mirrorAxis: axis,
                name: mirrorName(sCut.name || 'Cut'),
            } as SmartPartCut);
        });
    });

    // 2. Standalone mirrored cuts (samodzielne wycięcie odbite na tym samym module)
    const standaloneMirroredCuts = def.cuts
        .filter((c) => {
            const parentPart = updatedParts.find((p) => p.id === c.partId);
            return !parentPart?.mirroredFrom && !!c.mirroredFrom;
        })
        .map((c) => {
            const sourceCut = independentCuts.find((sc) => sc.id === c.mirroredFrom);
            if (!sourceCut) {
                const detached = { ...c };
                delete detached.mirroredFrom;
                delete detached.mirrorAxis;
                return detached;
            }
            const parentPart = updatedParts.find((p) => p.id === c.partId);
            const partDims = parentPart
                ? { widthMm: parentPart.widthMm, heightMm: parentPart.heightMm, depthMm: parentPart.depthMm }
                : def.mainContainer;
            const axis = c.mirrorAxis || 'X';
            const flipped = flipSmartPartCut(sourceCut, axis, partDims);
            return {
                ...flipped,
                id: c.id,
                partId: c.partId,
                mirroredFrom: c.mirroredFrom,
                mirrorAxis: axis,
                name: c.name || mirrorName(sourceCut.name || 'Cut'),
            } as SmartPartCut;
        });

    return {
        ...def,
        parts: updatedParts,
        cuts: [...independentCuts, ...standaloneMirroredCuts, ...newMirroredCuts],
    };
}

/**
 * Odłącza asocjacyjność wybranego Parta, przekształcając go w niezależną kopię.
 */
export function detachMirror(def: SmartPartPackageDefinition, partId: string): SmartPartPackageDefinition {
    const updatedParts = def.parts.map((p) => {
        if (p.id !== partId) return p;
        const copy = { ...p };
        delete copy.mirroredFrom;
        delete copy.mirrorAxis;
        return copy;
    });
    const updatedCuts = def.cuts.map((c) => {
        if (c.partId !== partId) return c;
        const copy = { ...c };
        delete copy.mirroredFrom;
        delete copy.mirrorAxis;
        return copy;
    });
    return {
        ...def,
        parts: updatedParts,
        cuts: updatedCuts,
    };
}

/**
 * Odłącza asocjacyjność wybranego wycięcia.
 */
export function detachCutMirror(def: SmartPartPackageDefinition, cutId: string): SmartPartPackageDefinition {
    const updatedCuts = def.cuts.map((c) => {
        if (c.id !== cutId) return c;
        const copy = { ...c };
        delete copy.mirroredFrom;
        delete copy.mirrorAxis;
        return copy;
    });
    return {
        ...def,
        cuts: updatedCuts,
    };
}

/**
 * Duplikuje pojedyncze wycięcie z odbiciem w osi X.
 */
export function mirrorCloneCut(
    cut: SmartPartCut,
    partDims: { widthMm: number; heightMm: number; depthMm: number },
    newCutId: string
): SmartPartCut {
    const flipped = flipSmartPartCut(cut, 'X', partDims);
    return {
        ...flipped,
        id: newCutId,
        name: mirrorName(cut.name || 'Cut'),
        mirroredFrom: cut.id,
        mirrorAxis: 'X',
    } as SmartPartCut;
    return {
        ...flipped,
        id: newCutId,
        name: mirrorName(cut.name || 'Cut'),
    } as SmartPartCut;
}

/**
 * Duplikuje wszystkie części i otwory w pakiecie z odbiciem w osi X (tworzy kompletną parę L+P).
 */
export function mirrorCloneAllParts(
    def: SmartPartPackageDefinition,
    allocBodyId: (index: number) => string,
    allocCutId: (partIdx: number, cutIdx: number) => string
): { newParts: SmartPartBodyItem[]; newCuts: SmartPartCut[] } {
    const newParts: SmartPartBodyItem[] = [];
    const newCuts: SmartPartCut[] = [];

    def.parts.forEach((p, pIdx) => {
        const newPartId = allocBodyId(pIdx);
        const res = mirrorClonePart(
            p,
            def.mainContainer,
            def.cuts,
            newPartId,
            (cIdx) => allocCutId(pIdx, cIdx)
        );
        newParts.push(res.mirroredPart);
        newCuts.push(...res.mirroredCuts);
    });

    return { newParts, newCuts };
}
