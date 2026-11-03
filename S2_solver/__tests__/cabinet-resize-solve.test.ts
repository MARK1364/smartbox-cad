import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { applyRealtimeUpdate } from '../../A3_smartframe/smartframe-adapter.js';
import { ConstraintStore } from '../constraint-store.js';
import { SolverController } from '../solver-controller.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { bindAnchorToRigidBody } from '../constraint-picker.js';
import { makeAnchor, makeSolverConstraint } from '../constraint-types.js';
import { validateConstraints } from '../constraint-validation.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

describe('Cabinet resize and solver constraint persistence', () => {
    it('maintains valid sourceNodeId and recalculates solver position when cabinet is resized', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const history = new CommandHistory(doc);
        const store = new ConstraintStore();
        const controller = new SolverController(store);
        controller.attach(doc, history);

        // Tworzymy dwie szafki: A (W=600) na X=0, B (W=600) na X=600
        const cmdA = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 },
        });
        cmdA.execute(doc);
        const cabinetANode = doc.findNode((cmdA as any).createdId!)!;
        expect(cabinetANode).toBeDefined();

        const cmdB = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 600, y: 0, z: 0 },
        });
        cmdB.execute(doc);
        const cabinetBNode = doc.findNode((cmdB as any).createdId!)!;
        expect(cabinetBNode).toBeDefined();

        const bokP_A = cabinetANode.children.find(c => (c.domainData as any)?.role === 'RIGHT_SIDE_PANEL')!;
        const bokL_B = cabinetBNode.children.find(c => (c.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;
        expect(bokP_A).toBeDefined();
        expect(bokL_B).toBeDefined();

        // Uziemienie szafki A
        store.add(makeSolverConstraint({
            id: 'c_ground_a',
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cabinetANode.id, kind: 'OBJECT' }),
        }));

        // Wiązanie FLUSH między prawą zewnętrzną ścianą A a lewą zewnętrzną ścianą B:
        // Prawy bok A: zewnętrzna ściana to FACE_Z_MINUS (normal +X)
        // Lewy bok B: zewnętrzna ściana to FACE_Z_MINUS (normal -X)
        const anchorA = bindAnchorToRigidBody(bokP_A, makeAnchor({
            nodeId: bokP_A.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
        }));
        const anchorB = bindAnchorToRigidBody(bokL_B, makeAnchor({
            nodeId: bokL_B.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
        }));

        const constraint = makeSolverConstraint({
            id: 'c_mate_ab',
            bindType: 'FLUSH',
            anchorA,
            anchorB,
        });
        store.add(constraint);

        // Pierwszy solve
        controller.solveNow();
        let posBX = Math.round(nmToMm(cabinetBNode.localMatrix.decompose().translation.x));
        expect(posBX).toBe(600);

        // Zwiększamy wymiary szafki A z 600 na 800 mm
        applyRealtimeUpdate(doc, { szerokosc_mm: 800 }, cabinetANode.domainData);

        // Sprawdzamy walidację — nie może być żadnych ostrzeżeń STALE_SOURCE
        const val = validateConstraints(store.constraints, doc);
        expect(val.issues.filter(i => i.code === 'STALE_SOURCE')).toHaveLength(0);

        // Solver powinien przeliczyć pozycję szafki B:
        // Szafka A ma teraz szerokość 800 mm (prawa ściana na X = 400 mm).
        // Szafka B ma szerokość 600 mm (lewa ściana w lokalnym LCS na -300 mm).
        // Żeby lewa ściana B dotykała prawej ściany A (X = 400 mm), środek B musi być w X = 400 + 300 = 700 mm!
        controller.solveNow();
        posBX = Math.round(nmToMm(cabinetBNode.localMatrix.decompose().translation.x));
        expect(posBX).toBe(700);

        controller.detach();
    });

    it('automatycznie odzyskuje geometrię i przelicza solver gdy sourceNodeId wskazuje nieistniejące ID po regeneracji', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const history = new CommandHistory(doc);
        const store = new ConstraintStore();
        const controller = new SolverController(store);
        controller.attach(doc, history);

        const cmdA = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 },
        });
        cmdA.execute(doc);
        const cabinetANode = doc.findNode((cmdA as any).createdId!)!;

        const cmdB = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 600, y: 0, z: 0 },
        });
        cmdB.execute(doc);
        const cabinetBNode = doc.findNode((cmdB as any).createdId!)!;

        const bokP_A = cabinetANode.children.find(c => (c.domainData as any)?.role === 'RIGHT_SIDE_PANEL')!;
        const bokL_B = cabinetBNode.children.find(c => (c.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;

        store.add(makeSolverConstraint({
            id: 'c_ground_a2',
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cabinetANode.id, kind: 'OBJECT' }),
        }));

        const anchorA = bindAnchorToRigidBody(bokP_A, makeAnchor({
            nodeId: bokP_A.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
        }));
        const anchorB = bindAnchorToRigidBody(bokL_B, makeAnchor({
            nodeId: bokL_B.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
        }));

        // Zwiększamy szafkę A z 600 na 900 mm
        applyRealtimeUpdate(doc, { szerokosc_mm: 900 }, cabinetANode.domainData);

        // Symulacja zregenerowanej formatki pod innym ID:
        // Ustawiamy anchorA.sourceNodeId i anchorB.sourceNodeId na stare, nieistniejące ID
        anchorA.sourceNodeId = 'stare_id_z_przed_regeneracji_A';
        anchorB.sourceNodeId = 'stare_id_z_przed_regeneracji_B';

        // Walidacja powinna pomyślnie odzyskać formatki i nie zgłaszać STALE_SOURCE
        const val = validateConstraints([
            makeSolverConstraint({
                id: 'c_recovered',
                bindType: 'FLUSH',
                anchorA,
                anchorB,
            })
        ], doc);

        expect(val.issues.filter(i => i.code === 'STALE_SOURCE')).toHaveLength(0);
        // ID powinno zostać zaktualizowane do żywego węzła
        expect(anchorA.sourceNodeId).not.toBe('stare_id_z_przed_regeneracji_A');
        expect(doc.findNode(anchorA.sourceNodeId!)).toBeDefined();

        store.add(makeSolverConstraint({
            id: 'c_recovered',
            bindType: 'FLUSH',
            anchorA,
            anchorB,
        }));

        controller.solveNow();
        // Szafka A ma szerokość 900 mm (prawa ściana na X = 450 mm).
        // Szafka B ma szerokość 600 mm (lewa ściana w -300 mm).
        // Nowa pozycja środka B: 450 + 300 = 750 mm!
        const posBX = Math.round(nmToMm(cabinetBNode.localMatrix.decompose().translation.x));
        expect(posBX).toBe(750);

        controller.detach();
    });
});
