/**
 * solve-constraints-command.ts — wynik jednego przebiegu solvera jako JEDNA komenda.
 *
 * Solver rusza zwykle kilka węzłów naraz. Gdyby każdy z nich trafił do historii
 * jako osobna komenda, jedno Ctrl+Z cofnęłoby tylko część ruchu i zostawiło
 * scenę w stanie częściowo rozwiązanym — czyli w stanie, którego solver nigdy
 * nie wyprodukował. Dlatego wszystkie transformacje idą do historii razem,
 * a `emitChange` leci raz, po zaktualizowaniu wszystkich węzłów.
 */

import { Mat4 } from '../A1_core/cad-math/mat4.js';
import type { Command } from '../A1_core/commands/command.js';
import type { ProjectDocument } from '../A1_core/project-document.js';

export interface NodeTransformDelta {
    nodeId: string;
    localBefore: Mat4;
    localAfter: Mat4;
}

export class SolveConstraintsCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly _deltas: NodeTransformDelta[];

    constructor(deltas: NodeTransformDelta[], label: string = 'Rozwiązanie więzów') {
        this.id = `cmd_solve_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.label = label;
        this.timestamp = Date.now();
        this._deltas = deltas.map((d) => ({
            nodeId: d.nodeId,
            localBefore: d.localBefore.clone(),
            localAfter: d.localAfter.clone(),
        }));
        this.affectedNodeIds = this._deltas.map((d) => d.nodeId);
    }

    get isEmpty(): boolean {
        return this._deltas.length === 0;
    }

    execute(document: ProjectDocument): void {
        this._apply(document, 'localAfter');
    }

    undo(document: ProjectDocument): void {
        this._apply(document, 'localBefore');
    }

    private _apply(document: ProjectDocument, field: 'localBefore' | 'localAfter'): void {
        const touched: string[] = [];
        for (const delta of this._deltas) {
            const node = document.findNode(delta.nodeId);
            if (!node) {
                continue;
            }
            node.setLocalMatrix(delta[field].clone());
            touched.push(delta.nodeId);
        }
        if (touched.length > 0) {
            document.emitChange('transform', touched);
        }
    }
}
