import { describe, it, expect, beforeEach } from 'vitest';
import { DimensionTool } from '../pmi-tool.js';
import { v3 } from '../dimension-solver.js';
import { ContextManager } from '../../A1_core/context-manager.js';

const BabylonVector3 = class {
    x: number; y: number; z: number;
    constructor(x: number, y: number, z: number) {
        this.x = x; this.y = y; this.z = z;
    }
    static TransformCoordinates(v: { x: number; y: number; z: number }, matrix: { _m: number[] }) {
        const m = matrix._m;
        const x = v.x * m[0] + v.y * m[4] + v.z * m[8] + m[12];
        const y = v.x * m[1] + v.y * m[5] + v.z * m[9] + m[13];
        const z = v.x * m[2] + v.y * m[6] + v.z * m[10] + m[14];
        return new BabylonVector3(x, y, z);
    }
};

function mockMatrix(values: number[]) {
    return {
        _m: values,
        m: values,
        clone() { return mockMatrix([...values]); },
        invert() {
            return mockMatrix([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1,
            ]);
        },
    };
}

function mockSceneWithNearbyVertex() {
    const identity = mockMatrix([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ]);

    const faceMesh = {
        parent: null as any,
        metadata: { faceName: 'left', panelModel: { id: 'panel_1' } },
        getWorldMatrix: () => identity,
        getBoundingInfo: () => ({
            boundingBox: {
                minimum: { x: -300, y: -360, z: -9 },
                maximum: { x: 300, y: 360, z: 9 },
            },
        }),
    };

    const vertexMesh = {
        parent: null as any,
        metadata: { type: 'vertex', cornerIndex: 0, panelModel: { id: 'panel_1' } },
        position: { x: 10, y: 20, z: 30 },
        getAbsolutePosition: () => ({ x: 10, y: 20, z: 30 }),
    };

    const root = {
        getWorldMatrix: () => identity,
        getChildMeshes: () => [faceMesh, vertexMesh],
    };
    faceMesh.parent = root;
    vertexMesh.parent = root;

    return { scene: { meshes: [faceMesh, vertexMesh] }, faceMesh };
}

describe('DimensionTool — klik w płaszczyznę zostaje płaszczyzną', () => {
    beforeEach(() => {
        (globalThis as any).BABYLON = { Vector3: BabylonVector3 };
    });

    it('nie podmienia kotwicy FACE na VERTEX, gdy klik jest blisko narożnika', () => {
        const { scene, faceMesh } = mockSceneWithNearbyVertex();
        const nodeId = 'panel_1';
        const panelView = {
            model: { id: nodeId },
            root: { getChildMeshes: () => scene.meshes },
            getBrepFacePositions: (name: string) => name === 'left' ? new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) : null,
            getBrepFaceIndices: () => new Uint32Array([0, 1, 2]),
            getBrepVertexLocal: () => [v3(10, 20, 30)],
            getBrepEdgePoints: () => [],
            getBrepFaceOriginLocal: () => v3(0, 0, 0),
            getBrepFaceNormalLocal: () => v3(0, 0, 1),
        };
        (faceMesh.metadata as any).planeNormalLocal = { x: 0, y: 0, z: 1 };
        faceMesh.metadata.panelModel.id = nodeId;
        ContextManager.instance.panelViews = new Map([[nodeId, panelView]]);
        const tool = new DimensionTool({ viewport: { scene } } as any, {} as any, {} as any);

        const pick = (tool as any).createPickPointFromHit({
            pickedMesh: faceMesh,
            pickedPoint: { x: 12, y: 22, z: 32 },
            getNormal: () => ({ x: 0, y: 0, z: 1 }),
        });

        expect(pick).not.toBeNull();
        expect(pick.anchor.kind).toBe('FACE');
        expect(pick.anchor.subKey).toBe('left');
        expect(pick.worldPos).toEqual(v3(12, 22, 0));
        expect(pick.faceNormalWorld).toEqual(v3(0, 0, 1));
    });

    it('brak danych B-rep oznacza brak picka, bez przejścia do normalnej siatki', () => {
        const { scene, faceMesh } = mockSceneWithNearbyVertex();
        const nodeId = 'panel_without_brep';
        faceMesh.metadata.panelModel.id = nodeId;
        ContextManager.instance.panelViews = new Map([[nodeId, {
            model: { id: nodeId },
            root: { getChildMeshes: () => scene.meshes },
            getBrepFacePositions: () => null,
            getBrepFaceIndices: () => new Uint32Array(0),
            getBrepVertexLocal: () => [],
            getBrepEdgePoints: () => [],
        }]]);
        const tool = new DimensionTool({ viewport: { scene } } as any, {} as any, {} as any);
        const pick = (tool as any).createPickPointFromHit({
            pickedMesh: faceMesh,
            pickedPoint: { x: 12, y: 22, z: 32 },
            getNormal: () => ({ x: 0, y: 0, z: 1 }),
        });
        expect(pick).toBeNull();
    });

});
