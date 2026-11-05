import { describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import {
    distanceBetweenPlanesMm,
    applyAssociativeDim,
    applyAllAssociativeDims,
} from '../associative-dim.js';
import { planCabinet } from '../../A3_smartframe/smartframe-engine.js';
import { applyPlanToContainer, runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { PanelModel } from '../panel-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';

describe('szafa SmartFrame i asocjacyjny panel', () => {
    it('mierzy odległość wewnętrzną boków i rozszerza panel przy zmianie szafy', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'Szafa' }) as any;
        cabinet.generatorParams = {
            type: 'korpus3_2',
            szerokosc_mm: 800,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
        };
        const plan = planCabinet(cabinet.generatorParams);
        applyPlanToContainer(cabinet, plan);

        const leftNode = doc.getPanels().find((p: any) => p.domainData?.role === 'LEFT_SIDE_PANEL')!;
        const rightNode = doc.getPanels().find((p: any) => p.domainData?.role === 'RIGHT_SIDE_PANEL')!;
        expect(leftNode).toBeDefined();
        expect(rightNode).toBeDefined();

        // 1. Zmierz odległość między wewnętrznymi ścianami boków (800 - 2*18 = 764 mm)
        // Dla obu boków lico wewnętrzne to FACE_Z_PLUS
        const leftInnerRef = { nodeId: leftNode.id, face: 'FACE_Z_PLUS' };
        const rightInnerRef = { nodeId: rightNode.id, face: 'FACE_Z_PLUS' };
        const initialDist = distanceBetweenPlanesMm(doc, leftInnerRef, rightInnerRef);
        expect(initialDist).toBeCloseTo(764, 1);

        // 2. Wstaw manualną formatkę do projektu
        const manualPanel = new PanelModel({
            width: mmToNm(500),
            height: mmToNm(300),
            thickness: mmToNm(18),
            name: 'Półka_Specjalna',
            role: 'MANUAL_PANEL',
            engineManaged: false,
        });
        const manualNode = CADNode.create(NodeType.PART, manualPanel.name, manualPanel.id);
        manualNode.domainData = manualPanel;
        doc.addNode(doc.rootNode.id, manualNode);

        // Przypisz asocjacyjny wymiar szerokości
        manualPanel.associativeDims = {
            width: {
                planeA: leftInnerRef,
                planeB: rightInnerRef,
                offsetMm: 0,
            },
        };

        // Rozciągnij panel do wymiaru szafy
        const resized = applyAssociativeDim(doc, manualPanel, 'width');
        expect(resized).toBe(true);
        expect(nmToMm(manualPanel.width)).toBeCloseTo(764, 1);

        // 3. Zmień gabaryt szafy z 800 mm na 1000 mm
        runEngineAndApply(cabinet, 1000, 720, 560, 1, 0, 0, 0);

        // Panel powinien asocjatywnie dostosować szerokość do 1000 - 36 = 964 mm
        expect(nmToMm(manualPanel.width)).toBeCloseTo(964, 1);
    });

    it('obsługuje asocjacyjną wysokość między wieńcem dolnym i górnym', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'Szafa' }) as any;
        cabinet.generatorParams = {
            type: 'korpus3_2',
            szerokosc_mm: 800,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
        };
        const plan = planCabinet(cabinet.generatorParams);
        applyPlanToContainer(cabinet, plan);

        const bottomNode = doc.getPanels().find((p: any) => p.domainData?.role === 'BOTTOM_PANEL')!;
        const topNode = doc.getPanels().find((p: any) => p.domainData?.role === 'TOP_PANEL')!;
        expect(bottomNode).toBeDefined();
        expect(topNode).toBeDefined();

        // Wieniec dolny górna ściana i wieniec górny dolna ściana: 720 - 2*18 = 684 mm
        const bottomInnerRef = { nodeId: bottomNode.id, face: 'FACE_Z_PLUS' };
        const topInnerRef = { nodeId: topNode.id, face: 'FACE_Z_PLUS' };
        const initialH = distanceBetweenPlanesMm(doc, bottomInnerRef, topInnerRef);
        expect(initialH).toBeCloseTo(684, 1);

        // Manualny panel z asocjacyjną wysokością
        const manualPanel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(400),
            thickness: mmToNm(18),
            name: 'Przegroda_Pionowa',
            role: 'MANUAL_PANEL',
            engineManaged: false,
        });
        const manualNode = CADNode.create(NodeType.PART, manualPanel.name, manualPanel.id);
        manualNode.domainData = manualPanel;
        doc.addNode(doc.rootNode.id, manualNode);

        manualPanel.associativeDims = {
            height: {
                planeA: bottomInnerRef,
                planeB: topInnerRef,
                offsetMm: -2, // 2mm luzu montażowego
            },
        };

        const resized = applyAssociativeDim(doc, manualPanel, 'height');
        expect(resized).toBe(true);
        expect(nmToMm(manualPanel.height)).toBeCloseTo(682, 1);

        // Zmień wysokość szafy z 720 mm na 900 mm
        runEngineAndApply(cabinet, 800, 900, 560, 1, 0, 0, 0);

        // Nowe światło = 900 - 36 = 864 mm, z offsetem -2 mm = 862 mm
        expect(nmToMm(manualPanel.height)).toBeCloseTo(862, 1);
    });

    it('obsługuje mapowanie referencji lcs.faces (INNER/OUTER)', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'Szafa' }) as any;
        cabinet.generatorParams = {
            type: 'korpus3_2',
            szerokosc_mm: 800,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
        };
        const plan = planCabinet(cabinet.generatorParams);
        applyPlanToContainer(cabinet, plan);

        const leftNode = doc.getPanels().find((p: any) => p.domainData?.role === 'LEFT_SIDE_PANEL')!;
        const rightNode = doc.getPanels().find((p: any) => p.domainData?.role === 'RIGHT_SIDE_PANEL')!;

        // Użyj symbolicznego 'INNER' zamiast canonical 'FACE_Z_PLUS'
        const d = distanceBetweenPlanesMm(
            doc,
            { nodeId: leftNode.id, face: 'INNER' },
            { nodeId: rightNode.id, face: 'INNER' }
        );
        // Lewy INNER = FACE_Z_PLUS (+X), prawy INNER = FACE_Z_PLUS (-X)
        expect(d).toBeCloseTo(764, 1);
    });

    it('obsługuje wymiar asocjacyjny między inną formatką SmartPanel a boczkiem korpusu (różne struktury oraz OUTLINE_SIDE_*)', () => {
        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        const cabinet = doc.createAssembly({ name: 'Szafa' }) as any;
        cabinet.generatorParams = {
            type: 'korpus3_2',
            szerokosc_mm: 800,
            wysokosc_mm: 720,
            glebokosc_mm: 560,
            liczba_stref: 1,
        };
        const plan = planCabinet(cabinet.generatorParams);
        applyPlanToContainer(cabinet, plan);

        const leftNode = doc.getPanels().find((p: any) => p.domainData?.role === 'LEFT_SIDE_PANEL')!;
        expect(leftNode).toBeDefined();

        // Drugi SmartPanel stojący po lewej stronie szafy (x = -1000 mm, szerokość = 200 mm -> prawa krawędź na x = -900 mm)
        // Boczek lewy szafy (szer. 800 mm) ma zewnętrzną ścianę FACE_Z_MINUS na x = -400 mm
        const refSmartPanel = new PanelModel({
            width: mmToNm(200),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Noga_Biurka',
            role: 'MANUAL_PANEL',
            engineManaged: false,
        });
        const refNode = CADNode.create(NodeType.PART, refSmartPanel.name, refSmartPanel.id);
        refNode.domainData = refSmartPanel;
        refNode.setLocalTransform(new Vec3(mmToNm(-1000), 0, mmToNm(360)), Quat.IDENTITY);
        doc.addNode(doc.rootNode.id, refNode);

        // 1. Wskazanie wąskiej ściany bocznej OUTLINE_SIDE_1 (+X, x = -900 mm) na SmartPanelu oraz zewnętrznej ściany boczka korpusu (x = -400 mm)
        const distOutlineToCabinet = distanceBetweenPlanesMm(
            doc,
            { nodeId: refNode.id, face: 'OUTLINE_SIDE_1' },
            { nodeId: leftNode.id, face: 'FACE_Z_MINUS' }
        );
        expect(distOutlineToCabinet).toBeCloseTo(500, 1);

        // 2. Nawet gdy użytkownik kliknie szeroką ścianę nieobróconego SmartPanela (FACE_Z_PLUS, środek x = -1000 mm) i boczek korpusu (x = -400 mm)
        const distBroadToCabinet = distanceBetweenPlanesMm(
            doc,
            { nodeId: refNode.id, face: 'FACE_Z_PLUS' },
            { nodeId: leftNode.id, face: 'FACE_Z_MINUS' }
        );
        expect(distBroadToCabinet).toBeCloseTo(600, 1);

        // 3. Docelowy SmartPanel, którego szerokość zależy od odległości między Noga_Biurka (OUTLINE_SIDE_1) a Bok_L (FACE_Z_MINUS)
        const targetSmartPanel = new PanelModel({
            width: mmToNm(300),
            height: mmToNm(500),
            thickness: mmToNm(18),
            name: 'Blenda_Podbiurkowa',
            role: 'MANUAL_PANEL',
            engineManaged: false,
        });
        const targetNode = CADNode.create(NodeType.PART, targetSmartPanel.name, targetSmartPanel.id);
        targetNode.domainData = targetSmartPanel;
        doc.addNode(doc.rootNode.id, targetNode);

        targetSmartPanel.associativeDims = {
            width: {
                planeA: { nodeId: refNode.id, face: 'OUTLINE_SIDE_1' },
                planeB: { nodeId: leftNode.id, face: 'FACE_Z_MINUS' },
                offsetMm: 0,
            },
        };

        expect(applyAssociativeDim(doc, targetSmartPanel, 'width')).toBe(true);
        expect(nmToMm(targetSmartPanel.width)).toBeCloseTo(500, 1);

        // Przesunięcie Noga_Biurka o 150 mm w lewo (x = -1150 mm -> prawa krawędź na x = -1050 mm, dystans = 650 mm)
        refNode.setLocalTransform(new Vec3(mmToNm(-1150), 0, mmToNm(360)), Quat.IDENTITY);
        expect(applyAllAssociativeDims(doc)).toBe(true);
        expect(nmToMm(targetSmartPanel.width)).toBeCloseTo(650, 1);
    });
});
