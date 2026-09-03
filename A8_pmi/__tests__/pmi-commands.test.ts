import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { PMIAnnotationInit, PMIStore } from '../pmi-data.js';
import {
    AddDimensionCommand,
    AddMeasurementCommand,
    ClearDimensionsCommand,
    RemoveDimensionCommand,
    RemoveMeasurementCommand,
    SetDimensionAffixesCommand,
    SetDimensionOffsetCommand,
    SetDimensionVisibilityCommand,
    SetMeasurementVisibilityCommand,
} from '../pmi-commands.js';
import { v3 } from '../dimension-solver.js';
import type { PMIAnchorRef } from '../pmi-id-bridge.js';

function anchor(nodeId: string, x: number): PMIAnchorRef {
    return {
        nodeId,
        smartIdPath: `sb:main/part:${nodeId}`,
        kind: 'VERTEX',
        subKey: String(x),
        subIndex: -1,
        pointLocal: v3(x, 0, 0),
        pointWorldFallback: v3(x, 0, 0),
    };
}

function sampleInit(nodeId = 'panel_a'): PMIAnnotationInit {
    return {
        anchor1: anchor(nodeId, 0),
        anchor2: anchor(nodeId, 600),
        offset: v3(0, 30, 0),
        offsetSpace: 'LOCAL',
        axisSpace: 'GLOBAL',
        measureAxisKey: 'AUTO',
    };
}

describe('Komendy PMI w historii Undo/Redo', () => {
    let store: PMIStore;
    let history: CommandHistory;

    beforeEach(() => {
        store = PMIStore.instance;
        store.fromJSON(null);

        const document = new ProjectDocument({ name: 'PMI Test' });
        history = new CommandHistory(document, { maxEntries: 20 });
        ContextManager.instance.document = document;
        ContextManager.instance.commandHistory = history;
    });

    it('cofa i ponawia dodanie wymiaru zachowując jego identyfikator', () => {
        const command = new AddDimensionCommand(store, sampleInit());
        history.execute(command);

        const createdId = command.annotation!.id;
        expect(store.annotations).toHaveLength(1);

        history.undo();
        expect(store.annotations).toHaveLength(0);

        history.redo();
        expect(store.annotations).toHaveLength(1);
        expect(store.annotations[0].id).toBe(createdId);
    });

    it('przywraca usunięty wymiar na pierwotnej pozycji listy', () => {
        history.execute(new AddDimensionCommand(store, sampleInit('panel_a')));
        const middle = store.annotations[0];
        history.execute(new AddDimensionCommand(store, sampleInit('panel_b')));

        history.execute(new RemoveDimensionCommand(store, middle.id));
        expect(store.annotations.map(a => a.id)).not.toContain(middle.id);

        history.undo();
        expect(store.annotations[0].id).toBe(middle.id);
    });

    it('cofa wyczyszczenie całej listy', () => {
        history.execute(new AddDimensionCommand(store, sampleInit()));
        history.execute(new AddDimensionCommand(store, sampleInit()));

        history.execute(new ClearDimensionsCommand(store));
        expect(store.annotations).toHaveLength(0);

        history.undo();
        expect(store.annotations).toHaveLength(2);
    });

    it('cofa zmianę odsunięcia do poprzedniej wartości i układu', () => {
        history.execute(new AddDimensionCommand(store, sampleInit()));
        const ann = store.annotations[0];

        history.execute(new SetDimensionOffsetCommand(store, ann.id, v3(0, 0, 120), 'WORLD'));
        expect(ann.offset.z).toBeCloseTo(120, 6);
        expect(ann.offsetSpace).toBe('WORLD');

        history.undo();
        expect(ann.offset.y).toBeCloseTo(30, 6);
        expect(ann.offsetSpace).toBe('LOCAL');
    });

    it('cofa zmianę ramy GLOBAL/LOCAL razem z odsunięciem', () => {
        history.execute(new AddDimensionCommand(store, sampleInit()));
        const ann = store.annotations[0];

        history.execute(new SetDimensionOffsetCommand(
            store,
            ann.id,
            v3(0, 0, 80),
            'WORLD',
            { axisSpace: 'LOCAL', offsetAxisKey: 'Y' },
        ));
        expect(ann.axisSpace).toBe('LOCAL');
        expect(ann.offsetAxisKey).toBe('Y');

        history.undo();
        expect(ann.axisSpace).toBe('GLOBAL');
        expect(ann.offsetAxisKey).toBe('');
    });

    it('cofa zmianę opisu i odtwarza tekst etykiety', () => {
        history.execute(new AddDimensionCommand(store, sampleInit()));
        const ann = store.annotations[0];
        store.applyMeasuredValue(ann, 600, 'X');
        const originalText = ann.text;

        history.execute(new SetDimensionAffixesCommand(store, ann.id, 'L=', ' ref'));
        expect(ann.text).toBe(`L=${originalText} ref`);

        history.undo();
        expect(ann.text).toBe(originalText);
    });

    it('cofa ukrycie wymiaru', () => {
        history.execute(new AddDimensionCommand(store, sampleInit()));
        const ann = store.annotations[0];

        history.execute(new SetDimensionVisibilityCommand(store, ann.id, false));
        expect(ann.visible).toBe(false);

        history.undo();
        expect(ann.visible).toBe(true);
    });

    it('notuje węzły dotknięte zmianą, żeby widok mógł je odświeżyć', () => {
        const command = new AddDimensionCommand(store, sampleInit('panel_left'));
        expect(command.affectedNodeIds).toEqual(['panel_left', 'panel_left']);
    });

    it('cofa i ponawia dodanie pomiaru', () => {
        const command = new AddMeasurementCommand(store, {
            anchor1: anchor('panel_a', 0),
            anchor2: anchor('panel_a', 400),
        });
        history.execute(command);
        const createdId = command.measurement!.id;
        expect(store.measurements).toHaveLength(1);

        history.undo();
        expect(store.measurements).toHaveLength(0);

        history.redo();
        expect(store.measurements[0].id).toBe(createdId);

        history.execute(new RemoveMeasurementCommand(store, createdId));
        expect(store.measurements).toHaveLength(0);
        history.undo();
        expect(store.measurements[0].id).toBe(createdId);
    });

    it('ukrywa i przywraca widoczność pomiaru', () => {
        history.execute(new AddMeasurementCommand(store, {
            anchor1: anchor('panel_a', 0),
            anchor2: anchor('panel_a', 400),
        }));
        const id = store.measurements[0].id;
        expect(store.measurements[0].visible).toBe(true);

        history.execute(new SetMeasurementVisibilityCommand(store, id, false));
        expect(store.measurements[0].visible).toBe(false);

        history.execute(new SetMeasurementVisibilityCommand(store, id, true));
        expect(store.measurements[0].visible).toBe(true);

        history.undo();
        expect(store.measurements[0].visible).toBe(false);
        history.undo();
        expect(store.measurements[0].visible).toBe(true);
    });
});
