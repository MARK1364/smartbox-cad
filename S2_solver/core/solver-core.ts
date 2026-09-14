/**
 * solver-core.ts — iteracyjny solver więzów geometrycznych.
 *
 * Pełny solver więzów (GROUND, VERTEX, COPLANAR, FLUSH)
 * + wykrywanie i rozwiązywanie konfliktów (`solveWithConflictResolution`).
 *
 * JEDNOSTKI: milimetry (mm) oraz radiany (rad).
 * Rozdzielenie progów zbieżności na `linearMm` i `angularRad`:
 *   - linearMm: 0.005 mm
 *   - angularRad: 5e-6 rad
 *
 * Warunek zbieżności: wszystkie błędy translacji < próg liniowy ORAZ wszystkie
 * błędy orientacji < próg kątowy.
 */

import {
    emptyConstraintResidual,
    type BindType,
    type ConstraintItem,
    type ConstraintResidual,
    type ObjectState,
    type SolverContract,
} from './contract.js';
import {
    applyRotationToQuat,
    applyRotationToQuatTo,
    findPerpendicular,
    findPerpendicularTo,
    localToWorldNormal,
    localToWorldNormalTo,
    localToWorldPoint,
    localToWorldPointTo,
    rotationBetweenNormals,
    rotationBetweenNormalsTo,
    scaledQuat,
    scaledQuatTo,
    vec3Add,
    vec3AddTo,
    vec3Dot,
    vec3Len,
    vec3Normalize,
    vec3NormalizeTo,
    vec3Scale,
    vec3ScaleTo,
    vec3Sub,
    vec3SubTo,
    type Quat,
    type Vec3,
} from './math3d.js';

export const RELAX = 0.5;

/** Kolejność typów jak w Pythonie. Konflikty rozstrzyga indeks na liście, nie ta mapa. */
export const BIND_PRIORITY: Record<BindType, number> = {
    GROUND: 0,
    VERTEX: 1,
    COPLANAR: 2,
    FLUSH: 2,
};

/** Typy więzów, które ten etap portu faktycznie rozwiązuje. */
export const IMPLEMENTED_BIND_TYPES: ReadonlySet<BindType> = new Set<BindType>([
    'GROUND',
    'VERTEX',
    'COPLANAR',
    'FLUSH',
]);

export interface SolverTolerance {
    /** Próg dla błędów odległości [mm]. */
    linearMm: number;
    /** Próg dla błędów kątowych [rad]. */
    angularRad: number;
}

/** Odpowiednik pythonowego `convergence_threshold = 0.0001` (metry). */
export const DEFAULT_TOLERANCE: SolverTolerance = { linearMm: 0.1, angularRad: 1e-4 };

/** Odpowiednik pythonowego `RESIDUAL_THRESHOLD = 0.005 mm`. */
export const RESIDUAL_TOLERANCE: SolverTolerance = { linearMm: 0.005, angularRad: 5e-6 };

// ============================================================================
// REJESTRY ROBOCZE DLA GORĄCEJ PĘTLI SOLVERA (ZERO-ALLOCATION SCRATCHPAD)
// ============================================================================

const _rV0: Vec3 = [0.0, 0.0, 0.0];
const _rV1: Vec3 = [0.0, 0.0, 0.0];
const _rV2: Vec3 = [0.0, 0.0, 0.0];
const _rCenterA: Vec3 = [0.0, 0.0, 0.0];
const _rNormA: Vec3 = [0.0, 0.0, 0.0];
const _rCenterB: Vec3 = [0.0, 0.0, 0.0];
const _rNormB: Vec3 = [0.0, 0.0, 0.0];
const _rQ0: Quat = [1.0, 0.0, 0.0, 0.0];
const _rQ1: Quat = [1.0, 0.0, 0.0, 0.0];
const _rQ2: Quat = [1.0, 0.0, 0.0, 0.0];

export function getVertexWorldPositionTo(state: ObjectState, vertIdx: number, out: Vec3): Vec3 {
    const localPt = state.localVertices.get(vertIdx);
    if (localPt === undefined) {
        out[0] = 0.0;
        out[1] = 0.0;
        out[2] = 0.0;
        return out;
    }
    return localToWorldPointTo(localPt, state.location, state.rotation, out);
}

export function getVertexWorldPosition(state: ObjectState, vertIdx: number): Vec3 {
    return getVertexWorldPositionTo(state, vertIdx, [0.0, 0.0, 0.0]);
}

export function getFaceWorldDataTo(
    state: ObjectState,
    faceIdx: number,
    outCenter: Vec3,
    outNormal: Vec3,
): void {
    const faceData = state.localFaces.get(faceIdx);
    if (faceData === undefined) {
        outCenter[0] = 0.0;
        outCenter[1] = 0.0;
        outCenter[2] = 0.0;
        outNormal[0] = 0.0;
        outNormal[1] = 0.0;
        outNormal[2] = 1.0;
        return;
    }
    const [localCenter, localNormal] = faceData;
    localToWorldPointTo(localCenter, state.location, state.rotation, outCenter);
    localToWorldNormalTo(localNormal, state.rotation, outNormal);
    vec3NormalizeTo(outNormal, outNormal);
}

export function getFaceWorldData(state: ObjectState, faceIdx: number): [Vec3, Vec3] {
    const center: Vec3 = [0.0, 0.0, 0.0];
    const normal: Vec3 = [0.0, 0.0, 0.0];
    getFaceWorldDataTo(state, faceIdx, center, normal);
    return [center, normal];
}

/**
 * Kolejność rozwiązywania: GROUND najpierw, potem więzy tym bliżej, im mniejsza
 * odległość ich obiektów od uziemienia. Sortowanie w JS (ES2019+) jest stabilne,
 * dlatego zachowuje pierwotną kolejność przy remisach bez dodatkowych mapowań obiektów.
 */
function sortConstraints(
    constraints: ConstraintItem[],
    groundDistMap: Record<string, number>,
): ConstraintItem[] {
    const key = (c: ConstraintItem): number => {
        if (c.bindType === 'GROUND') {
            return -1;
        }
        const da = groundDistMap[c.objAId] ?? 999;
        const db = groundDistMap[c.objBId] ?? 999;
        return Math.min(da, db);
    };

    return constraints.slice().sort((l, r) => key(l) - key(r));
}

function moveShares(
    idA: string,
    idB: string,
    distA: number,
    distB: number,
    locked: Set<string>,
): { wa: number; wb: number } {
    const aFree = !locked.has(idA);
    const bFree = !locked.has(idB);
    if (aFree && !bFree) {
        return { wa: 1, wb: 0 };
    }
    if (bFree && !aFree) {
        return { wa: 0, wb: 1 };
    }
    if (!aFree && !bFree) {
        return { wa: 0, wb: 0 };
    }
    if (distA < distB) {
        return { wa: 0, wb: 1 };
    }
    if (distB < distA) {
        return { wa: 1, wb: 0 };
    }
    return { wa: 0.5, wb: 0.5 };
}

/**
 * Rozwiązuje więzy, mutując `states` w miejscu (location i rotation).
 * Zwraca true, jeśli osiągnięto zbieżność przed wyczerpaniem iteracji.
 */
export function solveConstraintsPure(
    contract: SolverContract,
    states: Map<string, ObjectState>,
    maxIterations: number = 40,
    tol: SolverTolerance = DEFAULT_TOLERANCE,
): boolean {
    const groundDistMap = contract.groundDistanceMap;
    const active = contract.constraints.filter(
        (c) => c.enabled && !c.conflict && IMPLEMENTED_BIND_TYPES.has(c.bindType),
    );
    const constraints = sortConstraints(active, groundDistMap);
    const locked = contract.lockedIds ?? new Set<string>();

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        let maxLinear = 0.0;
        let maxAngular = 0.0;

        // 1. GROUND — pełny krok, bez tłumienia.
        for (const bind of constraints) {
            if (bind.bindType !== 'GROUND') {
                continue;
            }
            const stateA = states.get(bind.objAId);
            if (!stateA) {
                continue;
            }

            if (bind.groundMode === 'OBJECT') {
                const targetPos = bind.groundPos;
                vec3SubTo(targetPos, stateA.location, _rV0);
                const errorLen = vec3Len(_rV0);
                if (errorLen > tol.linearMm) {
                    stateA.location[0] = targetPos[0];
                    stateA.location[1] = targetPos[1];
                    stateA.location[2] = targetPos[2];
                    maxLinear = Math.max(maxLinear, errorLen);
                }
            } else if (bind.groundMode === 'VERTEX' && bind.vertA >= 0) {
                getVertexWorldPositionTo(stateA, bind.vertA, _rV1);
                vec3SubTo(bind.groundPos, _rV1, _rV0);
                const errorLen = vec3Len(_rV0);
                if (errorLen > tol.linearMm) {
                    vec3AddTo(stateA.location, _rV0, stateA.location);
                    maxLinear = Math.max(maxLinear, errorLen);
                }
            } else if (bind.groundMode === 'FACE' && bind.faceA >= 0) {
                // 1) Obrót normalnej płaszczyzny uziemienia.
                getFaceWorldDataTo(stateA, bind.faceA, _rCenterA, _rNormA);
                rotationBetweenNormalsTo(_rNormA, bind.groundNormal, _rQ0, _rV0, _rV1);
                const w = Math.min(Math.max(Math.abs(_rQ0[0]), -1.0), 1.0);
                const angle = 2.0 * Math.acos(w);
                if (angle > tol.angularRad) {
                    applyRotationToQuatTo(stateA.rotation, _rQ0, stateA.rotation);
                    maxAngular = Math.max(maxAngular, angle);
                }

                // 2) Translacja środka płaszczyzny — aplikowana PO obrocie.
                getFaceWorldDataTo(stateA, bind.faceA, _rCenterA, _rNormA);
                vec3SubTo(bind.groundPos, _rCenterA, _rV0);
                const errorLen = vec3Len(_rV0);
                if (errorLen > tol.linearMm) {
                    vec3AddTo(stateA.location, _rV0, stateA.location);
                    maxLinear = Math.max(maxLinear, errorLen);
                }
            }
        }

        // 2. RELATYWNE — VERTEX, COPLANAR, FLUSH.
        for (const bind of constraints) {
            if (bind.bindType === 'GROUND') {
                continue;
            }
            const stateA = states.get(bind.objAId);
            const stateB = states.get(bind.objBId);
            if (!stateA || !stateB) {
                continue;
            }

            const distA = groundDistMap[bind.objAId] ?? 999;
            const distB = groundDistMap[bind.objBId] ?? 999;
            const { wa, wb } = moveShares(bind.objAId, bind.objBId, distA, distB, locked);
            if (wa === 0 && wb === 0) {
                continue;
            }

            if (bind.bindType === 'VERTEX') {
                getVertexWorldPositionTo(stateA, bind.vertA, _rV0);
                getVertexWorldPositionTo(stateB, bind.vertB, _rV1);
                vec3SubTo(_rV0, _rV1, _rV2);
                const errorLen = vec3Len(_rV2);
                if (errorLen < tol.linearMm) {
                    continue;
                }

                const kB = wb === 0 ? 0 : wa === 0 ? RELAX : RELAX * wb;
                const kA = wa === 0 ? 0 : wb === 0 ? RELAX : RELAX * wa;
                if (kB > 0) {
                    vec3ScaleTo(_rV2, kB, _rV0);
                    vec3AddTo(stateB.location, _rV0, stateB.location);
                }
                if (kA > 0) {
                    vec3ScaleTo(_rV2, -kA, _rV0);
                    vec3AddTo(stateA.location, _rV0, stateA.location);
                }
                maxLinear = Math.max(maxLinear, errorLen);
            } else if (bind.bindType === 'COPLANAR' || bind.bindType === 'FLUSH') {
                getFaceWorldDataTo(stateA, bind.faceA, _rCenterA, _rNormA);
                getFaceWorldDataTo(stateB, bind.faceB, _rCenterB, _rNormB);

                if (bind.bindType === 'FLUSH') {
                    vec3ScaleTo(_rNormB, -1.0, _rNormB);
                }

                // ---- ROTACJA (tłumiona); zablokowana bryła nie obraca się ----
                if (wb > 0 && wa === 0) {
                    rotationBetweenNormalsTo(_rNormB, _rNormA, _rQ0, _rV0, _rV1);
                    let w = Math.min(Math.max(Math.abs(_rQ0[0]), -1.0), 1.0);
                    let angle = 2.0 * Math.acos(w);
                    if (angle > tol.angularRad) {
                        scaledQuatTo(_rQ0, RELAX, _rQ1);
                        applyRotationToQuatTo(stateB.rotation, _rQ1, stateB.rotation);
                        maxAngular = Math.max(maxAngular, angle);
                        getFaceWorldDataTo(stateB, bind.faceB, _rCenterB, _rNormB);
                        if (bind.bindType === 'FLUSH') {
                            vec3ScaleTo(_rNormB, -1.0, _rNormB);
                        }
                    }
                } else if (wa > 0 && wb === 0) {
                    rotationBetweenNormalsTo(_rNormA, _rNormB, _rQ0, _rV0, _rV1);
                    let w = Math.min(Math.max(Math.abs(_rQ0[0]), -1.0), 1.0);
                    let angle = 2.0 * Math.acos(w);
                    if (angle > tol.angularRad) {
                        scaledQuatTo(_rQ0, RELAX, _rQ1);
                        applyRotationToQuatTo(stateA.rotation, _rQ1, stateA.rotation);
                        maxAngular = Math.max(maxAngular, angle);
                        getFaceWorldDataTo(stateA, bind.faceA, _rCenterA, _rNormA);
                    }
                } else if (wa > 0 && wb > 0) {
                    vec3AddTo(_rNormA, _rNormB, _rV2);
                    if (vec3Len(_rV2) > 0.0001) {
                        vec3NormalizeTo(_rV2, _rV2);
                    } else {
                        findPerpendicularTo(_rNormA, _rV2);
                    }

                    rotationBetweenNormalsTo(_rNormA, _rV2, _rQ0, _rV0, _rV1);
                    rotationBetweenNormalsTo(_rNormB, _rV2, _rQ2, _rV0, _rV1);

                    let wA = Math.min(Math.max(Math.abs(_rQ0[0]), -1.0), 1.0);
                    let angleA = 2.0 * Math.acos(wA);
                    if (angleA > tol.angularRad) {
                        scaledQuatTo(_rQ0, RELAX, _rQ1);
                        applyRotationToQuatTo(stateA.rotation, _rQ1, stateA.rotation);
                        maxAngular = Math.max(maxAngular, angleA);
                    }

                    let wB = Math.min(Math.max(Math.abs(_rQ2[0]), -1.0), 1.0);
                    let angleB = 2.0 * Math.acos(wB);
                    if (angleB > tol.angularRad) {
                        scaledQuatTo(_rQ2, RELAX, _rQ1);
                        applyRotationToQuatTo(stateB.rotation, _rQ1, stateB.rotation);
                        maxAngular = Math.max(maxAngular, angleB);
                    }

                    getFaceWorldDataTo(stateA, bind.faceA, _rCenterA, _rNormA);
                    getFaceWorldDataTo(stateB, bind.faceB, _rCenterB, _rNormB);
                    if (bind.bindType === 'FLUSH') {
                        vec3ScaleTo(_rNormB, -1.0, _rNormB);
                    }
                }

                // ---- TRANSLACJA wzdłuż normA ----
                vec3SubTo(_rCenterA, _rCenterB, _rV0);
                const proj = vec3Dot(_rV0, _rNormA);
                const targetDist = proj + bind.offset;

                if (Math.abs(targetDist) > tol.linearMm) {
                    const kB = wb === 0 ? 0 : wa === 0 ? RELAX : RELAX * wb;
                    const kA = wa === 0 ? 0 : wb === 0 ? RELAX : RELAX * wa;
                    if (kB > 0) {
                        vec3ScaleTo(_rNormA, targetDist * kB, _rV1);
                        vec3AddTo(stateB.location, _rV1, stateB.location);
                    }
                    if (kA > 0) {
                        vec3ScaleTo(_rNormA, -targetDist * kA, _rV1);
                        vec3AddTo(stateA.location, _rV1, stateA.location);
                    }
                    maxLinear = Math.max(maxLinear, Math.abs(targetDist));
                }
            }
        }

        if (maxLinear < tol.linearMm && maxAngular < tol.angularRad) {
            return true;
        }
    }

    return false;
}

export function residualExceedsTolerance(
    residual: ConstraintResidual,
    tol: SolverTolerance = RESIDUAL_TOLERANCE,
): boolean {
    return residual.linearMm > tol.linearMm || residual.angularRad > tol.angularRad;
}

/**
 * Reszta błędu więzu po solve, z rozdzielonymi jednostkami.
 * Liniowy składnik jest w mm, kątowy w radianach — UI przelicza kąt na stopnie.
 */
export function computeConstraintResidual(
    bind: ConstraintItem,
    states: Map<string, ObjectState>,
): ConstraintResidual {
    const stateA = states.get(bind.objAId);
    const stateB = states.get(bind.objBId);

    if (bind.bindType === 'GROUND') {
        if (!stateA) {
            return emptyConstraintResidual();
        }
        if (bind.groundMode === 'OBJECT') {
            vec3SubTo(bind.groundPos, stateA.location, _rV0);
            return { linearMm: vec3Len(_rV0), angularRad: 0 };
        }
        if (bind.groundMode === 'VERTEX' && bind.vertA >= 0) {
            getVertexWorldPositionTo(stateA, bind.vertA, _rV0);
            vec3SubTo(bind.groundPos, _rV0, _rV1);
            return { linearMm: vec3Len(_rV1), angularRad: 0 };
        }
        if (bind.groundMode === 'FACE' && bind.faceA >= 0) {
            getFaceWorldDataTo(stateA, bind.faceA, _rCenterA, _rNormA);
            vec3SubTo(bind.groundPos, _rCenterA, _rV0);
            const posErr = vec3Len(_rV0);
            vec3NormalizeTo(bind.groundNormal, _rV1);
            const dot = Math.min(Math.abs(vec3Dot(_rNormA, _rV1)), 1.0);
            return { linearMm: posErr, angularRad: Math.acos(dot) };
        }
    }

    if (bind.bindType === 'VERTEX') {
        if (!stateA || !stateB) {
            return emptyConstraintResidual();
        }
        getVertexWorldPositionTo(stateA, bind.vertA, _rV0);
        getVertexWorldPositionTo(stateB, bind.vertB, _rV1);
        vec3SubTo(_rV0, _rV1, _rV2);
        return { linearMm: vec3Len(_rV2), angularRad: 0 };
    }

    if (bind.bindType === 'COPLANAR' || bind.bindType === 'FLUSH') {
        if (!stateA || !stateB) {
            return emptyConstraintResidual();
        }
        getFaceWorldDataTo(stateA, bind.faceA, _rCenterA, _rNormA);
        getFaceWorldDataTo(stateB, bind.faceB, _rCenterB, _rNormB);
        if (bind.bindType === 'FLUSH') {
            vec3ScaleTo(_rNormB, -1.0, _rNormB);
        }

        const dot = Math.min(Math.abs(vec3Dot(_rNormA, _rNormB)), 1.0);
        vec3SubTo(_rCenterA, _rCenterB, _rV0);
        return {
            linearMm: Math.abs(vec3Dot(_rV0, _rNormA) + bind.offset),
            angularRad: Math.acos(dot),
        };
    }

    return emptyConstraintResidual();
}

function relativeObjectPair(bind: ConstraintItem): Set<string> {
    if (bind.bindType === 'GROUND') {
        return new Set();
    }
    const pair = new Set<string>();
    if (bind.objAId) pair.add(bind.objAId);
    if (bind.objBId) pair.add(bind.objBId);
    return pair;
}

function sameRelativePair(a: ConstraintItem, b: ConstraintItem): boolean {
    if (a.bindType === 'GROUND' || b.bindType === 'GROUND') {
        return false;
    }
    const pairA = relativeObjectPair(a);
    if (pairA.size === 0) {
        return false;
    }
    const pairB = relativeObjectPair(b);
    if (pairA.size !== pairB.size) {
        return false;
    }
    for (const id of pairA) {
        if (!pairB.has(id)) {
            return false;
        }
    }
    return true;
}

/** Próg reszty błędu używany przy wykrywaniu konfliktów (odpowiednik pythonowego RESIDUAL_THRESHOLD). */
export const CONFLICT_RESIDUAL_THRESHOLD_MM = RESIDUAL_TOLERANCE.linearMm;

type PoseSnapshot = { location: Vec3; rotation: Quat };

function snapshotPoses(states: Map<string, ObjectState>): Map<string, PoseSnapshot> {
    const snap = new Map<string, PoseSnapshot>();
    for (const [id, state] of states) {
        snap.set(id, {
            location: [state.location[0], state.location[1], state.location[2]],
            rotation: [state.rotation[0], state.rotation[1], state.rotation[2], state.rotation[3]],
        });
    }
    return snap;
}

function restorePoses(states: Map<string, ObjectState>, snap: Map<string, PoseSnapshot>): void {
    for (const [id, state] of states) {
        const pose = snap.get(id);
        if (!pose) {
            continue;
        }
        state.location[0] = pose.location[0];
        state.location[1] = pose.location[1];
        state.location[2] = pose.location[2];
        state.rotation[0] = pose.rotation[0];
        state.rotation[1] = pose.rotation[1];
        state.rotation[2] = pose.rotation[2];
        state.rotation[3] = pose.rotation[3];
    }
}

/**
 * Wygasza późniejszy więz na tej samej parze, gdy wspólny solve się nie
 * zbiegł i residual nadal przekracza próg. Historycznie pierwszy (niższy
 * indeks na liście) zostaje. Typ więzu nie daje pierwszeństwa — COPLANAR
 * nie jest wyjątkiem.
 */
function detectAndSuppressConflicts(
    active: ConstraintItem[],
    states: Map<string, ObjectState>,
    indexMap: Map<string, number>,
): boolean {
    const residuals = new Map<string, ConstraintResidual>();
    for (const bind of active) {
        const r = computeConstraintResidual(bind, states);
        residuals.set(bind.constraintId, r);
        bind.residual = r;
    }

    const candidates = [...active]
        .filter((b) => b.bindType === 'VERTEX' || b.bindType === 'COPLANAR' || b.bindType === 'FLUSH')
        .sort((l, r) => (indexMap.get(r.constraintId) ?? 999) - (indexMap.get(l.constraintId) ?? 999));

    let newConflicts = false;
    for (const bind of candidates) {
        if (bind.conflict) {
            continue;
        }

        const residual = residuals.get(bind.constraintId) ?? emptyConstraintResidual();
        if (!residualExceedsTolerance(residual)) {
            continue;
        }

        const bindIndex = indexMap.get(bind.constraintId) ?? 999;

        for (const other of active) {
            if (other.constraintId === bind.constraintId || other.conflict) {
                continue;
            }
            if (other.bindType === 'GROUND') {
                continue;
            }
            if (!sameRelativePair(bind, other)) {
                continue;
            }
            const otherIndex = indexMap.get(other.constraintId) ?? 999;
            if (otherIndex >= bindIndex) {
                continue;
            }

            bind.conflict = true;
            newConflicts = true;
            break;
        }
    }

    return newConflicts;
}

/**
 * Rozwiązuje więzy z wygaszaniem sprzeczności (SolidWorks-style).
 * Zwraca [zbieżność, liczba więzów oznaczonych jako konflikt].
 *
 * Odrzucony więz nie może przesunąć bryły w osiach, których wcześniejszy
 * więz nie blokuje — każda runda i solve po konflikcie startuje z pozami
 * sprzed próby, nie z półproduktu wspólnego solve.
 */
export function solveWithConflictResolution(
    contract: SolverContract,
    states: Map<string, ObjectState>,
    maxIterations: number = 40,
    tol: SolverTolerance = RESIDUAL_TOLERANCE,
    maxConflictRounds: number = 8,
): [boolean, number] {
    const enabled = contract.constraints.filter((c) => c.enabled);
    const indexMap = new Map(contract.constraints.map((c, i) => [c.constraintId, i]));

    for (const bind of contract.constraints) {
        bind.conflict = false;
        bind.residual = emptyConstraintResidual();
    }

    const snapshot = snapshotPoses(states);
    let converged = false;
    for (let round = 0; round < maxConflictRounds; round++) {
        const active = enabled.filter((c) => !c.conflict);
        if (active.length === 0) {
            break;
        }

        restorePoses(states, snapshot);
        converged = solveConstraintsPure(contract, states, maxIterations, tol);

        // Zbieżność = wszystkie aktywne więzy da się spełnić razem (np. przód+dno).
        // Sprzeczność licz tylko gdy solver nie domknął — wtedy odpada nowszy.
        if (converged) {
            break;
        }
        if (!detectAndSuppressConflicts(active, states, indexMap)) {
            break;
        }
    }

    const conflictCount = enabled.filter((c) => c.conflict).length;
    if (conflictCount > 0) {
        restorePoses(states, snapshot);
    }

    const activeFinal = enabled.filter((c) => !c.conflict);
    if (activeFinal.length > 0) {
        converged = solveConstraintsPure(contract, states, maxIterations, tol);
        for (const bind of activeFinal) {
            bind.residual = computeConstraintResidual(bind, states);
        }
    }

    return [converged, conflictCount];
}
