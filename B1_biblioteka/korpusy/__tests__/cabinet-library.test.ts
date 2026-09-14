import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../../A1_core/project-document.js';
import { ContainerModel } from '../../../A1_core/container-model.js';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../../A1_core/cad-node/node-type.js';
import { mmToNm } from '../../../A1_core/cad-math/units.js';
import { serializeActiveCabinet, sanitizeSmartBoxParams } from '../cabinet-serializer.js';
import { instantiateCabinetTemplate } from '../cabinet-instantiator.js';
import { cabinetLibraryStore, DEFAULT_TEMPLATES } from '../cabinet-library-store.js';
import type { CabinetTemplate } from '../types.js';

describe('B1_biblioteka — Cabinet Library System', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Test Project' });
    });

    it('sanitizes smartbox parameters properly', () => {
        const raw = {
            shelfCount: 3,
            thickness: 18,
            drawerHeights: [150, 200, 300],
            boundary: { dummy: true },
            detectedBay: { fake: 'data' },
            active: true
        };
        const safe = sanitizeSmartBoxParams(raw);
        expect(safe.shelfCount).toBe(3);
        expect(safe.thickness).toBe(18);
        expect(safe.drawerHeights).toEqual([150, 200, 300]);
        expect(safe.active).toBe(true);
        expect(safe.boundary).toBeUndefined();
        expect(safe.detectedBay).toBeUndefined();
    });

    it('serializes an active korpus and smartbox into CabinetTemplate', () => {
        // 1. Stwórz korpus
        const korpusContainer = new ContainerModel({
            name: 'Korpus (SmartFrame) 1',
            width: mmToNm(600),
            height: mmToNm(820),
            depth: mmToNm(560)
        });
        korpusContainer.generatorParams = {
            type: 'korpus3_2',
            zoneCount: 1,
            bottomHeight: 820,
            middleHeight: 0,
            backOffset: 3
        };

        const korpusNode = CADNode.create(NodeType.ASSEMBLY, korpusContainer.name, korpusContainer.id);
        korpusNode.domainData = korpusContainer;
        doc.addNode(doc.rootNode.id, korpusNode);

        // 2. Dodaj SmartBox półki
        const sbContainer = new ContainerModel({
            name: 'Polki_SB',
            width: mmToNm(564),
            height: mmToNm(784),
            depth: mmToNm(540)
        });
        sbContainer.generatorParams = {
            type: 'smartbox_shelves',
            boxType: 'SHELVES',
            shelfCount: 2,
            shelfOffsetFrontMm: 10
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        doc.addNode(korpusNode.id, sbNode);

        doc.setActiveEntity(korpusContainer);

        // 3. Serializacja
        const template = serializeActiveCabinet(doc, {
            name: 'Moja Szafka Dolna',
            category: 'dolne',
            description: 'Testowy opis'
        });

        expect(template).not.toBeNull();
        expect(template?.name).toBe('Moja Szafka Dolna');
        expect(template?.category).toBe('dolne');
        expect(template?.units).toBe('mm');
        expect(template?.dimensions.width).toBe(600);
        expect(template?.dimensions.height).toBe(820);
        expect(template?.dimensions.depth).toBe(560);
        expect(template?.frameParams.zoneCount).toBe(1);
        expect(template?.submodules.length).toBe(1);
        expect(template?.submodules[0].boxType).toBe('SHELVES');
        expect(template?.submodules[0].params.shelfCount).toBe(2);
    });

    it('instantiates a cabinet from CabinetTemplate in ProjectDocument', () => {
        const template: CabinetTemplate = {
            id: 'test_instantiate_1',
            name: 'Instantiated Cabinet',
            category: 'dolne',
            units: 'mm',
            dimensions: {
                width: 800,
                height: 820,
                depth: 560
            },
            frameParams: {
                zoneCount: 1,
                bottomHeight: 820,
                middleHeight: 0,
                backOffset: 3
            },
            submodules: [
                {
                    type: 'smartbox_shelves',
                    boxType: 'SHELVES',
                    label: 'Polki_SB',
                    zoneIndex: 0,
                    params: {
                        shelfCount: 1
                    }
                }
            ]
        };

        const createdNode = instantiateCabinetTemplate({
            template,
            position: { x: 100, y: 0, z: 0 }
        }, doc);

        expect(createdNode).not.toBeNull();
        expect(createdNode?.domainData).toBeInstanceOf(ContainerModel);
        const container = createdNode?.domainData as ContainerModel;
        expect(container.width).toBe(mmToNm(800));
        expect(container.height).toBe(mmToNm(820));
        expect(container.depth).toBe(mmToNm(560));

        // Sprawdzenie czy dodano podmoduł
        const sbChild = createdNode?.children.find((c) => c.name?.includes('Polki') || c.name?.includes('smartbox'));
        expect(sbChild).toBeDefined();
    });

    it('manages cabinetLibraryStore CRUD and JSON import/export', () => {
        const customTpl: CabinetTemplate = {
            id: 'custom_test_tpl',
            name: 'Własny Regał 900',
            category: 'inne',
            units: 'mm',
            dimensions: { width: 900, height: 2000, depth: 400 },
            frameParams: { zoneCount: 1 },
            submodules: []
        };

        cabinetLibraryStore.save(customTpl);
        expect(cabinetLibraryStore.getById('custom_test_tpl')?.name).toBe('Własny Regał 900');

        const jsonStr = JSON.stringify([customTpl]);
        const importRes = cabinetLibraryStore.importFromJson(jsonStr);
        expect(importRes.success).toBe(true);
        expect(importRes.count).toBe(1);

        const removed = cabinetLibraryStore.remove('custom_test_tpl');
        expect(removed).toBe(true);
        expect(cabinetLibraryStore.getById('custom_test_tpl')).toBeUndefined();
    });
});
