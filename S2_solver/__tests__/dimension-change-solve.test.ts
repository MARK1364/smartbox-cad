/**
 * dimension-change-solve.test.ts
 *
 * Weryfikacja: zmiana wymiarów formatki (np. z 720 mm na 500 mm) powiązanej
 * relacją dosunięcia / zrównania ścian (FLUSH / COPLANAR / ALIGN_FACES)
 * musi skutkować przeliczeniem solvera, tak aby związana ściana NIE oderwała się
 * od sąsiedniego obiektu, a formatka skróciła się wyłącznie od strony wolnej.
 */

import { describe, it, expect, vi } from 'vitest';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { SetDimensionsCommand } from '../../A1_core/commands/set-dimensions-command.js';
import { ConstraintStore } from '../constraint-store.js';
import { SolverController } from '../solver-controller.js';
import { makeAnchor, makeSolverConstraint } from '../constraint-types.js';

describe('Zmiana wymiarów formatki a solver (utrzymanie relacji ścian)', () => {
    it('po zmianie szerokości komendą SetDimensionsCommand solver dociąga formatkę do ściany', () => {
        const doc = new ProjectDocument();
        const history = new CommandHistory(doc);
        const store = new ConstraintStore();
        const controller = new SolverController(store);
        controller.attach(doc, history);

        // Panel B — baza (np. bok szafy o szerokości 600 mm w X=[ -300, +300 ])
        const panelBModel = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
        });
        const panelBNode = doc.findNode(panelBModel.id)!;
        panelBNode.name = 'Baza_B';
        panelBNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

        // Uziemienie panelu B, aby to panel A dojeżdżał do B
        store.add(makeSolverConstraint({
            id: 'c_ground_b',
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: panelBNode.id, kind: 'OBJECT' }),
        }));

        // Panel A — dokładany panel ręczny o domyślnej szerokości 720 mm
        const panelAModel = doc.createPanel({
            width: mmToNm(720),
            height: mmToNm(510),
            thickness: mmToNm(18),
        });
        const panelANode = doc.findNode(panelAModel.id)!;
        panelANode.name = 'Formatka_A';
        // Początkowo odsunięty daleko w prawo
        panelANode.setLocalTransform(new Vec3(mmToNm(1000), 0, 0), Quat.IDENTITY);

        // Relacja dosunięcia: lewa ściana Panelu A (FACE_X_MINUS) do prawej ściany Panelu B (FACE_X_PLUS)
        // Ściana prawa B jest na X = +300 mm.
        store.add(makeSolverConstraint({
            id: 'c_mate_ab',
            bindType: 'FLUSH',
            anchorA: makeAnchor({ nodeId: panelANode.id, kind: 'FACE', faceName: 'FACE_X_MINUS' }),
            anchorB: makeAnchor({ nodeId: panelBNode.id, kind: 'FACE', faceName: 'FACE_X_PLUS' }),
            offsetMm: 0,
        }));

        // Pierwszy przebieg solvera: panel A powinien dojechać do B
        const solvedInitial = controller.solveNow();
        expect(solvedInitial).toBe(true);

        const matrixInitial = panelANode.localMatrix.decompose();
        const posXInitialMm = nmToMm(matrixInitial.translation.x);
        // Lewa ściana panelu A ma localPoint = -720/2 = -360 mm.
        // Żeby dotykała prawej ściany B (X = +300 mm), środek A musi być na X = 300 + 360 = 660 mm.
        expect(Math.round(posXInitialMm)).toBe(660);

        // Użytkownik zmienia szerokość panelu A z 720 mm na 500 mm za pomocą SetDimensionsCommand
        history.execute(new SetDimensionsCommand(
            panelANode.id,
            { width: mmToNm(720), height: mmToNm(510), thickness: mmToNm(18) },
            { width: mmToNm(500), height: mmToNm(510), thickness: mmToNm(18) },
            { label: 'Wymiary formatki na 500' },
        ));

        // Sprawdzamy stan po przeliczeniu solvera
        // (SetDimensionsCommand wyemitował 'dimensions', co w kontrolerze powinno zażądać solve)
        controller.solveNow();

        const matrixAfter = panelANode.localMatrix.decompose();
        const posXAfterMm = nmToMm(matrixAfter.translation.x);

        // Przy nowej szerokości 500 mm:
        // Lewa ściana panelu A ma localPoint = -500/2 = -250 mm.
        // Żeby dotykała prawej ściany B (X = +300 mm), środek A MUSI zostać przesunięty do X = 300 + 250 = 550 mm!
        expect(Math.round(posXAfterMm)).toBe(550);

        // Pozycja w świecie lewej ściany panelu A: 550 - 250 = 300 mm (dokładnie styk z prawą ścianą B!)
        const leftWallWorldX = posXAfterMm - 500 / 2;
        expect(Math.round(leftWallWorldX)).toBe(300);

        controller.detach();
    });

    it('automatycznie przelicza pozycję (debounced) po SetDimensionsCommand bez ręcznego wywołania solveNow', () => {
        vi.useFakeTimers();
        try {
            const doc = new ProjectDocument();
            const history = new CommandHistory(doc);
            const store = new ConstraintStore();
            const controller = new SolverController(store);
            controller.attach(doc, history);

            const panelBModel = doc.createPanel({
                width: mmToNm(600),
                height: mmToNm(720),
                thickness: mmToNm(18),
            });
            const panelBNode = doc.findNode(panelBModel.id)!;
            panelBNode.name = 'Baza_B';
            panelBNode.setLocalTransform(new Vec3(0, 0, 0), Quat.IDENTITY);

            store.add(makeSolverConstraint({
                id: 'c_ground_b2',
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: panelBNode.id, kind: 'OBJECT' }),
            }));

            const panelAModel = doc.createPanel({
                width: mmToNm(720),
                height: mmToNm(510),
                thickness: mmToNm(18),
            });
            const panelANode = doc.findNode(panelAModel.id)!;
            panelANode.name = 'Formatka_A';
            panelANode.setLocalTransform(new Vec3(mmToNm(660), 0, 0), Quat.IDENTITY);

            store.add(makeSolverConstraint({
                id: 'c_mate_ab2',
                bindType: 'FLUSH',
                anchorA: makeAnchor({ nodeId: panelANode.id, kind: 'FACE', faceName: 'FACE_X_MINUS' }),
                anchorB: makeAnchor({ nodeId: panelBNode.id, kind: 'FACE', faceName: 'FACE_X_PLUS' }),
                offsetMm: 0,
            }));

            // Zmiana wymiaru z 720 na 500 za pomocą komendy w historii
            history.execute(new SetDimensionsCommand(
                panelANode.id,
                { width: mmToNm(720), height: mmToNm(510), thickness: mmToNm(18) },
                { width: mmToNm(500), height: mmToNm(510), thickness: mmToNm(18) },
            ));

            // Przed upływem debounce: formatka skróciła się w miejscu (środek wciąż 660 mm)
            const posXBeforeMm = nmToMm(panelANode.localMatrix.decompose().translation.x);
            expect(Math.round(posXBeforeMm)).toBe(660);

            // Odpalamy timer debounce (150 ms)
            vi.advanceTimersByTime(200);

            // Po debounce: solver automatycznie przeliczył więzy i dociągnął formatkę do ściany (środek 550 mm)
            const posXAfterMm = nmToMm(panelANode.localMatrix.decompose().translation.x);
            expect(Math.round(posXAfterMm)).toBe(550);

            controller.detach();
        } finally {
            vi.useRealTimers();
        }
    });
});
