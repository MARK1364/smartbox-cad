import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { cadToRender } from '../../A1_core/cad-math/coord-system.js';
import {
    resolveAnchor,
    resolveFaceLocalMm,
    localMmToWorldMm,
} from '../constraint-geometry.js';
import { bindAnchorToRigidBody } from '../constraint-picker.js';
import { ConstraintStore } from '../constraint-store.js';
import { SolverController } from '../solver-controller.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { anchorFullLabel } from '../constraint-ui-labels.js';
import { makeAnchor } from '../constraint-types.js';
import { buildSolverInput } from '../solver-bridge.js';

describe('SmartPanel & Cabinet Alignment Tests', () => {
    it('wyrównuje front formatki (SmartPanel) z frontem korpusu relacją COPLANAR', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        // 1. Utwórz korpus 600x720x560 mm w pozycji [0, 0, 0]
        const cmdCab = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 },
        });
        cmdCab.execute(doc);
        const cab = doc.findNode((cmdCab as any).createdId!)!;
        const bokL = cab.children.find((c) => (c.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;

        // 2. Utwórz wolnostojący SmartPanel (np. front meblowy 600x720x18 mm)
        // W CAD: grubość leży na Y, szerokość na X, wysokość na Z
        // Niech panel startuje przesunięty w [0, 100, 0] (czyli 100 mm za frontem)
        const panelData = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Front_Wolny',
            engineManaged: false, // wolnostojący manual panel
        }) as PanelModel;
        const panelNode = doc.findNode(panelData.id)!;
        panelNode.setLocalTransform(new Vec3(0, mmToNm(100), mmToNm(360)));

        // 3. Wskaż front korpusu (np. na przedzie boku Bok_L)
        // Przednia krawędź boku lewego to FACE_X_PLUS -> w szafce to CAD -Y
        const cabFrontAnchor = bindAnchorToRigidBody(bokL, makeAnchor({
            nodeId: bokL.id,
            kind: 'FACE',
            faceName: 'FACE_X_PLUS',
        }));
        expect(anchorFullLabel(cabFrontAnchor, doc)).toBe('Bok_L [przód (-Y)]');

        // 4. Wskaż tylną płaszczyznę frontu (FACE_Z_MINUS na formatce -> CAD -Y)
        // Formatka ma przód na FACE_Z_PLUS (CAD +Y) i tył na FACE_Z_MINUS (CAD -Y)
        const panelBackAnchor = bindAnchorToRigidBody(panelNode, makeAnchor({
            nodeId: panelNode.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
        }));
        // Dla formatki jako samodzielnego PART, etykieta to tył (-Z) w konwencji formatki
        console.log('panelBackAnchor label:', anchorFullLabel(panelBackAnchor, doc));

        // 5. Uruchom solver
        const store = ConstraintStore.instance;
        store.clear();
        // Zablokuj korpus w miejscu (GROUND)
        store.add({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cab.id, kind: 'OBJECT' }),
        });
        // Relacja COPLANAR (Wyrównaj ściany) między frontem korpusu a tyłem frontu
        const cCoplanar = store.add({
            bindType: 'COPLANAR',
            anchorA: cabFrontAnchor,
            anchorB: panelBackAnchor,
            offsetMm: 0,
        });

        const hist = new CommandHistory(doc);
        const ctrl = new SolverController(store);
        ctrl.attach(doc, hist);

        const ok = ctrl.solveNow();
        expect(ok).toBe(true);

        // 6. Sprawdź, czy płaszczyzny leżą w tej samej płaszczyźnie:
        // Front korpusu: środek szafki ma Y = 0, głębokość = 560 mm, więc front jest w Y = -280 mm
        const cabRes = resolveAnchor(cab, cabFrontAnchor, bokL)!;
        const cabWorldPt = localMmToWorldMm(cab, cabRes.localPointMm);
        console.log('cabWorldPt (front szafki):', cabWorldPt);
        expect(Math.round(cabWorldPt.y)).toBe(-280);

        // Tył formatki po rozwiązaniu:
        const panelRes = resolveAnchor(panelNode, panelBackAnchor, panelNode)!;
        const panelWorldPt = localMmToWorldMm(panelNode, panelRes.localPointMm);
        console.log('panelWorldPt (tył frontu):', panelWorldPt);
        expect(Math.round(panelWorldPt.y)).toBe(-280);

        // Różnica w płaszczyźnie Y musi wynosić dokładnie 0!
        expect(Math.abs(cabWorldPt.y - panelWorldPt.y)).toBeLessThan(0.01);
    });

    it('dosuwa bok formatki (SmartPanel) do boku korpusu relacją FLUSH', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        // Korpus 600x720x560 mm
        const cmdCab = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 },
        });
        cmdCab.execute(doc);
        const cab = doc.findNode((cmdCab as any).createdId!)!;
        const bokP = cab.children.find((c) => (c.domainData as any)?.role === 'RIGHT_SIDE_PANEL')!;

        // Prawa ściana korpusu (zewnętrzna ściana Bok_P to CAD +X = 300 mm)
        const cabRightAnchor = bindAnchorToRigidBody(bokP, makeAnchor({
            nodeId: bokP.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
        }));
        expect(anchorFullLabel(cabRightAnchor, doc)).toBe('Bok_P [prawy (+X)]');

        // Blenda boczna (panel 18x720x560 mm) postawiona gdzieś w X = 500
        const panelData = doc.createPanel({
            width: mmToNm(18),
            height: mmToNm(720),
            thickness: mmToNm(560),
            name: 'Blenda_Boczna',
            engineManaged: false,
        }) as PanelModel;
        const panelNode = doc.findNode(panelData.id)!;
        panelNode.setLocalTransform(new Vec3(mmToNm(500), 0, mmToNm(360)));

        // Lewa strona blendy (CAD -X na panelu)
        const panelLeftAnchor = bindAnchorToRigidBody(panelNode, makeAnchor({
            nodeId: panelNode.id,
            kind: 'FACE',
            faceName: 'FACE_X_MINUS',
        }));

        const store = ConstraintStore.instance;
        store.clear();
        store.add({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cab.id, kind: 'OBJECT' }),
        });
        // Relacja FLUSH (Dosuń ściany twarzą w twarz: prawy bok szafki dotyka lewego boku blendy)
        store.add({
            bindType: 'FLUSH',
            anchorA: cabRightAnchor,
            anchorB: panelLeftAnchor,
            offsetMm: 0,
        });

        const hist = new CommandHistory(doc);
        const ctrl = new SolverController(store);
        ctrl.attach(doc, hist);

        const ok = ctrl.solveNow();
        expect(ok).toBe(true);

        const cabRes = resolveAnchor(cab, cabRightAnchor, bokP)!;
        const cabWorldPt = localMmToWorldMm(cab, cabRes.localPointMm);
        console.log('cabWorldPt (prawy bok szafki):', cabWorldPt);
        expect(Math.round(cabWorldPt.x)).toBe(300); // 600 / 2 = 300 mm

        const panelRes = resolveAnchor(panelNode, panelLeftAnchor, panelNode)!;
        const panelWorldPt = localMmToWorldMm(panelNode, panelRes.localPointMm);
        console.log('panelWorldPt (lewy bok blendy):', panelWorldPt);
        expect(Math.round(panelWorldPt.x)).toBe(300);

        // Stykanie się płaszczyzn w X:
        expect(Math.abs(cabWorldPt.x - panelWorldPt.x)).toBeLessThan(0.01);
    });

    it('wyrównuje górę formatki (SmartPanel) z wieńcem górnym korpusu relacją COPLANAR', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        // Korpus 600x720x560 mm (wysokość 720 mm -> góra jest w Z = 720 mm)
        const cmdCab = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 },
        });
        cmdCab.execute(doc);
        const cab = doc.findNode((cmdCab as any).createdId!)!;
        const wieniecG = cab.children.find((c) => (c.domainData as any)?.role === 'TOP_PANEL')!;

        // Wieniec górny: górna ściana to CAD +Z
        const cabTopAnchor = bindAnchorToRigidBody(wieniecG, makeAnchor({
            nodeId: wieniecG.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS', // w orientacji wieniec_g to CAD +Z
        }));
        expect(anchorFullLabel(cabTopAnchor, doc)).toBe('Wieniec_G [góra (+Z)]');

        // Formatka (np. blat / nadstawka 600x18x560 mm)
        const panelData = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(18),
            thickness: mmToNm(560),
            name: 'Blat_Gora',
            engineManaged: false,
        }) as PanelModel;
        const panelNode = doc.findNode(panelData.id)!;
        panelNode.setLocalTransform(new Vec3(0, 0, mmToNm(900))); // startuje w Z = 900

        // Dolna ściana blatu (CAD -Z w panelu to FACE_Y_MINUS)
        const panelBottomAnchor = bindAnchorToRigidBody(panelNode, makeAnchor({
            nodeId: panelNode.id,
            kind: 'FACE',
            faceName: 'FACE_Y_MINUS',
        }));

        const store = ConstraintStore.instance;
        store.clear();
        store.add({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cab.id, kind: 'OBJECT' }),
        });
        // Dolna ściana blatu (normalna w dół -Z) dotyka górnej ściany szafki (normalna w górę +Z) -> FLUSH (twarzą w twarz)
        store.add({
            bindType: 'FLUSH',
            anchorA: cabTopAnchor,
            anchorB: panelBottomAnchor,
            offsetMm: 0,
        });

        const hist = new CommandHistory(doc);
        const ctrl = new SolverController(store);
        ctrl.attach(doc, hist);

        const ok = ctrl.solveNow();
        expect(ok).toBe(true);

        const cabRes = resolveAnchor(cab, cabTopAnchor, wieniecG)!;
        const cabWorldPt = localMmToWorldMm(cab, cabRes.localPointMm);
        console.log('cabWorldPt (góra szafki):', cabWorldPt);
        expect(Math.round(cabWorldPt.z)).toBe(720);

        const panelRes = resolveAnchor(panelNode, panelBottomAnchor, panelNode)!;
        const panelWorldPt = localMmToWorldMm(panelNode, panelRes.localPointMm);
        console.log('panelWorldPt (spód blatu):', panelWorldPt);
        expect(Math.round(panelWorldPt.z)).toBe(720);

        // Stykanie się płaszczyzn w osi Z (blat spoczywa idealnie na szafce):
        expect(Math.abs(cabWorldPt.z - panelWorldPt.z)).toBeLessThan(0.01);
    });
    it('wyrównuje przód boku Bok_P (-X formatki boczka, czyli CAD -Y = -280 mm) z formatką relacją COPLANAR', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        const cmdCab = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 },
        });
        cmdCab.execute(doc);
        const cab = doc.findNode((cmdCab as any).createdId!)!;
        const bokP = cab.children.find((c) => (c.domainData as any)?.role === 'RIGHT_SIDE_PANEL')!;

        // Na Bok_P (rotacja +90° wokół Z), krawędź z ABS to lokalne FACE_X_MINUS, czyli CAD -Y (przód)
        const cabBokPFrontAnchor = bindAnchorToRigidBody(bokP, makeAnchor({
            nodeId: bokP.id,
            kind: 'FACE',
            faceName: 'FACE_X_MINUS',
        }));
        expect(anchorFullLabel(cabBokPFrontAnchor, doc)).toBe('Bok_P [przód (-Y)]');

        // Panel wolnostojący
        const panelData = doc.createPanel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Panel_Test',
            engineManaged: false,
        }) as PanelModel;
        const panelNode = doc.findNode(panelData.id)!;
        panelNode.setLocalTransform(new Vec3(0, mmToNm(150), mmToNm(360)));

        // Front panelu wolnostojącego w CAD to -Y (FACE_Z_MINUS)
        const panelFrontAnchor = bindAnchorToRigidBody(panelNode, makeAnchor({
            nodeId: panelNode.id,
            kind: 'FACE',
            faceName: 'FACE_Z_MINUS',
        }));

        const store = ConstraintStore.instance;
        store.clear();
        store.add({
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cab.id, kind: 'OBJECT' }),
        });
        store.add({
            bindType: 'COPLANAR',
            anchorA: cabBokPFrontAnchor,
            anchorB: panelFrontAnchor,
            offsetMm: 0,
        });

        const hist = new CommandHistory(doc);
        const ctrl = new SolverController(store);
        ctrl.attach(doc, hist);

        const ok = ctrl.solveNow();
        expect(ok).toBe(true);

        const cabRes = resolveAnchor(cab, cabBokPFrontAnchor, bokP)!;
        const cabWorldPt = localMmToWorldMm(cab, cabRes.localPointMm);
        expect(Math.round(cabWorldPt.y)).toBe(-280);

        const panelRes = resolveAnchor(panelNode, panelFrontAnchor, panelNode)!;
        const panelWorldPt = localMmToWorldMm(panelNode, panelRes.localPointMm);
        expect(Math.round(panelWorldPt.y)).toBe(-280);

        // Front panelu i front boku Bok_P leżą idealnie w jednej płaszczyźnie Y = -280 mm
        expect(Math.abs(cabWorldPt.y - panelWorldPt.y)).toBeLessThan(0.01);
    });
});
