import { Intent } from "../interaction-types.js";
import { BaseState } from "./base-state.js";

export class ExtrudeTool extends BaseState {
    
    public onEnter(): void {
        super.onEnter();
        this.ctx.ui.setStatus('Narzędzie Wyciągania: Wybierz zamknięty profil do wyciągnięcia');
    }

    public onExit(): void {
        super.onExit();
        this.ctx.ui.setStatus('');
    }

    public onSelect(intent: Intent): void {
        console.log("[ExtrudeTool] Zaznaczono profil do wyciągnięcia (LMB).");
    }

    public onContextMenu(intent: Intent): void {
        console.log("[ExtrudeTool] Opcje kontekstowe wyciągania (RMB).");
    }

    public onCancel(intent: Intent): void {
        console.log("[ExtrudeTool] Anulowano wyciąganie. Powrót do SelectionTool.");
        this.stateMachine.changeState('SELECTION_TOOL');
    }

    public onConfirm(intent: Intent): void {
        console.log("[ExtrudeTool] Zatwierdzono wyciągnięcie (Enter).");
        this.stateMachine.changeState('SELECTION_TOOL');
    }
}
