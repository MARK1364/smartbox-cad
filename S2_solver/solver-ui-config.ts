/**
 * Konfiguracja UI — port solver_constraint_ui.json (etykiety PL).
 */

import type { BindType } from './core/contract.js';
import type { AnchorKind } from './constraint-types.js';

export const SOLVER_PANEL_TITLE = 'Relacje v1';

export const CONFLICT_REJECT_MESSAGE = 'Relacja powoduje konflikt i nie będzie realizowana.';

export interface AddButtonDef {
    bindType: BindType;
    label: string;
    title: string;
    icon: string;
}

/** Kolejność typów więzów: VERTEX, VERTEX_DATUM, COPLANAR, FLUSH, GROUND. */
export const ADD_BUTTONS: AddButtonDef[] = [
    {
        bindType: 'VERTEX',
        label: 'Połącz narożnikami',
        title: 'Vertex Bind — dwa wierzchołki w tej samej pozycji',
        icon: '⬡',
    },
    {
        bindType: 'VERTEX_DATUM',
        label: 'Naroże do płaszczyzny',
        title: 'Vertex-Datum — narożnik kontenera do płaszczyzny / poziomu Z',
        icon: '⊥',
    },
    {
        bindType: 'COPLANAR',
        label: 'Wyrównaj ściany',
        title: 'Coplanar — wspólna płaszczyzna, równoległe normalne',
        icon: '⇉',
    },
    {
        bindType: 'FLUSH',
        label: 'Dosuń ściany',
        title: 'Flush — ściany naprzeciwległe (face-to-face)',
        icon: '⇆',
    },
    {
        bindType: 'GROUND',
        label: 'Kotwicz w miejscu',
        title: 'Ground — utwierdź element w bieżącej pozycji',
        icon: '⚓',
    },
];

export const BIND_TYPE_ICON: Record<BindType, string> = {
    VERTEX: '⬡',
    VERTEX_DATUM: '⊥',
    COPLANAR: '⇉',
    FLUSH: '⇆',
    GROUND: '⚓',
};

export const BIND_TYPE_LABEL: Record<BindType, string> = {
    VERTEX: 'Vertex',
    VERTEX_DATUM: 'Naroże–Poziom',
    COPLANAR: 'Coplanar',
    FLUSH: 'Flush',
    GROUND: 'Ground',
};

export const GROUND_MODE_OPTIONS: Array<{ kind: AnchorKind; label: string }> = [
    { kind: 'VERTEX', label: 'Wierzchołek' },
    { kind: 'FACE', label: 'Ściana' },
    { kind: 'OBJECT', label: 'Obiekt' },
];
