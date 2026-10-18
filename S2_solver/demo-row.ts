/**
 * demo-row.ts
 *
 * Funkcje demonstracyjne generujące ciąg szafek połączonych solverem (bez GUI)
 * oraz dynamiczne poszerzanie szafek z automatycznym przesunięciem rzędu.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../A3_smartframe/commands/create-korpus-command.js';
import { ConstraintStore } from './constraint-store.js';
import { makeAnchor, makeSolverConstraint } from './constraint-types.js';
import { nmToMm, mmToNm } from '../A1_core/cad-math/units.js';

export function generate10CabinetsRow(widths_mm: number[] = [600, 800, 600, 450, 900, 500, 600, 800, 400, 600]): any[] {
    const ctx = ContextManager.instance;
    const doc = ctx.document;
    const history = ctx.commandHistory;
    const solverCtrl = (ctx as any).solverController;
    if (!doc || !history) {
        console.error('[demo-row] Brak aktywnego dokumentu lub historii komend.');
        return [];
    }

    // 1. Usuń istniejące węzły korpusów, aby zacząć z czystą sceną
    const existing = typeof doc.getContainers === 'function' ? doc.getContainers() : [];
    for (const c of existing) {
        doc.removeNode(c.id);
    }
    ConstraintStore.instance.clear();

    const wysokosc_mm = 720;
    const glebokosc_mm = 560;
    const createdNodes: any[] = [];

    // 2. Tworzymy szafki komendami CreateKorpusCommand
    for (let i = 0; i < widths_mm.length; i++) {
        const w_mm = widths_mm[i];
        const cmd = new CreateKorpusCommand({
            typ_korpusu: 'korpus3',
            szerokosc_mm: w_mm,
            wysokosc_mm: wysokosc_mm,
            glebokosc_mm: glebokosc_mm,
            position: { x: i * 50, y: 0, z: 0 },
        });
        cmd.execute(doc);
        const node = doc.findNode(cmd.affectedNodeIds[0]);
        if (node) createdNodes.push(node);
    }

    if (createdNodes.length === 0) return [];

    // 3. Uziemienie pierwszej szafki w zerze
    ConstraintStore.instance.add(makeSolverConstraint({
        id: 'cst_ground_first',
        bindType: 'GROUND',
        anchorA: makeAnchor({ nodeId: createdNodes[0].id, kind: 'OBJECT' }),
    }));

    // 4. Łączenie sąsiednich szafek więzami VERTEX i COPLANAR
    for (let i = 1; i < createdNodes.length; i++) {
        const prev = createdNodes[i - 1];
        const curr = createdNodes[i];

        ConstraintStore.instance.add(makeSolverConstraint({
            id: `cst_vertex_${i - 1}_to_${i}`,
            bindType: 'VERTEX',
            anchorA: makeAnchor({ nodeId: prev.id, kind: 'VERTEX', cornerIndex: 1 }),
            anchorB: makeAnchor({ nodeId: curr.id, kind: 'VERTEX', cornerIndex: 0 }),
        }));

        ConstraintStore.instance.add(makeSolverConstraint({
            id: `cst_front_${i - 1}_to_${i}`,
            bindType: 'COPLANAR',
            anchorA: makeAnchor({ nodeId: prev.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
            anchorB: makeAnchor({ nodeId: curr.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
            offsetMm: 0,
        }));
    }

    // 5. Rozwiązanie solvera
    if (solverCtrl && typeof solverCtrl.solveNow === 'function') {
        solverCtrl.solveNow();
    }

    // 6. Odświeżenie widoku w Babylon.js
    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
    }

    return createdNodes;
}

export function expandCabinet(index: number = 1, delta_mm: number = 200): void {
    const ctx = ContextManager.instance;
    const doc = ctx.document;
    const containers = doc?.getContainers?.() || [];
    const target = containers[index];
    if (!target) {
        console.warn(`[demo-row] Brak szafki o indeksie ${index}`);
        return;
    }
    const currentW_mm = nmToMm(target.width);
    const newW_mm = currentW_mm + delta_mm;
    target.width = mmToNm(newW_mm);
    if (target.generatorParams) {
        target.generatorParams.szerokosc_mm = newW_mm;
    }
    doc.emitChange('dimensions', [target.id]);

    const solverCtrl = (ctx as any).solverController;
    if (solverCtrl && typeof solverCtrl.solveNow === 'function') {
        solverCtrl.solveNow();
    }

    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
    }
}
