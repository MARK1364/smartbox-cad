/**
 * PMI Viewport Listener — TypeScript / Babylon.js
 *
 * Model interakcji (bezpieczny, bez timerów):
 *   - LMB klik na wymiarze          → zaznaczenie
 *   - LMB przeciągnięcie na linii   → edycja odsunięcia linii  (PMI_EDIT_TOOL)
 *   - LMB przeciągnięcie na tekście → przesuwanie tekstu        (PMI_TEXT_SHIFT_TOOL)
 *   - kliknięcie w pustkę           → zdjęcie zaznaczenia
 *
 * Przeciągnięcie = ruch myszy z wciśniętym LMB > DRAG_THRESHOLD_PX pikseli.
 * Narzędzie edycji przechodzi w tryb drag natychmiast po przekroczeniu progu,
 * bez żadnego dwukliku ani timera.
 *
 * Działa obok maszyny stanów i celowo milczy, gdy aktywne jest inne narzędzie
 * (np. wymiarowanie), żeby nie przechwytywać jego kliknięć.
 */

declare const BABYLON: any;

import { StateMachine } from '../A1_core/interaction/state-machine';
import { UIController } from '../A1_core/ui-controller';
import { PMIStore } from './pmi-data';
import { PMIEditOffsetTool } from './pmi-edit-tool';
import { PMITextShiftTool, PMI_TEXT_SHIFT_STATE } from './pmi-text-shift-tool';

/** Nazwa stanu edycji zarejestrowana w maszynie stanów. */
export const PMI_EDIT_STATE = 'PMI_EDIT_TOOL';

/** Stany, w których listener reaguje na kliknięcia. */
const PASSIVE_STATES = new Set(['SELECTION_TOOL', 'SelectionTool']);

/** Próg ruchu myszy (px) po którym klik staje się przeciągnięciem. */
const DRAG_THRESHOLD_PX = 5;

export class PMIViewportListener {
    private readonly scene: any;
    private readonly stateMachine: StateMachine;
    private readonly store: PMIStore;

    private pointerObserver: any = null;
    private unsubscribeState: (() => void) | null = null;
    private currentStateName = '';

    /**
     * Wymiar nad którym wciśnięto LMB — potencjalny drag.
     * Null gdy LMB nie jest wciśnięty lub kliknięto w pustkę.
     */
    private dragCandidate: {
        id: string;
        target: 'line' | 'text';
        startX: number;
        startY: number;
        dragStarted: boolean;
    } | null = null;

    constructor(scene: any, stateMachine: StateMachine, store: PMIStore = PMIStore.instance) {
        this.scene = scene;
        this.stateMachine = stateMachine;
        this.store = store;
    }

    /**
     * @param initialStateName Stan aktywny w chwili podpięcia — maszyna stanów
     *                         nie udostępnia go, a bez tego listener milczałby
     *                         aż do pierwszej zmiany narzędzia.
     */
    public attach(initialStateName = 'SELECTION_TOOL'): void {
        if (this.pointerObserver) return;
        this.currentStateName = initialStateName;

        this.unsubscribeState = this.stateMachine.onStateChange((name: string) => {
            this.currentStateName = name;
            // Gdy inny stan przejął kontrolę, kasujemy kandydata dragu.
            if (!PASSIVE_STATES.has(name)) {
                this.dragCandidate = null;
            }
        });

        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo: any) => {
            if (!PASSIVE_STATES.has(this.currentStateName)) return;

            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN && pointerInfo.event?.button === 0) {
                this.handlePointerDown(pointerInfo.event);
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                this.handlePointerMove(pointerInfo.event);
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP && pointerInfo.event?.button === 0) {
                this.handlePointerUp();
            }
        });
    }

    public dispose(): void {
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }
        if (this.unsubscribeState) {
            this.unsubscribeState();
            this.unsubscribeState = null;
        }
        this.dragCandidate = null;
        const canvas = this.scene.getEngine?.().getRenderingCanvas?.();
        if (canvas && (canvas.style.cursor === 'grab' || canvas.style.cursor === 'move')) {
            canvas.style.cursor = 'default';
        }
    }

    // ========================================================================
    // POINTER HANDLERS
    // ========================================================================

    private handlePointerDown(event: PointerEvent): void {
        this.dragCandidate = null;

        // Pomiar (miarki) — tylko zaznaczenie, bez drag.
        const measurementId = this.pickMeasurementId();
        if (measurementId) {
            this.store.selectMeasurementById(measurementId);
            this.setStatus('Pomiar zaznaczony.');
            return;
        }

        const hit = this.pickAnnotationHit();
        if (!hit) {
            // Klik w pustkę — odznacz
            if (this.store.activeIndex !== -1 || this.store.activeMeasurementIndex !== -1) {
                this.store.deselectAll();
            }
            return;
        }

        // Zaznacz wymiar i ustaw kandydata dragu
        this.store.selectById(hit.id);
        this.dragCandidate = {
            id: hit.id,
            target: hit.target,
            // Używamy scene.pointerX/Y (układ canvas) — zawsze zgodny z Babylon pick()
            startX: this.scene.pointerX,
            startY: this.scene.pointerY,
            dragStarted: false,
        };

        if (hit.target === 'line') {
            this.setStatus('Zaznaczono linię wymiarową — przeciągnij, aby zmienić odsunięcie.');
        } else {
            this.setStatus('Zaznaczono tekst wymiaru — przeciągnij, aby przesunąć go wzdłuż linii.');
        }
        this.updateHoverCursor();
    }

    private handlePointerMove(event: PointerEvent): void {
        if (this.dragCandidate && !this.dragCandidate.dragStarted) {
            // Używamy scene.pointerX/Y — Babylon aktualizuje je przed POINTERMOVE
            const dx = this.scene.pointerX - this.dragCandidate.startX;
            const dy = this.scene.pointerY - this.dragCandidate.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist >= DRAG_THRESHOLD_PX) {
                // Próg przekroczony — wchodzimy w tryb edycji
                this.dragCandidate.dragStarted = true;
                const { id, target } = this.dragCandidate;
                this.dragCandidate = null; // listener rezygnuje z kontroli

                if (target === 'line') {
                    this.enterEditMode(id);
                } else {
                    this.enterTextShiftMode(id);
                }
                return;
            }
        }

        this.updateHoverCursor();
    }

    private handlePointerUp(): void {
        // Puścono bez przekroczenia progu — to był zwykły klik, wymiar już zaznaczony.
        this.dragCandidate = null;
        this.updateHoverCursor();
    }

    // ========================================================================
    // CURSOR
    // ========================================================================

    private updateHoverCursor(): void {
        const canvas = this.scene.getEngine?.().getRenderingCanvas?.();
        if (!canvas) return;

        const hit = this.pickAnnotationHit();
        if (hit?.target === 'text') {
            canvas.style.cursor = 'grab';
        } else if (hit?.target === 'line') {
            canvas.style.cursor = 'move';
        } else if (canvas.style.cursor === 'grab' || canvas.style.cursor === 'move') {
            canvas.style.cursor = 'default';
        }
    }

    // ========================================================================
    // PICKING
    // ========================================================================

    private pickAnnotationHit(): { id: string; target: 'line' | 'text' } | null {
        // Używamy multiPick, aby wykryć wszystkie elementy wymiaru na promieniu.
        // Etykieta tekstu ma bezwzględne pierwszeństwo przed leżącym pod nią hitboxem linii.
        const hits = this.scene.multiPick(
            this.scene.pointerX,
            this.scene.pointerY,
            (mesh: any) => !!mesh?.metadata?.pmiAnnotationId && mesh.isPickable,
        );
        if (!hits || hits.length === 0) return null;

        const textHit = hits.find((h: any) => h.hit && h.pickedMesh?.metadata?.pmiTarget === 'text');
        if (textHit?.pickedMesh?.metadata?.pmiAnnotationId) {
            return {
                id: textHit.pickedMesh.metadata.pmiAnnotationId,
                target: 'text',
            };
        }

        const lineHit = hits.find((h: any) => h.hit && h.pickedMesh?.metadata?.pmiTarget === 'line');
        if (lineHit?.pickedMesh?.metadata?.pmiAnnotationId) {
            return {
                id: lineHit.pickedMesh.metadata.pmiAnnotationId,
                target: 'line',
            };
        }

        const anyHit = hits.find((h: any) => h.hit && h.pickedMesh?.metadata?.pmiAnnotationId);
        if (anyHit?.pickedMesh?.metadata?.pmiAnnotationId) {
            return {
                id: anyHit.pickedMesh.metadata.pmiAnnotationId,
                target: anyHit.pickedMesh.metadata.pmiTarget === 'line' ? 'line' : 'text',
            };
        }

        return null;
    }

    private pickMeasurementId(): string | null {
        const hit = this.scene.pick(
            this.scene.pointerX,
            this.scene.pointerY,
            (mesh: any) => !!mesh?.metadata?.pmiMeasurementId && mesh.isPickable,
        );
        return hit?.hit ? (hit.pickedMesh?.metadata?.pmiMeasurementId ?? null) : null;
    }

    // ========================================================================
    // EDIT MODE ACTIVATION
    // ========================================================================

    private enterEditMode(annotationId: string): void {
        const editTool = this.stateMachine.getState(PMI_EDIT_STATE) as PMIEditOffsetTool | undefined;
        if (!editTool || typeof editTool.beginEdit !== 'function') {
            console.warn(`[PMIViewportListener] Stan "${PMI_EDIT_STATE}" nie jest zarejestrowany.`);
            return;
        }

        editTool.beginEdit(annotationId);
        this.stateMachine.changeState(PMI_EDIT_STATE);
    }

    private enterTextShiftMode(annotationId: string): void {
        const shiftTool = this.stateMachine.getState(PMI_TEXT_SHIFT_STATE) as PMITextShiftTool | undefined;
        if (!shiftTool || typeof shiftTool.beginEdit !== 'function') {
            console.warn(`[PMIViewportListener] Stan "${PMI_TEXT_SHIFT_STATE}" nie jest zarejestrowany.`);
            return;
        }

        shiftTool.beginEdit(annotationId);
        this.stateMachine.changeState(PMI_TEXT_SHIFT_STATE);
    }

    private setStatus(text: string): void {
        if (UIController.instance && typeof UIController.instance.setStatus === 'function') {
            UIController.instance.setStatus(text);
        }
    }
}
