/**
 * SmartPanel Web — Gizmo Controller
 * 
 * Obsługuje interaktywne kontrolki 3D (Position Gizmo, Push/Pull gizmo kulkowe na ściankach,
 * floating input z wymiarem mm).
 */

import { ContextManager } from './context-manager.js';
import { applyRealtimeUpdate } from '../A3_smartframe/smartframe-adapter.js';
import { Vec3 } from './cad-math/vec3.js';
import { Mat4 } from './cad-math/mat4.js';
import { nmToMm } from './cad-math/units.js';
import { TransformNodeCommand } from './commands/transform-node-command.js';
import { MacroCommand } from './commands/macro-command.js';
import { SyncBackGroovesCommand } from './commands/sync-back-grooves-command.js';
import { ConstraintStore } from '../S2_solver/constraint-store.js';
import { ConstraintDragGroup } from '../S2_solver/constraint-drag-group.js';
import { CadTranslateGizmo } from './cad-translate-gizmo.js';

import { normalizeFaceName } from '../A4_smartpanel/panel-model.js';

declare const BABYLON: any;

export class GizmoController {
    private activeFaceGizmoSpheres: any[] = [];
    private isDraggingFaceGizmo = false;
    private isEditingFaceGizmo = false;
    private activeGizmoSphere: any = null;
    private activeGizmoParamName = '';
    private activeGizmoContainer: any = null;
    private originalValueBeforeEdit = 0;
    private badgeFixedPos: { left: number, top: number } | null = null;
    private positionGizmo: CadTranslateGizmo | null = null;
    private rotationGizmo: any = null;
    private freeDragSphere: any = null;
    private matrixBeforeDrag: Mat4 | null = null;

    private pushPullMapping: Record<string, Record<string, string>> = {
        'LEFT_SIDE_PANEL': {
            'top': '-Y',    // Krawędź górna korpusu (-Y / top offset)
            'bottom': '+Y', // Krawędź dolna korpusu (+Y / bottom offset)
            'left': '+X',   // Ścianka left z tyłu korpusu -> (+X / pXPlus offset)
            'right': '-X'   // Ścianka right z przodu korpusu -> (-X / pXMinus offset)
        },
        'SIDE_LEFT': {
            'top': '-Y',
            'bottom': '+Y',
            'left': '+X',
            'right': '-X'
        },
        'RIGHT_SIDE_PANEL': {
            'bottom': '-Y',
            'top': '+Y',
            'right': '+X',  // Ścianka right (+X) z tyłu korpusu -> (+X / pXPlus offset)
            'left': '-X'    // Ścianka left (-X) z przodu korpusu -> (-X / pXMinus offset)
        },
        'SIDE_RIGHT': {
            'bottom': '-Y',
            'top': '+Y',
            'right': '+X',
            'left': '-X'
        },
        'VERTICAL_DIVIDER': {
            'bottom': '-Y',
            'top': '+Y',
            'right': '+X',
            'left': '-X'
        },
        'DIVIDER': {
            'bottom': '-Y',
            'top': '+Y',
            'right': '+X',
            'left': '-X'
        },
        'BOTTOM_PANEL': {
            'bottom': '+X',  // Krawędź tylna (+X / pXPlus offset)
            'top': '-X',     // Krawędź przednia (-X / pXMinus offset)
            'left': '-Y',    // Krawędź lewa (-Y / pYMinus offset)
            'right': '+Y'    // Krawędź prawa (+Y / pYPlus offset)
        },
        'TOP_PANEL': {
            'bottom': '-X', // Odbicie wokół X: lokalny -Y leży z PRZODU korpusu (-X / pXMinus offset)
            'top': '+X',    // Lokalny +Y leży z TYŁU korpusu (+X / pXPlus offset)
            'left': '-Y',   // Krawędź lewa (-Y offset)
            'right': '+Y'   // Krawędź prawa (+Y offset)
        },
        'SHELF_PANEL': {
            'bottom': '+X',
            'top': '-X',
            'left': '-Y',
            'right': '+Y'
        },
        'SHELF': {
            'bottom': '+X',
            'top': '-X',
            'left': '-Y',
            'right': '+Y'
        },
        'BACK_PANEL': { 'top': '+Y', 'bottom': '-Y', 'left': '-X', 'right': '+X', 'front': 'shiftY' }
    };

    private faceNormals: Record<string, any> = {};

    constructor() {
        if (typeof BABYLON !== 'undefined') {
            this.faceNormals = {
                // Canonical FACE_
                'FACE_Y_PLUS': new BABYLON.Vector3(0, 1, 0),
                'FACE_Y_MINUS': new BABYLON.Vector3(0, -1, 0),
                'FACE_Z_PLUS': new BABYLON.Vector3(0, 0, 1),
                'FACE_Z_MINUS': new BABYLON.Vector3(0, 0, -1),
                'FACE_X_MINUS': new BABYLON.Vector3(-1, 0, 0),
                'FACE_X_PLUS': new BABYLON.Vector3(1, 0, 0),
                // Legacy aliasy
                'top': new BABYLON.Vector3(0, 1, 0),
                'bottom': new BABYLON.Vector3(0, -1, 0),
                'front': new BABYLON.Vector3(0, 0, 1),
                'back': new BABYLON.Vector3(0, 0, -1),
                'left': new BABYLON.Vector3(-1, 0, 0),
                'right': new BABYLON.Vector3(1, 0, 0)
            };
        }
    }

    public init(): void {
        const viewport = ContextManager.instance.viewport;
        if (!viewport || !viewport.scene) return;

        this.createFloatingInput();

        viewport.scene.onBeforeRenderObservable.add(() => {
            if ((this.isDraggingFaceGizmo || this.isEditingFaceGizmo) && this.activeGizmoSphere && this.activeGizmoContainer && this.activeGizmoParamName) {
                const badge = document.getElementById('gizmo-floating-input');
                const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
                const canvas = viewport.canvas;
                if (badge && input && canvas) {
                    badge.style.display = 'flex';
                    
                    // Jeśli użytkownik jest w trakcie edycji tekstu, przypnij pozycję pola na ekranie,
                    // aby zmiana gabarytu płyty w 3D nie powodowała przeskakiwania badge'a na ekranie!
                    if (this.isEditingFaceGizmo && this.badgeFixedPos) {
                        badge.style.left = `${this.badgeFixedPos.left}px`;
                        badge.style.top = `${this.badgeFixedPos.top}px`;
                    } else if (this.isDraggingFaceGizmo || !this.badgeFixedPos) {
                        const screenPos = BABYLON.Vector3.Project(
                            this.activeGizmoSphere.absolutePosition,
                            BABYLON.Matrix.Identity(),
                            viewport.scene.getTransformMatrix(),
                            viewport.scene.activeCamera.viewport.toGlobal(
                                viewport.engine.getRenderWidth(),
                                viewport.engine.getRenderHeight()
                            )
                        );

                        const canvasRect = canvas.getBoundingClientRect();
                        const curLeft = canvasRect.left + screenPos.x + 20;
                        const curTop = canvasRect.top + screenPos.y - 45;
                        badge.style.left = `${curLeft}px`;
                        badge.style.top = `${curTop}px`;

                        if (this.isEditingFaceGizmo && !this.badgeFixedPos) {
                            this.badgeFixedPos = { left: curLeft, top: curTop };
                        }
                    }

                    if (document.activeElement !== input) {
                        const currentVal = this.activeGizmoContainer.generatorParams.offsets?.[this.activeGizmoParamName] || 0;
                        input.value = currentVal.toString();
                    }
                }
            } else {
                const badge = document.getElementById('gizmo-floating-input');
                if (badge && badge.style.display !== 'none' && !this.isEditingFaceGizmo) {
                    badge.style.display = 'none';
                    this.badgeFixedPos = null;
                }
            }
        });

        ContextManager.instance.hidePositionGizmo = () => {
            this.clearFaceGizmos();
        };

        ContextManager.instance.showGizmos = () => {
            this.updateFaceGizmo();
        };
    }

    public createFloatingInput(): void {
        if (document.getElementById('gizmo-floating-input')) return;

        const style = document.createElement('style');
        style.innerHTML = `
            #gizmo-input-field::-webkit-outer-spin-button,
            #gizmo-input-field::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            #gizmo-input-field {
                -moz-appearance: textfield;
            }
        `;
        document.head.appendChild(style);

        const badge = document.createElement('div');
        badge.id = 'gizmo-floating-input';
        badge.style.cssText = `
            position: absolute;
            display: none;
            z-index: 1000;
            pointer-events: auto;
            background: rgba(20, 20, 20, 0.85);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1.5px solid rgba(255, 102, 0, 0.8);
            border-radius: 6px;
            padding: 2px 6px;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            font-family: 'Outfit', 'Inter', sans-serif;
            color: #fff;
            font-size: 13px;
        `;

        const input = document.createElement('input');
        input.type = 'text'; // Obsługa wyrażeń matematycznych (np. 88+10, 600/2)
        input.id = 'gizmo-input-field';
        input.style.cssText = `
            background: transparent;
            border: none;
            color: #fff;
            font-family: inherit;
            font-size: 13px;
            min-width: 45px;
            width: auto;
            text-align: right;
            outline: none;
            font-weight: bold;
        `;

        const unit = document.createElement('span');
        unit.innerText = 'mm';
        unit.style.cssText = `
            margin-left: 2px;
            color: rgba(255,255,255,0.7);
            font-weight: 500;
        `;

        badge.appendChild(input);
        badge.appendChild(unit);
        document.body.appendChild(badge);

        this.initFloatingInputEvents(input, badge);
    }

    /**
     * Bezpieczny ewaluator wyrażeń matematycznych dla inputów gizm (np. "88+10", "150-12", "600/2", "18*2")
     */
    private evaluateMathExpression(expr: string): number | null {
        if (!expr) return null;
        // Zamień przecinki na kropki (np. 88,5 -> 88.5)
        const cleaned = expr.replace(/,/g, '.').trim();
        // Zezwalaj wyłącznie na cyfry, operatory +, -, *, /, ., oraz nawiasy
        if (!/^[0-9\s\+\-\*\/\.\(\)]+$/.test(cleaned)) return null;

        try {
            const fn = new Function(`"use strict"; return (${cleaned});`);
            const res = fn();
            if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
                return Math.round(res * 100) / 100;
            }
        } catch {
            return null;
        }
        return null;
    }

    private initFloatingInputEvents(input: HTMLInputElement, badge: HTMLElement): void {
        input.oninput = () => {
            if (!this.activeGizmoContainer || !this.activeGizmoParamName) return;

            // Dynamiczne dopasowanie szerokości inputa do długości wpisywanego wyrażenia
            input.style.width = `${Math.max(45, input.value.length * 9)}px`;

            const val = this.evaluateMathExpression(input.value);
            if (val === null) return;

            if (!this.activeGizmoContainer.generatorParams.offsets) {
                this.activeGizmoContainer.generatorParams.offsets = {};
            }
            this.activeGizmoContainer.generatorParams.offsets[this.activeGizmoParamName] = val;

            const doc = ContextManager.instance.document;
            if (doc) {
                applyRealtimeUpdate(doc, {
                    width: nmToMm(this.activeGizmoContainer.width),
                    height: nmToMm(this.activeGizmoContainer.height),
                    depth: nmToMm(this.activeGizmoContainer.depth),
                    zoneCount: this.activeGizmoContainer.generatorParams.zoneCount || 1,
                    bottomHeight: this.activeGizmoContainer.generatorParams.bottomHeight || 500,
                    middleHeight: this.activeGizmoContainer.generatorParams.middleHeight || 1200,
                    backOffset: this.activeGizmoContainer.generatorParams.backOffset || 0,
                    offsets: this.activeGizmoContainer.generatorParams.offsets
                });
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                if (input.value) {
                    const val = this.evaluateMathExpression(input.value);
                    if (val !== null) {
                        input.value = val.toString();
                    }
                }
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = this.originalValueBeforeEdit.toString();
                if (this.activeGizmoContainer && this.activeGizmoParamName) {
                    this.activeGizmoContainer.generatorParams.offsets[this.activeGizmoParamName] = this.originalValueBeforeEdit;
                    const doc = ContextManager.instance.document;
                    if (doc) {
                        applyRealtimeUpdate(doc, {
                            width: nmToMm(this.activeGizmoContainer.width),
                            height: nmToMm(this.activeGizmoContainer.height),
                            depth: nmToMm(this.activeGizmoContainer.depth),
                            zoneCount: this.activeGizmoContainer.generatorParams.zoneCount || 1,
                            bottomHeight: this.activeGizmoContainer.generatorParams.bottomHeight || 500,
                            middleHeight: this.activeGizmoContainer.generatorParams.middleHeight || 1200,
                            backOffset: this.activeGizmoContainer.generatorParams.backOffset || 0,
                            offsets: this.activeGizmoContainer.generatorParams.offsets
                        });
                    }
                }
                input.blur();
            }
        };

        input.onfocus = () => {
            this.isEditingFaceGizmo = true;
        };

        input.onblur = () => {
            if (input.value) {
                const val = this.evaluateMathExpression(input.value);
                if (val !== null) {
                    input.value = val.toString();
                }
            }
            this.isEditingFaceGizmo = false;
            this.badgeFixedPos = null;
            badge.style.display = 'none';
            this.activeGizmoSphere = null;
            this.activeGizmoParamName = '';
            this.activeGizmoContainer = null;
            setTimeout(() => {
                this.updateFaceGizmo();
            }, 80);
        };
    }

    public clearFaceGizmos(): void {
        for (const sphere of this.activeFaceGizmoSpheres) {
            try { sphere.dispose(); } catch {}
        }
        this.activeFaceGizmoSpheres = [];

        if (this.positionGizmo) {
            this.positionGizmo.attachedNode = null;
        }
        if (this.rotationGizmo) {
            this.rotationGizmo.attachedNode = null;
        }
        if (this.freeDragSphere && !this.freeDragSphere.isDisposed()) {
            this.freeDragSphere.setEnabled(false);
        }
    }

    public showTranslateGizmo(entity?: any): void {
        const doc = ContextManager.instance.document;
        const viewport = ContextManager.instance.viewport;
        const panelViews = ContextManager.instance.panelViews;
        const containerViews = ContextManager.instance.containerViews;
        if (!doc || !viewport) return;

        const rawEntity = entity || doc.activeEntity;
        if (!rawEntity) return;

        const { target: activeEntity } = doc.getTransformableTarget(rawEntity);
        if (!activeEntity) return;

        const targetNode = panelViews.get(activeEntity)?.root ||
                           containerViews.get(activeEntity)?.rootNode ||
                           containerViews.get(activeEntity)?.root ||
                           (activeEntity.name ? viewport.scene.getNodeByName(activeEntity.name) : null);
        if (targetNode && typeof BABYLON !== 'undefined') {
            if (BABYLON.AxisDragGizmo) {
                if (!this.positionGizmo) {
                    this.positionGizmo = new CadTranslateGizmo(viewport.scene);
                    this.positionGizmo.onDragStart(() => {
                        if (viewport.camera) viewport.camera.detachControl();
                        this._beginConstraintDrag();
                    });
                    this.positionGizmo.onDrag(() => this._onTranslateDrag());
                    this.positionGizmo.onDragEnd(() => this._onTranslateDragEnd());
                }
                this.positionGizmo.attachedNode = targetNode;
            }

            // Centralna kuleczka do swobodnego przesuwania
            if (!this.freeDragSphere || this.freeDragSphere.isDisposed()) {
                this.freeDragSphere = BABYLON.MeshBuilder.CreateSphere('freeDragCenterSphere', { diameter: 24 }, viewport.scene);
                const mat = new BABYLON.StandardMaterial('freeDragSphereMat', viewport.scene);
                mat.diffuseColor = new BABYLON.Color3(0.1, 0.45, 0.95); // BLUE
                mat.emissiveColor = new BABYLON.Color3(0.05, 0.3, 0.7); // BLUE
                this.freeDragSphere.material = mat;

                const dragBehavior = new BABYLON.PointerDragBehavior();
                dragBehavior.useObjectOrientationForDragging = false;

                dragBehavior.onDragStartObservable.add(() => {
                    if (viewport.camera) viewport.camera.detachControl();
                    this._beginConstraintDrag();
                });

                dragBehavior.onDragObservable.add(() => {
                    const ctx = this._resolveTransformTarget();
                    const liveTarget = ctx ? this._resolveTargetMesh(ctx.entity) : null;
                    if (liveTarget && this.freeDragSphere) {
                        this._setNodeWorldPosition(liveTarget, this.freeDragSphere.position);
                    }
                    this._onTranslateDrag();
                });

                dragBehavior.onDragEndObservable.add(() => this._onTranslateDragEnd());

                this.freeDragSphere.addBehavior(dragBehavior);
            }

            this._syncFreeDragSphereToNode(targetNode);
            this.freeDragSphere.setEnabled(true);
        }
    }

    public showRotateGizmo(entity?: any): void {
        const doc = ContextManager.instance.document;
        const viewport = ContextManager.instance.viewport;
        const panelViews = ContextManager.instance.panelViews;
        const containerViews = ContextManager.instance.containerViews;
        if (!doc || !viewport) return;

        const rawEntity = entity || doc.activeEntity;
        if (!rawEntity) return;

        const { target: activeEntity } = doc.getTransformableTarget(rawEntity);
        if (!activeEntity) return;

        const targetNode = panelViews.get(activeEntity)?.root ||
                           containerViews.get(activeEntity)?.rootNode ||
                           containerViews.get(activeEntity)?.root ||
                           (activeEntity.name ? viewport.scene.getNodeByName(activeEntity.name) : null);

        if (targetNode && typeof BABYLON !== 'undefined' && BABYLON.RotationGizmo) {
            if (!this.rotationGizmo) {
                this.rotationGizmo = new BABYLON.RotationGizmo();

                const onRotDragStart = () => {
                    if (viewport.camera) viewport.camera.detachControl();
                    this._beginConstraintDrag();
                };

                const onRotDrag = () => {
                    const ctx = this._resolveTransformTarget();
                    if (!ctx) return;
                    const targetNode = this._resolveTargetMesh(ctx.entity);
                    if (targetNode) {
                        ContextManager.instance.sceneSyncAdapter.syncFromMesh(targetNode);
                    }
                    this._propagateConstraintDrag();
                    const cadNode = ctx.doc.findNode(ctx.entity.id);
                    if (cadNode) {
                        const eul = cadNode.localMatrix.decompose().rotation.toEulerXYZ();
                        const degX = Math.round(eul.x * (180 / Math.PI));
                        const degY = Math.round(eul.y * (180 / Math.PI));
                        const degZ = Math.round(eul.z * (180 / Math.PI));
                        const api = ContextManager.instance.appAPI ?? (window as any).api;
                        api?.setStatus?.(
                            `🔄 CAD ° → X: ${degX} | Y: ${degY} (głęb) | Z: ${degZ} (góra)`,
                            true,
                        );
                    }
                };

                const onRotDragEnd = () => {
                    if (viewport.camera) viewport.camera.attachControl(viewport.canvas, true);
                    if (activeEntity && targetNode) {
                        ContextManager.instance.sceneSyncAdapter.syncFromMesh(targetNode);
                        const label = `Obrót ${activeEntity.name || 'obiektu'}`;
                        this._commitConstraintDrag(activeEntity, label);
                    }
                };

                for (const g of [this.rotationGizmo.xGizmo, this.rotationGizmo.yGizmo, this.rotationGizmo.zGizmo]) {
                    if (g && g.dragBehavior) {
                        g.dragBehavior.onDragStartObservable.add(onRotDragStart);
                        g.dragBehavior.onDragObservable.add(onRotDrag);
                        g.dragBehavior.onDragEndObservable.add(onRotDragEnd);
                    }
                }
            }
            if (this.rotationGizmo.yGizmo) this.rotationGizmo.yGizmo.color = new BABYLON.Color3(0.1, 0.45, 0.95); // obrót CAD Z (oś pionowa)
            if (this.rotationGizmo.zGizmo) this.rotationGizmo.zGizmo.color = new BABYLON.Color3(0.12, 0.82, 0.18); // obrót CAD Y (głęb)
            if (this.rotationGizmo.xGizmo) this.rotationGizmo.xGizmo.color = new BABYLON.Color3(0.92, 0.12, 0.12);
            this.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
            this.rotationGizmo.attachedNode = targetNode;
        }
    }

    public updateFaceGizmo(): void {
        this.createFloatingInput();

        if (this.isDraggingFaceGizmo || this.isEditingFaceGizmo) {
            return;
        }

        const modalMgr = ContextManager.instance.modalTransformManager;
        if (modalMgr && modalMgr.activeMode !== 'none') {
            const activeEntity = ContextManager.instance.document?.activeEntity;
            if (activeEntity) {
                if (modalMgr.activeMode === 'translate') {
                    this.showTranslateGizmo(activeEntity);
                } else if (modalMgr.activeMode === 'rotate') {
                    this.showRotateGizmo(activeEntity);
                }
            }
            return;
        }

        this.clearFaceGizmos();

        const doc = ContextManager.instance.document;
        const viewport = ContextManager.instance.viewport;
        const panelViews = ContextManager.instance.panelViews;
        const facePicker = ContextManager.instance.facePicker;

        if (!doc || !viewport) return;

        const activeEntity = doc.activeEntity;
        if (!activeEntity) return;

        // Gizma push/pull (pomarańczowe kulki) są zarezerwowane WYŁĄCZNIE dla zakładki Korpus (A3_smartframe / selectionMode === 'object')
        if (facePicker && facePicker.selectionMode !== 'object') {
            return;
        }

        if (activeEntity.type !== 'container') {
            const view = panelViews.get(activeEntity);
            if (!view || !view.faceMeshes) return;

            const role = (activeEntity as any).role;
            if (!role || !this.pushPullMapping[role]) return;

            const mapping = this.pushPullMapping[role];
            const rawContainer: any = doc.getContainers()[0];
            const container: any = rawContainer?.domainData || rawContainer;
            if (!container || !container.generatorParams) return;

            const panelName = activeEntity.name;

            for (const [faceName, suffix] of Object.entries(mapping)) {
                const paramName = `${panelName}_${suffix}`;
                const canonicalFace = normalizeFaceName(faceName);
                const mesh = view.faceMeshes[canonicalFace] || view.faceMeshes[faceName];
                if (!mesh) continue;

                mesh.computeWorldMatrix(true);
                const faceCenter = mesh.getBoundingInfo().boundingBox.centerWorld;
                
                view.root.computeWorldMatrix(true);
                const localNormal = this.faceNormals[canonicalFace] || this.faceNormals[faceName] || new BABYLON.Vector3(0, 1, 0);
                const normal = BABYLON.Vector3.TransformNormal(localNormal, view.root.getWorldMatrix()).normalize();

                const sphere = BABYLON.MeshBuilder.CreateSphere(`faceGizmoSphere_${faceName}`, { diameter: 30 }, viewport.scene);
                sphere.metadata = { paramName: paramName };
                sphere.position.copyFrom(faceCenter);
                sphere.position.addInPlace(normal.scale(20));

                // Centralna kulka przesuwania na środku płaszczyzny (front/back) -> ZAWSZE NIEBIESKA
                const isCenterPlane = faceName === 'front' || faceName === 'back' || paramName.includes('shift');

                let diffuseColor: any;
                let emissiveColor: any;

                if (isCenterPlane) {
                    // Środek płyty / Przesuwanie -> NIEBIESKI
                    diffuseColor = new BABYLON.Color3(0.1, 0.45, 0.95);
                    emissiveColor = new BABYLON.Color3(0.05, 0.3, 0.7);
                } else if (paramName.includes('+Y') || paramName.includes('-Y') || paramName.includes('pY') || faceName === 'top' || faceName === 'bottom') {
                    // Kierunek Y (Góra / Dół) -> ZIELONY
                    diffuseColor = new BABYLON.Color3(0.15, 0.8, 0.25);
                    emissiveColor = new BABYLON.Color3(0.1, 0.6, 0.15);
                } else {
                    // Kierunek X (Przód / Tył / Boki) -> CZERWONY
                    diffuseColor = new BABYLON.Color3(0.9, 0.15, 0.15);
                    emissiveColor = new BABYLON.Color3(0.7, 0.1, 0.1);
                }

                const mat = new BABYLON.StandardMaterial(`faceGizmoSphereMat_${faceName}`, viewport.scene);
                mat.diffuseColor = diffuseColor;
                mat.emissiveColor = emissiveColor;
                sphere.material = mat;
                sphere.setParent(view.root);

                const dragBehavior = new BABYLON.PointerDragBehavior({
                    dragAxis: normal
                });

                let originalValue = 0;
                let startPos: any = null;

                dragBehavior.onDragStartObservable.add(() => {
                    this.isDraggingFaceGizmo = true;
                    this.activeGizmoSphere = sphere;
                    this.activeGizmoParamName = paramName;
                    this.activeGizmoContainer = container;
                    const c = container as any;
                    this.originalValueBeforeEdit = (c.generatorParams.offsets && c.generatorParams.offsets[paramName]) ? c.generatorParams.offsets[paramName] : 0;

                    viewport.camera.detachControl();
                    originalValue = this.originalValueBeforeEdit;
                    sphere.setParent(null);
                    startPos = sphere.position.clone();
                });

                dragBehavior.onDragObservable.add(() => {
                    const c = container as any;
                    const diffVec = sphere.position.subtract(startPos);
                    let delta = BABYLON.Vector3.Dot(diffVec, normal);
                    delta = Math.round(delta);

                    const newValue = originalValue + delta;
                    if (!c.generatorParams.offsets) {
                        c.generatorParams.offsets = {};
                    }

                    if (c.generatorParams.offsets[paramName] === newValue) {
                        return;
                    }

                    c.generatorParams.offsets[paramName] = newValue;

                    applyRealtimeUpdate(doc, {
                        width: nmToMm(c.width),
                        height: nmToMm(c.height),
                        depth: nmToMm(c.depth),
                        zoneCount: c.generatorParams.zoneCount || 1,
                        bottomHeight: c.generatorParams.bottomHeight || 500,
                        middleHeight: c.generatorParams.middleHeight || 1200,
                        backOffset: c.generatorParams.backOffset || 0,
                        offsets: c.generatorParams.offsets
                    });
                });

                dragBehavior.onDragEndObservable.add(() => {
                    this.isDraggingFaceGizmo = false;
                    viewport.camera.attachControl(viewport.canvas, true);
                    
                    const lastParam = this.activeGizmoParamName;
                    
                    this.updateFaceGizmo();
                    
                    if (lastParam) {
                        const newSphere = this.activeFaceGizmoSpheres.find(s => s.metadata?.paramName === lastParam);
                        if (newSphere) {
                            this.activeGizmoSphere = newSphere;
                            this.activeGizmoParamName = lastParam;
                            this.isEditingFaceGizmo = true; // Keep input visible
                            
                            setTimeout(() => {
                                const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
                                if (input) {
                                    input.focus();
                                    input.select();
                                }
                            }, 50);
                        }
                    }
                });

                sphere.addBehavior(dragBehavior);
                this.activeFaceGizmoSpheres.push(sphere);
            }

            // --- DODANIE 5-TEJ ZIELONEJ KULI DO PRZESUWANIA (SHIFT) ---
            if (view && view.root && role) {
                let shiftParam = '';
                let shiftAxis = new BABYLON.Vector3(1, 0, 0); // Domyślnie X
                
                if (role.includes('LEFT') || role === 'LEFT_SIDE_PANEL' || role === 'SIDE_LEFT') {
                    shiftParam = 'shiftX';
                    shiftAxis = new BABYLON.Vector3(-1, 0, 0); // Dla lewego boku (-X na zewnątrz korpusu)
                } else if (role.includes('SIDE') || role.includes('DIVIDER')) {
                    shiftParam = 'shiftX';
                    shiftAxis = new BABYLON.Vector3(1, 0, 0);  // Dla prawego boku i przegród (+X na zewnątrz korpusu)
                } else if (role.includes('BOTTOM') || role === 'BOTTOM_PANEL') {
                    shiftParam = 'shiftZ';
                    shiftAxis = new BABYLON.Vector3(0, -1, 0); // Dla wieńca dolnego (-Z na zewnątrz korpusu w dół)
                } else if (role.includes('TOP') || role.includes('SHELF')) {
                    shiftParam = 'shiftZ';
                    shiftAxis = new BABYLON.Vector3(0, 1, 0);  // Dla wieńca górnego i półek (+Z na zewnątrz korpusu w górę)
                } else if (role.includes('BACK')) {
                    shiftParam = 'shiftY';
                    shiftAxis = new BABYLON.Vector3(0, 0, 1); // W świecie 3D (Z to Y w CAD)
                }

                if (shiftParam) {
                    const paramName = `${panelName}_${shiftParam}`;
                    
                    const centerSphere = BABYLON.MeshBuilder.CreateSphere(`faceGizmoSphere_center`, { diameter: 24 }, viewport.scene);
                    centerSphere.metadata = { paramName: paramName };
                    centerSphere.position.copyFrom(view.root.position);
                    
                    // Środkowa kula do przesuwania (shift) -> ZAWSZE NIEBIESKA
                    const diffuseColor = new BABYLON.Color3(0.1, 0.45, 0.95);
                    const emissiveColor = new BABYLON.Color3(0.05, 0.3, 0.7);

                    const mat = new BABYLON.StandardMaterial('freeDragSphereMat_faceMode', viewport.scene);
                    mat.diffuseColor = diffuseColor;
                    mat.emissiveColor = emissiveColor;
                    centerSphere.material = mat;

                    const centerDrag = new BABYLON.PointerDragBehavior({
                        dragAxis: shiftAxis
                    });
                    
                    let originalValue = 0;
                    let startPos: any = null;
                    
                    centerDrag.onDragStartObservable.add(() => {
                        this.isDraggingFaceGizmo = true;
                        this.activeGizmoSphere = centerSphere;
                        this.activeGizmoParamName = paramName;
                        this.activeGizmoContainer = container;
                        const c = container as any;
                        this.originalValueBeforeEdit = (c.generatorParams.offsets && c.generatorParams.offsets[paramName]) ? c.generatorParams.offsets[paramName] : 0;

                        viewport.camera.detachControl();
                        originalValue = this.originalValueBeforeEdit;
                        startPos = centerSphere.position.clone();
                    });

                    centerDrag.onDragObservable.add(() => {
                        const c = container as any;
                        const diffVec = centerSphere.position.subtract(startPos);
                        let delta = BABYLON.Vector3.Dot(diffVec, shiftAxis);
                        delta = Math.round(delta);

                        const newValue = originalValue + delta;
                        if (!c.generatorParams.offsets) {
                            c.generatorParams.offsets = {};
                        }

                        if (c.generatorParams.offsets[paramName] === newValue) {
                            return;
                        }

                        c.generatorParams.offsets[paramName] = newValue;

                        applyRealtimeUpdate(doc, {
                            width: nmToMm(c.width),
                            height: nmToMm(c.height),
                            depth: nmToMm(c.depth),
                            zoneCount: c.generatorParams.zoneCount || 1,
                            bottomHeight: c.generatorParams.bottomHeight || 500,
                            middleHeight: c.generatorParams.middleHeight || 1200,
                            backOffset: c.generatorParams.backOffset || 0,
                            offsets: c.generatorParams.offsets
                        });
                    });

                    centerDrag.onDragEndObservable.add(() => {
                        this.isDraggingFaceGizmo = false;
                        viewport.camera.attachControl(viewport.canvas, true);
                        
                        const lastParam = this.activeGizmoParamName;
                        this.updateFaceGizmo();
                        
                        if (lastParam) {
                            const newSphere = this.activeFaceGizmoSpheres.find(s => s.metadata?.paramName === lastParam);
                            if (newSphere) {
                                this.activeGizmoSphere = newSphere;
                                this.activeGizmoParamName = lastParam;
                                this.isEditingFaceGizmo = true; 
                                
                                setTimeout(() => {
                                    const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
                                    if (input) {
                                        input.focus();
                                        input.select();
                                    }
                                }, 50);
                            }
                        }
                    });

                    centerSphere.addBehavior(centerDrag);
                    this.activeFaceGizmoSpheres.push(centerSphere);
                }
            }
        }
    }

    private _resolveTargetMesh(entity: any): any {
        const viewport = ContextManager.instance.viewport;
        const panelViews = ContextManager.instance.panelViews;
        const containerViews = ContextManager.instance.containerViews;
        if (!entity || !viewport) {
            return null;
        }
        return panelViews.get(entity)?.root ||
            containerViews.get(entity)?.rootNode ||
            containerViews.get(entity)?.root ||
            (entity.name ? viewport.scene.getNodeByName(entity.name) : null);
    }

    /** Kulka gizmo żyje w świecie — nie w LCS rodzica (panel w korpusie). */
    private _nodeWorldPosition(node: any): any {
        if (node?.getAbsolutePosition) {
            return node.getAbsolutePosition();
        }
        return node?.position;
    }

    private _setNodeWorldPosition(node: any, worldPos: any): void {
        if (node?.setAbsolutePosition) {
            node.setAbsolutePosition(worldPos);
            return;
        }
        if (node?.position?.copyFrom) {
            node.position.copyFrom(worldPos);
        }
    }

    private _syncFreeDragSphereToNode(targetNode: any): void {
        if (!this.freeDragSphere || this.freeDragSphere.isDisposed() || !targetNode) {
            return;
        }
        const world = this._nodeWorldPosition(targetNode);
        if (world) {
            this.freeDragSphere.position.copyFrom(world);
        }
    }

    private _formatCadTranslationStatus(cadNode: { localMatrix: Mat4 }): string {
        const { translation } = cadNode.localMatrix.decompose();
        return `📍 CAD mm → X: ${Math.round(nmToMm(translation.x))} | Y: ${Math.round(nmToMm(translation.y))} (głęb) | Z: ${Math.round(nmToMm(translation.z))} (góra)`;
    }

    private _onTranslateDrag(): void {
        const ctx = this._resolveTransformTarget();
        if (!ctx) {
            return;
        }
        const targetNode = this._resolveTargetMesh(ctx.entity);
        if (!targetNode) {
            return;
        }

        ContextManager.instance.sceneSyncAdapter.syncFromMesh(targetNode);
        this._propagateConstraintDrag();

        const cadNode = ctx.doc.findNode(ctx.entity.id);
        if (cadNode) {
            const api = ContextManager.instance.appAPI ?? (window as any).api;
            api?.setStatus?.(this._formatCadTranslationStatus(cadNode), true);
        }

        if (this.freeDragSphere && !this.freeDragSphere.isDisposed()) {
            this._syncFreeDragSphereToNode(targetNode);
        }
    }

    private _onTranslateDragEnd(): void {
        const viewport = ContextManager.instance.viewport;
        if (viewport?.camera) {
            viewport.camera.attachControl(viewport.canvas, true);
        }

        const ctx = this._resolveTransformTarget();
        if (!ctx) {
            return;
        }
        const targetNode = this._resolveTargetMesh(ctx.entity);
        if (!targetNode) {
            return;
        }

        ContextManager.instance.sceneSyncAdapter.syncFromMesh(targetNode);
        this._propagateConstraintDrag();
        this._commitConstraintDrag(ctx.entity, `Przesunięcie ${ctx.entity.name || 'obiektu'}`);
    }

    private _solverController(): { beginInteractiveTransform(): void; endInteractiveTransform(): void } | null {
        return (ContextManager.instance as any).solverController ?? null;
    }

    private _resolveTransformTarget(): { doc: NonNullable<typeof ContextManager.instance.document>; entity: any; cadNodeId: string } | null {
        const doc = ContextManager.instance.document;
        if (!doc?.activeEntity) {
            return null;
        }
        const { target } = doc.getTransformableTarget(doc.activeEntity);
        if (!target) {
            return null;
        }
        return { doc, entity: target, cadNodeId: target.id };
    }

    private _beginConstraintDrag(): void {
        const ctx = this._resolveTransformTarget();
        if (!ctx) {
            return;
        }
        const modal = ContextManager.instance.modalTransformManager;
        if (!modal || modal.activeMode === 'none') {
            this._solverController()?.beginInteractiveTransform();
        }
        ConstraintDragGroup.instance.begin(ctx.doc, ctx.cadNodeId, ConstraintStore.instance.constraints);
    }

    private _propagateConstraintDrag(): void {
        const ctx = this._resolveTransformTarget();
        if (!ctx) {
            return;
        }
        ConstraintDragGroup.instance.propagateTransform(ctx.doc, ctx.cadNodeId);
        ContextManager.instance.sceneSyncAdapter.syncNodeToMesh(ctx.cadNodeId);
    }

    private _commitConstraintDrag(activeEntity: any, label: string): void {
        const doc = ContextManager.instance.document;
        const cmdHist = ContextManager.instance.commandHistory;
        if (!doc) {
            this._finishConstraintDrag(activeEntity);
            return;
        }

        const cmds = ConstraintDragGroup.instance.buildTransformCommands(doc, label);
        if (cmdHist && cmds.length > 0) {
            const syncIds = new Set<string>();
            for (const cmd of cmds) {
                const node = doc.findNode(cmd.nodeId);
                if (node && (node.domainData as any)?.type === 'container') {
                    syncIds.add(cmd.nodeId);
                }
            }
            const allCmds = [
                ...cmds,
                ...Array.from(syncIds).map((id) => new SyncBackGroovesCommand(id)),
            ];
            cmdHist.execute(allCmds.length === 1 ? allCmds[0] : new MacroCommand(allCmds, label));
        }

        this._finishConstraintDrag(activeEntity);
    }

    private _finishConstraintDrag(activeEntity: any): void {
        ConstraintDragGroup.instance.end();
        this.matrixBeforeDrag = null;
        const modal = ContextManager.instance.modalTransformManager;
        if (!modal || modal.activeMode === 'none') {
            this._solverController()?.endInteractiveTransform();
        }
        const doc = ContextManager.instance.document;
        if (doc) {
            doc.emit('transform-ended', activeEntity);
            doc.notifyDocumentChanged();
        }
    }
}
