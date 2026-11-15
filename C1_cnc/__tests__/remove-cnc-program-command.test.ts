import { describe, expect, it, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { MacroCommand } from '../../A1_core/commands/macro-command.js';
import type { Command } from '../../A1_core/commands/command.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { CAMStateStore } from '../core/cam-state-store.js';
import { RemoveCncProgramCommand } from '../commands/remove-cnc-program-command.js';

function createPanelDocument() {
    const document = new ProjectDocument({ name: 'CNC remove command' });
    const panel = document.createPanel({
        width: mmToNm(600),
        height: mmToNm(720),
        thickness: mmToNm(18),
        name: 'Bok testowy'
    }) as any;
    return { document, panel };
}

function createProgram(panel: any, id: string, isActive = false) {
    return {
        id,
        name: `Program ${id}`,
        targetPanel: panel,
        targetPanelId: String(panel.id || ''),
        targetPanelLabel: panel.name,
        wcsName: 'G55',
        cornerIndex: -1,
        postprocessor: 'Mach3',
        isActive,
        features: [],
        toolAssignments: {}
    };
}

function createFailingCommand(): Command {
    return {
        id: 'cmd_failing',
        label: 'Błąd testowy',
        timestamp: Date.now(),
        affectedNodeIds: [],
        execute() {
            throw new Error('macro failure');
        },
        undo() {
            // brak zmian do cofnięcia
        }
    };
}

describe('C1_CNC: RemoveCncProgramCommand', () => {
    it('usuwa program, zachowuje kolejność i przywraca go wraz z aktywnością przy Undo', () => {
        const { document, panel } = createPanelDocument();
        const history = new CommandHistory(document);
        const first = createProgram(panel, 'prog_first');
        const active = createProgram(panel, 'prog_active', true);
        const last = createProgram(panel, 'prog_last');
        panel.cncPrograms = [first, active, last];

        history.execute(new RemoveCncProgramCommand(panel, 'prog_active'));

        expect(panel.cncPrograms.map((p: any) => p.id)).toEqual(['prog_first', 'prog_last']);
        expect(panel.cncPrograms.filter((p: any) => p.isActive).map((p: any) => p.id)).toEqual(['prog_first']);

        history.undo();

        expect(panel.cncPrograms.map((p: any) => p.id)).toEqual(['prog_first', 'prog_active', 'prog_last']);
        expect(panel.cncPrograms.filter((p: any) => p.isActive).map((p: any) => p.id)).toEqual(['prog_active']);
        expect(panel.cncPrograms[0].isActive).toBe(false);
        expect(panel.cncPrograms[2].isActive).toBe(false);

        history.redo();
        expect(panel.cncPrograms.map((p: any) => p.id)).toEqual(['prog_first', 'prog_last']);
        expect(panel.cncPrograms.filter((p: any) => p.isActive).map((p: any) => p.id)).toEqual(['prog_first']);
    });

    it('usunięcie nieaktywnego programu nie zmienia aktywnego programu', () => {
        const { document, panel } = createPanelDocument();
        const history = new CommandHistory(document);
        const active = createProgram(panel, 'prog_active', true);
        const inactive = createProgram(panel, 'prog_inactive');
        panel.cncPrograms = [active, inactive];

        history.execute(new RemoveCncProgramCommand(panel, 'prog_inactive'));

        expect(panel.cncPrograms.map((p: any) => p.id)).toEqual(['prog_active']);
        expect(panel.cncPrograms[0].isActive).toBe(true);

        history.undo();
        expect(panel.cncPrograms.map((p: any) => p.id)).toEqual(['prog_active', 'prog_inactive']);
        expect(panel.cncPrograms[0].isActive).toBe(true);
        expect(panel.cncPrograms[1].isActive).toBe(false);
    });

    it('nie powiadamia dokumentu ani UI, gdy program nie istnieje', () => {
        const { document, panel } = createPanelDocument();
        panel.cncPrograms = [createProgram(panel, 'prog_existing', true)];
        const onProgramsChanged = vi.fn();
        const onDocumentChanged = vi.fn();
        document.onDocumentChanged(onDocumentChanged);

        new RemoveCncProgramCommand(panel, 'prog_missing', { onProgramsChanged }).execute(document);

        expect(panel.cncPrograms).toHaveLength(1);
        expect(onProgramsChanged).not.toHaveBeenCalled();
        expect(onDocumentChanged).not.toHaveBeenCalled();
    });

    it('przy kilku aktywnych programach zostawia dokładnie jeden, a Undo przywraca wszystkie flagi', () => {
        const { document, panel } = createPanelDocument();
        const history = new CommandHistory(document);
        const first = createProgram(panel, 'prog_first', true);
        const removed = createProgram(panel, 'prog_removed', true);
        const last = createProgram(panel, 'prog_last', true);
        panel.cncPrograms = [first, removed, last];

        history.execute(new RemoveCncProgramCommand(panel, 'prog_removed'));

        expect(panel.cncPrograms.map((p: any) => p.id)).toEqual(['prog_first', 'prog_last']);
        // Deterministycznie zostaje pierwszy aktywny na liście, pozostałe są wyłączone.
        expect(panel.cncPrograms.filter((p: any) => p.isActive).map((p: any) => p.id)).toEqual(['prog_first']);
        expect(last.isActive).toBe(false);

        history.undo();

        // Undo odtwarza wszystkie wcześniejsze flagi, także wiele aktywnych.
        expect(panel.cncPrograms.map((p: any) => p.id)).toEqual(['prog_first', 'prog_removed', 'prog_last']);
        expect(panel.cncPrograms.filter((p: any) => p.isActive).map((p: any) => p.id))
            .toEqual(['prog_first', 'prog_removed', 'prog_last']);
    });

    it('rollback makra nie publikuje przejściowego stanu w CAMStateStore', () => {
        const { document, panel } = createPanelDocument();
        const history = new CommandHistory(document);
        const store = CAMStateStore.getInstance();
        store.setPrograms([]);
        store.setActiveProgramId(null);

        const storeListener = vi.fn();
        const unsubscribe = store.subscribe(storeListener);

        try {
            const active = createProgram(panel, 'prog_active', true);
            const other = createProgram(panel, 'prog_other', false);
            panel.cncPrograms = [active, other];

            const onProgramsChanged = (changedPanel: any) => {
                const nextPrograms = Array.isArray(changedPanel?.cncPrograms) ? changedPanel.cncPrograms : [];
                store.setPrograms([...nextPrograms]);
                store.setActiveProgramId(nextPrograms.find((p: any) => p?.isActive)?.id ?? null);
            };

            const macro = new MacroCommand([
                new RemoveCncProgramCommand(panel, 'prog_active', { onProgramsChanged }),
                createFailingCommand()
            ], 'Makro usuwania z błędem');

            expect(() => history.execute(macro)).toThrow('macro failure');

            // Rollback nie może opublikować pośredniego stanu sprzed cofnięcia.
            expect(storeListener).not.toHaveBeenCalled();
            expect(store.getState().programs).toEqual([]);
            expect(store.getState().activeProgramId).toBeNull();

            // Sam dokument i formatka wracają do stanu przed makrem.
            expect(panel.cncPrograms.map((p: any) => p.id)).toEqual(['prog_active', 'prog_other']);
            expect(active.isActive).toBe(true);
            expect(other.isActive).toBe(false);
        } finally {
            unsubscribe();
        }
    });
});
