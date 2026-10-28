/**
 * PMI Dimension Tool — TypeScript / Babylon.js
 *
 * Narzędzie interaktywne do wymiarowania CAD.
 *
 * Wspiera 2 tryby pracy:
 * 1. KLIKNIĘCIE KRAWĘDZI (Edge-based):
 *    Kliknięcie w krawędź formatki (lub blisko brzegu ściany) natychmiast
 *    ustala oba punkty odcinka (p1, p2) i przechodzi do przeciągania
 *    odsunięcia (DRAG_OFFSET). Ruch myszy wyciąga linię wymiarową i pomocnicze!
 *    LMB zatwierdza wymiar na scenie.
 *    W fazie odsunięcia widać jednocześnie osie GLOBAL (ciągłe) i LOCAL
 *    (przerywane). Kierunek wybiera się najazdem na prowadnicę.
 *
 * 2. KLIKNIĘCIE PUNKT-DO-PUNKTU (Point-to-point):
 *    Kliknięcie w wierzchołek lub punkt ściany -> wybór punktu 1 -> wybór punktu 2
 *    -> przeciągnięcie odsunięcia -> LMB zatwierdza.
 *
 * SKRÓTY:
 *   X / Y / Z              — wymuszenie osi odsunięcia
 *   Shift + X / Y / Z      — zablokowanie osi pomiaru
 *   G / L                  — przełączenie układu osi: Globalny (ortogonalny) / Lokalny
 *   Enter / LMB            — zatwierdzenie
 *   RMB                    — małe menu X / Y / Z: wymuszenie osi pomiaru (np. poziomo przy skosie)
 *   Esc                    — krok wstecz, a z pustego stanu wyjście z narzędzia
 */

declare const BABYLON: any;

import { BaseState } from '../A1_core/interaction/states/base-state';
import { Intent } from '../A1_core/interaction/interaction-types';
import type { CadModuleContext } from '../A1_core/cad-module-context.js';
import { StateMachine } from '../A1_core/interaction/state-machine';
import { Vec3, v3, v3Copy, v3Sub, v3Normalize, v3Len, v3Dot } from './dimension-solver';
import { getRenderData, resolveMeasureAxis, computeAvailableMeasureAxes, isOffsetAxisAllowedAlgebraic } from './pmi-bridge';
import { axisVectorWorld, beginOffsetDragState, computeOffsetFromPointer } from './pmi-drag';
import { PMIAxisGuides, axisGuideOrigin, buildOffsetGuideCandidates, estimateGuideLength, guideCandidateId } from './pmi-axis-guides.js';
import { pickOffsetGuide, createWorldToScreen } from './pmi-axis-guide-pick.js';
import { PMIStore, formatDistance, AxisSpace, MeasureAxisKey } from './pmi-data';
import { PMIRenderer } from './pmi-renderer';
import { AddDimensionCommand, executePMICommand, deleteActiveDimension } from './pmi-commands';
import {
    PMIAnchorRef,
    buildAnchorRef,
    directionToLocal,
    freeAnchorRef,
    getWorldMatrixArray,
    isPmiOverlayMesh,
    localToWorldFromBrep,
    meshLocalToRootLocal,
    planeNormalWorldFromMesh,
    resolveBrepGeometryPick,
    resolveFaceHelperWorlds,
    snapToNearestEdgeEndpoint,
    tryBuildEdgeAnchorsFromRootPoints,
} from './pmi-id-bridge';
import { storeOffsetFromWorld } from './pmi-resolve';
import { UIController } from '../A1_core/ui-controller';
import { TooltipManager } from '../A1_core/tooltip-manager.js';
import { DetectionResult, GeometryType } from '../A1_core/geometry-detector.js';
import { PMIGeometryHighlighter } from './pmi-geometry-highlight.js';
import { setSelectionHighlightSuppressed } from '../A1_core/selection-highlight.js';
import { findEdgeSegmentsNearPointer, findVerticesNearPointer } from './pmi-edge-pick.js';
import { tx } from '../T1_tlumaczenia/core.js';
import pmiTekst from './pmi_tekst.json';
import { ContextMenu, type CtxMenuItem } from '../A1_core/context-menu.js';
import { ContextManager } from '../A1_core/context-manager.js';

// ============================================================================
// TYPES
// ============================================================================

type ToolPhase = 'PICK_P1' | 'PICK_P2' | 'DRAG_OFFSET';

interface PickPoint {
    worldPos: Vec3;
    anchor: PMIAnchorRef;
    edgeDirWorld: Vec3 | null;
    faceNormalWorld: Vec3 | null;
    meshMatrix: number[] | null;
}

interface DetectedEdge {
    p1: PickPoint;
    p2: PickPoint;
}

const AXIS_KEYS = ['X', 'Y', 'Z'] as const;

// ============================================================================
// DIMENSION TOOL
// ============================================================================

export class DimensionTool extends BaseState {
    private phase: ToolPhase = 'PICK_P1';
    private renderer: PMIRenderer;

    private pick1: PickPoint | null = null;
    private pick2: PickPoint | null = null;
    private currentOffset: Vec3 = v3(0, 0, 0);
    private currentAxisSpace: AxisSpace = 'GLOBAL';
    private currentMeasureAxisKey: MeasureAxisKey = 'AUTO';
    private currentOffsetAxisKey: string = '';
    private stickyGuideId: string | null = null;

    /** Kotwica drag offsetu. */
    private dragStartHitWorld: Vec3 | null = null;
    private dragStartOffsetWorld: Vec3 = v3(0, 0, 0);
    private freeDragBiasWorld: Vec3 = v3(0, 0, 0);

    /** Czy oś pomiaru została wskazana ręcznie (Shift+X/Y/Z) — blokuje autodetekcję. */
    private measureAxisLocked = false;

    private lastClickTime = 0;
    private static readonly DOUBLE_CLICK_MS = 350;

    /** Ctrl = precyzyjny wybór narożnika / krawędzi / płaszczyzny. */
    private isCtrlPressed = false;

    private geometryHighlighter: PMIGeometryHighlighter | null = null;
    private facePickerWasEnabled = true;

    // Babylon observers
    private pointerObserver: any = null;
    private keyboardObserver: any = null;

    // Visual snap indicator & live preview
    private liveGuideLine: any = null;
    private axisGuides: PMIAxisGuides | null = null;
    private contextMenu: ContextMenu | null = null;

    constructor(ctx: CadModuleContext, stateMachine: StateMachine, renderer: PMIRenderer) {
        super(ctx, stateMachine);
        this.renderer = renderer;
    }

    // ========================================================================
    // STATE LIFECYCLE
    // ========================================================================

    private handleWindowKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Control' || e.ctrlKey || e.metaKey || e.key === 'Meta') {
            this.isCtrlPressed = true;
            if (this.phase === 'PICK_P2') {
                this.updateHint();
            }
            this.onPointerMove();
        }
    };

    private handleWindowKeyUp = (e: KeyboardEvent) => {
        if (!e.ctrlKey && !e.metaKey) {
            this.isCtrlPressed = false;
            if (this.phase === 'PICK_P2') {
                this.updateHint();
            }
            this.onPointerMove();
        }
    };

    private handleWindowBlur = () => {
        this.isCtrlPressed = false;
        if (this.phase === 'PICK_P2') {
            this.updateHint();
        }
        this.onPointerMove();
    };

    public onEnter(): void {
        const store = PMIStore.instance;
        this.currentAxisSpace = store.toolAxisSpace === 'ALIGNED' ? 'ALIGNED' : 'GLOBAL';
        this.currentMeasureAxisKey = store.toolMeasureAxis;
        this.measureAxisLocked = store.toolMeasureAxis !== 'AUTO';
        this.resetPicks();

        this.updateHint();
        this.setUIStatus('Wymiarowanie (PMI)');

        const scene = this.ctx.viewport.scene;
        this.geometryHighlighter = new PMIGeometryHighlighter(scene);

        if (this.ctx.facePicker) {
            this.facePickerWasEnabled = this.ctx.facePicker.enabled;
            this.ctx.facePicker.enabled = false;
            this.ctx.facePicker.resetAllFaceHighlights();
        }
        setSelectionHighlightSuppressed(true, this.ctx);

        // Rejestracja wyłącznie POINTERMOVE do płynnego śledzenia kursora i podglądu na żywo
        this.pointerObserver = scene.onPointerObservable.add((pointerInfo: any) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                if (pointerInfo.event) {
                    this.isCtrlPressed = !!(pointerInfo.event.ctrlKey || pointerInfo.event.metaKey);
                }
                this.onPointerMove();
            }
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                if (pointerInfo.event) {
                    this.isCtrlPressed = !!(pointerInfo.event.ctrlKey || pointerInfo.event.metaKey);
                }
            }
        });

        this.keyboardObserver = scene.onKeyboardObservable.add((keyboardInfo: any) => {
            const event = keyboardInfo.event as KeyboardEvent;
            if (keyboardInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                this.isCtrlPressed = !!(event.ctrlKey || event.metaKey);
                this.onKeyDown(event);
            } else if (keyboardInfo.type === BABYLON.KeyboardEventTypes.KEYUP) {
                this.isCtrlPressed = !!(event.ctrlKey || event.metaKey);
            }
        });

        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this.handleWindowKeyDown);
            window.addEventListener('keyup', this.handleWindowKeyUp);
            window.addEventListener('blur', this.handleWindowBlur);
        }

        if (this.ctx.viewport) this.ctx.viewport.suppressDoubleTapZoom = true;
        if (this.ctx.canvas) {
            this.ctx.canvas.style.cursor = 'crosshair';
        }
    }

    public onExit(): void {
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this.handleWindowKeyDown);
            window.removeEventListener('keyup', this.handleWindowKeyUp);
            window.removeEventListener('blur', this.handleWindowBlur);
        }

        const scene = this.ctx.viewport.scene;
        if (this.pointerObserver) {
            scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }
        if (this.keyboardObserver) {
            scene.onKeyboardObservable.remove(this.keyboardObserver);
            this.keyboardObserver = null;
        }

        this.geometryHighlighter?.dispose();
        this.geometryHighlighter = null;
        this.disposeAxisGuides();

        setSelectionHighlightSuppressed(false, this.ctx);

        if (this.ctx.facePicker) {
            this.ctx.facePicker.enabled = this.facePickerWasEnabled;
        }

        this.contextMenu?.hide();
        this.disposeLiveGuideLine();
        this.renderer.clearPreview();
        this.clearHint();

        this.setUIStatus('Gotowy');
        this.syncToolLiveState('idle');

        if (this.ctx.viewport) this.ctx.viewport.suppressDoubleTapZoom = false;
        if (this.ctx.canvas) {
            this.ctx.canvas.style.cursor = 'default';
        }
    }

    private resetPicks(): void {
        this.contextMenu?.hide();
        this.geometryHighlighter?.clearHighlight();
        this.phase = 'PICK_P1';
        this.pick1 = null;
        this.pick2 = null;
        this.currentOffset = v3(0, 0, 0);
        this.currentOffsetAxisKey = '';
        this.stickyGuideId = null;
        if (this.currentAxisSpace !== 'ALIGNED') this.currentAxisSpace = 'GLOBAL';
        this.disposeAxisGuides();
        this.syncToolLiveState('PICK_P1');
        this.updateHint();
    }

    private syncToolLiveState(phase?: ToolPhase | 'idle'): void {
        const store = PMIStore.instance;
        store.toolLivePhase = phase ?? this.phase;
        store.toolLiveOffsetAxis = this.currentOffsetAxisKey;
        store.toolLiveOffsetSpace = this.currentOffsetAxisKey
            ? (this.currentAxisSpace === 'LOCAL' ? 'LOCAL' : 'GLOBAL')
            : '';
        store.notifyToolLiveChanged();
    }

    // ========================================================================
    // INTENT HANDLING
    // ========================================================================

    public onSelect(intent: Intent): void {
        if (intent.pointerInfo?.event) {
            this.isCtrlPressed = !!(intent.pointerInfo.event.ctrlKey || intent.pointerInfo.event.metaKey);
        }
        this.onLeftClick();
    }

    public onContextMenu(intent: Intent): void {
        const evt = intent?.pointerInfo?.event as MouseEvent | undefined;
        const rect = this.ctx.canvas?.getBoundingClientRect();
        const clientX = evt?.clientX ?? ((rect?.left ?? 0) + (this.ctx.viewport?.scene?.pointerX ?? 0));
        const clientY = evt?.clientY ?? ((rect?.top ?? 0) + (this.ctx.viewport?.scene?.pointerY ?? 0));
        this.openContextMenu(clientX, clientY);
    }

    public openContextMenu(screenX: number, screenY: number): void {
        if (!this.contextMenu) {
            this.contextMenu = new ContextMenu();
            this.contextMenu.onAction((action: string) => {
                switch (action) {
                    case 'axis_x':
                        this.setMeasureAxisExplicit('X');
                        break;
                    case 'axis_y':
                        this.setMeasureAxisExplicit('Y');
                        break;
                    case 'axis_z':
                        this.setMeasureAxisExplicit('Z');
                        break;
                }
            });
        }

        const tools: CtxMenuItem[] = [];

        if (this.pick1 && this.pick2) {
            const avail = computeAvailableMeasureAxes({
                anchor1World: this.pick1.worldPos,
                anchor2World: this.pick2.worldPos,
                axisSpace: this.currentAxisSpace,
                matrixWorld: this.pick1.meshMatrix,
                faceNormal1World: this.pick1.faceNormalWorld,
                faceNormal2World: this.pick2.faceNormalWorld,
                isPlane1: this.pick1.anchor.kind === 'FACE',
                isPlane2: this.pick2.anchor.kind === 'FACE',
            });

            const makeAxisItem = (key: 'X' | 'Y' | 'Z', color: string): CtxMenuItem => {
                const info = avail.axes[key];
                const isSelected = this.measureAxisLocked && this.currentMeasureAxisKey === key;
                const textColor = info.available ? color : '#64748b';
                const captionText = info.available ? `${Math.round(info.lengthMM)} mm` : '0 mm';
                return {
                    icon: `<b style="font-size: 15px; line-height: 1; color: ${textColor};">${key}</b>`,
                    caption: captionText,
                    label: `Oś ${key}: ${info.lengthMM} mm${isSelected ? ' (aktywna)' : ''}`,
                    action: `axis_${key.toLowerCase()}`,
                    disabled: !info.available,
                };
            };

            tools.push(makeAxisItem('X', '#ef4444'));
            tools.push(makeAxisItem('Y', '#22c55e'));
            tools.push(makeAxisItem('Z', '#3b82f6'));
        } else {
            // Brak wyznaczonych 2 punktów — stan domyślny (wszystkie osie odblokowane)
            tools.push(
                {
                    icon: '<b style="font-size: 15px; line-height: 1; color: #ef4444;">X</b>',
                    caption: '',
                    label: 'Oś X',
                    action: 'axis_x',
                },
                {
                    icon: '<b style="font-size: 15px; line-height: 1; color: #22c55e;">Y</b>',
                    caption: '',
                    label: 'Oś Y',
                    action: 'axis_y',
                },
                {
                    icon: '<b style="font-size: 15px; line-height: 1; color: #3b82f6;">Z</b>',
                    caption: '',
                    label: 'Oś Z',
                    action: 'axis_z',
                },
            );
        }

        const items: CtxMenuItem[] = [
            {
                toolbar: tools,
            },
        ];

        this.contextMenu.show(screenX, screenY, items, tx(pmiTekst, 'menu.title', 'pmi'));
    }

    public setMeasureAxisExplicit(key: 'X' | 'Y' | 'Z'): void {
        this.measureAxisLocked = true;
        this.currentMeasureAxisKey = key;
        if (this.currentAxisSpace === 'ALIGNED') {
            this.currentAxisSpace = 'GLOBAL';
        }
        this.clearParallelOffsetAxis();
        if (this.currentOffsetAxisKey === key) {
            this.currentOffsetAxisKey = '';
            this.stickyGuideId = null;
        }
        if (this.phase === 'DRAG_OFFSET') {
            this.updatePreview();
            this.updateDragOffsetStatus();
        } else {
            this.setUIStatus(`Oś pomiaru: ${key}`);
        }
        this.syncToolLiveState();
        this.ctx.viewport?.requestRender?.(2);
    }

    public onCancel(_intent: Intent): void {
        this.contextMenu?.hide();
        this.renderer.clearPreview();
        this.disposeLiveGuideLine();

        if (this.phase === 'DRAG_OFFSET' || this.phase === 'PICK_P2') {
            this.resetPicks();
            this.setUIStatus('Wymiarowanie (PMI)');
        } else {
            this.clearHint();
            this.stateMachine.changeState('SELECTION_TOOL');
        }
    }

    public onConfirm(_intent: Intent): void {
        if (this.phase === 'DRAG_OFFSET') {
            this.commitDimension();
        }
    }

    public onDelete(_intent: Intent): void {
        deleteActiveDimension();
    }

    // ========================================================================
    // KEYBOARD — osie odsunięcia i pomiaru
    // ========================================================================

    private onKeyDown(event: KeyboardEvent): void {
        const rawKey = (event.key || '').toUpperCase();

        if (rawKey === 'G') {
            event.preventDefault?.();
            this.setAxisSpace('GLOBAL');
            if (this.currentOffsetAxisKey) {
                this.stickyGuideId = guideCandidateId('GLOBAL', this.currentOffsetAxisKey as 'X' | 'Y' | 'Z');
            }
            if (this.phase === 'DRAG_OFFSET') {
                this.updatePreview();
                this.updateDragOffsetStatus();
            } else {
                this.setUIStatus('Układ osi wymiaru: GLOBALNY (Ortogonalny)');
            }
            this.syncToolLiveState();
            return;
        }

        if (rawKey === 'L') {
            event.preventDefault?.();
            this.setAxisSpace('LOCAL');
            if (this.currentOffsetAxisKey) {
                this.stickyGuideId = guideCandidateId('LOCAL', this.currentOffsetAxisKey as 'X' | 'Y' | 'Z');
            }
            if (this.phase === 'DRAG_OFFSET') {
                this.updatePreview();
                this.updateDragOffsetStatus();
            } else {
                this.setUIStatus('Układ osi wymiaru: LOKALNY (Wyrównany do elementu)');
            }
            this.syncToolLiveState();
            return;
        }

        if (!AXIS_KEYS.includes(rawKey as typeof AXIS_KEYS[number])) return;
        const key = rawKey;

        event.preventDefault?.();

        if (event.shiftKey) {
            // Shift+oś: zablokowanie osi pomiaru; ponowne wciśnięcie zdejmuje blokadę.
            if (this.measureAxisLocked && this.currentMeasureAxisKey === key) {
                this.measureAxisLocked = false;
                this.currentMeasureAxisKey = 'AUTO';
                this.setUIStatus('Oś pomiaru: automatyczna');
            } else {
                this.measureAxisLocked = true;
                this.currentMeasureAxisKey = key as MeasureAxisKey;
                this.setUIStatus(`Oś pomiaru zablokowana: ${key}`);
            }
        } else {
            // Sama oś: wymuszenie kierunku odsunięcia w aktualnie aktywnej ramie (G lub L).
            const space = this.currentAxisSpace === 'LOCAL' ? 'LOCAL' : 'GLOBAL';
            this.currentAxisSpace = space;
            if (!this.isOffsetAxisAllowed(key, space)) {
                this.currentOffsetAxisKey = '';
                this.stickyGuideId = null;
                this.setUIStatus('Oś odsunięcia musi być prostopadła do osi pomiaru');
            } else if (this.currentOffsetAxisKey === key && this.stickyGuideId) {
                this.currentOffsetAxisKey = '';
                this.stickyGuideId = null;
                this.setUIStatus('Oś odsunięcia: automatyczna');
            } else {
                this.currentOffsetAxisKey = key;
                this.stickyGuideId = guideCandidateId(space, key as 'X' | 'Y' | 'Z');
            }
        }

        this.clearParallelOffsetAxis();

        if (this.phase === 'DRAG_OFFSET') {
            this.updatePreview();
            this.updateDragOffsetStatus();
        }
        this.syncToolLiveState();
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    private onLeftClick(): void {
        if (this.phase === 'DRAG_OFFSET') {
            if (this.isCtrlPressed) {
                // Użytkownik wcisnął Ctrl podczas wyciągania — alternatywne wskazanie elementu 2
                let secondSnap: PickPoint | null = null;
                if (!this.isVertexUnderCursor()) {
                    const detected = this.findDetectedEdge();
                    if (detected) secondSnap = detected.p1;
                }
                if (!secondSnap) {
                    secondSnap = this.findStructuredSnapPoint() ?? this.findSnapPoint();
                }

                if (secondSnap) {
                    this.pick2 = secondSnap;
                    this.beginOffsetDrag();
                    this.setUIStatus('Wybrano drugi element. Przesuń kursor, aby odsunąć linię wymiaru. LPM zatwierdza.');
                    return;
                }
            }

            this.lastClickTime = 0;
            // Kliknięcie bez Ctrl: zatwierdzenie wyciągniętego wymiaru
            this.commitDimension();
            return;
        }

        const now = Date.now();
        if (now - this.lastClickTime < DimensionTool.DOUBLE_CLICK_MS) {
            this.lastClickTime = 0;
            this.renderer.clearPreview();
            this.disposeLiveGuideLine();
            this.resetPicks();
            this.stateMachine.changeState('SELECTION_TOOL');
            return;
        }
        this.lastClickTime = now;

        if (this.phase === 'PICK_P1') {
            // Krawędź pod kursorem ma pierwszeństwo przed snapem do punktu — inaczej
            // klik obok linii uciekał do najbliższego narożnika ściany.
            if (!this.isVertexUnderCursor()) {
                const detectedEdge = this.findDetectedEdge();
                if (detectedEdge) {
                    if (this.isCtrlPressed) {
                        // Ctrl + krawędź: zapisz jako P1 i czekaj na P2
                        this.pick1 = detectedEdge.p1;
                        this.pick2 = null;
                        this.phase = 'PICK_P2';
                        this.syncToolLiveState();
                        this.updateHint();
                        this.setUIStatus('Krawędź 1 wybrana. Wskaż punkt 2 lub drugą krawędź docelową (trzymaj CTRL).');
                    } else {
                        // Bez Ctrl: od razu P1+P2 z krawędzi i drag offset
                        this.pick1 = detectedEdge.p1;
                        this.pick2 = detectedEdge.p2;
                        this.beginOffsetDrag();
                    }
                    return;
                }
            }

            if (!this.isCtrlPressed) {
                // Multi-wybór dwóch punktów/elementów wymaga przytrzymania CTRL.
                // Bez CTRL dopuszczalny jest tylko wybór pojedynczego elementu (np. całej krawędzi powyżej).
                this.setUIStatus('Aby wybrać dwa punkty/elementy, przytrzymaj CTRL.');
                return;
            }

            const snap = this.findStructuredSnapPoint() ?? this.findSnapPoint();
            if (snap) {
                this.pick1 = snap;
                this.phase = 'PICK_P2';
                this.syncToolLiveState();
                this.updateHint();
                this.setUIStatus('Punkt 1 wybrany. Wskaż punkt 2 lub drugą krawędź docelową (trzymaj CTRL).');
                return;
            }

            this.setUIStatus('');
            return;
        }

        if (this.phase === 'PICK_P2') {
            if (!this.isCtrlPressed) {
                // Bez Ctrl: jeśli kliknięto krawędź, traktujemy to jako nowy wybór pojedynczej krawędzi
                if (!this.isVertexUnderCursor()) {
                    const detectedEdge = this.findDetectedEdge();
                    if (detectedEdge) {
                        this.pick1 = detectedEdge.p1;
                        this.pick2 = detectedEdge.p2;
                        this.disposeLiveGuideLine();
                        this.beginOffsetDrag();
                        return;
                    }
                }
                this.setUIStatus('Wskaż drugi element (trzymaj CTRL).');
                return;
            }

            // Krawędź pod kursorem — użyj jej bliższego końca jako P2
            if (!this.isVertexUnderCursor()) {
                const detectedEdge = this.findDetectedEdge();
                if (detectedEdge) {
                    this.pick2 = detectedEdge.p1;
                    this.disposeLiveGuideLine();
                    this.beginOffsetDrag();
                    return;
                }
            }
            const snap = this.findStructuredSnapPoint() ?? this.findSnapPoint();
            if (snap) {
                this.pick2 = snap;
                this.disposeLiveGuideLine();
                this.beginOffsetDrag();
            } else {
                this.setUIStatus('Wskaż punkt 2 lub drugą krawędź docelową (trzymaj CTRL).');
            }
        }
    }

    private beginOffsetDrag(): void {
        this.geometryHighlighter?.clearHighlight();
        this.autoDetectAxis();
        this.phase = 'DRAG_OFFSET';
        this.syncToolLiveState();
        this.updateHint();

        const scene = this.ctx.viewport.scene;
        if (this.pick1 && this.pick2 && scene) {
            const anchor = beginOffsetDragState(
                scene,
                this.pick1.worldPos,
                this.pick2.worldPos,
                v3(0, 0, 0),
                this.currentMeasureDirectionWorld(),
            );
            this.dragStartHitWorld = anchor.dragStartHitWorld;
            this.dragStartOffsetWorld = anchor.dragStartOffsetWorld;
            this.freeDragBiasWorld = anchor.freeDragBiasWorld;
            this.currentOffset = v3Copy(anchor.dragStartOffsetWorld);
        } else {
            this.dragStartHitWorld = null;
            this.dragStartOffsetWorld = v3(0, 0, 0);
            this.freeDragBiasWorld = v3(0, 0, 0);
            this.currentOffset = v3(0, 0, 0);
        }

        this.updateOffsetFromMouse();
        this.updateDragOffsetStatus();
    }

    private onPointerMove(): void {
        const scene = this.ctx.viewport.scene;
        // Geometry highlight podczas wyboru punktów (PICK_P1, PICK_P2),
        // lub w DRAG_OFFSET przy wciśniętym Ctrl
        if (scene && this.geometryHighlighter) {
            if (this.phase !== 'DRAG_OFFSET' || this.isCtrlPressed) {
                const detection = this.geometryHighlighter.update(scene.pointerX, scene.pointerY);
                this.updateHoverStatus(detection);
            } else {
                this.geometryHighlighter.clearHighlight();
            }
        }

        // 1. Podgląd linii od P1 do kursora w fazie PICK_P2 (tylko przy trzymanym Ctrl)
        if (this.phase === 'PICK_P2' && this.pick1) {
            if (this.isCtrlPressed) {
                const snap = this.findStructuredSnapPoint() ?? this.findSnapPoint();
                if (snap) {
                    this.updateLiveGuideLine(this.pick1.worldPos, snap.worldPos);
                } else {
                    this.disposeLiveGuideLine();
                }
            } else {
                this.disposeLiveGuideLine();
            }
        }

        // 2. Dynamiczne wyciąganie wymiaru w fazie DRAG_OFFSET
        if (this.phase === 'DRAG_OFFSET' && this.pick1 && this.pick2) {
            this.updateOffsetFromMouse();
            if (!this.isCtrlPressed) {
                this.updateDragOffsetStatus();
            }
        }

        this.ctx.viewport?.requestRender?.(2);
    }

    private updateHoverStatus(detection: DetectionResult): void {
        if (this.phase === 'DRAG_OFFSET') {
            if (this.isCtrlPressed && detection.hit) {
                const label = PMIGeometryHighlighter.labelOf(detection.geometryType);
                this.setUIStatus(`Ctrl + LPM: precyzyjny wybór do: ${label}`);
            } else {
                this.updateDragOffsetStatus();
            }
            return;
        }

        if (!detection.hit) {
            this.setUIStatus('');
            return;
        }

        const label = PMIGeometryHighlighter.labelOf(detection.geometryType);
        if (this.phase === 'PICK_P1') {
            this.setUIStatus(`Wykryto: ${label} — kliknij LPM, aby wybrać punkt 1 (lub krawędź)`);
        } else if (this.phase === 'PICK_P2') {
            this.setUIStatus(`Wykryto: ${label} — kliknij LPM, aby zatwierdzić punkt 2`);
        }
    }

    /** Zamienia wynik detektora geometrii na punkt wymiarowania. */
    private pickPointFromDetection(result: DetectionResult): PickPoint | null {
        if (!result.hit || !result.mesh || !result.pickedPoint) return null;

        const fakeHit = {
            pickedMesh: result.mesh,
            pickedPoint: new BABYLON.Vector3(
                result.pickedPoint.x,
                result.pickedPoint.y,
                result.pickedPoint.z,
            ),
            getNormal: (useWorld?: boolean) => {
                if (!result.normal) return null;
                return new BABYLON.Vector3(result.normal.x, result.normal.y, result.normal.z);
            },
        };
        return this.createPickPointFromHit(fakeHit);
    }

    // ========================================================================
    // EDGE DETECTION (1-Click Edge Pull)
    // ========================================================================

    private distPointToSegment3D(pt: any, p1: any, p2: any): number {
        const v = p2.subtract(p1);
        const w = pt.subtract(p1);
        const c1 = BABYLON.Vector3.Dot(w, v);
        if (c1 <= 0) return BABYLON.Vector3.Distance(pt, p1);
        const c2 = BABYLON.Vector3.Dot(v, v);
        if (c2 <= c1) return BABYLON.Vector3.Distance(pt, p2);
        const b = c1 / c2;
        const pb = p1.add(v.scale(b));
        return BABYLON.Vector3.Distance(pt, pb);
    }

    private distPointToSegment2D(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const vx = x2 - x1;
        const vy = y2 - y1;
        const wx = px - x1;
        const wy = py - y1;
        const c1 = wx * vx + wy * vy;
        if (c1 <= 0) return Math.hypot(px - x1, py - y1);
        const c2 = vx * vx + vy * vy;
        if (c2 <= c1) return Math.hypot(px - x2, py - y2);
        const b = c1 / c2;
        const bx = x1 + b * vx;
        const by = y1 + b * vy;
        return Math.hypot(px - bx, py - by);
    }

    /**
     * Tolerancyjne pickowanie cienkiej podgeometrii (edge/vertex) w promieniu kilku px.
     * Stabilizuje klik, gdy krawędzie nakładają się ekranowo lub są bardzo cienkie.
     */
    private pickSubHitsWithTolerance(typeFilter: Array<'edge' | 'vertex'>, radiusPx: number): any[] {
        const scene = this.ctx.viewport.scene;
        if (!scene) return [];

        const pointerX = scene.pointerX;
        const pointerY = scene.pointerY;
        const samples = [
            [0, 0],
            [radiusPx, 0], [-radiusPx, 0], [0, radiusPx], [0, -radiusPx],
            [Math.round(radiusPx * 0.7), Math.round(radiusPx * 0.7)],
            [Math.round(radiusPx * 0.7), -Math.round(radiusPx * 0.7)],
            [-Math.round(radiusPx * 0.7), Math.round(radiusPx * 0.7)],
            [-Math.round(radiusPx * 0.7), -Math.round(radiusPx * 0.7)],
        ];

        const bestByMesh = new Map<any, { hit: any; score: number }>();
        for (const [dx, dy] of samples) {
            const hits = scene.multiPick(
                pointerX + dx,
                pointerY + dy,
                (m: any) => m && m.isEnabled() && m.metadata && typeFilter.includes(m.metadata.type),
            );
            if (!hits || hits.length === 0) continue;

            for (const h of hits) {
                if (!h?.hit || !h?.pickedMesh) continue;
                const mesh = h.pickedMesh;
                // Lekko premiujemy próbki bliżej centrum kursora.
                const sampleDist = Math.hypot(dx, dy);
                const rayDist = Number.isFinite(h.distance) ? h.distance : 0;
                const score = sampleDist * 2 + rayDist;
                const curr = bestByMesh.get(mesh);
                if (!curr || score < curr.score) bestByMesh.set(mesh, { hit: h, score });
            }
        }

        return Array.from(bestByMesh.values())
            .sort((a, b) => a.score - b.score)
            .map((x) => x.hit);
    }

    /** Narożnik ma pierwszeństwo przed krawędzią tylko w swoim (mniejszym) promieniu. */
    private isVertexUnderCursor(): boolean {
        const scene = this.ctx.viewport.scene;
        const radiusPx = PMIStore.instance.vertexSnapPx;
        if (!scene || radiusPx <= 0) return false;
        return findVerticesNearPointer(scene, scene.pointerX, scene.pointerY, radiusPx).length > 0;
    }

    /** Wybór musi odpowiadać podświetleniu: gdy highlight pokazuje płaszczyznę, nie podmieniamy jej na krawędź. */
    private isPlaneUnderCursor(): boolean {
        const detection = this.geometryHighlighter?.lastDetection;
        return !!detection?.hit && detection.geometryType === GeometryType.PLANE;
    }

    private findDetectedEdge(): DetectedEdge | null {
        const scene = this.ctx.viewport.scene;
        if (!scene) return null;

        // Płaszczyzna widoczna w highlighcie ma pierwszeństwo przed syntetycznymi
        // krawędziami jej obrysu. Inaczej klik w ścianę (szczególnie wąską, np. ABS
        // we wycięciu L) był zapisywany jako krawędź mimo podświetlonej ściany.
        if (this.isPlaneUnderCursor()) return null;

        const pointerX = scene.pointerX;
        const pointerY = scene.pointerY;

        // A. Krawędź fizyczna — wybór po odległości na ekranie. Działa też dla
        //    krawędzi leżących dokładnie na sobie (bierzemy bliższą kamerze).
        const edgeSnapPx = PMIStore.instance.edgeSnapPx;
        const edgeCandidates = findEdgeSegmentsNearPointer(
            scene,
            pointerX,
            pointerY,
            this.isCtrlPressed ? edgeSnapPx + 4 : edgeSnapPx,
        );

        if (edgeCandidates.length > 0) {
            const best = edgeCandidates[0];
            const mesh = best.mesh;
            const edgeDir = v3Normalize(v3Sub(best.p2World, best.p1World));
            const matArray = getWorldMatrixArray(mesh.parent || mesh);

            const d1 = v3Len(v3Sub(best.closestWorld, best.p1World));
            const d2 = v3Len(v3Sub(best.closestWorld, best.p2World));
            const nearFirst = d1 <= d2;

            const near = {
                worldPos: nearFirst ? best.p1World : best.p2World,
                anchor: buildAnchorRef(
                    mesh,
                    nearFirst ? best.p1World : best.p2World,
                    nearFirst ? best.p1Local : best.p2Local,
                    nearFirst ? best.index1 : best.index2,
                ),
                edgeDirWorld: edgeDir,
                faceNormalWorld: null,
                meshMatrix: matArray,
            };
            const far = {
                worldPos: nearFirst ? best.p2World : best.p1World,
                anchor: buildAnchorRef(
                    mesh,
                    nearFirst ? best.p2World : best.p1World,
                    nearFirst ? best.p2Local : best.p1Local,
                    nearFirst ? best.index2 : best.index1,
                ),
                edgeDirWorld: edgeDir,
                faceNormalWorld: null,
                meshMatrix: matArray,
            };

            return { p1: near, p2: far };
        }

        return null;
    }

    // POINT SNAPPING
    // ========================================================================

    /**
     * Tryb Ctrl: tylko narożniki, krawędzie i ściany (z przyciąganiem do rogu/krawędzi).
     * Bez dowolnego punktu w pustce ani swobodnego kliku w ścianę.
     */
    private findStructuredSnapPoint(): PickPoint | null {
        const scene = this.ctx.viewport.scene;
        if (!scene) return null;

        const detection = this.geometryHighlighter?.lastDetection;
        if (detection?.hit) {
            const fromDetection = this.pickPointFromDetection(detection);
            if (fromDetection) return fromDetection;
        }

        return this.findStructuredSnapPointLegacy();
    }

    /** Zapasowa ścieżka pickowania (gdy detektor nie zwrócił trafienia w tej klatce). */
    private findStructuredSnapPointLegacy(): PickPoint | null {
        const scene = this.ctx.viewport.scene;
        if (!scene) return null;

        const pointerX = scene.pointerX;
        const pointerY = scene.pointerY;

        const subHits = this.pickSubHitsWithTolerance(['vertex', 'edge'], this.isCtrlPressed ? 16 : 12);

        if (subHits && subHits.length > 0) {
            const valid = subHits.filter((h: any) => h.hit && h.pickedMesh);
            if (valid.length > 0) {
                valid.sort((a: any, b: any) => a.distance - b.distance);
                const vHit = valid.find((h: any) => h.pickedMesh.metadata.type === 'vertex');
                const hit = vHit || valid[0];
                return this.createPickPointFromHit(hit);
            }
        }

        const faceHits = scene.multiPick(
            pointerX,
            pointerY,
            (m: any) => m && m.isEnabled() && m.metadata && m.metadata.faceName,
        );

        if (faceHits && faceHits.length > 0) {
            const valid = faceHits.filter((h: any) => h.hit && h.pickedMesh && h.pickedPoint);
            if (valid.length > 0) {
                valid.sort((a: any, b: any) => a.distance - b.distance);
                return this.createPickPointFromHit(valid[0]);
            }
        }

        return null;
    }

    private findSnapPoint(): PickPoint | null {
        const detection = this.geometryHighlighter?.lastDetection;
        if (detection?.hit) {
            const fromDetection = this.pickPointFromDetection(detection);
            if (fromDetection) return fromDetection;
        }

        const scene = this.ctx.viewport.scene;
        if (!scene) return null;

        const pointerX = scene.pointerX;
        const pointerY = scene.pointerY;

        // 1. Wierzchołki i Krawędzie
        const subHits = this.pickSubHitsWithTolerance(['vertex', 'edge'], this.isCtrlPressed ? 16 : 12);

        if (subHits && subHits.length > 0) {
            const valid = subHits.filter((h: any) => h.hit && h.pickedMesh);
            if (valid.length > 0) {
                valid.sort((a: any, b: any) => a.distance - b.distance);
                const vHit = valid.find((h: any) => h.pickedMesh.metadata.type === 'vertex');
                const hit = vHit || valid[0];
                return this.createPickPointFromHit(hit);
            }
        }

        // 2. Ściany formatki
        const faceHits = scene.multiPick(
            pointerX,
            pointerY,
            (m: any) => m && m.isEnabled() && m.metadata && m.metadata.faceName,
        );

        if (faceHits && faceHits.length > 0) {
            const valid = faceHits.filter((h: any) => h.hit && h.pickedMesh && h.pickedPoint);
            if (valid.length > 0) {
                valid.sort((a: any, b: any) => a.distance - b.distance);
                return this.createPickPointFromHit(valid[0]);
            }
        }

        // 3. Dowolny obiekt 3D w scenie
        const generalHit = scene.pick(pointerX, pointerY, (m: any) => m && m.isPickable && !isPmiOverlayMesh(m));
        if (generalHit && generalHit.hit && generalHit.pickedMesh && generalHit.pickedPoint) {
            return this.createPickPointFromHit(generalHit);
        }

        return null;
    }

    private createPickPointFromHit(hit: any): PickPoint | null {
        if (!hit.pickedPoint) return null;

        const mesh = hit.pickedMesh;
        let worldPos = v3(hit.pickedPoint.x, hit.pickedPoint.y, hit.pickedPoint.z);

        // === nowa logika: spróbuj najpierw B-rep ===
        const panelView = this.getPanelViewFromMesh(mesh);
        if (panelView) {
            const brepPick = resolveBrepGeometryPick(this.ctx.viewport.scene, hit, panelView);
            if (brepPick) {
                return this.brepPickToPickPoint(brepPick, hit);
            }
            // Panelowe picki muszą mieć dokładne dane B-rep; nie przechodzimy
            // po cichu do normalnych i krawędzi wyliczanych z siatki renderowej.
            return null;
        }
        if (mesh?.metadata?.panelModel) return null;

        // Fallback na stary kod (dla braku B-rep lub自由 anchorów)
        return this.createPickPointFromHitLegacy(hit, worldPos);
    }

    /**
     * KonwertujeResolvedBrepPick na PickPoint.
     */
    private brepPickToPickPoint(brepPick: any, hit: any): PickPoint | null {
        const mesh = hit.pickedMesh;
        const root = mesh.parent || mesh;
        const meshMatrix = getWorldMatrixArray(root);
        const faceNormalWorld = brepPick.kind === 'FACE' ? planeNormalWorldFromMesh(mesh) : null;
        let worldPos: Vec3 = brepPick.worldPos;
        let anchor: PMIAnchorRef = brepPick.anchorRef;

        let edgeDirWorld: Vec3 | null = null;
        const edgePoints = mesh?.metadata?.brepPoints;
        if (brepPick.kind === 'EDGE' && Array.isArray(edgePoints) && edgePoints.length >= 2) {
            const p0 = v3(edgePoints[0][0], edgePoints[0][1], edgePoints[0][2]);
            const p1 = v3(edgePoints[1][0], edgePoints[1][1], edgePoints[1][2]);
            const d0 = v3Len(v3Sub(brepPick.localPos, p0));
            const d1 = v3Len(v3Sub(brepPick.localPos, p1));
            const subIndex: 0 | 1 = d0 <= d1 ? 0 : 1;
            const localEnd = subIndex === 0 ? p0 : p1;
            worldPos = localToWorldFromBrep(mesh.metadata.panelModel.id, localEnd, this.getPanelViewFromMesh(mesh));
            anchor = {
                ...brepPick.anchorRef,
                subIndex,
                pointLocal: localEnd,
                pointWorldFallback: worldPos,
            };
            const panelView = this.getPanelViewFromMesh(mesh);
            const worldP0 = localToWorldFromBrep(mesh.metadata.panelModel.id, p0, panelView);
            const worldP1 = localToWorldFromBrep(mesh.metadata.panelModel.id, p1, panelView);
            edgeDirWorld = v3Normalize(v3(
                worldP1.x - worldP0.x,
                worldP1.y - worldP0.y,
                worldP1.z - worldP0.z,
            ));
        }

        return {
            worldPos,
            anchor,
            edgeDirWorld,
            faceNormalWorld,
            meshMatrix,
        };
    }

    /**
     * Stara wersja createPickPointFromHit dla fallbacku (brak B-rep).
     */
    private createPickPointFromHitLegacy(hit: any, worldPos: Vec3): PickPoint | null {
        const mesh = hit.pickedMesh;

        // Narożnik przyciągamy do jego dokładnej pozycji, a nie do miejsca
        // trafienia w kulkę markera.
        let localOverride: Vec3 | null = null;
        if (mesh?.metadata?.type === 'vertex' && mesh.position) {
            localOverride = v3(mesh.position.x, mesh.position.y, mesh.position.z);
            const snapped = mesh.getAbsolutePosition?.();
            if (snapped) worldPos = v3(snapped.x, snapped.y, snapped.z);
        }

        if (mesh?.metadata?.type === 'edge') {
            const snappedEnd = snapToNearestEdgeEndpoint(mesh, worldPos);
            if (snappedEnd) {
                const p0 = mesh.metadata.brepPoints[0];
                const p1 = mesh.metadata.brepPoints[1];
                const rootMesh = mesh.parent || mesh;
                const wm = rootMesh?.getWorldMatrix?.();
                let edgeDirWorld: Vec3;
                if (wm) {
                    const localDiff = new BABYLON.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
                    const worldDiff = BABYLON.Vector3.TransformNormal(localDiff, wm);
                    edgeDirWorld = v3Normalize(v3(worldDiff.x, worldDiff.y, worldDiff.z));
                } else {
                    edgeDirWorld = v3Normalize(v3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]));
                }
                const norm = hit.getNormal ? hit.getNormal(true) : null;
                return {
                    worldPos: snappedEnd.worldPos,
                    anchor: snappedEnd.anchor,
                    edgeDirWorld,
                    faceNormalWorld: norm ? v3(norm.x, norm.y, norm.z) : null,
                    meshMatrix: getWorldMatrixArray(rootMesh),
                };
            }
        }

        if (mesh?.metadata?.faceName) {
            // Klik w ścianę zostaje ścianą. Punkt rysunkowy linii pomocniczej
            // wybiera dopiero podgląd/render, gdy znane jest położenie wymiaru.
            const norm = hit.getNormal ? hit.getNormal(true) : null;
            const faceNormalWorld = norm ? v3(norm.x, norm.y, norm.z) : null;
            return {
                worldPos,
                anchor: buildAnchorRef(mesh, worldPos),
                edgeDirWorld: null,
                faceNormalWorld,
                meshMatrix: getWorldMatrixArray(mesh.parent || mesh),
            };
        }

        const anchor = mesh ? buildAnchorRef(mesh, worldPos, localOverride) : freeAnchorRef(worldPos);
        const rootMesh = mesh?.parent || mesh;
        const meshMatrix = mesh ? getWorldMatrixArray(rootMesh) : null;

        let edgeDirWorld: Vec3 | null = null;
        if (mesh?.metadata?.type === 'edge' && mesh.metadata.brepPoints && mesh.metadata.brepPoints.length >= 2) {
            const p0 = mesh.metadata.brepPoints[0];
            const p1 = mesh.metadata.brepPoints[1];
            const wm = rootMesh?.getWorldMatrix?.();
            if (wm) {
                const localDiff = new BABYLON.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
                const worldDiff = BABYLON.Vector3.TransformNormal(localDiff, wm);
                edgeDirWorld = v3Normalize(v3(worldDiff.x, worldDiff.y, worldDiff.z));
            } else {
                edgeDirWorld = v3Normalize(v3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]));
            }
        }

        const norm = hit.getNormal ? hit.getNormal(true) : null;
        const faceNormalWorld = norm ? v3(norm.x, norm.y, norm.z) : null;

        return { worldPos, anchor, edgeDirWorld, faceNormalWorld, meshMatrix };
    }

    /**
     * Pobiera PanelView z meshu na podstawie nodeId.
     */
    private getPanelViewFromMesh(mesh: any): any {
        const model = mesh?.metadata?.panelModel;
        if (!model) return null;
        const panelViews = ContextManager.instance.panelViews;
        if (!panelViews) return null;
        const direct = panelViews.get(model) || panelViews.get(model.id);
        if (direct) return direct;
        for (const view of panelViews.values()) {
            if (view?.model?.id === model.id) return view;
        }
        return null;
    }

    // ========================================================================
    // AXIS DETECTION
    // ========================================================================

    private autoDetectAxis(): void {
        if (this.measureAxisLocked) return;
        // Bez blokady oś rozstrzyga bridge na podstawie dominującej składowej odcinka.
        this.currentMeasureAxisKey = 'AUTO';
    }

    /** Aktualnie obowiązująca oś pomiaru i długość — to samo źródło co renderer. */
    private currentMeasurement(): { lengthMM: number; axisKey: string } | null {
        if (!this.pick1 || !this.pick2) return null;

        const measure = resolveMeasureAxis({
            axisSpace: this.currentAxisSpace,
            matrixWorld: this.pick1.meshMatrix,
            measureAxisKey: this.currentMeasureAxisKey,
            offsetAxisKey: this.currentOffsetAxisKey,
            anchor1World: this.pick1.worldPos,
            anchor2World: this.pick2.worldPos,
            faceNormal1World: this.pick1.faceNormalWorld,
            faceNormal2World: this.pick2.faceNormalWorld,
            isPlane1: this.pick1.anchor.kind === 'FACE',
            isPlane2: this.pick2.anchor.kind === 'FACE',
        });
        return measure ? { lengthMM: measure.lengthMM, axisKey: measure.measureAxisKey } : null;
    }

    /** Kierunek rzeczywistej osi wymiaru; ortogonalne wymiary nie używają cięciwy klików. */
    private currentMeasureDirectionWorld(): Vec3 {
        if (!this.pick1 || !this.pick2) return v3(1, 0, 0);
        const delta = v3Sub(this.pick2.worldPos, this.pick1.worldPos);
        if (this.currentAxisSpace === 'ALIGNED') {
            return v3Len(delta) > 1e-6 ? v3Normalize(delta) : v3(1, 0, 0);
        }

        const measure = resolveMeasureAxis({
            axisSpace: this.currentAxisSpace,
            matrixWorld: this.pick1.meshMatrix,
            measureAxisKey: this.currentMeasureAxisKey,
            offsetAxisKey: this.currentOffsetAxisKey,
            anchor1World: this.pick1.worldPos,
            anchor2World: this.pick2.worldPos,
            faceNormal1World: this.pick1.faceNormalWorld,
            faceNormal2World: this.pick2.faceNormalWorld,
            isPlane1: this.pick1.anchor.kind === 'FACE',
            isPlane2: this.pick2.anchor.kind === 'FACE',
        });
        return measure?.axisXWorld ?? (v3Len(delta) > 1e-6 ? v3Normalize(delta) : v3(1, 0, 0));
    }

    private isOffsetAxisAllowed(axisKey: string, space: string): boolean {
        if (!this.pick1 || !this.pick2) return true;
        const direction = axisVectorWorld(axisKey, space, this.pick1?.meshMatrix ?? null);
        if (!direction) return true;

        const lockedDir = this.measureAxisLocked && this.currentMeasureAxisKey !== 'AUTO'
            ? axisVectorWorld(this.currentMeasureAxisKey, this.currentAxisSpace, this.pick1?.meshMatrix ?? null)
            : null;

        return isOffsetAxisAllowedAlgebraic({
            offsetDirWorld: direction,
            anchor1World: this.pick1.worldPos,
            anchor2World: this.pick2.worldPos,
            axisSpace: this.currentAxisSpace,
            faceNormal1World: this.pick1.faceNormalWorld,
            faceNormal2World: this.pick2.faceNormalWorld,
            isPlane1: this.pick1.anchor.kind === 'FACE',
            isPlane2: this.pick2.anchor.kind === 'FACE',
            lockedMeasureDirWorld: lockedDir,
        });
    }

    private clearParallelOffsetAxis(): void {
        if (!this.currentOffsetAxisKey || this.isOffsetAxisAllowed(this.currentOffsetAxisKey, this.currentAxisSpace)) return;
        this.currentOffsetAxisKey = '';
        this.stickyGuideId = null;
    }

    // ========================================================================
    // OFFSET CALCULATION (Mouse Drag)
    // ========================================================================

    private updateOffsetFromMouse(): void {
        if (!this.pick1 || !this.pick2) return;

        this.clearParallelOffsetAxis();
        this.applyHoveredOffsetGuide();

        const offset = computeOffsetFromPointer({
            scene: this.ctx.viewport.scene,
            anchor1World: this.pick1.worldPos,
            anchor2World: this.pick2.worldPos,
            axisConstraintWorld: axisVectorWorld(
                this.currentOffsetAxisKey,
                this.currentAxisSpace,
                this.pick1.meshMatrix,
            ),
            dragStartHitWorld: this.dragStartHitWorld,
            dragStartOffsetWorld: this.dragStartOffsetWorld,
            freeDragBiasWorld: this.freeDragBiasWorld,
            measureDirWorld: this.currentMeasureDirectionWorld(),
        });

        if (offset) this.currentOffset = offset;

        this.updatePreview();
        this.syncToolLiveState();
    }

    private applyHoveredOffsetGuide(): void {
        if (this.currentAxisSpace === 'ALIGNED' || !this.pick1 || !this.pick2) return;

        const scene = this.ctx.viewport.scene;
        const origin = axisGuideOrigin(this.pick1.worldPos, this.pick2.worldPos);
        const candidates = buildOffsetGuideCandidates({
            origin,
            length: estimateGuideLength(scene, origin),
            localMatrix: localMatrixFromPicks(this.pick1, this.pick2),
            measureDirWorld: this.currentMeasureDirectionWorld(),
            isOffsetAllowed: (key, space) => this.isOffsetAxisAllowed(key, space),
        });

        const project = createWorldToScreen(scene);
        if (!project) return;

        const hit = pickOffsetGuide(candidates, scene.pointerX, scene.pointerY, project, {
            stickyId: this.stickyGuideId,
        });
        if (!hit) return;

        this.stickyGuideId = hit.candidate.id;
        this.currentAxisSpace = hit.candidate.space;
        this.currentOffsetAxisKey = hit.candidate.axisKey;
    }

    // ========================================================================
    // PREVIEW & LIVE GUIDES
    // ========================================================================

    private updatePreview(): void {
        if (!this.pick1 || !this.pick2) return;

        const store = PMIStore.instance;
        const measurement = this.currentMeasurement();
        const labelText = formatDistance(
            measurement?.lengthMM ?? 0,
            store.unitMode,
            store.showUnits,
        );

        const scene = this.ctx.viewport.scene;
        const helpers = scene
            ? resolveFaceHelperWorlds({
                scene,
                anchor1Ref: this.pick1.anchor,
                anchor2Ref: this.pick2.anchor,
                anchor1World: this.pick1.worldPos,
                anchor2World: this.pick2.worldPos,
                offsetWorld: this.currentOffset,
                normal1World: this.pick1.faceNormalWorld,
                normal2World: this.pick2.faceNormalWorld,
            })
            : null;

        const rd = getRenderData({
            axisSpace: this.currentAxisSpace,
            matrixWorld: this.pick1.meshMatrix,
            measureAxisKey: this.currentMeasureAxisKey,
            offsetAxisKey: this.currentOffsetAxisKey,
            offsetWorld: this.currentOffset,
            anchor1World: this.pick1.worldPos,
            anchor2World: this.pick2.worldPos,
            helperAnchor1World: helpers?.helper1World ?? this.pick1.worldPos,
            helperAnchor2World: helpers?.helper2World ?? this.pick2.worldPos,
            edgeDir1World: this.pick1.edgeDirWorld,
            edgeDir2World: this.pick2.edgeDirWorld,
            faceNormal1World: this.pick1.faceNormalWorld,
            faceNormal2World: this.pick2.faceNormalWorld,
            isPlane1: this.pick1.anchor.kind === 'FACE',
            isPlane2: this.pick2.anchor.kind === 'FACE',
            worldThickness: store.lineWidthMM,
            fontSizeWorld: store.textSizeMM,
            labelText,
        });

        this.renderer.renderPreview(rd);
        this.updateAxisGuides();
    }

    private updateAxisGuides(): void {
        if (this.phase !== 'DRAG_OFFSET' || !this.pick1 || !this.pick2) {
            this.disposeAxisGuides();
            return;
        }

        const scene = this.ctx.viewport.scene;
        if (!scene) return;

        if (this.currentAxisSpace === 'ALIGNED') {
            this.disposeAxisGuides();
            return;
        }

        if (!this.axisGuides) {
            this.axisGuides = new PMIAxisGuides(scene);
        }

        const origin = axisGuideOrigin(this.pick1.worldPos, this.pick2.worldPos);
        const candidates = buildOffsetGuideCandidates({
            origin,
            length: estimateGuideLength(scene, origin),
            localMatrix: localMatrixFromPicks(this.pick1, this.pick2),
            measureDirWorld: this.currentMeasureDirectionWorld(),
            isOffsetAllowed: (key, space) => this.isOffsetAxisAllowed(key, space),
        });
        const activeId = this.stickyGuideId
            || (this.currentOffsetAxisKey
                ? guideCandidateId(this.currentAxisSpace === 'LOCAL' ? 'LOCAL' : 'GLOBAL', this.currentOffsetAxisKey as 'X' | 'Y' | 'Z')
                : null);

        this.axisGuides.update(candidates, activeId);
    }

    private disposeAxisGuides(): void {
        this.axisGuides?.dispose();
        this.axisGuides = null;
    }

    private updateLiveGuideLine(p1: Vec3, p2: Vec3): void {
        this.disposeLiveGuideLine();

        const scene = this.ctx.viewport.scene;
        this.liveGuideLine = BABYLON.MeshBuilder.CreateLines(
            'pmi_guide_line',
            {
                points: [
                    new BABYLON.Vector3(p1.x, p1.y, p1.z),
                    new BABYLON.Vector3(p2.x, p2.y, p2.z),
                ],
            },
            scene,
        );
        this.liveGuideLine.color = new BABYLON.Color3(0.2, 0.8, 1.0);
        this.liveGuideLine.isPickable = false;
        this.liveGuideLine.renderingGroupId = 2;
        this.liveGuideLine.metadata = { ...(this.liveGuideLine.metadata || {}), isPmiOverlay: true };
    }

    private disposeLiveGuideLine(): void {
        if (this.liveGuideLine) {
            this.liveGuideLine.dispose();
            this.liveGuideLine = null;
        }
    }

    private setUIStatus(text: string): void {
        if (UIController.instance && typeof UIController.instance.setStatus === 'function') {
            UIController.instance.setStatus(text);
        }
    }

    private updateHint(): void {
        const tm = TooltipManager.instance;
        if (!tm) return;

        if (this.phase === 'PICK_P1') {
            tm.setActiveHint({
                id: 'pmi_dimension_p1',
                title: tx(pmiTekst, 'hints.step1_title', 'pmi'),
                description: tx(pmiTekst, 'hints.step1_desc', 'pmi'),
                confirmKey: 'LPM',
                cancelKey: 'Esc',
            });
        } else {
            // W kolejnych fazach (PICK_P2, DRAG_OFFSET) sterowanie i status wyświetlane są
            // bezpośrednio na pasku statusu — bez nakładania podpowiedzi "KROK 2".
            tm.clearActiveHint();
        }
    }

    private clearHint(): void {
        TooltipManager.instance?.clearActiveHint();
    }

    private updateDragOffsetStatus(): void {
        if (this.phase !== 'DRAG_OFFSET' || !this.pick1 || !this.pick2) return;
        const measurement = this.currentMeasurement();
        const lengthMM = Math.round(measurement?.lengthMM ?? 0);
        const space = this.currentAxisSpace === 'LOCAL' ? 'Lokalny' : 'Globalny';
        const axis = this.currentOffsetAxisKey ? `${space}:${this.currentOffsetAxisKey}` : `${space} (Auto)`;
        this.setUIStatus(`Odsunięcie wymiaru: ${lengthMM} mm | Oś: ${axis} | LPM: zatwierdź | X/Y/Z: oś | G/L: Global/Lokalny | Esc: cofnij`);
    }

    // ========================================================================
    // COMMIT DIMENSION
    // ========================================================================

    private commitDimension(): void {
        if (!this.pick1 || !this.pick2) return;

        const scene = this.ctx.viewport.scene;
        const store = PMIStore.instance;

        // Offset i podpowiedzi kierunkowe zapisujemy w układzie lokalnym kotwicy,
        // żeby wymiar przetrwał obrót i przesunięcie formatki.
        const { offset, offsetSpace } = storeOffsetFromWorld(scene, this.pick1.anchor, this.currentOffset);

        const init = {
            anchor1: this.pick1.anchor,
            anchor2: this.pick2.anchor,
            offset,
            offsetSpace,
            axisSpace: this.currentAxisSpace,
            measureAxisKey: this.currentMeasureAxisKey,
            offsetAxisKey: this.currentOffsetAxisKey,
            edgeDir1Local: directionToLocal(scene, this.pick1.anchor, this.pick1.edgeDirWorld),
            edgeDir2Local: directionToLocal(scene, this.pick2.anchor, this.pick2.edgeDirWorld),
            faceNormal1Local: directionToLocal(scene, this.pick1.anchor, this.pick1.faceNormalWorld),
            faceNormal2Local: directionToLocal(scene, this.pick2.anchor, this.pick2.faceNormalWorld),
        };

        executePMICommand(new AddDimensionCommand(store, init));

        this.renderer.clearPreview();

        this.resetPicks();
        this.setUIStatus('Wymiar dodany! Kliknij kolejną krawędź lub wskaż punkt.');
    }

    // ========================================================================
    // PUBLIC CONFIG (panel PMI)
    // ========================================================================

    public setAxisSpace(space: AxisSpace): void {
        this.currentAxisSpace = space === 'ALIGNED' ? 'ALIGNED' : (space === 'LOCAL' ? 'LOCAL' : 'GLOBAL');
        PMIStore.instance.toolAxisSpace = space === 'ALIGNED' ? 'ALIGNED' : 'GLOBAL';
        if (space === 'ALIGNED') {
            this.stickyGuideId = null;
            this.disposeAxisGuides();
        }
        this.clearParallelOffsetAxis();
        if (this.phase === 'DRAG_OFFSET') this.updatePreview();
    }

    public getAxisSpace(): AxisSpace {
        return this.currentAxisSpace;
    }

    public setMeasureAxis(axis: MeasureAxisKey): void {
        this.currentMeasureAxisKey = axis;
        this.measureAxisLocked = axis !== 'AUTO';
        PMIStore.instance.toolMeasureAxis = axis;
        this.clearParallelOffsetAxis();
        if (this.phase === 'DRAG_OFFSET') this.updatePreview();
    }

    public getMeasureAxis(): MeasureAxisKey {
        return this.currentMeasureAxisKey;
    }

    public getPhase(): ToolPhase {
        return this.phase;
    }

    public getOffsetAxisKey(): string {
        return this.currentOffsetAxisKey;
    }
}

function localMatrixFromPicks(p1: PickPoint, p2: PickPoint): number[] | null {
    const id1 = p1.anchor?.nodeId || '';
    const id2 = p2.anchor?.nodeId || '';
    if (id1 && id2 && id1 !== id2) return null;
    if (id1 && p1.meshMatrix) return p1.meshMatrix;
    if (id2 && p2.meshMatrix) return p2.meshMatrix;
    return null;
}
