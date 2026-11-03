/**
 * Testy orientacji i etykietowania ścian przy wskazywaniu (pickowaniu) dla Solvera.
 *
 * Sprawdza:
 * 1. Zgodność kierunków normalnych formatek w układzie korpusu (LCS SmartFrame).
 * 2. Zgodność etykiet UI: front boku to przód (-Y), prawa strona wieńca to prawy (+X).
 * 3. Zbieżność relacji COPLANAR dla wyrównania frontów dwóch korpusów w linii.
 */

import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { resolveAnchor, resolveAnchorQuadMm } from '../constraint-geometry.js';
import { bindAnchorToRigidBody } from '../constraint-picker.js';
import { ConstraintStore } from '../constraint-store.js';
import { SolverController } from '../solver-controller.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { anchorFullLabel, anchorPartLabel } from '../constraint-ui-labels.js';
import { makeAnchor } from '../constraint-types.js';

describe('Solver Face Pick & Orientation Labels', () => {
    it('prawidłowo mapuje i etykietuje ściany formatek w układzie korpusu', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        const cmd = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 },
        });
        cmd.execute(doc);

        const cab = doc.findNode((cmd as any).createdId!)!;
        const bokL = cab.children.find((c) => (c.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;
        const bokP = cab.children.find((c) => (c.domainData as any)?.role === 'RIGHT_SIDE_PANEL')!;
        const wieniecD = cab.children.find((c) => (c.domainData as any)?.role === 'BOTTOM_PANEL')!;

        // 1. Bok lewy (Bok_L)
        // Front korpusu to CAD -Y -> na Bok_L jest to FACE_X_PLUS
        const bokLFront = bindAnchorToRigidBody(bokL, makeAnchor({
            nodeId: bokL.id,
            kind: 'FACE',
            faceName: 'FACE_X_PLUS',
        }));
        expect(anchorFullLabel(bokLFront, doc)).toBe('Bok_L [przód (-Y)]');
        expect(anchorPartLabel(bokLFront, doc)).toBe('Bok_L [przód (-Y)]');
        const resBokLFront = resolveAnchor(cab, bokLFront, bokL);
        expect(Math.round(resBokLFront!.localNormal![1])).toBe(-1); // -Y

        // Tył korpusu to CAD +Y -> na Bok_L jest to FACE_X_MINUS
        const bokLBack = bindAnchorToRigidBody(bokL, makeAnchor({
            nodeId: bokL.id,
            kind: 'FACE',
            faceName: 'FACE_X_MINUS',
        }));
        expect(anchorFullLabel(bokLBack, doc)).toBe('Bok_L [tył (+Y)]');

        // Zewnętrzna lewa strona to CAD -X -> na Bok_L jest to FACE_Z_MINUS
        const bokLOuter = bindAnchorToRigidBody(bokL, makeAnchor({
            nodeId: bokL.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
        }));
        expect(anchorFullLabel(bokLOuter, doc)).toBe('Bok_L [lewy (-X)]');

        // Wewnętrzna prawa strona to CAD +X -> na Bok_L jest to FACE_Z_PLUS
        const bokLInner = bindAnchorToRigidBody(bokL, makeAnchor({
            nodeId: bokL.id,
            kind: 'FACE',
            faceName: 'FACE_Z_PLUS',
        }));
        expect(anchorFullLabel(bokLInner, doc)).toBe('Bok_L [prawy (+X)]');

        // 2. Bok prawy (Bok_P)
        // Front korpusu to CAD -Y -> na Bok_P jest to FACE_X_MINUS
        const bokPFront = bindAnchorToRigidBody(bokP, makeAnchor({
            nodeId: bokP.id,
            kind: 'FACE',
            faceName: 'FACE_X_MINUS',
        }));
        expect(anchorFullLabel(bokPFront, doc)).toBe('Bok_P [przód (-Y)]');

        // Zewnętrzna prawa strona to CAD +X -> na Bok_P jest to FACE_Z_MINUS
        const bokPOuter = bindAnchorToRigidBody(bokP, makeAnchor({
            nodeId: bokP.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
        }));
        expect(anchorFullLabel(bokPOuter, doc)).toBe('Bok_P [prawy (+X)]');

        // 3. Wieniec dolny (Wieniec_D)
        // Prawa krawędź to CAD +X -> na Wieniec_D [90, 0, 180] jest to FACE_X_MINUS
        const wieniecDRight = bindAnchorToRigidBody(wieniecD, makeAnchor({
            nodeId: wieniecD.id,
            kind: 'FACE',
            faceName: 'FACE_X_MINUS',
        }));
        expect(anchorFullLabel(wieniecDRight, doc)).toBe('Wieniec_D [prawy (+X)]');

        // Lewa krawędź to CAD -X -> na Wieniec_D [90, 0, 180] jest to FACE_X_PLUS
        const wieniecDLeft = bindAnchorToRigidBody(wieniecD, makeAnchor({
            nodeId: wieniecD.id,
            kind: 'FACE',
            faceName: 'FACE_X_PLUS',
        }));
        expect(anchorFullLabel(wieniecDLeft, doc)).toBe('Wieniec_D [lewy (-X)]');

        // Front to CAD -Y -> na Wieniec_D jest to FACE_Y_MINUS
        const wieniecDFront = bindAnchorToRigidBody(wieniecD, makeAnchor({
            nodeId: wieniecD.id,
            kind: 'FACE',
            faceName: 'FACE_Y_MINUS',
        }));
        expect(anchorFullLabel(wieniecDFront, doc)).toBe('Wieniec_D [przód (-Y)]');
    });

    it('wyrównuje fronty dwóch korpusów relacją COPLANAR', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        const cmdA = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 },
        });
        cmdA.execute(doc);
        const cabA = doc.findNode((cmdA as any).createdId!)!;
        const bokL_A = cabA.children.find((c) => (c.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;

        const cmdB = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 700, y: 50, z: 0 },
        });
        cmdB.execute(doc);
        const cabB = doc.findNode((cmdB as any).createdId!)!;
        const bokL_B = cabB.children.find((c) => (c.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;

        const frontA = bindAnchorToRigidBody(bokL_A, makeAnchor({
            nodeId: bokL_A.id,
            kind: 'FACE',
            faceName: 'FACE_X_PLUS',
        }));
        const frontB = bindAnchorToRigidBody(bokL_B, makeAnchor({
            nodeId: bokL_B.id,
            kind: 'FACE',
            faceName: 'FACE_X_PLUS',
        }));

        const store = ConstraintStore.instance;
        store.clear();
        store.add({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cabA.id, kind: 'OBJECT' }),
        });
        store.add({
            bindType: 'COPLANAR',
            anchorA: frontA,
            anchorB: frontB,
            offsetMm: 0,
        });

        const hist = new CommandHistory(doc);
        const ctrl = new SolverController(store);
        ctrl.attach(doc, hist);

        const solved = ctrl.solveNow();
        expect(solved).toBe(true);

        const cabBPos = cabB.localMatrix.getTranslation();
        expect(Math.round(nmToMm(cabBPos.y))).toBe(0); // Wyrównany do Y = 0
    });
});

