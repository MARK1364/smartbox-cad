/**
 * Upsert FEATURE/Parts przy zmianie parametrów grupy SmartPart (hangers).
 * updateHangerSmartPartParams musi:
 *  - usuwać FEATURE usunięte z definicji,
 *  - dodawać FEATURE nowe (nowy cięcie albo nowy Part),
 *  - synchronizować wymiary/etykietę istniejących cięć,
 *  - usuwać węzeł Parta usuniętego z definicji.
 */
import { describe, it, expect } from 'vitest';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { SmartPartCutModel } from '../../A2_bloki/hangers/smartpart-cut-model.js';
import { SMARTPART_HANGER_TYPE } from '../../A2_bloki/hangers/hanger-types.js';
import { updateHangerSmartPartParams } from '../../A2_bloki/hangers/hanger-apply.js';

const P1 = {
    id: 'p1', name: 'LEWA', glbPath: '',
    widthMm: 100, heightMm: 50, depthMm: 30,
    refX: 'CENTER', refY: 'CENTER', refZ: 'CENTER',
    offsetX_mm: 0, offsetY_mm: 0, offsetZ_mm: 0,
};
const P2 = {
    id: 'p2', name: 'PRAWA', glbPath: '',
    widthMm: 90, heightMm: 60, depthMm: 25,
    refX: 'CENTER', refY: 'CENTER', refZ: 'CENTER',
    offsetX_mm: 0, offsetY_mm: 0, offsetZ_mm: 0,
};
const C1: any = {
    id: 'c1', type: 'POCKET', name: 'Rowek', partId: 'p1',
    widthMm: 15, heightMm: 40, depthMm: 12,
    refX: 'CENTER', refY: 'CENTER', refZ: 'CENTER',
    offsetX_mm: 0, offsetY_mm: 0, offsetZ_mm: 0,
};
const C2: any = {
    id: 'c2', type: 'POCKET', name: 'Kieszen', partId: 'p1',
    widthMm: 20, heightMm: 30, depthMm: 10,
    refX: 'CENTER', refY: 'CENTER', refZ: 'CENTER',
    offsetX_mm: 0, offsetY_mm: 0, offsetZ_mm: 0,
};
const C3: any = {
    id: 'c3', type: 'POCKET', name: 'Rowek_p2', partId: 'p2',
    widthMm: 18, heightMm: 35, depthMm: 11,
    refX: 'CENTER', refY: 'CENTER', refZ: 'CENTER',
    offsetX_mm: 0, offsetY_mm: 0, offsetZ_mm: 0,
};

function clone(x: any): any {
    return JSON.parse(JSON.stringify(x));
}

function partNodeFor(groupNode: CADNode, partId: string): CADNode | undefined {
    return (groupNode.children || []).find(
        (ch) => (ch.domainData as any)?.generatorParams?.part?.id === partId,
    );
}

function cutIdsOf(partNode?: CADNode): string[] {
    if (!partNode) return [];
    return (partNode.children || [])
        .map((c) => (c.domainData as any)?.generatorParams?.cut?.id)
        .filter(Boolean) as string[];
}

function makePartChild(groupContainerId: string, part: any, cuts: any[]): CADNode {
    const container = new ContainerModel({
        name: `Part_${part.name || part.id}`,
        width: mmToNm(part.widthMm),
        height: mmToNm(part.heightMm),
        depth: mmToNm(part.depthMm),
    });
    (container as any).role = 'SMARTPART_HANGER';
    (container as any).source = 'smartpart';
    container.generatorParams = {
        type: SMARTPART_HANGER_TYPE,
        partType: 'HANGER',
        hardwareId: 'k500',
        side: 'L',
        widthMm: part.widthMm,
        heightMm: part.heightMm,
        depthMm: part.depthMm,
        part,
        isSmartPart: true,
        groupId: groupContainerId,
        mountOrigin: 'CENTER',
    };
    const node = CADNode.create(NodeType.ASSEMBLY, container.name, container.id);
    node.domainData = container;
    for (const cut of cuts) {
        const cutNode = CADNode.create(NodeType.FEATURE, cut.name, `cut_${container.id}_${cut.id}`);
        cutNode.domainData = new SmartPartCutModel({
            id: cutNode.id,
            name: cut.name,
            cutType: cut.type,
            width: mmToNm(cut.widthMm || 16),
            height: mmToNm(cut.heightMm || 32),
            depth: mmToNm(cut.depthMm || 15),
            generatorParams: { type: 'smartpart_cut', cut, partId: part.id },
        });
        node.addChild(cutNode);
    }
    return node;
}

function makeFixture(initialDef: any, initialPartCuts: any[]) {
    const container = new ContainerModel({
        name: 'Zawieszki_test',
        width: mmToNm(564),
        height: mmToNm(600),
        depth: mmToNm(330),
    });
    (container as any).role = 'SMARTPART_HANGERS';
    (container as any).source = 'smartpart';
    container.generatorParams = {
        type: 'smartpart_hangers_group',
        isSmartPart: true,
        hardwareId: 'k500',
        sourceDefinition: clone(initialDef),
        paramValues: {},
    };
    const node = CADNode.create(NodeType.ASSEMBLY, container.name, container.id);
    node.domainData = container;
    node.addChild(makePartChild(container.id, clone(initialDef.parts[0]), initialPartCuts));
    const doc: any = {
        findNode: (id: string) => (id === container.id ? node : null),
        notifyDocumentChanged: () => {},
    };
    return { container, node, doc };
}

describe('updateHangerSmartPartParams — upsert FEATURE/Parts', () => {
    it('usuwa FEATURE usunięte z definicji + dodaje FEATURE i Part nowego partu', () => {
        const defA = { parts: [P1], cuts: [C1, C2] };
        const { container, node, doc } = makeFixture(defA, [clone(C1), clone(C2)]);
        expect(node.children?.length).toBe(1);
        expect(cutIdsOf(partNodeFor(node, 'p1') as CADNode)).toEqual(['c1', 'c2']);

        // Studio zapisuło pakiet: kieszeń c2 zniknęła, rowek c1 poszerzony, doszedł Part p2 z cięciem c3
        const defB = clone(defA);
        defB.cuts = [clone(C1), clone(C3)];
        defB.cuts[0].widthMm = 22;
        defB.parts = [clone(P1), clone(P2)];

        container.generatorParams.sourceDefinition = defB;
        updateHangerSmartPartParams(doc, container, {});

        const p1 = partNodeFor(node, 'p1') as CADNode;
        const p2 = partNodeFor(node, 'p2') as CADNode;
        expect(cutIdsOf(p1)).toEqual(['c1']);
        expect(cutIdsOf(p2)).toEqual(['c3']);
        // Wymiary istniejącego FEATURE zsynchronizowane z definicją (15→22 mm)
        const cutDd: any = (p1.children || []).find(
            (c) => (c.domainData as any)?.generatorParams?.cut?.id === 'c1',
        )?.domainData;
        expect(cutDd.width).toBe(mmToNm(22));
        expect(cutDd.name).toBe('Rowek');
        // Nowy węzeł Parta p2 z FEATURE c3 o poprawnym generatorParams
        const c3Dd: any = (p2.children || []).find(
            (c) => (c.domainData as any)?.generatorParams?.cut?.id === 'c3',
        )?.domainData;
        expect(c3DdGeneratorOk(c3Dd)).toBe(true);
        expect(p2.domainData?.generatorParams?.part?.id).toBe('p2');
    });

    it('usuwa węzeł Parta usuniętego z definicji (+ jego FEATURE)', () => {
        const defA = { parts: [P1], cuts: [C1] };
        const { container, node, doc } = makeFixture(defA, [clone(C1)]);
        expect(node.children?.length).toBe(1);

        const defC = clone(defA);
        defC.parts = [clone(P2)];
        defC.cuts = [clone(C3)];

        container.generatorParams.sourceDefinition = defC;
        updateHangerSmartPartParams(doc, container, {});

        expect(partNodeFor(node, 'p1')).toBeUndefined();
        expect(partNodeFor(node, 'p2')).toBeDefined();
        // Part p2 adoptowany / utworzony z cięciem c3
        expect(cutIdsOf(partNodeFor(node, 'p2') as CADNode)).toEqual(['c3']);
    });

    it('dodaje FEATURE do istniejącego Parta (nowe cięcie w definicji)', () => {
        const defA = { parts: [P1], cuts: [C1] };
        const { container, node, doc } = makeFixture(defA, [clone(C1)]);
        expect(cutIdsOf(partNodeFor(node, 'p1') as CADNode)).toEqual(['c1']);

        const defD = clone(defA);
        defD.cuts = [clone(C1), clone(C2)];

        container.generatorParams.sourceDefinition = defD;
        updateHangerSmartPartParams(doc, container, {});

        const p1 = partNodeFor(node, 'p1') as CADNode;
        expect(cutIdsOf(p1).sort()).toEqual(['c1', 'c2']);
    });
});

function c3DdGeneratorOk(c3Dd: any): boolean {
    return (
        c3Dd?.role === 'SMARTPART_CUT'
        && c3Dd?.type === 'smartpart_cut'
        && c3Dd?.generatorParams?.type === 'smartpart_cut'
        && c3Dd?.generatorParams?.partId === 'p2'
    );
}
