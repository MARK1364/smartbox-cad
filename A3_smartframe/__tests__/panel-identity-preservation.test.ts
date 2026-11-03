import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../commands/create-korpus-command.js';
import { applyRealtimeUpdate } from '../smartframe-adapter.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ConstraintStore } from '../../S2_solver/constraint-store.js';
import { SolverController } from '../../S2_solver/solver-controller.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { bindAnchorToRigidBody } from '../../S2_solver/constraint-picker.js';
import { makeAnchor, makeSolverConstraint } from '../../S2_solver/constraint-types.js';
import { validateConstraints } from '../../S2_solver/constraint-validation.js';
import { planCabinet } from '../smartframe-engine.js';

describe('Panel Identity Preservation (Zakaz matchowania po name)', () => {
    it('własna nazwa użytkownika przetrwa regenerację na obu poziomach (panel.name i panelNode.name), a programy CAM i ID są zachowane', () => {
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

        const cabinetNode = doc.findNode((cmd as any).createdId!)!;
        expect(cabinetNode).toBeDefined();

        const bokLNode = cabinetNode.children.find((c) => (c.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;
        const bokRNode = cabinetNode.children.find((c) => (c.domainData as any)?.role === 'RIGHT_SIDE_PANEL')!;
        expect(bokLNode).toBeDefined();
        expect(bokRNode).toBeDefined();

        const originalBokLId = bokLNode.id;
        const originalBokRId = bokRNode.id;

        // Użytkownik zmienia nazwę w UI drzewa sceny na własną (symulacja akcji Rename)
        const panelL = bokLNode.domainData as PanelModel;
        const customNameL = 'Własny Bok Lewy z Podcięciem';
        panelL.name = customNameL;
        panelL.nameUserDefined = true;
        bokLNode.name = customNameL;

        const panelR = bokRNode.domainData as PanelModel;
        const customNameR = 'Custom Right Side Panel';
        panelR.name = customNameR;
        panelR.nameUserDefined = true;
        bokRNode.name = customNameR;

        // Dołączamy program CAM / CNC powiązany z formatką L
        panelL.cncPrograms = [
            {
                id: 'cnc_drill_side_l',
                name: 'Program_Bok_L_Wiercenie',
                targetPanelId: originalBokLId,
                features: [],
            },
        ];

        // Zmiana wymiarów szafki z 600 na 900 mm i wysokości na 800 mm
        applyRealtimeUpdate(doc, { szerokosc_mm: 900, wysokosc_mm: 800 }, cabinetNode.domainData);

        // Po przebudowie: węzły boku lewego i prawego MUSZĄ zachować identyczne UUID
        const bokLAfter = cabinetNode.children.find((c) => (c.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;
        const bokRAfter = cabinetNode.children.find((c) => (c.domainData as any)?.role === 'RIGHT_SIDE_PANEL')!;

        expect(bokLAfter.id).toBe(originalBokLId);
        expect(bokRAfter.id).toBe(originalBokRId);
        expect(doc.findNode(originalBokLId)).toBe(bokLAfter);
        expect(doc.findNode(originalBokRId)).toBe(bokRAfter);

        // Asercja 1: Własne nazwy użytkownika przetrwały na OBU poziomach (panel.name oraz CADNode.name)
        expect(bokLAfter.name).toBe(customNameL);
        expect((bokLAfter.domainData as PanelModel).name).toBe(customNameL);
        expect(bokRAfter.name).toBe(customNameR);
        expect((bokRAfter.domainData as PanelModel).name).toBe(customNameR);

        // Asercja 2: Programy CAM / CNC przetrwały i targetPanelId nadal wskazuje ten panel
        const programsAfter = (bokLAfter.domainData as PanelModel).cncPrograms;
        expect(programsAfter).toBeDefined();
        expect(programsAfter.length).toBe(1);
        expect(programsAfter[0].id).toBe('cnc_drill_side_l');
        expect(programsAfter[0].targetPanelId).toBe(originalBokLId);

        // Wymiary formatki zostały prawidłowo zaktualizowane
        expect(bokLAfter.domainData?.height).toBe(mmToNm(800));
    });

    it('więzy Solvera powiązane z formatką o zmienionej nazwie rozwiązują się bez błędów po zmianie wymiarów korpusu', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const history = new CommandHistory(doc);
        const store = new ConstraintStore();
        const controller = new SolverController(store);
        controller.attach(doc, history);

        // Szafka A na X=0, Szafka B na X=600
        const cmdA = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 },
        });
        cmdA.execute(doc);
        const cabANode = doc.findNode((cmdA as any).createdId!)!;

        const cmdB = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 600, y: 0, z: 0 },
        });
        cmdB.execute(doc);
        const cabBNode = doc.findNode((cmdB as any).createdId!)!;

        const bokP_A = cabANode.children.find((c) => (c.domainData as any)?.role === 'RIGHT_SIDE_PANEL')!;
        const bokL_B = cabBNode.children.find((c) => (c.domainData as any)?.role === 'LEFT_SIDE_PANEL')!;

        // Użytkownik zmienia nazwy formatek w drzewie sceny
        (bokP_A.domainData as PanelModel).name = 'Prawy Bok A (Custom)';
        (bokP_A.domainData as PanelModel).nameUserDefined = true;
        bokP_A.name = 'Prawy Bok A (Custom)';

        (bokL_B.domainData as PanelModel).name = 'Lewy Bok B (Custom)';
        (bokL_B.domainData as PanelModel).nameUserDefined = true;
        bokL_B.name = 'Lewy Bok B (Custom)';

        // Uziemienie szafki A
        store.add(makeSolverConstraint({
            id: 'c_ground',
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cabANode.id, kind: 'OBJECT' }),
        }));

        // Wiązanie FLUSH między prawym bokiem A a lewym bokiem B
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

        store.add(makeSolverConstraint({
            id: 'c_flush_ab',
            bindType: 'FLUSH',
            anchorA,
            anchorB,
        }));

        controller.solveNow();
        expect(Math.round(nmToMm(cabBNode.localMatrix.decompose().translation.x))).toBe(600);

        // Zwiększamy szafkę A z 600 na 800 mm
        applyRealtimeUpdate(doc, { szerokosc_mm: 800 }, cabANode.domainData);

        // Walidacja: zero ostrzeżeń STALE_SOURCE i zero błędów
        const val = validateConstraints(store.constraints, doc);
        expect(val.issues.filter((i) => i.code === 'STALE_SOURCE')).toHaveLength(0);
        expect(val.issues.filter((i) => i.severity === 'error')).toHaveLength(0);

        // Solver przelicza i dociąga szafkę B do nowej krawędzi (X = 400 + 300 = 700 mm)
        controller.solveNow();
        expect(Math.round(nmToMm(cabBNode.localMatrix.decompose().translation.x))).toBe(700);

        controller.detach();
    });

    it('generatory planu szafki tworzą deterministyczne i unikalne klucze key dla wszystkich części', () => {
        // Standardowy korpus 3-strefowy — pierwsze wywołanie
        const planStandard = planCabinet({
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 3,
        });
        const keysStandard = planStandard.parts.map((p) => p.key).filter(Boolean);
        expect(keysStandard.length).toBe(planStandard.parts.length);
        const uniqueKeysStandard = new Set(keysStandard);
        expect(uniqueKeysStandard.size).toBe(keysStandard.length);

        // Powtórne wywołanie z tymi samymi parametrami (determinizm idempotencji)
        const planStandardRepeat = planCabinet({
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 3,
        });
        const keysStandardRepeat = planStandardRepeat.parts.map((p) => p.key).filter(Boolean);
        expect(keysStandardRepeat).toEqual(keysStandard);

        // Wywołanie ze zmienionymi wymiarami gabarytowymi (determinizm niezależny od wymiarów)
        const planStandardResized = planCabinet({
            szerokosc_mm: 1200,
            wysokosc_mm: 2400,
            glebokosc_mm: 700,
            liczba_stref: 3,
        });
        const keysStandardResized = planStandardResized.parts.map((p) => p.key).filter(Boolean);
        expect(keysStandardResized).toEqual(keysStandard);

        // Korpus narożny rogowy90
        const planCorner = planCabinet({
            szerokosc_mm: 900,
            wysokosc_mm: 720,
            glebokosc_mm: 900,
            typ_korpusu: 'korpus_rogowy90',
        });
        const keysCorner = planCorner.parts.map((p) => p.key).filter(Boolean);
        expect(keysCorner.length).toBe(planCorner.parts.length);
        const uniqueKeysCorner = new Set(keysCorner);
        expect(uniqueKeysCorner.size).toBe(keysCorner.length);

        const planCornerResized = planCabinet({
            szerokosc_mm: 1000,
            wysokosc_mm: 850,
            glebokosc_mm: 1000,
            typ_korpusu: 'korpus_rogowy90',
        });
        expect(planCornerResized.parts.map((p) => p.key).filter(Boolean)).toEqual(keysCorner);

        // Korpus skośny
        const planSkosny = planCabinet({
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            typ_korpusu: 'korpus_skosny',
        });
        const keysSkosny = planSkosny.parts.map((p) => p.key).filter(Boolean);
        expect(keysSkosny.length).toBe(planSkosny.parts.length);
        const uniqueKeysSkosny = new Set(keysSkosny);
        expect(uniqueKeysSkosny.size).toBe(keysSkosny.length);

        const planSkosnyResized = planCabinet({
            szerokosc_mm: 1000,
            wysokosc_mm: 2500,
            glebokosc_mm: 700,
            typ_korpusu: 'korpus_skosny',
        });
        expect(planSkosnyResized.parts.map((p) => p.key).filter(Boolean)).toEqual(keysSkosny);
    });

    it('PanelModel serializuje i deserializuje techniczne pola tożsamości oraz flagę nameUserDefined', () => {
        const panel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            role: 'LEFT_SIDE_PANEL',
            name: 'Własna Nazwa',
        });
        panel.key = 'B_BOK_L';
        panel.zoneId = 'SEKCJA_B';
        panel.zonePrefix = 'B_';
        panel.nameUserDefined = true;

        const json = panel.toJSON();
        expect((json as any).key).toBe('B_BOK_L');
        expect((json as any).zoneId).toBe('SEKCJA_B');
        expect((json as any).zonePrefix).toBe('B_');
        expect((json as any).nameUserDefined).toBe(true);

        const restored = new PanelModel({
            width: mmToNm(100),
            height: mmToNm(100),
            thickness: mmToNm(18),
        });
        restored.fromJSON(json);

        expect(restored.key).toBe('B_BOK_L');
        expect(restored.zoneId).toBe('SEKCJA_B');
        expect(restored.zonePrefix).toBe('B_');
        expect(restored.nameUserDefined).toBe(true);
        expect(restored.role).toBe('LEFT_SIDE_PANEL');
    });

    it('PanelModel.loadFromJSON restores identity fields and clears fields omitted from the snapshot', () => {
        const panel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            role: 'LEFT_SIDE_PANEL',
            name: 'Panel',
        });
        panel.key = 'B_BOK_L';
        panel.zoneId = 'SEKCJA_B';
        panel.zonePrefix = 'B_';
        panel.nameUserDefined = true;

        panel.loadFromJSON({
            key: 'B_BOK_L_90',
            zoneId: 'SEKCJA_C',
            zonePrefix: 'C_',
            nameUserDefined: true,
        });
        expect(panel.key).toBe('B_BOK_L_90');
        expect(panel.zoneId).toBe('SEKCJA_C');
        expect(panel.zonePrefix).toBe('C_');
        expect(panel.nameUserDefined).toBe(true);

        panel.loadFromJSON({});
        expect(panel.key).toBeUndefined();
        expect(panel.zoneId).toBeUndefined();
        expect(panel.zonePrefix).toBeUndefined();
        expect(panel.nameUserDefined).toBe(false);
    });

    it('dwa korpusy o tych samych domyślnych nazwach formatek zachowują unikalność nazw w scenie po regeneracji', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;

        const cmd1 = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 0, y: 0, z: 0 },
        });
        cmd1.execute(doc);
        const cab1 = doc.findNode((cmd1 as any).createdId!)!;

        const cmd2 = new CreateKorpusCommand({
            szerokosc_mm: 600,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            typ_korpusu: 'korpus3',
            position: { x: 700, y: 0, z: 0 },
        });
        cmd2.execute(doc);
        const cab2 = doc.findNode((cmd2 as any).createdId!)!;

        // Regenerujemy korpus 1 (zmiana szerokości na 800)
        applyRealtimeUpdate(doc, { szerokosc_mm: 800 }, cab1.domainData);

        // Regenerujemy korpus 2 (zmiana szerokości na 900)
        applyRealtimeUpdate(doc, { szerokosc_mm: 900 }, cab2.domainData);

        // Wszystkie nazwy węzłów w całym dokumencie muszą być w 100% unikalne
        const allNames: string[] = [];
        for (const [, node] of (doc as any)._nodeIndex) {
            if (node.name) allNames.push(node.name);
        }
        const uniqueSet = new Set(allNames);
        expect(allNames.length).toBe(uniqueSet.size);

        // Formatki w korpusie 2 nie kolidują z formatkami w korpusie 1
        const cab1PartNames = cab1.children.map((c) => c.name);
        const cab2PartNames = cab2.children.map((c) => c.name);
        for (const name of cab2PartNames) {
            expect(cab1PartNames).not.toContain(name);
        }
    });
});
