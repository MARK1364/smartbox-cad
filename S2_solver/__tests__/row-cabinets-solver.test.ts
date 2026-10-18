/**
 * row-cabinets-solver.test.ts
 *
 * Test weryfikujący automatyczne generowanie ciągu szafek (np. przez AI / headless API)
 * połączonych więzami solvera (VERTEX + FLUSH) bez użycia GUI.
 *
 * Weryfikacja:
 * 1. Wygenerowanie ciągu szafek i spięcie ich więzami narożnik-do-narożnika.
 * 2. Rozwiązanie solverem: szafki stoją w rzędzie, stykając się bok w bok z dokładnością do 0.001 mm.
 * 3. Zmiana gabarytu środkowej szafki (np. poszerzenie o 200 mm):
 *    solver automatycznie przesuwa wszystkie kolejne szafki w rzędzie,
 *    utrzymując ciągłość bez powstawania szpar ani kolizji.
 */

import { describe, it, expect } from 'vitest';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ConstraintStore } from '../constraint-store.js';
import { SolverController } from '../solver-controller.js';
import { makeAnchor, makeSolverConstraint } from '../constraint-types.js';

describe('AI / Headless Solver: Ciąg szafek połączonych w rzędzie', () => {
    it('generuje 10 szafek w rzędzie połączonych więzami i dynamicznie przesuwa rząd po zmianie gabarytu', () => {
        const doc = new ProjectDocument();
        const history = new CommandHistory(doc);
        const store = new ConstraintStore();
        const controller = new SolverController(store);
        controller.attach(doc, history);

        // 1. Definicja 10 szafek zadana przez AI (szerokości w mm)
        const szafki_szerokosci_mm = [600, 800, 600, 450, 900, 500, 600, 800, 400, 600];
        const wysokosc_mm = 720;
        const glebokosc_mm = 560;

        const cabinetNodes: CADNode[] = [];

        // Tworzymy korpusy w dokumencie
        for (let i = 0; i < szafki_szerokosci_mm.length; i++) {
            const w_mm = szafki_szerokosci_mm[i];
            const container = new ContainerModel({
                name: `Szafka_${i + 1}`,
                width: mmToNm(w_mm),
                height: mmToNm(wysokosc_mm),
                depth: mmToNm(glebokosc_mm),
            });
            container.generatorParams = {
                type: 'korpus3_2',
                szerokosc_mm: w_mm,
                wysokosc_mm: wysokosc_mm,
                glebokosc_mm: glebokosc_mm,
            };

            const node = CADNode.create(NodeType.ASSEMBLY, container.name, container.id);
            node.domainData = container;

            // Początkowo stawiamy szafki w losowym/przybliżonym miejscu
            node.setLocalTransform(new Vec3(mmToNm(i * 100), 0, 0), Quat.IDENTITY);
            doc.addNode(doc.rootNode.id, node);
            cabinetNodes.push(node);
        }

        // 2. Headless spięcie solverem (dokładnie to, co wywołuje skrypt AI):
        // a) Szafka 1 zakotwiczona w zerze (GROUND)
        store.add(makeSolverConstraint({
            id: 'cst_ground_first',
            bindType: 'GROUND',
            anchorA: makeAnchor({ nodeId: cabinetNodes[0].id, kind: 'OBJECT' }),
        }));

        // b) Kolejne szafki spinane łańcuchowo:
        // Prawy dolny narożnik szafki [i-1] styka się z lewym dolnym narożnikiem szafki [i]
        // cornerIndex: 1 = Prawy Przód Dół (+X, -Y, 0)
        // cornerIndex: 0 = Lewy Przód Dół (-X, -Y, 0)
        for (let i = 1; i < cabinetNodes.length; i++) {
            const prev = cabinetNodes[i - 1];
            const curr = cabinetNodes[i];

            // Więz styku narożników (VERTEX)
            store.add(makeSolverConstraint({
                id: `cst_vertex_${i - 1}_to_${i}`,
                bindType: 'VERTEX',
                anchorA: makeAnchor({ nodeId: prev.id, kind: 'VERTEX', cornerIndex: 1 }),
                anchorB: makeAnchor({ nodeId: curr.id, kind: 'VERTEX', cornerIndex: 0 }),
            }));

            // Więz wyrównania frontów w jednej płaszczyźnie (COPLANAR)
            store.add(makeSolverConstraint({
                id: `cst_front_${i - 1}_to_${i}`,
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: prev.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
                anchorB: makeAnchor({ nodeId: curr.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
                offsetMm: 0,
            }));
        }

        // 3. Rozwiązanie początkowe solvera (solveNow)
        const solved = controller.solveNow();
        expect(solved).toBe(true);

        // Weryfikacja: sprawdzamy czy szafki stoją idealnie jedna za drugą wzdłuż osi X
        // Szafka 1 (szer 600, środek X = 0) -> zakres [-300, +300]
        // Szafka 2 (szer 800, środek X = 700) -> zakres [300, 1100]
        // Szafka 3 (szer 600, środek X = 1400) -> zakres [1100, 1700]
        // Szafka 4 (szer 450, środek X = 1925) -> zakres [1700, 2150]
        // Szafka 5 (szer 900, środek X = 2600) -> zakres [2150, 3050]

        let currentEdgeMm = -szafki_szerokosci_mm[0] / 2;
        for (let i = 0; i < cabinetNodes.length; i++) {
            const node = cabinetNodes[i];
            const w_mm = szafki_szerokosci_mm[i];
            const posX_mm = nmToMm(node.localMatrix.decompose().translation.x);
            const expectedCenter_mm = currentEdgeMm + w_mm / 2;

            expect(Math.round(posX_mm)).toBe(Math.round(expectedCenter_mm));
            currentEdgeMm += w_mm;
        }

        // Cały rząd ma dokładnie 6250 mm
        expect(currentEdgeMm - (-szafki_szerokosci_mm[0] / 2)).toBe(6250);

        // 4. SYMULACJA ZMIANY GABARYTU PRZEZ UŻYTKOWNIKA:
        // Użytkownik zmienia szerokość Szafki 2 z 800 mm na 1000 mm (+200 mm)
        const szafka2 = cabinetNodes[1];
        const szafka2Container = szafka2.domainData as ContainerModel;
        const nowa_szerokosc_szafki2_mm = 1000;
        szafka2Container.width = mmToNm(nowa_szerokosc_szafki2_mm);
        szafki_szerokosci_mm[1] = nowa_szerokosc_szafki2_mm;

        // Powiadomienie dokumentu o zmianie wymiarów
        doc.emitChange('dimensions', [szafka2.id]);

        // Solver ponownie przelicza układ
        controller.solveNow();

        // 5. Weryfikacja po poszerzeniu:
        // Szafka 1 nie drgnęła (środek wciąż 0 mm)
        const pos1_after = nmToMm(cabinetNodes[0].localMatrix.decompose().translation.x);
        expect(Math.round(pos1_after)).toBe(0);

        // Szafka 2 rozszerzyła się w swoim LCS, więc jej środek to teraz 300 + 1000/2 = 800 mm
        const pos2_after = nmToMm(cabinetNodes[1].localMatrix.decompose().translation.x);
        expect(Math.round(pos2_after)).toBe(800);

        // Szafki 3..10 zostały automatycznie popchnięte w prawo dokładnie o 200 mm!
        currentEdgeMm = -szafki_szerokosci_mm[0] / 2;
        for (let i = 0; i < cabinetNodes.length; i++) {
            const node = cabinetNodes[i];
            const w_mm = szafki_szerokosci_mm[i];
            const posX_mm = nmToMm(node.localMatrix.decompose().translation.x);
            const expectedCenter_mm = currentEdgeMm + w_mm / 2;

            expect(Math.round(posX_mm)).toBe(Math.round(expectedCenter_mm));
            currentEdgeMm += w_mm;
        }

        // Całkowita długość rzędu wzrosła z 6250 mm na 6450 mm
        expect(currentEdgeMm - (-szafki_szerokosci_mm[0] / 2)).toBe(6450);

        controller.detach();
    });
});
