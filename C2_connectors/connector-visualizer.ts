/**
 * Overlay 3D: płaszczyzny styku (tryb wstawiania) + dwa odcinki złącza
 * (część w boczku + część w wieńcu). W CNC cylindry są ukrywane.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { cadToRender } from '../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { localMmToWorldMm } from '../S2_solver/constraint-geometry.js';
import { ConnectorStore } from './connector-store.js';
import { getSymbolSegments, isParentFaceContact } from './connectors-embedment.js';
import type { EligibleContactFace } from './connectors-types.js';

declare const BABYLON: any;

const COLOR_ELIGIBLE = { r: 0.0, g: 0.5, b: 1.0, a: 0.38 };
const COLOR_EDGE = { r: 0.0, g: 0.8, b: 1.0, a: 1.0 };
const COLOR_HOVER = { r: 0.8, g: 0.7, b: 0.0, a: 0.55 };
const COLOR_DOWEL = { r: 0.82, g: 0.62, b: 0.28 };
const COLOR_SCREW = { r: 0.45, g: 0.48, b: 0.52 };
const COLOR_MINIFIX = { r: 0.2, g: 0.55, b: 0.85 };

function colorForType(type: string) {
    if (type.startsWith('kolki')) return COLOR_DOWEL;
    if (type === 'minifix') return COLOR_MINIFIX;
    return COLOR_SCREW;
}

/** Cylinder Babylona ma oś +Y — obracamy ją na kierunek styku. */
function quatAlignY(dir: any): any {
    const to = dir.normalize();
    const from = new BABYLON.Vector3(0, 1, 0);
    const d = BABYLON.Vector3.Dot(from, to);
    if (d > 0.9999) return BABYLON.Quaternion.Identity();
    if (d < -0.9999) return BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(1, 0, 0), Math.PI);
    const axis = BABYLON.Vector3.Cross(from, to).normalize();
    return BABYLON.Quaternion.RotationAxis(axis, Math.acos(Math.max(-1, Math.min(1, d))));
}

export class ConnectorVisualizer {
    private static _instance: ConnectorVisualizer | null = null;

    static get instance(): ConnectorVisualizer {
        if (!ConnectorVisualizer._instance) {
            ConnectorVisualizer._instance = new ConnectorVisualizer();
        }
        return ConnectorVisualizer._instance;
    }

    private _eligible: EligibleContactFace[] = [];
    private _hover: EligibleContactFace | null = null;
    private _eligibleMeshes: any[] = [];
    private _connectorMeshes: any[] = [];
    private _hideSymbols = false;
    private _offDoc: (() => void) | null = null;
    private _offStore: (() => void) | null = null;

    attach(): void {
        this._listen();
        this.refreshConnectors();
    }

    setEligibleFaces(faces: EligibleContactFace[], hover: EligibleContactFace | null = this._hover): void {
        this._eligible = faces;
        this._hover = hover;
        this._rebuildEligible();
    }

    setHover(face: EligibleContactFace | null): void {
        if (this._hover === face) return;
        this._hover = face;
        this._rebuildEligible();
    }

    clearEligible(): void {
        this._eligible = [];
        this._hover = null;
        this._dispose(this._eligibleMeshes);
        this._eligibleMeshes = [];
    }

    /** CNC: ukryj cylindry złączy (kołki/konfirmaty) — na formatce zostają same otwory. */
    setSymbolsVisible(visible: boolean): void {
        const hide = !visible;
        if (this._hideSymbols === hide) return;
        this._hideSymbols = hide;
        this.refreshConnectors();
    }

    refreshConnectors(): void {
        this._dispose(this._connectorMeshes);
        this._connectorMeshes = [];
        if (this._hideSymbols) return;
        const scene = ContextManager.instance.viewport?.scene;
        const doc = ContextManager.instance.document;
        if (!scene || !doc) return;

        for (const group of ConnectorStore.instance.groups) {
            const parent = doc.findNode?.(group.parentObjectId);
            if (!parent) continue;
            const other = group.otherObjectId ? doc.findNode?.(group.otherObjectId) : null;
            const parentIsFace = isParentFaceContact(group.faceNormalLocalMm, group.faceName);
            const faceNode = parentIsFace ? parent : other;
            const faceThick = nmToMm((faceNode?.domainData as any)?.thickness ?? 18_000_000);

            for (const conn of group.connectors) {
                const segs = getSymbolSegments(conn.type, conn.lengthMm, faceThick);
                const worldPos = localMmToWorldMm(parent, conn.positionLocalMm);
                const { rotation } = parent.getWorldMatrix().decompose();
                const nOut = rotation.rotateVec3(new Vec3(
                    conn.normalLocalMm[0],
                    conn.normalLocalMm[1],
                    conn.normalLocalMm[2],
                )).normalize();
                // Normalna styku wychodzi z rodzica — w drugą stronę wchodzimy w rodzica.
                const intoParent = nOut.scale(-1);
                const intoOther = nOut;
                const faceDir = parentIsFace ? intoParent : intoOther;
                const edgeDir = parentIsFace ? intoOther : intoParent;

                this._drawSegment(scene, worldPos, faceDir, segs.faceMm, segs.faceDiaMm, conn.type);
                this._drawSegment(scene, worldPos, edgeDir, segs.edgeMm, segs.edgeDiaMm, conn.type);
            }
        }
    }

    private _listen(): void {
        if (!this._offStore) {
            this._offStore = ConnectorStore.instance.onChange(() => this.refreshConnectors());
        }
        if (this._offDoc) return;
        const doc = ContextManager.instance.document;
        if (!doc?.onDocumentChanged) return;
        this._offDoc = doc.onDocumentChanged(() => this.refreshConnectors());
    }

    private _rebuildEligible(): void {
        this._dispose(this._eligibleMeshes);
        this._eligibleMeshes = [];
        const scene = ContextManager.instance.viewport?.scene;
        if (!scene) return;
        for (const face of this._eligible) {
            const hover = this._hover && this._sameFace(this._hover, face);
            this._drawPatch(scene, face, hover ? COLOR_HOVER : COLOR_ELIGIBLE, true);
        }
    }

    private _sameFace(a: EligibleContactFace, b: EligibleContactFace): boolean {
        return a.panelId === b.panelId && a.faceName === b.faceName && a.otherPanelId === b.otherPanelId;
    }

    private _drawPatch(scene: any, face: EligibleContactFace, color: typeof COLOR_ELIGIBLE, withEdge: boolean): void {
        const verts = face.clippedVertsWorldMm.map((v) => cadToRender(new Vec3(v[0], v[1], v[2])));
        if (verts.length < 3) return;
        const positions: number[] = [];
        for (const v of verts) positions.push(v.x, v.y, v.z);
        const indices: number[] = [];
        for (let i = 1; i < verts.length - 1; i++) {
            indices.push(0, i, i + 1);
        }

        const mesh = new BABYLON.Mesh('c2_patch', scene);
        const vd = new BABYLON.VertexData();
        vd.positions = positions;
        vd.indices = indices;
        vd.normals = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, vd.normals);
        vd.applyToMesh(mesh);

        const mat = new BABYLON.StandardMaterial('c2_patch_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.emissiveColor = new BABYLON.Color3(color.r, color.g, color.b);
        mat.alpha = color.a;
        mat.backFaceCulling = false;
        mat.disableDepthWrite = true;
        mat.zOffset = -3;
        mesh.material = mat;
        mesh.isPickable = false;
        mesh.renderingGroupId = 0;
        this._eligibleMeshes.push(mesh);

        if (withEdge) {
            const linePts = verts.map((v) => new BABYLON.Vector3(v.x, v.y, v.z));
            linePts.push(linePts[0]);
            const lines = BABYLON.MeshBuilder.CreateLines('c2_patch_edge', { points: linePts }, scene);
            lines.color = new BABYLON.Color3(COLOR_EDGE.r, COLOR_EDGE.g, COLOR_EDGE.b);
            lines.isPickable = false;
            lines.renderingGroupId = 0;
            this._eligibleMeshes.push(lines);
        }
    }

    /**
     * Walec od płaszczyzny styku w głąb formatki (środek Babylona = środek walca).
     * dirCad — kierunek w CAD, od styku do wnętrza płyty.
     */
    private _drawSegment(
        scene: any,
        contactCad: Vec3,
        dirCad: Vec3,
        lengthMm: number,
        diameterMm: number,
        type: string,
    ): void {
        if (!(lengthMm > 0.5) || !(diameterMm > 0)) return;
        const dirN = dirCad.lengthSquared() > 1e-12 ? dirCad.normalize() : new Vec3(0, 1, 0);
        const centerCad = contactCad.add(dirN.scale(lengthMm / 2));
        const pos = cadToRender(centerCad);
        const nBab = cadToRender(dirN).normalize();

        const cyl = BABYLON.MeshBuilder.CreateCylinder('c2_conn', {
            height: lengthMm,
            diameter: diameterMm,
            tessellation: 12,
        }, scene);
        cyl.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
        cyl.rotationQuaternion = quatAlignY(new BABYLON.Vector3(nBab.x, nBab.y, nBab.z));

        const col = colorForType(type);
        const mat = new BABYLON.StandardMaterial('c2_conn_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(col.r, col.g, col.b);
        mat.emissiveColor = new BABYLON.Color3(col.r * 0.35, col.g * 0.35, col.b * 0.35);
        cyl.material = mat;
        cyl.isPickable = false;
        cyl.renderingGroupId = 0;
        cyl.metadata = { type: 'c2_connector_symbol' };
        this._connectorMeshes.push(cyl);
    }

    private _dispose(meshes: any[]): void {
        for (const m of meshes) {
            try {
                m.material?.dispose?.();
                m.dispose?.();
            } catch {}
        }
    }
}
