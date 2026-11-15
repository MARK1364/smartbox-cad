import { describe, expect, it, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { MacroCommand } from '../../A1_core/commands/macro-command.js';
import type { Command } from '../../A1_core/commands/command.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { CAMStateStore } from '../core/cam-state-store.js';
import { CreateCncProgramCommand } from '../commands/create-cnc-program-command.js';

function createPanelDocument() {
    const document = new ProjectDocument({ name: 'CNC command' });
    const panel = document.createPanel({
        width: mmToNm(600),
        height: mmToNm(720),
        thickness: mmToNm(18),
        name: 'Bok testowy'
    }) as any;
    return { document, panel };
}

function createProgram(panel: any, id = 'prog_test') {
    return {
        id,
        name: 'Program testowy',
        targetPanel: panel,
        targetPanelId: String(panel.id || ''),
        targetPanelLabel: panel.name,
        wcsName: 'G55',
        cornerIndex: -1,
        postprocessor: 'Mach3',
        isActive: true,
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

describe('C1_CNC: CreateCncProgramCommand', () => {
    it('dodaje program do formatki i pozwala go cofnąć oraz ponowić', () => {
        const { document, panel } = createPanelDocument();
        const history = new CommandHistory(document);
        const onProgramsChanged = vi.fn();

        history.execute(new CreateCncProgramCommand(panel, createProgram(panel), { onProgramsChanged }));

        expect(panel.cncPrograms).toHaveLength(1);
        expect(panel.cncPrograms[0].id).toBe('prog_test');
        expect(panel.cncPrograms[0].targetPanel).toBe(panel);
        expect(onProgramsChanged).toHaveBeenLastCalledWith(panel);

        history.undo();
        expect(panel.cncPrograms).toHaveLength(0);
        expect(onProgramsChanged).toHaveBeenLastCalledWith(panel);

        history.redo();
        expect(panel.cncPrograms).toHaveLength(1);
        expect(panel.cncPrograms[0].id).toBe('prog_test');
    });

    it('dezaktywuje poprzedni program i przywraca jego stan przy Undo', () => {
        const { document, panel } = createPanelDocument();
        const history = new CommandHistory(document);
        const previousProgram = { ...createProgram(panel, 'prog_previous'), isActive: true };
        const inactiveProgram = { ...createProgram(panel, 'prog_inactive'), isActive: false };
        panel.cncPrograms = [previousProgram, inactiveProgram];

        history.execute(new CreateCncProgramCommand(panel, createProgram(panel, 'prog_new')));

        expect(panel.cncPrograms).toHaveLength(3);
        expect(panel.cncPrograms.filter((p: any) => p.isActive).map((p: any) => p.id)).toEqual(['prog_new']);

        history.undo();
        expect(panel.cncPrograms).toHaveLength(2);
        expect(previousProgram.isActive).toBe(true);
        expect(inactiveProgram.isActive).toBe(false);

        history.redo();
        expect(panel.cncPrograms).toHaveLength(3);
        expect(panel.cncPrograms.filter((p: any) => p.isActive).map((p: any) => p.id)).toEqual(['prog_new']);
    });

    it('nie duplikuje programu przy ponownym execute i powiadamia dokument', () => {
        const { document, panel } = createPanelDocument();
        const onDocumentChanged = vi.fn();
        document.onDocumentChanged(onDocumentChanged);

        const command = new CreateCncProgramCommand(panel, createProgram(panel));
        command.execute(document);
        command.execute(document);

        expect(panel.cncPrograms).toHaveLength(1);
        expect(onDocumentChanged).toHaveBeenCalledTimes(1);

        command.undo(document);
        expect(panel.cncPrograms).toHaveLength(0);
    });

    it('wyjątek listenera po commicie nie blokuje wpisu Undo', () => {
        const { document, panel } = createPanelDocument();
        const history = new CommandHistory(document);
        const logError = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            const command = new CreateCncProgramCommand(panel, createProgram(panel, 'prog_new'), {
                onProgramsChanged: () => { throw new Error('store listener failure'); }
            });

            expect(() => history.execute(command)).not.toThrow();

            // Mutacja i zdarzenie dokumentu już się dokonały, a komenda mimo błędu
            // listenera musi być cofalna.
            expect(panel.cncPrograms).toHaveLength(1);
            expect(history.canUndo).toBe(true);

            history.undo();
            expect(panel.cncPrograms).toHaveLength(0);
            expect(history.canRedo).toBe(true);

            expect(logError).toHaveBeenCalledWith(
                'ProjectDocument afterCommit effect failed:',
                expect.objectContaining({ message: 'store listener failure' })
            );
        } finally {
            logError.mockRestore();
        }
    });

    it('rollback makra nie publikuje nowego programu do CAMStateStore', () => {
        const { document, panel } = createPanelDocument();
        const history = new CommandHistory(document);
        const store = CAMStateStore.getInstance();
        store.setPrograms([]);
        store.setActiveProgramId(null);

        const storeListener = vi.fn();
        const unsubscribe = store.subscribe(storeListener);

        try {
            const onProgramsChanged = (changedPanel: any) => {
                const nextPrograms = Array.isArray(changedPanel?.cncPrograms) ? changedPanel.cncPrograms : [];
                store.setPrograms([...nextPrograms]);
                store.setActiveProgramId(nextPrograms.find((p: any) => p?.isActive)?.id ?? null);
            };

            const macro = new MacroCommand([
                new CreateCncProgramCommand(panel, createProgram(panel, 'prog_new'), { onProgramsChanged }),
                createFailingCommand()
            ], 'Makro tworzenia z błędem');

            expect(() => history.execute(macro)).toThrow('macro failure');

            expect(storeListener).not.toHaveBeenCalled();
            expect(store.getState().programs).toEqual([]);
            expect(store.getState().activeProgramId).toBeNull();
            expect(panel.cncPrograms).toHaveLength(0);
        } finally {
            unsubscribe();
        }
    });
});
