import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../../../A1_core/project-document.js';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../../A1_core/cad-node/node-type.js';
import { findOwningContainer } from '../../../A1_core/panel-like.js';
import { ContainerModel } from '../../../A1_core/container-model.js';

describe('SceneTree & 3D Active Entity Synchronization', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
    });

    it('identifies owning container for child panels to enable auto-uncollapse and highlighting', () => {
        const containerModel = new ContainerModel({
            name: 'Szafka_Kuchenna',
            width: 800_000_000,
            height: 720_000_000,
            depth: 560_000_000,
        });
        containerModel.id = 'c_korpus_sync_1';

        const containerNode = CADNode.create(NodeType.ASSEMBLY, containerModel.name, containerModel.id);
        containerNode.domainData = containerModel;
        doc.addNode(doc.rootNode.id, containerNode);

        const leftPanelNode = CADNode.create(NodeType.PART, 'Bok_L', 'p_bok_l_1');
        leftPanelNode.domainData = {
            id: 'p_bok_l_1',
            name: 'Bok_L',
            type: 'panel',
        };
        doc.addNode(containerNode.id, leftPanelNode);

        // 1. Setting activeEntity to container
        doc.setActiveEntity(containerModel);
        expect(doc.activeEntity?.id).toBe('c_korpus_sync_1');

        // 2. Setting activeEntity to child panel
        doc.setActiveEntity(leftPanelNode.domainData as any);
        expect(doc.activeEntity?.id).toBe('p_bok_l_1');

        // 3. findOwningContainer resolves parent container for child panel
        const owner = findOwningContainer(doc, 'p_bok_l_1');
        expect(owner).toBeTruthy();
        expect(owner.id).toBe('c_korpus_sync_1');
    });

    it('safely handles rootNode boundary without throwing or looping', () => {
        const standaloneNode = CADNode.create(NodeType.PART, 'Formatka_Wolna', 'p_standalone_1');
        standaloneNode.domainData = {
            id: 'p_standalone_1',
            name: 'Formatka_Wolna',
            type: 'panel',
        };
        doc.addNode(doc.rootNode.id, standaloneNode);

        const owner = findOwningContainer(doc, 'p_standalone_1');
        expect(owner).toBeNull();
    });

    it('exports editCircle icon in TREE_ICONS for quick edit action', async () => {
        const { TREE_ICONS } = await import('../../SceneTree.js');
        expect(TREE_ICONS.editCircle).toBeDefined();
    });
});
