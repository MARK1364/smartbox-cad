/**
 * PMI Text Shift Tool — TypeScript / Babylon.js
 *
 * Przesuwanie tekstu wymiaru wzdłuż linii wymiarowej.
 * Wejście przez chwycenie tekstu (LMB w dół / przeciągnięcie / dwuklik), zatwierdzenie
 * puszczeniem LMB, wycofanie Esc.
 */

declare const BABYLON: any;

import { BaseState } from '../A1_core/interaction/states/base-state';
import { BootstrapContext } from '../A1_core/scene-bootstrap';
import { StateMachine } from '../A1_core/interaction/state-machine';
import { PMIAnnotation, PMIStore } from './pmi-data';
import { PMIRenderer } from './pmi-renderer';
import { SetDimensionTextShiftCommand, executePMICommand } from './pmi-commands';
import { pointerOnDragPlane } from './pmi-drag';
import { beginResolveBatch, endResolveBatch } from './pmi-id-bridge';
import { buildAnnotationRenderData } from './pmi-resolve';
import { UIController } from '../A1_core/ui-controller';
import { setSelectionHighlightSuppressed } from '../A1_core/selection-highlight.js';

export const PMI_TEXT_SHIFT_STATE = 'PMI_TEXT_SHIFT_TOOL';

export class PMITextShiftTool extends BaseState {
    private renderer: PMIRenderer;
    private store: PMIStore;

    private annotationId: string | null = null;
    private originalShiftMM = 0;
    private lastRenderedShiftMM = 0;
    private hasDragged = false;
    private grabOffset = 0;
    private dragInitialized = false;

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

    public beginEdit(annotationId: string): void {
        this.annotationId = annotationId;
    }

    public onEnter(): void {
        const ann = this.annotation();
        if (!ann) {
            this.stateMachine.changeState('SELECTION_TOOL');
            return;
        }

        this.originalShiftMM = ann.textShiftMM ?? 0;
        this.lastRenderedShiftMM = this.originalShiftMM;
        this.hasDragged = false;
        this.dragInitialized = false;
        this.grabOffset = 0;
        this.store.selectById(ann.id);

        const scene = this.ctx.viewport.scene;
        this.pointerObserver = scene.onPointerObservable.add((pointerInfo: any) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                this.onPointerMove();
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP && pointerInfo.event?.button === 0) {
                this.onPointerUp();
            }
        });

        this.keyboardObserver = scene.onKeyboardObservable.add((kbInfo: any) => {
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                if (kbInfo.event?.key === 'Escape') {
                    this.onCancel({});
                }
            }
        });

        setSelectionHighlightSuppressed(true, this.ctx);
        if (this.ctx.canvas) {
            this.ctx.canvas.style.cursor = 'ew-resize';
        }
        this.setUIStatus('Tryb przesuwania tekstu: ruszaj kursorem, aby przesunąć tekst wzdłuż linii. Kliknij LMB, aby zatwierdzić, ESC anuluje.');

        // Natychmiastowe zainicjowanie punktu chwytu
        this.onPointerMove();
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
        this.annotationId = null;
        this.hasDragged = false;
        this.dragInitialized = false;
        this.grabOffset = 0;
        this.lastRenderedShiftMM = 0;
        setSelectionHighlightSuppressed(false, this.ctx);
        if (this.ctx.canvas) {
            this.ctx.canvas.style.cursor = 'default';
        }
        this.setUIStatus('Gotowy');
    }

    public onPointerMove(): void {
        const ann = this.annotation();
        if (!ann) return;

        const scene = this.ctx.viewport.scene;
        beginResolveBatch();
        try {
            // buildAnnotationRenderData zwraca pełny stan renderowania z p1DimWorld, p2DimWorld, fwdWorld
            const rd = buildAnnotationRenderData(scene, ann, this.store);
            if (!rd) return;

            const p1 = rd.dimLineP1World;
            const p2 = rd.dimLineP2World;
            const fwd = rd.fwdWorld; // już znormalizowany
            const mid = {
                x: (p1.x + p2.x) * 0.5,
                y: (p1.y + p2.y) * 0.5,
                z: (p1.z + p2.z) * 0.5,
            };

            const hitWorld = pointerOnDragPlane(scene, mid);
            if (!hitWorld) return;

            const fromMid = { x: hitWorld.x - mid.x, y: hitWorld.y - mid.y, z: hitWorld.z - mid.z };
            const mouseProj = fromMid.x * fwd.x + fromMid.y * fwd.y + fromMid.z * fwd.z;

            if (!this.dragInitialized) {
                this.grabOffset = mouseProj - this.originalShiftMM;
                this.dragInitialized = true;
            }

            let shiftMM = mouseProj - this.grabOffset;

            // Przyciąganie do środka w promieniu 8 mm dla łatwego wyśrodkowania
            if (Math.abs(shiftMM) < 8) {
                shiftMM = 0;
            }

            // Ograniczenie przesunięcia do zakresu linii wymiarowej + bezpieczny margines
            const dimLen = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
            const maxShift = (dimLen * 0.5) + 120;
            shiftMM = Math.max(-maxShift, Math.min(maxShift, shiftMM));

            if (Math.abs(shiftMM - this.originalShiftMM) > 0.5) {
                this.hasDragged = true;
            }

            ann.textShiftMM = Math.round(shiftMM * 10) / 10;

            // Kwantyzacja: odświeżaj renderer tylko gdy zmiana ≥ 1 mm od ostatniego rysowania
            if (Math.abs(ann.textShiftMM - this.lastRenderedShiftMM) >= 1) {
                this.lastRenderedShiftMM = ann.textShiftMM;
                this.renderer.renderAll(this.store);
            }
        } finally {
            endResolveBatch();
        }
    }

    public onPointerUp(): void {
        if (this.hasDragged) {
            this.commit();
            return;
        }
        this.restoreOriginal();
        this.stateMachine.changeState('SELECTION_TOOL');
    }

    public onSelect(_intent: any): void {
        if (this.hasDragged) {
            this.commit();
        } else {
            this.onCancel({});
        }
    }

    public onCancel(_intent: any): void {
        this.restoreOriginal();
        this.stateMachine.changeState('SELECTION_TOOL');
    }

    private commit(): void {
        const ann = this.annotation();
        if (!ann || !this.hasDragged) {
            this.restoreOriginal();
            this.stateMachine.changeState('SELECTION_TOOL');
            return;
        }

        const finalShiftMM = ann.textShiftMM ?? 0;
        ann.textShiftMM = this.originalShiftMM;
        executePMICommand(new SetDimensionTextShiftCommand(this.store, ann.id, finalShiftMM));
        this.stateMachine.changeState('SELECTION_TOOL');
    }

    private restoreOriginal(): void {
        const ann = this.annotation();
        if (ann) {
            ann.textShiftMM = this.originalShiftMM;
            this.renderer.renderAll(this.store);
        }
    }

    private annotation(): PMIAnnotation | null {
        return this.annotationId ? this.store.getAnnotation(this.annotationId) : null;
    }

    private setUIStatus(text: string): void {
        if (UIController.instance && typeof UIController.instance.setStatus === 'function') {
            UIController.instance.setStatus(text);
        }
    }
}
