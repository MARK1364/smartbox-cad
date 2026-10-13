import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { ConstraintStore } from '../constraint-store.js';
import { AddConstraintCommand, RemoveConstraintCommand } from '../constraint-commands.js';
import { makeAnchor, makeSolverConstraint } from '../constraint-types.js';
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
});
