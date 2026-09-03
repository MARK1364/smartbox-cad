/**
 * solver-bridge.ts — tłumacz między dokumentem CAD a czystym rdzeniem solvera.
 *
 * Rdzeń nie wie nic o `CADNode`, jednostkach domeny ani o hierarchii. Cała ta
 * wiedza jest tutaj i sprowadza się do czterech przeliczeń:
 *
 *  1. JEDNOSTKI — domena trzyma nanometry, rdzeń pracuje w milimetrach.
 *
 *  2. KWATERNIONY — `A1_core/cad-math/Quat` to (x, y, z, w), rdzeń używa
 *     pythonowej kolejności [w, x, y, z].
 *
 *  3. HIERARCHIA — rdzeń traktuje `location`/`rotation` jako transformatę
 *     ŚWIATOWĄ (`localToWorldPoint` dodaje location bez udziału rodzica).
 *     Blender obchodził to, zabraniając wiązań na węzłach z rodzicem. Tutaj
 *     podajemy solverowi transformatę światową i przy zapisie przeliczamy ją
 *     z powrotem na lokalną: localNew = parentWorld⁻¹ · worldNew. Dzięki temu
 *     więz działa na dowolnym poziomie zagnieżdżenia.
 *
 *  4. KOTWICE — stabilna `ConstraintAnchor` idzie na surowy indeks, którego
 *     oczekuje kontrakt rdzenia. Indeksy są nadawane od zera przy każdym
 *     wywołaniu, bo `ObjectState.localVertices` i `localFaces` żyją tylko przez
 *     jeden przebieg solvera.
 *
 * Skala jest przez rdzeń ignorowana (udokumentowane ograniczenie solvera), więc
 * węzły ze skalą różną od 1 są raportowane w `warnings` i pomijane.
 */

import { Mat4 } from '../A1_core/cad-math/mat4.js';
import { Quat } from '../A1_core/cad-math/quat.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { resolveAnchor } from './constraint-geometry.js';
import type { ConstraintAnchor, SolverConstraint } from './constraint-types.js';
import {
    makeConstraintItem,
    makeObjectState,
    makeSolverContract,
    type ConstraintItem,
    type GroundMode,
    type ObjectState,
    type SolverContract,
} from './core/contract.js';
import {
    localToWorldNormal,
    localToWorldPoint,
    vec3Normalize,
    type Quat as SolverQuat,
    type Vec3 as SolverVec3,
} from './core/math3d.js';

const SCALE_EPSILON = 1e-6;

/** Punkt uziemienia domknięty przy pierwszym solve — do zapisania w store. */
export interface CapturedGroundTarget {
    constraintId: string;
    groundPosMm: SolverVec3;
    groundNormal: SolverVec3 | null;
}

export interface SolverInput {
    contract: SolverContract;
    states: Map<string, ObjectState>;
    /** id stanu (== CADNode.id) → węzeł, do zapisania wyników. */
    nodes: Map<string, CADNode>;
    /** Transformaty lokalne z chwili przed solve, na potrzeby komendy undo. */
    localBefore: Map<string, Mat4>;
    captured: CapturedGroundTarget[];
    warnings: string[];
    /** id więzu w store → id więzu w kontrakcie (są równe; mapa dla czytelności). */
    constraintById: Map<string, ConstraintItem>;
}

export function solverQuatFromCad(q: Quat): SolverQuat {
    return [q.w, q.x, q.y, q.z];
}

export function cadQuatFromSolver(q: SolverQuat): Quat {
    return new Quat(q[1], q[2], q[3], q[0]);
}

function worldTransformMm(node: CADNode): { location: SolverVec3; rotation: SolverQuat; scale: Vec3 } {
    const { translation, rotation, scale } = node.getWorldMatrix().decompose();
    return {
        location: [nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z)],
        rotation: solverQuatFromCad(rotation),
        scale,
    };
}

function isUnitScale(scale: Vec3): boolean {
    return (
        Math.abs(scale.x - 1) < SCALE_EPSILON &&
        Math.abs(scale.y - 1) < SCALE_EPSILON &&
        Math.abs(scale.z - 1) < SCALE_EPSILON
    );
}

function fmt3(v: ConstraintAnchor['localPointMm'] | undefined): string {
    return v ? v.map((n) => n.toFixed(2)).join(',') : '';
}

function anchorKey(anchor: ConstraintAnchor): string {
    return `${anchor.kind}:${anchor.sourceNodeId ?? ''}:${anchor.faceName}:${anchor.cornerIndex}:${fmt3(anchor.localPointMm)}:${fmt3(anchor.localNormalMm)}`;
}

/**
 * Buduje wejście dla rdzenia solvera. Więzy z nieaktualnymi kotwicami (usunięty
 * węzeł, nieistniejąca ściana) są pomijane i raportowane, a nie wyrzucane —
 * o ich usunięciu decyduje `ConstraintStore.pruneMissingNodes`.
 */
export function buildSolverInput(
    document: ProjectDocument,
    constraints: SolverConstraint[],
): SolverInput {
    const states = new Map<string, ObjectState>();
    const nodes = new Map<string, CADNode>();
    const localBefore = new Map<string, Mat4>();
    const warnings: string[] = [];
    const captured: CapturedGroundTarget[] = [];
    const constraintById = new Map<string, ConstraintItem>();
    const anchorIndex = new Map<string, Map<string, number>>();

    const ensureState = (node: CADNode): ObjectState | null => {
        const existing = states.get(node.id);
        if (existing) {
            return existing;
        }

        const { location, rotation, scale } = worldTransformMm(node);
        if (!isUnitScale(scale)) {
            warnings.push(
                `Węzeł "${node.name}" (${node.id}) ma skalę ${scale.x}/${scale.y}/${scale.z} — solver ignoruje skalę, więz pominięty.`,
            );
            return null;
        }

        const state = makeObjectState({ id: node.id, location, rotation });
        states.set(node.id, state);
        nodes.set(node.id, node);
        localBefore.set(node.id, node.localMatrix.clone());
        anchorIndex.set(node.id, new Map());
        return state;
    };

    /** Zwraca indeks, pod którym geometria kotwicy siedzi w ObjectState. */
    const registerAnchor = (
        node: CADNode,
        state: ObjectState,
        anchor: ConstraintAnchor,
    ): number | null => {
        const geom = anchor.sourceNodeId ? document.findNode(anchor.sourceNodeId) : null;
        const resolved = resolveAnchor(node, anchor, geom);
        if (!resolved) {
            return null;
        }

        const perNode = anchorIndex.get(node.id)!;
        const key = anchorKey(anchor);
        const cached = perNode.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const index = perNode.size;
        perNode.set(key, index);

        if (anchor.kind === 'FACE' || resolved.localNormal) {
            const normal = resolved.localNormal ?? ([0, 0, 1] as const);
            state.localFaces.set(index, [resolved.localPointMm, [...normal]]);
        } else {
            state.localVertices.set(index, resolved.localPointMm);
        }
        return index;
    };

    const items: ConstraintItem[] = [];

    for (const constraint of constraints) {
        if (!constraint.anchorA) {
            continue;
        }

        const nodeA = document.findNode(constraint.anchorA.nodeId);
        if (!nodeA) {
            warnings.push(`Więz ${constraint.id}: brak węzła ${constraint.anchorA.nodeId}.`);
            continue;
        }

        const stateA = ensureState(nodeA);
        if (!stateA) {
            continue;
        }

        const indexA = registerAnchor(nodeA, stateA, constraint.anchorA);
        if (indexA === null) {
            warnings.push(
                `Więz ${constraint.id}: nie udało się rozwiązać kotwicy A (${anchorKey(constraint.anchorA)}).`,
            );
            continue;
        }

        const item = makeConstraintItem({
            constraintId: constraint.id,
            bindType: constraint.bindType,
            enabled: constraint.enabled,
            objAId: nodeA.id,
            offset: constraint.offsetMm,
        });

        if (constraint.bindType === 'GROUND') {
            const groundMode = constraint.anchorA.kind as GroundMode;
            item.groundMode = groundMode;
            if (groundMode === 'FACE') {
                item.faceA = indexA;
            } else if (groundMode === 'VERTEX') {
                item.vertA = indexA;
            }

            const target = resolveGroundTarget(constraint, stateA, item);
            item.groundPos = target.groundPosMm;
            item.groundNormal = target.groundNormal ?? [0, 0, 0];
            if (target.wasCaptured) {
                captured.push({
                    constraintId: constraint.id,
                    groundPosMm: target.groundPosMm,
                    groundNormal: target.groundNormal,
                });
            }
        } else {
            // Więzy relatywne dojdą wraz z portem gałęzi VERTEX/COPLANAR/FLUSH.
            if (!constraint.anchorB) {
                continue;
            }
            const nodeB = document.findNode(constraint.anchorB.nodeId);
            if (!nodeB) {
                warnings.push(`Więz ${constraint.id}: brak węzła ${constraint.anchorB.nodeId}.`);
                continue;
            }
            const stateB = ensureState(nodeB);
            if (!stateB) {
                continue;
            }
            const indexB = registerAnchor(nodeB, stateB, constraint.anchorB);
            if (indexB === null) {
                warnings.push(
                    `Więz ${constraint.id}: nie udało się rozwiązać kotwicy B (${anchorKey(constraint.anchorB)}).`,
                );
                continue;
            }

            item.objBId = nodeB.id;
            if (constraint.bindType === 'VERTEX') {
                if (constraint.anchorA.kind !== 'VERTEX' || constraint.anchorB.kind !== 'VERTEX') {
                    warnings.push(
                        `Więz ${constraint.id}: VERTEX wymaga dwóch kotwic typu wierzchołek.`,
                    );
                    continue;
                }
                item.vertA = indexA;
                item.vertB = indexB;
            } else if (constraint.bindType === 'COPLANAR' || constraint.bindType === 'FLUSH') {
                if (constraint.anchorA.kind !== 'FACE' || constraint.anchorB.kind !== 'FACE') {
                    warnings.push(
                        `Więz ${constraint.id}: ${constraint.bindType} wymaga dwóch kotwic typu ściana.`,
                    );
                    continue;
                }
                item.faceA = indexA;
                item.faceB = indexB;
            } else {
                warnings.push(`Więz ${constraint.id}: nieobsługiwany typ relatywny ${constraint.bindType}.`);
                continue;
            }
        }

        items.push(item);
        constraintById.set(constraint.id, item);
    }

    return {
        contract: makeSolverContract({ constraints: items, lockedIds: computeReferenceLockedIds(constraints) }),
        states,
        nodes,
        localBefore,
        captured,
        warnings,
        constraintById,
    };
}

/**
 * Bryły, których solver nie może ruszyć przy więzach relatywnych:
 * GROUND oraz pierwsza wskazana kotwica A (odniesienie).
 */
export function computeReferenceLockedIds(constraints: SolverConstraint[]): Set<string> {
    const locked = new Set<string>();
    const usedAsB = new Set<string>();
    for (const c of constraints) {
        if (!c.enabled || c.conflict) {
            continue;
        }
        if (c.bindType === 'GROUND' && c.anchorA) {
            locked.add(c.anchorA.nodeId);
        }
        if (c.bindType !== 'GROUND' && c.anchorB) {
            usedAsB.add(c.anchorB.nodeId);
        }
    }
    for (const c of constraints) {
        if (!c.enabled || c.conflict || c.bindType === 'GROUND' || !c.anchorA) {
            continue;
        }
        if (!usedAsB.has(c.anchorA.nodeId)) {
            locked.add(c.anchorA.nodeId);
        }
    }
    if (locked.size === 0) {
        for (const c of constraints) {
            if (c.enabled && c.bindType !== 'GROUND' && c.anchorA) {
                locked.add(c.anchorA.nodeId);
                break;
            }
        }
    }
    return locked;
}

interface GroundTarget {
    groundPosMm: SolverVec3;
    groundNormal: SolverVec3 | null;
    wasCaptured: boolean;
}

/**
 * Domyka cel uziemienia. Gdy więz nie ma zapisanego punktu, przyjmujemy aktualną
 * pozycję światową elementu — czyli „zatrzaśnij tam, gdzie jest teraz".
 */
function resolveGroundTarget(
    constraint: SolverConstraint,
    state: ObjectState,
    item: ConstraintItem,
): GroundTarget {
    const needsNormal = item.groundMode === 'FACE';
    const hasPos = constraint.groundPosMm !== null;
    const hasNormal = !needsNormal || constraint.groundNormal !== null;

    if (hasPos && hasNormal) {
        return {
            groundPosMm: [...constraint.groundPosMm!],
            groundNormal: constraint.groundNormal ? [...constraint.groundNormal] : null,
            wasCaptured: false,
        };
    }

    let currentPos: SolverVec3;
    let currentNormal: SolverVec3 | null = null;

    if (item.groundMode === 'FACE') {
        const face = state.localFaces.get(item.faceA);
        const [localCenter, localNormal] = face ?? ([[0, 0, 0], [0, 0, 1]] as [SolverVec3, SolverVec3]);
        currentPos = localToWorldPoint(localCenter, state.location, state.rotation);
        currentNormal = vec3Normalize(localToWorldNormal(localNormal, state.rotation));
    } else if (item.groundMode === 'VERTEX') {
        const local = state.localVertices.get(item.vertA) ?? ([0, 0, 0] as SolverVec3);
        currentPos = localToWorldPoint(local, state.location, state.rotation);
    } else {
        currentPos = [...state.location];
    }

    return {
        groundPosMm: hasPos ? [...constraint.groundPosMm!] : currentPos,
        groundNormal: needsNormal
            ? constraint.groundNormal
                ? [...constraint.groundNormal]
                : currentNormal
            : null,
        wasCaptured: true,
    };
}

export interface AppliedTransform {
    nodeId: string;
    localBefore: Mat4;
    localAfter: Mat4;
}

function nodeDepth(node: CADNode): number {
    let depth = 0;
    let current = node.parent;
    while (current) {
        depth++;
        current = current.parent;
    }
    return depth;
}

/**
 * Przelicza wyniki solvera (transformaty światowe w mm) na nowe transformaty
 * lokalne w nm. Zwraca tylko te węzły, które faktycznie się ruszyły.
 *
 * Węzły są przetwarzane od korzenia w dół, bo transformata lokalna dziecka
 * zależy od NOWEJ pozycji rodzica. Gdyby solver ruszył rodzica i dziecko w tym
 * samym przebiegu, a dziecko przeliczono względem starej pozycji rodzica,
 * dziecko wylądowałoby przesunięte o ruch rodzica.
 */
export function collectTransformDeltas(
    input: SolverInput,
    toleranceNm: number = 1,
): AppliedTransform[] {
    const ordered = [...input.states.keys()]
        .map((nodeId) => ({ nodeId, node: input.nodes.get(nodeId) }))
        .filter((entry): entry is { nodeId: string; node: CADNode } => Boolean(entry.node))
        .sort((a, b) => nodeDepth(a.node) - nodeDepth(b.node));

    const worldAfterById = new Map<string, Mat4>();
    const deltas: AppliedTransform[] = [];

    for (const { nodeId, node } of ordered) {
        const state = input.states.get(nodeId)!;
        const before = input.localBefore.get(nodeId);
        if (!before) {
            continue;
        }

        const { scale } = node.getWorldMatrix().decompose();
        const worldAfter = Mat4.fromTRS(
            new Vec3(
                mmToNm(state.location[0]),
                mmToNm(state.location[1]),
                mmToNm(state.location[2]),
            ),
            cadQuatFromSolver(state.rotation),
            scale,
        );
        worldAfterById.set(nodeId, worldAfter);

        const parent = node.parent;
        const parentWorld = parent
            ? worldAfterById.get(parent.id) ?? parent.getWorldMatrix()
            : null;
        const localAfter = parentWorld ? parentWorld.invert().multiply(worldAfter) : worldAfter;

        if (matricesClose(before, localAfter, toleranceNm)) {
            continue;
        }

        deltas.push({ nodeId, localBefore: before.clone(), localAfter });
    }

    return deltas;
}

function matricesClose(a: Mat4, b: Mat4, toleranceNm: number): boolean {
    const da = a.decompose();
    const db = b.decompose();

    const positionClose =
        Math.abs(da.translation.x - db.translation.x) <= toleranceNm &&
        Math.abs(da.translation.y - db.translation.y) <= toleranceNm &&
        Math.abs(da.translation.z - db.translation.z) <= toleranceNm;

    if (!positionClose) {
        return false;
    }

    const dot = Math.abs(
        da.rotation.x * db.rotation.x +
            da.rotation.y * db.rotation.y +
            da.rotation.z * db.rotation.z +
            da.rotation.w * db.rotation.w,
    );
    return dot > 1 - 1e-9;
}
