/**
 * Dwa COPLANAR na tej samej parze szaf: najpierw fronty (Y), potem dna (Z).
 * Oba da się spełnić, więc drugi zostaje — nie przez wyjątek typu, tylko
 * bo wspólny solve się zbiega. Kotwice muszą zostać na wskazanych formatkach.
 */

import { describe, it, expect } from 'vitest';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ConstraintGraph } from '../core/graph.js';
import { RESIDUAL_TOLERANCE, solveWithConflictResolution } from '../core/solver-core.js';
import { mapLocalMmToNode, resolveFaceLocalMm } from '../constraint-geometry.js';
import { makeAnchor, makeSolverConstraint, constraintNodeIds, type SolverConstraint } from '../constraint-types.js';
import { buildSolverInput, collectTransformDeltas } from '../solver-bridge.js';
import { SolveConstraintsCommand } from '../solve-constraints-command.js';

/** Korpus 600x500x720 z formatką frontu (Rx90) i dnem (bez obrotu). */
function makeCabinet(document: ProjectDocument, xMm: number, yMm: number, zMm: number) {
    const container = document.createContainer({
        width: mmToNm(600),
        height: mmToNm(720),
        depth: mmToNm(500),
    });
    const cab = document.findNode(container.id)!;
    cab.setLocalTransform(new Vec3(mmToNm(xMm), mmToNm(yMm), mmToNm(zMm)), Quat.IDENTITY);

    const front = document.createPanel(
        { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) },
        container.id,
    );
    const frontNode = document.findNode(front.id)!;
    // Front: grubość wzdłuż Y korpusu, wysokość wzdłuż Z (rotacja jednostkowa).
    frontNode.setLocalTransform(new Vec3(0, mmToNm(-250 + 9), mmToNm(360)), Quat.IDENTITY);

    const bottom = document.createPanel(
        { width: mmToNm(600), height: mmToNm(500), thickness: mmToNm(18) },
        container.id,
    );
    const bottomNode = document.findNode(bottom.id)!;
    // Dno: Rx90 kładzie grubość (CAD Y formatki) na Z korpusu.
    bottomNode.setLocalTransform(new Vec3(0, 0, mmToNm(9)), Quat.fromEulerXYZ(Math.PI / 2, 0, 0));

    return { cab, frontNode, bottomNode };
}

/** To samo co bindAnchorToRigidBody w constraint-picker (bez ContextManager). */
function anchorOnPanel(cab: any, panel: any, faceName: string) {
    const face = resolveFaceLocalMm(panel, faceName)!;
    const mapped = mapLocalMmToNode(panel, cab, face[0], face[1]);
    return makeAnchor({
        nodeId: cab.id,
        kind: 'FACE',
        faceName,
        sourceNodeId: panel.id,
        localPointMm: mapped.localPointMm,
        localNormalMm: mapped.localNormalMm ?? undefined,
    });
}

function groundDistances(constraints: SolverConstraint[]): Record<string, number> {
    const edges: Record<string, string[]> = {};
    for (const c of constraints) {
        const ids = constraintNodeIds(c);
        if (ids.length !== 2) continue;
        const [a, b] = ids;
        if (!edges[a]) edges[a] = [];
        if (!edges[b]) edges[b] = [];
        if (!edges[a].includes(b)) edges[a].push(b);
        if (!edges[b].includes(a)) edges[b].push(a);
    }
    const usedAsB = new Set(constraints.map((c) => c.anchorB?.nodeId).filter(Boolean) as string[]);
    const seeds = new Set(
        constraints
            .map((c) => c.anchorA?.nodeId)
            .filter((id): id is string => Boolean(id) && !usedAsB.has(id!)),
    );
    return new ConstraintGraph().computeGroundDistances(seeds, edges);
}

function solveAndApply(document: ProjectDocument, constraints: SolverConstraint[]) {
    const input = buildSolverInput(document, constraints);
    input.contract.groundDistanceMap = groundDistances(constraints);
    solveWithConflictResolution(input.contract, input.states, 80, RESIDUAL_TOLERANCE);
    const deltas = collectTransformDeltas(input);
    if (deltas.length > 0) {
        new SolveConstraintsCommand(deltas).execute(document);
    }
    return { input, deltas };
}

function worldMm(node: any) {
    const { translation } = node.getWorldMatrix().decompose();
    return new Vec3(nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z));
}

describe('dwa kolejne COPLANAR na tej samej parze szaf', () => {
    it('front wyrównuje Y, a dodane potem dno wyrównuje Z', () => {
        const document = new ProjectDocument();
        const a = makeCabinet(document, 0, 0, 0);
        const b = makeCabinet(document, 700, 120, 60);

        const front = makeSolverConstraint({
            id: 'front',
            bindType: 'COPLANAR',
            anchorA: anchorOnPanel(a.cab, a.frontNode, 'FACE_Z_MINUS'),
            anchorB: anchorOnPanel(b.cab, b.frontNode, 'FACE_Z_MINUS'),
        });

        const first = solveAndApply(document, [front]);
        expect(first.input.warnings).toEqual([]);
        expect(worldMm(b.cab).y).toBeCloseTo(0, 1);
        expect(worldMm(b.cab).z).toBeCloseTo(60, 1);

        const bottom = makeSolverConstraint({
            id: 'bottom',
            bindType: 'COPLANAR',
            anchorA: anchorOnPanel(a.cab, a.bottomNode, 'FACE_Z_MINUS'),
            anchorB: anchorOnPanel(b.cab, b.bottomNode, 'FACE_Z_MINUS'),
        });

        const second = solveAndApply(document, [front, bottom]);
        expect(second.input.warnings).toEqual([]);
        expect(second.input.contract.constraints).toHaveLength(2);
        for (const item of second.input.contract.constraints) {
            expect(item.conflict).toBe(false);
        }

        expect(worldMm(b.cab).y).toBeCloseTo(0, 1);
        expect(worldMm(b.cab).z).toBeCloseTo(0, 1);
    });
});
