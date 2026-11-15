import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../../A1_core/cad-node/node-type.js';
import { syncHandleMeshesFromDocument, purgeOrphanHandleMeshes } from '../handle-mesh.js';
import { ContextManager } from '../../../A1_core/context-manager.js';

describe('Handle 3D Sync & Lifecycle', () => {
    let mockScene: any;
    let mockDisposedMeshes: string[];

    beforeEach(() => {
        mockDisposedMeshes = [];
        mockScene = {
            meshes: [],
            transformNodes: [],
            getMeshByName: vi.fn(),
            getTransformNodeByName: vi.fn(),
        };

        // ContextManager mock
        (ContextManager as any)._instance = {
            viewport: {
                scene: mockScene,
                requestRender: vi.fn(),
            },
            panelViews: new Map(),
            document: null,
        };
    });

    it('syncHandleMeshesFromDocument synchronizuje uchwyty z drzewa dokumentu', () => {
        const root = CADNode.create(NodeType.ROOM, 'Scene', 'root_scene');
        const panelNode = CADNode.create(NodeType.PART, 'Front_1', 'front_1');
        panelNode.domainData = {
            id: 'front_1',
            name: 'Front_1',
            width: 600_000_000,
            height: 720_000_000,
            thickness: 18_000_000,
        };

        const handleContainer = CADNode.create(NodeType.ASSEMBLY, 'Uchwyty', 'handle_cnt_1');
        handleContainer.domainData = {
            id: 'handle_cnt_1',
            name: 'Uchwyty',
            role: 'SMARTPART_HANDLE',
            generatorParams: {
                type: 'smartpart_handle',
                partType: 'HANDLE',
                targetPanelId: 'front_1',
                totalLengthMm: 160,
                holeDistanceMm: 128,
                uMm: 100,
                vMm: 150,
                depthMm: 28,
                thicknessMm: 12,
            },
        };

        panelNode.addChild(handleContainer);
        root.addChild(panelNode);

        const doc = {
            rootNode: root,
            findNode: vi.fn((id: string) => {
                if (id === 'front_1') return panelNode;
                if (id === 'handle_cnt_1') return handleContainer;
                return null;
            }),
        };

        expect(() => syncHandleMeshesFromDocument(doc)).not.toThrow();
    });

    it('purgeOrphanHandleMeshes usuwa osierocone siatki uchwytów, których brak w dokumencie', () => {
        const orphanMesh = {
            name: 'handle_mesh_orphan_1',
            metadata: { type: 'smartpart_handle', nodeId: 'orphan_1' },
            dispose: vi.fn(() => {
                mockDisposedMeshes.push('orphan_1');
            }),
        };
        const liveMesh = {
            name: 'handle_mesh_live_1',
            metadata: { type: 'smartpart_handle', nodeId: 'live_1' },
            dispose: vi.fn(),
        };

        mockScene.meshes = [orphanMesh, liveMesh];

        const liveIds = new Set(['live_1']);
        purgeOrphanHandleMeshes({ rootNode: {} }, liveIds);

        expect(orphanMesh.dispose).toHaveBeenCalledTimes(1);
        expect(liveMesh.dispose).not.toHaveBeenCalled();
        expect(mockDisposedMeshes).toContain('orphan_1');
    });
});
