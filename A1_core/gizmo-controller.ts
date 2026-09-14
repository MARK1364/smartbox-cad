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
import { SyncBackGroovesCommand } from '../A3_smartframe/commands/sync-back-grooves-command.js';
import { ConstraintStore } from '../S2_solver/constraint-store.js';
import { ConstraintDragGroup } from '../S2_solver/constraint-drag-group.js';
import { CadTranslateGizmo } from './cad-translate-gizmo.js';

import { normalizeFaceName } from '../A4_smartpanel/panel-model.js';
import { readOffsetMm } from '../A3_smartframe/back-overlap.js';
import { findOwningKorpus } from '../A3_smartframe/korpus-offset-gizmo.js';
import { SetKorpusTopPanelConfigCommand, TopPanelMode } from '../A3_smartframe/commands/set-korpus-top-panel-config-command.js';
import { rebuildSmartFrameContainer } from '../A3_smartframe/smartframe-adapter.js';

declare const BABYLON: any;

const GIZMO_DRAG_MULTIPLIER = 1.0;

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
    private activeDragGuideLine: any = null;
    private matrixBeforeDrag: Mat4 | null = null;
    private activeTopPanelEntity: any = null;
    private activeTopPanelContainer: any = null;
    private isTopPanelWidgetOpen = false;
    private topPanelWidgetManualPos: { left: number; top: number } | null = null;

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
        'BACK_PANEL': { 'top': '-Y', 'bottom': '+Y', 'left': '-X', 'right': '+X', 'front': 'backOffset' }
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
        this.createTopPanelWidget();

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
                        let currentVal: number;
                        if (this.activeGizmoParamName === 'backOffset') {
                            currentVal = this.activeGizmoContainer.generatorParams.backOffset !== undefined
                                ? this.activeGizmoContainer.generatorParams.backOffset
                                : 3;
                        } else {
                            const activeEntity = ContextManager.instance.document?.activeEntity;
                            const role = (activeEntity as any)?.role;
                            currentVal = readOffsetMm(this.activeGizmoContainer.generatorParams?.offsets, this.activeGizmoParamName, role);
                        }
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

            if (this.activeTopPanelEntity && this.activeTopPanelContainer && this.isTopPanelWidgetOpen) {
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
            } else {
                const topWidget = document.getElementById('gizmo-top-panel-widget');
                if (topWidget && topWidget.style.display !== 'none') {
                    topWidget.style.display = 'none';
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

        badge.onmousedown = (e) => e.stopPropagation();
        badge.onpointerdown = (e) => e.stopPropagation();
        input.onmousedown = (e) => e.stopPropagation();
        input.onpointerdown = (e) => e.stopPropagation();

        this.initFloatingInputEvents(input, badge);
    }

    private openFloatingInput(sphere: any, paramName: string, container: any, role?: string): void {
        this.activeGizmoSphere = sphere;
        this.activeGizmoParamName = paramName;
        this.activeGizmoContainer = container;
        this.isEditingFaceGizmo = true;
        this.badgeFixedPos = null;

        const isBackOffset = paramName === 'backOffset';
        this.originalValueBeforeEdit = isBackOffset
            ? (container.generatorParams?.backOffset !== undefined ? container.generatorParams.backOffset : 3)
            : readOffsetMm(container.generatorParams?.offsets, paramName, role);

        const badge = document.getElementById('gizmo-floating-input');
        const input = document.getElementById('gizmo-input-field') as HTMLInputElement;
        if (badge && input) {
            badge.style.display = 'flex';
            input.value = this.originalValueBeforeEdit.toString();
            input.style.width = `${Math.max(45, input.value.length * 9)}px`;
            setTimeout(() => {
                input.focus();
                input.select();
            }, 50);
        }
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

            const isBackOffset = this.activeGizmoParamName === 'backOffset';
            if (isBackOffset) {
                this.activeGizmoContainer.generatorParams.backOffset = val;
            } else {
                if (!this.activeGizmoContainer.generatorParams.offsets) {
                    this.activeGizmoContainer.generatorParams.offsets = {};
                }
                this.activeGizmoContainer.generatorParams.offsets[this.activeGizmoParamName] = val;
            }

            const doc = ContextManager.instance.document;
            if (doc) {
                applyRealtimeUpdate(doc, {
                    width: nmToMm(this.activeGizmoContainer.width),
                    height: nmToMm(this.activeGizmoContainer.height),
                    depth: nmToMm(this.activeGizmoContainer.depth),
                    zoneCount: this.activeGizmoContainer.generatorParams.zoneCount || 1,
                    bottomHeight: this.activeGizmoContainer.generatorParams.bottomHeight || 500,
                    middleHeight: this.activeGizmoContainer.generatorParams.middleHeight || 1200,
                    backOffset: this.activeGizmoContainer.generatorParams.backOffset !== undefined ? this.activeGizmoContainer.generatorParams.backOffset : 3,
                    offsets: this.activeGizmoContainer.generatorParams.offsets || {}
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
                    const isBackOffset = this.activeGizmoParamName === 'backOffset';
                    if (isBackOffset) {
                        this.activeGizmoContainer.generatorParams.backOffset = this.originalValueBeforeEdit;
                    } else {
                        if (!this.activeGizmoContainer.generatorParams.offsets) {
                            this.activeGizmoContainer.generatorParams.offsets = {};
                        }
                        this.activeGizmoContainer.generatorParams.offsets[this.activeGizmoParamName] = this.originalValueBeforeEdit;
                    }
                    const doc = ContextManager.instance.document;
                    if (doc) {
                        applyRealtimeUpdate(doc, {
                            width: nmToMm(this.activeGizmoContainer.width),
                            height: nmToMm(this.activeGizmoContainer.height),
                            depth: nmToMm(this.activeGizmoContainer.depth),
                            zoneCount: this.activeGizmoContainer.generatorParams.zoneCount || 1,
                            bottomHeight: this.activeGizmoContainer.generatorParams.bottomHeight || 500,
                            middleHeight: this.activeGizmoContainer.generatorParams.middleHeight || 1200,
                            backOffset: this.activeGizmoContainer.generatorParams.backOffset !== undefined ? this.activeGizmoContainer.generatorParams.backOffset : 3,
                            offsets: this.activeGizmoContainer.generatorParams.offsets || {}
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

        const cmd = new SetKorpusTopPanelConfigCommand(
            container.id,
            { mode: curMode, width: curWidth },
            { mode: newMode, width: curWidth }
        );
        const hist = ContextManager.instance.commandHistory;
        if (hist) {
            hist.execute(cmd);
        } else {
            if (!container.generatorParams) container.generatorParams = {};
            container.generatorParams.topPanelMode = newMode;
            container.generatorParams.traverseWidth = curWidth;
            rebuildSmartFrameContainer(container);
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

        const cmd = new SetKorpusTopPanelConfigCommand(
            container.id,
            { mode: curMode, width: curWidth },
            { mode: curMode, width: newWidth }
        );
        const hist = ContextManager.instance.commandHistory;
        if (hist) {
            hist.execute(cmd);
        } else {
            if (!container.generatorParams) container.generatorParams = {};
            container.generatorParams.topPanelMode = curMode;
            container.generatorParams.traverseWidth = newWidth;
            rebuildSmartFrameContainer(container);
        }
        setTimeout(() => {
            this.updateFaceGizmo();
        }, 60);
    }

    public clearFaceGizmos(): void {
        for (const sphere of this.activeFaceGizmoSpheres) {
            try { sphere.dispose(); } catch {}
        }
        this.activeFaceGizmoSpheres = [];

        this.activeTopPanelEntity = null;
        this.activeTopPanelContainer = null;
        this.isTopPanelWidgetOpen = false;
        this.topPanelWidgetManualPos = null;
        const topWidget = document.getElementById('gizmo-top-panel-widget');
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

        if (activeEntity.type === 'container') {
            return;
        }

        const targetEntity = activeEntity;
        const view = panelViews.get(targetEntity);
        if (!view || !view.faceMeshes) return;

        const role = (targetEntity as any).role;
        if (!role || !this.pushPullMapping[role]) return;

        const mapping = this.pushPullMapping[role];
        const rawContainer: any = doc.getContainers()[0];
        const container: any = rawContainer?.domainData || rawContainer;
        if (!container || !container.generatorParams) return;

        const panelName = targetEntity.name;

        if (role === 'TOP_PANEL' || role.includes('TOP')) {
            const owningKorpus = findOwningKorpus(doc, targetEntity.id) || container;
            if (owningKorpus) {
                this.activeTopPanelEntity = targetEntity;
                this.activeTopPanelContainer = owningKorpus;
                if (this.isTopPanelWidgetOpen) {
                    this.updateTopPanelWidgetUI();
                }
            }
        }

        for (const [faceName, suffix] of Object.entries(mapping)) {
            const paramName = suffix === 'backOffset' ? 'backOffset' : `${panelName}_${suffix}`;
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

                // Centralna kulka przesuwania na środku płyty (front/back/shift/backOffset) -> ZAWSZE NIEBIESKA i W ŚRODKU LCS FORMATKI
                const isCenterPlane = faceName === 'front' || faceName === 'back' || paramName.includes('shift') || paramName === 'backOffset';

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

                const dragBehavior = new BABYLON.PointerDragBehavior({
                    dragAxis: normal
                });
                dragBehavior.dragDeltaRatio = GIZMO_DRAG_MULTIPLIER;

                let originalValue = 0;
                let startPos: any = null;

                dragBehavior.onDragStartObservable.add(() => {
                    this.isDraggingFaceGizmo = true;
                    this.activeGizmoSphere = sphere;
                    this.activeGizmoParamName = paramName;
                    this.activeGizmoContainer = container;
                    const c = container as any;
                    if (paramName === 'backOffset') {
                        this.originalValueBeforeEdit = c.generatorParams.backOffset !== undefined ? c.generatorParams.backOffset : 3;
                    } else {
                        this.originalValueBeforeEdit = readOffsetMm(c.generatorParams?.offsets, paramName, role);
                    }

                    viewport.camera.detachControl();
                    originalValue = this.originalValueBeforeEdit;
                    sphere.setParent(null);
                    startPos = sphere.position.clone();
                    this._showDragGuideLine(viewport.scene, startPos, normal, diffuseColor);
                });

                dragBehavior.onDragObservable.add(() => {
                    const c = container as any;
                    const projDist = this._projectPointerRayOntoAxis(viewport.scene, startPos, normal);
                    let delta = 0;
                    if (projDist !== null) {
                        delta = Math.round(projDist);
                    } else {
                        const diffVec = sphere.position.subtract(startPos);
                        delta = Math.round(BABYLON.Vector3.Dot(diffVec, normal));
                    }

                    // Precyzyjnie przypnij pozycję kulki do poruszającej się krawędzi formatki
                    sphere.position.copyFrom(startPos.add(normal.scale(delta)));

                    if (paramName === 'backOffset') {
                        const newValue = Math.max(0, originalValue + delta);
                        if (c.generatorParams.backOffset === newValue) return;
                        c.generatorParams.backOffset = newValue;

                        applyRealtimeUpdate(doc, {
                            width: nmToMm(c.width),
                            height: nmToMm(c.height),
                            depth: nmToMm(c.depth),
                            zoneCount: c.generatorParams.zoneCount || 1,
                            bottomHeight: c.generatorParams.bottomHeight || 500,
                            middleHeight: c.generatorParams.middleHeight || 1200,
                            backOffset: newValue,
                            offsets: c.generatorParams.offsets || {}
                        });
                        return;
                    }

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
                        backOffset: c.generatorParams.backOffset !== undefined ? c.generatorParams.backOffset : 3,
                        offsets: c.generatorParams.offsets
                    });
                });

                dragBehavior.onDragEndObservable.add(() => {
                    this._disposeDragGuideLine();
                    this.isDraggingFaceGizmo = false;
                    viewport.camera.attachControl(viewport.canvas, true);
                    
                    const lastParam = this.activeGizmoParamName;
                    const lastContainer = this.activeGizmoContainer;
                    
                    this.updateFaceGizmo();
                    
                    if (lastParam && lastContainer) {
                        const newSphere = this.activeFaceGizmoSpheres.find(s => s.metadata?.paramName === lastParam);
                        if (newSphere) {
                            this.openFloatingInput(newSphere, lastParam, lastContainer, role);
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
                    // Plecy mają już dedykowane niebieskie gizmo dla backOffset (brak duplikatu shiftY)
                    shiftParam = '';
                }

                if (shiftParam) {
                    const paramName = `${panelName}_${shiftParam}`;
                    
                    view.root.computeWorldMatrix(true);
                    const worldPos = view.root.getAbsolutePosition ? view.root.getAbsolutePosition().clone() : view.root.position.clone();
                    
                    const centerSphere = BABYLON.MeshBuilder.CreateSphere(`faceGizmoSphere_center`, { diameter: 24 }, viewport.scene);
                    centerSphere.metadata = { paramName: paramName };
                    centerSphere.position.copyFrom(worldPos);
                    centerSphere.setParent(view.root);
                    
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
                    centerDrag.dragDeltaRatio = GIZMO_DRAG_MULTIPLIER;
                    
                    let originalValue = 0;
                    let startPos: any = null;
                    
                    centerDrag.onDragStartObservable.add(() => {
                        this.isDraggingFaceGizmo = true;
                        this.activeGizmoSphere = centerSphere;
                        this.activeGizmoParamName = paramName;
                        this.activeGizmoContainer = container;
                        const c = container as any;
                        this.originalValueBeforeEdit = readOffsetMm(c.generatorParams?.offsets, paramName, role);

                        viewport.camera.detachControl();
                        originalValue = this.originalValueBeforeEdit;
                        centerSphere.setParent(null);
                        startPos = centerSphere.position.clone();
                        this._showDragGuideLine(viewport.scene, startPos, shiftAxis, diffuseColor);
                    });

                    centerDrag.onDragObservable.add(() => {
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

                        c.generatorParams.offsets[paramName] = newValue;

                        applyRealtimeUpdate(doc, {
                            width: nmToMm(c.width),
                            height: nmToMm(c.height),
                            depth: nmToMm(c.depth),
                            zoneCount: c.generatorParams.zoneCount || 1,
                            bottomHeight: c.generatorParams.bottomHeight || 500,
                            middleHeight: c.generatorParams.middleHeight || 1200,
                            backOffset: c.generatorParams.backOffset !== undefined ? c.generatorParams.backOffset : 3,
                            offsets: c.generatorParams.offsets
                        });
                    });

                    centerDrag.onDragEndObservable.add(() => {
                        this._disposeDragGuideLine();
                        this.isDraggingFaceGizmo = false;
                        viewport.camera.attachControl(viewport.canvas, true);
                        
                        const lastParam = this.activeGizmoParamName;
                        const lastContainer = this.activeGizmoContainer;
                        this.updateFaceGizmo();
                        
                        if (lastParam && lastContainer) {
                            const newSphere = this.activeFaceGizmoSpheres.find(s => s.metadata?.paramName === lastParam);
                            if (newSphere) {
                                this.openFloatingInput(newSphere, lastParam, lastContainer, role);
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
                        const topCube = BABYLON.MeshBuilder.CreateBox(
                            'faceGizmo_topPanelConfigCube',
                            { size: 18 },
                            viewport.scene
                        );
                        topCube.metadata = { isTopConfigCube: true };
                        topCube.position.copyFrom(worldPos);
                        topCube.setParent(view.root);
                        // Odsunięcie w osi lokalnej X (wzdłuż usłojenia formatki) obok niebieskiej kuli move (+34 mm)
                        topCube.position = new BABYLON.Vector3(34, 0, 0);

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
