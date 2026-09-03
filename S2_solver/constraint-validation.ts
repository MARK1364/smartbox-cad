/**
 * constraint-validation.ts — walidacja więzów przed dragiem i solve.
 *
 * Port potrzebnych reguł z @@BLENDER/S2_solver/solver_constraint.py
 * (`validate_bind`, `check_ground_conflicts`). Nie zmienia serializacji.
 */

import type { ProjectDocument } from '../A1_core/project-document.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { resolveAnchor } from './constraint-geometry.js';
import type { ConstraintAnchor, SolverConstraint } from './constraint-types.js';
import { constraintNodeIds } from './constraint-types.js';

export type ValidationSeverity = 'error' | 'warning';

export interface ConstraintValidationIssue {
    constraintId: string;
    severity: ValidationSeverity;
    code:
        | 'SELF_BIND'
        | 'DUPLICATE_GROUND'
        | 'DUPLICATE_VERTEX'
        | 'DUPLICATE_FACE'
        | 'MISSING_NODE'
        | 'MISSING_GEOMETRY'
        | 'STALE_SOURCE'
        | 'PLANE_DIRECTION_CONFLICT'
        | 'NON_PARALLEL_PLANES'
        | 'BRIDGE_WARNING';
    message: string;
}

export interface ConstraintValidationResult {
    issues: ConstraintValidationIssue[];
    /** Więzy, których nie należy podawać solverowi. */
    skipIds: Set<string>;
}

function isFaceBind(type: SolverConstraint['bindType']): boolean {
    return type === 'COPLANAR' || type === 'FLUSH';
}

function samePair(a: SolverConstraint, b: SolverConstraint): boolean {
    const pa = new Set(constraintNodeIds(a));
    const pb = new Set(constraintNodeIds(b));
    if (pa.size !== 2 || pb.size !== pa.size) {
        return false;
    }
    for (const id of pa) {
        if (!pb.has(id)) {
            return false;
        }
    }
    return true;
}

function sameVertexGeometry(a: SolverConstraint, b: SolverConstraint): boolean {
    if (!a.anchorA || !a.anchorB || !b.anchorA || !b.anchorB) {
        return false;
    }
    const key = (x: ConstraintAnchor) => `${x.nodeId}:${x.cornerIndex}:${x.sourceNodeId ?? ''}`;
    const aKeys = new Set([key(a.anchorA), key(a.anchorB)]);
    const bKeys = new Set([key(b.anchorA), key(b.anchorB)]);
    if (aKeys.size !== bKeys.size) {
        return false;
    }
    for (const k of aKeys) {
        if (!bKeys.has(k)) {
            return false;
        }
    }
    return true;
}

function sameFaceGeometry(a: SolverConstraint, b: SolverConstraint): boolean {
    if (!a.anchorA || !a.anchorB || !b.anchorA || !b.anchorB) {
        return false;
    }
    const key = (x: ConstraintAnchor) => `${x.nodeId}:${x.faceName}:${x.sourceNodeId ?? ''}`;
    const aKeys = new Set([key(a.anchorA), key(a.anchorB)]);
    const bKeys = new Set([key(b.anchorA), key(b.anchorB)]);
    if (aKeys.size !== bKeys.size) {
        return false;
    }
    for (const k of aKeys) {
        if (!bKeys.has(k)) {
            return false;
        }
    }
    return true;
}

/**
 * Kotwica wskazuje formatkę, której nie ma już w dokumencie (SmartFrame
 * regeneruje formatki pod nowym ID). Geometria liczy się wtedy z zapisanego
 * snapshotu w LCS korpusu — poprawnie, ale bez aktualizacji przy zmianie
 * wymiarów korpusu. Warto o tym powiedzieć wprost.
 */
function hasStaleSource(
    document: ProjectDocument | null,
    anchor: ConstraintAnchor | null,
): boolean {
    if (!document || !anchor?.sourceNodeId || anchor.sourceNodeId === anchor.nodeId) {
        return false;
    }
    return !document.findNode(anchor.sourceNodeId);
}

function worldAnchorNormal(
    document: ProjectDocument,
    anchor: ConstraintAnchor,
): Vec3 | null {
    const node = document.findNode(anchor.nodeId);
    if (!node) {
        return null;
    }
    const geom = anchor.sourceNodeId ? document.findNode(anchor.sourceNodeId) : null;
    const resolved = resolveAnchor(node, anchor, geom);
    if (!resolved?.localNormal) {
        return null;
    }
    const { rotation } = node.getWorldMatrix().decompose();
    const n = rotation.rotateVec3(
        new Vec3(resolved.localNormal[0], resolved.localNormal[1], resolved.localNormal[2]),
    );
    return n.lengthSquared() < 1e-12 ? null : n.normalize();
}

const PARALLEL_DOT = 0.98;

function anchorResolves(
    document: ProjectDocument | null,
    anchor: ConstraintAnchor | null,
): boolean {
    if (!anchor) {
        return false;
    }
    if (!document) {
        return true;
    }
    const node = document.findNode(anchor.nodeId);
    if (!node) {
        return false;
    }
    const geom = anchor.sourceNodeId ? document.findNode(anchor.sourceNodeId) : null;
    return resolveAnchor(node, anchor, geom) !== null;
}

/**
 * Waliduje aktywną listę więzów. Szkice (brak kotwic) są pomijane bez błędu.
 */
export function validateConstraints(
    constraints: SolverConstraint[],
    document: ProjectDocument | null = null,
): ConstraintValidationResult {
    const issues: ConstraintValidationIssue[] = [];
    const skipIds = new Set<string>();
    const enabled = constraints.filter((c) => c.enabled && !c.conflict);

    const groundByNode = new Map<string, string[]>();

    for (const c of enabled) {
        if (c.bindType === 'GROUND') {
            if (!c.anchorA) {
                continue;
            }
            const list = groundByNode.get(c.anchorA.nodeId) ?? [];
            list.push(c.id);
            groundByNode.set(c.anchorA.nodeId, list);
            if (document && !document.findNode(c.anchorA.nodeId)) {
                issues.push({
                    constraintId: c.id,
                    severity: 'error',
                    code: 'MISSING_NODE',
                    message: `Więz ${c.id}: brak węzła uziemienia.`,
                });
                skipIds.add(c.id);
            } else if (document && !anchorResolves(document, c.anchorA)) {
                issues.push({
                    constraintId: c.id,
                    severity: 'error',
                    code: 'MISSING_GEOMETRY',
                    message: `Więz ${c.id}: nie udało się rozwiązać kotwicy uziemienia.`,
                });
                skipIds.add(c.id);
            }
            continue;
        }

        if (!c.anchorA || !c.anchorB) {
            continue;
        }
        if (c.anchorA.nodeId === c.anchorB.nodeId) {
            issues.push({
                constraintId: c.id,
                severity: 'error',
                code: 'SELF_BIND',
                message: `Więz ${c.id}: nie można wiązać korpusu z samym sobą.`,
            });
            skipIds.add(c.id);
            continue;
        }
        if (document) {
            if (!document.findNode(c.anchorA.nodeId) || !document.findNode(c.anchorB.nodeId)) {
                issues.push({
                    constraintId: c.id,
                    severity: 'error',
                    code: 'MISSING_NODE',
                    message: `Więz ${c.id}: brak węzła kotwicy.`,
                });
                skipIds.add(c.id);
                continue;
            }
            if (!anchorResolves(document, c.anchorA) || !anchorResolves(document, c.anchorB)) {
                issues.push({
                    constraintId: c.id,
                    severity: 'error',
                    code: 'MISSING_GEOMETRY',
                    message: `Więz ${c.id}: nie udało się rozwiązać geometrii kotwicy.`,
                });
                skipIds.add(c.id);
                continue;
            }
            for (const slot of ['A', 'B'] as const) {
                const anchor = slot === 'A' ? c.anchorA : c.anchorB;
                if (hasStaleSource(document, anchor)) {
                    issues.push({
                        constraintId: c.id,
                        severity: 'warning',
                        code: 'STALE_SOURCE',
                        message:
                            `Więz ${c.id}: formatka kotwicy ${slot} została zregenerowana — ` +
                            `geometria z zapisanego snapshotu. Wskaż ścianę ponownie, jeśli zmieniałeś wymiary korpusu.`,
                    });
                }
            }
        }
    }

    for (const [, ids] of groundByNode) {
        if (ids.length < 2) {
            continue;
        }
        for (let i = 1; i < ids.length; i++) {
            issues.push({
                constraintId: ids[i],
                severity: 'error',
                code: 'DUPLICATE_GROUND',
                message: `Więz ${ids[i]}: korpus ma już GROUND (${ids[0]}).`,
            });
            skipIds.add(ids[i]);
        }
    }

    for (let i = 0; i < enabled.length; i++) {
        const a = enabled[i];
        if (skipIds.has(a.id) || !a.anchorA || (a.bindType !== 'GROUND' && !a.anchorB)) {
            continue;
        }
        for (let j = i + 1; j < enabled.length; j++) {
            const b = enabled[j];
            if (skipIds.has(b.id) || a.bindType !== b.bindType) {
                continue;
            }
            if (a.bindType === 'VERTEX' && samePair(a, b) && sameVertexGeometry(a, b)) {
                issues.push({
                    constraintId: b.id,
                    severity: 'error',
                    code: 'DUPLICATE_VERTEX',
                    message: `Więz ${b.id}: duplikat wiązania wierzchołków (${a.id}).`,
                });
                skipIds.add(b.id);
            }
            if (isFaceBind(a.bindType) && isFaceBind(b.bindType) && samePair(a, b) && sameFaceGeometry(a, b)) {
                issues.push({
                    constraintId: b.id,
                    severity: 'error',
                    code: 'DUPLICATE_FACE',
                    message: `Więz ${b.id}: duplikat wiązania ścian (${a.id}).`,
                });
                skipIds.add(b.id);
            }
        }
    }

    for (let i = 0; i < enabled.length; i++) {
        const a = enabled[i];
        if (!isFaceBind(a.bindType) || skipIds.has(a.id) || !a.anchorA || !a.anchorB) {
            continue;
        }
        for (let j = i + 1; j < enabled.length; j++) {
            const b = enabled[j];
            if (!isFaceBind(b.bindType) || skipIds.has(b.id) || !samePair(a, b)) {
                continue;
            }
            if (sameFaceGeometry(a, b) && a.bindType !== b.bindType) {
                issues.push({
                    constraintId: b.id,
                    severity: 'warning',
                    code: 'PLANE_DIRECTION_CONFLICT',
                    message: `Więz ${b.id}: COPLANAR i FLUSH na tych samych ścianach — sprzeczne kierunki.`,
                });
            }
        }
    }

    if (document) {
        for (const c of enabled) {
            if (!isFaceBind(c.bindType) || skipIds.has(c.id) || !c.anchorA || !c.anchorB) {
                continue;
            }
            const nA = worldAnchorNormal(document, c.anchorA);
            const nB = worldAnchorNormal(document, c.anchorB);
            if (!nA || !nB) {
                continue;
            }
            if (Math.abs(nA.dot(nB)) < PARALLEL_DOT) {
                issues.push({
                    constraintId: c.id,
                    severity: 'warning',
                    code: 'NON_PARALLEL_PLANES',
                    message:
                        `Więz ${c.id}: wskazane płaszczyzny nie są równoległe — ` +
                        `wyrównanie przesuwa drugą szafę wzdłuż normalnej pierwszej, bez obrotu.`,
                });
            }
        }
    }

    return { issues, skipIds };
}
