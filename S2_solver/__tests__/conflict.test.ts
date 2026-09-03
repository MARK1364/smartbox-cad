/**
 * Testy wygaszania sprzecznych więzów — port test_conflict.py
 */

import { describe, it, expect } from 'vitest';
import {
    makeConstraintItem,
    makeObjectState,
    makeSolverContract,
    type ObjectState,
} from '../core/contract.js';
import type { Vec3 } from '../core/math3d.js';
import {
    CONFLICT_RESIDUAL_THRESHOLD_MM,
    computeConstraintResidual,
    getFaceWorldData,
    solveWithConflictResolution,
} from '../core/solver-core.js';

function makeCabinetState(
    id: string,
    location: Vec3,
    halfHeightMm: number,
    bottomVertIdx: number = 0,
    topFaceIdx: number = 0,
): ObjectState {
    return makeObjectState({
        id,
        location,
        rotation: [1, 0, 0, 0],
        localVertices: new Map<number, Vec3>([[bottomVertIdx, [-500, -500, -halfHeightMm]]]),
        localFaces: new Map<number, [Vec3, Vec3]>([[topFaceIdx, [[0, 0, halfHeightMm], [0, 0, 1]]]]),
    });
}

describe('Wygaszanie konfliktów', () => {
    const vertexBind = makeConstraintItem({
        constraintId: 'c_vertex',
        bindType: 'VERTEX',
        objAId: 'cabA',
        objBId: 'cabB',
        vertA: 0,
        vertB: 0,
    });
    const coplanarBind = makeConstraintItem({
        constraintId: 'c_coplanar',
        bindType: 'COPLANAR',
        objAId: 'cabA',
        objBId: 'cabB',
        faceA: 0,
        faceB: 0,
        offset: 25,
    });

    it('VERTEX i COPLANAR z offsetem 0 — oba się zbiegają, oba zostają', () => {
        const contract = makeSolverContract({
            constraints: [vertexBind, coplanarBind],
            groundDistanceMap: { cabA: 0, cabB: 1 },
        });
        const states = new Map<string, ObjectState>([
            ['cabA', makeCabinetState('cabA', [0, 0, 0], 500)],
            ['cabB', makeCabinetState('cabB', [0, 0, 0], 500)],
        ]);
        coplanarBind.offset = 0;

        const [, conflictCount] = solveWithConflictResolution(contract, states);

        expect(conflictCount).toBe(0);
        expect(coplanarBind.conflict).toBe(false);
        expect(vertexBind.conflict).toBe(false);
        expect(computeConstraintResidual(vertexBind, states).linearMm).toBeLessThanOrEqual(
            CONFLICT_RESIDUAL_THRESHOLD_MM,
        );
        expect(computeConstraintResidual(coplanarBind, states).linearMm).toBeLessThanOrEqual(
            CONFLICT_RESIDUAL_THRESHOLD_MM,
        );
    });

    it('VERTEX pierwszy, potem FLUSH na tych samych ścianach — gdy się wykluczają, późniejszy odpada', () => {
        const flushBind = makeConstraintItem({
            constraintId: 'c_flush',
            bindType: 'FLUSH',
            objAId: 'cabA',
            objBId: 'cabB',
            faceA: 0,
            faceB: 0,
        });
        const contract = makeSolverContract({
            constraints: [vertexBind, flushBind],
            groundDistanceMap: { cabA: 0, cabB: 1 },
        });
        const states = new Map<string, ObjectState>([
            ['cabA', makeCabinetState('cabA', [0, 0, 0], 500)],
            ['cabB', makeCabinetState('cabB', [1200, 0, 0], 500)],
        ]);

        const [, conflictCount] = solveWithConflictResolution(contract, states);

        expect(conflictCount).toBe(1);
        expect(vertexBind.conflict).toBe(false);
        expect(flushBind.conflict).toBe(true);
        expect(computeConstraintResidual(vertexBind, states).linearMm).toBeLessThanOrEqual(
            CONFLICT_RESIDUAL_THRESHOLD_MM,
        );
    });

    it('flaga konfliktu resetuje się gdy sprzeczność znika', () => {
        coplanarBind.conflict = true;
        coplanarBind.offset = 0;
        const contract = makeSolverContract({
            constraints: [vertexBind, coplanarBind],
            groundDistanceMap: { cabA: 0, cabB: 1 },
        });
        const states = new Map<string, ObjectState>([
            ['cabA', makeCabinetState('cabA', [0, 0, 0], 500)],
            ['cabB', makeCabinetState('cabB', [0, 0, 0], 500)],
        ]);

        const [, conflictCount] = solveWithConflictResolution(contract, states);

        expect(conflictCount).toBe(0);
        expect(coplanarBind.conflict).toBe(false);
    });

    it('GROUND nigdy nie jest wygaszany', () => {
        const ground = makeConstraintItem({
            constraintId: 'c_ground',
            bindType: 'GROUND',
            objAId: 'cabA',
            groundMode: 'OBJECT',
            groundPos: [0, 0, 0],
        });
        const contract = makeSolverContract({
            constraints: [ground, vertexBind, coplanarBind],
            groundDistanceMap: { cabA: 0, cabB: 1 },
        });
        const states = new Map<string, ObjectState>([
            ['cabA', makeCabinetState('cabA', [100, 0, 0], 500)],
            ['cabB', makeCabinetState('cabB', [0, 0, 0], 600)],
        ]);

        solveWithConflictResolution(contract, states);

        expect(ground.conflict).toBe(false);
    });

    it('GROUND + VERTEX to normalny układ bez konfliktu', () => {
        const ground = makeConstraintItem({
            constraintId: 'c_ground',
            bindType: 'GROUND',
            objAId: 'cabA',
            groundMode: 'OBJECT',
            groundPos: [0, 0, 0],
        });
        const vertexOnly = makeConstraintItem({
            constraintId: 'c_vertex_only',
            bindType: 'VERTEX',
            objAId: 'cabA',
            objBId: 'cabB',
            vertA: 0,
            vertB: 0,
        });
        const contract = makeSolverContract({
            constraints: [ground, vertexOnly],
            groundDistanceMap: { cabA: 0, cabB: 1 },
        });
        const states = new Map<string, ObjectState>([
            ['cabA', makeCabinetState('cabA', [0, 0, 0], 500)],
            ['cabB', makeCabinetState('cabB', [500, 0, 0], 500)],
        ]);

        const [, conflictCount] = solveWithConflictResolution(contract, states);

        expect(conflictCount).toBe(0);
        expect(vertexOnly.conflict).toBe(false);
        expect(computeConstraintResidual(vertexOnly, states).linearMm).toBeLessThanOrEqual(
            CONFLICT_RESIDUAL_THRESHOLD_MM,
        );
    });

    it('dwa COPLANAR na różnych ścianach — zbiegają się razem, oba zostają', () => {
        const front = makeConstraintItem({
            constraintId: 'c_front',
            bindType: 'COPLANAR',
            objAId: 'cabA',
            objBId: 'cabB',
            faceA: 0,
            faceB: 0,
        });
        const bottom = makeConstraintItem({
            constraintId: 'c_bottom',
            bindType: 'COPLANAR',
            objAId: 'cabA',
            objBId: 'cabB',
            faceA: 1,
            faceB: 1,
        });
        const contract = makeSolverContract({
            constraints: [front, bottom],
            groundDistanceMap: { cabA: 0, cabB: 1 },
        });
        const states = new Map<string, ObjectState>([
            [
                'cabA',
                makeObjectState({
                    id: 'cabA',
                    location: [0, 0, 0],
                    rotation: [1, 0, 0, 0],
                    localFaces: new Map([
                        [0, [[0, -250, 360], [0, -1, 0]]],
                        [1, [[0, 0, 0], [0, 0, -1]]],
                    ]),
                }),
            ],
            [
                'cabB',
                makeObjectState({
                    id: 'cabB',
                    location: [200, -80, 90],
                    rotation: [0.96, 0.2, 0, 0.1],
                    localFaces: new Map([
                        [0, [[0, -250, 360], [0, -1, 0]]],
                        [1, [[0, 0, 0], [0, 0, -1]]],
                    ]),
                }),
            ],
        ]);

        const [, conflictCount] = solveWithConflictResolution(contract, states, 80);
        expect(conflictCount).toBe(0);
        expect(front.conflict).toBe(false);
        expect(bottom.conflict).toBe(false);
    });

    it('dwa VERTEX na tych samych narożnikach — późniejszy wygaszany', () => {
        const first = makeConstraintItem({
            constraintId: 'v1',
            bindType: 'VERTEX',
            objAId: 'cabA',
            objBId: 'cabB',
            vertA: 0,
            vertB: 0,
        });
        const second = makeConstraintItem({
            constraintId: 'v2',
            bindType: 'VERTEX',
            objAId: 'cabA',
            objBId: 'cabB',
            vertA: 0,
            vertB: 0,
        });
        const contract = makeSolverContract({
            constraints: [first, second],
            groundDistanceMap: { cabA: 0, cabB: 1 },
        });
        const states = new Map<string, ObjectState>([
            ['cabA', makeCabinetState('cabA', [0, 0, 0], 500)],
            ['cabB', makeCabinetState('cabB', [800, 0, 0], 500)],
        ]);

        const [, conflictCount] = solveWithConflictResolution(contract, states);

        expect(conflictCount).toBe(0);
        expect(first.conflict).toBe(false);
        expect(second.conflict).toBe(false);
        expect(computeConstraintResidual(first, states).linearMm).toBeLessThanOrEqual(
            CONFLICT_RESIDUAL_THRESHOLD_MM,
        );
    });

    it('FLUSH z offsetem 100 mm, potem VERTEX — pierwszy zostaje, naroże nie psuje odstępu', () => {
        const flushBind = makeConstraintItem({
            constraintId: 'c_flush_first',
            bindType: 'FLUSH',
            objAId: 'cabA',
            objBId: 'cabB',
            faceA: 0,
            faceB: 0,
            offset: 100,
        });
        const laterVertex = makeConstraintItem({
            constraintId: 'c_vertex_later',
            bindType: 'VERTEX',
            objAId: 'cabA',
            objBId: 'cabB',
            vertA: 0,
            vertB: 0,
        });
        const contract = makeSolverContract({
            constraints: [flushBind, laterVertex],
            groundDistanceMap: { cabA: 0, cabB: 1 },
            lockedIds: new Set(['cabA']),
        });
        const states = new Map<string, ObjectState>([
            [
                'cabA',
                makeObjectState({
                    id: 'cabA',
                    location: [0, 0, 0],
                    rotation: [1, 0, 0, 0],
                    localVertices: new Map<number, Vec3>([[0, [300, -250, 0]]]),
                    localFaces: new Map<number, [Vec3, Vec3]>([[0, [[300, 0, 360], [1, 0, 0]]]]),
                }),
            ],
            [
                'cabB',
                makeObjectState({
                    id: 'cabB',
                    location: [700, 0, 0],
                    rotation: [1, 0, 0, 0],
                    localVertices: new Map<number, Vec3>([[0, [-300, 80, 40]]]),
                    localFaces: new Map<number, [Vec3, Vec3]>([[0, [[-300, 0, 360], [-1, 0, 0]]]]),
                }),
            ],
        ]);

        const [, conflictCount] = solveWithConflictResolution(contract, states, 80);

        expect(conflictCount).toBe(1);
        expect(flushBind.conflict).toBe(false);
        expect(laterVertex.conflict).toBe(true);
        expect(computeConstraintResidual(flushBind, states).linearMm).toBeLessThanOrEqual(
            CONFLICT_RESIDUAL_THRESHOLD_MM,
        );
        const cabB = states.get('cabB')!;
        expect(cabB.location[0]).toBeCloseTo(700, 5);
        expect(cabB.location[1]).toBeCloseTo(0, 5);
        expect(cabB.location[2]).toBeCloseTo(0, 5);
        const [centerA, normA] = getFaceWorldData(states.get('cabA')!, 0);
        const [centerB] = getFaceWorldData(cabB, 0);
        const gap =
            (centerB[0] - centerA[0]) * normA[0] +
            (centerB[1] - centerA[1]) * normA[1] +
            (centerB[2] - centerA[2]) * normA[2];
        expect(Math.abs(gap - 100)).toBeLessThan(1);
    });

    it('konflikt coplanar vs flush na tej samej parze', () => {
        const coplanar = makeConstraintItem({
            constraintId: 'c_same_coplanar',
            bindType: 'COPLANAR',
            objAId: 'cabA',
            objBId: 'cabB',
            faceA: 0,
            faceB: 0,
        });
        const flush = makeConstraintItem({
            constraintId: 'c_same_flush',
            bindType: 'FLUSH',
            objAId: 'cabA',
            objBId: 'cabB',
            faceA: 0,
            faceB: 0,
        });
        const contract = makeSolverContract({
            constraints: [coplanar, flush],
            groundDistanceMap: { cabA: 0, cabB: 1 },
        });
        const states = new Map<string, ObjectState>([
            ['cabA', makeCabinetState('cabA', [0, 0, 0], 500)],
            ['cabB', makeCabinetState('cabB', [0, 0, 200], 500)],
        ]);

        const [, conflictCount] = solveWithConflictResolution(contract, states);

        expect(conflictCount).toBe(1);
        expect(coplanar.conflict).toBe(false);
        expect(flush.conflict).toBe(true);
    });
});
