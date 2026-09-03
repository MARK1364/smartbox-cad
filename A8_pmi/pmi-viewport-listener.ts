/**
 * PMI Viewport Listener — TypeScript / Babylon.js
 *
 * Odpowiednik `PMI_OT_viewport_listener` z `pmi_core.py`.
 *
 * Obsługuje wskazywanie wymiarów bezpośrednio w widoku 3D:
 *   - LMB na wymiarze     → zaznaczenie
 *   - LMB ponownie (<350ms) → edycja odsunięcia (przeciągnij, puść aby zatwierdzić)
 *   - kliknięcie w pustkę → zdjęcie zaznaczenia
 *
 * Działa obok maszyny stanów i celowo milczy, gdy aktywne jest inne narzędzie
 * (np. wymiarowanie), żeby nie przechwytywać jego kliknięć.
 */

declare const BABYLON: any;

import { StateMachine } from '../A1_core/interaction/state-machine';
import { UIController } from '../A1_core/ui-controller';
import { PMIStore } from './pmi-data';
import { PMIEditOffsetTool } from './pmi-edit-tool';

/** Nazwa stanu edycji zarejestrowana w maszynie stanów. */
export const PMI_EDIT_STATE = 'PMI_EDIT_TOOL';

/** Stany, w których listener reaguje na kliknięcia. */
const PASSIVE_STATES = new Set(['SELECTION_TOOL', 'SelectionTool']);

const DOUBLE_CLICK_MS = 350;

export class PMIViewportListener {
    private readonly scene: any;
    private readonly stateMachine: StateMachine;
    private readonly store: PMIStore;

    private pointerObserver: any = null;
    private unsubscribeState: (() => void) | null = null;
    private currentStateName = '';

    private lastClickId: string | null = null;
    private lastClickTime = 0;

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
        });

        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo: any) => {
            if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
            if (pointerInfo.event?.button !== 0) return;
            if (!PASSIVE_STATES.has(this.currentStateName)) return;

            this.handleClick();
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
    }

    // ========================================================================
    // CLICK HANDLING
    // ========================================================================

    private handleClick(): void {
        const measurementId = this.pickMeasurementId();
        if (measurementId) {
            this.lastClickId = null;
            this.lastClickTime = 0;
            this.store.selectMeasurementById(measurementId);
            this.setStatus('Pomiar zaznaczony');
            return;
        }

        const annotationId = this.pickAnnotationId();
        const now = Date.now();

        if (!annotationId) {
            this.lastClickId = null;
            this.lastClickTime = 0;
            if (this.store.activeIndex !== -1 || this.store.activeMeasurementIndex !== -1) {
                this.store.deselectAll();
            }
            return;
        }

        const isDoubleClick = (
            annotationId === this.lastClickId
            && now - this.lastClickTime < DOUBLE_CLICK_MS
        );

        this.lastClickId = annotationId;
        this.lastClickTime = now;

        this.store.selectById(annotationId);

        if (isDoubleClick) {
            this.enterEditMode(annotationId);
            return;
        }

        this.setStatus('Wymiar zaznaczony — dwuklik, aby przesunąć odsunięcie.');
    }

    private pickAnnotationId(): string | null {
        const hit = this.scene.pick(
            this.scene.pointerX,
            this.scene.pointerY,
            (mesh: any) => !!mesh?.metadata?.pmiAnnotationId && mesh.isPickable,
        );
        return hit?.hit ? (hit.pickedMesh?.metadata?.pmiAnnotationId ?? null) : null;
    }

    private pickMeasurementId(): string | null {
        const hit = this.scene.pick(
            this.scene.pointerX,
            this.scene.pointerY,
            (mesh: any) => !!mesh?.metadata?.pmiMeasurementId && mesh.isPickable,
        );
        return hit?.hit ? (hit.pickedMesh?.metadata?.pmiMeasurementId ?? null) : null;
    }

    private enterEditMode(annotationId: string): void {
        const editTool = this.stateMachine.getState(PMI_EDIT_STATE) as PMIEditOffsetTool | undefined;
        if (!editTool || typeof editTool.beginEdit !== 'function') {
            console.warn(`[PMIViewportListener] Stan "${PMI_EDIT_STATE}" nie jest zarejestrowany.`);
            return;
        }

        editTool.beginEdit(annotationId);
        this.stateMachine.changeState(PMI_EDIT_STATE);
    }

    private setStatus(text: string): void {
        if (UIController.instance && typeof UIController.instance.setStatus === 'function') {
            UIController.instance.setStatus(text);
        }
    }
}
