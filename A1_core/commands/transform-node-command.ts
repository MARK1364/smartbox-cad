/**
 * SmartPanel Web — TransformNodeCommand
 *
 * Komenda zmiany transformacji lokalnej (pozycji/rotacji) węzła CAD.
 * Zapamiętuje stan macierzy przed i po modyfikacji.
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';
import { Mat4 } from '../cad-math/mat4.js';

export class TransformNodeCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    readonly nodeId: string;
    readonly localMatrixBefore: Mat4;
    readonly localMatrixAfter: Mat4;

    constructor(
        nodeId: string,
        localMatrixBefore: Mat4,
        localMatrixAfter: Mat4,
        label: string = 'Przekształcenie obiektu'
    ) {
        this.id = `cmd_transform_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.nodeId = nodeId;
        this.localMatrixBefore = localMatrixBefore.clone();
        this.localMatrixAfter = localMatrixAfter.clone();
        this.label = label;
        this.timestamp = Date.now();
        this.affectedNodeIds = [nodeId];
    }

    execute(document: ProjectDocument): void {
        const node = document.findNode(this.nodeId);
        if (!node) return;
        node.setLocalMatrix(this.localMatrixAfter.clone());
        document.emitChange('transform', [this.nodeId]);
    }

    undo(document: ProjectDocument): void {
        const node = document.findNode(this.nodeId);
        if (!node) return;
        node.setLocalMatrix(this.localMatrixBefore.clone());
        document.emitChange('transform', [this.nodeId]);
    }
}
