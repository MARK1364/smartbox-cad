/**
 * SmartPanel Web — A1_Core Tooltip & Hint Manager
 * 
 * Centralna klasa zarządzająca podpowiedziami (tooltips), instrukcjami narzędzi
 * oraz skrótami klawiszowymi w stylu paska statusu Blendera.
 */

export interface ToolHint {
    id: string;
    title: string;
    description: string;
    shortcut?: string;
    confirmKey?: string;
    cancelKey?: string;
    category?: 'cnc' | 'smartframe' | 'smartbox' | 'smartpanel' | 'general';
}

export class TooltipManager {
    private static _instance: TooltipManager | null = null;
    private _activeHint: ToolHint | null = null;
    private _registeredTooltips: Map<string, ToolHint> = new Map();
    private _listeners: Set<(hint: ToolHint | null) => void> = new Set();

    public static get instance(): TooltipManager {
        if (!TooltipManager._instance) {
            TooltipManager._instance = new TooltipManager();
        }
        return TooltipManager._instance;
    }

    constructor() {
        TooltipManager._instance = this;
        this._initDefaultTooltips();
    }

    private _initDefaultTooltips(): void {
        this.registerTooltip('wcs_corner_pick', {
            id: 'wcs_corner_pick',
            title: 'Wybór Naroża WCS',
            description: 'Klikaj narożniki na modelu 3D, aby wybrać pozycję Bazy. Naciśnij [Enter] lub kliknij przycisk, aby zatwierdzić.',
            confirmKey: 'Enter',
            cancelKey: 'Escape',
            category: 'cnc'
        });

        this.registerTooltip('camera_focus', {
            id: 'camera_focus',
            title: 'Kadrowanie Kamery',
            description: 'Wycentruj cel i promień obrotu kamery na środku aktywnej formatki 3D.',
            category: 'general'
        });
    }

    /**
     * Rejestruje lub aktualizuje definicję podpowiedzi narzędzia.
     */
    public registerTooltip(id: string, hint: ToolHint): void {
        this._registeredTooltips.set(id, hint);
    }

    /**
     * Pobiera zdefiniowaną podpowiedź po jej ID.
     */
    public getTooltip(id: string): ToolHint | undefined {
        return this._registeredTooltips.get(id);
    }

    /**
     * Ustawia lub zmienia aktualnie wyświetlaną podpowiedź dla aktywnego narzędzia.
     */
    public setActiveHint(hint: ToolHint | string | null): void {
        if (typeof hint === 'string') {
            const found = this._registeredTooltips.get(hint);
            this._activeHint = found || {
                id: 'custom',
                title: 'Podpowiedź',
                description: hint
            };
        } else {
            this._activeHint = hint;
        }
        this._emitChange();
    }

    /**
     * Pobiera aktualną aktywną podpowiedź.
     */
    public get activeHint(): ToolHint | null {
        return this._activeHint;
    }

    /**
     * Zeruje aktywną podpowiedź.
     */
    public clearActiveHint(): void {
        this._activeHint = null;
        this._emitChange();
    }

    /**
     * Subskrypcja powiadomień o zmianie aktywnej podpowiedzi (dla komponentów UI).
     */
    public onChange(listener: (hint: ToolHint | null) => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private _emitChange(): void {
        for (const listener of this._listeners) {
            try {
                listener(this._activeHint);
            } catch (e) {
                console.error('[TooltipManager] błąd powiadomienia listenera:', e);
            }
        }
    }
}
