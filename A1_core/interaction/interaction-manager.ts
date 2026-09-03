// Removed @babylonjs/core import
declare const BABYLON: any;
import { Intent, IntentType } from "./interaction-types";

type IntentCallback = (intent: Intent) => void;

export class InteractionManager {
    private scene: any;
    private onIntentCallback: IntentCallback;

    constructor(scene: any, onIntentCallback: IntentCallback) {
        this.scene = scene;
        this.onIntentCallback = onIntentCallback;
        this.registerObservables();
    }

    private registerObservables() {
        this.scene.onPointerObservable.add((pointerInfo) => {
            this.handlePointer(pointerInfo);
        });

        this.scene.onKeyboardObservable.add((keyboardInfo) => {
            this.handleKeyboard(keyboardInfo);
        });
    }

    private handlePointer(pointerInfo: any) {
        switch (pointerInfo.type) {
            case BABYLON.PointerEventTypes.POINTERDOWN:
                if (pointerInfo.event.button === 0) { // Lewy przycisk
                    this.onIntentCallback({ type: IntentType.SELECT, pointerInfo });
                } else if (pointerInfo.event.button === 2) { // Prawy przycisk
                    this.onIntentCallback({ type: IntentType.CONTEXT_MENU, pointerInfo });
                }
                break;
            // Tutaj można dodać więcej mapowań np. dla POINTERMOVE jeśli są potrzebne konkretne intencje
        }
    }

    private handleKeyboard(keyboardInfo: any) {
        if (keyboardInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
            const key = keyboardInfo.event.key;
            const target = keyboardInfo.event.target as HTMLElement | null;
            const typingInField = !!target && (
                target.tagName === 'INPUT'
                || target.tagName === 'TEXTAREA'
                || target.isContentEditable
            );

            if (key === "Escape") {
                this.onIntentCallback({ type: IntentType.CANCEL, keyboardInfo });
            } else if (key === "Enter") {
                this.onIntentCallback({ type: IntentType.CONFIRM, keyboardInfo });
            } else if ((key === "Delete" || key === "Backspace") && !typingInField) {
                this.onIntentCallback({ type: IntentType.DELETE, keyboardInfo });
            } else if (key === "f" || key === "F") {
                // Skrót klawiszowy SolidWorks dla Zoom Fit
                this.onIntentCallback({ type: 'ZOOM_FIT' as IntentType, keyboardInfo });
            }
        }
    }
    
    public dispose() {
        // Usuwanie listenerów (w tej uproszczonej wersji zdajemy się na czyszczenie sceny)
        // W pełnej implementacji można by trzymać referencje do observerów i je usuwać.
    }
}
