/**
 * Testy bridge'a — jednostki, kwaterniony, hierarchia, domykanie celu uziemienia.
 *
 * Uruchom: npx vitest run S2_solver  (z katalogu web/)
 *
 * To najbardziej ryzykowna warstwa portu, bo spotykają się tu trzy różne
 * konwencje: nanometry domeny, milimetry rdzenia i dwie kolejności kwaternionu.
 */

import { describe, it, expect } from 'vitest';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { makeAnchor, makeSolverConstraint, type SolverConstraint } from '../constraint-types.js';
import {
    buildSolverInput,
    cadQuatFromSolver,
    collectTransformDeltas,
    computeReferenceLockedIds,
    solverQuatFromCad,
} from '../solver-bridge.js';
import { SolveConstraintsCommand } from '../solve-constraints-command.js';
import { RESIDUAL_TOLERANCE, solveConstraintsPure } from '../core/solver-core.js';

let seq = 0;
function constraint(init: Partial<SolverConstraint> & { bindType: SolverConstraint['bindType'] }) {
    return makeSolverConstraint({ id: `c${++seq}`, ...init });
}

function newContainer(document: ProjectDocument, parentId?: string) {
    const container = document.createContainer(
        { width: mmToNm(600), height: mmToNm(720), depth: mmToNm(500) },
        parentId,
    );
    return document.findNode(container.id)!;
}

function newPanel(document: ProjectDocument, parentId?: string) {
    const panel = document.createPanel(
        { width: mmToNm(600), height: mmToNm(400), thickness: mmToNm(18) },
        parentId,
    );
    return document.findNode(panel.id)!;
}

describe('Konwersja kwaternionów', () => {
    it('cad (x,y,z,w) ↔ solver [w,x,y,z] w obie strony', () => {
        const cad = new Quat(0.1, 0.2, 0.3, 0.9273618).normalize();
        const solver = solverQuatFromCad(cad);

        expect(solver[0]).toBeCloseTo(cad.w);
        expect(solver[1]).toBeCloseTo(cad.x);

        const back = cadQuatFromSolver(solver);
        expect(back.x).toBeCloseTo(cad.x);
        expect(back.y).toBeCloseTo(cad.y);
        expect(back.z).toBeCloseTo(cad.z);
        expect(back.w).toBeCloseTo(cad.w);
    });
});

describe('Budowanie wejścia solvera', () => {
    it('przelicza pozycję węzła z nanometrów na milimetry', () => {
        const document = new ProjectDocument();
        const node = newContainer(document);
        node.setLocalTransform(new Vec3(mmToNm(1000), mmToNm(2000), mmToNm(500)), Quat.IDENTITY);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: node.id, kind: 'OBJECT' }),
                groundPosMm: [0, 0, 0],
            }),
        ]);

        expect(input.states.get(node.id)!.location).toEqual([1000, 2000, 500]);
    });

    it('kotwica VERTEX trafia do localVertices, FACE do localFaces', () => {
        const document = new ProjectDocument();
        const node = newPanel(document);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: node.id, kind: 'VERTEX', cornerIndex: 7 }),
                groundPosMm: [0, 0, 0],
            }),
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: node.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
                groundPosMm: [0, 0, 0],
                groundNormal: [0, 0, 1],
            }),
        ]);

        const state = input.states.get(node.id)!;
        expect([...state.localVertices.values()]).toEqual([[300, 9, 200]]);
        expect([...state.localFaces.values()]).toEqual([[[0, 9, 0], [0, 1, 0]]]);
    });

    it('więz VERTEX buduje kontrakt z dwoma wierzchołkami', () => {
        const document = new ProjectDocument();
        const a = newContainer(document);
        const b = newContainer(document);
        b.setLocalTransform(new Vec3(mmToNm(2000), 0, 0), Quat.IDENTITY);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'VERTEX',
                anchorA: makeAnchor({ nodeId: a.id, kind: 'VERTEX', cornerIndex: 0 }),
                anchorB: makeAnchor({ nodeId: b.id, kind: 'VERTEX', cornerIndex: 1 }),
            }),
        ]);

        expect(input.contract.constraints).toHaveLength(1);
        const item = input.contract.constraints[0];
        expect(item.bindType).toBe('VERTEX');
        expect(item.objAId).toBe(a.id);
        expect(item.objBId).toBe(b.id);
        expect(item.vertA).toBe(0);
        expect(item.vertB).toBe(0);
    });

    it('więz COPLANAR buduje kontrakt z dwoma ścianami i offsetem', () => {
        const document = new ProjectDocument();
        const a = newPanel(document);
        const b = newPanel(document);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: a.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
                anchorB: makeAnchor({ nodeId: b.id, kind: 'FACE', faceName: 'FACE_Y_PLUS' }),
                offsetMm: 18,
            }),
        ]);

        expect(input.contract.constraints).toHaveLength(1);
        const item = input.contract.constraints[0];
        expect(item.bindType).toBe('COPLANAR');
        expect(item.faceA).toBe(0);
        expect(item.faceB).toBe(0);
        expect(item.offset).toBe(18);
    });

    it('COPLANAR z pickiem bez normalnej nadal buduje ściany (nie dummy VERTEX)', () => {
        const document = new ProjectDocument();
        const a = newContainer(document);
        const b = newContainer(document);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'COPLANAR',
                anchorA: makeAnchor({
                    nodeId: a.id,
                    kind: 'FACE',
                    faceName: 'FACE_Y_MINUS',
                    localPointMm: [10, -20, 30],
                }),
                anchorB: makeAnchor({
                    nodeId: b.id,
                    kind: 'FACE',
                    faceName: 'FACE_Y_PLUS',
                    localPointMm: [1, 2, 3],
                }),
            }),
        ]);

        const item = input.contract.constraints[0];
        expect(item.bindType).toBe('COPLANAR');
        const stateA = input.states.get(a.id)!;
        const stateB = input.states.get(b.id)!;
        expect(stateA.localFaces.get(item.faceA)?.[1]).toEqual([0, -1, 0]);
        expect(stateB.localFaces.get(item.faceB)?.[1]).toEqual([0, 1, 0]);
        expect(stateA.localVertices.size).toBe(0);
    });

    it('rodzaj kotwicy wyznacza groundMode', () => {
        const document = new ProjectDocument();
        const node = newPanel(document);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: node.id, kind: 'FACE', faceName: 'FACE_X_PLUS' }),
                groundPosMm: [0, 0, 0],
                groundNormal: [1, 0, 0],
            }),
        ]);

        expect(input.contract.constraints[0].groundMode).toBe('FACE');
        expect(input.contract.constraints[0].faceA).toBe(0);
    });

    it('raportuje brakujący węzeł zamiast rzucać wyjątkiem', () => {
        const document = new ProjectDocument();

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: 'nie_ma', kind: 'OBJECT' }),
            }),
        ]);

        expect(input.contract.constraints).toHaveLength(0);
        expect(input.warnings.join(' ')).toContain('nie_ma');
    });

    it('pomija węzeł ze skalą różną od 1 i ostrzega', () => {
        const document = new ProjectDocument();
        const node = newContainer(document);
        node.setLocalMatrix(Mat4.fromTRS(Vec3.ZERO, Quat.IDENTITY, new Vec3(2, 1, 1)));

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: node.id, kind: 'OBJECT' }),
                groundPosMm: [0, 0, 0],
            }),
        ]);

        expect(input.contract.constraints).toHaveLength(0);
        expect(input.warnings.join(' ')).toContain('skalę');
    });
});

describe('Domykanie celu uziemienia', () => {
    it('brak punktu oznacza "zatrzaśnij tam, gdzie jest teraz"', () => {
        const document = new ProjectDocument();
        const node = newContainer(document);
        node.setLocalTransform(new Vec3(mmToNm(150), mmToNm(250), mmToNm(0)), Quat.IDENTITY);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: node.id, kind: 'OBJECT' }),
            }),
        ]);

        expect(input.captured).toHaveLength(1);
        expect(input.captured[0].groundPosMm).toEqual([150, 250, 0]);
        expect(input.contract.constraints[0].groundPos).toEqual([150, 250, 0]);
    });

    it('domknięty cel nie powoduje żadnego ruchu', () => {
        const document = new ProjectDocument();
        const node = newPanel(document);
        node.setLocalTransform(new Vec3(mmToNm(70), mmToNm(80), mmToNm(90)), Quat.IDENTITY);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: node.id, kind: 'VERTEX', cornerIndex: 3 }),
            }),
        ]);

        solveConstraintsPure(input.contract, input.states, 40, RESIDUAL_TOLERANCE);

        expect(collectTransformDeltas(input)).toHaveLength(0);
    });

    it('domyka normalną dla trybu FACE', () => {
        const document = new ProjectDocument();
        const node = newPanel(document);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: node.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
            }),
        ]);

        expect(input.captured[0].groundNormal![2]).toBeCloseTo(-1);
    });
});

describe('Zapis wyników do transformat lokalnych', () => {
    it('przesuwa węzeł bez rodzica na wskazany punkt', () => {
        const document = new ProjectDocument();
        const node = newContainer(document);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: node.id, kind: 'OBJECT' }),
                groundPosMm: [1000, 2000, 3000],
            }),
        ]);
        solveConstraintsPure(input.contract, input.states, 40, RESIDUAL_TOLERANCE);
        const deltas = collectTransformDeltas(input);

        expect(deltas).toHaveLength(1);
        new SolveConstraintsCommand(deltas).execute(document);

        const t = node.getWorldMatrix().decompose().translation;
        expect(nmToMm(t.x)).toBeCloseTo(1000);
        expect(nmToMm(t.y)).toBeCloseTo(2000);
        expect(nmToMm(t.z)).toBeCloseTo(3000);
    });

    it('uwzględnia rodzica przy przeliczaniu na transformatę lokalną', () => {
        const document = new ProjectDocument();
        const parent = newContainer(document);
        parent.setLocalTransform(new Vec3(mmToNm(1000), 0, 0), Quat.IDENTITY);
        const child = newPanel(document, parent.id);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: child.id, kind: 'OBJECT' }),
                groundPosMm: [1500, 0, 0],
            }),
        ]);
        solveConstraintsPure(input.contract, input.states, 40, RESIDUAL_TOLERANCE);
        new SolveConstraintsCommand(collectTransformDeltas(input)).execute(document);

        const local = child.localMatrix.decompose().translation;
        const world = child.getWorldMatrix().decompose().translation;
        expect(nmToMm(local.x)).toBeCloseTo(500);
        expect(nmToMm(world.x)).toBeCloseTo(1500);
    });

    it('gdy solver rusza rodzica i dziecko, dziecko nie kumuluje ruchu rodzica', () => {
        const document = new ProjectDocument();
        const parent = newContainer(document);
        const child = newPanel(document, parent.id);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: parent.id, kind: 'OBJECT' }),
                groundPosMm: [1000, 0, 0],
            }),
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: child.id, kind: 'OBJECT' }),
                groundPosMm: [1200, 0, 0],
            }),
        ]);
        solveConstraintsPure(input.contract, input.states, 40, RESIDUAL_TOLERANCE);
        new SolveConstraintsCommand(collectTransformDeltas(input)).execute(document);

        expect(nmToMm(parent.getWorldMatrix().decompose().translation.x)).toBeCloseTo(1000);
        expect(nmToMm(child.getWorldMatrix().decompose().translation.x)).toBeCloseTo(1200);
        expect(nmToMm(child.localMatrix.decompose().translation.x)).toBeCloseTo(200);
    });

    it('obrót z trybu FACE wraca do węzła jako rotacja lokalna', () => {
        const document = new ProjectDocument();
        const node = newPanel(document);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: node.id, kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
                groundPosMm: [0, 0, 0],
                groundNormal: [1, 0, 0],
            }),
        ]);
        solveConstraintsPure(input.contract, input.states, 40, RESIDUAL_TOLERANCE);
        new SolveConstraintsCommand(collectTransformDeltas(input)).execute(document);

        // Normalna FACE_Z_PLUS formatki to lokalne +Y; po obrocie musi wskazywać światowe +X.
        const worldNormal = node
            .getWorldMatrix()
            .decompose()
            .rotation.rotateVec3(new Vec3(0, 1, 0));
        expect(worldNormal.x).toBeCloseTo(1);
        expect(worldNormal.y).toBeCloseTo(0);
        expect(worldNormal.z).toBeCloseTo(0);
    });
});

describe('SolveConstraintsCommand', () => {
    it('cofa ruch wszystkich węzłów jednym undo', () => {
        const document = new ProjectDocument();
        const history = new CommandHistory(document);
        const a = newContainer(document);
        const b = newContainer(document);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: a.id, kind: 'OBJECT' }),
                groundPosMm: [500, 0, 0],
            }),
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: b.id, kind: 'OBJECT' }),
                groundPosMm: [0, 700, 0],
            }),
        ]);
        solveConstraintsPure(input.contract, input.states, 40, RESIDUAL_TOLERANCE);
        const command = new SolveConstraintsCommand(collectTransformDeltas(input));

        expect(command.affectedNodeIds).toHaveLength(2);
        history.execute(command);

        expect(nmToMm(a.getWorldMatrix().decompose().translation.x)).toBeCloseTo(500);
        expect(nmToMm(b.getWorldMatrix().decompose().translation.y)).toBeCloseTo(700);

        history.undo();

        expect(nmToMm(a.getWorldMatrix().decompose().translation.x)).toBeCloseTo(0);
        expect(nmToMm(b.getWorldMatrix().decompose().translation.y)).toBeCloseTo(0);
    });

    it('emituje jedno zdarzenie transform dla całego przebiegu', () => {
        const document = new ProjectDocument();
        const a = newContainer(document);
        const b = newContainer(document);

        const input = buildSolverInput(document, [
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: a.id, kind: 'OBJECT' }),
                groundPosMm: [500, 0, 0],
            }),
            constraint({
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: b.id, kind: 'OBJECT' }),
                groundPosMm: [0, 700, 0],
            }),
        ]);
        solveConstraintsPure(input.contract, input.states, 40, RESIDUAL_TOLERANCE);

        let transformEvents = 0;
        document.onDocumentChanged((event) => {
            if (event.type === 'transform') transformEvents++;
        });
        new SolveConstraintsCommand(collectTransformDeltas(input)).execute(document);

        expect(transformEvents).toBe(1);
    });
});

describe('Łańcuch uziemionych szaf — niezależność od kolejności kliknięcia', () => {
    it('nie blokuje szafy 3 w locked, gdy wskazało się szafę 3 jako anchorA i szafę 2 jako anchorB', () => {
        const document = new ProjectDocument();
        const cab1 = newContainer(document);
        const cab2 = newContainer(document);
        const cab3 = newContainer(document);

        const cGround = constraint({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cab1.id, kind: 'OBJECT' }),
            groundPosMm: [0, 0, 0],
        });

        const c1 = constraint({
            bindType: 'VERTEX',
            anchorA: makeAnchor({ nodeId: cab1.id, kind: 'VERTEX', cornerIndex: 1 }),
            anchorB: makeAnchor({ nodeId: cab2.id, kind: 'VERTEX', cornerIndex: 0 }),
        });

        // Użytkownik wskazuje szafę 3 jako punkt A, a szafę 2 jako punkt B
        const c2 = constraint({
            bindType: 'VERTEX',
            anchorA: makeAnchor({ nodeId: cab3.id, kind: 'VERTEX', cornerIndex: 0 }),
            anchorB: makeAnchor({ nodeId: cab2.id, kind: 'VERTEX', cornerIndex: 1 }),
        });

        const locked = computeReferenceLockedIds([cGround, c1, c2], document);

        // Tylko cab1 (GROUND) powinno być w locked. Cab3 i Cab2 NIE mogą być zablokowane!
        expect(locked.has(cab1.id)).toBe(true);
        expect(locked.has(cab2.id)).toBe(false);
        expect(locked.has(cab3.id)).toBe(false);
    });

    it('nie odrywa szafy 2 od szafy 1 przy rozwiązywaniu więzów, gdy anchorA = cab3, anchorB = cab2', () => {
        const document = new ProjectDocument();
        const cab1 = newContainer(document);
        const cab2 = newContainer(document);
        const cab3 = newContainer(document);

        // cab1 w (0, 0, 0)
        cab1.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);
        // cab2 już dociągnięte obok cab1 w (600, 0, 0)
        cab2.setLocalTransform(new Vec3(mmToNm(600), 0, 0), Quat.IDENTITY);
        // cab3 stoi swobodnie dalej, np. w (2000, 0, 0)
        cab3.setLocalTransform(new Vec3(mmToNm(2000), 0, 0), Quat.IDENTITY);

        const cGround = constraint({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cab1.id, kind: 'OBJECT' }),
            groundPosMm: [0, 0, 0],
        });

        // cab2 połączone z cab1: wierzchołek X+ cab1 do X- cab2
        const c1 = constraint({
            bindType: 'VERTEX',
            anchorA: makeAnchor({ nodeId: cab1.id, kind: 'VERTEX', cornerIndex: 1 }),
            anchorB: makeAnchor({ nodeId: cab2.id, kind: 'VERTEX', cornerIndex: 0 }),
        });

        // cab3 łączone do cab2, ale kliknięte odwrotnie: A = cab3 (naroże 0), B = cab2 (naroże 1)
        const c2 = constraint({
            bindType: 'VERTEX',
            anchorA: makeAnchor({ nodeId: cab3.id, kind: 'VERTEX', cornerIndex: 0 }),
            anchorB: makeAnchor({ nodeId: cab2.id, kind: 'VERTEX', cornerIndex: 1 }),
        });

        const input = buildSolverInput(document, [cGround, c1, c2]);
        // Symulacja wyliczenia odległości w grafie (odpowiednik SolverController._computeGroundDistances)
        input.contract.groundDistanceMap = {
            [cab1.id]: 0,
            [cab2.id]: 1,
            [cab3.id]: 2,
        };

        solveConstraintsPure(input.contract, input.states, 50, RESIDUAL_TOLERANCE);
        new SolveConstraintsCommand(collectTransformDeltas(input)).execute(document);

        const cab1Pos = cab1.getWorldMatrix().decompose().translation;
        const cab2Pos = cab2.getWorldMatrix().decompose().translation;
        const cab3Pos = cab3.getWorldMatrix().decompose().translation;

        // cab1 stoi w (0, 0, 0)
        expect(nmToMm(cab1Pos.x)).toBeCloseTo(0, 1);
        // cab2 NIE zostało oderwane i stoi nadal w (600, 0, 0)
        expect(nmToMm(cab2Pos.x)).toBeCloseTo(600, 1);
        // cab3 dociągnęło się do cab2 (jego narożnik 0 spotkał się z narożnikiem 1 szafy 2 przy 600 + 600 = 1200)
        expect(nmToMm(cab3Pos.x)).toBeCloseTo(1200, 1);
    });
});
