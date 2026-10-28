/**
 * A2_bloki / sinks — sink-dim-gizmo.ts
 * Interaktywny kontroler linii wymiarowych UV i punktów kotwiczenia (Snap Gizmo) dla zlewu.
 *
 * Umożliwia dynamiczne kotwiczenie linii wymiarowych do krawędzi formatki (np. blatu):
 * - Rysuje linie wymiarowe przerywane od krawędzi U (lewa/prawa) i V (dolna/górna) do środka zlewu.
 * - Wyświetla punkty uchwytowe (kulki snap gizmo) na krawędziach formatki.
 * - Kliknięcie kulki przełącza krawędź bazową (◀ / ▶ lub ▼ / ▲) z automatycznym przeliczeniem
 *   wymiaru bez poruszenia zlewu na blacie.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { resolvePanelThicknessMm } from '../handles/handle-drilling.js';
import type { SinkEdgeU, SinkEdgeV, SinkParamsMm } from './sink-types.js';
import { resolveSinkAbsoluteCenter } from './sink-types.js';

declare const BABYLON: any;

function getBabylon(): any {
    return typeof (window as any).BABYLON !== 'undefined'
        ? (window as any).BABYLON
        : (globalThis as any).BABYLON;
}

function facePoint(faceData: any, u: number, v: number, normalOffset: number): any {
    const B = getBabylon();
    const { origin, uAxis, vAxis, normal } = faceData;
    return new B.Vector3(
        origin[0] + uAxis[0] * u + vAxis[0] * v + normal[0] * normalOffset,
        origin[1] + uAxis[1] * u + vAxis[1] * v + normal[1] * normalOffset,
        origin[2] + uAxis[2] * u + vAxis[2] * v + normal[2] * normalOffset
    );
}

export class SinkDimGizmo {
    private static _instance: SinkDimGizmo | null = null;

    private _activeContainer: any | null = null;
    private _targetPanelNode: CADNode | null = null;
    private _meshes: any[] = [];

    public static get instance(): SinkDimGizmo {
        if (!SinkDimGizmo._instance) {
            SinkDimGizmo._instance = new SinkDimGizmo();
        }
        return SinkDimGizmo._instance;
    }

    get activeContainer(): any | null {
        return this._activeContainer;
    }

    attach(container: any): void {
        if (!container) {
            this.detach();
            return;
        }

        if (this._activeContainer === container && this._meshes.length > 0) {
            this.update();
            return;
        }

        this.detach();
        this._activeContainer = container;
        this.renderGizmo();
    }

    detach(): void {
        for (const m of this._meshes) {
            try {
                if (m.actionManager) m.actionManager.dispose();
                m.dispose();
            } catch {
                // ignore
            }
        }
        this._meshes = [];
        this._activeContainer = null;
        this._targetPanelNode = null;
    }

    update(): void {
        if (!this._activeContainer) return;
        this.renderGizmo();
    }

    private renderGizmo(): void {
        // Czyść poprzednie meshe
        for (const m of this._meshes) {
            try {
                if (m.actionManager) m.actionManager.dispose();
                m.dispose();
            } catch {
                // ignore
            }
        }
        this._meshes = [];

        const B = getBabylon();
        if (!B) return;

        const scene = ContextManager.instance?.viewport?.scene;
        const doc = ContextManager.instance?.document || (window as any).__cad_document;
        if (!scene || !doc || !this._activeContainer) return;

        const gp = this._activeContainer.generatorParams || {};
        const targetPanelId = gp.targetPanelId;
        const panelNode = targetPanelId ? doc.findNode(targetPanelId) : null;
        if (!panelNode || !panelNode.domainData) return;

        this._targetPanelNode = panelNode;
        const panelModel = panelNode.domainData;

        const panelViews = ContextManager.instance.panelViews;
        const panelView = panelViews?.get(panelModel);
        const panelRootMesh = panelView?.root || scene.getMeshByName(`panel_root_${panelModel.id}`);
        if (!panelRootMesh) return;

        const panelWMm = nmToMm(panelModel.width);
        const panelHMm = nmToMm(panelModel.height);
        const panelTMm = resolvePanelThicknessMm(panelModel);

        const normalZ = gp.normalZ ?? 1;
        const faceName = gp.face || (normalZ > 0 ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS');
        const faceData = typeof panelModel.getFace === 'function'
            ? panelModel.getFace(faceName)
            : {
                origin: [
                    normalZ > 0 ? -panelWMm / 2 : panelWMm / 2,
                    -panelHMm / 2,
                    normalZ > 0 ? panelTMm / 2 : -panelTMm / 2,
                ],
                uAxis: normalZ > 0 ? [1, 0, 0] : [-1, 0, 0],
                vAxis: [0, 1, 0],
                normal: [0, 0, normalZ > 0 ? 1 : -1],
                width: panelWMm,
                height: panelHMm,
            };

        const uEdge: SinkEdgeU = gp.uEdge || 'FACE_X_MINUS';
        const vEdge: SinkEdgeV = gp.vEdge || 'FACE_Y_MINUS';

        const { uAbsMm, vAbsMm } = resolveSinkAbsoluteCenter(gp as SinkParamsMm, panelWMm, panelHMm);

        // Punkty na krawędziach formatki
        const edgeU = uEdge === 'FACE_X_MINUS' ? 0 : panelWMm;
        const edgeV = vEdge === 'FACE_Y_MINUS' ? 0 : panelHMm;

        const offset = 1.0; // mm nad powierzchnią lica

        const centerPos = facePoint(faceData, uAbsMm, vAbsMm, offset);
        const uEdgePos  = facePoint(faceData, edgeU, vAbsMm, offset);
        const vEdgePos  = facePoint(faceData, uAbsMm, edgeV, offset);

        // Przerywane linie wymiarowe
        const lineU = this.createDimLine(
            `sink_dim_line_u_${this._activeContainer.id}`,
            uEdgePos,
            centerPos,
            scene,
            panelRootMesh
        );
        const lineV = this.createDimLine(
            `sink_dim_line_v_${this._activeContainer.id}`,
            vEdgePos,
            centerPos,
            scene,
            panelRootMesh
        );
        this._meshes.push(lineU, lineV);

        // Kulki snap gizmo na krawędzi formatki
        const handleU = this.createDimSnapHandle('u', uEdgePos, scene, panelRootMesh);
        const handleV = this.createDimSnapHandle('v', vEdgePos, scene, panelRootMesh);
        this._meshes.push(handleU, handleV);

        // Kliknięcie w kulkę przełącza krawędź bazową (toggle)
        handleU.actionManager.registerAction(new B.ExecuteCodeAction(
            B.ActionManager.OnPickTrigger,
            () => {
                const currentUEdge: SinkEdgeU = gp.uEdge || 'FACE_X_MINUS';
                const nextUEdge: SinkEdgeU = currentUEdge === 'FACE_X_MINUS' ? 'FACE_X_PLUS' : 'FACE_X_MINUS';
                const currentUMm = gp.u_mm ?? (panelWMm / 2);
                const nextUMm = Math.max(0, panelWMm - currentUMm);
                gp.uEdge = nextUEdge;
                gp.u_mm = nextUMm;
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('sink-rebind-edge', {
                        detail: { containerId: this._activeContainer.id, uEdge: nextUEdge, u_mm: nextUMm }
                    }));
                }
                this.update();
            }
        ));

        handleV.actionManager.registerAction(new B.ExecuteCodeAction(
            B.ActionManager.OnPickTrigger,
            () => {
                const currentVEdge: SinkEdgeV = gp.vEdge || 'FACE_Y_MINUS';
                const nextVEdge: SinkEdgeV = currentVEdge === 'FACE_Y_MINUS' ? 'FACE_Y_PLUS' : 'FACE_Y_MINUS';
                const currentVMm = gp.v_mm ?? (panelHMm / 2);
                const nextVMm = Math.max(0, panelHMm - currentVMm);
                gp.vEdge = nextVEdge;
                gp.v_mm = nextVMm;
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('sink-rebind-edge', {
                        detail: { containerId: this._activeContainer.id, vEdge: nextVEdge, v_mm: nextVMm }
                    }));
                }
                this.update();
            }
        ));
    }

    private createDimLine(name: string, p0: any, p1: any, scene: any, parent: any): any {
        const B = getBabylon();
        const len = B.Vector3.Distance(p0, p1);
        const dashSize = Math.max(6, Math.min(14, len / 10));
        const gapSize = dashSize * 0.7;

        const line = B.MeshBuilder.CreateDashedLines(name, {
            points: [p0, p1],
            dashSize,
            gapSize,
            updatable: true,
        }, scene);

        line.color = new B.Color3(0.22, 0.74, 0.97);
        line.isPickable = false;
        line.parent = parent;
        line.metadata = { dashSize, gapSize };
        return line;
    }

    private createDimSnapHandle(slot: 'u' | 'v', pos: any, scene: any, parent: any): any {
        const B = getBabylon();
        const handle = B.MeshBuilder.CreateSphere(`sink_snap_gizmo_${slot}`, {
            diameter: 14,
            segments: 16,
        }, scene);

        handle.parent = parent;
        handle.position.copyFrom(pos);
        handle.renderingGroupId = 1;

        const mat = new B.StandardMaterial(`sink_snap_mat_${slot}`, scene);
        mat.diffuseColor = new B.Color3(0.22, 0.85, 1.0);
        mat.emissiveColor = new B.Color3(0.15, 0.6, 0.95);
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        mat.disableDepthWrite = true;
        handle.material = mat;
        handle.isPickable = true;

        handle.actionManager = new B.ActionManager(scene);
        handle.actionManager.registerAction(new B.ExecuteCodeAction(
            B.ActionManager.OnPointerOverTrigger,
            () => {
                handle.scaling.setAll(1.35);
                const canvas = scene.getEngine()?.getRenderingCanvas();
                if (canvas) canvas.style.cursor = 'pointer';
            }
        ));
        handle.actionManager.registerAction(new B.ExecuteCodeAction(
            B.ActionManager.OnPointerOutTrigger,
            () => {
                handle.scaling.setAll(1.0);
                const canvas = scene.getEngine()?.getRenderingCanvas();
                if (canvas) canvas.style.cursor = '';
            }
        ));

        return handle;
    }
}
