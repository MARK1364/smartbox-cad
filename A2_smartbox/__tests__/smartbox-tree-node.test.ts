import { describe, it, expect } from 'vitest';
import { isContainerNode, isSmartBoxTreeItem } from '../../src/SceneTree.js';
import { DrawingProjectExtractor } from '../../R2_rys/drawing-project-extractor.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { SMARTBOX_ALL_OPTIONS, SMARTBOX_CATEGORY_NAMES } from '../smartbox-bay-actions.js';

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
});
