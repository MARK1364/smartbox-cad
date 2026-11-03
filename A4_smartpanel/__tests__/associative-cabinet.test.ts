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
});
