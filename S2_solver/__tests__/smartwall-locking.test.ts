/**
 * Dwie szafy FLUSH do tej samej ściany bez GROUND — układ niedookreślony,
 * ale niesprzeczny (SolidWorks-style: jedna baza na składową, reszta dojeżdża).
 */

import { describe, it, expect } from 'vitest';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { SMARTWALL_TYPE } from '../../S4_sciany/smartwall-types.js';
import { makeAnchor, makeSolverConstraint, type SolverConstraint } from '../constraint-types.js';
import {
    buildSolverInput,
    collectTransformDeltas,
    computeReferenceLockedIds,
} from '../solver-bridge.js';
import {
    computeConstraintResidual,
    RESIDUAL_TOLERANCE,
    solveWithConflictResolution,
} from '../core/solver-core.js';
import { SolveConstraintsCommand } from '../solve-constraints-command.js';

let seq = 0;
function constraint(init: Partial<SolverConstraint> & { bindType: SolverConstraint['bindType'] }) {
    return makeSolverConstraint({ id: `c_sw_${++seq}`, ...init });
}

function makeSmartWall(doc: ProjectDocument) {
    const model = doc.createAssembly({
        width: mmToNm(4000),
        height: mmToNm(2700),
        depth: mmToNm(100),
        name: 'Pokój',
    });
    const node = doc.findNode(model.id)!;
    (model as any).generatorParams = { type: SMARTWALL_TYPE, preset: 'single' };
    node.domainData = model;
    return node;
}

function makeCabinet(doc: ProjectDocument, name: string) {
    const model = doc.createAssembly({
        width: mmToNm(600),
        height: mmToNm(720),
        depth: mmToNm(500),
        name,
    });
    const node = doc.findNode(model.id)!;
    node.name = name;
    (node as any).customData = { smartframe: { id: name } };
    return node;
}

describe('Niedookreślony FLUSH do wspólnej ściany (bez GROUND)', () => {
    it('w składowej wall+2 szafy jest dokładnie jeden seed — nie dwa zablokowane korpusy', () => {
        const doc = new ProjectDocument();
        const wall = makeSmartWall(doc);
        const cabA = makeCabinet(doc, 'smartframe_A');
        const cabB = makeCabinet(doc, 'smartframe_B');

        const flushA = constraint({
            bindType: 'FLUSH',
            anchorA: makeAnchor({ nodeId: cabA.id, kind: 'FACE', faceName: 'FACE_Y_PLUS' }),
            anchorB: makeAnchor({ nodeId: wall.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
            offsetMm: 10,
        });
        const flushB = constraint({
            bindType: 'FLUSH',
            anchorA: makeAnchor({ nodeId: cabB.id, kind: 'FACE', faceName: 'FACE_Y_PLUS' }),
            anchorB: makeAnchor({ nodeId: wall.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
            offsetMm: 10,
        });

        const locked = computeReferenceLockedIds([flushA, flushB], doc);
        const among = [wall.id, cabA.id, cabB.id].filter((id) => locked.has(id));
        expect(among).toHaveLength(1);
    });

    it('dwie szafy FLUSH do tej samej ściany zbiegają się bez konfliktu', () => {
        const doc = new ProjectDocument();
        const wall = makeSmartWall(doc);
        const cabA = makeCabinet(doc, 'smartframe_A');
        const cabB = makeCabinet(doc, 'smartframe_B');

        wall.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        cabA.setLocalTransform(new Vec3(mmToNm(-800), mmToNm(-800), 0), Quat.IDENTITY);
        cabB.setLocalTransform(new Vec3(mmToNm(900), mmToNm(-1400), 0), Quat.IDENTITY);

        const constraints = [
            constraint({
                bindType: 'FLUSH',
                anchorA: makeAnchor({ nodeId: cabA.id, kind: 'FACE', faceName: 'FACE_Y_PLUS' }),
                anchorB: makeAnchor({ nodeId: wall.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
                offsetMm: 10,
            }),
            constraint({
                bindType: 'FLUSH',
                anchorA: makeAnchor({ nodeId: cabB.id, kind: 'FACE', faceName: 'FACE_Y_PLUS' }),
                anchorB: makeAnchor({ nodeId: wall.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
                offsetMm: 10,
            }),
        ];

        const input = buildSolverInput(doc, constraints);
        const among = [wall.id, cabA.id, cabB.id].filter((id) => input.contract.lockedIds?.has(id));
        expect(among).toHaveLength(1);

        const [converged, conflictCount] = solveWithConflictResolution(
            input.contract,
            input.states,
            80,
            RESIDUAL_TOLERANCE,
        );
        expect(converged).toBe(true);
        expect(conflictCount).toBe(0);

        for (const item of input.contract.constraints) {
            expect(item.conflict).toBe(false);
            expect(computeConstraintResidual(item, input.states).linearMm).toBeLessThan(
                RESIDUAL_TOLERANCE.linearMm,
            );
            expect(computeConstraintResidual(item, input.states).angularRad).toBeLessThan(
                RESIDUAL_TOLERANCE.angularRad,
            );
        }

        const deltas = collectTransformDeltas(input);
        new SolveConstraintsCommand(deltas).execute(doc);

        // Obie szafy na tej samej głębokości względem ściany (offset 10 mm).
        const yA = nmToMm(cabA.getWorldMatrix().decompose().translation.y);
        const yB = nmToMm(cabB.getWorldMatrix().decompose().translation.y);
        expect(Math.abs(yA - yB)).toBeLessThan(1);
    });
});
