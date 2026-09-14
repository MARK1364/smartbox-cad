import { describe, it, expect } from 'vitest';
import { isContainerNode, isSmartBoxTreeItem, isHardwareNode } from '../../src/SceneTree.js';
import { DrawingProjectExtractor } from '../../R2_rys/drawing-project-extractor.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { SMARTBOX_ALL_OPTIONS, SMARTBOX_CATEGORY_NAMES } from '../smartbox-bay-actions.js';
import { buildDrawersPlan } from '../drawers-adapter.js';
import { applyPlanToContainer } from '../../A3_smartframe/smartframe-adapter.js';
import { ReportDataNormalizer } from '../../R1_reports/report-data-normalizer.js';

describe('SmartBox Tree Node classification', () => {
    it('isContainerNode returns true for DRAWERS, SHELVES, CONTAINER, ASSEMBLY, SUBASSEMBLY and false for PART and PROJECT', () => {
        expect(isContainerNode({ id: '1', name: 'Szuflady', type: 'DRAWERS', icon: '🗄️', width: 500, height: 600, depth: 500, partCount: 5 })).toBe(true);
        expect(isContainerNode({ id: '2', name: 'Półki', type: 'SHELVES', icon: '📚', width: 500, height: 600, depth: 500, partCount: 3 })).toBe(true);
        expect(isContainerNode({ id: '3', name: 'Korpus', type: 'CONTAINER', icon: '📦', width: 600, height: 720, depth: 560, partCount: 5 })).toBe(true);
        expect(isContainerNode({ id: '4', name: 'Zespół', type: 'ASSEMBLY', icon: '📦', width: 600, height: 720, depth: 560, partCount: 5 })).toBe(true);
        expect(isContainerNode({ id: '5', name: 'Podzespół', type: 'SUBASSEMBLY', icon: '📦', width: 600, height: 720, depth: 560, partCount: 2 })).toBe(true);

        expect(isContainerNode({ id: '6', name: 'Bok Lewy', type: 'PART', icon: '🪵', width: 18, height: 720, depth: 560, partCount: 1 })).toBe(false);
        expect(isContainerNode({ id: '7', name: 'Projekt', type: 'PROJECT', icon: '📁', width: 600, height: 720, depth: 560, partCount: 10 })).toBe(false);
    });

    it('isSmartBoxTreeItem identifies all SmartBox categories properly', () => {
        for (const opt of SMARTBOX_ALL_OPTIONS) {
            const sbName = SMARTBOX_CATEGORY_NAMES[opt.id];
            const node: any = {
                id: `sb_${opt.id}`,
                name: sbName,
                type: opt.id === 'DRAWERS' ? 'DRAWERS' : opt.id === 'SHELVES' ? 'SHELVES' : 'CONTAINER',
                icon: '📦',
                width: 500,
                height: 500,
                depth: 500,
                partCount: 1,
                generatorParams: { type: opt.type, boxType: opt.id }
            };
            expect(isSmartBoxTreeItem(node)).toBe(true);
            expect(isContainerNode(node)).toBe(true);
        }
    });

    it('extractProjectTree maps all smartbox options as container nodes with proper types and children', () => {
        const doc = new ProjectDocument({ name: 'TestProject' });
        ContextManager.instance.document = doc;

        const cabinet = new ContainerModel({ name: 'Korpus', width: 600000000, height: 720000000, depth: 560000000 });
        const cabNode = CADNode.create(NodeType.ASSEMBLY, 'Korpus', cabinet.id);
        cabNode.domainData = cabinet;
        doc.rootNode.addChild(cabNode);

        for (const opt of SMARTBOX_ALL_OPTIONS) {
            const sbName = SMARTBOX_CATEGORY_NAMES[opt.id];
            const sbContainer = new ContainerModel({ name: sbName, width: 564000000, height: 350000000, depth: 500000000 });
            sbContainer.generatorParams = { type: opt.type, boxType: opt.id };
            const sbNode = CADNode.create(NodeType.ASSEMBLY, sbName, sbContainer.id);
            sbNode.domainData = sbContainer;
            cabNode.addChild(sbNode);
        }

        const tree = DrawingProjectExtractor.instance.extractProjectTree();
        const cabTree = tree.rootNode.children![0];
        expect(cabTree.children?.length).toBe(SMARTBOX_ALL_OPTIONS.length);

        for (let i = 0; i < SMARTBOX_ALL_OPTIONS.length; i++) {
            const opt = SMARTBOX_ALL_OPTIONS[i];
            const childTree = cabTree.children![i];
            expect(isContainerNode(childTree)).toBe(true);
            expect(isSmartBoxTreeItem(childTree)).toBe(true);
            if (opt.id === 'DRAWERS') {
                expect(childTree.type).toBe('DRAWERS');
            } else if (opt.id === 'SHELVES') {
                expect(childTree.type).toBe('SHELVES');
            } else {
                expect(childTree.type).toBe('CONTAINER');
            }
        }
    });

    it('creates drawer rails as independent NodeType.HARDWARE nodes with correct pricing and exclusion when frozen', () => {
        const doc = new ProjectDocument({ name: 'DrawerTest' });
        ContextManager.instance.document = doc;

        const cabinet = new ContainerModel({ name: 'Szafka_Dolna', width: 600000000, height: 720000000, depth: 560000000 });
        const cabNode = CADNode.create(NodeType.ASSEMBLY, 'Szafka_Dolna', cabinet.id);
        cabNode.domainData = cabinet;
        doc.addNode(doc.rootNode.id, cabNode);

        const sbContainer = new ContainerModel({ name: 'Szuflady_SB', width: 564000000, height: 720000000, depth: 500000000 });
        sbContainer.generatorParams = { type: 'smartbox_drawers', boxType: 'DRAWERS', count: 2, rail_system: 'M94', length: '500' };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, 'Szuflady_SB', sbContainer.id);
        sbNode.domainData = sbContainer;
        doc.addNode(cabNode.id, sbNode);

        const plan = buildDrawersPlan(sbContainer.generatorParams, { width: 564, height: 720, depth: 500 });
        applyPlanToContainer(sbContainer, plan);

        // Prowadnice są dziećmi kontenera typu NodeType.HARDWARE
        const hwNodes = sbNode.children.filter(c => c.nodeType === NodeType.HARDWARE);
        expect(hwNodes.length).toBe(4); // 2 szuflady * 2 (L + P)

        const railL1 = hwNodes.find(h => h.name.includes('1L'));
        expect(railL1).toBeDefined();
        expect(isHardwareNode({ type: 'HARDWARE', name: railL1!.name } as any)).toBe(true);
        expect((railL1!.domainData as any).hardwareType).toBe('RAIL');

        // Front i prowadnica to rodzeństwo
        const front1 = sbNode.children.find(c => c.name.includes('Front_1'));
        expect(front1).toBeDefined();
        expect(front1!.parent).toBe(sbNode);
        expect(railL1!.parent).toBe(sbNode);

        // Formatki dna i pleców dla szuflady systemowej
        const bottom1 = sbNode.children.find(c => c.name.includes('Dno_1'));
        expect(bottom1).toBeDefined();
        expect((bottom1!.domainData as any).role).toBe('DRAWER_BOTTOM');
        expect((bottom1!.domainData as any).materialId).toBe('W1100_ST9_16');

        const back1 = sbNode.children.find(c => c.name.includes('Plecy_1'));
        expect(back1).toBeDefined();
        expect((back1!.domainData as any).role).toBe('DRAWER_BACK');
        expect((back1!.domainData as any).materialId).toBe('W1100_ST9_16');

        // Ukrycie frontu nie ukrywa prowadnicy ani dna
        (front1!.domainData as any).visible = false;
        expect((railL1!.domainData as any).visible).toBe(true);
        expect((bottom1!.domainData as any).visible).toBe(true);

        // Raport sumuje szuflady tego samego typu w danym korpusie (2 szuflady = 1 pozycja z qty: 2)
        const report = ReportDataNormalizer.extractProjectData(doc);
        const antaroItems = report.accessories.filter(a => a.library_id.startsWith('BLUM_ANTARO_M_'));
        expect(antaroItems.length).toBe(1);
        expect(antaroItems[0].qty).toBe(2);
        expect(antaroItems[0].name).toContain('Antaro');

        // Zamrożenie szuflady 1 (obu prowadnic) zmniejsza ilość w zsumowanej pozycji do 1 kpl
        const railR1 = hwNodes.find(h => h.name.includes('1P'));
        (railL1!.domainData as any).frozen = true;
        (railR1!.domainData as any).frozen = true;
        const reportAfterFreeze = ReportDataNormalizer.extractProjectData(doc);
        const antaroItemsAfterFreeze = reportAfterFreeze.accessories.filter(a => a.library_id.startsWith('BLUM_ANTARO_M_'));
        expect(antaroItemsAfterFreeze.length).toBe(1);
        expect(antaroItemsAfterFreeze[0].qty).toBe(1);
    });
});
