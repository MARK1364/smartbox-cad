/**
 * Testy więzu COPLANAR — „Wyrównaj ściany” (SolidWorks-style coplanar mate).
 *
 * Uruchom: npx vitest run S2_solver/__tests__/align-faces
 *
 * Pokrywa pełną ścieżkę: kotwice FACE na korpusach → bridge → solver → zapis
 * do dokumentu CAD. Golden case `case_coplanar.json` jest uzupełnieniem na
 * poziomie rdzenia (patrz golden-runner.test.ts).
 */

import { describe, it, expect } from 'vitest';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ConstraintGraph } from '../core/graph.js';
import {
    computeConstraintResidual,
    getFaceWorldData,
    RESIDUAL_TOLERANCE,
    solveConstraintsPure,
    solveWithConflictResolution,
} from '../core/solver-core.js';
import type { ObjectState } from '../core/contract.js';
import { vec3Dot, vec3Sub } from '../core/math3d.js';
import { makeAnchor, makeSolverConstraint, type SolverConstraint } from '../constraint-types.js';
import { constraintNodeIds } from '../constraint-types.js';
import { buildSolverInput, collectTransformDeltas } from '../solver-bridge.js';
import { SolveConstraintsCommand } from '../solve-constraints-command.js';
import { mapLocalMmToNode, resolveFaceLocalMm } from '../constraint-geometry.js';

let seq = 0;
function bind(init: Partial<SolverConstraint> & { bindType: SolverConstraint['bindType'] }) {
    return makeSolverConstraint({ id: `af${++seq}`, ...init });
}

function newContainer(document: ProjectDocument, parentId?: string) {
    const container = document.createContainer(
        { width: mmToNm(600), height: mmToNm(720), depth: mmToNm(500) },
        parentId,
    );
    return document.findNode(container.id)!;
}

function computeGroundDistances(constraints: SolverConstraint[]): Record<string, number> {
    const groundIds = new Set<string>();
    const edges: Record<string, string[]> = {};

    for (const c of constraints) {
        if (!c.enabled || c.bindType !== 'GROUND' || !c.anchorA) continue;
        groundIds.add(c.anchorA.nodeId);
    }

    for (const c of constraints) {
        if (!c.enabled || c.bindType === 'GROUND') continue;
        const ids = constraintNodeIds(c);
        if (ids.length !== 2) continue;
        const [a, b] = ids;
        if (!edges[a]) edges[a] = [];
        if (!edges[b]) edges[b] = [];
        if (!edges[a].includes(b)) edges[a].push(b);
        if (!edges[b].includes(a)) edges[b].push(b);
    }

    return new ConstraintGraph().computeGroundDistances(groundIds, edges);
}

function solveInDocument(document: ProjectDocument, constraints: SolverConstraint[]) {
    const input = buildSolverInput(document, constraints);
    input.contract.groundDistanceMap = computeGroundDistances(constraints);
    const converged = solveConstraintsPure(input.contract, input.states, 40, RESIDUAL_TOLERANCE);
    return { input, converged };
}

function solveAndApply(document: ProjectDocument, constraints: SolverConstraint[]) {
    const result = solveInDocument(document, constraints);
    const deltas = collectTransformDeltas(result.input);
    if (deltas.length > 0) {
        new SolveConstraintsCommand(deltas).execute(document);
    }
    return result;
}

/** Błąd równoległości normalnych (1 = równoległe) i odległość płaszczyzn [mm]. */
function coplanarMetrics(
    stateA: ObjectState,
    faceA: number,
    stateB: ObjectState,
    faceB: number,
    offsetMm = 0,
): { normalAlignment: number; planeGapMm: number } {
    const [centerA, normA] = getFaceWorldData(stateA, faceA);
    const [centerB, normB] = getFaceWorldData(stateB, faceB);
    const normalAlignment = vec3Dot(normA, normB);
    // Solver: dot(centerA − centerB, normA) + offset = 0  →  dot(centerB − centerA, normA) = offset
    const planeGapMm = Math.abs(vec3Dot(vec3Sub(centerB, centerA), normA) - offsetMm);
    return { normalAlignment, planeGapMm };
}

function findCoplanarItem(input: ReturnType<typeof buildSolverInput>) {
    const item = input.contract.constraints.find((c) => c.bindType === 'COPLANAR');
    expect(item, 'Brak więzu COPLANAR w kontrakcie').toBeDefined();
    return item!;
}

describe('Wyrównaj ściany (COPLANAR)', () => {
    it('dwa korpusy — górne ściany (FACE_Z_PLUS) w jednej płaszczyźnie', () => {
        const document = new ProjectDocument();
        const cabA = newContainer(document);
        const cabB = newContainer(document);

        cabB.setLocalTransform(
            new Vec3(mmToNm(0), mmToNm(0), mmToNm(900)),
            Quat.fromEulerXYZ(Math.PI / 2, 0, 0),
        );

        const constraints = [
            bind({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'OBJECT' }),
            }),
            bind({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
                anchorB: makeAnchor({ nodeId: cabB.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
            }),
        ];

        const { input, converged } = solveAndApply(document, constraints);
        expect(converged).toBe(true);

        const item = findCoplanarItem(input);
        const stateA = input.states.get(item.objAId)!;
        const stateB = input.states.get(item.objBId)!;
        const { normalAlignment, planeGapMm } = coplanarMetrics(stateA, item.faceA, stateB, item.faceB);

        expect(normalAlignment).toBeCloseTo(1, 2);
        expect(planeGapMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
        expect(computeConstraintResidual(item, input.states).linearMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);

        // Uziemiony korpus A nie rusza się
        expect(nmToMm(cabA.getWorldMatrix().decompose().translation.z)).toBeCloseTo(0, 0);
    });

    it('COPLANAR z offsetem — płaszczyzny rozstawione o zadany dystans', () => {
        const document = new ProjectDocument();
        const cabA = newContainer(document);
        const cabB = newContainer(document);

        cabB.setLocalTransform(new Vec3(mmToNm(0), mmToNm(0), mmToNm(800)), Quat.IDENTITY);

        const offsetMm = 18;
        const constraints = [
            bind({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'OBJECT' }),
            }),
            bind({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
                anchorB: makeAnchor({ nodeId: cabB.id, kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
                offsetMm,
            }),
        ];

        const { input, converged } = solveInDocument(document, constraints);
        expect(converged).toBe(true);

        const item = findCoplanarItem(input);
        const metrics = coplanarMetrics(
            input.states.get(item.objAId)!,
            item.faceA,
            input.states.get(item.objBId)!,
            item.faceB,
            offsetMm,
        );
        expect(metrics.normalAlignment).toBeCloseTo(1, 2);
        expect(metrics.planeGapMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });

    it('kotwice localPointMm z picka 3D — front korpusu (Y−)', () => {
        const document = new ProjectDocument();
        const cabA = newContainer(document);
        const cabB = newContainer(document);
        cabB.setLocalTransform(new Vec3(mmToNm(1200), 0, 0), Quat.fromEulerXYZ(0, 0, Math.PI / 2));

        const constraints = [
            bind({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'OBJECT' }),
            }),
            bind({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({
                    nodeId: cabA.id,
                    kind: 'FACE',
                    faceName: 'FACE_Y_MINUS',
                    localPointMm: [0, -250, 360],
                    localNormalMm: [0, -1, 0],
                }),
                anchorB: makeAnchor({
                    nodeId: cabB.id,
                    kind: 'FACE',
                    faceName: 'FACE_X_PLUS',
                    localPointMm: [300, 0, 360],
                    localNormalMm: [1, 0, 0],
                }),
            }),
        ];

        const { input, converged } = solveInDocument(document, constraints);
        expect(converged).toBe(true);
        expect(input.warnings).toHaveLength(0);

        const item = findCoplanarItem(input);
        const metrics = coplanarMetrics(
            input.states.get(item.objAId)!,
            item.faceA,
            input.states.get(item.objBId)!,
            item.faceB,
        );
        expect(metrics.normalAlignment).toBeCloseTo(1, 1);
        expect(metrics.planeGapMm).toBeLessThan(1);
    });

    it('bez GROUND — druga szafa dojeżdża do pierwszej, pierwsza stoi', () => {
        const document = new ProjectDocument();
        const cabA = newContainer(document);
        const cabB = newContainer(document);

        cabA.setLocalTransform(new Vec3(0, 0, mmToNm(0)), Quat.IDENTITY);
        cabB.setLocalTransform(new Vec3(0, 0, mmToNm(600)), Quat.fromEulerXYZ(Math.PI / 4, 0, 0));

        const zBeforeA = nmToMm(cabA.getWorldMatrix().decompose().translation.z);
        const zBeforeB = nmToMm(cabB.getWorldMatrix().decompose().translation.z);

        const constraints = [
            bind({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
                anchorB: makeAnchor({ nodeId: cabB.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
            }),
        ];

        const { input, converged } = solveAndApply(document, constraints);
        expect(converged).toBe(true);
        expect(input.contract.lockedIds?.has(cabA.id)).toBe(true);

        const zAfterA = nmToMm(cabA.getWorldMatrix().decompose().translation.z);
        const zAfterB = nmToMm(cabB.getWorldMatrix().decompose().translation.z);

        expect(Math.abs(zAfterA - zBeforeA)).toBeLessThan(1);
        expect(Math.abs(zAfterB - zBeforeB)).toBeGreaterThan(1);

        const item = findCoplanarItem(input);
        const metrics = coplanarMetrics(
            input.states.get(item.objAId)!,
            item.faceA,
            input.states.get(item.objBId)!,
            item.faceB,
        );
        expect(metrics.normalAlignment).toBeCloseTo(1, 2);
        expect(metrics.planeGapMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });

    it('zapis do dokumentu — światowe normalne ścian po SolveConstraintsCommand', () => {
        const document = new ProjectDocument();
        const cabA = newContainer(document);
        const cabB = newContainer(document);
        cabB.setLocalTransform(new Vec3(0, 0, mmToNm(1000)), Quat.fromEulerXYZ(Math.PI / 3, 0, 0));

        const constraints = [
            bind({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'OBJECT' }),
            }),
            bind({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
                anchorB: makeAnchor({ nodeId: cabB.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
            }),
        ];

        solveAndApply(document, constraints);

        const inputAfter = buildSolverInput(document, constraints);
        const item = findCoplanarItem(inputAfter);
        const [, normA] = getFaceWorldData(inputAfter.states.get(item.objAId)!, item.faceA);
        const [, normB] = getFaceWorldData(inputAfter.states.get(item.objBId)!, item.faceB);

        expect(normA[2]).toBeCloseTo(1, 2);
        expect(normB[2]).toBeCloseTo(1, 2);
        expect(vec3Dot(normA, normB)).toBeCloseTo(1, 2);
    });

    it('korpus uziemiony + COPLANAR — drugi korpus podciąga się do pierwszego', () => {
        const document = new ProjectDocument();
        const fixed = newContainer(document);
        const mobile = newContainer(document);

        fixed.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        mobile.setLocalTransform(
            new Vec3(mmToNm(0), mmToNm(400), mmToNm(200)),
            Quat.fromEulerXYZ(0, Math.PI / 2, 0),
        );

        const constraints = [
            bind({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: fixed.id, kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
                groundPosMm: [0, 0, 0],
                groundNormal: [0, 0, 1],
            }),
            bind({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: fixed.id, kind: 'FACE', faceName: 'FACE_X_PLUS' }),
                anchorB: makeAnchor({ nodeId: mobile.id, kind: 'FACE', faceName: 'FACE_X_MINUS' }),
            }),
        ];

        const posFixedBefore = fixed.getWorldMatrix().decompose().translation.clone();
        const { converged } = solveAndApply(document, constraints);
        expect(converged).toBe(true);

        const posFixedAfter = fixed.getWorldMatrix().decompose().translation;
        expect(posFixedAfter.x).toBeCloseTo(posFixedBefore.x);
        expect(posFixedAfter.y).toBeCloseTo(posFixedBefore.y);
        expect(posFixedAfter.z).toBeCloseTo(posFixedBefore.z);

        const input = buildSolverInput(document, constraints);
        const item = findCoplanarItem(input);
        const metrics = coplanarMetrics(
            input.states.get(item.objAId)!,
            item.faceA,
            input.states.get(item.objBId)!,
            item.faceB,
        );
        expect(metrics.planeGapMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });

    it('dwie formatki w korpusach — COPLANAR rusza korpusy, płyt nie odrywa', () => {
        const document = new ProjectDocument();
        const cabA = newContainer(document);
        const cabB = newContainer(document);
        const panelA = document.createPanel(
            { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) },
            cabA.id,
        );
        const panelB = document.createPanel(
            { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) },
            cabB.id,
        );
        const nodeA = document.findNode(panelA.id)!;
        const nodeB = document.findNode(panelB.id)!;
        cabB.setLocalTransform(new Vec3(0, 0, mmToNm(80)), Quat.fromEulerXYZ(Math.PI / 5, 0, 0));

        const localABefore = nodeA.localMatrix.clone();
        const localBBefore = nodeB.localMatrix.clone();

        const constraints = [
            bind({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'OBJECT' }),
            }),
            bind({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({
                    nodeId: cabA.id,
                    kind: 'FACE',
                    faceName: 'front',
                    sourceNodeId: nodeA.id,
                }),
                anchorB: makeAnchor({
                    nodeId: cabB.id,
                    kind: 'FACE',
                    faceName: 'front',
                    sourceNodeId: nodeB.id,
                }),
            }),
        ];

        const { input, converged } = solveAndApply(document, constraints);
        expect(converged).toBe(true);

        const item = findCoplanarItem(input);
        expect(item.objAId).toBe(cabA.id);
        expect(item.objBId).toBe(cabB.id);

        const da = localABefore.decompose();
        const db = localBBefore.decompose();
        const aa = nodeA.localMatrix.decompose();
        const bb = nodeB.localMatrix.decompose();
        expect(nmToMm(aa.translation.x)).toBeCloseTo(nmToMm(da.translation.x), 3);
        expect(nmToMm(aa.translation.y)).toBeCloseTo(nmToMm(da.translation.y), 3);
        expect(nmToMm(aa.translation.z)).toBeCloseTo(nmToMm(da.translation.z), 3);
        expect(nmToMm(bb.translation.x)).toBeCloseTo(nmToMm(db.translation.x), 3);
        expect(nmToMm(bb.translation.y)).toBeCloseTo(nmToMm(db.translation.y), 3);
        expect(nmToMm(bb.translation.z)).toBeCloseTo(nmToMm(db.translation.z), 3);

        const metrics = coplanarMetrics(
            input.states.get(item.objAId)!,
            item.faceA,
            input.states.get(item.objBId)!,
            item.faceB,
        );
        expect(metrics.normalAlignment).toBeCloseTo(1, 2);
        expect(metrics.planeGapMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });

    it('dwa COPLANAR na tej samej parze (przód + dno) — zbiegają się razem, oba zostają', () => {
        const document = new ProjectDocument();
        const cabA = newContainer(document);
        const cabB = newContainer(document);
        cabB.setLocalTransform(
            new Vec3(mmToNm(400), mmToNm(-200), mmToNm(150)),
            Quat.fromEulerXYZ(Math.PI / 6, 0, Math.PI / 10),
        );

        const constraints = [
            bind({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'OBJECT' }),
            }),
            bind({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
                anchorB: makeAnchor({ nodeId: cabB.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
            }),
            bind({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
                anchorB: makeAnchor({ nodeId: cabB.id, kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
            }),
        ];

        const input = buildSolverInput(document, constraints);
        input.contract.groundDistanceMap = computeGroundDistances(constraints);
        const [converged, conflictCount] = solveWithConflictResolution(
            input.contract,
            input.states,
            80,
            RESIDUAL_TOLERANCE,
        );
        expect(converged).toBe(true);
        expect(conflictCount).toBe(0);

        const items = input.contract.constraints.filter((c) => c.bindType === 'COPLANAR');
        expect(items).toHaveLength(2);
        for (const item of items) {
            expect(item.conflict).toBe(false);
            expect(computeConstraintResidual(item, input.states).linearMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
        }
    });
});

describe('Dosuń ściany (FLUSH) — ściany naprzeciwległe', () => {
    it('dwa korpusy — fronty zderzone (normalne przeciwnie)', () => {
        const document = new ProjectDocument();
        const cabA = newContainer(document);
        const cabB = newContainer(document);
        cabB.setLocalTransform(new Vec3(0, mmToNm(-800), 0), Quat.IDENTITY);

        const constraints = [
            bind({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'OBJECT' }),
            }),
            bind({
                bindType: 'FLUSH',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
                anchorB: makeAnchor({ nodeId: cabB.id, kind: 'FACE', faceName: 'FACE_Y_PLUS' }),
            }),
        ];

        const { input, converged } = solveInDocument(document, constraints);
        expect(converged).toBe(true);

        const item = input.contract.constraints.find((c) => c.bindType === 'FLUSH')!;
        const [centerA, normA] = getFaceWorldData(input.states.get(item.objAId)!, item.faceA);
        const [centerB, normB] = getFaceWorldData(input.states.get(item.objBId)!, item.faceB);

        expect(vec3Dot(normA, normB)).toBeCloseTo(-1, 2);
        const gap = Math.abs(vec3Dot(vec3Sub(centerB, centerA), normA));
        expect(gap).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
        expect(computeConstraintResidual(item, input.states).linearMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });

    it('dwa korpusy — zewnętrzne boczki (INNER nie wchodzi do więzu)', () => {
        const document = new ProjectDocument();
        const cabA = newContainer(document);
        const cabB = newContainer(document);
        cabB.setLocalTransform(new Vec3(mmToNm(800), 0, 0), Quat.IDENTITY);

        const sideA = document.createPanel(
            { width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18) },
            cabA.id,
        );
        const sideB = document.createPanel(
            { width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18) },
            cabB.id,
        );
        const nodeA = document.findNode(sideA.id)!;
        const nodeB = document.findNode(sideB.id)!;
        // Prawy boczek A / lewy boczek B — OUTER = FACE_Z_MINUS.
        nodeA.setLocalTransform(
            new Vec3(mmToNm(300 - 9), 0, mmToNm(360)),
            Quat.fromEulerXYZ(0, 0, Math.PI / 2),
        );
        nodeB.setLocalTransform(
            new Vec3(mmToNm(-300 + 9), 0, mmToNm(360)),
            Quat.fromEulerXYZ(0, 0, -Math.PI / 2),
        );

        const outerA = resolveFaceLocalMm(nodeA, 'FACE_Z_MINUS')!;
        const outerB = resolveFaceLocalMm(nodeB, 'FACE_Z_MINUS')!;
        const invert = (n: number[]): [number, number, number] => [-n[0], -n[1], -n[2]];
        const mappedA = mapLocalMmToNode(nodeA, cabA, outerA[0], invert(outerA[1]));
        const mappedB = mapLocalMmToNode(nodeB, cabB, outerB[0], invert(outerB[1]));

        const constraints = [
            bind({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'OBJECT' }),
            }),
            bind({
                bindType: 'FLUSH',
                anchorA: makeAnchor({
                    nodeId: cabA.id,
                    kind: 'FACE',
                    faceName: 'FACE_Z_MINUS',
                    sourceNodeId: nodeA.id,
                    localPointMm: mappedA.localPointMm,
                    localNormalMm: mappedA.localNormalMm ?? undefined,
                }),
                anchorB: makeAnchor({
                    nodeId: cabB.id,
                    kind: 'FACE',
                    faceName: 'FACE_Z_MINUS',
                    sourceNodeId: nodeB.id,
                    localPointMm: mappedB.localPointMm,
                    localNormalMm: mappedB.localNormalMm ?? undefined,
                }),
            }),
        ];

        const { input, converged } = solveAndApply(document, constraints);
        expect(converged).toBe(true);

        const item = input.contract.constraints.find((c) => c.bindType === 'FLUSH')!;
        const [centerA, normA] = getFaceWorldData(input.states.get(item.objAId)!, item.faceA);
        const [centerB, normB] = getFaceWorldData(input.states.get(item.objBId)!, item.faceB);

        expect(normA[0]).toBeCloseTo(1, 2);
        expect(normB[0]).toBeCloseTo(-1, 2);
        expect(centerA[0]).toBeCloseTo(300, 0);
        expect(centerB[0]).toBeCloseTo(300, 0);
        expect(Math.abs(centerA[0])).toBeGreaterThan(290);
        expect(computeConstraintResidual(item, input.states).linearMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });
});
