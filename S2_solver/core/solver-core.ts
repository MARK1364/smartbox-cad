/**
 * solver-core.ts — iteracyjny solver więzów geometrycznych.
 * Port z @@BLENDER/S2_solver/core/solver_core.py
 *
 * ETAP PORTU: pełny solver więzów (GROUND, VERTEX, COPLANAR, FLUSH)
 * + wykrywanie konfliktów (`solveWithConflictResolution`).
 *
 * JEDNOSTKI: milimetry. Python pracuje w metrach, bo tak wymaga Blender, ale
 * jego własne stałe są autorsko zapisane w mm (`RESIDUAL_THRESHOLD_MM = 0.005`).
 *
 * JEDYNE ZAMIERZONE ODSTĘPSTWO OD PYTHONA — rozdzielenie progu zbieżności.
 * Python porównuje jeden `convergence_threshold` naprzemiennie z długościami
 * i z kątami w radianach, co przy zmianie jednostki długości rozjechałoby próg
 * kątowy 1000-krotnie. Rozdzielamy go więc na `linearMm` i `angularRad`,
 * dobrane tak, by odtwarzały zachowanie Pythona co do wartości:
 *
 *   Python 5e-6 m  →  { linearMm: 0.005,  angularRad: 5e-6 }
 *   Python 1e-4 m  →  { linearMm: 0.1,    angularRad: 1e-4 }
 *
 * Warunek końca pętli jest równoważny: `max(długości, kąty) < próg` w Pythonie
 * znaczy dokładnie tyle, co „wszystkie długości < próg liniowy ORAZ wszystkie
 * kąty < próg kątowy" tutaj. Reszta matematyki jest jednorodna względem skali:
 * rotacje zależą tylko od znormalizowanych normalnych, a translacje i `offset`
 * skalują się liniowo.
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
    localToWorldNormal,
    localToWorldPoint,
    rotationBetweenNormals,
    scaledQuat,
    findPerpendicular,
    vec3Add,
    vec3Dot,
    vec3Len,
    vec3Normalize,
    vec3Scale,
    vec3Sub,
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

export function getVertexWorldPosition(state: ObjectState, vertIdx: number): Vec3 {
    const localPt = state.localVertices.get(vertIdx);
    if (localPt === undefined) {
        return [0.0, 0.0, 0.0];
    }
    return localToWorldPoint(localPt, state.location, state.rotation);
}

export function getFaceWorldData(state: ObjectState, faceIdx: number): [Vec3, Vec3] {
    const faceData = state.localFaces.get(faceIdx);
    if (faceData === undefined) {
        return [
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0],
        ];
    }
    const [localCenter, localNormal] = faceData;
    const worldCenter = localToWorldPoint(localCenter, state.location, state.rotation);
    const worldNormal = localToWorldNormal(localNormal, state.rotation);
    return [worldCenter, vec3Normalize(worldNormal)];
}

/**
 * Kolejność rozwiązywania: GROUND najpierw, potem więzy tym bliżej, im mniejsza
 * odległość ich obiektów od uziemienia. Sortowanie musi być stabilne, dlatego
 * remisy rozstrzyga pierwotny indeks — bez tego zmieniłaby się kolejność
 * aplikowania poprawek, a z nią wynik.
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

    return constraints
        .map((c, index) => ({ c, index }))
        .sort((l, r) => key(l.c) - key(r.c) || l.index - r.index)
        .map((entry) => entry.c);
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
                const errorLen = vec3Len(vec3Sub(targetPos, stateA.location));
                if (errorLen > tol.linearMm) {
                    stateA.location = [targetPos[0], targetPos[1], targetPos[2]];
                    maxLinear = Math.max(maxLinear, errorLen);
                }
            } else if (bind.groundMode === 'VERTEX' && bind.vertA >= 0) {
                const posCurrent = getVertexWorldPosition(stateA, bind.vertA);
                const error = vec3Sub(bind.groundPos, posCurrent);
                const errorLen = vec3Len(error);
                if (errorLen > tol.linearMm) {
                    stateA.location = vec3Add(stateA.location, error);
                    maxLinear = Math.max(maxLinear, errorLen);
                }
            } else if (bind.groundMode === 'FACE' && bind.faceA >= 0) {
                // 1) Obrót normalnej płaszczyzny uziemienia.
                const [, currentNormal] = getFaceWorldData(stateA, bind.faceA);
                const rotationDiff = rotationBetweenNormals(currentNormal, bind.groundNormal);
                const w = Math.min(Math.max(Math.abs(rotationDiff[0]), -1.0), 1.0);
                const angle = 2.0 * Math.acos(w);
                if (angle > tol.angularRad) {
                    stateA.rotation = applyRotationToQuat(stateA.rotation, rotationDiff);
                    maxAngular = Math.max(maxAngular, angle);
                }

                // 2) Translacja środka płaszczyzny — aplikowana PO obrocie.
                const [posCurrent] = getFaceWorldData(stateA, bind.faceA);
                const error = vec3Sub(bind.groundPos, posCurrent);
                const errorLen = vec3Len(error);
                if (errorLen > tol.linearMm) {
                    stateA.location = vec3Add(stateA.location, error);
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
                const posA = getVertexWorldPosition(stateA, bind.vertA);
                const posB = getVertexWorldPosition(stateB, bind.vertB);
                const errorVec = vec3Sub(posA, posB);
                const errorLen = vec3Len(errorVec);
                if (errorLen < tol.linearMm) {
                    continue;
                }

                const kB = wb === 0 ? 0 : wa === 0 ? RELAX : RELAX * wb;
                const kA = wa === 0 ? 0 : wb === 0 ? RELAX : RELAX * wa;
                if (kB > 0) {
                    stateB.location = vec3Add(stateB.location, vec3Scale(errorVec, kB));
                }
                if (kA > 0) {
                    stateA.location = vec3Add(stateA.location, vec3Scale(errorVec, -kA));
                }
                maxLinear = Math.max(maxLinear, errorLen);
            } else if (bind.bindType === 'COPLANAR' || bind.bindType === 'FLUSH') {
                let [centerA, normA] = getFaceWorldData(stateA, bind.faceA);
                let [centerB, normB] = getFaceWorldData(stateB, bind.faceB);

                if (bind.bindType === 'FLUSH') {
                    normB = vec3Scale(normB, -1.0);
                }

                // ---- ROTACJA (tłumiona); zablokowana bryła nie obraca się ----
                if (wb > 0 && wa === 0) {
                    let rot = rotationBetweenNormals(normB, normA);
                    let w = Math.min(Math.max(Math.abs(rot[0]), -1.0), 1.0);
                    let angle = 2.0 * Math.acos(w);
                    if (angle > tol.angularRad) {
                        stateB.rotation = applyRotationToQuat(stateB.rotation, scaledQuat(rot, RELAX));
                        maxAngular = Math.max(maxAngular, angle);
                        [centerB, normB] = getFaceWorldData(stateB, bind.faceB);
                        if (bind.bindType === 'FLUSH') {
                            normB = vec3Scale(normB, -1.0);
                        }
                    }
                } else if (wa > 0 && wb === 0) {
                    let rot = rotationBetweenNormals(normA, normB);
                    let w = Math.min(Math.max(Math.abs(rot[0]), -1.0), 1.0);
                    let angle = 2.0 * Math.acos(w);
                    if (angle > tol.angularRad) {
                        stateA.rotation = applyRotationToQuat(stateA.rotation, scaledQuat(rot, RELAX));
                        maxAngular = Math.max(maxAngular, angle);
                        [centerA, normA] = getFaceWorldData(stateA, bind.faceA);
                    }
                } else if (wa > 0 && wb > 0) {
                    let avgNormal = vec3Add(normA, normB);
                    if (vec3Len(avgNormal) > 0.0001) {
                        avgNormal = vec3Normalize(avgNormal);
                    } else {
                        avgNormal = findPerpendicular(normA);
                    }

                    const rotA = rotationBetweenNormals(normA, avgNormal);
                    const rotB = rotationBetweenNormals(normB, avgNormal);

                    let wA = Math.min(Math.max(Math.abs(rotA[0]), -1.0), 1.0);
                    let angleA = 2.0 * Math.acos(wA);
                    if (angleA > tol.angularRad) {
                        stateA.rotation = applyRotationToQuat(stateA.rotation, scaledQuat(rotA, RELAX));
                        maxAngular = Math.max(maxAngular, angleA);
                    }

                    let wB = Math.min(Math.max(Math.abs(rotB[0]), -1.0), 1.0);
                    let angleB = 2.0 * Math.acos(wB);
                    if (angleB > tol.angularRad) {
                        stateB.rotation = applyRotationToQuat(stateB.rotation, scaledQuat(rotB, RELAX));
                        maxAngular = Math.max(maxAngular, angleB);
                    }

                    [centerA, normA] = getFaceWorldData(stateA, bind.faceA);
                    [centerB, normB] = getFaceWorldData(stateB, bind.faceB);
                    if (bind.bindType === 'FLUSH') {
                        normB = vec3Scale(normB, -1.0);
                    }
                }

                // ---- TRANSLACJA wzdłuż normA ----
                const errorVec = vec3Sub(centerA, centerB);
                const proj = vec3Dot(errorVec, normA);
                const targetDist = proj + bind.offset;

                if (Math.abs(targetDist) > tol.linearMm) {
                    const kB = wb === 0 ? 0 : wa === 0 ? RELAX : RELAX * wb;
                    const kA = wa === 0 ? 0 : wb === 0 ? RELAX : RELAX * wa;
                    if (kB > 0) {
                        stateB.location = vec3Add(stateB.location, vec3Scale(normA, targetDist * kB));
                    }
                    if (kA > 0) {
                        stateA.location = vec3Add(stateA.location, vec3Scale(normA, -targetDist * kA));
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
            return { linearMm: vec3Len(vec3Sub(bind.groundPos, stateA.location)), angularRad: 0 };
        }
        if (bind.groundMode === 'VERTEX' && bind.vertA >= 0) {
            const pos = getVertexWorldPosition(stateA, bind.vertA);
            return { linearMm: vec3Len(vec3Sub(bind.groundPos, pos)), angularRad: 0 };
        }
        if (bind.groundMode === 'FACE' && bind.faceA >= 0) {
            const [pos, norm] = getFaceWorldData(stateA, bind.faceA);
            const posErr = vec3Len(vec3Sub(bind.groundPos, pos));
            const targetNorm = vec3Normalize(bind.groundNormal);
            const dot = Math.min(Math.abs(vec3Dot(norm, targetNorm)), 1.0);
            return { linearMm: posErr, angularRad: Math.acos(dot) };
        }
    }

    if (bind.bindType === 'VERTEX') {
        if (!stateA || !stateB) {
            return emptyConstraintResidual();
        }
        const posA = getVertexWorldPosition(stateA, bind.vertA);
        const posB = getVertexWorldPosition(stateB, bind.vertB);
        return { linearMm: vec3Len(vec3Sub(posA, posB)), angularRad: 0 };
    }

    if (bind.bindType === 'COPLANAR' || bind.bindType === 'FLUSH') {
        if (!stateA || !stateB) {
            return emptyConstraintResidual();
        }
        const [centerA, normA] = getFaceWorldData(stateA, bind.faceA);
        const [centerB, normBRaw] = getFaceWorldData(stateB, bind.faceB);
        let normB = normBRaw;
        if (bind.bindType === 'FLUSH') {
            normB = vec3Scale(normB, -1.0);
        }

        const dot = Math.min(Math.abs(vec3Dot(normA, normB)), 1.0);
        const errorVec = vec3Sub(centerA, centerB);
        return {
            linearMm: Math.abs(vec3Dot(errorVec, normA) + bind.offset),
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
        state.location = [pose.location[0], pose.location[1], pose.location[2]];
        state.rotation = [pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]];
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
