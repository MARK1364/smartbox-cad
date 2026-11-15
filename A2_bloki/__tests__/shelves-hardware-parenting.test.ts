import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { applyPlanToContainer } from '../../A3_smartframe/smartframe-adapter.js';
import { buildShelvesPlan } from '../01_module-plans.js';

describe('Shelves Hardware Hierarchy and Parenting (SolidWorks-like CAD tree)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Shelves Hierarchy Test' });
        ContextManager.instance.document = doc;
    });

    it('podpórki półek są tworzone jako dzieci danej półki (CADNode hierarchy)', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus_Szafki' });
        const cabinetNode = doc.findNode(cabinet.id)!;

        const sbContainer = new ContainerModel({
            name: 'blok_shelves_strefa',
            width: mmToNm(564),
            height: mmToNm(720),
            depth: mmToNm(500)
        });
        sbContainer.generatorParams = {
            is_blok: true,
            boxType: 'SHELVES',
            liczba_polek: 2,
            grubosc_polki_mm: 18,
            srednica_podporki_mm: 5
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        doc.addNode(cabinetNode.id, sbNode);

        const plan = buildShelvesPlan(
            sbContainer.generatorParams as any,
            { width_mm: 564, height_mm: 720, depth_mm: 500 }
        );

        applyPlanToContainer(sbContainer, plan);

        // Powinny być 2 półki (PART) pod sbNode
        const shelfNodes = sbNode.children.filter(c => c.nodeType === NodeType.PART && c.name.startsWith('Polka_'));
        expect(shelfNodes.length).toBe(2);

        // Każda półka MUSI mieć swoje 4 podpórki (HARDWARE) jako bezpośrednie dzieci
        for (const shelfNode of shelfNodes) {
            const pinChildren = shelfNode.children.filter(c => c.nodeType === NodeType.HARDWARE);
            expect(pinChildren.length).toBe(4);
            for (const pin of pinChildren) {
                expect(pin.domainData).toBeDefined();
                expect((pin.domainData as any).hardwareType).toBe('SHELF_PIN');
                expect(pin.parent?.id).toBe(shelfNode.id);
            }
        }

        // Pod sbNode nie powinno być bezpośrednich luźnych podpórek
        const directPinsUnderContainer = sbNode.children.filter(c => c.nodeType === NodeType.HARDWARE);
        expect(directPinsUnderContainer.length).toBe(0);
    });

    it('parametr srednica_podporki_mm przenosi się do parametrów podpórek i otworów', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus_Szafki' });
        const cabinetNode = doc.findNode(cabinet.id)!;

        const sbContainer = new ContainerModel({
            name: 'blok_shelves_strefa_fi3',
            width: mmToNm(564),
            height: mmToNm(720),
            depth: mmToNm(500)
        });
        sbContainer.generatorParams = {
            is_blok: true,
            boxType: 'SHELVES',
            liczba_polek: 1,
            grubosc_polki_mm: 18,
            srednica_podporki_mm: 3
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        doc.addNode(cabinetNode.id, sbNode);

        const plan = buildShelvesPlan(
            sbContainer.generatorParams as any,
            { width_mm: 564, height_mm: 720, depth_mm: 500 }
        );

        applyPlanToContainer(sbContainer, plan);

        const shelfNode = sbNode.children.find(c => c.nodeType === NodeType.PART && c.name.startsWith('Polka_'))!;
        expect(shelfNode).toBeDefined();

        const pins = shelfNode.children.filter(c => c.nodeType === NodeType.HARDWARE);
        expect(pins.length).toBe(4);
        for (const pin of pins) {
            expect((pin.domainData as any).params?.diameter_mm).toBe(3);
        }
    });

    it('obsługuje klucze z WASM (SHELF_1 uppercase oraz brak shelfKey) i healTreeHierarchy', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus_Szafki' });
        const cabinetNode = doc.findNode(cabinet.id)!;

        const sbContainer = new ContainerModel({
            name: 'blok_polki',
            width: mmToNm(564),
            height: mmToNm(720),
            depth: mmToNm(500)
        });
        sbContainer.generatorParams = {
            is_blok: true,
            boxType: 'SHELVES',
            liczba_polek: 3,
            grubosc_polki_mm: 18
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        doc.addNode(cabinetNode.id, sbNode);

        // Symulacja wyjścia WASM (SHELF_1 uppercase + tylko shelfIndex w params)
        const wasmLikePlan: any = {
            parts: [1, 2, 3].map(i => ({
                name: `Polka_${i}`,
                key: `SHELF_${i}`,
                role: 'SHELF_PANEL',
                nodeType: 'PART',
                material: 'W1100_ST9_18',
                dim: { x: 562, y: 480, z: 18 },
                loc: { x: 0, y: 0, z: -200 + i * 100 },
                features: []
            })),
            hardware: [1, 2, 3].flatMap(i => ['LF', 'LB', 'RF', 'RB'].map(s => ({
                id: `shelf_${i}_pin_${s}`,
                name: `Podpórka półki ${i} (${s})`,
                hardwareType: 'SHELF_PIN',
                hardwareId: 'PODPORKA_FI5',
                loc: { x: -281, y: 200, z: -200 + i * 100 },
                params: { shelfIndex: i, pinType: 'PODPORKA_FI5' }
            })))
        };

        applyPlanToContainer(sbContainer, wasmLikePlan);

        const shelfNodes = sbNode.children.filter(c => c.nodeType === NodeType.PART);
        expect(shelfNodes.length).toBe(3);
        for (const shelfNode of shelfNodes) {
            expect(shelfNode.children.filter(c => c.nodeType === NodeType.HARDWARE).length).toBe(4);
        }
        expect(sbNode.children.filter(c => c.nodeType === NodeType.HARDWARE).length).toBe(0);

        // Sprawdzenie healTreeHierarchy gdy podpórki były wcześniej na poziomie sbNode
        const pinToMove = shelfNodes[0].children[0];
        sbNode.addChild(pinToMove);
        expect(sbNode.children.filter(c => c.nodeType === NodeType.HARDWARE).length).toBe(1);

        doc.healTreeHierarchy();
        expect(sbNode.children.filter(c => c.nodeType === NodeType.HARDWARE).length).toBe(0);
        expect(shelfNodes[0].children.filter(c => c.nodeType === NodeType.HARDWARE).length).toBe(4);
    });
});
