import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { ConstraintStore } from '../constraint-store.js';
import { SolverController } from '../solver-controller.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { makeAnchor, makeSolverConstraint } from '../constraint-types.js';
import { resolveDatumAnchorPose } from '../datum-planes.js';
import { nmToMm, mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';

describe('Three-zone cabinet and datum levels', () => {
    it('reproduces binding corners of 3-zone cabinet to datum levels', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const history = new CommandHistory(doc);
        const store = new ConstraintStore();
        const controller = new SolverController(store);
        controller.attach(doc, history);

        // Poziomy Z
        doc.ensureGlcNode('Poziomy Z');
        const level1 = doc.findNode('datum_level_1')!; // 100mm
        const level2 = doc.findNode('datum_level_top')!; // 2400mm
        const level3 = doc.addDatumLevel(860, 'Poziom 3'); // 860mm
        const level4 = doc.addDatumLevel(1500, 'Poziom 4'); // 1500mm

        // Korpus 3-sekcyjny
        const cmd = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 2300,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            liczba_stref: 3,
            wysokosc_strefy_dolnej_mm: 500,
            wysokosc_strefy_srodkowej_mm: 500,
            position: { x: 0, y: 0, z: 100 },
        });
        cmd.execute(doc);
        const cabinet = doc.findNode((cmd as any).createdId!)!;
        expect(cabinet).toBeDefined();

        // Wiązanie narożnika dolnego (cornerIndex 0) do Poziom 1 (100mm)
        store.add(makeSolverConstraint({
            id: 'c_bottom',
            bindType: 'VERTEX_DATUM',
            anchorA: makeAnchor({ nodeId: cabinet.id, kind: 'VERTEX', cornerIndex: 0 }),
            anchorB: makeAnchor({ nodeId: level1.id, kind: 'DATUM' }),
        }));

        // Wiązanie narożnika górnego (cornerIndex 4) do Poziom 2 (2400mm)
        store.add(makeSolverConstraint({
            id: 'c_top',
            bindType: 'VERTEX_DATUM',
            anchorA: makeAnchor({ nodeId: cabinet.id, kind: 'VERTEX', cornerIndex: 4 }),
            anchorB: makeAnchor({ nodeId: level2.id, kind: 'DATUM' }),
        }));

        // Wiązanie wieńca dolnego strefy (podział 1<->2, cornerIndex 8) do Poziom 3 (860mm)
        store.add(makeSolverConstraint({
            id: 'c_div1',
            bindType: 'VERTEX_DATUM',
            anchorA: makeAnchor({ nodeId: cabinet.id, kind: 'VERTEX', cornerIndex: 8 }),
            anchorB: makeAnchor({ nodeId: level3.id, kind: 'DATUM' }),
        }));

        // Wiązanie wieńca górnego strefy (podział 2<->3, cornerIndex 16) do Poziom 4 (1500mm)
        store.add(makeSolverConstraint({
            id: 'c_div2',
            bindType: 'VERTEX_DATUM',
            anchorA: makeAnchor({ nodeId: cabinet.id, kind: 'VERTEX', cornerIndex: 16 }),
            anchorB: makeAnchor({ nodeId: level4.id, kind: 'DATUM' }),
        }));

        controller.solveNow();

        // Ruszamy Poziom 2 z 2400 na 2500 mm
        const newZ = mmToNm(2500);
        level2.setLocalTransform(new Vec3(0, 0, newZ), Quat.IDENTITY);
        (level2.domainData as any).z_nm = newZ;

        // Ruszamy Poziom 3 (wieniec dolny podziału 1<->2) z 860 na 900 mm
        const newZ3 = mmToNm(900);
        level3.setLocalTransform(new Vec3(0, 0, newZ3), Quat.IDENTITY);
        (level3.domainData as any).z_nm = newZ3;

        controller.solveNow();

        expect(store.constraints.every(c => !c.conflict)).toBe(true);

        const gp = (cabinet.domainData as any).generatorParams;
        const cabZ = Math.round(nmToMm(cabinet.localMatrix.decompose().translation.z));

        // Pozycja spodu szafki pozostaje na Poziomie 1 (100 mm)
        expect(cabZ).toBe(100);
        // Całkowita wysokość korpusu rozciąga się między Poziomem 1 a 2: 2500 - 100 = 2400 mm
        expect(gp.wysokosc_mm).toBe(2400);
        // Wysokość strefy dolnej dopasowuje się do Poziomu 3: 900 - 100 = 800 mm
        expect(gp.wysokosc_strefy_dolnej_mm).toBe(800);
        // Wysokość strefy środkowej rozciąga się między Poziomem 3 a 4: 1500 - 900 = 600 mm
        expect(gp.wysokosc_strefy_srodkowej_mm).toBe(600);

        controller.detach();
    });

    it('picks zone divider gizmo spheres correctly as cornerIndex 8 and 16', async () => {
        const { handleConstraintPickEvent } = await import('../constraint-picker.js');
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cmd = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 2200,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            liczba_stref: 3,
            wysokosc_strefy_dolnej_mm: 500,
            wysokosc_strefy_srodkowej_mm: 500,
            position: { x: 0, y: 0, z: 100 },
        });
        cmd.execute(doc);
        const cabinet = doc.findNode((cmd as any).createdId!)!;

        let pickedAnchor: any = null;
        const picker = {
            label: 'Test Picker',
            expectedKind: 'VERTEX' as const,
            onPick: (anchor: any) => { pickedAnchor = anchor; },
        };
        (ContextManager.instance as any).activeConstraintPicker = picker;

        // Symulacja kliknięcia w sferę podziału dolnego ('BOTTOM')
        handleConstraintPickEvent('select', {
            mesh: {
                metadata: {
                    isCornerGizmo: true,
                    isZoneGizmo: true,
                    dividerType: 'BOTTOM',
                    containerNode: cabinet,
                }
            }
        });
        expect(pickedAnchor).toBeDefined();
        expect(pickedAnchor.cornerIndex).toBe(8);
        expect(pickedAnchor.nodeId).toBe(cabinet.id);

        (ContextManager.instance as any).activeConstraintPicker = picker;

        // Symulacja kliknięcia w sferę podziału górnego ('MIDDLE')
        handleConstraintPickEvent('select', {
            mesh: {
                metadata: {
                    isCornerGizmo: true,
                    isZoneGizmo: true,
                    dividerType: 'MIDDLE',
                    containerNode: cabinet,
                }
            }
        });
        expect(pickedAnchor).toBeDefined();
        expect(pickedAnchor.cornerIndex).toBe(16);
        expect(pickedAnchor.nodeId).toBe(cabinet.id);
    });
});
