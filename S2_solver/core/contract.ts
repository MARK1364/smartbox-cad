/**
 * contract.ts — kontrakt danych solvera więzów.
 * Port 1:1 z @@BLENDER/S2_solver/core/contract.py
 *
 * Pythonowe dataclassy mają wartości domyślne, których TS nie odtworzy sam,
 * dlatego każdy typ ma fabrykę (`makeConstraintItem`, `makeObjectState`).
 * Domyślne wartości są celowo identyczne z Pythonem — również te zaskakujące,
 * jak `groundNormal = [0,0,0]` (golden runner nadpisuje je na [0,0,1] przy
 * wczytywaniu JSON-a).
 *
 * Jednostki: wszystkie długości w milimetrach (patrz nagłówek solver-core.ts).
 * Rotacje: kwaterniony [w, x, y, z] — jak w Pythonie, nie jak w A1_core/cad-math.
 */

import type { Quat, Vec3 } from './math3d.js';

export type BindType = 'VERTEX' | 'COPLANAR' | 'FLUSH' | 'GROUND';
export type GroundMode = 'OBJECT' | 'VERTEX' | 'FACE';

/** Reszta błędu więzu — składniki w osobnych jednostkach, nigdy nie mieszane. */
export interface ConstraintResidual {
    linearMm: number;
    angularRad: number;
}

export function emptyConstraintResidual(): ConstraintResidual {
    return { linearMm: 0, angularRad: 0 };
}

export interface ConstraintItem {
    constraintId: string;
    bindType: BindType;
    enabled: boolean;
    objAId: string;
    objBId: string;
    /** Indeks wierzchołka lub -1. Klucz do `ObjectState.localVertices`. */
    vertA: number;
    vertB: number;
    /** Indeks ściany lub -1. Klucz do `ObjectState.localFaces`. */
    faceA: number;
    faceB: number;
    groundMode: GroundMode;
    groundPos: Vec3;
    groundNormal: Vec3;
    /** Dystans między płaszczyznami dla COPLANAR/FLUSH [mm]. */
    offset: number;
    /** Auto-wygaszone przez solver jako sprzeczne z więzem o wyższym priorytecie. */
    conflict: boolean;
    /** Reszta błędu po solve — do UI i diagnostyki. Nie serializowana. */
    residual: ConstraintResidual;
}

export interface SolverContract {
    constraintOrder: string[];
    constraints: ConstraintItem[];
    /** UUID obiektu → liczba kroków do najbliższego GROUND (BFS, patrz graph.ts). */
    groundDistanceMap: Record<string, number>;
    /**
     * Bryły odniesienia (GROUND oraz pierwsza wskazana kotwica A). Solver
     * nie aplikuje do nich korekt — druga szafa dojeżdża do pierwszej.
     */
    lockedIds?: Set<string>;
}

export interface ObjectState {
    id: string;
    /** Pozycja [mm]. Mutowana przez solver w miejscu. */
    location: Vec3;
    /** Kwaternion [w, x, y, z]. Mutowany przez solver w miejscu. */
    rotation: Quat;
    /** indeks wierzchołka → punkt w układzie lokalnym obiektu [mm] */
    localVertices: Map<number, Vec3>;
    /** indeks ściany → [środek lokalny [mm], normalna lokalna] */
    localFaces: Map<number, [Vec3, Vec3]>;
}

export function makeConstraintItem(
    init: Pick<ConstraintItem, 'constraintId' | 'bindType'> & Partial<ConstraintItem>,
): ConstraintItem {
    return {
        enabled: true,
        objAId: '',
        objBId: '',
        vertA: -1,
        vertB: -1,
        faceA: -1,
        faceB: -1,
        groundMode: 'VERTEX',
        groundPos: [0.0, 0.0, 0.0],
        groundNormal: [0.0, 0.0, 0.0],
        offset: 0.0,
        conflict: false,
        residual: emptyConstraintResidual(),
        ...init,
    };
}

export function makeSolverContract(init: Partial<SolverContract> = {}): SolverContract {
    return {
        constraintOrder: [],
        constraints: [],
        groundDistanceMap: {},
        ...init,
    };
}

export function makeObjectState(
    init: Pick<ObjectState, 'id' | 'location' | 'rotation'> & Partial<ObjectState>,
): ObjectState {
    return {
        localVertices: new Map(),
        localFaces: new Map(),
        ...init,
    };
}
