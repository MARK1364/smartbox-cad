/**
 * Katalog operacji O1. JSON w metrach → mm (jak Biblioteki/okucia).
 */

import { rulesMToMm } from '../A1_core/cad-math/units.js';
import { getModuleRules } from '../A1_core/rules-vault.js';
import { parseSideToken } from './operacje-placement.js';
import type {
    OperationFaceHint,
    OperationFill,
    OperationInsetsM,
    OperationKind,
    OperationPlacement,
    OperationRecipe,
} from './operacje-types.js';

interface RawFrom {
    u?: string;
    v?: string;
    du?: number;
    dv?: number;
}

interface RawItem {
    id?: string;
    name?: string;
    kind?: string;
    face_hint?: string;
    placement?: string;
    insets?: OperationInsetsM;
    size?: { w?: number; h?: number };
    from?: RawFrom;
    depth?: number;
    through?: boolean;
    fill?: string;
}

function parseKind(raw: string | undefined): OperationKind {
    return raw === 'THROUGH' ? 'THROUGH' : 'POCKET';
}

function parseFill(raw: string | undefined): OperationFill {
    return raw === 'glass' ? 'glass' : 'none';
}

function parseHint(raw: string | undefined): OperationFaceHint {
    if (raw === 'INNER') return 'INNER';
    if (raw === 'ANY') return 'ANY';
    return 'OUTER';
}

function parsePlacement(raw: string | undefined): OperationPlacement {
    return raw === 'edge_dims' ? 'edge_dims' : 'frame';
}

function parseRecipe(id: string, raw: RawItem): OperationRecipe {
    const insets = raw.insets || {};
    const from = raw.from || {};
    const size = raw.size || {};
    return {
        id: raw.id || id,
        name: raw.name || id,
        kind: parseKind(raw.kind),
        face_hint: parseHint(raw.face_hint),
        placement: parsePlacement(raw.placement),
        insets: {
            l: rulesMToMm(insets.l, 0),
            r: rulesMToMm(insets.r, 0),
            t: rulesMToMm(insets.t, 0),
            b: rulesMToMm(insets.b, 0),
        },
        sizeMm: {
            w: rulesMToMm(size.w, 120),
            h: rulesMToMm(size.h, 80),
        },
        edge: {
            uEdge: parseSideToken(from.u, 'u'),
            vEdge: parseSideToken(from.v, 'v'),
            uMm: rulesMToMm(from.du, 100),
            vMm: rulesMToMm(from.dv, 80),
        },
        depthMm: rulesMToMm(raw.depth, 0),
        through: raw.through === true || raw.kind === 'THROUGH',
        fill: parseFill(raw.fill),
    };
}

let _byId: Map<string, OperationRecipe> | null = null;
let _items: OperationRecipe[] | null = null;

function ensureOperationsLoaded(): { byId: Map<string, OperationRecipe>; items: OperationRecipe[] } {
    if (_byId && _items) {
        return { byId: _byId, items: _items };
    }
    const byId = new Map<string, OperationRecipe>();
    const items: OperationRecipe[] = [];

    const catalogJson = getModuleRules<{ items?: Record<string, RawItem> }>('operacje');
    const rawItems = catalogJson?.items || {};
    for (const [id, raw] of Object.entries(rawItems)) {
        const recipe = parseRecipe(id, raw);
        items.push(recipe);
        byId.set(recipe.id, recipe);
    }
    _byId = byId;
    _items = items;
    return { byId, items };
}

function cloneRecipe(r: OperationRecipe): OperationRecipe {
    return {
        ...r,
        insets: { ...r.insets },
        sizeMm: { ...r.sizeMm },
        edge: { ...r.edge },
    };
}

export function listOperations(): OperationRecipe[] {
    const { items } = ensureOperationsLoaded();
    return items.map(cloneRecipe);
}

export function getOperation(id: string | null | undefined): OperationRecipe | null {
    if (!id) return null;
    const { byId } = ensureOperationsLoaded();
    const r = byId.get(id);
    if (!r) return null;
    return cloneRecipe(r);
}
