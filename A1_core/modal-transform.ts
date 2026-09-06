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
    private modeListeners: Set<(mode: ModalTransformMode) => void> = new Set();
    private pointerObserver: any = null;
    private renderObserver: any = null;

    private widgetEl: HTMLElement | null = null;
    private isWidgetDragging: boolean = false;
    private widgetDragOffsetX: number = 0;
    private widgetDragOffsetY: number = 0;

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

        if (this.renderObserver) {
            viewport.scene.onBeforeRenderObservable.remove(this.renderObserver);
        }

        this.renderObserver = viewport.scene.onBeforeRenderObservable.add(() => {
            if (this.activeMode !== 'none') {
                this._updateWidgetUI();
            }
        });

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
                    // Nie zamykaj trybu jeśli kliknięto w jakikolwiek element gizma lub widget DOM
                    const targetEl = evt.target as HTMLElement;
                    const isInsideWidget = targetEl && (targetEl.closest('#modal-transform-widget') !== null);
                    if (!isGizmoMesh && !pointerInfo.pickInfo?.hit && !isInsideWidget) {
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

    public updateLiveValues(): void {
        this._updateWidgetUI();
    }

    private _setupKeyboardListeners(): void {
        if (typeof window === 'undefined') return;
        window.addEventListener('keydown', (evt: KeyboardEvent) => {
            // Ignoruj skróty gdy fokus jest w polach tekstowych
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
        this.lockedAxis = mode === 'rotate' ? 'z' : 'none';

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

        this._showWidget();
        this._notifyStateChange();
    }

    private _handlePointerMove(): void {
        if (this.activeMode === 'none' || !this.targetEntity) return;

        const viewport = ContextManager.instance.viewport;
        if (!viewport || !viewport.scene) return;

        const deltaX = viewport.scene.pointerX - this.startPointerX;
        const deltaY = viewport.scene.pointerY - this.startPointerY;

        if (this.activeMode === 'translate') {
            const camFactor = (viewport.camera ? viewport.camera.radius : 1500) * 0.0015;
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

            const moveX = (rightX * deltaX - upX * deltaY) * camFactor;
            const moveY = (-rightY * deltaX + upY * deltaY) * camFactor;
            const moveZ = (rightZ * deltaX - upZ * deltaY) * camFactor;

            if (this.initialMatrix) {
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
                    else rz = angle;
                    
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

        this._hideWidget();
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

        this._hideWidget();
        this._notifyStateChange();
    }

    public onStateChange(listener: (info: string | null) => void): () => void {
        this.onStateChangeListeners.add(listener);
        return () => this.onStateChangeListeners.delete(listener);
    }

    public subscribe(listener: (mode: ModalTransformMode) => void): () => void {
        this.modeListeners.add(listener);
        try {
            listener(this.activeMode);
        } catch (err) {
            console.error(err);
        }
        return () => this.modeListeners.delete(listener);
    }

    public toggleTransform(mode: ModalTransformMode): void {
        if (this.activeMode === mode) {
            this.confirmTransform();
        } else {
            if (this.activeMode !== 'none') {
                this.confirmTransform();
            }
            this.startTransform(mode);
        }
    }

    private _notifyStateChange(): void {
        let text: string | null = null;

        if (this.activeMode !== 'none' && this.targetEntity) {
            const modeText = this.activeMode === 'translate' ? '✋ Gizmo Przesuwanie [G]' : '🔄 Gizmo Obracanie [R]';
            const hint = this.activeMode === 'translate'
                ? 'Osi CAD: X=szer, Y=głęb, Z=wys | strzałka/kuleczka gizmo lub X/Y/Z'
                : 'Złap myszką za pierścień osi lub użyj okna wartości';
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

            text = `${modeText} ${infoVal} | ${hint} | ESC / RMB / Zatwierdź: Wyjdź`;
        }

        this._updateWidgetUI();

        for (const listener of this.onStateChangeListeners) {
            try {
                listener(text);
            } catch (err) {
                console.error(err);
            }
        }

        for (const listener of this.modeListeners) {
            try {
                listener(this.activeMode);
            } catch (err) {
                console.error(err);
            }
        }

        const api = ContextManager.instance.appAPI;
        if (api && api.setStatus && text) {
            api.setStatus(text, true);
        }
    }

    // ─── MINIMALISTYCZNY PŁYWAJĄCY PASEK WARTOŚCI (3 INPUTY) ───────────────────

    private _ensureWidget(): HTMLElement | null {
        if (typeof document === 'undefined') return null;
        let widget = document.getElementById('modal-transform-widget');
        if (widget) return widget;

        widget = document.createElement('div');
        widget.id = 'modal-transform-widget';
        widget.style.cssText = `
            position: fixed;
            top: 72px;
            right: 320px;
            z-index: 2000;
            display: none;
            align-items: center;
            gap: 6px;
            height: 32px;
            background: rgba(18, 20, 26, 0.92);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 102, 0, 0.7);
            border-radius: 6px;
            padding: 2px 8px 2px 10px;
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.65);
            font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #ffffff;
            user-select: none;
            pointer-events: auto;
            cursor: move;
        `;

        widget.innerHTML = `
            <span id="modal-transform-badge" style="font-size: 11px; font-weight: 700; color: #ff9933; letter-spacing: 0.5px; margin-right: 2px;">R:</span>
            
            <div style="display: flex; align-items: center; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 1px 4px; cursor: default;">
                <span style="color: #ff5555; font-weight: 700; font-size: 10px; margin-right: 2px;">X</span>
                <input id="modal-val-x" type="number" step="1" style="width: 42px; background: transparent; border: none; color: #fff; text-align: right; font-size: 11px; font-weight: 600; outline: none;" value="0" />
                <span id="modal-unit-x" style="color: #888; font-size: 9px; margin-left: 2px;">°</span>
            </div>

            <div style="display: flex; align-items: center; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 1px 4px; cursor: default;">
                <span style="color: #44dd44; font-weight: 700; font-size: 10px; margin-right: 2px;">Y</span>
                <input id="modal-val-y" type="number" step="1" style="width: 42px; background: transparent; border: none; color: #fff; text-align: right; font-size: 11px; font-weight: 600; outline: none;" value="0" />
                <span id="modal-unit-y" style="color: #888; font-size: 9px; margin-left: 2px;">°</span>
            </div>

            <div style="display: flex; align-items: center; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 1px 4px; cursor: default;">
                <span style="color: #3399ff; font-weight: 700; font-size: 10px; margin-right: 2px;">Z</span>
                <input id="modal-val-z" type="number" step="1" style="width: 42px; background: transparent; border: none; color: #fff; text-align: right; font-size: 11px; font-weight: 600; outline: none;" value="0" />
                <span id="modal-unit-z" style="color: #888; font-size: 9px; margin-left: 2px;">°</span>
            </div>

            <button id="modal-transform-close-btn" type="button" title="Anuluj (Esc)" style="background: transparent; border: none; color: #888; font-size: 12px; cursor: pointer; padding: 0 2px; margin-left: 2px; line-height: 1; border-radius: 3px; transition: color 0.15s;">✕</button>
        `;

        document.body.appendChild(widget);
        this.widgetEl = widget;

        this._bindWidgetEvents(widget);
        return widget;
    }

    private _bindWidgetEvents(widget: HTMLElement): void {
        widget.addEventListener('mousedown', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target && target.tagName === 'INPUT') return;
            this.isWidgetDragging = true;
            const rect = widget.getBoundingClientRect();
            this.widgetDragOffsetX = e.clientX - rect.left;
            this.widgetDragOffsetY = e.clientY - rect.top;
        });

        window.addEventListener('mousemove', (e: MouseEvent) => {
            if (!this.isWidgetDragging) return;
            widget.style.left = `${Math.max(10, e.clientX - this.widgetDragOffsetX)}px`;
            widget.style.top = `${Math.max(10, e.clientY - this.widgetDragOffsetY)}px`;
            widget.style.right = 'auto';
        });

        window.addEventListener('mouseup', () => {
            this.isWidgetDragging = false;
        });

        widget.addEventListener('pointerdown', (e) => e.stopPropagation());
        widget.addEventListener('click', (e) => e.stopPropagation());

        const closeBtn = widget.querySelector('#modal-transform-close-btn') as HTMLElement;
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.cancelTransform());
        }

        const inputX = widget.querySelector('#modal-val-x') as HTMLInputElement;
        const inputY = widget.querySelector('#modal-val-y') as HTMLInputElement;
        const inputZ = widget.querySelector('#modal-val-z') as HTMLInputElement;

        const handleValChange = () => {
            const x = parseFloat(inputX?.value || '0') || 0;
            const y = parseFloat(inputY?.value || '0') || 0;
            const z = parseFloat(inputZ?.value || '0') || 0;

            if (this.activeMode === 'rotate') {
                this._setRotationExact(x, y, z);
            } else if (this.activeMode === 'translate') {
                this._setTranslationExact(x, y, z);
            }
        };

        [inputX, inputY, inputZ].forEach((input) => {
            if (!input) return;
            input.addEventListener('input', handleValChange);
            input.addEventListener('change', handleValChange);
            input.addEventListener('keydown', (e: KeyboardEvent) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    this.confirmTransform();
                } else if (e.key === 'Escape') {
                    this.cancelTransform();
                }
            });
        });
    }

    private _showWidget(): void {
        const widget = this._ensureWidget();
        if (!widget) return;

        const badgeEl = widget.querySelector('#modal-transform-badge');
        const unitXEl = widget.querySelector('#modal-unit-x');
        const unitYEl = widget.querySelector('#modal-unit-y');
        const unitZEl = widget.querySelector('#modal-unit-z');

        const unitStr = this.activeMode === 'rotate' ? '°' : 'mm';
        const badgeStr = this.activeMode === 'rotate' ? '🔄 R:' : '✋ G:';

        if (badgeEl) badgeEl.textContent = badgeStr;
        if (unitXEl) unitXEl.textContent = unitStr;
        if (unitYEl) unitYEl.textContent = unitStr;
        if (unitZEl) unitZEl.textContent = unitStr;

        widget.style.display = 'flex';
        this._updateWidgetUI();
    }

    private _hideWidget(): void {
        if (typeof document === 'undefined') return;
        const widget = document.getElementById('modal-transform-widget');
        if (widget) {
            widget.style.display = 'none';
        }
    }

    private _updateWidgetUI(): void {
        if (typeof document === 'undefined') return;
        const widget = document.getElementById('modal-transform-widget');
        if (!widget || widget.style.display === 'none' || !this.targetEntity) return;

        const cadNode = ContextManager.instance.document?.findNode(this.targetEntity.id);
        if (!cadNode) return;

        const { translation, rotation } = cadNode.localMatrix.decompose();
        const eul = rotation.toEulerXYZ();

        const inputX = widget.querySelector('#modal-val-x') as HTMLInputElement;
        const inputY = widget.querySelector('#modal-val-y') as HTMLInputElement;
        const inputZ = widget.querySelector('#modal-val-z') as HTMLInputElement;

        const activeEl = document.activeElement;

        if (this.activeMode === 'rotate') {
            if (inputX && activeEl !== inputX) inputX.value = String(Math.round(eul.x * (180 / Math.PI)));
            if (inputY && activeEl !== inputY) inputY.value = String(Math.round(eul.y * (180 / Math.PI)));
            if (inputZ && activeEl !== inputZ) inputZ.value = String(Math.round(eul.z * (180 / Math.PI)));
        } else if (this.activeMode === 'translate') {
            if (inputX && activeEl !== inputX) inputX.value = String(Math.round(nmToMm(translation.x)));
            if (inputY && activeEl !== inputY) inputY.value = String(Math.round(nmToMm(translation.y)));
            if (inputZ && activeEl !== inputZ) inputZ.value = String(Math.round(nmToMm(translation.z)));
        }
    }

    private _setRotationExact(rxDeg: number, ryDeg: number, rzDeg: number): void {
        if (!this.targetEntity) return;
        const cadNode = ContextManager.instance.document?.findNode(this.targetEntity.id);
        if (!cadNode) return;

        const rx = rxDeg * (Math.PI / 180);
        const ry = ryDeg * (Math.PI / 180);
        const rz = rzDeg * (Math.PI / 180);

        const newRot = Quat.fromEulerXYZ(rx, ry, rz);
        const { translation, scale } = cadNode.localMatrix.decompose();

        cadNode.setLocalTransform(translation, newRot, scale);
        ConstraintDragGroup.instance.propagateTransform(ContextManager.instance.document!, this.targetEntity.id);
        ContextManager.instance.sceneSyncAdapter.syncNodeToMesh(this.targetEntity.id);

        if (ContextManager.instance.gizmoController) {
            ContextManager.instance.gizmoController.showRotateGizmo(this.targetEntity);
        }

        if (ContextManager.instance.document) {
            ContextManager.instance.document.notifyDocumentChanged();
        }
        this._notifyStateChange();
    }

    private _setTranslationExact(xMm: number, yMm: number, zMm: number): void {
        if (!this.targetEntity) return;
        const cadNode = ContextManager.instance.document?.findNode(this.targetEntity.id);
        if (!cadNode) return;

        const newPosNm = new Vec3(mmToNm(xMm), mmToNm(yMm), mmToNm(zMm));
        const { rotation, scale } = cadNode.localMatrix.decompose();

        cadNode.setLocalTransform(newPosNm, rotation, scale);
        ConstraintDragGroup.instance.propagateTransform(ContextManager.instance.document!, this.targetEntity.id);
        ContextManager.instance.sceneSyncAdapter.syncNodeToMesh(this.targetEntity.id);

        if (ContextManager.instance.gizmoController) {
            ContextManager.instance.gizmoController.showTranslateGizmo(this.targetEntity);
        }

        if (ContextManager.instance.document) {
            ContextManager.instance.document.notifyDocumentChanged();
        }
        this._notifyStateChange();
    }
}


