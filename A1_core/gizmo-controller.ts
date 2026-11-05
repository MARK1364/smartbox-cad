/**
 * SmartPanel Web — Gizmo Controller
 * 
 * Obsługuje interaktywne kontrolki 3D (Position Gizmo, Push/Pull gizmo kulkowe na ściankach,
 * floating input z wymiarem mm).
 */

import { ContextManager } from './context-manager.js';
import { Vec3 } from './cad-math/vec3.js';
import { Mat4 } from './cad-math/mat4.js';
import { nmToMm, mmToNm } from './cad-math/units.js';
import { TransformNodeCommand } from './commands/transform-node-command.js';
import { MacroCommand } from './commands/macro-command.js';
import { normalizeFaceName } from './face-name.js';
import { findOffsetGizmoHandler } from './offset-gizmo-port.js';
import { getCabinetModule, TopPanelMode } from './cabinet-port.js';
import { CadTranslateGizmo } from './cad-translate-gizmo.js';
import { getConstraintDragPort } from './constraint-drag-port.js';
import { NodeType } from './cad-node/node-type.js';

import { ConstraintStore } from '../S2_solver/constraint-store.js';
import { makeAnchor } from '../S2_solver/constraint-types.js';
import { makeDatumLevelAnchor } from '../S2_solver/datum-planes.js';
import { resolveCornerLocalMm } from '../S2_solver/constraint-geometry.js';
import { handleConstraintPickEvent } from '../S2_solver/constraint-picker.js';

declare const BABYLON: any;

const GIZMO_DRAG_MULTIPLIER = 1.0;

export class GizmoController {
    private activeFaceGizmoSpheres: any[] = [];
    private isDraggingFaceGizmo = false;
    private isEditingFaceGizmo = false;
    private activeGizmoSphere: any = null;
    private activeGizmoParamName = '';
    private activeGizmoContainer: any = null;
    private lastActiveEntityId: string | null = null;
    private originalValueBeforeEdit = 0;
    private badgeFixedPos: { left: number, top: number } | null = null;
    private positionGizmo: CadTranslateGizmo | null = null;
    private rotationGizmo: any = null;
    private freeDragSphere: any = null;
    private activeDragGuideLine: any = null;
    private matrixBeforeDrag: Mat4 | null = null;
    private activeTopPanelEntity: any = null;
    private activeTopPanelContainer: any = null;
    private activeGizmoRole?: string;
    private activeCornerSession: {
        container: any;
        paramName: string;
        sphere: any;
        originalValue: number;
    } | null = null;
    private _cornerGizmoPointerObserver: any = null;
    private isDraggingCornerGizmo = false;
    private isTopPanelWidgetOpen = false;
    private topPanelWidgetManualPos: { left: number; top: number } | null = null;
    private _blurTimeoutId: any = null;
    private _isClosingFloatingInput = false;
    private _hookedInputEl: HTMLInputElement | null = null;
    private _ignoreBlurUntil = 0;

    /**
     * Ściana panelu (klucz = kanoniczny FaceName) → sufiks parametra korpusu.
     *
     * Klucze są kanonicznymi nazwami LCS — `normalizeFaceName` nie przyjmuje już
     * aliasów. Wartości to dalej osie/sufiksy (`+X`, `-Y`, `backOffset`).
     */
    private pushPullMapping: Record<string, Record<string, string>> = {
        'LEFT_SIDE_PANEL': {
            'FACE_Y_PLUS': '+Y',    // Krawędź górna korpusu (+Y / top offset)
            'FACE_Y_MINUS': '-Y',  // Krawędź dolna korpusu (-Y / bottom offset)
            'FACE_X_MINUS': '+X',  // Ścianka left z tyłu korpusu -> (+X / pXPlus offset)
            'FACE_X_PLUS': '-X'    // Ścianka right z przodu korpusu -> (-X / pXMinus offset)
        },
        'SIDE_LEFT': {
            'FACE_Y_PLUS': '+Y',
            'FACE_Y_MINUS': '-Y',
            'FACE_X_MINUS': '+X',
            'FACE_X_PLUS': '-X'
        },
        'RIGHT_SIDE_PANEL': {
            'FACE_Y_MINUS': '-Y',
            'FACE_Y_PLUS': '+Y',
            'FACE_X_PLUS': '+X',   // Ścianka right (+X) z tyłu korpusu -> (+X / pXPlus offset)
            'FACE_X_MINUS': '-X'  // Ścianka left (-X) z przodu korpusu -> (-X / pXMinus offset)
        },
        'SIDE_RIGHT': {
            'FACE_Y_MINUS': '-Y',
            'FACE_Y_PLUS': '+Y',
            'FACE_X_PLUS': '+X',
            'FACE_X_MINUS': '-X'
        },
        'VERTICAL_DIVIDER': {
            'FACE_Y_PLUS': '+Y',
            'FACE_Y_MINUS': '-Y',
            'FACE_X_MINUS': '+X',
            'FACE_X_PLUS': '-X'
        },
        'DIVIDER': {
            'FACE_Y_PLUS': '+Y',
            'FACE_Y_MINUS': '-Y',
            'FACE_X_MINUS': '+X',
            'FACE_X_PLUS': '-X'
        },
        'BOTTOM_PANEL': {
            // [90,180,0]: Ry=180 — tylna = −X (jak TOP)
            'FACE_Y_MINUS': '-X',
            'FACE_Y_PLUS': '+X',
            'FACE_X_MINUS': '-Y',
            'FACE_X_PLUS': '+Y'
        },
        'TOP_PANEL': {
            'FACE_Y_MINUS': '-X', // Odbicie wokół X: lokalny -Y leży z PRZODU korpusu (-X / pXMinus offset)
            'FACE_Y_PLUS': '+X',  // Lokalny +Y leży z TYŁU korpusu (+X / pXPlus offset)
            'FACE_X_MINUS': '-Y', // Krawędź lewa (-Y offset)
            'FACE_X_PLUS': '+Y'   // Krawędź prawa (+Y offset)
        },
        'BACK_PANEL': {
            'FACE_Y_PLUS': '-Y', 'FACE_Y_MINUS': '+Y',
            'FACE_X_MINUS': '-X', 'FACE_X_PLUS': '+X',
            'FACE_Z_PLUS': 'backOffset'
        }
    };

    private faceNormals: Record<string, any> = {};

    constructor() {
        if (typeof BABYLON !== 'undefined') {
            this.faceNormals = {
                'FACE_Y_PLUS': new BABYLON.Vector3(0, 1, 0),
                'FACE_Y_MINUS': new BABYLON.Vector3(0, -1, 0),
                'FACE_Z_PLUS': new BABYLON.Vector3(0, 0, 1),
                'FACE_Z_MINUS': new BABYLON.Vector3(0, 0, -1),
                'FACE_X_MINUS': new BABYLON.Vector3(-1, 0, 0),
                'FACE_X_PLUS': new BABYLON.Vector3(1, 0, 0)
            };
        }
    }

    public isEntityVisible(entity: any): boolean {
        if (!entity) return false;
        if (entity.visible === false) return false;
        if (entity.params?.visible === false) return false;
        if (entity.generatorParams?.visible === false) return false;

        if (entity.frozen === true || entity.params?.frozen === true) return false;

        const doc = ContextManager.instance.document;
        if (doc) {
            const cadNode = doc.findNode(entity.id);
            if (cadNode?.parent && cadNode.parent.nodeType === NodeType.ASSEMBLY) {
                const parentDomain = cadNode.parent.domainData as any;
                if (parentDomain && (parentDomain.visible === false || parentDomain.generatorParams?.visible === false || parentDomain.frozen === true)) {
                    return false;
                }
            }
        }

        const panelViews = ContextManager.instance.panelViews;
        const containerViews = ContextManager.instance.containerViews;
        let view = panelViews?.get(entity) || (entity?.id ? panelViews?.get(entity.id) : null) || containerViews?.get(entity);
        if (!view && entity?.id) {
            for (const [p, v] of panelViews || []) {
                if (p?.id === entity.id) {
                    view = v;
                    break;
                }
            }
            if (!view) {
                for (const [c, v] of containerViews || []) {
                    if (c?.id === entity.id) {
                        view = v;
                        break;
                    }
                }
            }
        }
        const root = (view as any)?.rootNode || (view as any)?.root;
        if (root && (root.isEnabled() === false || root.isVisible === false)) {
            return false;
        }

        return true;
    }

    public init(): void {
        ContextManager.instance.hidePositionGizmo = () => {
            this.clearFaceGizmos();
        };

        ContextManager.instance.hideGizmos = () => {
            this.clearFaceGizmos();
        };

        ContextManager.instance.showGizmos = () => {
            this.updateFaceGizmo();
        };

        const viewport = ContextManager.instance.viewport;
        if (!viewport || !viewport.scene) return;

        this.createFloatingInput();
        this.createTopPanelWidget();

        viewport.scene.onBeforeRenderObservable.add(() => {
            if ((window as any).__glcGizmoActive || this.isDraggingCornerGizmo) {
                return;
            }

            const activeEntity = ContextManager.instance.document?.activeEntity;
            const isEntityVis = this.isEntityVisible(activeEntity);

            if ((!isEntityVis && !this.activeCornerSession) || !this.activeGizmoSphere || !this.activeGizmoContainer || !this.isEntityVisible(this.activeGizmoContainer) || (this.activeGizmoSphere.isDisposed && this.activeGizmoSphere.isDisposed())) {
                const badge = document.getElementById('gizmo-floating-input');
                if (badge && badge.style.display !== 'none' && !this.isEditingFaceGizmo) {
                    badge.style.display = 'none';
                    this.badgeFixedPos = null;
                }
            } else if ((this.isDraggingFaceGizmo || this.isEditingFaceGizmo) && this.activeGizmoSphere && this.activeGizmoContainer && (this.activeGizmoParamName || this.activeCornerSession)) {
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
                        if (this.activeGizmoSphere?.parent?.computeWorldMatrix) {
                            this.activeGizmoSphere.parent.computeWorldMatrix(true);
                        }
                        if (this.activeGizmoSphere?.computeWorldMatrix) {
                            this.activeGizmoSphere.computeWorldMatrix(true);
                        }
                        const spherePos = this.activeGizmoSphere?.getAbsolutePosition
                            ? this.activeGizmoSphere.getAbsolutePosition()
                            : (this.activeGizmoSphere?.position ?? BABYLON.Vector3.Zero());

                        const screenPos = BABYLON.Vector3.Project(
                            spherePos,
                            BABYLON.Matrix.Identity(),
                            viewport.scene.getTransformMatrix(),
                            viewport.scene.activeCamera.viewport.toGlobal(
                                viewport.engine.getRenderWidth(),
                                viewport.engine.getRenderHeight()
                            )
                        );

                        if (screenPos.z >= 0 && screenPos.z <= 1) {
                            const canvasRect = canvas.getBoundingClientRect();
                            const curLeft = canvasRect.left + screenPos.x + 20;
                            const curTop = canvasRect.top + screenPos.y - 45;
                            badge.style.left = `${curLeft}px`;
                            badge.style.top = `${curTop}px`;

                            if (this.isEditingFaceGizmo && !this.badgeFixedPos) {
                                this.badgeFixedPos = { left: curLeft, top: curTop };
                            }
                        }
                    }

                    if (this.isDraggingFaceGizmo) {
                        let currentVal: number;
                        if (this.activeCornerSession) {
                            currentVal = this.activeCornerSession.originalValue;
                        } else if (this.activeGizmoParamName === 'backOffset' || this.activeGizmoParamName === 'cofniecie_plecow_mm') {
                            const gp = this.activeGizmoContainer.generatorParams;
                            currentVal = gp?.cofniecie_plecow_mm ?? gp?.backOffset ?? gp?.offsets?.backOffset ?? 3;
                        } else {
                            const activeEntity = ContextManager.instance.document?.activeEntity;
                            const role = this.activeGizmoRole || (activeEntity as any)?.role;
                            currentVal = this._readOffsetMm(
                                this.activeGizmoContainer,
                                this.activeGizmoParamName,
                                role
                            );
                        }
                        input.value = currentVal.toString();
                        input.style.width = `${Math.max(45, input.value.length * 9)}px`;
                    }
                }
            } else {
                const badge = document.getElementById('gizmo-floating-input');
                if (badge && badge.style.display !== 'none' && !this.isEditingFaceGizmo) {
                    badge.style.display = 'none';
                    this.badgeFixedPos = null;
                }
            }

            if (this.activeTopPanelEntity && this.activeTopPanelContainer && this.isTopPanelWidgetOpen) {
                if (!this.isEntityVisible(this.activeTopPanelEntity) || !this.isEntityVisible(this.activeTopPanelContainer)) {
                    const topWidget = document.getElementById('gizmo-top-panel-widget');
                    if (topWidget && topWidget.style.display !== 'none') {
                        topWidget.style.display = 'none';
                    }
                } else {
                    const topWidget = document.getElementById('gizmo-top-panel-widget');
                    const view = ContextManager.instance.panelViews.get(this.activeTopPanelEntity);
                    const canvas = viewport.canvas;
                    if (topWidget && view?.root && canvas) {
                        topWidget.style.display = 'flex';
                        if (this.topPanelWidgetManualPos) {
                            topWidget.style.left = `${this.topPanelWidgetManualPos.left}px`;
                            topWidget.style.top = `${this.topPanelWidgetManualPos.top}px`;
                        } else {
                            const worldPos = view.root.getAbsolutePosition ? view.root.getAbsolutePosition().clone() : view.root.position.clone();
                            const screenPos = BABYLON.Vector3.Project(
                                worldPos,
                                BABYLON.Matrix.Identity(),
                                viewport.scene.getTransformMatrix(),
                                viewport.scene.activeCamera.viewport.toGlobal(
                                    viewport.engine.getRenderWidth(),
                                    viewport.engine.getRenderHeight()
                                )
                            );
                            const canvasRect = canvas.getBoundingClientRect();
                            const curLeft = canvasRect.left + screenPos.x + 30;
                            const curTop = canvasRect.top + screenPos.y - 120;
                            topWidget.style.left = `${Math.max(10, curLeft)}px`;
                            topWidget.style.top = `${Math.max(10, curTop)}px`;
                        }
                    }
                }
            } else {
                const topWidget = document.getElementById('gizmo-top-panel-widget');
                if (topWidget && topWidget.style.display !== 'none') {
                    topWidget.style.display = 'none';
                }
            }
        });
    }

    public createFloatingInput(): void {
        if (typeof document === 'undefined') return;
        let badge = document.getElementById('gizmo-floating-input') as HTMLElement | null;
        let input = document.getElementById('gizmo-input-field') as HTMLInputElement | null;

        if (!badge || !input) {
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

            badge = document.createElement('div');
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

            input = document.createElement('input');
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
                pointer-events: auto;
                cursor: text;
            `;

            const unit = document.createElement('span');
            unit.innerText = 'mm';
            unit.style.cssText = `
                margin-left: 2px;
                color: rgba(255,255,255,0.7);
                font-weight: 500;
                user-select: none;
            `;

            badge.appendChild(input);
            badge.appendChild(unit);
            document.body.appendChild(badge);
        }

        if (this._hookedInputEl !== input) {
            this._hookedInputEl = input;
            badge.onmousedown = (e) => {
                e.stopPropagation();
                if (e.target !== input) {
                    input!.focus();
                }
            };
            badge.onpointerdown = (e) => {
                e.stopPropagation();
                if (e.target !== input) {
                    input!.focus();
                }
            };
            badge.onmouseup = (e) => e.stopPropagation();
            badge.onpointerup = (e) => e.stopPropagation();
            badge.onclick = (e) => e.stopPropagation();
            input.onmousedown = (e) => e.stopPropagation();
            input.onpointerdown = (e) => e.stopPropagation();
            input.onmouseup = (e) => e.stopPropagation();
            input.onpointerup = (e) => e.stopPropagation();
            input.onclick = (e) => e.stopPropagation();

            this.initFloatingInputEvents(input, badge);
        }
    }

    private _updateFaceFloatingBadgePosition(sphere: any, colorHex?: string): void {
        const viewport = ContextManager.instance.viewport;
        if (!viewport || !viewport.scene || !viewport.canvas || !sphere) return;
        const badge = document.getElementById('gizmo-floating-input');
        if (!badge) return;

        if (sphere.parent?.computeWorldMatrix) {
            sphere.parent.computeWorldMatrix(true);
        }
        if (sphere.computeWorldMatrix) {
            sphere.computeWorldMatrix(true);
        }

        const pos = sphere.getAbsolutePosition ? sphere.getAbsolutePosition() : (sphere.position ?? BABYLON.Vector3.Zero());
        const screenPos = BABYLON.Vector3.Project(
            pos,
            BABYLON.Matrix.Identity(),
            viewport.scene.getTransformMatrix(),
            viewport.scene.activeCamera.viewport.toGlobal(
                viewport.engine.getRenderWidth(),
                viewport.engine.getRenderHeight()
            )
        );

        if (screenPos.z < 0 || screenPos.z > 1) {
            badge.style.display = 'none';
            return;
        }

        const canvasRect = viewport.canvas.getBoundingClientRect();
        const curLeft = canvasRect.left + screenPos.x + 20;
        const curTop = canvasRect.top + screenPos.y - 45;
        badge.style.left = `${curLeft}px`;
        badge.style.top = `${curTop}px`;
        if (colorHex) {
            badge.style.border = `1.5px solid ${colorHex}`;
        }
        this.badgeFixedPos = { left: curLeft, top: curTop };
    }

    private openFloatingInput(sphere: any, paramName: string, container: any, role?: string, originalValueOverride?: number): void {
        this.createFloatingInput();
        if (typeof window !== 'undefined') {
            (window as any).__glcGizmoActive = false;
        }
        if (this._blurTimeoutId) {
            clearTimeout(this._blurTimeoutId);
            this._blurTimeoutId = null;
        }
        if (this.isEditingFaceGizmo) {
            this.closeFloatingInput(true);
        }

        this.activeCornerSession = null;
        this.activeGizmoSphere = sphere;
        this.activeGizmoParamName = paramName;
        this.activeGizmoContainer = container;
        this.activeGizmoRole = role;
        this.isEditingFaceGizmo = true;
        this.badgeFixedPos = null;
        this._ignoreBlurUntil = Date.now() + 150;

        const isBackOffset = paramName === 'backOffset' || paramName === 'cofniecie_plecow_mm';
        const gp = container?.generatorParams;
        const currentValue = isBackOffset
            ? (gp?.cofniecie_plecow_mm ?? gp?.backOffset ?? gp?.offsets?.backOffset ?? 3)
            : this._readOffsetMm(container, paramName, role);
        this.originalValueBeforeEdit = originalValueOverride !== undefined ? originalValueOverride : currentValue;

        let borderHex = 'rgba(255, 102, 0, 0.8)';
        if (sphere?.material?.diffuseColor) {
            const dc = sphere.material.diffuseColor;
            borderHex = `rgb(${Math.round(dc.r * 255)}, ${Math.round(dc.g * 255)}, ${Math.round(dc.b * 255)})`;
        }

        const badge = document.getElementById('gizmo-floating-input');
        const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
        if (badge && input) {
            badge.style.display = 'flex';
            badge.style.border = `1.5px solid ${borderHex}`;
            input.value = currentValue.toString();
            input.style.width = `${Math.max(45, input.value.length * 9)}px`;
            
            this._updateFaceFloatingBadgePosition(sphere, borderHex);

            input.focus();
            input.select();
            setTimeout(() => {
                input.focus();
                input.select();
            }, 25);
        }
    }

    private openFloatingInputForCorner(opts: {
        container: any;
        paramName: string;
        sphere: any;
        valMm: number;
        colorHex?: string;
    }): void {
        this.createFloatingInput();
        if (typeof window !== 'undefined') {
            (window as any).__glcGizmoActive = false;
        }
        if (this._blurTimeoutId) {
            clearTimeout(this._blurTimeoutId);
            this._blurTimeoutId = null;
        }
        if (this.isEditingFaceGizmo) {
            this.closeFloatingInput(true);
        }

        const { container, paramName, sphere, valMm, colorHex = '#38bdf8' } = opts;
        this.activeGizmoSphere = sphere;
        this.activeGizmoParamName = '';
        this.activeGizmoContainer = container;
        this.activeGizmoRole = undefined;
        this.activeCornerSession = {
            container,
            paramName,
            sphere,
            originalValue: Math.round(valMm)
        };
        this.originalValueBeforeEdit = Math.round(valMm);
        this.isEditingFaceGizmo = true;
        this.badgeFixedPos = null;
        this._ignoreBlurUntil = Date.now() + 150;

        this._updateCornerDragBadge(valMm, sphere, colorHex);

        const badge = document.getElementById('gizmo-floating-input');
        const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
        if (badge && input) {
            badge.style.display = 'flex';
            badge.style.border = `1.5px solid ${colorHex}`;
            input.value = Math.round(valMm).toString();
            input.style.width = `${Math.max(45, input.value.length * 9)}px`;
            setTimeout(() => {
                input.focus();
                input.select();
            }, 50);
        }
    }

    private _readOffsetMm(container: any, paramName: string, role?: string): number {
        if (!container) return 0;
        if (paramName === 'backOffset' || paramName === 'cofniecie_plecow_mm') {
            const gp = container.generatorParams;
            return gp?.cofniecie_plecow_mm ?? gp?.backOffset ?? gp?.offsets?.backOffset ?? 3;
        }
        const effectiveRole = role || this.activeGizmoRole;
        const handler = effectiveRole ? findOffsetGizmoHandler(effectiveRole) : null;
        if (handler) {
            return handler.readOffsetMm(container, paramName, effectiveRole);
        }
        return container.generatorParams?.offsets?.[paramName] ?? 0;
    }

    /**
     * Podgląd offsetu na WSKAZANYM korpusie — bez applyRealtimeUpdate/getActiveContainer
     * (te brały gabaryt z getContainers()[0] i nadpisywały aktywny korpus).
     */
    private previewOffsetOnContainer(container: any, paramName: string, value: number, role?: string): void {
        if (!container) return;
        if (!container.generatorParams) container.generatorParams = {};

        const effectiveRole = role || this.activeGizmoRole;
        const handler = effectiveRole ? findOffsetGizmoHandler(effectiveRole) : null;
        if (handler) {
            handler.previewOffset(container, paramName, value);
            return;
        }

        const cabMod = getCabinetModule();
        if (paramName === 'backOffset' || paramName === 'cofniecie_plecow_mm') {
            container.generatorParams.cofniecie_plecow_mm = value;
            container.generatorParams.backOffset = value;
            cabMod?.rebuild(container);
            return;
        }

        if (!container.generatorParams.offsets) container.generatorParams.offsets = {};
        container.generatorParams.offsets[paramName] = value;
        cabMod?.rebuild(container);
    }

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

    private commitFloatingInputValue(input: HTMLInputElement, badge: HTMLElement): void {
        if (!input.value) return;
        const val = this.evaluateMathExpression(input.value);
        if (val === null) return;

        if (this.activeCornerSession) {
            const { container, paramName } = this.activeCornerSession;
            const cabMod = getCabinetModule();
            const doc = ContextManager.instance.document;
            if (cabMod?.applyRealtimeUpdate && doc) {
                cabMod.applyRealtimeUpdate(doc, { [paramName]: val }, container);
            }
            if (typeof window !== 'undefined') {
                window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
                window.dispatchEvent(new CustomEvent('cad-edit-entity', {
                    detail: { entityId: container.id, kind: 'korpus' }
                }));
            }
        } else if (this.activeGizmoContainer && this.activeGizmoParamName) {
            const role = this.activeGizmoRole;
            const handler = role ? findOffsetGizmoHandler(role) : null;
            if (handler?.commitOffset) {
                handler.commitOffset(
                    this.activeGizmoContainer,
                    this.activeGizmoParamName,
                    this.originalValueBeforeEdit,
                    val
                );
            } else {
                this.previewOffsetOnContainer(
                    this.activeGizmoContainer,
                    this.activeGizmoParamName,
                    val,
                    role
                );
            }
            if (typeof window !== 'undefined') {
                window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
                window.dispatchEvent(new CustomEvent('cad-edit-entity', {
                    detail: { entityId: this.activeGizmoContainer.id, kind: 'korpus' }
                }));
            }
            const doc = ContextManager.instance.document;
            if (doc) {
                doc.notifyDocumentChanged();
            }
        }
    }

    public closeFloatingInput(commit: boolean = true): void {
        if (this._blurTimeoutId) {
            clearTimeout(this._blurTimeoutId);
            this._blurTimeoutId = null;
        }

        const badge = typeof document !== 'undefined' ? document.getElementById('gizmo-floating-input') : null;
        const input = typeof document !== 'undefined' ? (document.getElementById('gizmo-input-field') as HTMLInputElement) : null;

        if (commit && input && badge) {
            this.commitFloatingInputValue(input, badge);
        } else if (!commit) {
            if (this.activeCornerSession) {
                const { container, paramName, originalValue } = this.activeCornerSession;
                const cabMod = getCabinetModule();
                const doc = ContextManager.instance.document;
                if (cabMod?.applyRealtimeUpdate && doc) {
                    cabMod.applyRealtimeUpdate(doc, { [paramName]: originalValue }, container);
                }
            } else if (this.activeGizmoContainer && this.activeGizmoParamName) {
                this.previewOffsetOnContainer(
                    this.activeGizmoContainer,
                    this.activeGizmoParamName,
                    this.originalValueBeforeEdit,
                    this.activeGizmoRole
                );
            }
        }

        this.isEditingFaceGizmo = false;
        this.activeCornerSession = null;
        this.badgeFixedPos = null;
        this.activeGizmoSphere = null;
        this.activeGizmoParamName = '';
        this.activeGizmoContainer = null;
        this.activeGizmoRole = undefined;

        if (badge) {
            badge.style.display = 'none';
        }

        if (input && typeof document !== 'undefined' && document.activeElement === input) {
            this._isClosingFloatingInput = true;
            try {
                input.blur();
            } finally {
                this._isClosingFloatingInput = false;
            }
        }
    }

    private initFloatingInputEvents(input: HTMLInputElement, badge: HTMLElement): void {
        input.oninput = (e) => {
            if (this._isGlcGizmoActive()) return;
            e.stopPropagation();
            // Dynamiczne dopasowanie szerokości inputa do długości wpisywanego wyrażenia
            input.style.width = `${Math.max(45, input.value.length * 9)}px`;
        };

        input.onkeydown = (e) => {
            if (this._isGlcGizmoActive()) return;
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                this._ignoreBlurUntil = 0;
                this.closeFloatingInput(true);
                if (this._blurTimeoutId) {
                    clearTimeout(this._blurTimeoutId);
                }
                this._blurTimeoutId = setTimeout(() => {
                    this._blurTimeoutId = null;
                    this.updateFaceGizmo();
                }, 50);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this._ignoreBlurUntil = 0;
                this.closeFloatingInput(false);
                if (this._blurTimeoutId) {
                    clearTimeout(this._blurTimeoutId);
                }
                this._blurTimeoutId = setTimeout(() => {
                    this._blurTimeoutId = null;
                    this.updateFaceGizmo();
                }, 50);
            }
        };

        input.onfocus = () => {
            if (this._isGlcGizmoActive()) return;
            this.isEditingFaceGizmo = true;
        };

        input.onblur = () => {
            if (this._isGlcGizmoActive()) return;
            if (this._isClosingFloatingInput) return;
            if (Date.now() < this._ignoreBlurUntil) {
                input.focus();
                input.select();
                return;
            }
            this.closeFloatingInput(true);
            if (this._blurTimeoutId) {
                clearTimeout(this._blurTimeoutId);
            }
            this._blurTimeoutId = setTimeout(() => {
                this._blurTimeoutId = null;
                this.updateFaceGizmo();
            }, 80);
        };
    }

    public toggleTopPanelWidget(): void {
        this.isTopPanelWidgetOpen = !this.isTopPanelWidgetOpen;
        const widget = document.getElementById('gizmo-top-panel-widget');
        if (!widget) {
            this.createTopPanelWidget();
        }
        if (this.isTopPanelWidgetOpen) {
            this.updateTopPanelWidgetUI();
            const w = document.getElementById('gizmo-top-panel-widget');
            if (w) w.style.display = 'flex';
        } else {
            const w = document.getElementById('gizmo-top-panel-widget');
            if (w) w.style.display = 'none';
        }
    }

    public closeTopPanelWidget(): void {
        this.isTopPanelWidgetOpen = false;
        const widget = document.getElementById('gizmo-top-panel-widget');
        if (widget) {
            widget.style.display = 'none';
        }
    }

    public createTopPanelWidget(): void {
        if (typeof document === 'undefined') return;
        if (document.getElementById('gizmo-top-panel-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'gizmo-top-panel-widget';
        widget.style.cssText = `
            position: absolute;
            display: none;
            z-index: 1000;
            pointer-events: auto;
            background: rgba(20, 20, 24, 0.95);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1.5px solid rgba(255, 102, 0, 0.85);
            border-radius: 8px;
            padding: 6px 10px 8px 10px;
            box-shadow: 0 6px 22px rgba(0, 0, 0, 0.7);
            font-family: 'Outfit', 'Inter', sans-serif;
            color: #fff;
            user-select: none;
            flex-direction: column;
            gap: 6px;
            min-width: 240px;
        `;

        widget.innerHTML = `
            <div id="top-panel-drag-header" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.12); cursor: move;">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span style="font-size: 11px; opacity: 0.6;">⠿</span>
                    <span style="font-size: 11px; font-weight: 700; color: #ff8833; text-transform: uppercase; letter-spacing: 0.5px;">Wieniec Górny</span>
                </div>
                <button id="top-panel-close-btn" type="button" title="Zamknij" style="background: transparent; border: none; color: #aaa; font-size: 13px; cursor: pointer; padding: 0 4px; line-height: 1; border-radius: 3px; transition: color 0.15s;">✕</button>
            </div>
            <div id="top-panel-btn-group" style="display: flex; gap: 4px;">
                <button type="button" data-mode="FULL" title="Pojedynczy pełny wieniec" class="top-mode-btn" style="flex: 1; padding: 5px 6px; font-size: 11px; font-weight: 600; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color: #ddd; cursor: pointer; transition: all 0.15s; white-space: nowrap;">▬ Pełny</button>
                <button type="button" data-mode="TRAVERSE_H" title="Dwa trawersy poziomo (leżące na płasko)" class="top-mode-btn" style="flex: 1; padding: 5px 6px; font-size: 11px; font-weight: 600; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color: #ddd; cursor: pointer; transition: all 0.15s; white-space: nowrap;">═ Traw. poz.</button>
                <button type="button" data-mode="TRAVERSE_V" title="Dwa trawersy pionowo (stojące na sztorc)" class="top-mode-btn" style="flex: 1; padding: 5px 6px; font-size: 11px; font-weight: 600; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color: #ddd; cursor: pointer; transition: all 0.15s; white-space: nowrap;">║ Traw. pion.</button>
            </div>
            <div id="top-panel-width-row" style="display: none; align-items: center; justify-content: space-between; gap: 6px; margin-top: 2px; font-size: 11px; color: #aaa;">
                <span>Szerokość trawersu:</span>
                <div style="display: flex; align-items: center; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 1px 4px;">
                    <input id="top-panel-width-input" type="text" style="width: 42px; background: transparent; border: none; color: #fff; text-align: right; font-size: 11px; font-weight: bold; outline: none;" value="80" />
                    <span style="font-size: 10px; color: #888; margin-left: 2px;">mm</span>
                </div>
            </div>
        `;

        document.body.appendChild(widget);

        widget.onmousedown = (e) => e.stopPropagation();
        widget.onpointerdown = (e) => e.stopPropagation();

        // Obsługa przeciągania okna po ekranie (draggability)
        const header = widget.querySelector('#top-panel-drag-header') as HTMLElement;
        if (header) {
            let isDragging = false;
            let startX = 0;
            let startY = 0;
            let startLeft = 0;
            let startTop = 0;

            const onPointerMove = (e: PointerEvent) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const newLeft = Math.max(0, startLeft + dx);
                const newTop = Math.max(0, startTop + dy);
                this.topPanelWidgetManualPos = { left: newLeft, top: newTop };
                widget.style.left = `${newLeft}px`;
                widget.style.top = `${newTop}px`;
            };

            const onPointerUp = () => {
                if (isDragging) {
                    isDragging = false;
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                }
            };

            header.onpointerdown = (e: PointerEvent) => {
                if ((e.target as HTMLElement)?.id === 'top-panel-close-btn') return;
                e.stopPropagation();
                e.preventDefault();
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = widget.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                this.topPanelWidgetManualPos = { left: startLeft, top: startTop };
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
            };
        }

        // Przycisk zamykania
        const closeBtn = widget.querySelector('#top-panel-close-btn') as HTMLElement;
        if (closeBtn) {
            closeBtn.onpointerdown = (e) => e.stopPropagation();
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeTopPanelWidget();
            };
            closeBtn.onmouseenter = () => { closeBtn.style.color = '#ff6600'; };
            closeBtn.onmouseleave = () => { closeBtn.style.color = '#aaa'; };
        }

        const btnGroup = widget.querySelector('#top-panel-btn-group');
        if (btnGroup) {
            btnGroup.querySelectorAll('.top-mode-btn').forEach((btn: any) => {
                btn.onclick = (e: MouseEvent) => {
                    e.stopPropagation();
                    const mode = btn.getAttribute('data-mode') as TopPanelMode;
                    this.setTopPanelMode(mode);
                };
            });
        }

        const widthInput = widget.querySelector('#top-panel-width-input') as HTMLInputElement;
        if (widthInput) {
            const commitWidth = () => {
                const val = this.evaluateMathExpression(widthInput.value);
                if (val !== null && val > 0 && val < 500) {
                    this.setTopPanelTraverseWidth(val);
                } else {
                    const curW = this.activeTopPanelContainer?.generatorParams?.traverseWidth || 80;
                    widthInput.value = curW.toString();
                }
            };
            widthInput.onkeydown = (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    commitWidth();
                    widthInput.blur();
                }
            };
            widthInput.onblur = () => commitWidth();
        }
    }

    public updateTopPanelWidgetUI(): void {
        const widget = document.getElementById('gizmo-top-panel-widget');
        if (!widget || !this.activeTopPanelContainer) return;

        const mode = (this.activeTopPanelContainer.generatorParams?.topPanelMode || 'FULL') as TopPanelMode;
        const trWidth = this.activeTopPanelContainer.generatorParams?.traverseWidth || 80;

        const btnGroup = widget.querySelector('#top-panel-btn-group');
        if (btnGroup) {
            btnGroup.querySelectorAll('.top-mode-btn').forEach((btn: any) => {
                const btnMode = btn.getAttribute('data-mode');
                if (btnMode === mode) {
                    btn.style.background = '#ff6600';
                    btn.style.borderColor = '#ff8833';
                    btn.style.color = '#fff';
                } else {
                    btn.style.background = 'rgba(255,255,255,0.08)';
                    btn.style.borderColor = 'rgba(255,255,255,0.15)';
                    btn.style.color = '#ccc';
                }
            });
        }

        const widthRow = widget.querySelector('#top-panel-width-row') as HTMLElement;
        const widthInput = widget.querySelector('#top-panel-width-input') as HTMLInputElement;
        if (widthRow) {
            widthRow.style.display = mode === 'FULL' ? 'none' : 'flex';
        }
        if (widthInput && document.activeElement !== widthInput) {
            widthInput.value = trWidth.toString();
        }
    }

    public setTopPanelMode(newMode: TopPanelMode): void {
        const container = this.activeTopPanelContainer;
        if (!container) return;
        const curMode = (container.generatorParams?.topPanelMode || 'FULL') as TopPanelMode;
        const curWidth = container.generatorParams?.traverseWidth || 80;
        if (curMode === newMode) return;

        const cabMod = getCabinetModule();
        const cmd = cabMod?.createSetTopPanelConfigCommand?.(
            container.id,
            { mode: curMode, width: curWidth },
            { mode: newMode, width: curWidth }
        );
        const hist = ContextManager.instance.commandHistory;
        if (hist && cmd) {
            hist.execute(cmd);
        } else {
            if (!container.generatorParams) container.generatorParams = {};
            container.generatorParams.topPanelMode = newMode;
            container.generatorParams.traverseWidth = curWidth;
            cabMod?.rebuild(container);
        }
        setTimeout(() => {
            this.updateFaceGizmo();
        }, 60);
    }

    public setTopPanelTraverseWidth(newWidth: number): void {
        const container = this.activeTopPanelContainer;
        if (!container) return;
        const curMode = (container.generatorParams?.topPanelMode || 'FULL') as TopPanelMode;
        const curWidth = container.generatorParams?.traverseWidth || 80;
        if (curWidth === newWidth) return;

        const cabMod = getCabinetModule();
        const cmd = cabMod?.createSetTopPanelConfigCommand?.(
            container.id,
            { mode: curMode, width: curWidth },
            { mode: curMode, width: newWidth }
        );
        const hist = ContextManager.instance.commandHistory;
        if (hist && cmd) {
            hist.execute(cmd);
        } else {
            if (!container.generatorParams) container.generatorParams = {};
            container.generatorParams.topPanelMode = curMode;
            container.generatorParams.traverseWidth = newWidth;
            cabMod?.rebuild(container);
        }
        setTimeout(() => {
            this.updateFaceGizmo();
        }, 60);
    }

    public clearFaceGizmos(): void {
        if (this._blurTimeoutId) {
            clearTimeout(this._blurTimeoutId);
            this._blurTimeoutId = null;
        }
        for (const sphere of this.activeFaceGizmoSpheres) {
            try { sphere.dispose(); } catch {}
        }
        this.activeFaceGizmoSpheres = [];

        if (this._cornerGizmoPointerObserver) {
            const vp = ContextManager.instance.viewport;
            if (vp?.scene) {
                vp.scene.onPointerObservable.remove(this._cornerGizmoPointerObserver);
            }
            this._cornerGizmoPointerObserver = null;
        }

        this.activeGizmoSphere = null;
        this.activeGizmoParamName = '';
        this.activeGizmoContainer = null;
        this.activeGizmoRole = undefined;
        this.activeCornerSession = null;
        this.isDraggingFaceGizmo = false;
        this.isEditingFaceGizmo = false;
        this.badgeFixedPos = null;

        if (!this._isGlcGizmoActive() && !this.isDraggingCornerGizmo) {
            const badge = typeof document !== 'undefined' ? document.getElementById('gizmo-floating-input') : null;
            if (badge) {
                badge.style.display = 'none';
            }
        }

        this.activeTopPanelEntity = null;
        this.activeTopPanelContainer = null;
        this.isTopPanelWidgetOpen = false;
        this.topPanelWidgetManualPos = null;
        const topWidget = typeof document !== 'undefined' ? document.getElementById('gizmo-top-panel-widget') : null;
        if (topWidget) {
            topWidget.style.display = 'none';
        }

        if (this.positionGizmo) {
            this.positionGizmo.attachedNode = null;
        }
        if (this.rotationGizmo) {
            this.rotationGizmo.attachedNode = null;
        }
        if (this.freeDragSphere && !this.freeDragSphere.isDisposed()) {
            this.freeDragSphere.setEnabled(false);
        }
        this._disposeDragGuideLine();
    }

    private _isGlcGizmoActive(): boolean {
        const win = typeof window !== 'undefined' ? (window as any) : (typeof globalThis !== 'undefined' ? (globalThis as any) : null);
        return Boolean(win && win.__glcGizmoActive);
    }

    public showTranslateGizmo(entity?: any): void {
        const doc = ContextManager.instance.document;
        const viewport = ContextManager.instance.viewport;
        const panelViews = ContextManager.instance.panelViews;
        const containerViews = ContextManager.instance.containerViews;
        if (!doc || !viewport) return;

        const rawEntity = entity || doc.activeEntity;
        if (!rawEntity || !this.isEntityVisible(rawEntity)) {
            if (this.positionGizmo) this.positionGizmo.attachedNode = null;
            if (this.freeDragSphere && !this.freeDragSphere.isDisposed()) {
                this.freeDragSphere.setEnabled(false);
            }
            return;
        }

        const { target: activeEntity } = doc.getTransformableTarget(rawEntity);
        const isFrozen = Boolean(
            (rawEntity as any)?.frozen || (rawEntity as any)?.params?.frozen ||
            (activeEntity as any)?.frozen || (activeEntity as any)?.params?.frozen
        );
        if (!activeEntity || !this.isEntityVisible(activeEntity) || isFrozen) {
            if (this.positionGizmo) this.positionGizmo.attachedNode = null;
            if (this.freeDragSphere && !this.freeDragSphere.isDisposed()) {
                this.freeDragSphere.setEnabled(false);
            }
            return;
        }

        const targetNode = this._resolveTargetMesh(activeEntity);
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
        if (!rawEntity || !this.isEntityVisible(rawEntity)) {
            if (this.rotationGizmo) this.rotationGizmo.attachedNode = null;
            return;
        }

        const { target: activeEntity } = doc.getTransformableTarget(rawEntity);
        const isFrozen = Boolean(
            (rawEntity as any)?.frozen || (rawEntity as any)?.params?.frozen ||
            (activeEntity as any)?.frozen || (activeEntity as any)?.params?.frozen
        );
        if (!activeEntity || !this.isEntityVisible(activeEntity) || isFrozen) {
            if (this.rotationGizmo) this.rotationGizmo.attachedNode = null;
            return;
        }

        const targetNode = this._resolveTargetMesh(activeEntity);

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
                    ContextManager.instance.modalTransformManager?.updateLiveValues();
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
                    const ctx = this._resolveTransformTarget();
                    if (ctx) {
                        const liveTarget = this._resolveTargetMesh(ctx.entity);
                        if (liveTarget) {
                            ContextManager.instance.sceneSyncAdapter.syncFromMesh(liveTarget);
                        }
                        const label = `Obrót ${ctx.entity.name || 'obiektu'}`;
                        this._commitConstraintDrag(ctx.entity, label);
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
        const doc = ContextManager.instance.document;
        const activeEntity = doc?.activeEntity;

        let activeContainerId: string | null = null;
        if (activeEntity) {
            if (activeEntity.type === 'container') {
                activeContainerId = activeEntity.id;
            } else {
                let role = (activeEntity as any).role;
                if (!role && activeEntity.id && doc) {
                    const node = doc.findNode(activeEntity.id);
                    if ((node?.domainData as any)?.role) {
                        role = (node.domainData as any).role;
                    }
                }
                const handler = role ? findOffsetGizmoHandler(role) : null;
                const container: any = handler?.resolveContainer(doc, activeEntity) || (doc && activeEntity.id ? doc.findNode(activeEntity.id)?.parent?.domainData : null);
                if (container?.id) {
                    activeContainerId = container.id;
                } else {
                    const tr = doc?.getTransformableTarget(activeEntity);
                    if (tr?.target?.type === 'container') {
                        activeContainerId = tr.target.id;
                    }
                }
            }
        }

        const currentEntityId = activeEntity?.id || null;
        const entityChanged = Boolean(this.lastActiveEntityId !== currentEntityId);

        // Jeśli zmienił się aktywny obiekt na inny kontener lub formatkę, zresetuj starą sesję edycji
        const containerChanged = Boolean(
            entityChanged ||
            (this.activeGizmoContainer && activeContainerId && this.activeGizmoContainer.id !== activeContainerId) ||
            (this.activeCornerSession && activeContainerId && this.activeCornerSession.container?.id !== activeContainerId) ||
            (!activeEntity && (this.activeGizmoContainer || this.activeCornerSession || this.isEditingFaceGizmo))
        );

        this.lastActiveEntityId = currentEntityId;

        const win = typeof window !== 'undefined' ? (window as any) : (typeof globalThis !== 'undefined' ? (globalThis as any) : null);

        if (containerChanged) {
            this.closeFloatingInput(true);
            this.clearFaceGizmos();
            if (win) {
                win.__glcGizmoActive = false;
            }
            const badge = typeof document !== 'undefined' ? document.getElementById('gizmo-floating-input') : null;
            if (badge) badge.style.display = 'none';
        }

        // Jeśli użytkownik wybrał obiekt w dokumencie, a flaga GLC wisiała, zresetuj ją, o ile nie trwa fizyczny drag osi GLC
        const glcAxis = (ContextManager.instance?.viewport as any)?.glcAxis;
        const isGlcDragging = Boolean(glcAxis && (glcAxis as any).isDraggingGizmo);
        if (win && !isGlcDragging && this._isGlcGizmoActive() && activeEntity) {
            win.__glcGizmoActive = false;
        }

        if (this._isGlcGizmoActive() || this.isDraggingCornerGizmo) return;
        this.createFloatingInput();

        if (this.isDraggingFaceGizmo || (this.isEditingFaceGizmo && this.activeFaceGizmoSpheres.length > 0)) {
            return;
        }

        const modalMgr = ContextManager.instance.modalTransformManager;
        if (modalMgr && modalMgr.activeMode !== 'none') {
            if (!activeEntity || !this.isEntityVisible(activeEntity)) {
                this.clearFaceGizmos();
                return;
            }
            modalMgr.setTargetEntity?.(activeEntity);
            if (modalMgr.activeMode === 'translate') {
                this.showTranslateGizmo(activeEntity);
            } else if (modalMgr.activeMode === 'rotate') {
                this.showRotateGizmo(activeEntity);
            }
            return;
        }

        this.clearFaceGizmos();

        const viewport = ContextManager.instance.viewport;
        const panelViews = ContextManager.instance.panelViews;
        const facePicker = ContextManager.instance.facePicker;

        if (!doc || !viewport) return;

        if (!activeEntity || !this.isEntityVisible(activeEntity)) return;

        // Gizma push/pull korpusu: wyłączone w module CAM (tab-c1-cnc), trybie instrukcji montażu lub podczas aktywnego pickera referencji/więzów
        const activeTab = ContextManager.instance.activeTab;
        const isPickingRef = Boolean(ContextManager.instance.activeReferencePicker || ContextManager.instance.activeConstraintPicker);
        if (isPickingRef || activeTab === 'tab-c1-cnc' || activeTab === 'tab-i1-instrukcja') {
            return;
        }

        if (activeEntity.type === 'container') {
            this.createCornerGizmosForContainer(activeEntity);
            return;
        }

        const targetEntity = activeEntity;
        let view = panelViews.get(targetEntity) || (targetEntity?.id ? panelViews.get(targetEntity.id) : null);
        if (!view && targetEntity?.id) {
            for (const [p, v] of panelViews.entries()) {
                if (p?.id === targetEntity.id) {
                    view = v;
                    break;
                }
            }
        }
        if (!view || !view.faceMeshes) return;
        if (view.root && (view.root.isEnabled() === false || view.root.isVisible === false)) {
            return;
        }

        let role = (targetEntity as any).role;
        if (!role && targetEntity?.id && doc) {
            const node = doc.findNode(targetEntity.id);
            if ((node?.domainData as any)?.role) {
                role = (node.domainData as any).role;
            }
        }
        const handler = role ? findOffsetGizmoHandler(role) : null;
        // Zawsze korpus właściciel płyty — NIE getContainers()[0]
        let container: any = handler?.resolveContainer(doc, targetEntity) || (doc ? doc.findNode(targetEntity.id)?.parent?.domainData : null);
        if (!container && targetEntity?.id && doc) {
            const node = doc.findNode(targetEntity.id);
            if (node?.parent?.domainData) {
                container = node.parent.domainData;
            }
        }

        const mapping = handler?.getFaceMapping(role, targetEntity) || (role && this.pushPullMapping[role]) || null;
        if (!mapping) {
            if (container) {
                this.createCornerGizmosForContainer(container);
            }
            return;
        }

        if (!container || !container.generatorParams || !this.isEntityVisible(container)) return;

        const rawName = targetEntity.name || '';
        const cleanName = rawName.replace(/\.\d+$/, '').replace(/_\d+$/, '');
        const panelName = cleanName || (targetEntity as any).key || (targetEntity as any).role || rawName;

        if (role === 'TOP_PANEL' || role.includes('TOP')) {
            const owningKorpus = container;
            if (owningKorpus) {
                this.activeTopPanelEntity = targetEntity;
                this.activeTopPanelContainer = owningKorpus;
                if (this.isTopPanelWidgetOpen) {
                    this.updateTopPanelWidgetUI();
                }
            }
        }

        for (const [faceName, suffix] of Object.entries(mapping)) {
            const isFrontFace = faceName === 'FACE_Z_PLUS';
            let paramName = suffix === 'backOffset' ? 'backOffset' : `${panelName}_${suffix}`;
            if (handler?.resolveFrontParam && (isFrontFace || suffix === 'backOffset' || suffix === 'shiftY')) {
                const resolved = handler.resolveFrontParam(targetEntity);
                if (resolved && isFrontFace) {
                    paramName = resolved.paramName;
                }
            }
            const canonicalFace = normalizeFaceName(faceName);
            let mesh = view.faceMeshes[canonicalFace];
            if (!mesh && (canonicalFace === 'FACE_X_PLUS' || canonicalFace === 'FACE_X_MINUS' || canonicalFace === 'FACE_Y_PLUS' || canonicalFace === 'FACE_Y_MINUS')) {
                const targetEdgeKey = canonicalFace === 'FACE_X_PLUS' ? '+X'
                    : canonicalFace === 'FACE_X_MINUS' ? '-X'
                    : canonicalFace === 'FACE_Y_PLUS' ? '+Y'
                    : '-Y';
                for (const m of Object.values(view.faceMeshes)) {
                    if ((m as any)?.metadata?.outlineEdgeKey === targetEdgeKey) {
                        mesh = m;
                        break;
                    }
                }
            }
            if (!mesh) continue;

                mesh.computeWorldMatrix(true);
                const faceCenter = mesh.getBoundingInfo().boundingBox.centerWorld;
                
                view.root.computeWorldMatrix(true);
                const localNormal = this.faceNormals[canonicalFace] || new BABYLON.Vector3(0, 1, 0);
                const normal = BABYLON.Vector3.TransformNormal(localNormal, view.root.getWorldMatrix()).normalize();

                const sphere = BABYLON.MeshBuilder.CreateSphere(`faceGizmoSphere_${faceName}`, { diameter: 30 }, viewport.scene);
                sphere.metadata = { paramName: paramName };

                // Centralna kulka przesuwania na środku płyty (front/back/shift/backOffset) -> ZAWSZE NIEBIESKA i W ŚRODKU LCS FORMATKI
                const isCenterPlane = faceName === 'FACE_Z_PLUS' || faceName === 'FACE_Z_MINUS'
                    || paramName.includes('shift') || paramName === 'backOffset';

                if (isCenterPlane) {
                    const worldPos = view.root.getAbsolutePosition ? view.root.getAbsolutePosition().clone() : view.root.position.clone();
                    sphere.position.copyFrom(worldPos);
                } else {
                    sphere.position.copyFrom(faceCenter);
                    sphere.position.addInPlace(normal.scale(20));
                }

                const isAxisY = paramName.endsWith('+Y') || paramName.endsWith('-Y') || paramName.includes('pY') || paramName.includes('shiftY');
                const isAxisX = paramName.endsWith('+X') || paramName.endsWith('-X') || paramName.includes('pX') || paramName.includes('shiftX');

                let diffuseColor: any;
                let emissiveColor: any;

                if (isCenterPlane) {
                    // Środek płyty / Przesuwanie -> NIEBIESKI
                    diffuseColor = new BABYLON.Color3(0.1, 0.45, 0.95);
                    emissiveColor = new BABYLON.Color3(0.05, 0.3, 0.7);
                } else if (isAxisY) {
                    // Kierunek Y (2 kule dla osi Y) -> ZIELONY
                    diffuseColor = new BABYLON.Color3(0.15, 0.8, 0.25);
                    emissiveColor = new BABYLON.Color3(0.1, 0.6, 0.15);
                } else if (isAxisX) {
                    // Kierunek X (2 kule dla osi X) -> CZERWONY
                    diffuseColor = new BABYLON.Color3(0.9, 0.15, 0.15);
                    emissiveColor = new BABYLON.Color3(0.7, 0.1, 0.1);
                } else {
                    // Domyślnie CZERWONY
                    diffuseColor = new BABYLON.Color3(0.9, 0.15, 0.15);
                    emissiveColor = new BABYLON.Color3(0.7, 0.1, 0.1);
                }

                const mat = new BABYLON.StandardMaterial(`faceGizmoSphereMat_${faceName}`, viewport.scene);
                mat.diffuseColor = diffuseColor;
                mat.emissiveColor = emissiveColor;
                sphere.material = mat;
                sphere.setParent(view.root);
                if (sphere.computeWorldMatrix) {
                    sphere.computeWorldMatrix(true);
                }

                const dragBehavior = new BABYLON.PointerDragBehavior({
                    dragAxis: normal
                });
                dragBehavior.useObjectOrientationForDragging = false;
                dragBehavior.dragDeltaRatio = GIZMO_DRAG_MULTIPLIER;

                let originalValue = 0;
                let startPos: any = null;
                let hasDragged = false;

                dragBehavior.onDragStartObservable.add(() => {
                    hasDragged = false;
                    if (this._blurTimeoutId) {
                        clearTimeout(this._blurTimeoutId);
                        this._blurTimeoutId = null;
                    }
                    if (this.isEditingFaceGizmo) {
                        this.closeFloatingInput(true);
                    }
                    this.isDraggingFaceGizmo = true;
                    this.isEditingFaceGizmo = false;
                    this.badgeFixedPos = null;
                    this.activeGizmoSphere = sphere;
                    this.activeGizmoParamName = paramName;
                    this.activeGizmoContainer = container;
                    this.activeGizmoRole = role;
                    const c = container as any;
                    if (paramName === 'backOffset' || paramName === 'cofniecie_plecow_mm') {
                        const gp = c.generatorParams;
                        this.originalValueBeforeEdit = gp?.cofniecie_plecow_mm ?? gp?.backOffset ?? gp?.offsets?.backOffset ?? 3;
                    } else {
                        this.originalValueBeforeEdit = this._readOffsetMm(c, paramName, role);
                    }

                    viewport.camera.detachControl();
                    originalValue = this.originalValueBeforeEdit;
                    sphere.setParent(null);
                    startPos = sphere.position.clone();
                    this._showDragGuideLine(viewport.scene, startPos, normal, diffuseColor);
                });

                dragBehavior.onDragObservable.add(() => {
                    hasDragged = true;
                    const c = container as any;
                    const projDist = this._projectPointerRayOntoAxis(viewport.scene, startPos, normal);
                    let delta = 0;
                    if (projDist !== null) {
                        delta = Math.round(projDist);
                    } else {
                        const diffVec = sphere.position.subtract(startPos);
                        delta = Math.round(BABYLON.Vector3.Dot(diffVec, normal));
                    }

                    if (paramName === 'backOffset' || paramName === 'cofniecie_plecow_mm') {
                        const newValue = Math.max(0, originalValue + delta);
                        const effectiveDelta = newValue - originalValue;
                        sphere.position.copyFrom(startPos.add(normal.scale(effectiveDelta)));
                        const curVal = c.generatorParams.cofniecie_plecow_mm ?? c.generatorParams.backOffset;
                        if (curVal === newValue) return;
                        this.previewOffsetOnContainer(c, paramName, newValue, role);
                        return;
                    }

                    const rawValue = originalValue + delta;
                    const handler = role ? findOffsetGizmoHandler(role) : null;
                    const newValue = handler?.clampOffset ? handler.clampOffset(c, paramName, rawValue) : rawValue;
                    const effectiveDelta = newValue - originalValue;

                    // Precyzyjnie przypnij pozycję kulki do poruszającej się krawędzi formatki (uwzględnia obcięcie min 1mm)
                    sphere.position.copyFrom(startPos.add(normal.scale(effectiveDelta)));

                    if (!c.generatorParams.offsets) {
                        c.generatorParams.offsets = {};
                    }

                    if (c.generatorParams.offsets[paramName] === newValue) {
                        return;
                    }

                    this.previewOffsetOnContainer(c, paramName, newValue, role);
                });

                dragBehavior.onDragEndObservable.add(() => {
                    this._disposeDragGuideLine();
                    this.isDraggingFaceGizmo = false;
                    viewport.camera.attachControl(viewport.canvas, true);
                    
                    if (!hasDragged) {
                        // Zwykłe kliknięcie (delta = 0) — nie niszcz geometrii ani kulek w onDragEnd;
                        // otwarcie pola obsłuży OnPickTrigger na aktywnej, żywej kuli.
                        sphere.setParent(view.root);
                        return;
                    }

                    const lastParam = this.activeGizmoParamName;
                    const lastContainer = this.activeGizmoContainer;
                    const lastRole = role || this.activeGizmoRole;
                    const startVal = originalValue;
                    
                    this.updateFaceGizmo();
                    
                    if (lastParam && lastContainer) {
                        const newSphere = this.activeFaceGizmoSpheres.find(s => s.metadata?.paramName === lastParam);
                        if (newSphere) {
                            this.openFloatingInput(newSphere, lastParam, lastContainer, lastRole, startVal);
                        }
                    }
                });

                sphere.actionManager = new BABYLON.ActionManager(viewport.scene);
                sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPointerOverTrigger,
                    () => { sphere.scaling.setAll(1.2); }
                ));
                sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPointerOutTrigger,
                    () => { sphere.scaling.setAll(1.0); }
                ));
                sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPickTrigger,
                    () => {
                        this.openFloatingInput(sphere, paramName, container, role);
                    }
                ));

                sphere.addBehavior(dragBehavior);
                this.activeFaceGizmoSpheres.push(sphere);
            }

            // --- DODANIE ŚRODKOWEJ KULI DO PRZESUWANIA (SHIFT) ---
            if (view && view.root && role) {
                let shiftParam = '';
                let shiftAxis = new BABYLON.Vector3(1, 0, 0); // Domyślnie X

                // Plecy mają już dedykowane niebieskie gizmo na FACE_Z_PLUS dla backOffset / shift (brak duplikatu centerSphere)
                if (role === 'BACK_PANEL' || role.includes('BACK')) {
                    shiftParam = '';
                } else {
                    const shiftSpec = handler?.getShift ? handler.getShift(role, targetEntity) : null;
                    if (shiftSpec) {
                        shiftParam = shiftSpec.paramSuffix;
                        if (shiftSpec.cadAxis === 'X') {
                            shiftAxis = new BABYLON.Vector3(shiftSpec.sign, 0, 0);
                        } else if (shiftSpec.cadAxis === 'Y') {
                            // CAD Y = Babylon Z (głębokość szafki = oś Z formatki TRAVERSE_V)
                            shiftAxis = new BABYLON.Vector3(0, 0, shiftSpec.sign);
                        } else if (shiftSpec.cadAxis === 'Z') {
                            // CAD Z = Babylon Y (wysokość szafki)
                            shiftAxis = new BABYLON.Vector3(0, shiftSpec.sign, 0);
                        }
                    } else if (role.includes('LEFT') || role === 'LEFT_SIDE_PANEL' || role === 'SIDE_LEFT') {
                        shiftParam = 'shiftX';
                        shiftAxis = new BABYLON.Vector3(-1, 0, 0); // Dla lewego boku (-X na zewnątrz korpusu)
                    } else if (role.includes('SIDE') || role.includes('DIVIDER')) {
                        shiftParam = 'shiftX';
                        shiftAxis = new BABYLON.Vector3(1, 0, 0);  // Dla prawego boku i przegród (+X na zewnątrz korpusu)
                    } else if (role.includes('BOTTOM') || role === 'BOTTOM_PANEL') {
                        shiftParam = 'shiftZ';
                        shiftAxis = new BABYLON.Vector3(0, -1, 0); // Dla wieńca dolnego (-Z na zewnątrz korpusu w dół)
                    } else if (role.includes('TOP') || role === 'TOP_PANEL') {
                        shiftParam = 'shiftZ';
                        shiftAxis = new BABYLON.Vector3(0, 1, 0);  // Dla wieńca górnego (+Z na zewnątrz korpusu w górę)
                    }
                }

                if (shiftParam) {
                    const paramName = `${panelName}_${shiftParam}`;
                    
                    view.root.computeWorldMatrix(true);
                    if (view.root.parent && typeof view.root.parent.getWorldMatrix === 'function') {
                        if (typeof view.root.parent.computeWorldMatrix === 'function') {
                            view.root.parent.computeWorldMatrix(true);
                        }
                        shiftAxis = BABYLON.Vector3.TransformNormal(shiftAxis, view.root.parent.getWorldMatrix()).normalize();
                    }
                    const worldPos = view.root.getAbsolutePosition ? view.root.getAbsolutePosition().clone() : view.root.position.clone();
                    
                    const centerSphere = BABYLON.MeshBuilder.CreateSphere(`faceGizmoSphere_center`, { diameter: 30 }, viewport.scene);
                    centerSphere.metadata = { paramName: paramName };
                    centerSphere.position.copyFrom(worldPos);
                    centerSphere.position.addInPlace(shiftAxis.scale(20));
                    centerSphere.setParent(view.root);
                    if (centerSphere.computeWorldMatrix) {
                        centerSphere.computeWorldMatrix(true);
                    }
                    
                    // Środkowa kula do przesuwania (move / shift) -> ZAWSZE NIEBIESKA
                    const diffuseColor = new BABYLON.Color3(0.1, 0.45, 0.95);
                    const emissiveColor = new BABYLON.Color3(0.05, 0.3, 0.7);

                    const mat = new BABYLON.StandardMaterial('freeDragSphereMat_faceMode', viewport.scene);
                    mat.diffuseColor = diffuseColor;
                    mat.emissiveColor = emissiveColor;
                    centerSphere.material = mat;

                    const centerDrag = new BABYLON.PointerDragBehavior({
                        dragAxis: shiftAxis
                    });
                    centerDrag.useObjectOrientationForDragging = false;
                    centerDrag.dragDeltaRatio = GIZMO_DRAG_MULTIPLIER;
                    
                    let originalValue = 0;
                    let startPos: any = null;
                    let hasCenterDragged = false;
                    
                    centerDrag.onDragStartObservable.add(() => {
                        hasCenterDragged = false;
                        if (this._blurTimeoutId) {
                            clearTimeout(this._blurTimeoutId);
                            this._blurTimeoutId = null;
                        }
                        if (this.isEditingFaceGizmo) {
                            this.closeFloatingInput(true);
                        }
                        this.isDraggingFaceGizmo = true;
                        this.isEditingFaceGizmo = false;
                        this.badgeFixedPos = null;
                        this.activeGizmoSphere = centerSphere;
                        this.activeGizmoParamName = paramName;
                        this.activeGizmoContainer = container;
                        this.activeGizmoRole = role;
                        const c = container as any;
                        this.originalValueBeforeEdit = this._readOffsetMm(c, paramName, role);

                        viewport.camera.detachControl();
                        originalValue = this.originalValueBeforeEdit;
                        centerSphere.setParent(null);
                        startPos = centerSphere.position.clone();
                        this._showDragGuideLine(viewport.scene, startPos, shiftAxis, diffuseColor);
                    });

                    centerDrag.onDragObservable.add(() => {
                        hasCenterDragged = true;
                        const c = container as any;
                        const projDist = this._projectPointerRayOntoAxis(viewport.scene, startPos, shiftAxis);
                        let delta = 0;
                        if (projDist !== null) {
                            delta = Math.round(projDist);
                        } else {
                            const diffVec = centerSphere.position.subtract(startPos);
                            delta = Math.round(BABYLON.Vector3.Dot(diffVec, shiftAxis));
                        }

                        // Precyzyjnie przypnij pozycję kulki do poruszającej się krawędzi formatki
                        centerSphere.position.copyFrom(startPos.add(shiftAxis.scale(delta)));

                        const newValue = originalValue + delta;
                        if (!c.generatorParams.offsets) {
                            c.generatorParams.offsets = {};
                        }

                        if (c.generatorParams.offsets[paramName] === newValue) {
                            return;
                        }

                        this.previewOffsetOnContainer(c, paramName, newValue, role);
                    });

                    centerDrag.onDragEndObservable.add(() => {
                        this._disposeDragGuideLine();
                        this.isDraggingFaceGizmo = false;
                        viewport.camera.attachControl(viewport.canvas, true);
                        
                        if (!hasCenterDragged) {
                            centerSphere.setParent(view.root);
                            return;
                        }

                        const lastParam = this.activeGizmoParamName;
                        const lastContainer = this.activeGizmoContainer;
                        const lastRole = role || this.activeGizmoRole;
                        const startVal = originalValue;
                        this.updateFaceGizmo();
                        
                        if (lastParam && lastContainer) {
                            const newSphere = this.activeFaceGizmoSpheres.find(s => s.metadata?.paramName === lastParam);
                            if (newSphere) {
                                this.openFloatingInput(newSphere, lastParam, lastContainer, lastRole, startVal);
                            }
                        }
                    });

                    centerSphere.actionManager = new BABYLON.ActionManager(viewport.scene);
                    centerSphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                        BABYLON.ActionManager.OnPointerOverTrigger,
                        () => { centerSphere.scaling.setAll(1.2); }
                    ));
                    centerSphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                        BABYLON.ActionManager.OnPointerOutTrigger,
                        () => { centerSphere.scaling.setAll(1.0); }
                    ));
                    centerSphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                        BABYLON.ActionManager.OnPickTrigger,
                        () => {
                            this.openFloatingInput(centerSphere, paramName, container, role);
                        }
                    ));

                    centerSphere.addBehavior(centerDrag);
                    this.activeFaceGizmoSpheres.push(centerSphere);

                    // --- GIZMO W KSZTAŁCIE KOSTKI (CUBE) DO KONFIGURACJI WIEŃCA GÓRNEGO ---
                    if (role === 'TOP_PANEL' || role.includes('TOP')) {
                        // Na środku formatki; rozmiar = grubość + 10% (lekko wystaje poza płytę)
                        const thicknessMm = Math.max(1, nmToMm((targetEntity as any).thickness) || 18);
                        const cubeSize = thicknessMm * 1.1;
                        const topCube = BABYLON.MeshBuilder.CreateBox(
                            'faceGizmo_topPanelConfigCube',
                            { size: cubeSize },
                            viewport.scene
                        );
                        topCube.metadata = { isTopConfigCube: true };
                        topCube.setParent(view.root);
                        if (topCube.computeWorldMatrix) {
                            topCube.computeWorldMatrix(true);
                        }
                        topCube.position.set(0, 0, 0);

                        // Niebieska kula move obok — nie zasłania pomarańczowej kostki w środku
                        centerSphere.position = new BABYLON.Vector3(thicknessMm * 2, 0, 0);

                        const cubeMat = new BABYLON.StandardMaterial('topConfigCubeMat', viewport.scene);
                        cubeMat.diffuseColor = new BABYLON.Color3(1.0, 0.45, 0.05); // Pomarańczowy
                        cubeMat.emissiveColor = new BABYLON.Color3(0.5, 0.2, 0.0);
                        cubeMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
                        topCube.material = cubeMat;

                        topCube.actionManager = new BABYLON.ActionManager(viewport.scene);
                        topCube.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                            BABYLON.ActionManager.OnPickTrigger,
                            () => {
                                this.toggleTopPanelWidget();
                            }
                        ));

                        this.activeFaceGizmoSpheres.push(topCube);
                    }
                }
            }

        if (container) {
            this.createCornerGizmosForContainer(container);
        }
    }

    /**
     * Tworzy 8 niezależnych sfer gizmo w narożnikach SmartFrame (w kolorze krawędzi kontenera).
     * Kliknięcie sfery natychmiast otwiera okno edycji korpusu (FloatingKorpusEdit).
     * Przeciąganie sfery rozciąga gabaryt (szerokość, wysokość lub głębokość) asymetrycznie
     * względem przeciwległego narożnika/ściany (przeciwległy bok pozostaje zakotwiczony w miejscu).
     */
    private createCornerGizmosForContainer(container: any): void {
        const doc = ContextManager.instance.document;
        const viewport = ContextManager.instance.viewport;
        if (!doc || !viewport || !viewport.scene || !container) return;

        if (this.activeGizmoContainer && this.activeGizmoContainer.id !== container.id) {
            this.clearFaceGizmos();
        }

        if (this.activeFaceGizmoSpheres.some(s => s.name && s.name.startsWith('containerCornerGizmo_'))) {
            if (this.activeGizmoContainer?.id === container.id) {
                return;
            }
            this.clearFaceGizmos();
        }

        const gp = container.generatorParams || {};
        const t = String(gp.type || gp.typ_korpusu || '');
        const isSpecial = t.startsWith('blok_') || t.startsWith('smartpart') || t === 'smart_appliance' || t === 'smartwall' || container.role === 'APPLIANCE';
        if (isSpecial) return;

        const containerViews = ContextManager.instance.containerViews;
        let view = containerViews?.get(container);
        if (!view && container?.id) {
            for (const [c, v] of containerViews || []) {
                if (c?.id === container.id) {
                    view = v;
                    break;
                }
            }
        }
        if (!view || !view.mesh) return;

        this.activeGizmoContainer = container;

        if (view.mesh.parent && typeof view.mesh.parent.computeWorldMatrix === 'function') {
            view.mesh.parent.computeWorldMatrix(true);
        }
        view.mesh.computeWorldMatrix(true);
        const worldMatrix = view.mesh.getWorldMatrix().clone();

        const width = container.generatorParams?.szerokosc_mm ?? nmToMm(container.width);
        const height = container.generatorParams?.wysokosc_mm ?? nmToMm(container.height);
        const depth = container.generatorParams?.glebokosc_mm ?? nmToMm(container.depth);
        if (!width || !height || !depth || width <= 0 || height <= 0 || depth <= 0) return;

        const slopeInfo = typeof view._getSlopedInfo === 'function' ? view._getSlopedInfo() : null;
        const yTopFrontLeft = slopeInfo ? (slopeInfo.yTopFront !== undefined ? slopeInfo.yTopFront : slopeInfo.yTopLeft) : height;
        const yTopFrontRight = slopeInfo ? (slopeInfo.yTopFront !== undefined ? slopeInfo.yTopFront : slopeInfo.yTopRight) : height;
        const yTopBackRight = slopeInfo ? (slopeInfo.yTopBack !== undefined ? slopeInfo.yTopBack : slopeInfo.yTopRight) : height;
        const yTopBackLeft = slopeInfo ? (slopeInfo.yTopBack !== undefined ? slopeInfo.yTopBack : slopeInfo.yTopLeft) : height;

        const corners: Array<{ id: string; sx: 1 | -1; sy: 1 | -1; sz: 1 | -1; local: any }> = [
            { id: 'front_top_right', sx: 1, sy: 1, sz: -1, local: new BABYLON.Vector3(width / 2, yTopFrontRight, -depth / 2) },
            { id: 'front_top_left', sx: -1, sy: 1, sz: -1, local: new BABYLON.Vector3(-width / 2, yTopFrontLeft, -depth / 2) },
            { id: 'front_bottom_right', sx: 1, sy: -1, sz: -1, local: new BABYLON.Vector3(width / 2, 0, -depth / 2) },
            { id: 'front_bottom_left', sx: -1, sy: -1, sz: -1, local: new BABYLON.Vector3(-width / 2, 0, -depth / 2) },
            { id: 'back_top_right', sx: 1, sy: 1, sz: 1, local: new BABYLON.Vector3(width / 2, yTopBackRight, depth / 2) },
            { id: 'back_top_left', sx: -1, sy: 1, sz: 1, local: new BABYLON.Vector3(-width / 2, yTopBackLeft, depth / 2) },
            { id: 'back_bottom_right', sx: 1, sy: -1, sz: 1, local: new BABYLON.Vector3(width / 2, 0, depth / 2) },
            { id: 'back_bottom_left', sx: -1, sy: -1, sz: 1, local: new BABYLON.Vector3(-width / 2, 0, depth / 2) },
        ];

        // Osie szafki w układzie świata (X = szerokość, Y = wysokość w Babylon / Z w CAD, Z = głębokość w Babylon / Y w CAD)
        const axisX = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(1, 0, 0), worldMatrix).normalize();
        const axisY = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 1, 0), worldMatrix).normalize();
        const axisZ = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 0, 1), worldMatrix).normalize();

        for (const c of corners) {
            const sphere = BABYLON.MeshBuilder.CreateSphere(
                `containerCornerGizmo_${c.id}_${container.id}`,
                { diameter: 24 },
                viewport.scene
            );
            const worldPos = BABYLON.Vector3.TransformCoordinates(c.local, worldMatrix);
            sphere.position.copyFrom(worldPos);
            sphere.isPickable = true;
            sphere.renderingGroupId = 2;
            const cornerIdx = (c.sx > 0 ? 1 : 0) | (c.sz < 0 ? 2 : 0) | (c.sy > 0 ? 4 : 0);
            sphere.metadata = {
                isCornerGizmo: true,
                cornerId: c.id,
                cornerIdx,
                sx: c.sx,
                sy: c.sy,
                sz: c.sz,
                containerId: container.id,
                containerNode: doc.findNode(container.id),
            };

            const mat = new BABYLON.StandardMaterial(`containerCornerGizmoMat_${c.id}_${container.id}`, viewport.scene);
            mat.diffuseColor = new BABYLON.Color3(0.15, 0.85, 1.0);
            mat.emissiveColor = new BABYLON.Color3(0.2, 0.9, 1.0);
            mat.specularColor = new BABYLON.Color3(0.8, 0.95, 1.0);
            sphere.material = mat;

            sphere.actionManager = new BABYLON.ActionManager(viewport.scene);
            sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPointerOverTrigger,
                () => {
                    sphere.scaling.setAll(1.3);
                    if (!this.isDraggingCornerGizmo && !this.isEditingFaceGizmo && !this._isGlcGizmoActive()) {
                        const curVal = c.sy === 1 ? c.local.y : width;
                        this._updateCornerDragBadge(curVal, sphere, '#38bdf8');
                    }
                }
            ));
            sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPointerOutTrigger,
                () => {
                    sphere.scaling.setAll(1.0);
                    if (!this.isDraggingCornerGizmo && !this.isEditingFaceGizmo && !this._isGlcGizmoActive()) {
                        const badge = document.getElementById('gizmo-floating-input');
                        if (badge) badge.style.display = 'none';
                    }
                }
            ));

            this.activeFaceGizmoSpheres.push(sphere);
        }

        // Dodatkowe gizma dla podziałów stref w korpusach 2- i 3-strefowych
        const isCorner = t.includes('rogowy');
        const isSkosny = t.includes('skosny');
        const defaultZones: 1 | 2 | 3 = (isCorner || isSkosny) ? 1 : 3;
        const zCount = Number(gp.liczba_stref ?? (gp.typ_podzialu === 'POZIOMY_2_STREFY' ? 2 : gp.typ_podzialu === 'POZIOMY_3_STREFY' ? 3 : defaultZones)) as (1 | 2 | 3);
        const defBottom = zCount === 2 ? Math.round(height / 2) : 500;
        const defMiddle = zCount === 3 ? 1200 : 0;
        const bHeight = typeof gp.wysokosc_strefy_dolnej_mm === 'number' ? gp.wysokosc_strefy_dolnej_mm : defBottom;
        const mHeight = typeof gp.wysokosc_strefy_srodkowej_mm === 'number' ? gp.wysokosc_strefy_srodkowej_mm : defMiddle;

        const zoneDividers: Array<{
            dividerType: 'BOTTOM' | 'MIDDLE';
            zMm: number;
            color: { diffuse: any; emissive: any };
        }> = [];

        if (zCount === 2 && bHeight > 50 && bHeight < height - 50) {
            zoneDividers.push({
                dividerType: 'BOTTOM',
                zMm: bHeight,
                color: {
                    diffuse: new BABYLON.Color3(0.95, 0.6, 0.15),
                    emissive: new BABYLON.Color3(0.85, 0.45, 0.05),
                },
            });
        } else if (zCount === 3) {
            if (bHeight > 50 && bHeight < height - 100) {
                zoneDividers.push({
                    dividerType: 'BOTTOM',
                    zMm: bHeight,
                    color: {
                        diffuse: new BABYLON.Color3(0.95, 0.6, 0.15),
                        emissive: new BABYLON.Color3(0.85, 0.45, 0.05),
                    },
                });
            }
            const midZ = bHeight + mHeight;
            if (midZ > bHeight + 50 && midZ < height - 50) {
                zoneDividers.push({
                    dividerType: 'MIDDLE',
                    zMm: midZ,
                    color: {
                        diffuse: new BABYLON.Color3(0.85, 0.3, 0.95),
                        emissive: new BABYLON.Color3(0.7, 0.15, 0.85),
                    },
                });
            }
        }

        for (const div of zoneDividers) {
            const divCorners: Array<{ id: string; sx: 1 | -1; sz: 1 | -1 }> = [
                { id: `front_${div.dividerType.toLowerCase()}_right`, sx: 1, sz: -1 },
                { id: `front_${div.dividerType.toLowerCase()}_left`, sx: -1, sz: -1 },
                { id: `back_${div.dividerType.toLowerCase()}_right`, sx: 1, sz: 1 },
                { id: `back_${div.dividerType.toLowerCase()}_left`, sx: -1, sz: 1 },
            ];

            for (const dc of divCorners) {
                const sphere = BABYLON.MeshBuilder.CreateSphere(
                    `containerZoneGizmo_${div.dividerType}_${dc.id}_${container.id}`,
                    { diameter: 22 },
                    viewport.scene
                );
                const localPos = new BABYLON.Vector3(dc.sx * (width / 2), div.zMm, dc.sz * (depth / 2));
                const worldPos = BABYLON.Vector3.TransformCoordinates(localPos, worldMatrix);
                sphere.position.copyFrom(worldPos);
                sphere.isPickable = true;
                sphere.renderingGroupId = 2;
                sphere.metadata = {
                    isCornerGizmo: true,
                    isZoneGizmo: true,
                    dividerType: div.dividerType,
                    cornerId: dc.id,
                    sx: dc.sx,
                    sy: 0,
                    sz: dc.sz,
                    containerId: container.id,
                    containerNode: doc.findNode(container.id),
                };

                const mat = new BABYLON.StandardMaterial(
                    `containerZoneGizmoMat_${div.dividerType}_${dc.id}_${container.id}`,
                    viewport.scene
                );
                mat.diffuseColor = div.color.diffuse;
                mat.emissiveColor = div.color.emissive;
                mat.specularColor = new BABYLON.Color3(0.9, 0.9, 0.9);
                sphere.material = mat;

                sphere.actionManager = new BABYLON.ActionManager(viewport.scene);
                sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPointerOverTrigger,
                    () => {
                        sphere.scaling.setAll(1.35);
                        if (!this.isDraggingCornerGizmo && !this._isGlcGizmoActive()) {
                            this._updateCornerDragBadge(div.zMm, sphere, '#fb923c');
                        }
                    }
                ));
                sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPointerOutTrigger,
                    () => {
                        sphere.scaling.setAll(1.0);
                        if (!this.isDraggingCornerGizmo && !this.isEditingFaceGizmo && !this._isGlcGizmoActive()) {
                            const badge = document.getElementById('gizmo-floating-input');
                            if (badge) badge.style.display = 'none';
                        }
                    }
                ));

                this.activeFaceGizmoSpheres.push(sphere);
            }
        }

        if (this._cornerGizmoPointerObserver) {
            viewport.scene.onPointerObservable.remove(this._cornerGizmoPointerObserver);
            this._cornerGizmoPointerObserver = null;
        }

        let dragSession: {
            sphere: any;
            cornerId: string;
            cornerIdx: number;
            isZoneGizmo?: boolean;
            dividerType?: 'BOTTOM' | 'MIDDLE';
            startBottomHeight?: number;
            startMiddleHeight?: number;
            startZoneZMm?: number;
            lastBottomHeight?: number;
            lastMiddleHeight?: number;
            isSkosny?: boolean;
            isSkosnyLr?: boolean;
            isSkosnyDach?: boolean;
            startHeightLeft?: number;
            startHeightRight?: number;
            startHeightFront?: number;
            startHeightBack?: number;
            lastHeightLeft?: number;
            lastHeightRight?: number;
            lastHeightFront?: number;
            lastHeightBack?: number;
            sx: 1 | -1;
            sy: 1 | -1 | 0;
            sz: 1 | -1;
            startPointerX: number;
            startPointerY: number;
            startSpherePos: any;
            startWidth: number;
            startHeight: number;
            startDepth: number;
            lastWidth: number;
            lastHeight: number;
            lastDepth: number;
            lockedAxis: 'X' | 'Y' | 'Z' | null;
            cadNode: any;
            startDecomposed: { translation: Vec3; rotation: any; scale: Vec3 } | null;
            hasDragged: boolean;
            snappedLevelNode: any | null;
        } | null = null;

        const detectAxisFromPointer = (session: NonNullable<typeof dragSession>, dxPx: number, dyPx: number): 'X' | 'Y' | 'Z' => {
            const cam = viewport.scene.activeCamera;
            const engine = viewport.scene.getEngine?.();
            if (cam && engine && BABYLON.Vector3?.Project && BABYLON.Matrix?.Identity && cam.viewport?.toGlobal) {
                try {
                    const vp = cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
                    const transform = viewport.scene.getTransformMatrix();
                    const idMat = BABYLON.Matrix.Identity();
                    const p0 = BABYLON.Vector3.Project(session.startSpherePos, idMat, transform, vp);
                    const pX = BABYLON.Vector3.Project(session.startSpherePos.add(axisX.scale(100)), idMat, transform, vp);
                    const pY = BABYLON.Vector3.Project(session.startSpherePos.add(axisY.scale(100)), idMat, transform, vp);
                    const pZ = BABYLON.Vector3.Project(session.startSpherePos.add(axisZ.scale(100)), idMat, transform, vp);

                    const mLen = Math.hypot(dxPx, dyPx) || 1;
                    const mx = dxPx / mLen;
                    const my = dyPx / mLen;

                    const scoreVec = (p: any) => {
                        const vx = p.x - p0.x;
                        const vy = p.y - p0.y;
                        const len = Math.hypot(vx, vy);
                        if (len < 1e-3) return 0;
                        return Math.abs((vx / len) * mx + (vy / len) * my);
                    };

                    const sX = scoreVec(pX);
                    const sY = scoreVec(pY);
                    const sZ = scoreVec(pZ);
                    if (sX >= sY && sX >= sZ) return 'X';
                    if (sY >= sX && sY >= sZ) return 'Y';
                    return 'Z';
                } catch {}
            }
            const dX = Math.abs(this._projectPointerRayOntoAxis(viewport.scene, session.startSpherePos, axisX) ?? 0);
            const dY = Math.abs(this._projectPointerRayOntoAxis(viewport.scene, session.startSpherePos, axisY) ?? 0);
            const dZ = Math.abs(this._projectPointerRayOntoAxis(viewport.scene, session.startSpherePos, axisZ) ?? 0);
            if (dX >= dY && dX >= dZ) return 'X';
            if (dY >= dX && dY >= dZ) return 'Y';
            return 'Z';
        };

        this._cornerGizmoPointerObserver = viewport.scene.onPointerObservable.add((pointerInfo: any) => {
            const type = pointerInfo.type;

            if (type === BABYLON.PointerEventTypes.POINTERDOWN) {
                if (pointerInfo.event && pointerInfo.event.button !== 0) return;
                const pick = viewport.scene.pick(
                    viewport.scene.pointerX,
                    viewport.scene.pointerY,
                    (m: any) => Boolean(m?.isPickable && m?.metadata?.isCornerGizmo && m?.metadata?.containerId === container.id)
                ) || pointerInfo.pickInfo;
                if (!pick?.hit || !pick.pickedMesh) return;
                const mesh = pick.pickedMesh;
                if (!mesh.metadata?.isCornerGizmo || mesh.metadata?.containerId !== container.id) return;

                if (ContextManager.instance.activeConstraintPicker) {
                    if (handleConstraintPickEvent('select-vertex', { mesh })) {
                        return;
                    }
                }

                if (viewport.camera) {
                    viewport.camera.detachControl();
                }
                this.isDraggingFaceGizmo = true;
                this.isDraggingCornerGizmo = true;

                // Zawsze otwieraj okno edycji korpusu przy interakcji z gizmami gabarytu
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('cad-edit-entity', {
                        detail: { entityId: container.id, kind: 'korpus' }
                    }));
                }

                const curW = container.generatorParams?.szerokosc_mm ?? nmToMm(container.width);
                const curH = container.generatorParams?.wysokosc_mm ?? nmToMm(container.height);
                const curD = container.generatorParams?.glebokosc_mm ?? nmToMm(container.depth);
                const cadNode = doc.findNode(container.id);
                const startDecomposed = cadNode?.localMatrix?.decompose ? cadNode.localMatrix.decompose() : null;

                const isZoneGizmo = Boolean(mesh.metadata?.isZoneGizmo);
                const dividerType = mesh.metadata?.dividerType as ('BOTTOM' | 'MIDDLE' | undefined);
                const curBottomH = typeof container.generatorParams?.wysokosc_strefy_dolnej_mm === 'number'
                    ? container.generatorParams.wysokosc_strefy_dolnej_mm
                    : (zCount === 2 ? Math.round(curH / 2) : 500);
                const curMiddleH = typeof container.generatorParams?.wysokosc_strefy_srodkowej_mm === 'number'
                    ? container.generatorParams.wysokosc_strefy_srodkowej_mm
                    : (zCount === 3 ? 1200 : 0);
                const startZoneZ = dividerType === 'MIDDLE' ? curBottomH + curMiddleH : curBottomH;

                const cabTypeStr = String(container.generatorParams?.type || container.generatorParams?.typ_korpusu || '').toLowerCase();
                const isSkosnyLr = cabTypeStr.includes('skosny_lr');
                const isSkosnyDach = cabTypeStr.includes('skosny_dach') || (cabTypeStr.includes('skosny') && !isSkosnyLr);
                const isSkosny = isSkosnyLr || isSkosnyDach;

                const curHeightLeft = typeof container.generatorParams?.wysokosc_lewy_mm === 'number'
                    ? container.generatorParams.wysokosc_lewy_mm : 1000;
                const curHeightRight = typeof container.generatorParams?.wysokosc_prawy_mm === 'number'
                    ? container.generatorParams.wysokosc_prawy_mm : curH;
                const curHeightFront = typeof container.generatorParams?.wysokosc_przod_mm === 'number'
                    ? container.generatorParams.wysokosc_przod_mm : curH;
                const curHeightBack = typeof container.generatorParams?.wysokosc_tyl_mm === 'number'
                    ? container.generatorParams.wysokosc_tyl_mm : 1000;

                dragSession = {
                    sphere: mesh,
                    cornerId: mesh.metadata.cornerId,
                    cornerIdx: mesh.metadata.cornerIdx ?? 0,
                    isZoneGizmo,
                    dividerType,
                    startBottomHeight: curBottomH,
                    startMiddleHeight: curMiddleH,
                    startZoneZMm: startZoneZ,
                    lastBottomHeight: curBottomH,
                    lastMiddleHeight: curMiddleH,
                    isSkosny,
                    isSkosnyLr,
                    isSkosnyDach,
                    startHeightLeft: curHeightLeft,
                    startHeightRight: curHeightRight,
                    startHeightFront: curHeightFront,
                    startHeightBack: curHeightBack,
                    lastHeightLeft: curHeightLeft,
                    lastHeightRight: curHeightRight,
                    lastHeightFront: curHeightFront,
                    lastHeightBack: curHeightBack,
                    sx: mesh.metadata.sx ?? 1,
                    sy: isZoneGizmo ? 0 : (mesh.metadata.sy ?? 1),
                    sz: mesh.metadata.sz ?? -1,
                    startPointerX: viewport.scene.pointerX,
                    startPointerY: viewport.scene.pointerY,
                    startSpherePos: mesh.position.clone(),
                    startWidth: curW,
                    startHeight: curH,
                    startDepth: curD,
                    lastWidth: curW,
                    lastHeight: curH,
                    lastDepth: curD,
                    lockedAxis: isZoneGizmo ? 'Y' : null,
                    cadNode,
                    startDecomposed,
                    hasDragged: false,
                    snappedLevelNode: null,
                };
            } else if (type === BABYLON.PointerEventTypes.POINTERMOVE) {
                if (!dragSession) return;

                const dxPx = viewport.scene.pointerX - dragSession.startPointerX;
                const dyPx = viewport.scene.pointerY - dragSession.startPointerY;
                const distPx = Math.hypot(dxPx, dyPx);
                if (!dragSession.hasDragged && distPx > 4) {
                    dragSession.hasDragged = true;
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('cad-edit-entity', {
                            detail: { entityId: container.id, kind: 'korpus' }
                        }));
                    }
                }
                if (!dragSession.hasDragged) return;

                if (dragSession.isZoneGizmo) {
                    // Gizmo podziału strefy rusza się wyłącznie w pionie (oś Y w Babylon / Z w CAD)
                    dragSession.lockedAxis = 'Y';
                    let deltaY = Math.round(this._projectPointerRayOntoAxis(viewport.scene, dragSession.startSpherePos, axisY) ?? 0);
                    const rawZMm = (dragSession.startZoneZMm ?? 0) + deltaY;

                    // Sprawdź przyciąganie do płaszczyzn poziomów Z w GLC
                    let snappedLevel: any = null;
                    let bestDist = 50; // Promień przyciągania [mm]
                    const glcNode = doc.getGlcNode?.();
                    if (glcNode) {
                        const candidates: Array<{ node: any; zMm: number }> = [];
                        if ((glcNode.domainData as any)?.showAxisZ !== false) {
                            const tipZ_nm = (glcNode.domainData as any)?.tipZ_nm;
                            const axisZ_nm = (glcNode.domainData as any)?.axisZHeight_nm;
                            const tipZMm = typeof tipZ_nm === 'number' && tipZ_nm > 0
                                ? Math.round(nmToMm(tipZ_nm))
                                : (typeof axisZ_nm === 'number' && axisZ_nm > 0 ? Math.round(nmToMm(axisZ_nm)) + 30 : 2430);
                            candidates.push({ node: glcNode, zMm: tipZMm });
                        }
                        if (Array.isArray(glcNode.children)) {
                            for (const child of glcNode.children) {
                                if (child.nodeType !== NodeType.DATUM_LEVEL) continue;
                                if ((child.domainData as any)?.visible === false) continue;
                                const z_nm = (child.domainData as any)?.z_nm ?? child.localMatrix?.getTranslation?.()?.z ?? 0;
                                const levelZMm = Math.max(50, Math.round(nmToMm(z_nm)));
                                candidates.push({ node: child, zMm: levelZMm });
                            }
                        }
                        const containerBaseZ = dragSession.startDecomposed
                            ? Math.round(nmToMm(dragSession.startDecomposed.translation.z))
                            : 0;
                        const worldTargetZ = containerBaseZ + rawZMm;
                        for (const cand of candidates) {
                            const d = Math.abs(worldTargetZ - cand.zMm);
                            if (d <= bestDist) {
                                bestDist = d;
                                snappedLevel = cand.node;
                                deltaY = (cand.zMm - containerBaseZ) - (dragSession.startZoneZMm ?? 0);
                            }
                        }
                    }
                    dragSession.snappedLevelNode = snappedLevel;
                    if (typeof window !== 'undefined') {
                        (window as any).__glcAxis?.highlightLevelPlane?.(snappedLevel?.id ?? null);
                    }

                    const newTargetZ = Math.round((dragSession.startZoneZMm ?? 0) + deltaY);
                    let newBottomH = dragSession.startBottomHeight ?? 500;
                    let newMiddleH = dragSession.startMiddleHeight ?? 1200;

                    if (dragSession.dividerType === 'BOTTOM') {
                        // Ograniczenia: min 100 mm, max (wysokosc - 100 mm) lub (wysokosc_srodka - 100 mm)
                        const maxB = (zCount === 3)
                            ? Math.max(100, (dragSession.startBottomHeight ?? 500) + (dragSession.startMiddleHeight ?? 1200) - 100)
                            : Math.max(100, dragSession.startHeight - 100);
                        newBottomH = Math.min(maxB, Math.max(100, newTargetZ));
                        if (zCount === 3) {
                            const sumBM = (dragSession.startBottomHeight ?? 500) + (dragSession.startMiddleHeight ?? 1200);
                            newMiddleH = Math.max(100, sumBM - newBottomH);
                        }
                    } else if (dragSession.dividerType === 'MIDDLE') {
                        // W korpusie 3-strefowym: newTargetZ = bottomH + middleH
                        const minMidZ = (dragSession.startBottomHeight ?? 500) + 100;
                        const maxMidZ = dragSession.startHeight - 100;
                        const clampedZ = Math.min(maxMidZ, Math.max(minMidZ, newTargetZ));
                        newMiddleH = Math.max(100, clampedZ - (dragSession.startBottomHeight ?? 500));
                    }

                    if (newBottomH === dragSession.lastBottomHeight && newMiddleH === dragSession.lastMiddleHeight) {
                        return;
                    }
                    dragSession.lastBottomHeight = newBottomH;
                    dragSession.lastMiddleHeight = newMiddleH;

                    const divZ = dragSession.dividerType === 'MIDDLE' ? (newBottomH + newMiddleH) : newBottomH;
                    this._updateCornerDragBadge(divZ, dragSession.sphere, '#fb923c');

                    const cabMod = getCabinetModule();
                    cabMod?.applyRealtimeUpdate?.(doc, {
                        szerokosc_mm: dragSession.startWidth,
                        wysokosc_mm: dragSession.startHeight,
                        glebokosc_mm: dragSession.startDepth,
                        liczba_stref: zCount,
                        wysokosc_strefy_dolnej_mm: newBottomH,
                        wysokosc_strefy_srodkowej_mm: zCount === 3 ? newMiddleH : undefined,
                    }, container);

                    if (view.mesh.parent && typeof view.mesh.parent.computeWorldMatrix === 'function') {
                        view.mesh.parent.computeWorldMatrix(true);
                    }
                    view.mesh.computeWorldMatrix(true);
                    const curWorldMat = view.mesh.getWorldMatrix();

                    // Aktualizuj pozycje sfer
                    for (const s of this.activeFaceGizmoSpheres) {
                        if (!s.metadata?.isCornerGizmo || s.metadata?.containerId !== container.id) continue;
                        if (s.metadata.isZoneGizmo) {
                            const divZ = s.metadata.dividerType === 'MIDDLE' ? (newBottomH + newMiddleH) : newBottomH;
                            const lx = (s.metadata.sx ?? 1) * (dragSession.startWidth / 2);
                            const lz = (s.metadata.sz ?? -1) * (dragSession.startDepth / 2);
                            const p = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(lx, divZ, lz), curWorldMat);
                            s.position.copyFrom(p);
                        }
                    }
                    return;
                }

                if (!dragSession.lockedAxis || distPx < 16) {
                    const nextAxis = detectAxisFromPointer(dragSession, dxPx, dyPx);
                    if (nextAxis !== dragSession.lockedAxis) {
                        dragSession.lockedAxis = nextAxis;
                        const guideAxis = nextAxis === 'X' ? axisX : nextAxis === 'Y' ? axisY : axisZ;
                        const guideColor = nextAxis === 'X'
                            ? new BABYLON.Color3(0.95, 0.2, 0.2)
                            : nextAxis === 'Y'
                                ? new BABYLON.Color3(0.15, 0.55, 1.0)
                                : new BABYLON.Color3(0.15, 0.85, 0.3);
                        this._showDragGuideLine(viewport.scene, dragSession.startSpherePos, guideAxis, guideColor);
                    }
                }

                let newWidth = dragSession.startWidth;
                let newHeight = dragSession.startHeight;
                let newDepth = dragSession.startDepth;
                let newHeightLeft = dragSession.startHeightLeft ?? 1000;
                let newHeightRight = dragSession.startHeightRight ?? dragSession.startHeight;
                let newHeightFront = dragSession.startHeightFront ?? dragSession.startHeight;
                let newHeightBack = dragSession.startHeightBack ?? 1000;
                let localShiftX_mm = 0;
                let localShiftY_cad_mm = 0;
                let localShiftZ_cad_mm = 0;

                if (dragSession.lockedAxis === 'X') {
                    const deltaX = Math.round(this._projectPointerRayOntoAxis(viewport.scene, dragSession.startSpherePos, axisX) ?? 0);
                    newWidth = Math.max(150, dragSession.startWidth + dragSession.sx * deltaX);
                    const dW = newWidth - dragSession.startWidth;
                    localShiftX_mm = dragSession.sx * (dW / 2);
                } else if (dragSession.lockedAxis === 'Y') {
                    let deltaY = Math.round(this._projectPointerRayOntoAxis(viewport.scene, dragSession.startSpherePos, axisY) ?? 0);
                    const startCornerZMm = Math.round(dragSession.startSpherePos.y);
                    const rawCornerZMm = startCornerZMm + deltaY;

                    // Sprawdź przyciąganie (snap) do płaszczyzn poziomów Z (DATUM_LEVEL) oraz górnego czubka osi Z (glcNode) w GLC
                    let snappedLevel: any = null;
                    let bestDist = 50; // Promień przyciągania [mm]
                    const glcNode = doc.getGlcNode?.();
                    if (glcNode) {
                        const candidates: Array<{ node: any; zMm: number }> = [];
                        if ((glcNode.domainData as any)?.showAxisZ !== false) {
                            const tipZ_nm = (glcNode.domainData as any)?.tipZ_nm;
                            const axisZ_nm = (glcNode.domainData as any)?.axisZHeight_nm;
                            const tipZMm = typeof tipZ_nm === 'number' && tipZ_nm > 0
                                ? Math.round(nmToMm(tipZ_nm))
                                : (typeof axisZ_nm === 'number' && axisZ_nm > 0 ? Math.round(nmToMm(axisZ_nm)) + 30 : 2430);
                            candidates.push({ node: glcNode, zMm: tipZMm });
                        }
                        if (Array.isArray(glcNode.children)) {
                            for (const child of glcNode.children) {
                                if (child.nodeType !== NodeType.DATUM_LEVEL) continue;
                                if ((child.domainData as any)?.visible === false) continue;
                                const z_nm = (child.domainData as any)?.z_nm ?? child.localMatrix?.getTranslation?.()?.z ?? 0;
                                const levelZMm = Math.max(50, Math.round(nmToMm(z_nm)));
                                candidates.push({ node: child, zMm: levelZMm });
                            }
                        }
                        for (const cand of candidates) {
                            const d = Math.abs(rawCornerZMm - cand.zMm);
                            if (d <= bestDist) {
                                bestDist = d;
                                snappedLevel = cand.node;
                                deltaY = cand.zMm - startCornerZMm;
                            }
                        }
                    }
                    dragSession.snappedLevelNode = snappedLevel;
                    if (typeof window !== 'undefined') {
                        (window as any).__glcAxis?.highlightLevelPlane?.(snappedLevel?.id ?? null);
                    }

                    if (dragSession.isSkosny && dragSession.sy === 1) {
                        if (dragSession.isSkosnyLr) {
                            if (dragSession.sx === -1) {
                                newHeightLeft = Math.max(100, (dragSession.startHeightLeft ?? 1000) + deltaY);
                                newHeightRight = dragSession.startHeightRight ?? dragSession.startHeight;
                            } else {
                                newHeightRight = Math.max(100, (dragSession.startHeightRight ?? dragSession.startHeight) + deltaY);
                                newHeightLeft = dragSession.startHeightLeft ?? 1000;
                            }
                            newHeight = Math.max(newHeightLeft, newHeightRight);
                        } else if (dragSession.isSkosnyDach) {
                            if (dragSession.sz === -1) {
                                newHeightFront = Math.max(100, (dragSession.startHeightFront ?? dragSession.startHeight) + deltaY);
                                newHeightBack = dragSession.startHeightBack ?? 1000;
                            } else {
                                newHeightBack = Math.max(100, (dragSession.startHeightBack ?? 1000) + deltaY);
                                newHeightFront = dragSession.startHeightFront ?? dragSession.startHeight;
                            }
                            newHeight = Math.max(newHeightFront, newHeightBack);
                        }
                    } else {
                        newHeight = Math.max(150, dragSession.startHeight + dragSession.sy * deltaY);
                        const dH = newHeight - dragSession.startHeight;
                        localShiftZ_cad_mm = dragSession.sy === -1 ? -dH : 0;
                    }
                } else if (dragSession.lockedAxis === 'Z') {
                    const deltaZ = Math.round(this._projectPointerRayOntoAxis(viewport.scene, dragSession.startSpherePos, axisZ) ?? 0);
                    newDepth = Math.max(150, dragSession.startDepth + dragSession.sz * deltaZ);
                    const dD = newDepth - dragSession.startDepth;
                    localShiftY_cad_mm = dragSession.sz * (dD / 2);
                }

                if (
                    newWidth === dragSession.lastWidth &&
                    newHeight === dragSession.lastHeight &&
                    newDepth === dragSession.lastDepth &&
                    newHeightLeft === dragSession.lastHeightLeft &&
                    newHeightRight === dragSession.lastHeightRight &&
                    newHeightFront === dragSession.lastHeightFront &&
                    newHeightBack === dragSession.lastHeightBack
                ) {
                    return;
                }
                dragSession.lastWidth = newWidth;
                dragSession.lastHeight = newHeight;
                dragSession.lastDepth = newDepth;
                dragSession.lastHeightLeft = newHeightLeft;
                dragSession.lastHeightRight = newHeightRight;
                dragSession.lastHeightFront = newHeightFront;
                dragSession.lastHeightBack = newHeightBack;

                if (dragSession.lockedAxis === 'X') {
                    this._updateCornerDragBadge(newWidth, dragSession.sphere, '#ef4444');
                } else if (dragSession.lockedAxis === 'Y') {
                    const displayH = dragSession.isSkosny && dragSession.sy === 1
                        ? (dragSession.isSkosnyLr
                            ? (dragSession.sx === -1 ? newHeightLeft : newHeightRight)
                            : (dragSession.sz === -1 ? newHeightFront : newHeightBack))
                        : newHeight;
                    this._updateCornerDragBadge(displayH, dragSession.sphere, '#38bdf8');
                } else if (dragSession.lockedAxis === 'Z') {
                    this._updateCornerDragBadge(newDepth, dragSession.sphere, '#22c55e');
                }

                // Przesuń kontener tak, aby przeciwległy bok/narożnik pozostał zakotwiczony w miejscu
                if (dragSession.cadNode && dragSession.startDecomposed) {
                    const { translation: startTransNm, rotation: startRot, scale: startScale } = dragSession.startDecomposed;
                    const localShiftNm = new Vec3(
                        mmToNm(localShiftX_mm),
                        mmToNm(localShiftY_cad_mm),
                        mmToNm(localShiftZ_cad_mm)
                    );
                    const worldShiftNm = startRot.rotateVec3(localShiftNm);
                    const newTransNm = startTransNm.add(worldShiftNm);
                    dragSession.cadNode.setLocalTransform(newTransNm, startRot, startScale);
                    ContextManager.instance.sceneSyncAdapter?.syncNodeToMesh?.(container.id);
                }

                const cabMod = getCabinetModule();
                cabMod?.applyRealtimeUpdate?.(doc, {
                    szerokosc_mm: newWidth,
                    wysokosc_mm: newHeight,
                    glebokosc_mm: newDepth,
                    liczba_stref: zCount,
                    wysokosc_strefy_dolnej_mm: zCount === 1 ? newHeight : container.generatorParams?.wysokosc_strefy_dolnej_mm,
                    wysokosc_strefy_srodkowej_mm: zCount === 3 ? container.generatorParams?.wysokosc_strefy_srodkowej_mm : undefined,
                    ...(dragSession.isSkosnyLr ? { wysokosc_lewy_mm: newHeightLeft, wysokosc_prawy_mm: newHeightRight } : {}),
                    ...(dragSession.isSkosnyDach ? { wysokosc_przod_mm: newHeightFront, wysokosc_tyl_mm: newHeightBack } : {}),
                }, container);

                if (view.mesh.parent && typeof view.mesh.parent.computeWorldMatrix === 'function') {
                    view.mesh.parent.computeWorldMatrix(true);
                }
                view.mesh.computeWorldMatrix(true);
                const curWorldMat = view.mesh.getWorldMatrix();

                // Aktualizuj pozycje wszystkich 8 sfer na bieżąco
                for (const s of this.activeFaceGizmoSpheres) {
                    if (!s.metadata?.isCornerGizmo || s.metadata?.containerId !== container.id) continue;
                    const lx = (s.metadata.sx ?? 1) * (newWidth / 2);
                    let ly = 0;
                    if ((s.metadata.sy ?? 1) === 1) {
                        if (dragSession.isSkosnyLr) {
                            ly = (s.metadata.sx ?? 1) === -1 ? newHeightLeft : newHeightRight;
                        } else if (dragSession.isSkosnyDach) {
                            ly = (s.metadata.sz ?? -1) === -1 ? newHeightFront : newHeightBack;
                        } else {
                            ly = newHeight;
                        }
                    }
                    const lz = (s.metadata.sz ?? -1) * (newDepth / 2);
                    const p = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(lx, ly, lz), curWorldMat);
                    s.position.copyFrom(p);
                }
            } else if (type === BABYLON.PointerEventTypes.POINTERUP) {
                if (!dragSession) return;
                const session = dragSession;
                dragSession = null;
                this.isDraggingFaceGizmo = false;
                this.isDraggingCornerGizmo = false;
                this._disposeDragGuideLine();
                if (typeof window !== 'undefined') {
                    (window as any).__glcAxis?.highlightLevelPlane?.(null);
                }

                if (viewport.camera && viewport.canvas) {
                    viewport.camera.attachControl(viewport.canvas, true);
                }

                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('cad-edit-entity', {
                        detail: { entityId: container.id, kind: 'korpus' }
                    }));
                }
                if (session.hasDragged) {
                    // Jeśli narożnik został dociągnięty (zassnapowany) do płaszczyzny DATUM_LEVEL -> dodaj/zaktualizuj relację VERTEX_DATUM
                    if (session.lockedAxis === 'Y' && session.snappedLevelNode && session.cadNode && !session.isZoneGizmo) {
                        const targetTopBit = session.cornerIdx & 4;
                        let cornerYMm = 0;
                        if (targetTopBit) {
                            if (session.isSkosnyLr) {
                                cornerYMm = session.sx === -1 ? (session.lastHeightLeft ?? session.lastHeight) : (session.lastHeightRight ?? session.lastHeight);
                            } else if (session.isSkosnyDach) {
                                cornerYMm = session.sz === -1 ? (session.lastHeightFront ?? session.lastHeight) : (session.lastHeightBack ?? session.lastHeight);
                            } else {
                                cornerYMm = session.lastHeight;
                            }
                        }
                        const cornerPt = resolveCornerLocalMm(session.cadNode, session.cornerIdx) ?? [
                            0,
                            0,
                            cornerYMm,
                        ];
                        const anchorA = makeAnchor({
                            nodeId: session.cadNode.id,
                            kind: 'VERTEX',
                            cornerIndex: session.cornerIdx,
                            sourceNodeId: undefined,
                            localPointMm: cornerPt,
                        });
                        const anchorB = makeDatumLevelAnchor(session.snappedLevelNode);

                        const existing = ConstraintStore.instance.constraints.find(
                            (c) =>
                                (c.bindType === 'VERTEX_DATUM' || c.bindType === 'VERTEX') &&
                                c.anchorA?.nodeId === session.cadNode.id &&
                                c.anchorA?.kind === 'VERTEX' &&
                                ((c.anchorA.cornerIndex ?? 0) & 4) === targetTopBit &&
                                c.anchorB?.kind === 'DATUM',
                        );
                        if (existing) {
                            ConstraintStore.instance.update(existing.id, {
                                bindType: 'VERTEX_DATUM',
                                enabled: true,
                                anchorA,
                                anchorB,
                                offsetMm: 0,
                            });
                        } else {
                            ConstraintStore.instance.add({
                                bindType: 'VERTEX_DATUM',
                                anchorA,
                                anchorB,
                                offsetMm: 0,
                            });
                        }
                        (ContextManager.instance as any)?.solverController?.solveNow?.();
                    } else if (session.isZoneGizmo && session.snappedLevelNode && session.cadNode) {
                        // Wieniec pośredni powiązany z poziomem Z (DATUM_LEVEL)
                        const containerBaseZ = session.startDecomposed
                            ? Math.round(nmToMm(session.startDecomposed.translation.z))
                            : 0;
                        const targetZMm = session.dividerType === 'MIDDLE'
                            ? (session.lastBottomHeight ?? 500) + (session.lastMiddleHeight ?? 1200)
                            : (session.lastBottomHeight ?? 500);

                        const isMiddle = session.dividerType === 'MIDDLE';
                        const zoneCornerIdx = isMiddle ? 16 : 8; // Wirtualne naroże/wieniec strefy
                        const anchorA = makeAnchor({
                            nodeId: session.cadNode.id,
                            kind: 'VERTEX',
                            cornerIndex: zoneCornerIdx,
                            sourceNodeId: undefined,
                            localPointMm: [0, 0, targetZMm],
                            faceName: isMiddle ? 'Wieniec górny strefy' : 'Wieniec dolny strefy',
                        });
                        const anchorB = makeDatumLevelAnchor(session.snappedLevelNode);

                        const existing = ConstraintStore.instance.constraints.find(
                            (c) =>
                                (c.bindType === 'VERTEX_DATUM' || c.bindType === 'VERTEX') &&
                                c.anchorA?.nodeId === session.cadNode.id &&
                                c.anchorA?.kind === 'VERTEX' &&
                                c.anchorA?.cornerIndex === zoneCornerIdx &&
                                c.anchorB?.kind === 'DATUM',
                        );
                        if (existing) {
                            ConstraintStore.instance.update(existing.id, {
                                bindType: 'VERTEX_DATUM',
                                enabled: true,
                                anchorA,
                                anchorB,
                                offsetMm: 0,
                            });
                        } else {
                            ConstraintStore.instance.add({
                                bindType: 'VERTEX_DATUM',
                                anchorA,
                                anchorB,
                                offsetMm: 0,
                            });
                        }
                        (ContextManager.instance as any)?.solverController?.solveNow?.();
                    }

                    // Po zakończeniu przeciągania -> odśwież widok i powiadom o zmianie projektu
                    const rebuild = (typeof window !== 'undefined') ? (window as any).__rebuildGeometry : null;
                    if (typeof rebuild === 'function') {
                        try { rebuild('SmartFrame corner resize'); } catch {}
                    }
                    doc.notifyDocumentChanged();
                    if (typeof window !== 'undefined' && window.document) {
                        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
                    }
                    this.updateFaceGizmo();
                }

                // Otwórz okienko wpisywania wartości dla aktywnego narożnika/strefy
                let cornerParamName = 'wysokosc_mm';
                let cornerValMm = session.lastHeight ?? session.startHeight;
                let colorHex = '#38bdf8'; // Blue for Z (height)

                if (session.lockedAxis === 'X') {
                    cornerParamName = 'szerokosc_mm';
                    cornerValMm = session.lastWidth ?? session.startWidth;
                    colorHex = '#f87171'; // Red for X (width)
                } else if (session.lockedAxis === 'Z') {
                    cornerParamName = 'glebokosc_mm';
                    cornerValMm = session.lastDepth ?? session.startDepth;
                    colorHex = '#4ade80'; // Green for Y cad (depth)
                } else {
                    // Y axis (CAD Z - Height / Zones / Slopes)
                    if (session.isZoneGizmo) {
                        cornerParamName = session.dividerType === 'BOTTOM'
                            ? 'wysokosc_strefy_dolnej_mm'
                            : 'wysokosc_strefy_srodkowej_mm';
                        cornerValMm = session.dividerType === 'BOTTOM'
                            ? (session.lastBottomHeight ?? session.startBottomHeight ?? 500)
                            : (session.lastMiddleHeight ?? session.startMiddleHeight ?? 1200);
                        colorHex = '#fb923c'; // Orange for zones
                    } else if (session.isSkosnyLr) {
                        cornerParamName = session.sx === -1 ? 'wysokosc_lewy_mm' : 'wysokosc_prawy_mm';
                        cornerValMm = session.sx === -1
                            ? (session.lastHeightLeft ?? session.startHeightLeft ?? session.lastHeight)
                            : (session.lastHeightRight ?? session.startHeightRight ?? session.lastHeight);
                    } else if (session.isSkosnyDach) {
                        cornerParamName = session.sz === -1 ? 'wysokosc_front_mm' : 'wysokosc_back_mm';
                        cornerValMm = session.sz === -1
                            ? (session.lastHeightFront ?? session.startHeightFront ?? session.lastHeight)
                            : (session.lastHeightBack ?? session.startHeightBack ?? session.lastHeight);
                    } else {
                        cornerParamName = 'wysokosc_mm';
                        cornerValMm = session.lastHeight ?? session.startHeight;
                    }
                }

                const targetSphere = session.isZoneGizmo
                    ? (this.activeFaceGizmoSpheres.find(s => s.metadata?.isZoneGizmo && s.metadata?.dividerType === session.dividerType && s.metadata?.cornerId === session.cornerId) || session.sphere)
                    : (this.activeFaceGizmoSpheres.find(s => s.metadata?.isCornerGizmo && !s.metadata?.isZoneGizmo && s.metadata?.cornerId === session.cornerId) || session.sphere);

                this.openFloatingInputForCorner({
                    container,
                    paramName: cornerParamName,
                    sphere: targetSphere,
                    valMm: cornerValMm,
                    colorHex
                });
            }
        });
    }

    private _updateCornerDragBadge(valMm: number, sphere: any, colorHex: string = '#fb923c'): void {
        const viewport = ContextManager.instance.viewport;
        if (!viewport || !viewport.scene || !viewport.canvas) return;
        const badge = document.getElementById('gizmo-floating-input');
        const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
        if (!badge || !input) return;

        badge.style.display = 'flex';
        badge.style.border = `1.5px solid ${colorHex}`;
        if (document.activeElement !== input) {
            input.value = Math.round(valMm).toString();
            input.style.width = `${Math.max(45, input.value.length * 9)}px`;
        }

        if (sphere?.computeWorldMatrix) {
            sphere.computeWorldMatrix(true);
        }
        const pos = sphere?.getAbsolutePosition ? sphere.getAbsolutePosition() : (sphere?.position ?? BABYLON.Vector3.Zero());
        const screenPos = BABYLON.Vector3.Project(
            pos,
            BABYLON.Matrix.Identity(),
            viewport.scene.getTransformMatrix(),
            viewport.scene.activeCamera.viewport.toGlobal(
                viewport.engine.getRenderWidth(),
                viewport.engine.getRenderHeight()
            )
        );

        if (screenPos.z < 0 || screenPos.z > 1) {
            badge.style.display = 'none';
            return;
        }

        const canvasRect = viewport.canvas.getBoundingClientRect();
        badge.style.left = `${canvasRect.left + screenPos.x + 20}px`;
        badge.style.top = `${canvasRect.top + screenPos.y - 45}px`;
    }

    public _resolveTargetMesh(entity: any): any {
        const viewport = ContextManager.instance.viewport;
        const panelViews = ContextManager.instance.panelViews;
        const containerViews = ContextManager.instance.containerViews;
        if (!entity || !viewport) {
            return null;
        }
        let node = panelViews.get(entity)?.root ||
            (entity?.id ? panelViews.get(entity.id)?.root : null) ||
            containerViews.get(entity)?.rootNode ||
            containerViews.get(entity)?.root;
        if (!node && entity?.id) {
            for (const [p, v] of panelViews || []) {
                if (p?.id === entity.id) {
                    node = v?.root;
                    break;
                }
            }
            if (!node) {
                for (const [c, v] of containerViews || []) {
                    if (c?.id === entity.id) {
                        node = v?.rootNode || v?.root;
                        break;
                    }
                }
            }
        }
        if (!node && entity.name) {
            node = viewport.scene.getNodeByName(entity.name);
        }
        return node;
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
        ContextManager.instance.modalTransformManager?.updateLiveValues();

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
        getConstraintDragPort()?.begin(ctx.doc, ctx.cadNodeId);
    }

    private _propagateConstraintDrag(): void {
        const ctx = this._resolveTransformTarget();
        if (!ctx) {
            return;
        }
        const port = getConstraintDragPort();
        port?.propagateTransform(ctx.doc, ctx.cadNodeId);
        const affected = port?.getAffectedNodeIds?.() ?? [ctx.cadNodeId];
        for (const id of affected) {
            ContextManager.instance.sceneSyncAdapter.syncNodeToMesh(id);
        }
    }

    private _commitConstraintDrag(activeEntity: any, label: string): void {
        const doc = ContextManager.instance.document;
        const cmdHist = ContextManager.instance.commandHistory;
        if (!doc) {
            this._finishConstraintDrag(activeEntity);
            return;
        }

        const cmds = getConstraintDragPort()?.buildTransformCommands(doc, label) ?? [];
        if (cmdHist && cmds.length > 0) {
            const syncIds = new Set<string>();
            for (const cmd of cmds) {
                const node = doc.findNode((cmd as any).nodeId);
                if (node && (node.domainData as any)?.type === 'container') {
                    syncIds.add((cmd as any).nodeId);
                }
            }
            const cabMod = getCabinetModule();
            const syncCmds = cabMod
                ? Array.from(syncIds).map((id) => cabMod.createSyncBackGroovesCommand(id))
                : [];
            const allCmds = [
                ...cmds,
                ...syncCmds,
            ];
            cmdHist.execute(allCmds.length === 1 ? allCmds[0] : new MacroCommand(allCmds, label));
        }

        this._finishConstraintDrag(activeEntity);
    }

    private _finishConstraintDrag(activeEntity: any): void {
        getConstraintDragPort()?.end();
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

    private _projectPointerRayOntoAxis(scene: any, startPos: any, axisDir: any): number | null {
        if (!scene || !scene.activeCamera) return null;
        const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, null, scene.activeCamera);
        if (!ray) return null;

        const O = ray.origin;
        const D = ray.direction;
        const P = startPos;
        const N = axisDir;

        const w0x = P.x - O.x;
        const w0y = P.y - O.y;
        const w0z = P.z - O.z;

        const b = D.x * N.x + D.y * N.y + D.z * N.z;
        const denom = 1.0 - b * b;
        if (Math.abs(denom) < 1e-4) {
            return null;
        }

        const d = D.x * w0x + D.y * w0y + D.z * w0z;
        const e = N.x * w0x + N.y * w0y + N.z * w0z;

        const s = (b * d - e) / denom;
        return isFinite(s) ? s : null;
    }

    private _showDragGuideLine(scene: any, startPos: any, axisDir: any, color: any): void {
        this._disposeDragGuideLine();
        if (!scene || !startPos || !axisDir) return;
        const p1 = startPos.subtract(axisDir.scale(800));
        const p2 = startPos.add(axisDir.scale(800));
        const builder = (BABYLON && BABYLON.MeshBuilder && BABYLON.MeshBuilder.CreateDashedLines)
            ? BABYLON.MeshBuilder.CreateDashedLines.bind(BABYLON.MeshBuilder)
            : BABYLON.MeshBuilder.CreateLines.bind(BABYLON.MeshBuilder);
        this.activeDragGuideLine = builder('gizmo_drag_guide_line', {
            points: [p1, p2],
            dashSize: 8,
            gapSize: 6,
            dashNb: 100,
            updatable: false
        }, scene);
        this.activeDragGuideLine.color = color || new BABYLON.Color3(1, 0.5, 0.1);
        this.activeDragGuideLine.alpha = 0.85;
        this.activeDragGuideLine.isPickable = false;
        this.activeDragGuideLine.renderingGroupId = 2;
    }

    private _disposeDragGuideLine(): void {
        if (this.activeDragGuideLine) {
            try { this.activeDragGuideLine.dispose(); } catch {}
            this.activeDragGuideLine = null;
        }
    }
}
