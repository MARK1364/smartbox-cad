import { describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { executeCncCommand } from '../commands/execute-with-history.js';
import { CreateCncProgramCommand } from '../commands/create-cnc-program-command.js';
import { RemoveCncProgramCommand } from '../commands/remove-cnc-program-command.js';

function createPanelDocument() {
    const document = new ProjectDocument({ name: 'CNC history guard' });
    const panel = document.createPanel({
        width: mmToNm(600),
        height: mmToNm(720),
        thickness: mmToNm(18),
        name: 'Bok testowy'
    }) as any;
    return { document, panel };
}

function createProgram(panel: any, id: string) {
    return {
        id,
        name: `Program ${id}`,
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

describe('C1_CNC: executeCncCommand', () => {
    it('blokuje tworzenie programu bez historii i nie zmienia formatki', () => {
        const { document, panel } = createPanelDocument();
        const command = new CreateCncProgramCommand(panel, createProgram(panel, 'prog_new'));

        expect(executeCncCommand(null, document, command)).toBe(false);
        expect(panel.cncPrograms).toHaveLength(0);
    });

    it('blokuje usuwanie programu bez historii i nie zmienia formatki', () => {
        const { document, panel } = createPanelDocument();
        panel.cncPrograms = [createProgram(panel, 'prog_existing')];
        const command = new RemoveCncProgramCommand(panel, 'prog_existing');

        expect(executeCncCommand(null, document, command)).toBe(false);
        expect(panel.cncPrograms).toHaveLength(1);
        expect(panel.cncPrograms[0].id).toBe('prog_existing');
    });

    it('blokuje operację bez dokumentu, nawet gdy historia istnieje', () => {
        const { panel } = createPanelDocument();
        const history = new CommandHistory(new ProjectDocument());
        const command = new RemoveCncProgramCommand(panel, 'prog_existing');

        expect(executeCncCommand(history, null, command)).toBe(false);
        expect(panel.cncPrograms).toHaveLength(0);
    });

    it('wykonuje operację przez historię, gdy historia i dokument są dostępne', () => {
        const { document, panel } = createPanelDocument();
        const history = new CommandHistory(document);
        const command = new CreateCncProgramCommand(panel, createProgram(panel, 'prog_new'));

        expect(executeCncCommand(history, document, command)).toBe(true);
        expect(panel.cncPrograms).toHaveLength(1);
        expect(history.canUndo).toBe(true);
    });
});
