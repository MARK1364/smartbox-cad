import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    findEdgeSegmentsNearPointer,
    findVerticesNearPointer,
    isPointOccluded,
    occlusionStats,
    OCCLUSION_EPS_MM,
} from '../pmi-edge-pick.js';

function stubBabylon() {
    class V3 {
        x: number; y: number; z: number;
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        static TransformCoordinates(v: any) { return new V3(v.x, v.y, v.z); }
        static Project(_p: any) { return { x: 400, y: 300, z: 0.5 }; }
    }
    (globalThis as any).BABYLON = {
        Matrix: { Identity: () => ({}) },
        Vector3: V3,
    };
}

function vertexMesh(world = { x: 0, y: 0, z: 100 }) {
    return {
        metadata: { type: 'vertex', cornerIndex: 0 },
        isEnabled: () => true,
        isDisposed: () => false,
        getAbsolutePosition: () => ({ ...world }),
    };
}

function edgeMesh() {
    return {
        metadata: { type: 'edge', brepPoints: [[0, 0, 100], [10, 0, 100]] },
        isEnabled: () => true,
        isDisposed: () => false,
        getWorldMatrix: () => ({}),
    };
}

/** Scena: promień trafia w ścianę `wallDist` przed punktem (100 mm od kamery). */
function mockScene(wallDist: number | null, captured: { pred?: any } = {}, meshes?: any[]) {
    return {
        activeCamera: { viewport: { toGlobal: (_w: number, _h: number) => ({}) } },
        getEngine: () => ({ getRenderWidth: () => 800, getRenderHeight: () => 600 }),
        getTransformMatrix: () => ({}),
        meshes: meshes ?? [vertexMesh(), edgeMesh()],
        createPickingRay: () => ({ origin: { x: 0, y: 0, z: 0 } }),
        pickWithRay: vi.fn((_ray: any, pred: any) => {
            captured.pred = pred;
            if (wallDist === null) return { hit: false };
            return { hit: true, distance: wallDist };
        }),
    };
}

describe('okluzja w pmi-edge-pick (naroże za ścianą)', () => {
    beforeEach(() => {
        stubBabylon();
        occlusionStats.tests = 0;
        occlusionStats.filtered = 0;
        delete (globalThis as any).__pmiOcclusionStats;
    });

    it('narożnik za ścianą (50mm przed punktem 100mm) jest odrzucany', () => {
        const scene = mockScene(50);
        expect(findVerticesNearPointer(scene, 400, 300, 14)).toHaveLength(0);
    });

    it('narożnik na własnej ściance (trafienie w granicy eps) zostaje', () => {
        const scene = mockScene(100 - OCCLUSION_EPS_MM + 0.5);
        const found = findVerticesNearPointer(scene, 400, 300, 14);
        expect(found).toHaveLength(1);
    });

    it('brak trafienia promienia = widoczny (jak wcześniej)', () => {
        const scene = mockScene(null);
        expect(findVerticesNearPointer(scene, 400, 300, 14)).toHaveLength(1);
    });

    it('scena bez pickWithRay = fail-open (jak wcześniej)', () => {
        const scene: any = mockScene(null);
        delete scene.pickWithRay;
        delete scene.createPickingRay;
        expect(findVerticesNearPointer(scene, 400, 300, 14)).toHaveLength(1);
    });

    it('krawędź za ścianą też jest odrzucana', () => {
        const scene = mockScene(50);
        expect(findEdgeSegmentsNearPointer(scene, 400, 300, 22)).toHaveLength(0);
    });

    it('krawędź widoczna zostaje', () => {
        const scene = mockScene(null);
        expect(findEdgeSegmentsNearPointer(scene, 400, 300, 22).length).toBeGreaterThan(0);
    });

    it('isPointOccluded: ściana 18mm (grubość thinner) przed punktem = zasłonięty', () => {
        const scene = mockScene(82);
        expect(isPointOccluded(scene, { x: 0, y: 0, z: 100 }, 400, 300, null)).toBe(true);
    });

    it('predykat okluzji nie liczy overlayów i helperów linii', () => {
        const captured: { pred?: any } = {};
        const vMesh = vertexMesh();
        const scene = mockScene(null, captured, [vMesh, edgeMesh()]);
        findVerticesNearPointer(scene, 400, 300, 14);
        const pred = captured.pred;
        expect(typeof pred).toBe('function');
        expect(pred({ metadata: { isPmiOverlay: true } })).toBe(false);
        expect(pred({ metadata: { type: 'edge' } })).toBe(false);
        expect(pred({ metadata: { type: 'vertex' } })).toBe(false);
        expect(pred({ metadata: null })).toBe(false);
        expect(pred({ metadata: { faceName: 'front' }, isEnabled: () => true })).toBe(true);
        // Własny mesh kandydata (spięty w domknięciu) nie zasłania sam siebie.
        expect(pred(vMesh)).toBe(false);
        // Duchy (kontenery alpha 0, hitboxy) i niewidzialne nie zasłaniają.
        expect(pred({ metadata: { faceName: 'ghost' }, isEnabled: () => true, isPickable: false })).toBe(false);
        expect(pred({ metadata: { faceName: 'hidden' }, isEnabled: () => true, visibility: 0 })).toBe(false);
        expect(pred({ metadata: { faceName: 'off' }, isEnabled: () => true, isVisible: false })).toBe(false);
    });

    it('licznik diagnostyczny rośnie przy testach i filtrowaniu', () => {
        const occluded = mockScene(50);
        findVerticesNearPointer(occluded, 400, 300, 14);
        expect(occlusionStats.tests).toBeGreaterThan(0);
        expect(occlusionStats.filtered).toBeGreaterThan(0);
        expect((globalThis as any).__pmiOcclusionStats).toBe(occlusionStats);

        occlusionStats.tests = 0;
        occlusionStats.filtered = 0;
        const visible = mockScene(null);
        findVerticesNearPointer(visible, 400, 300, 14);
        expect(occlusionStats.tests).toBeGreaterThan(0);
        expect(occlusionStats.filtered).toBe(0);
    });
});
