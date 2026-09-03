import { Intent } from "../interaction-types";
import { BaseState } from "./base-state";
import { ContextManager } from "../../context-manager";
import { deleteActiveDimension } from "../../../A8_pmi/pmi-commands.js";
import { getActiveConstraintPicker, stopConstraintPick } from "../../../S2_solver/constraint-picker.js";

export class SelectionTool extends BaseState {
    
    public onSelect(intent: Intent): void {
        const scene = this.ctx.viewport.scene;
        const pmiHit = scene?.pick?.(
            scene.pointerX,
            scene.pointerY,
            (mesh: any) => !!mesh?.metadata?.pmiAnnotationId && mesh.isPickable,
        );
        if (pmiHit?.hit) {
            // Wymiar obsługuje PMIViewportListener (zaznaczenie / przeciągnięcie).
            return;
        }

        console.log("[SelectionTool] Wykonywanie selekcji (SELECT).");
        if (intent.pointerInfo?.event) {
            const pointerX = this.ctx.viewport.scene.pointerX;
            const pointerY = this.ctx.viewport.scene.pointerY;
            this.ctx.facePicker.handlePointerDown(pointerX, pointerY, intent.pointerInfo.event);
        }
    }

    public onContextMenu(intent: Intent): void {
        console.log("[SelectionTool] Użytkownik kliknął prawym przyciskiem myszy (CONTEXT_MENU).");
        // TODO: Menu kontekstowe
    }

    public onCancel(intent: Intent): void {
        const constraintPicker = getActiveConstraintPicker();
        if (constraintPicker) {
            constraintPicker.onCancel?.();
            stopConstraintPick();
            return;
        }
        console.log("[SelectionTool] Odznaczono wszystko (CANCEL).");
        this.clearSketchMode();
        this.clearActiveEntity();
        this.ctx.contextMenu.hide();
    }

    public onConfirm(intent: Intent): void {
        console.log("[SelectionTool] Zatwierdzenie (CONFIRM) - czyszczenie podświetlenia.");
        this.clearActiveEntity();
    }

    public onDelete(_intent: Intent): void {
        deleteActiveDimension();
    }

    private clearSketchMode(): void {
        if (!this.ctx.sketchPlane.active) return;
        
        this.ctx.sketchPlane.deactivate();
        this.ctx.ui.hideSketchMode();
    }

    private clearActiveEntity(): void {
        if (!this.ctx.document.activeEntity) return;

        const activeTab = ContextManager.instance.activeTab;
        if (activeTab !== 'tab-c1-cnc') {
            this.ctx.document.setActiveEntity(null);
        }
        this.ctx.facePicker.clearSelection();
        this.ctx.ui.clearSelectedFace();
    }
}
