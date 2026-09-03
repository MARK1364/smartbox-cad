import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { CommandHistory } from '../commands/command-history.js';
import { SceneSyncAdapter } from '../cad-node/scene-sync-adapter.js';
import { TransformNodeCommand } from '../commands/transform-node-command.js';
import { ContextManager } from '../context-manager.js';
import { Mat4 } from '../cad-math/mat4.js';
import { Vec3 } from '../cad-math/vec3.js';
import { Quat } from '../cad-math/quat.js';
import { mmToNm } from '../cad-math/units.js';

describe('Gizmo & SceneSyncAdapter Integration', () => {
    let doc: ProjectDocument;
    let history: CommandHistory;
    let syncAdapter: SceneSyncAdapter;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Gizmo Sync Test' });
        history = new CommandHistory(doc);
        syncAdapter = new SceneSyncAdapter();

        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = history;
        ContextManager.instance.sceneSyncAdapter = syncAdapter;
    });

    it('should bind mock mesh to CADNode in shared SceneSyncAdapter', () => {
        const container = doc.createContainer({ name: 'Szafa' });
        const cadNode = doc.findNode(container.id)!;
        const mockMesh = {
            position: { x: 0, y: 0, z: 0, set: function(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
            rotationQuaternion: null,
            scaling: { x: 1, y: 1, z: 1, set: function(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } }
        };

        syncAdapter.bind(cadNode, mockMesh);

        // Symulacja obrotu mesh przez Gizmo w przestrzeni renderu
        mockMesh.position.x = 500; // 500 mm
        mockMesh.rotationQuaternion = { x: 0, y: 0.70710678, z: 0, w: 0.70710678 }; // ~90 deg obrót

        const matrixBefore = cadNode.localMatrix.clone();

        // Wywołanie syncFromMesh — tak jak robi GizmoController na onDragEnd
        syncAdapter.syncFromMesh(mockMesh);

        const matrixAfter = cadNode.localMatrix.clone();

        expect(matrixBefore.equals(matrixAfter)).toBe(false);

        // Zapisanie komendy tak jak robi GizmoController
        const cmd = new TransformNodeCommand(cadNode.id, matrixBefore, matrixAfter, 'Obrót szafy');
        history.execute(cmd);

        expect(history.canUndo).toBe(true);

        // Wykonanie Undo (Ctrl+Z)
        history.undo();

        // Po undo localMatrix szafy musi powrócić do macierzy tożsamościowej matrixBefore
        const matrixRestored = cadNode.localMatrix.clone();
        expect(matrixRestored.equals(matrixBefore)).toBe(true);
    });
});
