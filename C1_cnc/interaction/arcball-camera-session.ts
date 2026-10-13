/**
 * Arcball obiektu (jak w aplikacji testowej): obraca formatkę wokół pivota,
 * złota cięciwa + punkt środkowy + podgląd kąta.
 * Kamera stoi — ruch jest na meshu (dual do „obracana szklanej kuli”).
 */

import {
    computeArcballDelta,
    generateChordArcPoints,
    projectPointerToSphere,
    raySphereNearestHit,
    unitFromSphereHit,
    type Vec3,
} from './arcball-math.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { ContextManager } from '../../A1_core/context-manager.js';

declare const BABYLON: any;

export interface CameraRotationSession {
    begin(screenX: number, screenY: number): void;
    move(screenX: number, screenY: number): void;
    end(): void;
}

export type CameraRotationFactory = (
    camera: any,
    scene: any,
    canvas: HTMLCanvasElement
) => CameraRotationSession;

export type PanelViewGetter = () => { root: any; model?: any } | null | undefined;

const TUBE_RADIUS_MM = 2.5;
const PIVOT_DIA_MM = 10;
const HIT_DIA_MM = 8;
/** Min. promień pierścienia/cięciwy [mm] — jak w workbenchu. */
const RING_RADIUS_MIN_MM = 600;
/** Margines wokół „głębokości” formatki. */
const RING_RADIUS_MARGIN = 1.15;
const CHORD_NAME = '__cnc_arcball_chord';
const PIVOT_NAME = '__cnc_arcball_pivot';
const HIT_NAME = '__cnc_arcball_hit';
const RAY_NAME = '__cnc_arcball_ray';

interface DragState {
    pivot: Vec3;
    radiusWorld: number;
    screenRadiusPx: number;
    pivotScreenX: number;
    pivotScreenY: number;
    cameraRight: Vec3;
    cameraUp: Vec3;
    cameraForward: Vec3;
    startUnitVec: Vec3;
    /** Orientacja kostki na POINTERDOWN (kwaternion CSS/Babylon). */
    initialCubeQuat: any;
    spinHost: any;
    liveAngleDeg: number;
}

function vNorm(x: number, y: number, z: number): Vec3 {
    const len = Math.hypot(x, y, z);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    return { x: x / len, y: y / len, z: z / len };
}

function cameraBasis(camera: any): { right: Vec3; up: Vec3; forward: Vec3 } {
    const pos = camera.position;
    const target = camera.target;
    const upRaw = { x: 0, y: 1, z: 0 };
    let forward = vNorm(pos.x - target.x, pos.y - target.y, pos.z - target.z);
    if (Math.hypot(forward.x, forward.y, forward.z) < 1e-8) forward = { x: 0, y: 0, z: 1 };
    let right = vNorm(
        forward.y * upRaw.z - forward.z * upRaw.y,
        forward.z * upRaw.x - forward.x * upRaw.z,
        forward.x * upRaw.y - forward.y * upRaw.x
    );
    if (Math.hypot(right.x, right.y, right.z) < 1e-8) right = { x: 1, y: 0, z: 0 };
    const up = vNorm(
        right.y * forward.z - right.z * forward.y,
        right.z * forward.x - right.x * forward.z,
        right.x * forward.y - right.y * forward.x
    );
    return {
        right,
        up: Math.hypot(up.x, up.y, up.z) > 1e-8 ? up : upRaw,
        forward,
    };
}

function aabbCenterAndRadius(root: any): { center: Vec3; radius: number; extentsMm: number[] } {
    root.computeWorldMatrix(true);
    const bbox = root.getHierarchyBoundingVectors(true);
    const min = bbox.min;
    const max = bbox.max;
    const center = {
        x: (min.x + max.x) * 0.5,
        y: (min.y + max.y) * 0.5,
        z: (min.z + max.z) * 0.5,
    };
    const extentsMm = [max.x - min.x, max.y - min.y, max.z - min.z]
        .map((v: number) => Math.abs(v))
        .sort((a: number, b: number) => b - a);
    const radius = Math.max(Math.hypot(extentsMm[0], extentsMm[1], extentsMm[2]) * 0.5, 40);
    return { center, radius, extentsMm };
}

/**
 * Promień pierścieni / cięciwy [mm] — jak w workbenchu:
 *   Math.round(Math.max(depth * 1.15, 600))
 * „depth” = mniejszy z dwóch wymiarów lica (W/H), nie grubość.
 */
export function getRingRadiusMm(model: any | undefined, extentsMm?: number[]): number {
    let depthMm: number | null = null;

    if (model && typeof model.width === 'number' && typeof model.height === 'number') {
        const w = nmToMm(model.width);
        const h = nmToMm(model.height);
        if (w > 0 && h > 0) depthMm = Math.min(w, h);
    }

    if (!(depthMm != null && depthMm > 0) && extentsMm && extentsMm.length >= 2) {
        // extents posortowane malejąco: [długi, średni≈depth, grubość]
        depthMm = extentsMm[1];
    }

    if (!(depthMm != null && depthMm > 0)) depthMm = RING_RADIUS_MIN_MM / RING_RADIUS_MARGIN;

    return Math.round(Math.max(depthMm * RING_RADIUS_MARGIN, RING_RADIUS_MIN_MM));
}

function projectWorldToScreen(
    point: Vec3,
    canvas: HTMLCanvasElement,
    camera: any,
    scene: any
): { x: number; y: number } | null {
    try {
        if (typeof scene.updateTransformMatrix === 'function') {
            scene.updateTransformMatrix(true);
        }
        const transform = scene.getTransformMatrix?.();
        const engine = scene.getEngine?.();
        if (!transform?.m || !engine || !camera?.viewport) return null;
        const w = engine.getRenderWidth();
        const h = engine.getRenderHeight();
        if (!(w > 0) || !(h > 0)) return null;
        const vp = camera.viewport.toGlobal(w, h);
        const projected = BABYLON.Vector3.Project(
            new BABYLON.Vector3(point.x, point.y, point.z),
            BABYLON.Matrix.Identity(),
            transform,
            vp
        );
        if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
        return {
            x: projected.x * (canvas.clientWidth / w),
            y: projected.y * (canvas.clientHeight / h),
        };
    } catch {
        return null;
    }
}

function pivotOnScreen(canvas: HTMLCanvasElement, camera: any, pivot: Vec3, scene: any): { x: number; y: number } {
    return (
        projectWorldToScreen(pivot, canvas, camera, scene) ?? {
            x: Math.max(1, canvas.clientWidth) * 0.5,
            y: Math.max(1, canvas.clientHeight) * 0.5,
        }
    );
}

/** Dokładny rzut world-radius → px (bez sztucznego powiększania — musi = wizualna sfera). */
function computeScreenRadiusPx(
    canvas: HTMLCanvasElement,
    camera: any,
    scene: any,
    pivot: Vec3,
    worldRadius: number,
    cameraRight: Vec3
): number {
    const pivotScreen = pivotOnScreen(canvas, camera, pivot, scene);
    const edgeWorld = {
        x: pivot.x + cameraRight.x * worldRadius,
        y: pivot.y + cameraRight.y * worldRadius,
        z: pivot.z + cameraRight.z * worldRadius,
    };
    const edgeScreen = projectWorldToScreen(edgeWorld, canvas, camera, scene);
    if (edgeScreen) {
        const d = Math.hypot(edgeScreen.x - pivotScreen.x, edgeScreen.y - pivotScreen.y);
        if (d > 8) return d;
    }
    return Math.max(40, Math.min(canvas.clientWidth || 400, canvas.clientHeight || 400) * 0.35);
}

/**
 * Punkt na sferze POD kursorem: ray ∩ sfera.
 * Poza obrysem → Shoemake z promieniem = rzut tej samej sfery.
 */
function pointerToSphereUnit(
    screenX: number,
    screenY: number,
    camera: any,
    scene: any,
    pivot: Vec3,
    radiusWorld: number,
    pivotScreenX: number,
    pivotScreenY: number,
    screenRadiusPx: number,
    cameraRight: Vec3,
    cameraUp: Vec3,
    cameraForward: Vec3
): Vec3 {
    try {
        const ray = scene.createPickingRay(screenX, screenY, BABYLON.Matrix.Identity(), camera);
        if (ray?.origin && ray?.direction) {
            const hit = raySphereNearestHit(
                { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z },
                { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z },
                pivot,
                radiusWorld
            );
            if (hit) return unitFromSphereHit(pivot, hit);
        }
    } catch { /* fallback poniżej */ }

    return projectPointerToSphere(
        screenX,
        screenY,
        pivotScreenX,
        pivotScreenY,
        screenRadiusPx,
        cameraRight,
        cameraUp,
        cameraForward
    );
}

function babylonQuatFromAxisAngle(axis: Vec3, angleRad: number): any {
    return BABYLON.Quaternion.RotationAxis(
        new BABYLON.Vector3(axis.x, axis.y, axis.z),
        angleRad
    );
}

/**
 * Bazowa orientacja kostki = ta sama co CSS rotateX(β−90) rotateY(−(α+90)).
 * W CSS prawa→lewa: najpierw Y, potem X → q = qX * qY.
 */
function cubeQuatFromCamera(camera: any): any {
    const degX = (camera.beta * 180) / Math.PI - 90;
    const degY = -((camera.alpha * 180) / Math.PI + 90);
    const qY = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, (degY * Math.PI) / 180);
    const qX = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, (degX * Math.PI) / 180);
    return qX.multiply(qY);
}

/** Odczytaj aktualny kwaternion kostki (z poprzedniego gestu albo z kamery). */
function readInitialCubeQuat(camera: any): any {
    const vp = ContextManager.instance.viewport as any;
    const stored = vp?.__cncCubeQuat;
    if (stored && typeof stored.clone === 'function') {
        return stored.clone();
    }
    return cubeQuatFromCamera(camera);
}

/** Babylon quat → CSS matrix3d (bez translacji). */
function quatToCssMatrix3d(q: any): string {
    const mat = new BABYLON.Matrix();
    BABYLON.Matrix.FromQuaternionToRef(q, mat);
    const m = mat.m;
    // Babylon.m = wiersze; CSS matrix3d = kolumny → (_11,_21,_31, _12,_22,_32, _13,_23,_33)
    const n = (v: number) => (Math.abs(v) < 1e-10 ? 0 : Number(v.toFixed(6)));
    return `matrix3d(${n(m[0])},${n(m[4])},${n(m[8])},0,${n(m[1])},${n(m[5])},${n(m[9])},0,${n(m[2])},${n(m[6])},${n(m[10])},0,0,0,0,1)`;
}

/**
 * Kostka 1:1 z formatką: ten sam deltaQuat co spinHost.
 * Pełny kwaternion → brak blokad osi / skoków z alpha-beta.
 */
function syncViewCubeWithPanel(deltaQuat: any, initialCubeQuat: any): void {
    try {
        // Ten sam obrót co płyta (nie dual) — kostka „przyklejona” do formatki
        const q = deltaQuat.multiply(initialCubeQuat);
        const vp = ContextManager.instance.viewport as any;
        vp.__cncCubeQuat = q.clone?.() ?? q;
        vp?.setViewCubeCssTransform?.(quatToCssMatrix3d(q));
    } catch { /* ignore */ }
}

export class ArcballObjectSession implements CameraRotationSession {
    private state: DragState | null = null;
    private chord: any = null;
    private pivotMesh: any = null;
    private hitMesh: any = null;
    private rayStart: any = null;
    private rayEnd: any = null;
    private angleBadge: HTMLDivElement | null = null;
    private snapAngleDeg: number;
    private showSectorRays: boolean;

    constructor(
        private readonly camera: any,
        private readonly scene: any,
        private readonly canvas: HTMLCanvasElement,
        private readonly getPanelView: PanelViewGetter,
        opts?: { snapAngleDeg?: number; showSectorRays?: boolean }
    ) {
        this.snapAngleDeg = opts?.snapAngleDeg ?? 0;
        this.showSectorRays = opts?.showSectorRays ?? true;
    }

    begin(screenX: number, screenY: number): void {
        this.cleanupVisuals(false);
        this.bakePreviousSpinIfAny();

        const view = this.getPanelView();
        const root = view?.root;
        if (!root || root.isDisposed?.()) {
            this.state = null;
            return;
        }

        const { center, extentsMm } = aabbCenterAndRadius(root);
        const radiusWorld = getRingRadiusMm(view?.model, extentsMm);
        const { right, up, forward } = cameraBasis(this.camera);
        const pivotScreen = pivotOnScreen(this.canvas, this.camera, center, this.scene);
        // MUSI = wizualna sfera (bez sztucznego powiększania — inaczej cięciwa „w środku”)
        const screenRadiusPx = computeScreenRadiusPx(
            this.canvas,
            this.camera,
            this.scene,
            center,
            radiusWorld,
            right
        );

        const startUnitVec = pointerToSphereUnit(
            screenX,
            screenY,
            this.camera,
            this.scene,
            center,
            radiusWorld,
            pivotScreen.x,
            pivotScreen.y,
            screenRadiusPx,
            right,
            up,
            forward
        );

        const spinHost = new BABYLON.TransformNode(CHORD_NAME + '_host', this.scene);
        spinHost.position = new BABYLON.Vector3(center.x, center.y, center.z);
        spinHost.rotationQuaternion = BABYLON.Quaternion.Identity();
        root.setParent(spinHost, true);

        const initialCubeQuat = readInitialCubeQuat(this.camera);

        this.ensurePivotMarker(center);
        this.ensureAngleBadge();
        this.updateHitMarker(center, startUnitVec, radiusWorld);

        this.state = {
            pivot: center,
            radiusWorld,
            screenRadiusPx,
            pivotScreenX: pivotScreen.x,
            pivotScreenY: pivotScreen.y,
            cameraRight: right,
            cameraUp: up,
            cameraForward: forward,
            startUnitVec,
            initialCubeQuat,
            spinHost,
            liveAngleDeg: 0,
        };
    }

    move(screenX: number, screenY: number): void {
        if (!this.state?.spinHost) return;
        try {
            const curr = pointerToSphereUnit(
                screenX,
                screenY,
                this.camera,
                this.scene,
                this.state.pivot,
                this.state.radiusWorld,
                this.state.pivotScreenX,
                this.state.pivotScreenY,
                this.state.screenRadiusPx,
                this.state.cameraRight,
                this.state.cameraUp,
                this.state.cameraForward
            );
            const delta = computeArcballDelta(this.state.startUnitVec, curr, this.snapAngleDeg);
            if (!delta) return;

            this.state.spinHost.rotationQuaternion = babylonQuatFromAxisAngle(delta.axis, delta.angleRad);
            this.state.liveAngleDeg = (delta.angleRad * 180) / Math.PI;
            this.updateAngleBadge(this.state.liveAngleDeg);
            syncViewCubeWithPanel(
                this.state.spinHost.rotationQuaternion,
                this.state.initialCubeQuat
            );

            const arc = generateChordArcPoints(
                this.state.pivot,
                delta.axis,
                this.state.startUnitVec,
                delta.angleRad,
                this.state.radiusWorld,
                128
            );
            this.updateChord(arc);
            this.updateHitMarker(this.state.pivot, curr, this.state.radiusWorld);
            if (this.showSectorRays && arc.length >= 2) {
                this.updateRays(this.state.pivot, arc[0], arc[arc.length - 1]);
            }
        } catch (err) {
            console.warn('[ArcballObjectSession] move failed:', err);
        }
    }

    end(): void {
        this.bakeSpinToRoot();
        this.cleanupVisuals(true);
        this.state = null;
    }

    /** Zostaw obrót na root (world), usuń hosta — do czasu kolejnego sync CAD. */
    private bakeSpinToRoot(): void {
        const host = this.state?.spinHost;
        if (!host || host.isDisposed?.()) return;
        const children = host.getChildren?.() ?? [];
        for (const child of children) {
            try {
                child.setParent(null, true);
            } catch { /* ignore */ }
        }
        try {
            host.dispose();
        } catch { /* ignore */ }
    }

    private bakePreviousSpinIfAny(): void {
        // no-op: poprzedni end już wypiekł
    }

    private ensurePivotMarker(center: Vec3): void {
        this.disposeMesh(this.pivotMesh);
        try {
            this.pivotMesh = BABYLON.MeshBuilder.CreateSphere(
                PIVOT_NAME,
                { diameter: PIVOT_DIA_MM, segments: 12 },
                this.scene
            );
            this.pivotMesh.position = new BABYLON.Vector3(center.x, center.y, center.z);
            this.pivotMesh.isPickable = false;
            this.pivotMesh.renderingGroupId = 1;
            const mat = new BABYLON.StandardMaterial(PIVOT_NAME + '_mat', this.scene);
            mat.diffuseColor = new BABYLON.Color3(1, 0.85, 0.2);
            mat.emissiveColor = new BABYLON.Color3(0.7, 0.45, 0.05);
            mat.disableLighting = true;
            this.pivotMesh.material = mat;
        } catch {
            this.pivotMesh = null;
        }
    }

    /** Marker na powierzchni sfery w miejscu kursora (start / bieżący). */
    private updateHitMarker(center: Vec3, unit: Vec3, radiusWorld: number): void {
        const pos = {
            x: center.x + unit.x * radiusWorld,
            y: center.y + unit.y * radiusWorld,
            z: center.z + unit.z * radiusWorld,
        };
        if (!this.hitMesh || this.hitMesh.isDisposed?.()) {
            try {
                this.hitMesh = BABYLON.MeshBuilder.CreateSphere(
                    HIT_NAME,
                    { diameter: HIT_DIA_MM, segments: 10 },
                    this.scene
                );
                this.hitMesh.isPickable = false;
                this.hitMesh.renderingGroupId = 1;
                const mat = new BABYLON.StandardMaterial(HIT_NAME + '_mat', this.scene);
                mat.diffuseColor = new BABYLON.Color3(1, 0.4, 0.1);
                mat.emissiveColor = new BABYLON.Color3(0.9, 0.35, 0.05);
                mat.disableLighting = true;
                this.hitMesh.material = mat;
            } catch {
                this.hitMesh = null;
                return;
            }
        }
        this.hitMesh.position.set(pos.x, pos.y, pos.z);
    }

    private updateChord(points: Vec3[]): void {
        this.disposeMesh(this.chord);
        if (points.length < 2) return;
        try {
            const path = points.map((p) => new BABYLON.Vector3(p.x, p.y, p.z));
            this.chord = BABYLON.MeshBuilder.CreateTube(
                CHORD_NAME,
                { path, radius: TUBE_RADIUS_MM, tessellation: 16, updatable: false },
                this.scene
            );
            this.chord.isPickable = false;
            this.chord.renderingGroupId = 1;
            const mat = new BABYLON.StandardMaterial(CHORD_NAME + '_mat', this.scene);
            mat.diffuseColor = new BABYLON.Color3(1.0, 0.75, 0.15);
            mat.emissiveColor = new BABYLON.Color3(0.65, 0.4, 0.05);
            mat.disableLighting = true;
            this.chord.material = mat;
        } catch (err) {
            console.warn('[ArcballObjectSession] CreateTube failed, fallback lines:', err);
            try {
                const path = points.map((p) => new BABYLON.Vector3(p.x, p.y, p.z));
                this.chord = BABYLON.MeshBuilder.CreateLines(CHORD_NAME, { points: path }, this.scene);
                this.chord.color = new BABYLON.Color3(1.0, 0.75, 0.15);
                this.chord.isPickable = false;
            } catch {
                this.chord = null;
            }
        }
    }

    private updateRays(center: Vec3, a: Vec3, b: Vec3): void {
        this.disposeMesh(this.rayStart);
        this.disposeMesh(this.rayEnd);
        try {
            const c = new BABYLON.Vector3(center.x, center.y, center.z);
            this.rayStart = BABYLON.MeshBuilder.CreateLines(
                RAY_NAME + '_a',
                { points: [c, new BABYLON.Vector3(a.x, a.y, a.z)] },
                this.scene
            );
            this.rayEnd = BABYLON.MeshBuilder.CreateLines(
                RAY_NAME + '_b',
                { points: [c, new BABYLON.Vector3(b.x, b.y, b.z)] },
                this.scene
            );
            this.rayStart.color = new BABYLON.Color3(1.0, 0.85, 0.35);
            this.rayEnd.color = new BABYLON.Color3(1.0, 0.85, 0.35);
            this.rayStart.isPickable = false;
            this.rayEnd.isPickable = false;
        } catch {
            this.rayStart = null;
            this.rayEnd = null;
        }
    }

    private ensureAngleBadge(): void {
        if (this.angleBadge) return;
        const parent = this.canvas.parentElement;
        if (!parent) return;
        if (getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }
        const el = document.createElement('div');
        el.className = 'cnc-arcball-angle-badge';
        el.style.cssText = [
            'position:absolute',
            'top:16px',
            'left:50%',
            'transform:translateX(-50%)',
            'z-index:30',
            'pointer-events:none',
            'padding:10px 18px',
            'border-radius:14px',
            'background:rgba(0,0,0,0.82)',
            'border:1px solid rgba(245,158,11,0.55)',
            'color:#fbbf24',
            'font:600 18px/1.2 ui-monospace,Consolas,monospace',
            'display:none',
            'box-shadow:0 8px 28px rgba(0,0,0,0.45)',
        ].join(';');
        parent.appendChild(el);
        this.angleBadge = el;
    }

    private updateAngleBadge(angleDeg: number): void {
        if (!this.angleBadge) return;
        const sign = angleDeg > 0.05 ? '+' : '';
        this.angleBadge.style.display = 'block';
        this.angleBadge.textContent = `Arcball  ${sign}${angleDeg.toFixed(1)}°`;
    }

    private cleanupVisuals(removeBadge: boolean): void {
        this.disposeMesh(this.chord);
        this.chord = null;
        this.disposeMesh(this.pivotMesh);
        this.pivotMesh = null;
        this.disposeMesh(this.hitMesh);
        this.hitMesh = null;
        this.disposeMesh(this.rayStart);
        this.rayStart = null;
        this.disposeMesh(this.rayEnd);
        this.rayEnd = null;
        if (removeBadge && this.angleBadge) {
            this.angleBadge.remove();
            this.angleBadge = null;
        } else if (this.angleBadge) {
            this.angleBadge.style.display = 'none';
        }
    }

    private disposeMesh(mesh: any): void {
        if (!mesh) return;
        try {
            mesh.material?.dispose?.();
            mesh.dispose?.();
        } catch { /* ignore */ }
    }
}

/** Fabryka: ŚPM / Alt+LPM obraca formatkę (nie kamerę). */
export function createArcballCameraFactory(
    getPanelView?: PanelViewGetter,
    opts?: { snapAngleDeg?: number; showSectorRays?: boolean }
): CameraRotationFactory {
    const getter = getPanelView ?? (() => null);
    return (camera, scene, canvas) =>
        new ArcballObjectSession(camera, scene, canvas, getter, opts);
}
