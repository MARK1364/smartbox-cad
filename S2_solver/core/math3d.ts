/**
 * math3d.ts — czysta matematyka 3D dla solvera więzów.
 *
 * Zero zależności: czysta matematyka wektorowa i kwaternionowa.
 *
 * Konwencje typów:
 *   Vec3 = [x, y, z]
 *   Quat = [w, x, y, z]   (waga jako pierwszy element)
 *
 * Jednostki: funkcje są jednorodne względem skali. Rdzeń solvera pracuje w mm.
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number]; // w, x, y, z

function vecLen(v: Vec3): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function quatNormTo(q: Quat, out: Quat): Quat {
    const n = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    if (n < 1e-12) {
        out[0] = 1.0;
        out[1] = 0.0;
        out[2] = 0.0;
        out[3] = 0.0;
        return out;
    }
    out[0] = q[0] / n;
    out[1] = q[1] / n;
    out[2] = q[2] / n;
    out[3] = q[3] / n;
    return out;
}

export function quatNorm(q: Quat): Quat {
    return quatNormTo(q, [0.0, 0.0, 0.0, 0.0]);
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

export function quatMulTo(a: Quat, b: Quat, out: Quat): Quat {
    const aw = a[0], ax = a[1], ay = a[2], az = a[3];
    const bw = b[0], bx = b[1], by = b[2], bz = b[3];
    out[0] = aw * bw - ax * bx - ay * by - az * bz;
    out[1] = aw * bx + ax * bw + ay * bz - az * by;
    out[2] = aw * by - ax * bz + ay * bw + az * bx;
    out[3] = aw * bz + ax * by - ay * bx + az * bw;
    return out;
}

export function quatMul(a: Quat, b: Quat): Quat {
    return quatMulTo(a, b, [0.0, 0.0, 0.0, 0.0]);
}

export function quatConjugateTo(q: Quat, out: Quat): Quat {
    out[0] = q[0];
    out[1] = -q[1];
    out[2] = -q[2];
    out[3] = -q[3];
    return out;
}

export function quatConjugate(q: Quat): Quat {
    return quatConjugateTo(q, [0.0, 0.0, 0.0, 0.0]);
}

/** Obraca wektor v kwaternionem q (q * v * q^-1) in-place do out bez alokacji. */
export function rotateVec3ByQuatTo(v: Vec3, q: Quat, out: Vec3): Vec3 {
    let qw = q[0], qx = q[1], qy = q[2], qz = q[3];
    const n = Math.sqrt(qw * qw + qx * qx + qy * qy + qz * qz);
    if (n > 1e-12) {
        qw /= n; qx /= n; qy /= n; qz /= n;
    } else {
        qw = 1.0; qx = 0.0; qy = 0.0; qz = 0.0;
    }
    const vx = v[0], vy = v[1], vz = v[2];
    // t = 2 * cross(q.xyz, v)
    const tx = 2.0 * (qy * vz - qz * vy);
    const ty = 2.0 * (qz * vx - qx * vz);
    const tz = 2.0 * (qx * vy - qy * vx);
    // out = v + qw * t + cross(q.xyz, t)
    out[0] = vx + qw * tx + (qy * tz - qz * ty);
    out[1] = vy + qw * ty + (qz * tx - qx * tz);
    out[2] = vz + qw * tz + (qx * ty - qy * tx);
    return out;
}

/** Obraca wektor v kwaternionem q (q * v * q^-1). */
export function rotateVec3ByQuat(v: Vec3, q: Quat): Vec3 {
    return rotateVec3ByQuatTo(v, q, [0.0, 0.0, 0.0]);
}

export function localToWorldPointTo(localPoint: Vec3, location: Vec3, rotation: Quat, out: Vec3): Vec3 {
    rotateVec3ByQuatTo(localPoint, rotation, out);
    out[0] += location[0];
    out[1] += location[1];
    out[2] += location[2];
    return out;
}

export function localToWorldPoint(localPoint: Vec3, location: Vec3, rotation: Quat): Vec3 {
    return localToWorldPointTo(localPoint, location, rotation, [0.0, 0.0, 0.0]);
}

export function localToWorldNormalTo(normal: Vec3, rotation: Quat, out: Vec3): Vec3 {
    return rotateVec3ByQuatTo(normal, rotation, out);
}

export function localToWorldNormal(normal: Vec3, rotation: Quat): Vec3 {
    return localToWorldNormalTo(normal, rotation, [0.0, 0.0, 0.0]);
}

export function vec3SubTo(a: Vec3, b: Vec3, out: Vec3): Vec3 {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
    return vec3SubTo(a, b, [0.0, 0.0, 0.0]);
}

export function vec3AddTo(a: Vec3, b: Vec3, out: Vec3): Vec3 {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
}

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
    return vec3AddTo(a, b, [0.0, 0.0, 0.0]);
}

export function vec3ScaleTo(v: Vec3, s: number, out: Vec3): Vec3 {
    out[0] = v[0] * s;
    out[1] = v[1] * s;
    out[2] = v[2] * s;
    return out;
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
    return vec3ScaleTo(v, s, [0.0, 0.0, 0.0]);
}

export function vec3Dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Len(v: Vec3): number {
    return vecLen(v);
}

export function vec3NormalizeTo(v: Vec3, out: Vec3): Vec3 {
    const n = vecLen(v);
    if (n < 1e-12) {
        out[0] = 0.0;
        out[1] = 0.0;
        out[2] = 1.0;
        return out;
    }
    out[0] = v[0] / n;
    out[1] = v[1] / n;
    out[2] = v[2] / n;
    return out;
}

export function vec3Normalize(v: Vec3): Vec3 {
    return vec3NormalizeTo(v, [0.0, 0.0, 0.0]);
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
export function rotationBetweenNormalsTo(
    fromN: Vec3,
    toN: Vec3,
    out: Quat,
    tmpV0?: Vec3,
    tmpV1?: Vec3,
): Quat {
    const f = tmpV0 ? vec3NormalizeTo(fromN, tmpV0) : vec3Normalize(fromN);
    const t = tmpV1 ? vec3NormalizeTo(toN, tmpV1) : vec3Normalize(toN);
    const dot = vec3Dot(f, t);

    if (dot > NORMALS_PARALLEL_DOT) {
        out[0] = 1.0;
        out[1] = 0.0;
        out[2] = 0.0;
        out[3] = 0.0;
        return out;
    }

    if (dot < -NORMALS_PARALLEL_DOT) {
        // Wektory przeciwne (180°) — obrót wokół dowolnej osi prostopadłej.
        if (tmpV0) {
            findPerpendicularTo(f, tmpV0);
            out[0] = 0.0;
            out[1] = tmpV0[0];
            out[2] = tmpV0[1];
            out[3] = tmpV0[2];
        } else {
            const perp = findPerpendicular(f);
            out[0] = 0.0;
            out[1] = perp[0];
            out[2] = perp[1];
            out[3] = perp[2];
        }
        return out;
    }

    const cx = f[1] * t[2] - f[2] * t[1];
    const cy = f[2] * t[0] - f[0] * t[2];
    const cz = f[0] * t[1] - f[1] * t[0];

    out[0] = 1.0 + dot;
    out[1] = cx;
    out[2] = cy;
    out[3] = cz;
    return quatNormTo(out, out);
}

export function rotationBetweenNormals(fromN: Vec3, toN: Vec3): Quat {
    return rotationBetweenNormalsTo(fromN, toN, [0.0, 0.0, 0.0, 0.0]);
}

/** Stabilny numerycznie wektor prostopadły do v. */
export function findPerpendicularTo(v: Vec3, out: Vec3): Vec3 {
    const ax = Math.abs(v[0]);
    const ay = Math.abs(v[1]);
    const az = Math.abs(v[2]);
    if (ax <= ay && ax <= az) {
        out[0] = 0.0;
        out[1] = -v[2];
        out[2] = v[1];
    } else if (ay <= ax && ay <= az) {
        out[0] = -v[2];
        out[1] = 0.0;
        out[2] = v[0];
    } else {
        out[0] = -v[1];
        out[1] = v[0];
        out[2] = 0.0;
    }
    return vec3NormalizeTo(out, out);
}

export function findPerpendicular(v: Vec3): Vec3 {
    return findPerpendicularTo(v, [0.0, 0.0, 0.0]);
}

/**
 * Skaluje kwaternion o ułamek `frac` wokół osi obrotu (shortest path, w >= 0).
 * Port `_scaled_quat` z solver_core.py.
 */
export function scaledQuatTo(q: Quat, frac: number, out: Quat): Quat {
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
        out[0] = 1.0;
        out[1] = 0.0;
        out[2] = 0.0;
        out[3] = 0.0;
        return out;
    }

    const axisLen = Math.sqrt(x * x + y * y + z * z);
    if (axisLen < 1e-12) {
        out[0] = 1.0;
        out[1] = 0.0;
        out[2] = 0.0;
        out[3] = 0.0;
        return out;
    }

    const half = angle * frac * 0.5;
    const s = Math.sin(half) / axisLen;
    out[0] = Math.cos(half);
    out[1] = x * s;
    out[2] = y * s;
    out[3] = z * s;
    return out;
}

export function scaledQuat(q: Quat, frac: number): Quat {
    return scaledQuatTo(q, frac, [0.0, 0.0, 0.0, 0.0]);
}

export function applyRotationToQuatTo(objRot: Quat, deltaRot: Quat, out: Quat): Quat {
    quatMulTo(deltaRot, objRot, out);
    return quatNormTo(out, out);
}

export function applyRotationToQuat(objRot: Quat, deltaRot: Quat): Quat {
    return applyRotationToQuatTo(objRot, deltaRot, [0.0, 0.0, 0.0, 0.0]);
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
