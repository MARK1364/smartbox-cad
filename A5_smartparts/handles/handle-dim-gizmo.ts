/**
 * A5_smartparts / handles — handle-dim-gizmo.ts
 * Interaktywny kontroler linii wymiarowych UV i punktów kotwiczenia (Snap Gizmo).
 *
 * Umożliwia dynamiczne kotwiczenie linii wymiarowych do krawędzi formatki:
 * - Rysuje linie wymiarowe przerywane od krawędzi U i V formatki do osi uchwytu.
 * - Wyświetla punkty uchwytowe (kulki snap gizmo) na krawędziach.
 * - Przeciąganie kulek myszką:
 *   - dociąganie magnesem (magnetEdgeIfAtBound) do przeciwległej krawędzi,
 *   - przepinanie referencji (uEdge / vEdge) z automatycznym przeliczeniem wymiaru
 *     bez poruszenia uchwytu w przestrzeni.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import {
    type EdgeU,
    type EdgeV,
    type HandleParamsMm,
    type HandleOrientation,
} from './handle-types.js';
import {
    computeHandleLayout,
    computeHandleCenterFromUV,
    computeUVFromCenter,
    computeRefHolePosition,
    rebindHandleEdge,
    buildHandleParametricMesh,
    syncHandleDrillings,
    resolvePanelThicknessMm,
} from './handle-engine.js';
import {
    dimHandleUv,
    dragHandleAlongAxis,
    magnetEdgeIfAtBound,
    snapDimHandleToEdge,
    distanceToUEdge,
    distanceToVEdge,
} from '../../o1_operacji/operacje-placement.js';

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

function uvFromWorld(worldPos: any, invWorld: any, faceData: any): { u: number; v: number } {
    const B = getBabylon();
    const local = B.Vector3.TransformCoordinates(worldPos, invWorld);
    const { origin, uAxis, vAxis } = faceData;
    const dx = local.x - origin[0];
    const dy = local.y - origin[1];
    const dz = local.z - origin[2];
    return {
        u: dx * uAxis[0] + dy * uAxis[1] + dz * uAxis[2],
        v: dx * vAxis[0] + dy * vAxis[1] + dz * vAxis[2],
    };
}

export class HandleDimGizmo {
    private static _instance: HandleDimGizmo | null = null;

    private _activeContainer: any | null = null;
    private _targetPanelNode: CADNode | null = null;
    private _meshes: any[] = [];
    private _isDragging: boolean = false;

    public static get instance(): HandleDimGizmo {
        if (!HandleDimGizmo._instance) {
            HandleDimGizmo._instance = new HandleDimGizmo();
        }
        return HandleDimGizmo._instance;
    }

    get isDragging(): boolean {
        return this._isDragging;
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
        this._isDragging = false;
    }

    update(): void {
        if (!this._activeContainer) return;
        this.renderGizmo();
    }

    private renderGizmo(): void {
        // Czyść poprzednie meshe
        for (const m of this._meshes) {
            try {
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

        // Znajdź panelView
        const panelViews = ContextManager.instance.panelViews;
        const panelView = panelViews?.get(panelModel);
        const panelRootMesh = panelView?.root || scene.getMeshByName(`panel_root_${panelModel.id}`);
        if (!panelRootMesh) return;

        const panelWMm = nmToMm(panelModel.width);
        const panelHMm = nmToMm(panelModel.height);
        const panelTMm = resolvePanelThicknessMm(panelModel);

        const normalZ = gp.normalZ ?? -1;
        const faceName = gp.face || (normalZ > 0 ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS');
        const faceData = typeof panelModel.getFace === 'function'
            ? panelModel.getFace(faceName)
            : {
                // FACE_Z_PLUS:  uAxis=[+1,0,0]  → origin at left edge  (-panelW/2, -panelH/2,  panelT/2)
                // FACE_Z_MINUS: uAxis=[-1,0,0]  → origin at right edge (+panelW/2, -panelH/2, -panelT/2)
                //   Dzięki temu facePoint(u=0) → prawa krawędź, facePoint(u=panelW) → lewa krawędź
                //   a uvFromWorld przy środku (localX=0) daje u=panelW/2 ✓
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

        const uEdge: EdgeU = gp.uEdge || 'FACE_X_MINUS';
        const vEdge: EdgeV = gp.vEdge || 'FACE_Y_PLUS';

        // Oblicz pozycję środka i layout uchwytu
        const layout = computeHandleLayout(gp as HandleParamsMm, panelWMm, panelHMm);
        const center = layout.center;

        // Przelicz (center.x, center.y) na współrzędne UV na ścianie
        const isZPlus = faceName === 'FACE_Z_PLUS';
        const midU = isZPlus ? center.x + panelWMm / 2 : panelWMm / 2 - center.x;
        const midV = center.y + panelHMm / 2;

        const isHoriz = gp.orientation === 'HORIZONTAL';
        const holeDist: number = gp.holeDistanceMm ?? 0;

        // Pozycja środka uchwytu (dla wizualizacji obrysui)
        const w = isHoriz ? (gp.totalLengthMm || 200) : (gp.thicknessMm || 12);
        const l = isHoriz ? (gp.thicknessMm || 12) : (gp.totalLengthMm || 200);

        const rect = {
            u: midU - w / 2,
            v: midV - l / 2,
            width: w,
            length: l,
        };

        // ── Punkt zakotwienia (ref-hole) – na nim kończy się linia wymiarowa ──
        // Używamy pozycji bliższego otworu montażowego (nie środka), bo tego dotyczy wymiar.
        const refHoleLocal = computeRefHolePosition(
            gp.uMm ?? 0, gp.vMm ?? 0,
            uEdge, vEdge,
            panelWMm, panelHMm
        );
        // Konwertuj ref-hole local (x, y) → UV na licu formatki
        const refHoleU = isZPlus ? refHoleLocal.x + panelWMm / 2 : panelWMm / 2 - refHoleLocal.x;
        const refHoleV = refHoleLocal.y + panelHMm / 2;

        const uEnd = dimHandleUv(faceName, 'u', rect, uEdge, vEdge, panelWMm, panelHMm);
        const vEnd = dimHandleUv(faceName, 'v', rect, uEdge, vEdge, panelWMm, panelHMm);

        const offset = 0.8; // mm nad powierzchnią lica

        // uEnd / vEnd = punkt NA KRAWĘDZI PANELU (tu siedzi kulka snap gizmo)
        // refHolePos   = punkt przy OTWORZE (koniec linii wymiarowej na osi głównej)
        // centerPos    = punkt przy ŚRODKU uchwytu (koniec linii na osi poprzecznej)
        const uIsMain = isHoriz;
        const vIsMain = !isHoriz;

        const refHolePos = facePoint(faceData, refHoleU, refHoleV, offset);
        const centerPos  = facePoint(faceData, midU, midV, offset);
        const uEdgePos   = facePoint(faceData, uEnd.u, uEnd.v, offset); // krawędź panelu U
        const vEdgePos   = facePoint(faceData, vEnd.u, vEnd.v, offset); // krawędź panelu V

        // Linie wymiarowe przerywane:
        //   oś główna  → krawędź panelu ... otwór montażowy
        //   oś poprzeczna → krawędź panelu ... środek uchwytu
        const lineU = this.createDimLine(
            `handle_dim_line_u_${this._activeContainer.id}`,
            uEdgePos,
            uIsMain ? refHolePos : centerPos,
            scene, panelRootMesh
        );
        const lineV = this.createDimLine(
            `handle_dim_line_v_${this._activeContainer.id}`,
            vEdgePos,
            vIsMain ? refHolePos : centerPos,
            scene, panelRootMesh
        );
        this._meshes.push(lineU, lineV);

        // Kulki snap gizmo siedzą przy KRAWĘDZI PANELU (nie przy otworze)
        const handleU = this.createDimSnapHandle('u', uEdgePos, scene, panelRootMesh);
        const handleV = this.createDimSnapHandle('v', vEdgePos, scene, panelRootMesh);
        this._meshes.push(handleU, handleV);

        // Podłączenie interaktywnego przeciągania
        this.wireSnapHandle(handleU, 'u', uEdge, vEdge, faceName, faceData, rect, lineU, panelWMm, panelHMm, panelRootMesh, holeDist, { u: refHoleU, v: refHoleV });
        this.wireSnapHandle(handleV, 'v', uEdge, vEdge, faceName, faceData, rect, lineV, panelWMm, panelHMm, panelRootMesh, holeDist, { u: refHoleU, v: refHoleV });
    }

    private createDimLine(name: string, p0: any, p1: any, scene: any, parent: any): any {
        const B = getBabylon();
        const len = B.Vector3.Distance(p0, p1);
        const dashSize = Math.max(6, Math.min(12, len / 12));
        const gapSize = dashSize * 0.7;

        const line = B.MeshBuilder.CreateDashedLines(name, {
            points: [p0, p1],
            dashSize,
            gapSize,
            updatable: true,
        }, scene);

        line.color = new B.Color3(0.12, 0.75, 0.95);
        line.isPickable = false;
        line.parent = parent;
        line.metadata = { dashSize, gapSize };
        return line;
    }

    private updateDimLine(lineMesh: any, p0: any, p1: any): void {
        const B = getBabylon();
        const dashSize = lineMesh.metadata?.dashSize || 8;
        const gapSize = lineMesh.metadata?.gapSize || 6;
        B.MeshBuilder.CreateDashedLines(null, {
            points: [p0, p1],
            dashSize,
            gapSize,
            instance: lineMesh,
        });
    }

    private createDimSnapHandle(slot: 'u' | 'v', pos: any, scene: any, parent: any): any {
        const B = getBabylon();
        const handle = B.MeshBuilder.CreateSphere(`handle_snap_gizmo_${slot}`, {
            diameter: 12,
            segments: 16,
        }, scene);

        handle.parent = parent;
        handle.position.copyFrom(pos);
        handle.renderingGroupId = 1;

        const mat = new B.StandardMaterial(`handle_snap_mat_${slot}`, scene);
        mat.diffuseColor = new B.Color3(0.2, 0.85, 1);
        mat.emissiveColor = new B.Color3(0.12, 0.55, 0.85);
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        mat.disableDepthWrite = true;
        handle.material = mat;
        handle.isPickable = true;

        handle.actionManager = new B.ActionManager(scene);
        handle.actionManager.registerAction(new B.ExecuteCodeAction(
            B.ActionManager.OnPointerOverTrigger,
            () => {
                handle.scaling.setAll(1.3);
                const canvas = scene.getEngine()?.getRenderingCanvas();
                if (canvas) canvas.style.cursor = 'grab';
            }
        ));
        handle.actionManager.registerAction(new B.ExecuteCodeAction(
            B.ActionManager.OnPointerOutTrigger,
            () => {
                if (!this._isDragging) handle.scaling.setAll(1.0);
                const canvas = scene.getEngine()?.getRenderingCanvas();
                if (canvas && !this._isDragging) canvas.style.cursor = '';
            }
        ));

        return handle;
    }

    private wireSnapHandle(
        handleMesh: any,
        slot: 'u' | 'v',
        originalUEdge: EdgeU,
        originalVEdge: EdgeV,
        faceName: string,
        faceData: any,
        rect: { u: number; v: number; width: number; length: number },
        lineMesh: any,
        panelWMm: number,
        panelHMm: number,
        panelRootMesh: any,
        holeDistanceMm: number = 0,
        refHoleUV: { u: number; v: number } = { u: 0, v: 0 }
    ): void {
        const B = getBabylon();
        panelRootMesh.computeWorldMatrix(true);

        const startNormal = B.Vector3.TransformNormal(
            new B.Vector3(...faceData.normal),
            panelRootMesh.getWorldMatrix(),
        ).normalize();

        const drag = new B.PointerDragBehavior({ dragPlaneNormal: startNormal });
        drag.useObjectOrientationForDragging = false;
        drag.moveAttached = false;
        drag.updateDragPlane = false;

        const originalEdge = slot === 'u' ? originalUEdge : originalVEdge;
        let pendingEdge = originalEdge;

        const idleColor = new B.Color3(0.12, 0.55, 0.85);
        const hotColor = new B.Color3(1.0, 0.88, 0.2); // Złocisty magnes przy krawędzi

        let invWorld: any = null;
        let dragPlane: any = null;
        const offset = 0.8;

        drag.onDragStartObservable.add(() => {
            this._isDragging = true;
            pendingEdge = originalEdge;
            handleMesh.scaling.setAll(1.35);

            const canvas = handleMesh.getScene()?.getEngine()?.getRenderingCanvas();
            if (canvas) canvas.style.cursor = 'grabbing';
            ContextManager.instance.viewport?.camera?.detachControl?.();

            panelRootMesh.computeWorldMatrix(true);
            const wm = panelRootMesh.getWorldMatrix();
            invWorld = wm.clone().invert();

            const n = B.Vector3.TransformNormal(new B.Vector3(...faceData.normal), wm).normalize();
            if (drag.options) drag.options.dragPlaneNormal = n;

            const worldOrigin = B.Vector3.TransformCoordinates(new B.Vector3(...faceData.origin), wm);
            dragPlane = B.Plane.FromPositionAndNormal(worldOrigin, n);
        });

        drag.onDragObservable.add((ev: any) => {
            const cam = handleMesh.getScene()?.activeCamera;
            if (!cam || !dragPlane || !invWorld) return;

            const ray = handleMesh.getScene().createPickingRay(
                handleMesh.getScene().pointerX,
                handleMesh.getScene().pointerY,
                B.Matrix.Identity(),
                cam
            );

            const dist = ray.intersectsPlane(dragPlane);
            if (typeof dist !== 'number') return;

            const worldPos = ray.origin.add(ray.direction.scale(dist));
            const uv = uvFromWorld(worldPos, invWorld, faceData);

            if (!this._activeContainer) return;
            const gp = this._activeContainer.generatorParams || {};
            const orientation: HandleOrientation = gp.orientation || 'HORIZONTAL';
            const isHoriz = orientation === 'HORIZONTAL';
            const isMainAxisDrag = (slot === 'u' && isHoriz) || (slot === 'v' && !isHoriz);
            const holeOffset = isMainAxisDrag ? holeDistanceMm : 0;
            const spanMm = slot === 'u' ? panelWMm : panelHMm;
            const oldDist = slot === 'u' ? (gp.uMm ?? 40) : (gp.vMm ?? 35);
            const isZPlus = faceName === 'FACE_Z_PLUS';

            // Rozpoznaj krawędź docelową (czy kursor przesunięto w stronę drugiej połowy formatki)
            const snapped = snapDimHandleToEdge(faceName, slot, uv.u, uv.v, rect, panelWMm, panelHMm);
            const targetEdge = (slot === 'u' ? snapped.uEdge : snapped.vEdge) || originalEdge;
            pendingEdge = targetEdge;

            const isSnappedToOther = pendingEdge !== originalEdge;

            // Pozycja kulki snap gizmo:
            // Gdy przeciągamy do przeciwległej krawędzi, kulka doskakuje do nowej krawędzi formatki
            let currentHandleU = uv.u;
            let currentHandleV = uv.v;
            if (isSnappedToOther) {
                currentHandleU = snapped.handleU;
                currentHandleV = snapped.handleV;
            } else {
                const along = dragHandleAlongAxis(slot, uv.u, uv.v, rect, panelWMm, panelHMm);
                currentHandleU = along.handleU;
                currentHandleV = along.handleV;
            }
            handleMesh.position.copyFrom(facePoint(faceData, currentHandleU, currentHandleV, offset));

            // Kolor kulki: złocisty gdy zassało do nowej krawędzi, błękitny w pierwotnym stanie
            handleMesh.material.emissiveColor = isSnappedToOther ? hotColor : idleColor;

            // Aktualizacja linii wymiarowej
            let targetInnerPos: any;
            if (isMainAxisDrag) {
                if (isSnappedToOther) {
                    const newDist = rebindHandleEdge(originalEdge, pendingEdge, oldDist, spanMm, holeOffset);
                    const newRefLocal = slot === 'u'
                        ? computeRefHolePosition(newDist, gp.vMm ?? 0, pendingEdge as EdgeU, gp.vEdge || 'FACE_Y_PLUS', panelWMm, panelHMm)
                        : computeRefHolePosition(gp.uMm ?? 0, newDist, gp.uEdge || 'FACE_X_MINUS', pendingEdge as EdgeV, panelWMm, panelHMm);
                    const newRefU = isZPlus ? newRefLocal.x + panelWMm / 2 : panelWMm / 2 - newRefLocal.x;
                    const newRefV = newRefLocal.y + panelHMm / 2;
                    targetInnerPos = facePoint(faceData, newRefU, newRefV, offset);
                } else {
                    targetInnerPos = facePoint(faceData, refHoleUV.u, refHoleUV.v, offset);
                }
            } else {
                targetInnerPos = facePoint(faceData, rect.u + rect.width / 2, rect.v + rect.length / 2, offset);
            }

            this.updateDimLine(lineMesh, handleMesh.position, targetInnerPos);
        });

        drag.onDragEndObservable.add(() => {
            const canvas = handleMesh.getScene()?.getEngine()?.getRenderingCanvas();
            if (canvas) canvas.style.cursor = '';
            const vp = ContextManager.instance.viewport;
            vp?.camera?.attachControl?.(vp.canvas, true);
            this._isDragging = false;

            if (!this._activeContainer) return;
            const gp = this._activeContainer.generatorParams || {};

            // 1. Jeśli nastąpiło przepięcie krawędzi odniesienia (np. Lewa -> Prawa)
            if (pendingEdge && pendingEdge !== originalEdge) {
                const orientation: HandleOrientation = gp.orientation || 'HORIZONTAL';
                const isHoriz = orientation === 'HORIZONTAL';
                const isMainAxis = (slot === 'u' && isHoriz) || (slot === 'v' && !isHoriz);
                const holeOffset = isMainAxis ? holeDistanceMm : 0;
                if (slot === 'u') {
                    const oldEdge = gp.uEdge || originalUEdge || 'FACE_X_MINUS';
                    const newEdge = pendingEdge as EdgeU;
                    const oldDist = gp.uMm ?? 40;
                    gp.uEdge = newEdge;
                    gp.uMm = rebindHandleEdge(oldEdge, newEdge, oldDist, panelWMm, holeOffset);
                } else {
                    const oldEdge = gp.vEdge || originalVEdge || 'FACE_Y_PLUS';
                    const newEdge = pendingEdge as EdgeV;
                    const oldDist = gp.vMm ?? 35;
                    gp.vEdge = newEdge;
                    gp.vMm = rebindHandleEdge(oldEdge, newEdge, oldDist, panelHMm, holeOffset);
                }

                // Przelicz pozycję w przestrzeni i zsynchronizuj uchwyt oraz UI
                this.syncHandleAfterEdit();
            } else {
                // Jeśli nie nastąpiło przepięcie do innej krawędzi, przywróć pierwotne położenie kulki na krawędzi bazowej
                this.renderGizmo();
            }
        });

        handleMesh.addBehavior(drag);
    }

    private syncHandleAfterEdit(): void {
        if (!this._activeContainer) return;
        const doc = ContextManager.instance?.document || (window as any).__cad_document;
        if (!doc) return;

        const gp = this._activeContainer.generatorParams;
        const cntNode = doc.findNode(this._activeContainer.id);
        if (!cntNode) return;

        const targetPanel = gp.targetPanelId ? doc.findNode(gp.targetPanelId) : null;
        const panelModel = targetPanel?.domainData;
        const panelWMm = gp.panelWidthMm ?? (panelModel ? nmToMm(panelModel.width) : 0);
        const panelHMm = gp.panelHeightMm ?? (panelModel ? nmToMm(panelModel.height) : 0);
        const panelTMm = gp.panelThicknessMm ?? (panelModel ? resolvePanelThicknessMm(panelModel) : 0);

        const layout = computeHandleLayout(gp as HandleParamsMm, panelWMm, panelHMm);
        gp.overhangMm = layout.overhangMm;

        const faceZ = gp.faceZ ?? -panelTMm / 2;
        const normalZ = gp.normalZ ?? -1;

        // Aktualizacja lokalnego położenia CADNode
        cntNode.setLocalTransform(
            new Vec3(mmToNm(layout.center.x), mmToNm(faceZ), mmToNm(layout.center.y)),
            Quat.IDENTITY
        );

        // Przebudowa siatki 3D uchwytu
        buildHandleParametricMesh(cntNode, gp as HandleParamsMm, layout, faceZ, normalZ);

        // Synchronizacja otworów montażowych
        const parentId = gp.targetPanelId || cntNode.parent?.id;
        const targetPanelNode = parentId ? doc.findNode(parentId) : null;
        if (targetPanelNode) {
            syncHandleDrillings(doc, targetPanelNode, this._activeContainer, layout, gp as HandleParamsMm, normalZ);
        }

        // Aktualizacja obrysu ContainerView
        const cView = ContextManager.instance?.containerViews?.get(this._activeContainer);
        if (cView && typeof cView.update === 'function') {
            cView.update();
        }

        // Odśwież linie wymiarowe gizma
        this.renderGizmo();

        // Powiadomienie o zmianie w projekcie
        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update', {
                detail: {
                    kind: 'smartpart_handle',
                    handleId: this._activeContainer.id,
                },
            }));
        }
    }
}
