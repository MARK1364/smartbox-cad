/**
 * SmartPanel Web — Modal Transform Manager (Blender-Style Controls)
 * 
 * Obsługuje modalną transformację zaznaczonego obiektu za pomocą skrótów klawiszowych:
 * - `G` (Grab / Move) — Przesuwanie obiektu w przestrzeni 3D za ruchem myszy
 * - `R` (Rotate) — Obracanie obiektu wokół osi w przestrzeni 3D
 * - `X`, `Y`, `Z` — Blokowanie ruchu/obrotu do wybranej osi
 * - `LMB` / `Enter` — Zatwierdzenie nowej pozycji/kąta i zapis do historii
 * - `Esc` / `RMB` — Anulowanie i przywrócenie stanu początkowego
 */

import { ContextManager } from './context-manager.js';
import { renderToCAD, lockCadDelta } from './cad-math/coord-system.js';
import { Vec3 } from './cad-math/vec3.js';
import { nmToMm, mmToNm } from './cad-math/units.js';
import { Quat } from './cad-math/quat.js';
import { ConstraintStore } from '../S2_solver/constraint-store.js';
import { ConstraintDragGroup } from '../S2_solver/constraint-drag-group.js';

declare const BABYLON: any;

export type ModalTransformMode = 'none' | 'translate' | 'rotate';
export type LockedAxis = 'none' | 'x' | 'y' | 'z';

export class ModalTransformManager {
    private static _instance: ModalTransformManager;

    public activeMode: ModalTransformMode = 'none';
    public lockedAxis: LockedAxis = 'none';

    private targetEntity: any = null;
    private targetNode: any = null;

    private initialMatrix: any = null;
    private initialTranslationNm: Vec3 = new Vec3(0, 0, 0);
    private initialRotationQuat: any = null;
    private initialScaleVec: Vec3 = new Vec3(1, 1, 1);

    private startPointerX: number = 0;
    private startPointerY: number = 0;

    private onStateChangeListeners: Set<(info: string | null) => void> = new Set();
    private pointerObserver: any = null;

    private constructor() {
        this._setupKeyboardListeners();
    }

    public static get instance(): ModalTransformManager {
        if (!ModalTransformManager._instance) {
            ModalTransformManager._instance = new ModalTransformManager();
        }
        return ModalTransformManager._instance;
    }

    public init(): void {
        const viewport = ContextManager.instance.viewport;
        if (!viewport || !viewport.scene) return;

        if (this.pointerObserver) {
            viewport.scene.onPointerObservable.remove(this.pointerObserver);
        }

        this.pointerObserver = viewport.scene.onPointerObservable.add((pointerInfo: any) => {
            if (this.activeMode === 'none') return;

            const evt = pointerInfo.event;

            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
                const name = pickedMesh?.name || '';
                const isGizmoMesh = pickedMesh?._isGizmo === true ||
                                    pickedMesh?.parent?._isGizmo === true ||
                                    name.includes('gizmo') || 
                                    name.includes('Gizmo') || 
                                    name.startsWith('positionGizmo') || 
                                    name.startsWith('freeDragCenterSphere') ||
                                    name.startsWith('rotationGizmo') ||
                                    name.includes('Plane') ||
                                    name.includes('arrow') ||
                                    name.includes('cylinder') ||
                                    name.includes('cone') ||
                                    name.includes('torus') ||
                                    name.includes('axis') ||
                                    name.includes('lines') ||
                                    (pickedMesh?.parent && (pickedMesh.parent.name?.includes('gizmo') || pickedMesh.parent.name?.includes('Gizmo')));

                if (evt.button === 0) {
                    // Nie zamykaj trybu jeśli kliknięto w jakikolwiek element gizma
                    if (!isGizmoMesh && !pointerInfo.pickInfo?.hit) {
                        this.confirmTransform();
                    }
                } else if (evt.button === 2) {
                    this.cancelTransform();
                    evt.preventDefault();
                    evt.stopPropagation();
                }
            }
        });
    }

    private _setupKeyboardListeners(): void {
        if (typeof window === 'undefined') return;
        window.addEventListener('keydown', (evt: KeyboardEvent) => {
            // Ignoruj wpisywanie tekstu w polach tekstowych
            const activeEl = document.activeElement as HTMLElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
                return;
            }

            const key = evt.key.toLowerCase();

            if (this.activeMode === 'none') {
                if (key === 'g') {
                    this.startTransform('translate');
                } else if (key === 'r') {
                    this.startTransform('rotate');
                }
            } else {
                if (key === 'escape') {
                    this.cancelTransform();
                    evt.preventDefault();
                } else if (key === 'enter') {
                    this.confirmTransform();
                    evt.preventDefault();
                } else if (key === 'x') {
                    this.lockedAxis = this.lockedAxis === 'x' ? 'none' : 'x';
                    this._handlePointerMove();
                    this._notifyStateChange();
                } else if (key === 'y') {
                    this.lockedAxis = this.lockedAxis === 'y' ? 'none' : 'y';
                    this._handlePointerMove();
                    this._notifyStateChange();
                } else if (key === 'z') {
                    this.lockedAxis = this.lockedAxis === 'z' ? 'none' : 'z';
                    this._handlePointerMove();
                    this._notifyStateChange();
                }
            }
        }, true);
    }

    public startTransform(mode: ModalTransformMode): void {
        const doc = ContextManager.instance.document;
        const viewport = ContextManager.instance.viewport;
        if (!doc || !viewport || !viewport.scene) return;

        let entity = doc.activeEntity;
        if (!entity) {
            const pick = viewport.scene.pick(viewport.scene.pointerX, viewport.scene.pointerY);
            if (pick && pick.hit && pick.pickedMesh) {
                entity = pick.pickedMesh.metadata?.panelModel || pick.pickedMesh.metadata?.model;
                if (entity) {
                    doc.setActiveEntity(entity);
                }
            }
        }
        if (!entity && doc.getContainers().length > 0) {
            entity = doc.getContainers()[0]?.domainData as any;
            doc.setActiveEntity(entity);
        }
        if (!entity) return;

        // Zapobiegaj przemieszczaniu pojedynczych formatek z szafy/korpusu (pozycjonowanych silnikiem)
        const { target, isChildPanel } = doc.getTransformableTarget(entity);
        if (!target) return;

        if (isChildPanel) {
            const api = ContextManager.instance.appAPI;
            if (api && api.setStatus) {
                api.setStatus(`🔒 Panel "${entity.name}" jest pozycjonowany silnikiem. Przekierowano transformację na cały Korpus.`, true);
            }
        }

        const actualEntity = target;
        let node = ContextManager.instance.panelViews.get(actualEntity)?.root ||
                   ContextManager.instance.containerViews.get(actualEntity)?.rootNode ||
                   ContextManager.instance.containerViews.get(actualEntity)?.root;

        if (!node && actualEntity.name) {
            node = viewport.scene.getNodeByName(actualEntity.name) || viewport.scene.getNodeByName(actualEntity.id);
        }

        this.targetEntity = actualEntity;
        this.targetNode = node;
        this.activeMode = mode;
        this.lockedAxis = 'none';

        const cadNode = doc.findNode(actualEntity.id);
        if (cadNode) {
            this.initialMatrix = cadNode.localMatrix.clone();
            const { translation, rotation, scale } = cadNode.localMatrix.decompose();
            this.initialTranslationNm = translation;
            this.initialRotationQuat = rotation;
            this.initialScaleVec = scale;
        } else {
            this.initialMatrix = null;
        }

        (ContextManager.instance as any).solverController?.beginInteractiveTransform();
        ConstraintDragGroup.instance.begin(doc, actualEntity.id, ConstraintStore.instance.constraints);

        this.startPointerX = viewport.scene.pointerX;
        this.startPointerY = viewport.scene.pointerY;

        const gizmoCtrl = ContextManager.instance.gizmoController;
        if (gizmoCtrl) {
            if (mode === 'translate') {
                gizmoCtrl.showTranslateGizmo(this.targetEntity);
            } else if (mode === 'rotate') {
                gizmoCtrl.showRotateGizmo(this.targetEntity);
            }
        }

        this._notifyStateChange();
    }

    private _handlePointerMove(): void {
        if (this.activeMode === 'none' || !this.targetEntity) return;

        const viewport = ContextManager.instance.viewport;
        if (!viewport || !viewport.scene) return;

        const deltaX = viewport.scene.pointerX - this.startPointerX;
        const deltaY = viewport.scene.pointerY - this.startPointerY;

        if (this.activeMode === 'translate') {
            // Przeliczenie ruchu kursora 2D na ruch 3D z uwzględnieniem odległości kamery
            const camFactor = (viewport.camera ? viewport.camera.radius : 1500) * 0.0015;

            // Wektor kierunkowy kamery
            const transformMatrix = viewport.camera ? viewport.camera.getViewMatrix() : null;
            let rightX = 1, rightY = 0, rightZ = 0;
            let upX = 0, upY = 1, upZ = 0;

            if (transformMatrix) {
                rightX = transformMatrix.m[0];
                rightY = transformMatrix.m[4];
                rightZ = transformMatrix.m[8];

                upX = transformMatrix.m[1];
                upY = transformMatrix.m[5];
                upZ = transformMatrix.m[9];
            }

            let moveX = (rightX * deltaX - upX * deltaY) * camFactor;
            let moveY = (-rightY * deltaX + upY * deltaY) * camFactor;
            let moveZ = (rightZ * deltaX - upZ * deltaY) * camFactor;

            if (this.initialMatrix) {
                // Najpierw Babylon (GCS sceny), potem blokada w układzie CAD (Z=góra, Y=głęb)
                const moveDelta = lockCadDelta(
                    renderToCAD(new Vec3(moveX, moveY, moveZ)),
                    this.lockedAxis === 'none' ? 'none' : this.lockedAxis,
                );
                const cadNode = ContextManager.instance.document?.findNode(this.targetEntity.id);
                if (cadNode) {
                    const newPosNm = new Vec3(
                        this.initialTranslationNm.x + mmToNm(moveDelta.x),
                        this.initialTranslationNm.y + mmToNm(moveDelta.y),
                        this.initialTranslationNm.z + mmToNm(moveDelta.z)
                    );
                    cadNode.setLocalTransform(newPosNm, this.initialRotationQuat, this.initialScaleVec);
                    ConstraintDragGroup.instance.propagateTransform(
                        ContextManager.instance.document!,
                        this.targetEntity.id,
                    );
                    ContextManager.instance.sceneSyncAdapter.syncNodeToMesh(this.targetEntity.id);
                }
            }

        } else if (this.activeMode === 'rotate') {
            const rotFactor = 0.01; // Kąt obrotu w radianach
            const angle = (deltaX - deltaY) * rotFactor;
            
            if (this.initialMatrix) {
                const cadNode = ContextManager.instance.document?.findNode(this.targetEntity.id);
                if (cadNode) {
                    let rx = 0, ry = 0, rz = 0;
                    if (this.lockedAxis === 'x') rx = angle;
                    else if (this.lockedAxis === 'y') ry = angle;
                    else if (this.lockedAxis === 'z') rz = angle;
                    else rz = angle; // Domyślnie wokół CAD Z (wysokość)
                    
                    const deltaQuat = Quat.fromEulerXYZ(rx, ry, rz);
                    const newRot = this.initialRotationQuat.multiply(deltaQuat);
                    
                    cadNode.setLocalTransform(this.initialTranslationNm, newRot, this.initialScaleVec);
                    ConstraintDragGroup.instance.propagateTransform(
                        ContextManager.instance.document!,
                        this.targetEntity.id,
                    );
                    ContextManager.instance.sceneSyncAdapter.syncNodeToMesh(this.targetEntity.id);
                }
            }
        }

        // Poinformuj model i UI o zmianie
        if (ContextManager.instance.document) {
            ContextManager.instance.document.notifyDocumentChanged();
        }

        this._notifyStateChange();
    }

    public confirmTransform(): void {
        if (this.activeMode === 'none') return;

        const modeName = this.activeMode === 'translate' ? 'Przesunięcie' : 'Obrót';
        const entityName = this.targetEntity?.name || 'Obiektu';

        this.activeMode = 'none';
        this.lockedAxis = 'none';

        ConstraintDragGroup.instance.end();
        (ContextManager.instance as any).solverController?.endInteractiveTransform();

        // Powiadomienie API i dodanie do historii
        const api = ContextManager.instance.appAPI;
        if (api && api.setStatus) {
            api.setStatus(`Zatwierdzono ${modeName} ${entityName}`, false);
        }

        if (ContextManager.instance.document) {
            ContextManager.instance.document.notifyDocumentChanged();
        }

        if (ContextManager.instance.gizmoController) {
            ContextManager.instance.gizmoController.clearFaceGizmos();
        }

        this._notifyStateChange();
    }

    public cancelTransform(): void {
        if (this.activeMode === 'none') return;

        if (this.targetEntity) {
            const doc = ContextManager.instance.document;
            if (doc) {
                ConstraintDragGroup.instance.restoreInitial(doc);
            }
        }

        ConstraintDragGroup.instance.end();
        (ContextManager.instance as any).solverController?.endInteractiveTransform();

        this.activeMode = 'none';
        this.lockedAxis = 'none';

        const api = ContextManager.instance.appAPI;
        if (api && api.setStatus) {
            api.setStatus('Anulowano transformację', false);
        }

        if (ContextManager.instance.document) {
            ContextManager.instance.document.notifyDocumentChanged();
        }

        if (ContextManager.instance.gizmoController) {
            ContextManager.instance.gizmoController.clearFaceGizmos();
        }

        this._notifyStateChange();
    }

    public onStateChange(listener: (info: string | null) => void): () => void {
        this.onStateChangeListeners.add(listener);
        return () => this.onStateChangeListeners.delete(listener);
    }

    private _notifyStateChange(): void {
        let text: string | null = null;

        if (this.activeMode !== 'none' && this.targetEntity) {
            const modeText = this.activeMode === 'translate' ? '✋ Gizmo Przesuwanie [G]' : '🔄 Gizmo Obracanie [R]';
            const hint = this.activeMode === 'translate'
                ? 'Osi CAD: X=szer, Y=głęb, Z=wys | strzałka/kuleczka gizmo lub X/Y/Z'
                : 'Złap myszką za zakrzywiony pierścień osi (X, Y, Z)';
            const cadNode = ContextManager.instance.document?.findNode(this.targetEntity.id);
            let infoVal = '';
            if (cadNode) {
                const { translation, rotation } = cadNode.localMatrix.decompose();
                const eul = rotation.toEulerXYZ();
                if (this.activeMode === 'translate') {
                    infoVal = `(X: ${Math.round(nmToMm(translation.x))}, Y: ${Math.round(nmToMm(translation.y))}, Z: ${Math.round(nmToMm(translation.z))})`;
                } else {
                    infoVal = `(X: ${Math.round(eul.x * (180 / Math.PI))}°, Y: ${Math.round(eul.y * (180 / Math.PI))}°, Z: ${Math.round(eul.z * (180 / Math.PI))}°)`;
                }
            }

            text = `${modeText} ${infoVal} | ${hint} | ESC / RMB / Kliknięcie tła: Wyjdź`;
        }

        for (const listener of this.onStateChangeListeners) {
            try {
                listener(text);
            } catch (err) {
                console.error(err);
            }
        }

        const api = ContextManager.instance.appAPI;
        if (api && api.setStatus && text) {
            api.setStatus(text, true);
        }
    }
}
