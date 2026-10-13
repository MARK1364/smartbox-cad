/**
 * constraint-highlight.ts — overlay 3D podświetlenia więzu.
 *
 * A = cyjan, B = żółty, GROUND = magenta. Overlay na klikniętej formatce;
 * solver przesuwa korpus, do którego formatka należy.
 *
 * Odświeżanie jest złączane do jednej klatki (rAF), a stare meshe/materiały
 * są dispose'owane dopiero po renderze — unikamy WebGL
 * `uniformMatrix4fv: location is not from the associated program` przy solve.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { cadToRender } from '../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { ConstraintStore } from './constraint-store.js';
import {
    localMmToWorldMm,
    resolveAnchor,
    resolveAnchorQuadMm,
    resolveGeomNode,
} from './constraint-geometry.js';
import type { ConstraintAnchor, SolverConstraint } from './constraint-types.js';

declare const BABYLON: any;

const COLOR_A = { r: 0.05, g: 0.85, b: 0.95, a: 0.42 };
const COLOR_B = { r: 0.95, g: 0.85, b: 0.08, a: 0.42 };
const COLOR_GROUND = { r: 0.95, g: 0.12, b: 0.85, a: 0.45 };
const COLOR_VERTEX_LINK = { r: 0.05, g: 0.92, b: 0.98, a: 0.9 };

export class ConstraintHighlightOverlay {
    private static _instance: ConstraintHighlightOverlay | null = null;

    static get instance(): ConstraintHighlightOverlay {
        if (!ConstraintHighlightOverlay._instance) {
            ConstraintHighlightOverlay._instance = new ConstraintHighlightOverlay();
        }
        return ConstraintHighlightOverlay._instance;
    }

    private _ids = new Set<string>();
    private _meshes: any[] = [];
    private _pendingDispose: any[] = [];
    private _offDoc: (() => void) | null = null;
    private _rafRefresh: number | null = null;
    private _afterRenderObs: any = null;
    private _disposeFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    private _rubberBandConstraintId: string | null = null;
    private _rubberBandMesh: any = null;
    private _pointerObserver: any = null;

    get ids(): ReadonlySet<string> {
        return this._ids;
    }

    setHighlighted(ids: Iterable<string>): void {
        this._ids = new Set(ids);
        this.refresh();
        this._listenDocument();
    }

    toggle(id: string): boolean {
        if (this._ids.has(id)) {
            this._ids.delete(id);
        } else {
            this._ids.add(id);
        }
        this.refresh();
        this._listenDocument();
        return this._ids.has(id);
    }

    clear(): void {
        this.stopVertexRubberBand();
        this._ids.clear();
        this._cancelScheduledRefresh();
        this._retireMeshes();
        this._scheduleDeferredDispose();
    }

    /** Publiczne API: najwyżej jedno przebudowanie na klatkę. */
    refresh(): void {
        if (this._rafRefresh != null) {
            return;
        }
        const raf =
            typeof requestAnimationFrame === 'function'
                ? requestAnimationFrame
                : (cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number;
        this._rafRefresh = raf(() => {
            this._rafRefresh = null;
            this._refreshNow();
        });
    }

    private _cancelScheduledRefresh(): void {
        if (this._rafRefresh == null) {
            return;
        }
        if (typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this._rafRefresh);
        } else {
            clearTimeout(this._rafRefresh);
        }
        this._rafRefresh = null;
    }

    private _refreshNow(): void {
        this._retireMeshes();
        const doc = ContextManager.instance.document;
        const scene = ContextManager.instance.viewport?.scene;
        if (!doc || !scene || this._ids.size === 0) {
            this._scheduleDeferredDispose();
            return;
        }

        for (const id of this._ids) {
            const constraint = ConstraintStore.instance.get(id);
            if (!constraint) {
                continue;
            }
            this._drawConstraint(scene, doc, constraint);
        }
        this._scheduleDeferredDispose();
        ContextManager.instance.viewport?.requestRender?.(2);
    }

    private _listenDocument(): void {
        if (this._offDoc) {
            return;
        }
        const doc = ContextManager.instance.document;
        if (!doc?.onDocumentChanged) {
            return;
        }
        this._offDoc = doc.onDocumentChanged(() => {
            if (this._ids.size > 0) {
                this.refresh();
            }
        });
    }

    private _drawConstraint(scene: any, doc: any, constraint: SolverConstraint): void {
        const ground = constraint.bindType === 'GROUND';
        const arrowMode: 'outward' | 'touching' | null =
            constraint.bindType === 'COPLANAR'
                ? 'outward'
                : constraint.bindType === 'FLUSH'
                  ? 'touching'
                  : null;
        if (constraint.anchorA) {
            this._drawAnchor(scene, doc, constraint.anchorA, ground ? COLOR_GROUND : COLOR_A, arrowMode);
        }
        if (!ground && constraint.anchorB) {
            this._drawAnchor(scene, doc, constraint.anchorB, COLOR_B, arrowMode);
        }
        if (constraint.bindType === 'VERTEX' && constraint.anchorA && constraint.anchorB) {
            const posA = this._resolveAnchorRenderWorldPoint(doc, constraint.anchorA);
            const posB = this._resolveAnchorRenderWorldPoint(doc, constraint.anchorB);
            if (posA && posB) {
                this._addConnectingTube(scene, posA, posB, COLOR_VERTEX_LINK);
            }
        }
    }

    /**
     * Podgląd rysowany z tej samej rozwiązanej kotwicy, którą dostaje solver
     * (LCS bryły sztywnej). Dzięki temu podświetlenie nie może pokazać innej
     * ściany niż ta, którą solver faktycznie liczy.
     */
    private _drawAnchor(
        scene: any,
        doc: any,
        anchor: ConstraintAnchor,
        color: typeof COLOR_A,
        arrowMode: 'outward' | 'touching' | null = null,
    ): void {
        if (anchor.kind === 'DATUM' || String(anchor.nodeId || '').startsWith('__DATUM__:')) {
            const n = (anchor.localNormalMm || [0, 0, 1]) as number[];
            const c = (anchor.quadCenterMm || anchor.localPointMm || [0, 0, 0]) as number[];
            // Osie U/V w płaszczyźnie (dowolna baza ortogonalna)
            const absN = n.map(Math.abs);
            const helper = absN[0] < 0.9 ? [1, 0, 0] : [0, 1, 0];
            const u = [
                helper[1] * n[2] - helper[2] * n[1],
                helper[2] * n[0] - helper[0] * n[2],
                helper[0] * n[1] - helper[1] * n[0],
            ];
            const uLen = Math.hypot(u[0], u[1], u[2]) || 1;
            const uAxis = [u[0] / uLen, u[1] / uLen, u[2] / uLen];
            const v = [
                n[1] * uAxis[2] - n[2] * uAxis[1],
                n[2] * uAxis[0] - n[0] * uAxis[2],
                n[0] * uAxis[1] - n[1] * uAxis[0],
            ];
            this._addPlaneWorldCad(
                scene,
                c,
                n,
                uAxis,
                v,
                anchor.quadWidthMm || 500,
                anchor.quadHeightMm || 500,
                color,
                arrowMode,
            );
            return;
        }

        const body = doc.findNode?.(anchor.nodeId);
        if (!body) {
            return;
        }
        const geom = anchor.sourceNodeId
            ? (doc.findNode?.(anchor.sourceNodeId) ?? resolveGeomNode(body, anchor))
            : body;

        if (anchor.kind === 'FACE') {
            const quad = resolveAnchorQuadMm(body, anchor, geom);
            if (quad) {
                this._addPlaneWorld(
                    scene,
                    body,
                    quad.center,
                    quad.normal,
                    quad.uAxis,
                    quad.vAxis,
                    quad.width,
                    quad.height,
                    color,
                    arrowMode,
                );
                return;
            }
        }

        const resolved = resolveAnchor(body, anchor, geom);
        if (!resolved) {
            return;
        }
        this._addPointWorld(scene, body, resolved.localPointMm, color);
    }

    private _cadLocalDirToRenderWorld(node: any, localDir: number[]): Vec3 {
        const { rotation } = node.getWorldMatrix().decompose();
        const worldCad = rotation.rotateVec3(new Vec3(localDir[0], localDir[1], localDir[2])).normalize();
        return cadToRender(worldCad).normalize();
    }

    private _addPlaneWorld(
        scene: any,
        node: any,
        localCenterMm: number[],
        localNormal: number[],
        localU: number[],
        localV: number[],
        width: number,
        height: number,
        color: typeof COLOR_A,
        arrowMode: 'outward' | 'touching' | null = null,
    ): void {
        const mesh = BABYLON.MeshBuilder.CreatePlane(
            'solver_hl_face',
            { width, height, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
            scene,
        );
        const mat = new BABYLON.StandardMaterial('solver_hl_face_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.emissiveColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.alpha = color.a;
        mat.backFaceCulling = false;
        mat.disableDepthWrite = true;
        mat.zOffset = -2;
        mesh.material = mat;
        mesh.isPickable = false;
        mesh.renderingGroupId = 1;
        mesh.parent = null;

        const worldCad = localMmToWorldMm(node, localCenterMm as [number, number, number]);
        const pos = cadToRender(worldCad);
        mesh.position.set(pos.x, pos.y, pos.z);

        const x = this._cadLocalDirToRenderWorld(node, localU);
        const y = this._cadLocalDirToRenderWorld(node, localV);
        const z = this._cadLocalDirToRenderWorld(node, localNormal);
        this._orientPlaneFromAxes(mesh, x, y, z);
        this._meshes.push(mesh);

        if (arrowMode) {
            this._addNormalArrowChild(scene, mesh, color, arrowMode);
        }
    }

    /** Płaszczyzna wprost w CAD WCS (datum — bez węzła). */
    private _addPlaneWorldCad(
        scene: any,
        centerCadMm: number[],
        normalCad: number[],
        uCad: number[],
        vCad: number[],
        width: number,
        height: number,
        color: typeof COLOR_A,
        arrowMode: 'outward' | 'touching' | null = null,
    ): void {
        const mesh = BABYLON.MeshBuilder.CreatePlane(
            'solver_hl_datum',
            { width, height, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
            scene,
        );
        const mat = new BABYLON.StandardMaterial('solver_hl_datum_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.emissiveColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.alpha = color.a;
        mat.backFaceCulling = false;
        mat.disableDepthWrite = true;
        mat.zOffset = -2;
        mesh.material = mat;
        mesh.isPickable = false;
        mesh.renderingGroupId = 1;

        const pos = cadToRender(new Vec3(centerCadMm[0], centerCadMm[1], centerCadMm[2]));
        mesh.position.set(pos.x, pos.y, pos.z);
        const x = cadToRender(new Vec3(uCad[0], uCad[1], uCad[2])).normalize();
        const y = cadToRender(new Vec3(vCad[0], vCad[1], vCad[2])).normalize();
        const z = cadToRender(new Vec3(normalCad[0], normalCad[1], normalCad[2])).normalize();
        this._orientPlaneFromAxes(mesh, x, y, z);
        this._meshes.push(mesh);

        if (arrowMode) {
            this._addNormalArrowChild(scene, mesh, color, arrowMode);
        }
    }

    /**
     * Strzałka wektora normalnego ściany (podpowiedź dla relacji COPLANAR / FLUSH).
     * Osadzona jako dziecko płaszczyzny w osi +Z (kierunek normalnej).
     * - 'outward' (COPLANAR): trzonek od z=0 do 32, grot od 32 do 46 (wskazuje na zewnątrz).
     * - 'touching' (FLUSH): trzonek od z=-46 do -14, grot od -14 do 0 (czubek styka się z płaszczyzną z=0).
     */
    private _addNormalArrowChild(
        scene: any,
        parentMesh: any,
        color: typeof COLOR_A,
        arrowMode: 'outward' | 'touching' = 'outward',
    ): void {
        if (!parentMesh || typeof BABYLON === 'undefined' || !BABYLON.MeshBuilder) {
            return;
        }
        const shaftLen = 32;
        const headLen = 14;
        const shaftDia = 2.8;
        const headDia = 7.5;

        const isTouching = arrowMode === 'touching';
        const shaftCenterZ = isTouching ? -headLen - shaftLen / 2 : shaftLen / 2;
        const headCenterZ = isTouching ? -headLen / 2 : shaftLen + headLen / 2;

        const mat = new BABYLON.StandardMaterial('solver_arrow_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.emissiveColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.alpha = 0.95;
        mat.disableDepthWrite = true;
        mat.zOffset = -4;

        const shaft = BABYLON.MeshBuilder.CreateCylinder(
            'solver_arrow_shaft',
            { height: shaftLen, diameter: shaftDia },
            scene,
        );
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = shaftCenterZ;
        shaft.material = mat;
        shaft.isPickable = false;
        shaft.renderingGroupId = 1;
        shaft.parent = parentMesh;
        this._meshes.push(shaft);

        const head = BABYLON.MeshBuilder.CreateCylinder(
            'solver_arrow_head',
            { height: headLen, diameterTop: 0, diameterBottom: headDia },
            scene,
        );
        head.rotation.x = Math.PI / 2;
        head.position.z = headCenterZ;
        head.material = mat;
        head.isPickable = false;
        head.renderingGroupId = 1;
        head.parent = parentMesh;
        this._meshes.push(head);
    }

    private _addPointWorld(scene: any, node: any, localMm: number[], color: typeof COLOR_A): void {
        const mesh = BABYLON.MeshBuilder.CreateSphere('solver_hl_pt', { diameter: 12 }, scene);
        const mat = new BABYLON.StandardMaterial('solver_hl_pt_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.emissiveColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.alpha = 0.9;
        mesh.material = mat;
        mesh.isPickable = false;
        mesh.renderingGroupId = 1;
        mesh.parent = null;

        const worldCad = localMmToWorldMm(node, localMm as [number, number, number]);
        const pos = cadToRender(worldCad);
        mesh.position.set(pos.x, pos.y, pos.z);
        this._meshes.push(mesh);
    }

    private _resolveAnchorRenderWorldPoint(doc: any, anchor: ConstraintAnchor): Vec3 | null {
        if (!anchor || anchor.kind === 'DATUM' || String(anchor.nodeId || '').startsWith('__DATUM__:')) {
            return null;
        }
        const body = doc.findNode?.(anchor.nodeId);
        if (!body) {
            return null;
        }
        const geom = anchor.sourceNodeId
            ? (doc.findNode?.(anchor.sourceNodeId) ?? resolveGeomNode(body, anchor))
            : body;
        const resolved = resolveAnchor(body, anchor, geom);
        if (!resolved) {
            return null;
        }
        const worldCad = localMmToWorldMm(body, resolved.localPointMm as [number, number, number]);
        return cadToRender(worldCad);
    }

    /**
     * Rurka 3D łącząca wskazane narożniki (dla relacji VERTEX / Połącz narożnikami).
     */
    private _addConnectingTube(
        scene: any,
        posA: Vec3,
        posB: Vec3,
        color: typeof COLOR_A,
    ): void {
        if (typeof BABYLON === 'undefined' || !BABYLON.MeshBuilder) {
            return;
        }
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dz = posB.z - posA.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 1.0) {
            return;
        }

        const pA = new BABYLON.Vector3(posA.x, posA.y, posA.z);
        const pB = new BABYLON.Vector3(posB.x, posB.y, posB.z);

        const mat = new BABYLON.StandardMaterial('solver_link_tube_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.emissiveColor = new BABYLON.Color3(color.r * 0.8, color.g * 0.8, color.b * 0.8);
        mat.alpha = 0.9;
        mat.disableDepthWrite = true;
        mat.zOffset = -3;

        let mesh: any = null;
        if (typeof BABYLON.MeshBuilder.CreateTube === 'function') {
            mesh = BABYLON.MeshBuilder.CreateTube(
                'solver_hl_vertex_tube',
                {
                    path: [pA, pB],
                    radius: 2.2,
                    tessellation: 12,
                    sideOrientation: BABYLON.Mesh.DOUBLESIDE,
                },
                scene,
            );
        } else if (typeof BABYLON.MeshBuilder.CreateCylinder === 'function') {
            mesh = BABYLON.MeshBuilder.CreateCylinder(
                'solver_hl_vertex_tube',
                { height: dist, diameter: 4.4 },
                scene,
            );
            mesh.position.set((posA.x + posB.x) / 2, (posA.y + posB.y) / 2, (posA.z + posB.z) / 2);
            const up = new BABYLON.Vector3(0, 1, 0);
            const dir = new BABYLON.Vector3(dx / dist, dy / dist, dz / dist);
            const axis = BABYLON.Vector3.Cross(up, dir);
            const dot = up.x * dir.x + up.y * dir.y + up.z * dir.z;
            if (axis.lengthSquared() > 1e-6) {
                const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                if (BABYLON.Quaternion?.RotationAxis) {
                    mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), angle);
                }
            } else if (dot < 0) {
                mesh.rotation.x = Math.PI;
            }
        }

        if (mesh) {
            mesh.material = mat;
            mesh.isPickable = false;
            mesh.renderingGroupId = 1;
            this._meshes.push(mesh);
        }
    }

    /**
     * Uruchamia dynamiczną rurkę łączącą Narożnik A z aktualną pozycją wskaźnika myszy w 3D.
     */
    startVertexRubberBand(constraintId: string): void {
        this.stopVertexRubberBand();
        this._rubberBandConstraintId = constraintId;
        const scene = ContextManager.instance.viewport?.scene;
        if (!scene || !scene.onPointerObservable) {
            return;
        }
        this._pointerObserver = scene.onPointerObservable.add((pointerInfo: any) => {
            if (pointerInfo.type === (BABYLON?.PointerEventTypes?.POINTERMOVE ?? 4)) {
                this._updateRubberBand(scene, pointerInfo);
            }
        });
        this._updateRubberBand(scene);
    }

    /**
     * Zatrzymuje i usuwa dynamiczną rurkę śledzącą wskaźnik myszy.
     */
    stopVertexRubberBand(): void {
        const scene = ContextManager.instance.viewport?.scene;
        if (this._pointerObserver && scene?.onPointerObservable) {
            scene.onPointerObservable.remove(this._pointerObserver);
            this._pointerObserver = null;
        }
        if (this._rubberBandMesh) {
            try {
                this._rubberBandMesh.dispose();
            } catch {
                /* ignore */
            }
            this._rubberBandMesh = null;
        }
        this._rubberBandConstraintId = null;
        ContextManager.instance.viewport?.requestRender?.(2);
    }

    private _updateRubberBand(scene: any, pointerInfo?: any): void {
        if (!this._rubberBandConstraintId) {
            return;
        }
        const constraint = ConstraintStore.instance.get(this._rubberBandConstraintId);
        if (!constraint || constraint.bindType !== 'VERTEX' || !constraint.anchorA) {
            this.stopVertexRubberBand();
            return;
        }
        const doc = ContextManager.instance.document;
        const posA = this._resolveAnchorRenderWorldPoint(doc, constraint.anchorA);
        if (!posA) {
            return;
        }

        let target: any = null;
        if (pointerInfo?.pickInfo?.hit && pointerInfo?.pickInfo?.pickedPoint) {
            const m = pointerInfo.pickInfo.pickedMesh;
            if (!m || !String(m.name || '').startsWith('solver_')) {
                target = pointerInfo.pickInfo.pickedPoint;
            }
        }

        const pointerX = scene.pointerX ?? pointerInfo?.event?.clientX ?? 0;
        const pointerY = scene.pointerY ?? pointerInfo?.event?.clientY ?? 0;

        if (!target && typeof scene.pick === 'function') {
            const pickResult = scene.pick(pointerX, pointerY, (m: any) => {
                return m?.isPickable && !String(m?.name || '').startsWith('solver_');
            });
            if (pickResult?.hit && pickResult.pickedPoint) {
                target = pickResult.pickedPoint;
            }
        }

        if (!target && scene.activeCamera) {
            if (typeof scene.createPickingRay === 'function') {
                const ray = scene.createPickingRay(
                    pointerX,
                    pointerY,
                    BABYLON.Matrix?.Identity ? BABYLON.Matrix.Identity() : null,
                    scene.activeCamera,
                );
                if (ray?.direction && ray?.origin) {
                    const fwd = scene.activeCamera.getForwardRay?.()?.direction || ray.direction;
                    const pA = new BABYLON.Vector3(posA.x, posA.y, posA.z);
                    const denom = BABYLON.Vector3?.Dot
                        ? BABYLON.Vector3.Dot(ray.direction, fwd)
                        : ray.direction.x * fwd.x + ray.direction.y * fwd.y + ray.direction.z * fwd.z;
                    if (Math.abs(denom) > 1e-4) {
                        const diff = pA.subtract(ray.origin);
                        const num = BABYLON.Vector3?.Dot
                            ? BABYLON.Vector3.Dot(diff, fwd)
                            : diff.x * fwd.x + diff.y * fwd.y + diff.z * fwd.z;
                        const t = num / denom;
                        if (t > 0) {
                            target = ray.origin.add(ray.direction.scale(t));
                        }
                    }
                }
            }
        }

        if (!target) {
            return;
        }

        const pA = new BABYLON.Vector3(posA.x, posA.y, posA.z);
        const dist = BABYLON.Vector3?.Distance
            ? BABYLON.Vector3.Distance(pA, target)
            : Math.hypot(pA.x - target.x, pA.y - target.y, pA.z - target.z);

        if (dist < 2.0) {
            if (this._rubberBandMesh) {
                this._rubberBandMesh.isVisible = false;
            }
            return;
        }

        if (this._rubberBandMesh) {
            try {
                this._rubberBandMesh.dispose();
            } catch {
                /* ignore */
            }
            this._rubberBandMesh = null;
        }

        const mat = new BABYLON.StandardMaterial('solver_rubber_band_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(COLOR_VERTEX_LINK.r, COLOR_VERTEX_LINK.g, COLOR_VERTEX_LINK.b);
        mat.emissiveColor = new BABYLON.Color3(COLOR_VERTEX_LINK.r * 0.9, COLOR_VERTEX_LINK.g * 0.9, COLOR_VERTEX_LINK.b * 0.9);
        mat.alpha = 0.85;
        mat.disableDepthWrite = true;
        mat.zOffset = -4;

        if (typeof BABYLON.MeshBuilder?.CreateTube === 'function') {
            this._rubberBandMesh = BABYLON.MeshBuilder.CreateTube(
                'solver_rubber_band_tube',
                {
                    path: [pA, target],
                    radius: 2.0,
                    tessellation: 12,
                    sideOrientation: BABYLON.Mesh?.DOUBLESIDE ?? 2,
                },
                scene,
            );
        } else if (typeof BABYLON.MeshBuilder?.CreateCylinder === 'function') {
            const mesh = BABYLON.MeshBuilder.CreateCylinder('solver_rubber_band_tube', { height: dist, diameter: 4.0 }, scene);
            mesh.position.set((pA.x + target.x) / 2, (pA.y + target.y) / 2, (pA.z + target.z) / 2);
            this._rubberBandMesh = mesh;
        }

        if (this._rubberBandMesh) {
            this._rubberBandMesh.material = mat;
            this._rubberBandMesh.isPickable = false;
            this._rubberBandMesh.renderingGroupId = 1;
            this._rubberBandMesh.isVisible = true;
        }
        ContextManager.instance.viewport?.requestRender?.(2);
    }

    /** CreatePlane: lokalne X = szerokość, Y = wysokość, Z = normalna. */
    private _orientPlaneFromAxes(mesh: any, x: Vec3, y: Vec3, z: Vec3): void {
        const vx = new BABYLON.Vector3(x.x, x.y, x.z);
        const vz = new BABYLON.Vector3(z.x, z.y, z.z);
        if (vx.lengthSquared() < 1e-8 || vz.lengthSquared() < 1e-8) {
            return;
        }
        vx.normalize();
        vz.normalize();
        let vy = BABYLON.Vector3.Cross(vz, vx);
        if (vy.lengthSquared() < 1e-8) {
            vy = new BABYLON.Vector3(y.x, y.y, y.z);
        }
        vy.normalize();
        vx.copyFrom(BABYLON.Vector3.Cross(vy, vz)).normalize();
        const mat = BABYLON.Matrix.FromXYZAxesToRef
            ? (() => {
                  const m = new BABYLON.Matrix();
                  BABYLON.Matrix.FromXYZAxesToRef(vx, vy, vz, m);
                  return m;
              })()
            : BABYLON.Matrix.FromValues(
                  vx.x, vx.y, vx.z, 0,
                  vy.x, vy.y, vy.z, 0,
                  vz.x, vz.y, vz.z, 0,
                  0, 0, 0, 1,
              );
        mesh.rotationQuaternion = BABYLON.Quaternion.FromRotationMatrix(mat);
    }

    /** Schowaj stare overlaye od razu; GPU dispose dopiero po klatce. */
    private _retireMeshes(): void {
        for (const m of this._meshes) {
            try {
                m.isVisible = false;
                m.isPickable = false;
                if (typeof m.setEnabled === 'function') {
                    m.setEnabled(false);
                }
            } catch {
                /* ignore */
            }
            this._pendingDispose.push(m);
        }
        this._meshes = [];
    }

    private _scheduleDeferredDispose(): void {
        if (this._pendingDispose.length === 0) {
            return;
        }
        if (this._afterRenderObs != null || this._disposeFallbackTimer != null) {
            return;
        }

        const scene = ContextManager.instance.viewport?.scene;
        if (scene?.onAfterRenderObservable?.addOnce) {
            this._afterRenderObs = scene.onAfterRenderObservable.addOnce(() => {
                this._afterRenderObs = null;
                this._flushPendingDispose();
            });
            ContextManager.instance.viewport?.requestRender?.(1);
            return;
        }

        this._disposeFallbackTimer = setTimeout(() => {
            this._disposeFallbackTimer = null;
            this._flushPendingDispose();
        }, 0);
    }

    private _flushPendingDispose(): void {
        const doomed = this._pendingDispose;
        this._pendingDispose = [];
        for (const m of doomed) {
            try {
                const mat = m.material;
                if (m.material) {
                    m.material = null;
                }
                m.dispose(/* doNotRecurse */ false, /* disposeMaterialAndTextures */ false);
                if (mat && typeof mat.dispose === 'function' && !mat.isDisposed?.()) {
                    mat.dispose();
                }
            } catch {
                /* ignore */
            }
        }
    }
}
