/**
 * math3d.ts — czysta matematyka 3D dla solvera więzów.
 * Port 1:1 z @@BLENDER/S2_solver/core/math3d.py
 *
 * Zero importów: brak Babylona, brak A1_core/cad-math. Ten plik musi dać się
 * uruchomić w Node bez żadnego kontekstu aplikacji (golden testy).
 *
 * Konwencje przeniesione z Pythona bez zmian:
 *   Vec3 = [x, y, z]
 *   Quat = [w, x, y, z]   ← UWAGA: inna kolejność niż A1_core/cad-math/Quat (x,y,z,w).
 *                            Konwersja należy do adaptera, nie do rdzenia.
 *
 * Jednostki: funkcje są jednorodne względem skali (poza normalizacjami, które
 * są skalo-niezmienne), więc działają tak samo w metrach i w milimetrach.
 * Rdzeń solvera pracuje w mm.
 *
 * Pythonowe helpery `_as_vec3` / `_as_quat` pominięto — pełniły rolę rzutowania
 * dowolnego iterowalnego na krotkę, co w TS zapewnia system typów.
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number]; // w, x, y, z

function vecLen(v: Vec3): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function quatNorm(q: Quat): Quat {
    const n = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    if (n < 1e-12) {
        return [1.0, 0.0, 0.0, 0.0];
    }
    return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

export function quatDot(a: Quat, b: Quat): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
    const qa = quatNorm(a);
    let qb = quatNorm(b);
    let dot = quatDot(qa, qb);

    if (dot < 0.0) {
        qb = [-qb[0], -qb[1], -qb[2], -qb[3]];
        dot = -dot;
    }

    if (dot > 0.99995) {
        const blended: Quat = [
            qa[0] + t * (qb[0] - qa[0]),
            qa[1] + t * (qb[1] - qa[1]),
            qa[2] + t * (qb[2] - qa[2]),
            qa[3] + t * (qb[3] - qa[3]),
        ];
        return quatNorm(blended);
    }

    const theta0 = Math.acos(Math.max(Math.min(dot, 1.0), -1.0));
    const sinTheta0 = Math.sin(theta0);
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);

    const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
    const s1 = sinTheta / sinTheta0;
    return quatNorm([
        s0 * qa[0] + s1 * qb[0],
        s0 * qa[1] + s1 * qb[1],
        s0 * qa[2] + s1 * qb[2],
        s0 * qa[3] + s1 * qb[3],
    ]);
}

/** Normalizacja z fallbackiem dla wektora bliskiego zeru. */
export function safeNormalize(vec: Vec3, fallback: Vec3): Vec3 {
    const n = vecLen(vec);
    if (n < 1e-4) {
        return fallback;
    }
    return [vec[0] / n, vec[1] / n, vec[2] / n];
}

/**
 * Uśrednianie kwaternionów przyrostowym SLERP-em.
 * Zmienna waga t = 1/i eliminuje bias pierwszeństwa.
 */
export function averageQuaternions(quats: Quat[]): Quat {
    if (quats.length === 0) {
        return [1.0, 0.0, 0.0, 0.0];
    }

    let avg = quats[0];
    for (let idx = 1; idx < quats.length; idx++) {
        const i = idx + 1; // Python: enumerate(quats[1:], start=2)
        avg = quatSlerp(avg, quats[idx], 1.0 / i);
    }
    return avg;
}

// ============================================================================
// TRANSFORMACJE PRZESTRZENNE
// ============================================================================

function quatMul(a: Quat, b: Quat): Quat {
    const [aw, ax, ay, az] = a;
    const [bw, bx, by, bz] = b;
    return [
        aw * bw - ax * bx - ay * by - az * bz,
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
    ];
}

function quatConjugate(q: Quat): Quat {
    return [q[0], -q[1], -q[2], -q[3]];
}

/** Obraca wektor v kwaternionem q (q * v * q^-1). */
export function rotateVec3ByQuat(v: Vec3, q: Quat): Vec3 {
    const qn = quatNorm(q);
    const vq: Quat = [0.0, v[0], v[1], v[2]];
    const tmp = quatMul(qn, vq);
    const res = quatMul(tmp, quatConjugate(qn));
    return [res[1], res[2], res[3]];
}

export function localToWorldPoint(localPoint: Vec3, location: Vec3, rotation: Quat): Vec3 {
    const rotated = rotateVec3ByQuat(localPoint, rotation);
    return [
        rotated[0] + location[0],
        rotated[1] + location[1],
        rotated[2] + location[2],
    ];
}

export function localToWorldNormal(normal: Vec3, rotation: Quat): Vec3 {
    return rotateVec3ByQuat(normal, rotation);
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
    return [v[0] * s, v[1] * s, v[2] * s];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Len(v: Vec3): number {
    return vecLen(v);
}

export function vec3Normalize(v: Vec3): Vec3 {
    const n = vecLen(v);
    if (n < 1e-12) {
        return [0.0, 0.0, 1.0];
    }
    return [v[0] / n, v[1] / n, v[2] / n];
}

/**
 * Cosinus, poniżej którego (co do |1 − cos|) normalne traktujemy jako równoległe.
 * Stary próg `0.9999999` zostawiał acos ≈ 0,026° — UI pokazywał „kąt 0,02”
 * i „Niespełnione”, bo `RESIDUAL_TOLERANCE.angularRad` to 5e-6 rad (0,0003°).
 * `1 − 1e-12` zamyka resztę do ~0,00008°, czyli pod próg zbieżności.
 */
const NORMALS_PARALLEL_DOT = 1 - 1e-12;

/**
 * Kwaternion obrotu między dwoma wektorami, przez tożsamość połowy kąta —
 * bez acos() i sin() w przypadku ogólnym.
 */
export function rotationBetweenNormals(fromN: Vec3, toN: Vec3): Quat {
    const f = vec3Normalize(fromN);
    const t = vec3Normalize(toN);
    const dot = vec3Dot(f, t);

    if (dot > NORMALS_PARALLEL_DOT) {
        return [1.0, 0.0, 0.0, 0.0];
    }

    if (dot < -NORMALS_PARALLEL_DOT) {
        // Wektory przeciwne (180°) — obrót wokół dowolnej osi prostopadłej.
        const perp = findPerpendicular(f);
        return [0.0, perp[0], perp[1], perp[2]];
    }

    const cx = f[1] * t[2] - f[2] * t[1];
    const cy = f[2] * t[0] - f[0] * t[2];
    const cz = f[0] * t[1] - f[1] * t[0];

    return quatNorm([1.0 + dot, cx, cy, cz]);
}

/** Stabilny numerycznie wektor prostopadły do v. */
export function findPerpendicular(v: Vec3): Vec3 {
    const ax = Math.abs(v[0]);
    const ay = Math.abs(v[1]);
    const az = Math.abs(v[2]);
    let perp: Vec3;
    if (ax <= ay && ax <= az) {
        perp = [0.0, -v[2], v[1]];
    } else if (ay <= ax && ay <= az) {
        perp = [-v[2], 0.0, v[0]];
    } else {
        perp = [-v[1], v[0], 0.0];
    }
    return vec3Normalize(perp);
}

/**
 * Skaluje kwaternion o ułamek `frac` wokół osi obrotu (shortest path, w >= 0).
 * Port `_scaled_quat` z solver_core.py.
 */
export function scaledQuat(q: Quat, frac: number): Quat {
    let w = q[0];
    let x = q[1];
    let y = q[2];
    let z = q[3];

    if (w < 0.0) {
        w = -w;
        x = -x;
        y = -y;
        z = -z;
    }

    w = Math.min(Math.max(w, -1.0), 1.0);
    const angle = 2.0 * Math.acos(w);
    if (angle < 1e-9) {
        return [1.0, 0.0, 0.0, 0.0];
    }

    const axisLen = Math.sqrt(x * x + y * y + z * z);
    if (axisLen < 1e-12) {
        return [1.0, 0.0, 0.0, 0.0];
    }

    const half = angle * frac * 0.5;
    const s = Math.sin(half) / axisLen;
    return [Math.cos(half), x * s, y * s, z * s];
}

export function applyRotationToQuat(objRot: Quat, deltaRot: Quat): Quat {
    return quatNorm(quatMul(deltaRot, objRot));
}

export function rotationsCompatiblePure(
    rotA: Quat,
    rotB: Quat,
    toleranceDegrees: number = 0.01,
): boolean {
    let d = Math.abs(
        rotA[0] * rotB[0] + rotA[1] * rotB[1] + rotA[2] * rotB[2] + rotA[3] * rotB[3],
    );
    d = Math.min(d, 1.0);
    const angleRad = 2.0 * Math.acos(d);
    const toleranceRad = (toleranceDegrees * Math.PI) / 180.0;
    return angleRad <= toleranceRad;
}
