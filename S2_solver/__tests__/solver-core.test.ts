/**
 * Testy gałęzi GROUND solvera.
 *
 * Uruchom: npx vitest run S2_solver  (z katalogu web/)
 *
 * Golden case z Pythona (`case_ground.json`) pokrywa wyłącznie tryb VERTEX,
 * dlatego tryby OBJECT i FACE mają tu własne testy. Wszystkie długości w mm.
 */

import { describe, it, expect } from 'vitest';
import {
    makeConstraintItem,
    makeObjectState,
    makeSolverContract,
    type ObjectState,
} from '../core/contract.js';
import {
    computeConstraintResidual,
    getFaceWorldData,
    RESIDUAL_TOLERANCE,
    solveConstraintsPure,
} from '../core/solver-core.js';
import type { Vec3 } from '../core/math3d.js';

function statesOf(...list: ObjectState[]): Map<string, ObjectState> {
    return new Map(list.map((s) => [s.id, s]));
}

function boxAt(id: string, location: Vec3): ObjectState {
    return makeObjectState({ id, location, rotation: [1, 0, 0, 0] });
}

describe('GROUND / tryb OBJECT', () => {
    it('ustawia origin obiektu dokładnie w punkcie uziemienia', () => {
        const state = boxAt('box', [100, 200, 300]);
        const contract = makeSolverContract({
            constraints: [
                makeConstraintItem({
                    constraintId: 'g1',
                    bindType: 'GROUND',
                    objAId: 'box',
                    groundMode: 'OBJECT',
                    groundPos: [10, 20, 30],
                }),
            ],
        });

        const converged = solveConstraintsPure(contract, statesOf(state), 20, RESIDUAL_TOLERANCE);

        expect(converged).toBe(true);
        expect(state.location[0]).toBeCloseTo(10);
        expect(state.location[1]).toBeCloseTo(20);
        expect(state.location[2]).toBeCloseTo(30);
    });
});

describe('GROUND / tryb VERTEX', () => {
    it('przesuwa obiekt tak, by wierzchołek trafił w punkt uziemienia', () => {
        const state = makeObjectState({
            id: 'box',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localVertices: new Map<number, Vec3>([[0, [1000, 2000, 3000]]]),
        });
        const contract = makeSolverContract({
            constraints: [
                makeConstraintItem({
                    constraintId: 'g1',
                    bindType: 'GROUND',
                    objAId: 'box',
                    groundMode: 'VERTEX',
                    vertA: 0,
                    groundPos: [5000, 10000, 3000],
                }),
            ],
        });

        const converged = solveConstraintsPure(contract, statesOf(state), 20, RESIDUAL_TOLERANCE);

        expect(converged).toBe(true);
        expect(state.location[0]).toBeCloseTo(4000);
        expect(state.location[1]).toBeCloseTo(8000);
        expect(state.location[2]).toBeCloseTo(0);
    });

    it('rezyduum po zbieżności jest zerowe', () => {
        const state = makeObjectState({
            id: 'box',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localVertices: new Map<number, Vec3>([[0, [1000, 2000, 3000]]]),
        });
        const bind = makeConstraintItem({
            constraintId: 'g1',
            bindType: 'GROUND',
            objAId: 'box',
            groundMode: 'VERTEX',
            vertA: 0,
            groundPos: [5000, 10000, 3000],
        });
        const states = statesOf(state);

        solveConstraintsPure(makeSolverContract({ constraints: [bind] }), states, 20, RESIDUAL_TOLERANCE);

        expect(computeConstraintResidual(bind, states).linearMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });
});

describe('GROUND / tryb FACE', () => {
    it('sama translacja, gdy normalna już się zgadza', () => {
        const state = makeObjectState({
            id: 'panel',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localFaces: new Map<number, [Vec3, Vec3]>([[0, [[0, 0, 5], [0, 0, 1]]]]),
        });
        const contract = makeSolverContract({
            constraints: [
                makeConstraintItem({
                    constraintId: 'g1',
                    bindType: 'GROUND',
                    objAId: 'panel',
                    groundMode: 'FACE',
                    faceA: 0,
                    groundPos: [0, 0, 0],
                    groundNormal: [0, 0, 1],
                }),
            ],
        });

        const converged = solveConstraintsPure(contract, statesOf(state), 20, RESIDUAL_TOLERANCE);

        expect(converged).toBe(true);
        expect(state.location[2]).toBeCloseTo(-5);
        const [center, normal] = getFaceWorldData(state, 0);
        expect(center[2]).toBeCloseTo(0);
        expect(normal[2]).toBeCloseTo(1);
    });

    it('obraca obiekt, by normalna ściany pokryła się z normalną uziemienia', () => {
        const state = makeObjectState({
            id: 'panel',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localFaces: new Map<number, [Vec3, Vec3]>([[0, [[0, 0, 5], [0, 0, 1]]]]),
        });
        const contract = makeSolverContract({
            constraints: [
                makeConstraintItem({
                    constraintId: 'g1',
                    bindType: 'GROUND',
                    objAId: 'panel',
                    groundMode: 'FACE',
                    faceA: 0,
                    groundPos: [0, 0, 0],
                    groundNormal: [1, 0, 0],
                }),
            ],
        });

        const converged = solveConstraintsPure(contract, statesOf(state), 20, RESIDUAL_TOLERANCE);

        expect(converged).toBe(true);
        const [center, normal] = getFaceWorldData(state, 0);
        expect(normal[0]).toBeCloseTo(1);
        expect(normal[1]).toBeCloseTo(0);
        expect(normal[2]).toBeCloseTo(0);
        expect(center[0]).toBeCloseTo(0);
        expect(center[1]).toBeCloseTo(0);
        expect(center[2]).toBeCloseTo(0);
    });

    it('radzi sobie z normalną odwróconą o 180°', () => {
        const state = makeObjectState({
            id: 'panel',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localFaces: new Map<number, [Vec3, Vec3]>([[0, [[0, 0, 5], [0, 0, 1]]]]),
        });
        const contract = makeSolverContract({
            constraints: [
                makeConstraintItem({
                    constraintId: 'g1',
                    bindType: 'GROUND',
                    objAId: 'panel',
                    groundMode: 'FACE',
                    faceA: 0,
                    groundPos: [0, 0, 0],
                    groundNormal: [0, 0, -1],
                }),
            ],
        });

        const converged = solveConstraintsPure(contract, statesOf(state), 20, RESIDUAL_TOLERANCE);

        expect(converged).toBe(true);
        const [, normal] = getFaceWorldData(state, 0);
        expect(normal[2]).toBeCloseTo(-1);
    });
});

describe('Filtrowanie więzów', () => {
    it('pomija więzy wyłączone', () => {
        const state = boxAt('box', [100, 200, 300]);
        const contract = makeSolverContract({
            constraints: [
                makeConstraintItem({
                    constraintId: 'g1',
                    bindType: 'GROUND',
                    objAId: 'box',
                    groundMode: 'OBJECT',
                    groundPos: [0, 0, 0],
                    enabled: false,
                }),
            ],
        });

        solveConstraintsPure(contract, statesOf(state), 20, RESIDUAL_TOLERANCE);

        expect(state.location).toEqual([100, 200, 300]);
    });

    it('pomija więzy oznaczone jako sprzeczne', () => {
        const state = boxAt('box', [100, 200, 300]);
        const contract = makeSolverContract({
            constraints: [
                makeConstraintItem({
                    constraintId: 'g1',
                    bindType: 'GROUND',
                    objAId: 'box',
                    groundMode: 'OBJECT',
                    groundPos: [0, 0, 0],
                    conflict: true,
                }),
            ],
        });

        solveConstraintsPure(contract, statesOf(state), 20, RESIDUAL_TOLERANCE);

        expect(state.location).toEqual([100, 200, 300]);
    });

    it('pomija obiekt, którego nie ma w stanach', () => {
        const contract = makeSolverContract({
            constraints: [
                makeConstraintItem({
                    constraintId: 'g1',
                    bindType: 'GROUND',
                    objAId: 'nieistnieje',
                    groundMode: 'OBJECT',
                    groundPos: [0, 0, 0],
                }),
            ],
        });

        expect(() =>
            solveConstraintsPure(contract, new Map(), 20, RESIDUAL_TOLERANCE),
        ).not.toThrow();
    });
});

describe('VERTEX / dwa obiekty', () => {
    it('symetrycznie przesuwa oba korpusy, gdy brak ground_distance_map', () => {
        const a = makeObjectState({
            id: 'cubeA',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localVertices: new Map<number, Vec3>([[0, [-500, -500, -500]]]),
        });
        const b = makeObjectState({
            id: 'cubeB',
            location: [2000, 0, 0],
            rotation: [1, 0, 0, 0],
            localVertices: new Map<number, Vec3>([[1, [500, -500, -500]]]),
        });
        const bind = makeConstraintItem({
            constraintId: 'v1',
            bindType: 'VERTEX',
            objAId: 'cubeA',
            objBId: 'cubeB',
            vertA: 0,
            vertB: 1,
        });
        const states = statesOf(a, b);

        const converged = solveConstraintsPure(
            makeSolverContract({ constraints: [bind] }),
            states,
            40,
            RESIDUAL_TOLERANCE,
        );

        expect(converged).toBe(true);
        expect(a.location[0]).toBeCloseTo(1500);
        expect(b.location[0]).toBeCloseTo(500);
        expect(computeConstraintResidual(bind, states).linearMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });

    it('przesuwa tylko obiekt dalszy od uziemienia, gdy distA < distB', () => {
        const a = makeObjectState({
            id: 'a',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localVertices: new Map<number, Vec3>([[0, [0, 0, 0]]]),
        });
        const b = makeObjectState({
            id: 'b',
            location: [1000, 0, 0],
            rotation: [1, 0, 0, 0],
            localVertices: new Map<number, Vec3>([[0, [0, 0, 0]]]),
        });
        const bind = makeConstraintItem({
            constraintId: 'v1',
            bindType: 'VERTEX',
            objAId: 'a',
            objBId: 'b',
            vertA: 0,
            vertB: 0,
        });
        const states = statesOf(a, b);
        const contract = makeSolverContract({
            constraints: [bind],
            groundDistanceMap: { a: 0, b: 5 },
        });

        const converged = solveConstraintsPure(contract, states, 40, RESIDUAL_TOLERANCE);

        expect(converged).toBe(true);
        expect(a.location[0]).toBeCloseTo(0);
        expect(b.location[0]).toBeCloseTo(0);
        expect(computeConstraintResidual(bind, states).linearMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });
});

describe('COPLANAR / dwie ściany', () => {
    it('wyrównuje normalne i przesuwa panel B do płaszczyzny A (panelA uziemiony)', () => {
        const panelA = makeObjectState({
            id: 'panelA',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localFaces: new Map<number, [Vec3, Vec3]>([[0, [[0, 0, 500], [0, 0, 1]]]]),
        });
        const panelB = makeObjectState({
            id: 'panelB',
            location: [0, 0, 2000],
            rotation: [0.70710678, 0.70710678, 0, 0],
            localFaces: new Map<number, [Vec3, Vec3]>([[0, [[0, 0, -500], [0, 0, -1]]]]),
        });
        const bind = makeConstraintItem({
            constraintId: 'c1',
            bindType: 'COPLANAR',
            objAId: 'panelA',
            objBId: 'panelB',
            faceA: 0,
            faceB: 0,
        });
        const states = statesOf(panelA, panelB);
        const contract = makeSolverContract({
            constraints: [bind],
            groundDistanceMap: { panelA: 0 },
        });

        const converged = solveConstraintsPure(contract, states, 40, RESIDUAL_TOLERANCE);

        expect(converged).toBe(true);
        expect(panelA.location).toEqual([0, 0, 0]);
        expect(panelB.location[2]).toBeCloseTo(0, 0);
        const [, normB] = getFaceWorldData(panelB, 0);
        expect(normB[2]).toBeCloseTo(1);
        expect(computeConstraintResidual(bind, states).linearMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });
});

describe('FLUSH / dwie ściany naprzeciwległe', () => {
    it('wyrównuje ściany face-to-face (panelA uziemiony)', () => {
        const panelA = makeObjectState({
            id: 'panelA',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localFaces: new Map<number, [Vec3, Vec3]>([[0, [[0, 0, 500], [0, 0, 1]]]]),
        });
        const panelB = makeObjectState({
            id: 'panelB',
            location: [0, 0, 2000],
            rotation: [1, 0, 0, 0],
            localFaces: new Map<number, [Vec3, Vec3]>([[0, [[0, 0, -500], [0, 0, -1]]]]),
        });
        const bind = makeConstraintItem({
            constraintId: 'f1',
            bindType: 'FLUSH',
            objAId: 'panelA',
            objBId: 'panelB',
            faceA: 0,
            faceB: 0,
        });
        const states = statesOf(panelA, panelB);
        const contract = makeSolverContract({
            constraints: [bind],
            groundDistanceMap: { panelA: 0 },
        });

        const converged = solveConstraintsPure(contract, states, 40, RESIDUAL_TOLERANCE);

        expect(converged).toBe(true);
        expect(panelA.location).toEqual([0, 0, 0]);
        expect(panelB.location[2]).toBeCloseTo(1000);
        expect(computeConstraintResidual(bind, states).linearMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
    });
});

describe('Residual — rozdzielone jednostki', () => {
    it('GROUND VERTEX ma tylko składnik liniowy', () => {
        const state = makeObjectState({
            id: 'box',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localVertices: new Map<number, Vec3>([[0, [10, 0, 0]]]),
        });
        const bind = makeConstraintItem({
            constraintId: 'g1',
            bindType: 'GROUND',
            objAId: 'box',
            groundMode: 'VERTEX',
            vertA: 0,
            groundPos: [0, 0, 0],
        });

        const r = computeConstraintResidual(bind, statesOf(state));
        expect(r.linearMm).toBeCloseTo(10);
        expect(r.angularRad).toBe(0);
    });

    it('GROUND FACE rozdziela błąd pozycji i kąta', () => {
        const state = makeObjectState({
            id: 'panel',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localFaces: new Map<number, [Vec3, Vec3]>([[0, [[0, 0, 5], [0, 0, 1]]]]),
        });
        const bind = makeConstraintItem({
            constraintId: 'g1',
            bindType: 'GROUND',
            objAId: 'panel',
            groundMode: 'FACE',
            faceA: 0,
            groundPos: [0, 0, 0],
            groundNormal: [1, 0, 0],
        });

        const r = computeConstraintResidual(bind, statesOf(state));
        expect(r.linearMm).toBeCloseTo(5);
        expect(r.angularRad).toBeCloseTo(Math.PI / 2);
    });

    it('po zbieżności COPLANAR oba składniki są poniżej progu', () => {
        const panelA = makeObjectState({
            id: 'panelA',
            location: [0, 0, 0],
            rotation: [1, 0, 0, 0],
            localFaces: new Map<number, [Vec3, Vec3]>([[0, [[0, 0, 500], [0, 0, 1]]]]),
        });
        const panelB = makeObjectState({
            id: 'panelB',
            location: [0, 0, 2000],
            rotation: [0.70710678, 0.70710678, 0, 0],
            localFaces: new Map<number, [Vec3, Vec3]>([[0, [[0, 0, -500], [0, 0, -1]]]]),
        });
        const bind = makeConstraintItem({
            constraintId: 'c1',
            bindType: 'COPLANAR',
            objAId: 'panelA',
            objBId: 'panelB',
            faceA: 0,
            faceB: 0,
        });
        const states = statesOf(panelA, panelB);
        solveConstraintsPure(
            makeSolverContract({ constraints: [bind], groundDistanceMap: { panelA: 0 } }),
            states,
            40,
            RESIDUAL_TOLERANCE,
        );

        const r = computeConstraintResidual(bind, states);
        expect(r.linearMm).toBeLessThan(RESIDUAL_TOLERANCE.linearMm);
        expect(r.angularRad).toBeLessThan(1 * Math.PI / 180);
    });
});
