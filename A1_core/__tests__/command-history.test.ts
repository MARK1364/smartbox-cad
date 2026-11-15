import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { CommandHistory } from '../commands/command-history.js';
import { TransformNodeCommand } from '../commands/transform-node-command.js';
import { SetDimensionsCommand } from '../commands/set-dimensions-command.js';
import { AddNodeCommand } from '../commands/add-node-command.js';
import { RemoveNodeCommand } from '../commands/remove-node-command.js';
import { MacroCommand } from '../commands/macro-command.js';
import { registerNodeCleanupHandler, resetNodeCleanupHandlersForTests } from '../node-cleanup-port.js';
import { AddFeatureCommand, RemoveFeatureCommand, UpdateFeatureCommand } from '../commands/feature-commands.js';
import { Mat4 } from '../cad-math/mat4.js';
import { Vec3 } from '../cad-math/vec3.js';
import { Quat } from '../cad-math/quat.js';
import { mmToNm } from '../cad-math/units.js';

describe('CommandHistory and CAD Commands', () => {
    let doc: ProjectDocument;
    let history: CommandHistory;

    beforeEach(() => {
        resetNodeCleanupHandlersForTests();
        doc = new ProjectDocument({ name: 'History Test' });
        history = new CommandHistory(doc, { maxEntries: 10 });
    });

    afterEach(() => {
        resetNodeCleanupHandlersForTests();
    });

    it('should track undo and redo stack state', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const cadNode = doc.findNode(container.id)!;
        const initialMatrix = cadNode.localMatrix.clone();

        const newMatrix = Mat4.fromTRS(new Vec3(mmToNm(500), 0, 0), Quat.IDENTITY);
        const cmd = new TransformNodeCommand(container.id, initialMatrix, newMatrix, 'Przesuń szafę');

        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(false);

        history.execute(cmd);

        expect(history.canUndo).toBe(true);
        expect(history.canRedo).toBe(false);
        expect(cadNode.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(500), -2);

        history.undo();

        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(true);
        expect(cadNode.localMatrix.decompose().translation.x).toBeCloseTo(0, -2);

        history.redo();

        expect(history.canUndo).toBe(true);
        expect(history.canRedo).toBe(false);
        expect(cadNode.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(500), -2);
    });

    it('should clear redo stack when a new command is executed after undo', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const cadNode = doc.findNode(container.id)!;
        const m0 = cadNode.localMatrix.clone();
        const m1 = Mat4.fromTRS(new Vec3(mmToNm(100), 0, 0), Quat.IDENTITY);
        const m2 = Mat4.fromTRS(new Vec3(mmToNm(200), 0, 0), Quat.IDENTITY);

        history.execute(new TransformNodeCommand(container.id, m0, m1, 'Przesunięcie 1'));
        history.undo();
        expect(history.canRedo).toBe(true);

        history.execute(new TransformNodeCommand(container.id, m0, m2, 'Przesunięcie 2'));
        expect(history.canRedo).toBe(false);
        expect(history.undoStack).toHaveLength(1);
    });

    it('should handle SetDimensionsCommand undo and redo', () => {
        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18) });
        const oldDims = { width: panel.width, height: panel.height };
        const newDims = { width: mmToNm(800), height: mmToNm(900) };

        const cmd = new SetDimensionsCommand(panel.id, oldDims, newDims);
        history.execute(cmd);

        expect(panel.width).toBe(mmToNm(800));
        expect(panel.height).toBe(mmToNm(900));

        history.undo();

        expect(panel.width).toBe(mmToNm(600));
        expect(panel.height).toBe(mmToNm(720));
    });

    it('SetDimensionsCommand zmienia grubość niezależnie od materiału i syncuje thickness_mm', () => {
        const panel = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            materialId: 'W1100_ST9_18',
        }) as any;
        (panel as any).custom_properties = {
            ...(panel.custom_properties || {}),
            thickness_mm: 18,
            material: 'W1100_ST9_18',
        };

        const cmd = new SetDimensionsCommand(
            panel.id,
            { width: panel.width, height: panel.height, thickness: panel.thickness },
            { width: panel.width, height: panel.height, thickness: mmToNm(22) },
            { label: 'Grubość formatki' },
        );
        history.execute(cmd);

        expect(panel.thickness).toBe(mmToNm(22));
        expect(panel.custom_properties.thickness_mm).toBe(22);
        expect(panel.materialId).toBe('W1100_ST9_18');

        history.undo();
        expect(panel.thickness).toBe(mmToNm(18));
        expect(panel.custom_properties.thickness_mm).toBe(18);
    });

    it('should handle AddNodeCommand and RemoveNodeCommand', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Formatka' });
        const panelNode = doc.findNode(panel.id)!;
        const containerNode = doc.findNode(container.id)!;
        doc.removeNode(panel.id); // Odpięcie dla celów testu add

        const addCmd = new AddNodeCommand(container.id, panelNode, undefined, 'Dodaj formatkę');
        history.execute(addCmd);

        expect(doc.findNode(panel.id)).toBe(panelNode);
        expect(panelNode.parent).toBe(containerNode);

        const removeCmd = new RemoveNodeCommand(doc, panel.id, 'Usuń formatkę');
        history.execute(removeCmd);

        expect(doc.findNode(panel.id)).toBeNull();

        history.undo(); // Odzyskanie usuniętej formatki

        expect(doc.findNode(panel.id)).toBe(panelNode);
        expect(panelNode.parent).toBe(containerNode);
    });

    it('RemoveNodeCommand rolls back successful cleanup when a later cleanup fails', () => {
        const container = doc.createAssembly({ name: 'Korpus' });
        const panel = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Panel zewnętrzny',
        }) as any;
        const containerNode = doc.findNode(container.id)!;
        const panelNode = doc.findNode(panel.id)!;
        const originalFeatures = [...panel.features];
        const initialRevision = doc.revision;
        const publishedChanges: unknown[] = [];
        doc.onDocumentChanged((change) => publishedChanges.push(change));

        registerNodeCleanupHandler({
            id: 'command-history-atomicity-test',
            collectIds: () => ['first', 'second'],
            createClearCommand: (id) => ({
                id: `cleanup-${id}`,
                label: `Cleanup ${id}`,
                timestamp: 0,
                affectedNodeIds: [panel.id],
                execute: (document) => {
                    if (id === 'second') throw new Error('Second cleanup failed');
                    panel.features.push({ id: 'temporary', type: 'hole' });
                    document.emitChange('features', [panel.id]);
                },
                undo: (document) => {
                    panel.features.splice(0, panel.features.length, ...originalFeatures);
                    document.emitChange('features', [panel.id]);
                },
            }),
        });

        const command = new RemoveNodeCommand(doc, container.id);
        expect(() => history.execute(command)).toThrow('Second cleanup failed');

        expect(doc.findNode(container.id)).toBe(containerNode);
        expect(containerNode.parent).toBe(doc.rootNode);
        expect(panel.features).toEqual(originalFeatures);
        expect(doc.revision).toBe(initialRevision);
        expect(publishedChanges).toEqual([]);
        expect(history.undoStack).toEqual([]);
        expect(history.redoStack).toEqual([]);
    });

    it('MacroCommand rolls back completed commands when a later command fails', () => {
        const container = doc.createAssembly({ name: 'Korpus' });
        const node = doc.findNode(container.id)!;
        const originalMatrix = node.localMatrix.clone();
        const nextMatrix = Mat4.fromTRS(new Vec3(mmToNm(120), 0, 0), Quat.IDENTITY);
        const initialRevision = doc.revision;
        const publishedChanges: unknown[] = [];
        doc.onDocumentChanged((change) => publishedChanges.push(change));
        const failingCommand = {
            id: 'failing-command',
            label: 'Fail',
            timestamp: 0,
            affectedNodeIds: [container.id],
            execute: () => { throw new Error('Later command failed'); },
            undo: () => {},
        };

        const macro = new MacroCommand([
            new TransformNodeCommand(container.id, originalMatrix, nextMatrix),
            failingCommand,
        ]);
        expect(() => history.execute(macro)).toThrow('Later command failed');

        expect(node.localMatrix.equals(originalMatrix)).toBe(true);
        expect(doc.revision).toBe(initialRevision);
        expect(publishedChanges).toEqual([]);
        expect(history.undoStack).toEqual([]);
        expect(history.redoStack).toEqual([]);
    });

    it('MacroCommand does not compensate RemoveNodeCommand twice after nested transaction rollback', () => {
        const container = doc.createAssembly({ name: 'Korpus' });
        const containerNode = doc.findNode(container.id)!;
        const cleanupState = ['linked-hole'];
        let cleanupUndoCalls = 0;
        const initialRevision = doc.revision;
        const publishedChanges: unknown[] = [];
        doc.onDocumentChanged((change) => publishedChanges.push(change));

        registerNodeCleanupHandler({
            id: 'macro-remove-node-atomicity-test',
            collectIds: () => ['linked-hole'],
            createClearCommand: (id) => ({
                id: `cleanup-${id}`,
                label: `Cleanup ${id}`,
                timestamp: 0,
                affectedNodeIds: [container.id],
                execute: (document) => {
                    cleanupState.splice(cleanupState.indexOf(id), 1);
                    document.emitChange('features', [container.id]);
                },
                undo: (document) => {
                    cleanupUndoCalls++;
                    cleanupState.push(id);
                    document.emitChange('features', [container.id]);
                },
            }),
        });
        const failingCommand = {
            id: 'failing-command',
            label: 'Fail',
            timestamp: 0,
            affectedNodeIds: [container.id],
            execute: () => { throw new Error('Later macro step failed'); },
            undo: () => {},
        };
        const macro = new MacroCommand([
            new RemoveNodeCommand(doc, container.id),
            failingCommand,
        ]);

        expect(() => history.execute(macro)).toThrow('Later macro step failed');

        expect(doc.findNode(container.id)).toBe(containerNode);
        expect(cleanupState).toEqual(['linked-hole']);
        expect(cleanupUndoCalls).toBe(1);
        expect(doc.revision).toBe(initialRevision);
        expect(publishedChanges).toEqual([]);
        expect(history.undoStack).toEqual([]);
        expect(history.redoStack).toEqual([]);
    });

    it('nested MacroCommand restores a removed feature exactly once after outer rollback', () => {
        const panel = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Panel z cechą',
        }) as any;
        const feature = { id: 'hole-to-restore', type: 'hole', diameter: 8, depth: 14 };
        panel.features.push(feature);
        const initialRevision = doc.revision;
        const publishedChanges: unknown[] = [];
        doc.onDocumentChanged((change) => publishedChanges.push(change));
        const innerMacro = new MacroCommand([
            new RemoveFeatureCommand(doc, panel.id, feature.id),
        ]);
        const failingCommand = {
            id: 'failing-command',
            label: 'Fail',
            timestamp: 0,
            affectedNodeIds: [panel.id],
            execute: () => { throw new Error('Later outer step failed'); },
            undo: () => {},
        };
        const outerMacro = new MacroCommand([innerMacro, failingCommand]);

        expect(() => history.execute(outerMacro)).toThrow('Later outer step failed');

        expect(panel.features).toEqual([feature]);
        expect(panel.features.filter((item: any) => item.id === feature.id)).toHaveLength(1);
        expect(doc.revision).toBe(initialRevision);
        expect(publishedChanges).toEqual([]);
        expect(history.undoStack).toEqual([]);
        expect(history.redoStack).toEqual([]);
    });

    it('should handle feature commands (hole, groove)', () => {
        const panel: any = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Formatka z otworkiem' });
        const holeFeature = { id: 'hole_1', type: 'hole', diameter: 8, depth: 14 };

        const addFeatCmd = new AddFeatureCommand(panel.id, holeFeature, undefined, 'Dodaj otwór');
        history.execute(addFeatCmd);

        expect(panel.features).toHaveLength(1);
        expect(panel.features[0].id).toBe('hole_1');

        const updateFeatCmd = new UpdateFeatureCommand(panel.id, 'hole_1', { diameter: 8 }, { diameter: 10 });
        history.execute(updateFeatCmd);

        expect(panel.features[0].diameter).toBe(10);

        history.undo();

        expect(panel.features[0].diameter).toBe(8);

        const removeFeatCmd = new RemoveFeatureCommand(doc, panel.id, 'hole_1', 'Usuń otwór');
        history.execute(removeFeatCmd);

        expect(panel.features).toHaveLength(0);

        history.undo();

        expect(panel.features).toHaveLength(1);
        expect(panel.features[0].id).toBe('hole_1');
    });

    it('AddFeatureCommand undo removes the added feature by ID after external list changes', () => {
        const panel: any = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Panel z operacjami',
        });
        panel.features = [
            { id: 'existing', type: 'hole' },
            { id: 'another', type: 'groove' },
        ];
        const command = new AddFeatureCommand(panel.id, { id: 'added', type: 'hole' }, 1);

        history.execute(command);
        panel.features.unshift({ id: 'synced', type: 'hole' });
        history.undo();

        expect(panel.features.map((feature: any) => feature.id)).toEqual([
            'synced', 'existing', 'another',
        ]);
    });

    it('restores a removed feature relative to neighboring IDs after external list changes', () => {
        const panel: any = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Panel z operacjami',
        });
        panel.features = [
            { id: 'before', type: 'hole' },
            { id: 'removed', type: 'groove' },
            { id: 'after', type: 'hole' },
        ];
        const command = new RemoveFeatureCommand(doc, panel.id, 'removed');

        history.execute(command);
        panel.features.unshift({ id: 'synced-before', type: 'hole' });
        history.undo();

        expect(panel.features.map((feature: any) => feature.id)).toEqual([
            'synced-before', 'before', 'removed', 'after',
        ]);
    });

    it('redo removes the feature by ID, not its stale original index', () => {
        const panel: any = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Panel z operacjami',
        });
        panel.features = [
            { id: 'before', type: 'hole' },
            { id: 'removed', type: 'groove' },
            { id: 'after', type: 'hole' },
        ];
        const command = new RemoveFeatureCommand(doc, panel.id, 'removed');

        history.execute(command);
        history.undo();
        panel.features.unshift({ id: 'synced-before', type: 'hole' });
        history.redo();

        expect(panel.features.map((feature: any) => feature.id)).toEqual([
            'synced-before', 'before', 'after',
        ]);
    });

    it('cofa różne typy edycji w jednej chronologicznej kolejności (LIFO)', () => {
        // 1) Dodaj korpus
        const cabinet = doc.createAssembly({ name: 'Korpus', width: mmToNm(600), height: mmToNm(720), depth: mmToNm(500) });
        const cabinetNode = doc.findNode(cabinet.id)!;
        doc.removeNode(cabinet.id);
        history.execute(new AddNodeCommand(doc.rootNode.id, cabinetNode, undefined, 'Dodaj korpus'));
        expect(doc.findNode(cabinet.id)).toBe(cabinetNode);

        // 2) Przesuń korpus
        const m0 = cabinetNode.localMatrix.clone();
        const m1 = Mat4.fromTRS(new Vec3(mmToNm(300), 0, 0), Quat.IDENTITY);
        history.execute(new TransformNodeCommand(cabinet.id, m0, m1, 'Przesuń korpus'));
        expect(cabinetNode.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(300), -2);

        // 3) Zmień wymiary korpusu
        const oldDims = { width: cabinet.width, height: cabinet.height, depth: (cabinet as any).depth };
        const newDims = { width: mmToNm(900), height: mmToNm(2000), depth: mmToNm(560) };
        history.execute(new SetDimensionsCommand(cabinet.id, oldDims, newDims, { label: 'Wymiary korpusu' }));
        expect(cabinet.width).toBe(mmToNm(900));
        expect(cabinet.height).toBe(mmToNm(2000));

        // 4) Dodaj formatkę + otwór
        const panel: any = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Bok',
        });
        const panelNode = doc.findNode(panel.id)!;
        doc.removeNode(panel.id);
        history.execute(new AddNodeCommand(cabinet.id, panelNode, undefined, 'Dodaj formatkę'));
        expect(panelNode.parent).toBe(cabinetNode);

        history.execute(new AddFeatureCommand(panel.id, { id: 'h1', type: 'hole', diameter: 5 }, undefined, 'Dodaj otwór'));
        expect(panel.features).toHaveLength(1);

        expect(history.undoStack.map((c) => c.label)).toEqual([
            'Dodaj korpus',
            'Przesuń korpus',
            'Wymiary korpusu',
            'Dodaj formatkę',
            'Dodaj otwór',
        ]);
        expect(history.canRedo).toBe(false);

        // Undo LIFO — ostatnia edycja pierwsza
        expect(history.lastUndoLabel).toBe('Dodaj otwór');
        history.undo();
        expect(panel.features).toHaveLength(0);
        expect(doc.findNode(panel.id)).toBe(panelNode);

        expect(history.lastUndoLabel).toBe('Dodaj formatkę');
        history.undo();
        expect(doc.findNode(panel.id)).toBeNull();
        expect(cabinet.width).toBe(mmToNm(900));

        expect(history.lastUndoLabel).toBe('Wymiary korpusu');
        history.undo();
        expect(cabinet.width).toBe(oldDims.width);
        expect(cabinet.height).toBe(oldDims.height);
        expect(cabinetNode.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(300), -2);

        expect(history.lastUndoLabel).toBe('Przesuń korpus');
        history.undo();
        expect(cabinetNode.localMatrix.decompose().translation.x).toBeCloseTo(0, -2);
        expect(doc.findNode(cabinet.id)).toBe(cabinetNode);

        expect(history.lastUndoLabel).toBe('Dodaj korpus');
        history.undo();
        expect(doc.findNode(cabinet.id)).toBeNull();
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(true);
        expect(history.redoStack.map((c) => c.label)).toEqual([
            'Dodaj otwór',
            'Dodaj formatkę',
            'Wymiary korpusu',
            'Przesuń korpus',
            'Dodaj korpus',
        ]);
        expect(history.lastRedoLabel).toBe('Dodaj korpus');

        // Redo przywraca tę samą chronologię do przodu
        history.redo();
        expect(doc.findNode(cabinet.id)).toBe(cabinetNode);
        history.redo();
        expect(cabinetNode.localMatrix.decompose().translation.x).toBeCloseTo(mmToNm(300), -2);
        history.redo();
        expect(cabinet.width).toBe(mmToNm(900));
        history.redo();
        expect(doc.findNode(panel.id)).toBe(panelNode);
        history.redo();
        expect(panel.features).toHaveLength(1);
        expect(history.canRedo).toBe(false);
        expect(history.undoStack).toHaveLength(5);
    });

    it('undo zachowuje komendę na stosie gdy command.undo() rzuci wyjątek', () => {
        const failingCmd = {
            label: 'Zepsuta komenda',
            execute: () => {},
            undo: () => { throw new Error('Błąd cofania'); }
        };
        history.execute(failingCmd as any);
        expect(history.canUndo).toBe(true);
        expect(() => history.undo()).toThrow('Błąd cofania');
        // Komenda NIE przepadła ze stosu:
        expect(history.canUndo).toBe(true);
        expect(history.lastUndoLabel).toBe('Zepsuta komenda');
        expect(history.canRedo).toBe(false);
    });
});
