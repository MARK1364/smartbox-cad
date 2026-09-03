import { BootstrapContext } from "../scene-bootstrap";
import { BaseState } from "./states/base-state";
import { Intent } from "./interaction-types";

export class StateMachine {
    public ctx: BootstrapContext;
    private currentState: BaseState | null = null;
    private currentStateName = '';
    private states: Map<string, BaseState> = new Map();

    // Eventy dla warstwy UI (React)
    private stateChangeListeners: ((newStateName: string) => void)[] = [];

    constructor(ctx: BootstrapContext) {
        this.ctx = ctx;
    }

    /**
     * Rejestruje dostępny stan w maszynie.
     */
    public registerState(name: string, state: BaseState): void {
        this.states.set(name, state);
    }

    /**
     * Zwraca zarejestrowany stan.
     */
    public getState(name: string): BaseState | undefined {
        return this.states.get(name);
    }

    /**
     * Zmienia aktywny stan na podany po nazwie.
     */
    public changeState(name: string): void {
        const nextState = this.states.get(name);
        if (!nextState) {
            console.error(`[StateMachine] Próba przejścia do nieznanego stanu: ${name}`);
            return;
        }

        if (this.currentState) {
            this.currentState.onExit();
        }

        this.currentState = nextState;
        this.currentStateName = name;
        this.currentState.onEnter();

        this.notifyStateChange(name);
    }

    public getCurrentStateName(): string {
        return this.currentStateName;
    }

    /**
     * Przekazuje intencję do obecnego stanu.
     */
    public handleIntent(intent: Intent): void {
        if (this.currentState) {
            this.currentState.handleIntent(intent);
        } else {
            console.warn("[StateMachine] Brak aktywnego stanu do obłużenia intencji.");
        }
    }

    // --- Subskrypcje dla UI (React) ---
    
    public onStateChange(listener: (newStateName: string) => void): () => void {
        this.stateChangeListeners.push(listener);
        // Zwracamy funkcję do odsubskrybowania
        return () => {
            this.stateChangeListeners = this.stateChangeListeners.filter(l => l !== listener);
        };
    }

    private notifyStateChange(newStateName: string): void {
        for (const listener of this.stateChangeListeners) {
            listener(newStateName);
        }
    }
}
