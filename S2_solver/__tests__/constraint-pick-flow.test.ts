import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ConstraintStore } from '../constraint-store.js';
import { ConstraintHighlightOverlay } from '../constraint-highlight.js';
import { stopConstraintPick } from '../constraint-picker.js';
import { addConstraintDraft, beginConstraintSlotPick } from '../constraint-pick-flow.js';

describe('S2_solver — anulowanie szkicu więzu', () => {
    let document: ProjectDocument;
    let history: CommandHistory;
    let store: ConstraintStore;
    let previousHistory: CommandHistory | null;
    let refreshSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        const listeners = new Map<string, Set<(event: Event) => void>>();
        vi.stubGlobal('window', {
            addEventListener: (type: string, listener: (event: Event) => void) => {
                const handlers = listeners.get(type) ?? new Set();
                handlers.add(listener);
                listeners.set(type, handlers);
            },
            removeEventListener: (type: string, listener: (event: Event) => void) => {
                listeners.get(type)?.delete(listener);
            },
            dispatchEvent: (event: Event) => {
                for (const listener of listeners.get(event.type) ?? []) listener(event);
                return true;
            },
        });
        vi.stubGlobal('CustomEvent', class extends Event {
            detail: unknown;

            constructor(type: string, init?: { detail?: unknown }) {
                super(type);
                this.detail = init?.detail;
            }
        });
        vi.stubGlobal('document', { activeElement: null });
        document = new ProjectDocument();
        history = new CommandHistory(document);
        store = ConstraintStore.instance;
        store.clear();
        previousHistory = ContextManager.instance.commandHistory;
        ContextManager.instance.commandHistory = history;
        refreshSpy = vi.spyOn(ConstraintHighlightOverlay.instance, 'refresh').mockImplementation(() => {});
    });

    it('Escape usuwa niedokończony szkic jako krok historii, a Undo/Redo odtwarza usunięcie', () => {
        const draft = addConstraintDraft('GROUND', true);
        expect(store.get(draft.id)).not.toBeNull();

        window.dispatchEvent(Object.assign(new Event('keydown'), {
            key: 'Escape',
            stopPropagation: vi.fn(),
        }));

        expect(ContextManager.instance.activeConstraintPicker).toBeNull();
        expect(store.get(draft.id)).toBeNull();
        expect(history.lastUndoLabel).toBe('Anulowanie szkicu relacji');
        expect(history.undo()).toBe(true);
        expect(store.get(draft.id)).not.toBeNull();
        expect(history.redo()).toBe(true);
        expect(store.get(draft.id)).toBeNull();
    });

    it('anulowanie picku istniejącego, kompletnego więzu nie usuwa go', () => {
        const constraint = store.add({
            id: 'existing_constraint',
            bindType: 'GROUND',
            anchorA: { nodeId: 'node_a', kind: 'OBJECT', faceName: '', cornerIndex: -1 },
        });
        beginConstraintSlotPick({
            constraintId: constraint.id,
            slot: 'A',
            expectedKind: 'OBJECT',
        });
        window.dispatchEvent(Object.assign(new Event('keydown'), {
            key: 'Escape',
            stopPropagation: vi.fn(),
        }));

        expect(store.get(constraint.id)).not.toBeNull();
        expect(history.canUndo).toBe(false);
    });

    afterEach(() => {
        stopConstraintPick(false);
        refreshSpy.mockRestore();
        ContextManager.instance.commandHistory = previousHistory;
        vi.unstubAllGlobals();
    });
});
