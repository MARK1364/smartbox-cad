import { describe, expect, it, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import type { CNCProgramState } from '../core/cam-state-store.js';
import { applyFeatureEdit } from '../ui/cnc-feature-edit.js';
import { persistProgramInPanel } from '../ui/cnc-program-persistence.js';

function createPanelAndProgram() {
    const document = new ProjectDocument({ name: 'feature edit' });
    const panel = document.createPanel({
        width: mmToNm(600),
        height: mmToNm(720),
        thickness: mmToNm(18),
        name: 'Bok testowy'
    }) as any;

    const program: CNCProgramState = {
        id: 'prog_1',
        name: 'Program',
        targetPanel: panel,
        wcsName: 'G55',
        cornerIndex: -1,
        postprocessor: 'Mach3',
        isActive: true,
        features: [
            { featureId: 'f1', name: 'Stara nazwa' } as any,
            { featureId: 'f2', name: 'Inna operacja' } as any
        ],
        toolAssignments: {}
    };

    panel.cncPrograms = [program];
    return { document, panel, program };
}

describe('C1_CNC: edycja operacji', () => {
    it('aktualizuje właściwą cechę przez jedno wywołanie updateProg', () => {
        const updateProg = vi.fn();
        const updatedFeature = { featureId: 'f2', name: 'Nowa nazwa', depth: 5 } as any;

        applyFeatureEdit(updateProg, 'f2', updatedFeature);

        expect(updateProg).toHaveBeenCalledTimes(1);

        const updater = updateProg.mock.calls[0][0];
        const { program } = createPanelAndProgram();
        const next = updater(program);

        expect(next).not.toBe(program);
        expect(next.features[1]).toBe(updatedFeature);
        expect(next.features[0]).toBe(program.features[0]);
        // Oryginalny program pozostaje bez zmian aż do zapisu przez updateProg.
        expect(program.features[1].name).toBe('Inna operacja');
    });

    it('nie wywołuje updateProg bez featureId lub cechy', () => {
        const updateProg = vi.fn();

        applyFeatureEdit(updateProg, null, { featureId: 'f1' } as any);
        applyFeatureEdit(updateProg, 'f1', null);

        expect(updateProg).not.toHaveBeenCalled();
    });

    it('zapisuje edycję w liście formatki, więc trafia do PanelModel.toJSON()', () => {
        const { panel, program } = createPanelAndProgram();
        const updatedFeature = { featureId: 'f1', name: 'Po edycji' } as any;

        // Symulujemy updateProg(): aplikuje updater i zapisuje program do formatki.
        applyFeatureEdit((updater) => {
            persistProgramInPanel(panel, updater(program));
        }, 'f1', updatedFeature);

        const json = panel.toJSON();
        expect(json.cncPrograms).toHaveLength(1);
        expect(json.cncPrograms[0].features[0].name).toBe('Po edycji');
    });

    it('synchronizuje toolAssignments przy edycji cechy (dodanie, zmiana, usunięcie toolId)', () => {
        const updateProg = vi.fn();
        const { program } = createPanelAndProgram();
        program.toolAssignments = { f1: 'tool_old', f2: 'tool_other' };

        // 1. Zmiana narzędzia dla f1
        applyFeatureEdit(updateProg, 'f1', { featureId: 'f1', name: 'Zmienione narzędzie', toolId: 'tool_new' } as any);
        const updater1 = updateProg.mock.calls[0][0];
        const res1 = updater1(program);
        expect(res1.toolAssignments.f1).toBe('tool_new');
        expect(res1.toolAssignments.f2).toBe('tool_other');

        // 2. Usunięcie narzędzia (toolId: null / undefined)
        applyFeatureEdit(updateProg, 'f1', { featureId: 'f1', name: 'Bez narzędzia' } as any);
        const updater2 = updateProg.mock.calls[1][0];
        const res2 = updater2(res1);
        expect(res2.toolAssignments.f1).toBeUndefined();
        expect(res2.toolAssignments.f2).toBe('tool_other');
    });
});
