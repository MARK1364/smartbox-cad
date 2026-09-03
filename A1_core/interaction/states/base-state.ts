import { BootstrapContext } from "../../scene-bootstrap";
import { Intent } from "../interaction-types";
import { StateMachine } from "../state-machine";

export abstract class BaseState {
    protected ctx: BootstrapContext;
    protected stateMachine: StateMachine;

    constructor(ctx: BootstrapContext, stateMachine: StateMachine) {
        this.ctx = ctx;
        this.stateMachine = stateMachine;
    }

    /**
     * Wywoływane przy wejściu do tego stanu.
     */
    public onEnter(): void {
        console.log(`[State] Wchodzę do stanu: ${this.constructor.name}`);
    }

    /**
     * Wywoływane przy wyjściu z tego stanu.
     */
    public onExit(): void {
        console.log(`[State] Wychodzę ze stanu: ${this.constructor.name}`);
    }

    /**
     * Obsługa intencji nadesłanej przez InteractionManager.
     * Automatycznie routuje intencje do dedykowanych metod w klasach dziedziczących.
     * @param intent Intencja (znormalizowane zdarzenie)
     */
    public handleIntent(intent: Intent): void {
        switch (intent.type) {
            case "SELECT":
                this.onSelect(intent);
                break;
            case "CONTEXT_MENU":
                this.onContextMenu(intent);
                break;
            case "CANCEL":
                this.onCancel(intent);
                break;
            case "CONFIRM":
                this.onConfirm(intent);
                break;
            case "DELETE":
                this.onDelete(intent);
                break;
            default:
                console.warn(`[BaseState] Nieobsługiwany typ intencji: ${intent.type}`);
        }
    }

    // --- Metody do nadpisania w konkretnych narzędziach ---

    public onSelect(intent: Intent): void {}
    public onContextMenu(intent: Intent): void {}
    public onCancel(intent: Intent): void {}
    public onConfirm(intent: Intent): void {}
    public onDelete(_intent: Intent): void {}
}
