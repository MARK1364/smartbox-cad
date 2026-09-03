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
        const container = doc.createContainer({ name: 'Szafa' });
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
        const container = doc.createContainer({ name: 'Szafa' });
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
        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720) });
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
        const container = doc.createContainer({ name: 'Szafa' });
        const panel = doc.createPanel({ name: 'Formatka' });
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
        const panel: any = doc.createPanel({ name: 'Formatka z otworkiem' });
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
});
