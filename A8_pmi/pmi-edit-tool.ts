/**
 * PMI Edit Offset Tool — TypeScript / Babylon.js
 *
 * Przeciąganie odsunięcia istniejącego wymiaru. Wejście przez chwycenie
 * wymiaru na scenie (LMB w dół), zatwierdzenie puszczeniem przycisku,
 * wycofanie Esc/RMB. Odpowiednik `PMI_OT_edit_offset` z `pmi_ui.py`.
 */

declare const BABYLON: any;

import { BaseState } from '../A1_core/interaction/states/base-state';
import { Intent } from '../A1_core/interaction/interaction-types';
import { BootstrapContext } from '../A1_core/scene-bootstrap';
import { StateMachine } from '../A1_core/interaction/state-machine';
import { Vec3, v3, v3Copy, v3Len, v3Sub } from './dimension-solver';
import { AxisSpace, OffsetSpace, PMIAnnotation, PMIStore } from './pmi-data';
import { PMIRenderer } from './pmi-renderer';
import { SetDimensionOffsetCommand, executePMICommand, deleteActiveDimension } from './pmi-commands';
import { axisVectorWorld, beginOffsetDragState, computeOffsetFromPointer } from './pmi-drag';
import { PMIAxisGuides, axisGuideOrigin, buildOffsetGuideCandidates, estimateGuideLength, guideCandidateId } from './pmi-axis-guides.js';
import { pickOffsetGuide, createWorldToScreen } from './pmi-axis-guide-pick.js';
import { beginResolveBatch, endResolveBatch } from './pmi-id-bridge';
import { resolveAnnotation, storeOffsetFromWorld, resolveOffsetWorld } from './pmi-resolve';
import { UIController } from '../A1_core/ui-controller';
import { setSelectionHighlightSuppressed } from '../A1_core/selection-highlight.js';

const AXIS_KEYS = ['X', 'Y', 'Z'] as const;

/** Ruch poniżej tego progu [mm] traktujemy jako kliknięcie, nie przesunięcie. */
const DRAG_THRESHOLD_MM = 2;

export class PMIEditOffsetTool extends BaseState {
    private renderer: PMIRenderer;
    private store: PMIStore;

    private annotationId: string | null = null;
    private offsetAxisKey = '';
    private axisSpace: AxisSpace = 'GLOBAL';
    private originalOffset: Vec3 | null = null;
    private originalSpace: OffsetSpace = 'LOCAL';
    private originalAxisSpace: AxisSpace = 'GLOBAL';
    private originalOffsetAxisKey = '';
    private stickyGuideId: string | null = null;
    private hasDragged = false;

    private dragAnchored = false;
    private dragStartHitWorld: Vec3 | null = null;
    private dragStartOffsetWorld: Vec3 = v3(0, 0, 0);
    private freeDragBiasWorld: Vec3 = v3(0, 0, 0);
    private axisGuides: PMIAxisGuides | null = null;

    private pointerObserver: any = null;
    private keyboardObserver: any = null;

    constructor(
        ctx: BootstrapContext,
        stateMachine: StateMachine,
        renderer: PMIRenderer,
        store: PMIStore = PMIStore.instance,
    ) {
        super(ctx, stateMachine);
        this.renderer = renderer;
        this.store = store;
    }

    /**
     * Wskazuje wymiar do edycji. Musi zostać wywołane przed `changeState`.
     */
    public beginEdit(annotationId: string): void {
        this.annotationId = annotationId;
    }

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    public onEnter(): void {
        const ann = this.annotation();
        if (!ann) {
            console.warn('[PMIEditOffsetTool] Brak wymiaru do edycji — powrót do zaznaczania.');
            this.stateMachine.changeState('SELECTION_TOOL');
            return;
        }

        this.offsetAxisKey = ann.offsetAxisKey || '';
        this.axisSpace = ann.axisSpace ?? 'GLOBAL';
        this.originalOffset = v3Copy(ann.offset);
        this.originalSpace = ann.offsetSpace;
        this.originalAxisSpace = ann.axisSpace ?? 'GLOBAL';
        this.originalOffsetAxisKey = ann.offsetAxisKey || '';
        this.stickyGuideId = this.offsetAxisKey && this.axisSpace !== 'ALIGNED'
            ? guideCandidateId(this.axisSpace === 'LOCAL' ? 'LOCAL' : 'GLOBAL', this.offsetAxisKey as 'X' | 'Y' | 'Z')
            : null;
        this.hasDragged = false;
        this.store.selectById(ann.id);

        const scene = this.ctx.viewport.scene;
        this.pointerObserver = scene.onPointerObservable.add((pointerInfo: any) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                this.onPointerMove();
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
                if (pointerInfo.event?.button === 0) this.onPointerUp();
            }
        });
        this.keyboardObserver = scene.onKeyboardObservable.add((keyboardInfo: any) => {
            if (keyboardInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                this.onKeyDown(keyboardInfo.event);
            }
        });

        setSelectionHighlightSuppressed(true, this.ctx);

        if (this.ctx.canvas) this.ctx.canvas.style.cursor = 'move';
        this.setUIStatus('Przeciągnij wzdłuż linii ciągłej (GLOBAL) lub przerywanej (LOCAL). Puść LMB, ESC anuluje.');
    }

    public onExit(): void {
        const scene = this.ctx.viewport.scene;
        if (this.pointerObserver) {
            scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }
        if (this.keyboardObserver) {
            scene.onKeyboardObservable.remove(this.keyboardObserver);
            this.keyboardObserver = null;
        }

        this.renderer.clearPreview();
        this.annotationId = null;
        this.originalOffset = null;
        this.hasDragged = false;
        this.dragAnchored = false;
        this.dragStartHitWorld = null;
        this.disposeAxisGuides();

        setSelectionHighlightSuppressed(false, this.ctx);

        if (this.ctx.canvas) this.ctx.canvas.style.cursor = 'default';
        this.setUIStatus('Gotowy');
    }

    // ========================================================================
    // INTENTS
    // ========================================================================

    public onSelect(_intent: Intent): void {
        // Wejście nastąpiło na POINTERDOWN; zatwierdzenie jest na POINTERUP.
    }

    public onConfirm(_intent: Intent): void {
        this.commit();
    }

    public onContextMenu(intent: Intent): void {
        this.onCancel(intent);
    }

    public onCancel(_intent: Intent): void {
        this.restoreOriginal();
        this.stateMachine.changeState('SELECTION_TOOL');
    }

    public onDelete(_intent: Intent): void {
        if (deleteActiveDimension(this.store)) {
            this.annotationId = null;
            this.stateMachine.changeState('SELECTION_TOOL');
        }
    }

    private onKeyDown(event: KeyboardEvent): void {
        const key = (event.key || '').toUpperCase();
        if (!AXIS_KEYS.includes(key as typeof AXIS_KEYS[number])) return;

        event.preventDefault?.();
        if (this.offsetAxisKey === key && this.stickyGuideId) {
            this.offsetAxisKey = '';
            this.stickyGuideId = null;
            this.setUIStatus('Odsunięcie: bez blokady osi');
        } else {
            const space = this.axisSpace === 'LOCAL' ? 'LOCAL' : 'GLOBAL';
            this.axisSpace = space;
            this.offsetAxisKey = key;
            this.stickyGuideId = guideCandidateId(space, key);
            this.setUIStatus(`Oś odsunięcia: ${space === 'LOCAL' ? 'L' : 'G'}:${key}`);
        }
        this.onPointerMove();
    }

    // ========================================================================
    // DRAG
    // ========================================================================

    private ensureDragAnchor(scene: any, ann: PMIAnnotation, resolved: { anchor1World: Vec3; anchor2World: Vec3 }): void {
        if (this.dragAnchored) return;
        const startOffsetWorld = resolveOffsetWorld(scene, ann);
        const anchor = beginOffsetDragState(scene, resolved.anchor1World, resolved.anchor2World, startOffsetWorld);
        this.dragStartHitWorld = anchor.dragStartHitWorld;
        this.dragStartOffsetWorld = anchor.dragStartOffsetWorld;
        this.freeDragBiasWorld = anchor.freeDragBiasWorld;
        this.dragAnchored = true;
    }

    private onPointerMove(): void {
        const ann = this.annotation();
        if (!ann || !this.originalOffset) return;

        const scene = this.ctx.viewport.scene;

        beginResolveBatch();
        try {
            const resolved = resolveAnnotation(scene, ann);
            if (!resolved) return;

            this.ensureDragAnchor(scene, ann, resolved);

            if (ann.axisSpace !== 'ALIGNED') {
                const origin = axisGuideOrigin(resolved.anchor1World, resolved.anchor2World);
                const localMatrix = ann.anchor1.nodeId && ann.anchor1.nodeId === ann.anchor2.nodeId
                    ? resolved.matrixWorld
                    : (ann.anchor1.nodeId && !ann.anchor2.nodeId ? resolved.matrixWorld : null);
                const candidates = buildOffsetGuideCandidates({
                    origin,
                    length: estimateGuideLength(scene, origin),
                    localMatrix,
                    measureDirWorld: v3Sub(resolved.anchor2World, resolved.anchor1World),
                });
                const project = createWorldToScreen(scene);
                if (project) {
                    const hit = pickOffsetGuide(candidates, scene.pointerX, scene.pointerY, project, {
                        stickyId: this.stickyGuideId,
                    });
                    if (hit) {
                        this.stickyGuideId = hit.candidate.id;
                        this.axisSpace = hit.candidate.space;
                        this.offsetAxisKey = hit.candidate.axisKey;
                        ann.axisSpace = hit.candidate.space;
                        ann.offsetAxisKey = hit.candidate.axisKey;
                    }
                }
            }

            const offset = computeOffsetFromPointer({
                scene,
                anchor1World: resolved.anchor1World,
                anchor2World: resolved.anchor2World,
                axisConstraintWorld: axisVectorWorld(
                    this.offsetAxisKey,
                    this.axisSpace,
                    resolved.matrixWorld,
                ),
                dragStartHitWorld: this.dragStartHitWorld,
                dragStartOffsetWorld: this.dragStartOffsetWorld,
                freeDragBiasWorld: this.freeDragBiasWorld,
            });
            if (!offset) return;

            const stored = storeOffsetFromWorld(scene, ann.anchor1, offset);
            const delta = v3Len(v3Sub(stored.offset, this.originalOffset));
            if (delta > DRAG_THRESHOLD_MM) this.hasDragged = true;

            // Zapis bezpośredni — bez notify, żeby nie zaśmiecać historii.
            // Renderer odświeża podgląd z bieżącego offsetu.
            ann.offset = stored.offset;
            ann.offsetSpace = stored.offsetSpace;
            this.renderer.renderAll(this.store);
            this.updateAxisGuides(resolved);
        } finally {
            endResolveBatch();
        }
    }

    private updateAxisGuides(resolved: {
        anchor1World: Vec3;
        anchor2World: Vec3;
        matrixWorld: number[] | null;
    }): void {
        const ann = this.annotation();
        const scene = this.ctx.viewport.scene;
        if (!ann || !scene) {
            this.disposeAxisGuides();
            return;
        }

        if (!this.axisGuides) {
            this.axisGuides = new PMIAxisGuides(scene);
        }

        if (ann.axisSpace === 'ALIGNED') {
            this.axisGuides.hide();
            return;
        }

        const origin = axisGuideOrigin(resolved.anchor1World, resolved.anchor2World);
        const localMatrix = ann.anchor1.nodeId && ann.anchor1.nodeId === ann.anchor2.nodeId
            ? resolved.matrixWorld
            : null;
        const candidates = buildOffsetGuideCandidates({
            origin,
            length: estimateGuideLength(scene, origin),
            localMatrix,
            measureDirWorld: v3Sub(resolved.anchor2World, resolved.anchor1World),
        });
        const activeId = this.stickyGuideId
            || (this.offsetAxisKey
                ? guideCandidateId(this.axisSpace === 'LOCAL' ? 'LOCAL' : 'GLOBAL', this.offsetAxisKey as 'X' | 'Y' | 'Z')
                : null);
        this.axisGuides.update(candidates, activeId);
    }

    private disposeAxisGuides(): void {
        this.axisGuides?.dispose();
        this.axisGuides = null;
    }

    private onPointerUp(): void {
        if (this.hasDragged) {
            this.commit();
            return;
        }
        // Samo kliknięcie — zostaw zaznaczenie, wróć do narzędzia wyboru.
        this.restoreOriginal();
        this.stateMachine.changeState('SELECTION_TOOL');
    }

    // ========================================================================
    // COMMIT / RESTORE
    // ========================================================================

    private commit(): void {
        const ann = this.annotation();
        if (!ann || !this.originalOffset || !this.hasDragged) {
            this.onCancel({} as Intent);
            return;
        }

        const nextOffset = v3Copy(ann.offset);
        const nextSpace = ann.offsetSpace;
        const nextAxisSpace = this.axisSpace;
        const nextOffsetAxisKey = this.offsetAxisKey;

        // Komenda odczytuje stan sprzed zmiany — przywracamy oryginał bez powiadomienia.
        ann.offset = v3Copy(this.originalOffset);
        ann.offsetSpace = this.originalSpace;
        ann.axisSpace = this.originalAxisSpace;
        ann.offsetAxisKey = this.originalOffsetAxisKey;
        executePMICommand(new SetDimensionOffsetCommand(
            this.store,
            ann.id,
            nextOffset,
            nextSpace,
            { axisSpace: nextAxisSpace, offsetAxisKey: nextOffsetAxisKey },
        ));

        this.stateMachine.changeState('SELECTION_TOOL');
    }

    private restoreOriginal(): void {
        const ann = this.annotation();
        if (!ann || !this.originalOffset) return;
        this.store.setPlacement(ann.id, {
            offset: this.originalOffset,
            offsetSpace: this.originalSpace,
            axisSpace: this.originalAxisSpace,
            offsetAxisKey: this.originalOffsetAxisKey,
        });
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    private annotation(): PMIAnnotation | null {
        return this.annotationId ? this.store.getAnnotation(this.annotationId) : null;
    }

    private setUIStatus(text: string): void {
        if (UIController.instance && typeof UIController.instance.setStatus === 'function') {
            UIController.instance.setStatus(text);
        }
    }
}
