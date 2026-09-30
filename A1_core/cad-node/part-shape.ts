/**
 * SmartPanel Web — CADNode: Part Shape
 *
 * SSOT rozpoznawania bryły elementu (płyta / walec).
 *
 * Zgodnie z .agents/AGENTS.md: logika NIGDY nie czyta `name`.
 * Klasyfikacja opiera się WYŁĄCZNIE na:
 *   - `role`      — kod klasyfikacji (TUBE_ROD, HOLDER, …),
 *   - flaga `custom_properties.shape` — jawna deklaracja bryły z reguł JSON.
 *
 * Nowy moduł dodaje swoją rolę do CYLINDRICAL_ROLES — nie do heurystyki nazw.
 * Zero zależności od Babylon.js i DOM.
 */

import type { NodeType } from './node-type.js';

/** Jawna flaga bryły z `custom_properties.shape` (katalogi reguł). */
export const CYLINDER_SHAPE = 'CYLINDER';

/** Role domenowe, których bryłą jest walec. */
const CYLINDRICAL_ROLES: ReadonlySet<string> = new Set(['TUBE_ROD', 'HOLDER']);

/**
 * Rodziny ról walcowych — dopasowanie po prefiksie kodu roli (TUBE_ROD_LEFT, HOLDER_FRONT).
 * To nadal klasyfikacja po `role`, nie po `name`.
 */
const CYLINDRICAL_ROLE_PREFIXES: readonly string[] = ['TUBE', 'HOLDER'];

/** Kod roli drążka — jedyny wydłużony walec (uchwyty/rozety są krótkie). */
const TUBE_ROD_ROLE = 'TUBE_ROD';

/** Kod typu okucia dla rur walcowych (BlokiHardware.hardwareType). */
const TUBE_HARDWARE_TYPE = 'TUBE';

export interface PartShapeSource {
    role?: string | null;
    nodeType?: NodeType | string | null;
    /** Typ okucia (NodeType.HARDWARE) — 'TUBE' oznacza rurę walcową. */
    hardwareType?: string | null;
    custom_properties?: Record<string, any> | null;
    customProperties?: Record<string, any> | null;
}

/** Znormalizowany kod roli ('' gdy brak). */
export function readPartRole(model: PartShapeSource | null | undefined): string {
    return String(model?.role || '').trim().toUpperCase();
}

/** Znormalizowany kod bryły z `custom_properties.shape` ('' gdy brak). */
export function readPartShape(model: PartShapeSource | null | undefined): string {
    const custom = model?.custom_properties || model?.customProperties;
    return String(custom?.shape || '').trim().toUpperCase();
}

/**
 * Czy element jest walcem? Źródło: rola / typ okucia LUB jawna flaga shape.
 * Nigdy `name` — nazwa jest wyłącznie warstwą display.
 */
export function isCylindricalPart(model: PartShapeSource | null | undefined): boolean {
    if (!model) return false;
    const role = readPartRole(model);
    if (
        CYLINDRICAL_ROLES.has(role) ||
        CYLINDRICAL_ROLE_PREFIXES.some((prefix) => role.startsWith(`${prefix}_`)) ||
        String(model.hardwareType || '').trim().toUpperCase() === TUBE_HARDWARE_TYPE
    ) {
        return true;
    }
    return readPartShape(model) === CYLINDER_SHAPE;
}

/** Czy element jest drążkiem (wydłużony walec), a nie uchwytem/rozetą. */
export function isTubeRodPart(model: PartShapeSource | null | undefined): boolean {
    if (!model) return false;
    return readPartRole(model) === TUBE_ROD_ROLE;
}
