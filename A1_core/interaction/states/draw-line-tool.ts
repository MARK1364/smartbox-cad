import { Intent } from "../interaction-types.js";
import { BaseState } from "./base-state.js";

export class DrawLineTool extends BaseState {
    
    public onEnter(): void {
        super.onEnter();
        this.ctx.ui.setStatus('Narzędzie Rysowania: Kliknij aby rozpocząć rysowanie linii');
    }

    public onExit(): void {
        super.onExit();
        this.ctx.ui.setStatus('');
    }

    public onSelect(intent: Intent): void {
        console.log("[DrawLineTool] Postawiono punkt linii (LMB).");
    }

    public onContextMenu(intent: Intent): void {
        console.log("[DrawLineTool] Opcje kontekstowe rysowania (RMB).");
    }

    public onCancel(intent: Intent): void {
        console.log("[DrawLineTool] Anulowano rysowanie. Powrót do SelectionTool.");
        this.stateMachine.changeState('SELECTION_TOOL');
    }

    public onConfirm(intent: Intent): void {
        console.log("[DrawLineTool] Zatwierdzono linię (Enter).");
    }
}
