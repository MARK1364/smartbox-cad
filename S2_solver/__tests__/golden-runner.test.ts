/**
 * Golden testy solvera — port @@BLENDER/S2_solver/tests/golden_runner.py
 *
 * Uruchom: npx vitest run S2_solver  (z katalogu web/)
 *
 * Pliki w `golden/` są DOSŁOWNĄ kopią fixtures z Pythona, więc ich długości są
 * w metrach. Rdzeń solvera pracuje w milimetrach, dlatego loader skaluje ×1000
 * wszystko, co jest długością: `location`, `local_vertices`, środki w
 * `local_faces`, `ground_pos`, `offset` oraz `tolerances.position`.
 * Normalne, kwaterniony i `tolerances.angle_deg` zostają bez zmian.
 *
 * Trzymamy fixtures w metrach celowo: jeśli port zacznie zwracać inne wyniki
 * niż Blender, ten sam plik da się uruchomić w Pythonie i w TS i porównać bez
 * zastanawiania się, czy różnica nie wynikła z przeliczenia jednostek.
 *
 * `golden_runner.py` woła solver z max_iterations=20 i convergence_threshold=1e-7
 * (metry) — tutaj odpowiada temu { linearMm: 1e-4, angularRad: 1e-7 }.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import {
    makeConstraintItem,
    makeObjectState,
    makeSolverContract,
    type BindType,
    type GroundMode,
    type ObjectState,
    type SolverContract,
} from '../core/contract.js';
import {
    IMPLEMENTED_BIND_TYPES,
    solveConstraintsPure,
    type SolverTolerance,
} from '../core/solver-core.js';
import { rotationsCompatiblePure, vec3Len, vec3Sub, type Quat, type Vec3 } from '../core/math3d.js';

const M_TO_MM = 1000;
const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), 'golden');
const TOLERANCE: SolverTolerance = { linearMm: 1e-4, angularRad: 1e-7 };
const MAX_ITERATIONS = 20;

interface GoldenExpectation {
    location?: number[];
    rotation?: number[];
}

interface GoldenCase {
    name: string;
    contract: SolverContract;
    initialStates: Map<string, ObjectState>;
    expected: Record<string, GoldenExpectation>;
    posTolMm: number;
    angleTolDeg: number;
    /** Typy więzów w pliku, których ten etap portu jeszcze nie rozwiązuje. */
    unimplemented: BindType[];
}

function vec3FromMeters(raw: unknown, fallback: Vec3): Vec3 {
    if (!Array.isArray(raw)) {
        return fallback;
    }
    return [raw[0] * M_TO_MM, raw[1] * M_TO_MM, raw[2] * M_TO_MM];
}

function vec3Raw(raw: unknown, fallback: Vec3): Vec3 {
    if (!Array.isArray(raw)) {
        return fallback;
    }
    return [raw[0], raw[1], raw[2]];
}

function quatRaw(raw: unknown, fallback: Quat): Quat {
    if (!Array.isArray(raw)) {
        return fallback;
    }
    return [raw[0], raw[1], raw[2], raw[3]];
}

function loadCase(filename: string): GoldenCase {
    const data = JSON.parse(readFileSync(join(GOLDEN_DIR, filename), 'utf-8'));

    const constraints = (data.contract?.constraints ?? []).map((c: any) =>
        makeConstraintItem({
            constraintId: c.constraint_id,
            bindType: c.bind_type as BindType,
            enabled: c.enabled ?? true,
            objAId: c.obj_a_id ?? '',
            objBId: c.obj_b_id ?? '',
            vertA: c.vert_a ?? -1,
            vertB: c.vert_b ?? -1,
            faceA: c.face_a ?? -1,
            faceB: c.face_b ?? -1,
            groundMode: (c.ground_mode ?? 'VERTEX') as GroundMode,
            groundPos: vec3FromMeters(c.ground_pos, [0, 0, 0]),
            groundNormal: vec3Raw(c.ground_normal, [0, 0, 1]),
            offset: (c.offset ?? 0.0) * M_TO_MM,
        }),
    );

    const contract = makeSolverContract({
        constraints,
        groundDistanceMap: data.contract?.ground_distance_map ?? {},
    });

    const initialStates = new Map<string, ObjectState>();
    for (const [objId, s] of Object.entries<any>(data.initial_states ?? {})) {
        const localVertices = new Map<number, Vec3>();
        for (const [k, v] of Object.entries<any>(s.local_vertices ?? {})) {
            localVertices.set(Number(k), vec3FromMeters(v, [0, 0, 0]));
        }

        const localFaces = new Map<number, [Vec3, Vec3]>();
        for (const [k, v] of Object.entries<any>(s.local_faces ?? {})) {
            localFaces.set(Number(k), [
                vec3FromMeters(v[0], [0, 0, 0]),
                vec3Raw(v[1], [0, 0, 1]),
            ]);
        }

        initialStates.set(
            objId,
            makeObjectState({
                id: s.id,
                location: vec3FromMeters(s.location, [0, 0, 0]),
                rotation: quatRaw(s.rotation, [1, 0, 0, 0]),
                localVertices,
                localFaces,
            }),
        );
    }

    const tolerances = data.tolerances ?? {};
    const unimplemented = [
        ...new Set<BindType>(
            constraints
                .filter((c) => !IMPLEMENTED_BIND_TYPES.has(c.bindType))
                .map((c) => c.bindType),
        ),
    ];

    return {
        name: data.name ?? filename,
        contract,
        initialStates,
        expected: data.expected_results ?? {},
        posTolMm: (tolerances.position ?? 0.0001) * M_TO_MM,
        angleTolDeg: tolerances.angle_deg ?? 0.01,
        unimplemented,
    };
}

const caseFiles = readdirSync(GOLDEN_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

describe('Golden cases', () => {
    for (const filename of caseFiles) {
        const testCase = loadCase(filename);
        const title = `${filename}: ${testCase.name}`;

        if (testCase.unimplemented.length > 0) {
            it.skip(`${title} — czeka na port: ${testCase.unimplemented.join(', ')}`, () => {});
            continue;
        }

        it(title, () => {
            solveConstraintsPure(
                testCase.contract,
                testCase.initialStates,
                MAX_ITERATIONS,
                TOLERANCE,
            );

            for (const [objId, exp] of Object.entries(testCase.expected)) {
                const state = testCase.initialStates.get(objId);
                expect(state, `Brak obiektu ${objId} w wynikach solvera`).toBeDefined();

                if (exp.location) {
                    const expectedLoc = vec3FromMeters(exp.location, state!.location);
                    const delta = vec3Len(vec3Sub(state!.location, expectedLoc));
                    expect(
                        delta,
                        `${objId} location: ${state!.location} != ${expectedLoc}`,
                    ).toBeLessThanOrEqual(testCase.posTolMm);
                }

                if (exp.rotation) {
                    const expectedRot = quatRaw(exp.rotation, state!.rotation);
                    expect(
                        rotationsCompatiblePure(state!.rotation, expectedRot, testCase.angleTolDeg),
                        `${objId} rotation: ${state!.rotation} != ${expectedRot}`,
                    ).toBe(true);
                }
            }
        });
    }
});
