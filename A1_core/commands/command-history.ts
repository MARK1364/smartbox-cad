/**
 * SmartPanel Web — CommandHistory
 *
 * Menedżer historii operacji Undo/Redo.
 * Przechowuje stosy undoStack oraz redoStack (do 100–200 kroków).
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';

export interface CommandHistoryOptions {
    maxEntries?: number;
}

export type HistoryChangeSubscriber = () => void;

export class CommandHistory {
    private _document: ProjectDocument;
    private _undoStack: Command[] = [];
    private _redoStack: Command[] = [];
    private _maxEntries: number;
    private _subscribers: Set<HistoryChangeSubscriber> = new Set();
    private _isExecuting: boolean = false;

    constructor(document: ProjectDocument, options: CommandHistoryOptions = {}) {
        this._document = document;
        this._maxEntries = options.maxEntries ?? 100;
    }

    get document(): ProjectDocument {
        return this._document;
    }

    get canUndo(): boolean {
        return this._undoStack.length > 0;
    }

    get canRedo(): boolean {
        return this._redoStack.length > 0;
    }

    get undoStack(): readonly Command[] {
        return this._undoStack;
    }

    get redoStack(): readonly Command[] {
        return this._redoStack;
    }

    get lastUndoLabel(): string | null {
        return this._undoStack.length > 0 ? this._undoStack[this._undoStack.length - 1].label : null;
    }

    get lastRedoLabel(): string | null {
        return this._redoStack.length > 0 ? this._redoStack[this._redoStack.length - 1].label : null;
    }

    /**
     * Wykonuje nową komendę i dodaje ją na stos Undo.
     * Wyczyszczenie stosu Redo następuje po każdej nowej akcji.
     */
    execute(command: Command): void {
        if (this._isExecuting) return;
        this._isExecuting = true;

        try {
            command.execute(this._document);
            this._undoStack.push(command);

            if (this._undoStack.length > this._maxEntries) {
                this._undoStack.shift();
            }

            this._redoStack = [];
            this._notify();
        } finally {
            this._isExecuting = false;
        }
    }

    /**
     * Cofa ostatnią komendę ze stosu Undo.
     */
    undo(): boolean {
        if (!this.canUndo || this._isExecuting) return false;
        const command = this._undoStack.pop()!;
        this._isExecuting = true;

        try {
            command.undo(this._document);
            this._redoStack.push(command);
            this._notify();
            return true;
        } finally {
            this._isExecuting = false;
        }
    }

    /**
     * Ponawia ostatnio cofniętą komendę ze stosu Redo.
     */
    redo(): boolean {
        if (!this.canRedo || this._isExecuting) return false;
        const command = this._redoStack.pop()!;
        this._isExecuting = true;

        try {
            if (typeof command.redo === 'function') {
                command.redo(this._document);
            } else {
                command.execute(this._document);
            }
            this._undoStack.push(command);
            this._notify();
            return true;
        } finally {
            this._isExecuting = false;
        }
    }

    /**
     * Czyszczenie historii (np. przy ładowaniu nowego pliku).
     */
    clear(): void {
        this._undoStack = [];
        this._redoStack = [];
        this._notify();
    }

    /**
     * Subskrypcja na zmiany w dostępności Undo/Redo.
     */
    onChange(subscriber: HistoryChangeSubscriber): () => void {
        this._subscribers.add(subscriber);
        return () => this._subscribers.delete(subscriber);
    }

    private _notify(): void {
        for (const sub of this._subscribers) {
            try {
                sub();
            } catch (err) {
                console.error('CommandHistory change listener error:', err);
            }
        }
    }
}
