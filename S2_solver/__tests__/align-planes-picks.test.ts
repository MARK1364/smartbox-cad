/**
 * Trzy realne wskazania płaszczyzn na korpusie SmartFrame:
 *  1. przód przez krawędź boczka
 *  2. dno przez dużą płaszczyznę wieńca
 *  3. dno przez dolną krawędź boczka
 *
 * Rotacje formatek jak w regułach korpusu: boczek Rz(−90), wieniec Rx(90).
 */

import { describe, it, expect } from 'vitest';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ConstraintGraph } from '../core/graph.js';
import { RESIDUAL_TOLERANCE, solveConstraintsPure } from '../core/solver-core.js';
import { bindAnchorToRigidBody } from '../constraint-picker.js';
import { resolveAnchor, resolveFaceLocalMm } from '../constraint-geometry.js';
import { makeAnchor, makeSolverConstraint, constraintNodeIds, type SolverConstraint } from '../constraint-types.js';
import { buildSolverInput, collectTransformDeltas } from '../solver-bridge.js';
import { SolveConstraintsCommand } from '../solve-constraints-command.js';
import { ConstraintDragGroup } from '../constraint-drag-group.js';

function makeCabinet(document: ProjectDocument, xMm: number, yMm: number, zMm: number) {
    const container = document.createContainer({
        width: mmToNm(600),
        height: mmToNm(720),
        depth: mmToNm(500),
    });
    const cab = document.findNode(container.id)!;
    cab.setLocalTransform(new Vec3(mmToNm(xMm), mmToNm(yMm), mmToNm(zMm)), Quat.IDENTITY);

    const side = document.createPanel(
        { width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18) },
        container.id,
    );
    const sideNode = document.findNode(side.id)!;
    sideNode.setLocalTransform(
        new Vec3(mmToNm(-300 + 9), 0, mmToNm(360)),
        Quat.fromEulerXYZ(0, 0, -Math.PI / 2),
    );

    const bottom = document.createPanel(
        { width: mmToNm(600), height: mmToNm(500), thickness: mmToNm(18) },
        container.id,
    );
    const bottomNode = document.findNode(bottom.id)!;
    bottomNode.setLocalTransform(new Vec3(0, 0, mmToNm(9)), Quat.fromEulerXYZ(Math.PI / 2, 0, 0));

    return { cab, sideNode, bottomNode };
}

function worldDir(node: { getWorldMatrix: () => { decompose: () => { rotation: Quat } } }, local: number[]) {
    return node
        .getWorldMatrix()
        .decompose()
        .rotation.rotateVec3(new Vec3(local[0], local[1], local[2]))
        .normalize();
}

function pickFace(panel: ReturnType<typeof makeCabinet>['sideNode'], faceName: string) {
    const face = resolveFaceLocalMm(panel, faceName)!;
    return bindAnchorToRigidBody(
        panel,
        makeAnchor({
            nodeId: panel.id,
            kind: 'FACE',
            faceName,
            localPointMm: face[0],
            localNormalMm: face[1],
        }),
    );
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
            .filter((id): id is string => Boolean(id) && !usedAsB.has(id)),
    );
    return new ConstraintGraph().computeGroundDistances(seeds, edges);
}

function solveAndApply(document: ProjectDocument, constraints: SolverConstraint[]) {
    const input = buildSolverInput(document, constraints);
    input.contract.groundDistanceMap = groundDistances(constraints);
    solveConstraintsPure(input.contract, input.states, 80, RESIDUAL_TOLERANCE);
    const deltas = collectTransformDeltas(input);
    if (deltas.length > 0) {
        new SolveConstraintsCommand(deltas).execute(document);
    }
    return { input, deltas };
}

function worldMm(node: { getWorldMatrix: () => { decompose: () => { translation: Vec3 } } }) {
    const { translation } = node.getWorldMatrix().decompose();
    return new Vec3(nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z));
}

describe('Wskazania płaszczyzn na formatkach SmartFrame', () => {
    it('przód przez krawędź boczka: normalna świata wzdłuż głębokości (Y)', () => {
        const document = new ProjectDocument();
        const a = makeCabinet(document, 0, 0, 0);
        const anchor = pickFace(a.sideNode, 'FACE_X_PLUS');
        const resolved = resolveAnchor(a.cab, anchor, a.sideNode)!;
        const n = worldDir(a.cab, resolved.localNormal!);
        expect(Math.abs(n.y)).toBeCloseTo(1, 5);
        expect(Math.abs(n.z)).toBeLessThan(0.05);
        expect(anchor.nodeId).toBe(a.cab.id);
        expect(anchor.sourceNodeId).toBe(a.sideNode.id);
    });

    it('dno przez dużą płaszczyznę wieńca: normalna świata pionowa (Z)', () => {
        const document = new ProjectDocument();
        const a = makeCabinet(document, 0, 0, 0);
        const anchor = pickFace(a.bottomNode, 'FACE_Z_PLUS');
        const resolved = resolveAnchor(a.cab, anchor, a.bottomNode)!;
        const n = worldDir(a.cab, resolved.localNormal!);
        expect(Math.abs(n.z)).toBeCloseTo(1, 5);
        expect(Math.abs(n.y)).toBeLessThan(0.05);
    });

    it('dno przez dolną krawędź boczka: normalna świata pionowa (Z)', () => {
        const document = new ProjectDocument();
        const a = makeCabinet(document, 0, 0, 0);
        const anchor = pickFace(a.sideNode, 'FACE_Y_MINUS');
        const resolved = resolveAnchor(a.cab, anchor, a.sideNode)!;
        const n = worldDir(a.cab, resolved.localNormal!);
        expect(Math.abs(n.z)).toBeCloseTo(1, 5);
        expect(Math.abs(n.y)).toBeLessThan(0.05);
    });
});

describe('Wyrównanie dwóch szaf po wskazaniu płaszczyzn', () => {
    it('druga szafa dojeżdża do pierwszej w Z, pierwsza nie drgnie', () => {
        const document = new ProjectDocument();
        const a = makeCabinet(document, 0, 0, 0);
        const b = makeCabinet(document, 700, 40, 80);

        const constraints = [
            makeSolverConstraint({
                id: 'bottoms',
                bindType: 'COPLANAR',
                anchorA: pickFace(a.bottomNode, 'FACE_Z_PLUS'),
                anchorB: pickFace(b.bottomNode, 'FACE_Z_PLUS'),
            }),
        ];

        const aBefore = worldMm(a.cab);
        solveAndApply(document, constraints);
        const aAfter = worldMm(a.cab);
        const bAfter = worldMm(b.cab);

        expect(aAfter.x).toBeCloseTo(aBefore.x, 1);
        expect(aAfter.y).toBeCloseTo(aBefore.y, 1);
        expect(aAfter.z).toBeCloseTo(aBefore.z, 1);
        expect(bAfter.z).toBeCloseTo(aAfter.z, 1);
        expect(bAfter.x).toBeCloseTo(700, 1);
        expect(bAfter.y).toBeCloseTo(40, 1);
    });

    it('po więzie na dnach obie szafy jadą w Z, szczelina 0', () => {
        const document = new ProjectDocument();
        const a = makeCabinet(document, 0, 0, 0);
        const b = makeCabinet(document, 700, 40, 0);
        const constraints = [
            makeSolverConstraint({
                id: 'bottoms',
                bindType: 'COPLANAR',
                anchorA: pickFace(a.bottomNode, 'FACE_Z_PLUS'),
                anchorB: pickFace(b.bottomNode, 'FACE_Z_PLUS'),
            }),
        ];

        ConstraintDragGroup.instance.begin(document, b.cab.id, constraints);
        const { translation, rotation, scale } = b.cab.localMatrix.decompose();
        b.cab.setLocalTransform(
            new Vec3(translation.x + mmToNm(20), translation.y + mmToNm(15), translation.z + mmToNm(30)),
            rotation,
            scale,
        );
        ConstraintDragGroup.instance.propagateTransform(document, b.cab.id);
        ConstraintDragGroup.instance.end();

        const wb = worldMm(b.cab);
        const wa = worldMm(a.cab);
        expect(wb.z).toBeCloseTo(30, 0);
        expect(wb.x).toBeCloseTo(720, 0);
        expect(wb.y).toBeCloseTo(55, 0);
        expect(wa.z).toBeCloseTo(30, 0);
        expect(wa.x).toBeCloseTo(0, 0);
    });
});
