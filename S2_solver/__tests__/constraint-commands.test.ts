import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { MacroCommand } from '../../A1_core/commands/macro-command.js';
import { RemoveNodeCommand } from '../../A1_core/commands/remove-node-command.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { ConstraintStore } from '../constraint-store.js';
import { AddConstraintCommand, RemoveConstraintCommand, UpdateConstraintCommand } from '../constraint-commands.js';
import { cloneSolverConstraint, makeAnchor, makeSolverConstraint } from '../constraint-types.js';
import { SolverController } from '../solver-controller.js';
import { ConstraintHighlightOverlay } from '../constraint-highlight.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';

describe('S2_solver — Undo / Redo relacji (constraint-commands)', () => {
    let document: ProjectDocument;
    let history: CommandHistory;
    let store: ConstraintStore;

    beforeEach(() => {
        document = new ProjectDocument();
        history = new CommandHistory(document);
        store = ConstraintStore.instance;
        store.clear();
    });

    it('AddConstraintCommand: Undo usuwa relację z magazynu i cofa pozycje, Redo ją przywraca', () => {
        const panelA = CADNode.create(NodeType.PART, 'panelA', 'node_test_1');
        document.addNode(document.rootNode.id, panelA);
        const beforeMat = panelA.localMatrix.clone();

        const afterMat = beforeMat.clone();
        afterMat.data[12] = 200; // przesunięcie X o 200 mm

        const c = makeSolverConstraint({
            id: 'cst_test_1',
            bindType: 'VERTEX',
            anchorA: makeAnchor({ nodeId: panelA.id, kind: 'VERTEX', cornerIndex: 0 }),
            anchorB: makeAnchor({ nodeId: 'other', kind: 'VERTEX', cornerIndex: 1 }),
        });

        const deltas = [
            {
                nodeId: panelA.id,
                localBefore: beforeMat,
                localAfter: afterMat,
            },
        ];

        const cmd = new AddConstraintCommand(c, deltas);
        history.execute(cmd);

        expect(store.get('cst_test_1')).toBeDefined();
        expect(panelA.localMatrix.data[12]).toBe(200);

        // UNDO -> relacja usunięta z magazynu, pozycja cofnięta
        history.undo();
        expect(store.get('cst_test_1')).toBeNull();
        expect(panelA.localMatrix.data[12]).toBe(beforeMat.data[12]);

        // REDO -> relacja przywrócona z tym samym ID, pozycja znów na 200
        history.redo();
        expect(store.get('cst_test_1')).toBeDefined();
        expect(panelA.localMatrix.data[12]).toBe(200);
    });

    it('AddConstraintCommand używa wstrzykniętego ConstraintStore podczas execute, Undo i Redo', () => {
        const isolatedStore = new ConstraintStore();
        const singletonConstraintBefore = store.get('cst_isolated_store');
        const constraint = makeSolverConstraint({
            id: 'cst_isolated_store',
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: 'isolated_node', kind: 'OBJECT' }),
        });
        const command = new AddConstraintCommand(constraint, [], 'Dodanie relacji', isolatedStore);

        history.execute(command);
        expect(isolatedStore.get(constraint.id)).not.toBeNull();
        expect(store.get(constraint.id)).toBe(singletonConstraintBefore);

        expect(history.undo()).toBe(true);
        expect(isolatedStore.get(constraint.id)).toBeNull();
        expect(store.get(constraint.id)).toBe(singletonConstraintBefore);

        expect(history.redo()).toBe(true);
        expect(isolatedStore.get(constraint.id)).not.toBeNull();
        expect(store.get(constraint.id)).toBe(singletonConstraintBefore);
    });

    it('nie odświeża nakładki ani viewportu po AddConstraintCommand w makrze wycofanym przez błąd', () => {
        const panel = CADNode.create(NodeType.PART, 'panel_macro_add', 'node_macro_constraint_add');
        document.addNode(document.rootNode.id, panel);
        const constraint = makeSolverConstraint({
            id: 'cst_macro_add',
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: panel.id, kind: 'OBJECT' }),
        });
        const previousViewport = ContextManager.instance.viewport;
        const requestRender = vi.fn();
        ContextManager.instance.viewport = { requestRender };
        const refresh = vi.spyOn(ConstraintHighlightOverlay.instance, 'refresh').mockImplementation(() => {});
        const failingCommand = {
            id: 'failing-add-constraint-macro-step',
            label: 'Fail',
            timestamp: Date.now(),
            affectedNodeIds: [],
            execute: () => { throw new Error('later add-constraint macro step failed'); },
            undo: () => {},
        };
        const macro = new MacroCommand([
            new AddConstraintCommand(constraint),
            failingCommand,
        ]);

        try {
            expect(() => history.execute(macro)).toThrow('later add-constraint macro step failed');
            expect(store.get(constraint.id)).toBeNull();
            expect(refresh).not.toHaveBeenCalled();
            expect(requestRender).not.toHaveBeenCalled();
        } finally {
            refresh.mockRestore();
            ContextManager.instance.viewport = previousViewport;
        }
    });

    it('RemoveConstraintCommand: Undo przywraca usuniętą relację, Redo ją usuwa', () => {
        const c = store.add({
            id: 'cst_remove_me',
            bindType: 'COPLANAR',
            anchorA: makeAnchor({ nodeId: 'a', kind: 'FACE', faceName: 'FACE_Z_PLUS' }),
            anchorB: makeAnchor({ nodeId: 'b', kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
        });
        expect(store.get('cst_remove_me')).toBeDefined();

        const cmd = new RemoveConstraintCommand(c);
        history.execute(cmd);

        // Wykonanie: usunięto
        expect(store.get('cst_remove_me')).toBeNull();

        // UNDO -> przywrócono
        history.undo();
        expect(store.get('cst_remove_me')).toBeDefined();
        expect(store.get('cst_remove_me')?.bindType).toBe('COPLANAR');

        // REDO -> ponownie usunięto
        history.redo();
        expect(store.get('cst_remove_me')).toBeNull();
    });

    it('UpdateConstraintCommand: Undo przywraca poprzedni więz i transformację, Redo ponawia edycję', () => {
        const panel = CADNode.create(NodeType.PART, 'panel_update', 'node_constraint_update');
        document.addNode(document.rootNode.id, panel);
        const constraint = store.add({
            id: 'cst_update_me',
            bindType: 'COPLANAR',
            anchorA: makeAnchor({ nodeId: panel.id, kind: 'FACE', faceName: 'FACE_Z_PLUS', localPointMm: [1, 2, 3] }),
            anchorB: makeAnchor({ nodeId: 'other', kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
            offsetMm: 5,
        });
        const before = cloneSolverConstraint(constraint);
        const beforeMatrix = panel.localMatrix.clone();
        const afterMatrix = beforeMatrix.clone();
        afterMatrix.data[12] = 125;
        const updatedAnchor = makeAnchor({
            nodeId: panel.id,
            kind: 'FACE',
            faceName: 'FACE_X_PLUS',
            localPointMm: [4, 5, 6],
        });

        store.update(constraint.id, { anchorA: updatedAnchor, offsetMm: 12 });
        const after = store.get(constraint.id)!;
        const command = new UpdateConstraintCommand(before, after, [{
            nodeId: panel.id,
            localBefore: beforeMatrix,
            localAfter: afterMatrix,
        }]);
        history.execute(command);

        expect(store.get(constraint.id)?.offsetMm).toBe(12);
        expect(panel.localMatrix.data[12]).toBe(125);
        expect(history.undo()).toBe(true);
        expect(store.get(constraint.id)).toMatchObject({
            offsetMm: 5,
            anchorA: { faceName: 'FACE_Z_PLUS', localPointMm: [1, 2, 3] },
        });
        expect(panel.localMatrix.data[12]).toBe(beforeMatrix.data[12]);

        expect(history.redo()).toBe(true);
        expect(store.get(constraint.id)).toMatchObject({
            offsetMm: 12,
            anchorA: { faceName: 'FACE_X_PLUS', localPointMm: [4, 5, 6] },
        });
        expect(panel.localMatrix.data[12]).toBe(125);
    });

    it('UpdateConstraintCommand nie uruchamia opóźnionego solve po Undo ani Redo', () => {
        vi.useFakeTimers();
        const constraint = store.add({
            id: 'cst_toggle_autosolve',
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: 'toggle_node', kind: 'OBJECT' }),
        });
        const before = cloneSolverConstraint(constraint);
        const after = cloneSolverConstraint(constraint);
        after.enabled = false;
        const controller = new SolverController(store);
        const detach = controller.attach(document, history);

        try {
            history.execute(new UpdateConstraintCommand(before, after, [], 'Zmiana aktywności relacji', store));
            expect(store.get(constraint.id)?.enabled).toBe(false);
            expect(history.undoStack).toHaveLength(1);
            vi.advanceTimersByTime(200);
            expect(history.undoStack).toHaveLength(1);

            expect(history.undo()).toBe(true);
            expect(store.get(constraint.id)?.enabled).toBe(true);
            vi.advanceTimersByTime(200);
            expect(history.redoStack).toHaveLength(1);
            expect(history.undoStack).toHaveLength(0);

            expect(history.redo()).toBe(true);
            expect(store.get(constraint.id)?.enabled).toBe(false);
            vi.advanceTimersByTime(200);
            expect(history.undoStack).toHaveLength(1);
            expect(history.redoStack).toHaveLength(0);
        } finally {
            detach();
            vi.useRealTimers();
        }
    });

    it('RemoveNodeCommand: Undo przywraca więzy usunięte z formatką, Redo usuwa je ponownie', () => {
        const panel = CADNode.create(NodeType.PART, 'panel_do_usunięcia', 'node_constraint_cleanup');
        const other = CADNode.create(NodeType.PART, 'drugi_panel', 'node_constraint_other');
        document.addNode(document.rootNode.id, panel);
        document.addNode(document.rootNode.id, other);
        const constraint = store.add({
            id: 'cst_node_cleanup',
            bindType: 'VERTEX',
            anchorA: makeAnchor({ nodeId: panel.id, kind: 'VERTEX', cornerIndex: 2 }),
            anchorB: makeAnchor({ nodeId: other.id, kind: 'VERTEX', cornerIndex: 5 }),
            offsetMm: 12,
        });
        const controller = new SolverController(store);
        const detach = controller.attach(document, history);

        try {
            history.execute(new RemoveNodeCommand(document, panel.id, 'Usuń formatkę'));
            expect(document.findNode(panel.id)).toBeNull();
            expect(store.get(constraint.id)).toBeNull();

            expect(history.undo()).toBe(true);
            expect(document.findNode(panel.id)).toBe(panel);
            expect(store.get(constraint.id)).toMatchObject({
                id: constraint.id,
                bindType: 'VERTEX',
                offsetMm: 12,
                anchorA: expect.objectContaining({ nodeId: panel.id, cornerIndex: 2 }),
                anchorB: expect.objectContaining({ nodeId: other.id, cornerIndex: 5 }),
            });

            expect(history.redo()).toBe(true);
            expect(document.findNode(panel.id)).toBeNull();
            expect(store.get(constraint.id)).toBeNull();
        } finally {
            detach();
        }
    });

    it('nie odświeża nakładki ani viewportu po usunięciu więzu w makrze wycofanym przez błąd', () => {
        const panel = CADNode.create(NodeType.PART, 'panel_macro_cleanup', 'node_macro_constraint_cleanup');
        document.addNode(document.rootNode.id, panel);
        const constraint = store.add({
            id: 'cst_macro_cleanup',
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: panel.id, kind: 'OBJECT' }),
        });
        const controller = new SolverController(store);
        const detach = controller.attach(document, history);
        const previousViewport = ContextManager.instance.viewport;
        const requestRender = vi.fn();
        ContextManager.instance.viewport = { requestRender };
        const refresh = vi.spyOn(ConstraintHighlightOverlay.instance, 'refresh').mockImplementation(() => {});
        const failingCommand = {
            id: 'failing-macro-step',
            label: 'Fail',
            timestamp: Date.now(),
            affectedNodeIds: [],
            execute: () => { throw new Error('later macro step failed'); },
            undo: () => {},
        };
        const macro = new MacroCommand([
            new RemoveNodeCommand(document, panel.id),
            failingCommand,
        ]);

        try {
            expect(() => history.execute(macro)).toThrow('later macro step failed');
            expect(document.findNode(panel.id)).toBe(panel);
            expect(store.get(constraint.id)).not.toBeNull();
            expect(refresh).not.toHaveBeenCalled();
            expect(requestRender).not.toHaveBeenCalled();
        } finally {
            refresh.mockRestore();
            ContextManager.instance.viewport = previousViewport;
            detach();
        }
    });
});
