import { describe, it, expect } from 'vitest';
import { CADNode } from '../../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../../A1_core/cad-node/node-type.js';
import { extractDagPayload } from '../cad-extract.js';
import type { ModuleScope } from '../types.js';

describe('DAG Payload Extraction', () => {
    it('poprawnie ekstrahuje drzewo węzłów i krawędzie hierarchii', () => {
        const root = CADNode.create(NodeType.ROOM, 'Pokój');
        const container = CADNode.create(NodeType.ASSEMBLY, 'Szafka_Dolna');
        const panel = CADNode.create(NodeType.PART, 'Bok_Lewy');

        panel.domainData = {
            name: 'Bok Lewy',
            role: 'SIDE',
            width: 720_000_000, // 720 mm
            height: 560_000_000, // 560 mm
            thickness: 18_000_000, // 18 mm
            features: [
                { id: 'hole_1', name: 'Nawiert Mimośród fi 15', diameter: 15_000_000, depth: 13_000_000, purpose: 'CONNECTOR' },
            ],
        } as any;

        container.addChild(panel);
        root.addChild(container);

        const mockDoc = {
            rootNode: root,
            serialize: () => ({}),
        };

        const scope: ModuleScope = {
            type: 'PROJECT',
            id: 'ALL',
            name: 'Test Projekt',
        };

        const payload = extractDagPayload(scope, mockDoc);

        expect(payload).toBeDefined();
        expect(payload.meta.module).toBe('dag');
        expect(payload.nodes.length).toBeGreaterThanOrEqual(4); // root + container + panel + feature

        const panelNode = payload.nodes.find((n) => n.id === panel.id);
        expect(panelNode).toBeDefined();
        expect(panelNode?.type).toBe('PANEL');
        expect(panelNode?.dimensions).toEqual({
            widthMm: 720,
            heightMm: 560,
            thicknessMm: 18,
        });

        const featNode = payload.nodes.find((n) => n.id === 'hole_1');
        expect(featNode).toBeDefined();
        expect(featNode?.type).toBe('FEATURE');

        // Sprawdź krawędzie
        const hierarchyEdge = payload.edges.find((e) => e.source === container.id && e.target === panel.id);
        expect(hierarchyEdge).toBeDefined();
        expect(hierarchyEdge?.kind).toBe('HIERARCHY');

        const featEdge = payload.edges.find((e) => e.source === panel.id && e.target === 'hole_1');
        expect(featEdge).toBeDefined();
        expect(featEdge?.kind).toBe('FEATURE_PARENT');
    });
});
