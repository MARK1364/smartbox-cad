import { describe, it, expect } from 'vitest';
import {
    buildPanelEdgeBatch,
    EDGE_BATCH_WIDTH,
    EDGE_BATCH_WIDTH_SELECTED,
    hasGreasedLineSupport,
    setPanelEdgeBatchStyle,
    setPickOnlyEdgeRevealed,
} from '../batched-edges.js';
import { applyPanelViewSolverVisibility } from '../../S2_solver/solver-visibility.js';

declare const BABYLON: any;

function setupMockBabylon(withGreasedLine = true) {
    const createdGreased: any[] = [];
    (globalThis as any).BABYLON = {
        Vector3: class {
            x: number; y: number; z: number;
            constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        },
        Color3: class {
            r: number; g: number; b: number;
            constructor(r = 0, g = 0, b = 0) { this.r = r; this.g = g; this.b = b; }
        },
        GreasedLineMeshColorMode: { COLOR_MODE_SET: 0 },
        ...(withGreasedLine ? {
            CreateGreasedLine: (name: string, options: any, matOptions: any, scene: any) => {
                const mesh: any = {
                    name,
                    options,
                    matOptions,
                    isPickable: true,
                    isVisible: true,
                    visibility: 1,
                    metadata: {},
                    material: { zOffset: 0, backFaceCulling: true },
                    greasedLineMaterial: {
                        color: matOptions.color,
                        width: matOptions.width,
                    },
                    isEnabled: () => true,
                    setEnabled() { /* noop */ },
                    isDisposed: () => false,
                    dispose() { /* noop */ },
                };
                createdGreased.push(mesh);
                scene?.meshes?.push(mesh);
                return mesh;
            },
        } : {}),
    };
    return { createdGreased };
}

describe('batched-edges (zbatchowany obrys B-rep)', () => {
    it('poprawnie wykrywa wsparcie GreasedLine', () => {
        setupMockBabylon(true);
        expect(hasGreasedLineSupport()).toBe(true);

        setupMockBabylon(false);
        expect(hasGreasedLineSupport()).toBe(false);
    });

    it('buildPanelEdgeBatch tworzy pojedynczy nieklikalny GreasedLine ze wszystkich polilinii obrysu', () => {
        const { createdGreased } = setupMockBabylon(true);
        const scene = { meshes: [] as any[] };
        const color = new BABYLON.Color3(0.08, 0.08, 0.08);

        const batch = buildPanelEdgeBatch(
            scene,
            'edge_batch_p1',
            [
                [[0, 0, 0], [100, 0, 0]],
                [[100, 0, 0], [100, 50, 0]],
            ],
            color,
            EDGE_BATCH_WIDTH,
        );

        expect(batch).not.toBeNull();
        expect(createdGreased).toHaveLength(1);
        expect(batch.isPickable).toBe(false);
        expect(batch.metadata.type).toBe('edge-batch');
        expect(batch.matOptions.sizeAttenuation).toBe(true);
        expect(batch.matOptions.width).toBe(EDGE_BATCH_WIDTH);
        expect(batch.options.points).toHaveLength(2);

        const selColor = new BABYLON.Color3(0.2, 1.0, 0.4);
        setPanelEdgeBatchStyle(batch, selColor, EDGE_BATCH_WIDTH_SELECTED, -2.5);
        expect(batch.greasedLineMaterial.color).toBe(selColor);
        expect(batch.greasedLineMaterial.width).toBe(EDGE_BATCH_WIDTH_SELECTED);
        expect(batch.material.zOffset).toBe(-2.5);
    });

    it('setPickOnlyEdgeRevealed odsłania cel pickingu przy zaznaczeniu i chowa po odznaczeniu', () => {
        setupMockBabylon(true);
        const pickOnlyEdge: any = {
            visibility: 0,
            metadata: { type: 'edge', pickOnly: true, edgeKey: 'top_front' },
            isDisposed: () => false,
        };
        const legacyEdge: any = {
            visibility: 1,
            metadata: { type: 'edge', edgeKey: 'top_front' },
            isDisposed: () => false,
        };

        setPickOnlyEdgeRevealed(pickOnlyEdge, true);
        expect(pickOnlyEdge.visibility).toBe(1);
        setPickOnlyEdgeRevealed(pickOnlyEdge, false);
        expect(pickOnlyEdge.visibility).toBe(0);

        // Dla zwykłej krawędzi (bez pickOnly) nie zmienia widoczności
        setPickOnlyEdgeRevealed(legacyEdge, false);
        expect(legacyEdge.visibility).toBe(1);
    });

    it('solver-visibility zachowuje ukrycie celów pickOnly i steruje batchem', () => {
        setupMockBabylon(true);
        const scene = { meshes: [] as any[] };
        const batch = buildPanelEdgeBatch(
            scene,
            'edge_batch_p1',
            [[[0, 0, 0], [100, 0, 0]]],
            new BABYLON.Color3(0.08, 0.08, 0.08),
            EDGE_BATCH_WIDTH,
        );
        const pickEdge: any = {
            visibility: 0,
            isVisible: true,
            isPickable: true,
            metadata: { type: 'edge', pickOnly: true, edgeKey: 'e0', brepPoints: [[0, 0, 0], [100, 0, 0]] },
            setEnabled() { /* noop */ },
            isEnabled: () => true,
            isDisposed: () => false,
        };
        scene.meshes.push(pickEdge);

        // Solver visibility nie może odsłonić celów pickOnly (visibility musi pozostać 0)
        const fakeView = {
            root: { setEnabled() { /* noop */ } },
            faceMeshes: {},
            _edgeMeshes: [pickEdge],
            _edgeBatchMesh: batch,
            _vertexSpheres: [],
            _featureMarkers: [],
        };
        applyPanelViewSolverVisibility(
            fakeView,
            { visible: true },
            { smartFrameOnly: false, faceVis: 0.4, wireframe: false },
        );
        expect(pickEdge.visibility).toBe(0);
        expect(pickEdge.isPickable).toBe(true);
        expect(batch.visibility).toBe(0.4);
        expect(batch.isPickable).toBe(false);
    });
});
