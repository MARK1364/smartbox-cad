/**
 * PMI Offset Drag — TypeScript / Babylon.js
 *
 * Wspólna matematyka wyciągania linii wymiarowej myszą. Używana przy tworzeniu
 * wymiaru (`DimensionTool`) oraz przy jego późniejszej edycji (`PMIEditOffsetTool`),
 * żeby oba tryby zachowywały się identycznie.
 *
 * Tryb FREE odpowiada Blenderowi (`_free_drag_bias_world`): bez biasu kursor
 * startujący blisko krawędzi daje zerową składową prostopadłą i wymiar „klei
 * się" do krawędzi. Blokada X/Y/Z liczy delta względem punktu startu drag.
 */

declare const BABYLON: any;

import { Vec3, v3, v3Add, v3Copy, v3Dot, v3Len, v3Normalize, v3Scale, v3Sub } from './dimension-solver';
import { cadAxisKeyToRenderDirection, cadAxesFromRenderMatrix } from '../A1_core/cad-math/coord-system.js';

export interface OffsetDragInput {
    scene: any;
    anchor1World: Vec3;
    anchor2World: Vec3;
    /** Oś, do której należy ograniczyć odsunięcie (skrót X/Y/Z). */
    axisConstraintWorld?: Vec3 | null;
    /** Trafienie na płaszczyznę drag w chwili rozpoczęcia przeciągania. */
    dragStartHitWorld?: Vec3 | null;
    /** Offset w chwili rozpoczęcia przeciągania. */
    dragStartOffsetWorld?: Vec3 | null;
    /** Bias trybu FREE — utrzymuje linię wymiarową pod kursorem od miejsca startu. */
    freeDragBiasWorld?: Vec3 | null;
}

/** Środek odcinka pomiarowego. */
export function measureMidpoint(anchor1World: Vec3, anchor2World: Vec3): Vec3 {
    return v3Scale(v3Add(anchor1World, anchor2World), 0.5);
}

/** Składowa wektora prostopadła do kierunku wymiaru. */
export function perpendicularToDimension(
    vector: Vec3,
    anchor1World: Vec3,
    anchor2World: Vec3,
): Vec3 {
    const dimDir = v3Sub(anchor2World, anchor1World);
    const dimDirNorm = v3Len(dimDir) > 1e-6 ? v3Normalize(dimDir) : v3(1, 0, 0);
    const parallel = v3Scale(dimDirNorm, v3Dot(vector, dimDirNorm));
    return v3Sub(vector, parallel);
}

/**
 * Bias dla trybu FREE (odpowiednik `_free_drag_bias_world` w Blenderze).
 * Przy starcie drag: offset = perp(hit-mid) + bias daje spójny punkt wyjścia.
 */
export function computeFreeDragBias(
    anchor1World: Vec3,
    anchor2World: Vec3,
    dragStartHitWorld: Vec3,
    dragStartOffsetWorld: Vec3,
): Vec3 {
    const mid = measureMidpoint(anchor1World, anchor2World);
    const startPerp = perpendicularToDimension(v3Sub(dragStartHitWorld, mid), anchor1World, anchor2World);
    return v3Sub(dragStartOffsetWorld, startPerp);
}

/** Normalna płaszczyzny drag — kierunek widoku (od sceny do kamery). */
function dragPlaneNormal(scene: any): Vec3 | null {
    const camera = scene?.activeCamera;
    if (!camera) return null;

    if (typeof camera.getForwardRay === 'function') {
        const fwd = camera.getForwardRay().direction;
        const len = Math.hypot(fwd.x, fwd.y, fwd.z);
        if (len > 1e-6) {
            // Normalna w stronę kamery (jak view_dir w Blenderze).
            return v3(-fwd.x / len, -fwd.y / len, -fwd.z / len);
        }
    }

    const camPos = camera.globalPosition || camera.position;
    const target = camera.target ?? camPos;
    const dx = camPos.x - target.x;
    const dy = camPos.y - target.y;
    const dz = camPos.z - target.z;
    const len = Math.hypot(dx, dy, dz);
    if (len <= 1e-6) return v3(0, 0, 1);
    return v3(dx / len, dy / len, dz / len);
}

/**
 * Punkt przecięcia promienia spod kursora z płaszczyzną widoku.
 *
 * Płaszczyzna jest prostopadła do kierunku kamery i przechodzi przez `planePoint`.
 */
export function pointerOnDragPlane(scene: any, planePoint: Vec3): Vec3 | null {
    const camera = scene?.activeCamera;
    if (!camera) return null;

    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, null, camera);
    if (!ray) return null;

    let planeNormal = dragPlaneNormal(scene);
    if (!planeNormal) planeNormal = v3(0, 0, 1);

    const planePointBV = new BABYLON.Vector3(planePoint.x, planePoint.y, planePoint.z);
    let normalBV = new BABYLON.Vector3(planeNormal.x, planeNormal.y, planeNormal.z);

    let dist = ray.intersectsPlane(BABYLON.Plane.FromPositionAndNormal(planePointBV, normalBV));
    if (dist === null || dist <= 0) {
        dist = ray.intersectsPlane(BABYLON.Plane.FromPositionAndNormal(planePointBV, normalBV.scale(-1)));
    }

    const rayOrigin = v3(ray.origin.x, ray.origin.y, ray.origin.z);
    const rayDir = v3Normalize(v3(ray.direction.x, ray.direction.y, ray.direction.z));

    if (dist !== null && dist > 0) {
        return v3Add(rayOrigin, v3Scale(rayDir, dist));
    }

    // Promień równoległy do płaszczyzny — rzutujemy punkt odniesienia na promień.
    const t = v3Dot(v3Sub(planePoint, rayOrigin), rayDir);
    return v3Add(rayOrigin, v3Scale(rayDir, Math.max(t, 10)));
}

/**
 * Wyznacza wektor odsunięcia linii wymiarowej dla bieżącej pozycji kursora.
 */
export function computeOffsetFromPointer(input: OffsetDragInput): Vec3 | null {
    const { scene, anchor1World, anchor2World } = input;

    const mid = measureMidpoint(anchor1World, anchor2World);
    const hit = pointerOnDragPlane(scene, mid);
    if (!hit) return null;

    const axis = input.axisConstraintWorld;
    const axisLen = axis ? v3Len(axis) : 0;

    if (axis && axisLen > 1e-6) {
        // Blokada osi: delta względem punktu startu (jak forced_axis w Blenderze).
        const axisNorm = v3Normalize(axis);
        const startHit = input.dragStartHitWorld ?? hit;
        const startOff = input.dragStartOffsetWorld ?? v3(0, 0, 0);
        const rawDelta = v3Sub(hit, startHit);
        const scalar = v3Dot(startOff, axisNorm) + v3Dot(rawDelta, axisNorm);
        return v3Scale(axisNorm, scalar);
    }

    // Tryb FREE: składowa prostopadła + bias startowy.
    const rel = v3Sub(hit, mid);
    const perp = perpendicularToDimension(rel, anchor1World, anchor2World);
    const bias = input.freeDragBiasWorld ?? v3(0, 0, 0);
    return v3Add(perp, bias);
}

/** Przygotowuje stan kotwicy dragu na początku przeciągania offsetu. */
export function beginOffsetDragState(
    scene: any,
    anchor1World: Vec3,
    anchor2World: Vec3,
    dragStartOffsetWorld: Vec3 = v3(0, 0, 0),
): {
    dragStartHitWorld: Vec3;
    dragStartOffsetWorld: Vec3;
    freeDragBiasWorld: Vec3;
} {
    const mid = measureMidpoint(anchor1World, anchor2World);
    const dragStartHitWorld = pointerOnDragPlane(scene, mid) ?? v3Copy(mid);
    const freeDragBiasWorld = computeFreeDragBias(
        anchor1World,
        anchor2World,
        dragStartHitWorld,
        dragStartOffsetWorld,
    );
    return {
        dragStartHitWorld,
        dragStartOffsetWorld: v3Copy(dragStartOffsetWorld),
        freeDragBiasWorld,
    };
}

/** Kierunek świata dla skrótu osi X/Y/Z w nomenklaturze CAD (nie surowy Babylon). */
export function axisVectorWorld(
    axisKey: string,
    axisSpace: string,
    matrixWorld: number[] | null,
): Vec3 | null {
    const key = (axisKey || '').toUpperCase();
    if (!['X', 'Y', 'Z'].includes(key)) return null;

    const useLocal = (axisSpace || 'GLOBAL').toUpperCase() === 'LOCAL' && matrixWorld;
    if (!useLocal) {
        const dir = cadAxisKeyToRenderDirection(key);
        return v3(dir.x, dir.y, dir.z);
    }

    const cadAxes = cadAxesFromRenderMatrix(matrixWorld);
    const chosen = cadAxes[key as 'X' | 'Y' | 'Z'];
    const vec = v3(chosen.x, chosen.y, chosen.z);
    return v3Len(vec) > 1e-6 ? v3Normalize(vec) : null;
}
