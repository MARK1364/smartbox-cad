/**
 * Czysta matematyka arcballa (Ken Shoemake) — bez UI / Babylon.
 * Współrzędne: wektory jednostkowe w przestrzeni świata.
 */

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export function vec3(x: number, y: number, z: number): Vec3 {
    return { x, y, z };
}

export function vAdd(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vScale(a: Vec3, s: number): Vec3 {
    return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function vDot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vCross(a: Vec3, b: Vec3): Vec3 {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
    };
}

export function vLen(a: Vec3): number {
    return Math.hypot(a.x, a.y, a.z);
}

export function vNormalize(a: Vec3): Vec3 {
    const len = vLen(a);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    return vScale(a, 1 / len);
}

/** Kwaternion [x, y, z, w] */
export type Quat = { x: number; y: number; z: number; w: number };

export function quatIdentity(): Quat {
    return { x: 0, y: 0, z: 0, w: 1 };
}

/** Kwaternion obrotu wokół znormalizowanej osi o kąt [rad]. */
export function quatFromAxisAngle(axis: Vec3, angleRad: number): Quat {
    const half = angleRad * 0.5;
    const s = Math.sin(half);
    return {
        x: axis.x * s,
        y: axis.y * s,
        z: axis.z * s,
        w: Math.cos(half),
    };
}

/** Obraca wektor kwaternionem (q * v * q⁻¹). */
export function quatRotateVec(q: Quat, v: Vec3): Vec3 {
    const ix = q.w * v.x + q.y * v.z - q.z * v.y;
    const iy = q.w * v.y + q.z * v.x - q.x * v.z;
    const iz = q.w * v.z + q.x * v.y - q.y * v.x;
    const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
    return {
        x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
        y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
        z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
    };
}

/**
 * Rzutuje punkt ekranu na wirtualną sferę jednostkową (Shoemake).
 * cameraRight / cameraUp / cameraForward — baza kamery w przestrzeni świata.
 */
export function projectPointerToSphere(
    screenX: number,
    screenY: number,
    pivotScreenX: number,
    pivotScreenY: number,
    screenRadiusPx: number,
    cameraRight: Vec3,
    cameraUp: Vec3,
    cameraForward: Vec3
): Vec3 {
    const r = Math.max(screenRadiusPx, 1e-6);
    const dx = (screenX - pivotScreenX) / r;
    const dy = -(screenY - pivotScreenY) / r; // Y ekranu w dół
    const d2 = dx * dx + dy * dy;

    if (d2 > 1.0) {
        const invLen = 1.0 / Math.sqrt(d2);
        return vNormalize({
            x: dx * invLen * cameraRight.x + dy * invLen * cameraUp.x,
            y: dx * invLen * cameraRight.y + dy * invLen * cameraUp.y,
            z: dx * invLen * cameraRight.z + dy * invLen * cameraUp.z,
        });
    }

    const dz = Math.sqrt(1.0 - d2);
    return vNormalize({
        x: dx * cameraRight.x + dy * cameraUp.x + dz * cameraForward.x,
        y: dx * cameraRight.y + dy * cameraUp.y + dz * cameraForward.y,
        z: dx * cameraRight.z + dy * cameraUp.z + dz * cameraForward.z,
    });
}

/**
 * Najbliższe (od kamery) przecięcie promienia ze sferą.
 * Zwraca punkt na powierzchni albo null (promień mija sferę).
 */
export function raySphereNearestHit(
    rayOrigin: Vec3,
    rayDir: Vec3,
    center: Vec3,
    radius: number
): Vec3 | null {
    const dir = vNormalize(rayDir);
    if (vLen(dir) < 1e-12 || !(radius > 0)) return null;

    const oc = {
        x: rayOrigin.x - center.x,
        y: rayOrigin.y - center.y,
        z: rayOrigin.z - center.z,
    };
    const b = 2 * vDot(oc, dir);
    const c = vDot(oc, oc) - radius * radius;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;

    const sqrtDisc = Math.sqrt(disc);
    const t0 = (-b - sqrtDisc) * 0.5;
    const t1 = (-b + sqrtDisc) * 0.5;
    // Najbliższy dodatni t (przednia ściana sfery od kamery)
    let t = t0 > 1e-6 ? t0 : t1 > 1e-6 ? t1 : -1;
    if (t < 0) return null;

    return {
        x: rayOrigin.x + dir.x * t,
        y: rayOrigin.y + dir.y * t,
        z: rayOrigin.z + dir.z * t,
    };
}

/** Wektor jednostkowy od środka do hit-a na sferze. */
export function unitFromSphereHit(center: Vec3, hit: Vec3): Vec3 {
    return vNormalize({
        x: hit.x - center.x,
        y: hit.y - center.y,
        z: hit.z - center.z,
    });
}

export interface ArcballDelta {
    axis: Vec3;
    angleRad: number;
    quat: Quat;
}

/**
 * Delta obrotu od wektora startowego do bieżącego na sferze.
 * Zwraca null, gdy kąt jest znikomy.
 */
export function computeArcballDelta(
    startUnit: Vec3,
    currUnit: Vec3,
    snapAngleDeg: number = 0
): ArcballDelta | null {
    const axisRaw = vCross(startUnit, currUnit);
    const axisLen = vLen(axisRaw);
    if (axisLen < 1e-6) return null;

    const axis = vScale(axisRaw, 1 / axisLen);
    const dot = Math.max(-1, Math.min(1, vDot(startUnit, currUnit)));
    let angleRad = Math.acos(dot);

    if (snapAngleDeg > 0) {
        const snapRad = (snapAngleDeg * Math.PI) / 180;
        angleRad = Math.round(angleRad / snapRad) * snapRad;
    }

    return { axis, angleRad, quat: quatFromAxisAngle(axis, angleRad) };
}

/**
 * Punkty łuku koła wielkiego (cięciwy) na sferze o środku `center` i promieniu `radius`.
 *
 * Gładkość zależy od:
 * - `segments` / gęstości kątowej (ile punktów na 180°)
 * - długości łuku (krótki kąt i tak dostaje min. punktów)
 * - przy tubie: też `tessellation` (przekrój rury)
 */
export function generateChordArcPoints(
    center: Vec3,
    axis: Vec3,
    v0: Vec3,
    angleRad: number,
    radius: number,
    segments: number = 96
): Vec3[] {
    const points: Vec3[] = [];
    const absAngle = Math.abs(angleRad);
    // ~1.5° na segment + minimum 32 punkty (nawet przy małym kącie)
    const byAngle = Math.round((absAngle / Math.PI) * segments);
    const byStep = Math.round(absAngle / ((1.5 * Math.PI) / 180));
    const count = Math.max(32, byAngle, byStep);

    for (let i = 0; i <= count; i++) {
        const t = i / count;
        const stepAngle = angleRad * t;
        const qStep = quatFromAxisAngle(axis, stepAngle);
        const ptUnit = quatRotateVec(qStep, v0);
        points.push({
            x: center.x + ptUnit.x * radius,
            y: center.y + ptUnit.y * radius,
            z: center.z + ptUnit.z * radius,
        });
    }

    return points;
}
