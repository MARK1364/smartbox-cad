import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { CommandHistory } from '../commands/command-history.js';
import { TransformNodeCommand } from '../commands/transform-node-command.js';
import { SetDimensionsCommand } from '../commands/set-dimensions-command.js';
import { AddNodeCommand } from '../commands/add-node-command.js';
import { RemoveNodeCommand } from '../commands/remove-node-command.js';
import { AddFeatureCommand, RemoveFeatureCommand, UpdateFeatureCommand } from '../commands/feature-commands.js';
import { Mat4 } from '../cad-math/mat4.js';
import { Vec3 } from '../cad-math/vec3.js';
import { Quat } from '../cad-math/quat.js';
import { mmToNm } from '../cad-math/units.js';

describe('CommandHistory and CAD Commands', () => {
    let doc: ProjectDocument;
    let history: CommandHistory;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'History Test' });
        history = new CommandHistory(doc, { maxEntries: 10 });
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
});
