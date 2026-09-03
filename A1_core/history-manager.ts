/**
 * SmartPanel Web — History Manager (Undo/Redo)
 * 
 * Snapshot-based undo/redo stack.
 * Przechowuje pełne kopie stanu modelu (JSON snapshots).
 */

export class HistoryManager {
    _maxSteps: number;
    _undoStack: Array<{ snapshot: any; label: string }>;
    _redoStack: Array<{ snapshot: any; label: string }>;
    _listeners: Set<Function>;

    constructor(maxSteps = 100) {
        this._maxSteps = maxSteps;
        this._undoStack = [];
        this._redoStack = [];
        this._listeners = new Set();
    }

    /**
     * Zapisuje nowy snapshot na stos undo.
     * Czyści redo stack (nowa akcja = nowa gałąź historii).
     * @param {object} snapshot - JSON snapshot modelu (np. panelModel.toJSON())
     * @param {string} label - Opis akcji (np. "Dodano otwór ⌀35")
     */
    pushState(snapshot, label = '') {
        this._undoStack.push({
            snapshot: JSON.parse(JSON.stringify(snapshot)),
            label
        });

        // Limit stosu
        if (this._undoStack.length > this._maxSteps) {
            this._undoStack.shift();
        }

        // Nowa akcja kasuje redo
        this._redoStack = [];
        this._emit();
    }

    /**
     * Cofa ostatnią akcję. Zwraca snapshot stanu przed akcją.
     * @returns {{ snapshot: object, label: string } | null}
     */
    undo() {
        if (!this.canUndo()) return null;

        const current = this._undoStack.pop();
        this._redoStack.push(current);

        // Zwróć stan na szczycie stosu (stan PRZED cofniętą akcją)
        const previous = this._undoStack[this._undoStack.length - 1] || null;
        this._emit();
        return previous;
    }

    /**
     * Ponawia cofniętą akcję. Zwraca snapshot stanu po ponowieniu.
     * @returns {{ snapshot: object, label: string } | null}
     */
    redo() {
        if (!this.canRedo()) return null;

        const entry = this._redoStack.pop();
        this._undoStack.push(entry);
        this._emit();
        return entry;
    }

    /** @returns {boolean} */
    canUndo() {
        return this._undoStack.length > 1;
    }

    /** @returns {boolean} */
    canRedo() {
        return this._redoStack.length > 0;
    }

    /**
     * Zwraca opis aktualnego kroku.
     * @returns {string}
     */
    getCurrentLabel() {
        if (this._undoStack.length === 0) return '';
        return this._undoStack[this._undoStack.length - 1].label;
    }

    /**
     * Zwraca opis następnego kroku do cofnięcia.
     * @returns {string}
     */
    getUndoLabel() {
        if (this._undoStack.length < 2) return '';
        return this._undoStack[this._undoStack.length - 1].label;
    }

    /**
     * Zwraca opis następnego kroku do ponowienia.
     * @returns {string}
     */
    getRedoLabel() {
        if (this._redoStack.length === 0) return '';
        return this._redoStack[this._redoStack.length - 1].label;
    }

    /**
     * Czyści całą historię.
     */
    clear() {
        this._undoStack = [];
        this._redoStack = [];
        this._emit();
    }

    /**
     * Rejestruje listener na zmiany stanu historii.
     * @param {Function} fn - callback()
     * @returns {Function} unsubscribe
     */
    onChange(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    /** @private */
    _emit() {
        for (const fn of this._listeners) {
            try { fn(); } catch (e) { console.error('HistoryManager listener error:', e); }
        }
    }
}
