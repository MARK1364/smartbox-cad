/**
 * constraint-highlight.ts — overlay 3D podświetlenia więzu (jak w Blenderze).
 *
 * A = cyjan, B = żółty, GROUND = magenta. Overlay na klikniętej formatce;
 * solver rusza korpus, do którego formatka należy.
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
    private _offDoc: (() => void) | null = null;

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
        this._ids.clear();
        this._disposeMeshes();
    }

    refresh(): void {
        this._disposeMeshes();
        const doc = ContextManager.instance.document;
        const scene = ContextManager.instance.viewport?.scene;
        if (!doc || !scene || this._ids.size === 0) {
            return;
        }

        for (const id of this._ids) {
            const constraint = ConstraintStore.instance.get(id);
            if (!constraint) {
                continue;
            }
            this._drawConstraint(scene, doc, constraint);
        }
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
        if (constraint.anchorA) {
            this._drawAnchor(scene, doc, constraint.anchorA, ground ? COLOR_GROUND : COLOR_A);
        }
        if (!ground && constraint.anchorB) {
            this._drawAnchor(scene, doc, constraint.anchorB, COLOR_B);
        }
    }

    /**
     * Podgląd rysowany z tej samej rozwiązanej kotwicy, którą dostaje solver
     * (LCS bryły sztywnej). Dzięki temu podświetlenie nie może pokazać innej
     * ściany niż ta, którą solver faktycznie liczy.
     */
    private _drawAnchor(scene: any, doc: any, anchor: ConstraintAnchor, color: typeof COLOR_A): void {
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

    private _disposeMeshes(): void {
        for (const m of this._meshes) {
            try {
                m.dispose();
            } catch {
                /* ignore */
            }
        }
        this._meshes = [];
    }
}
