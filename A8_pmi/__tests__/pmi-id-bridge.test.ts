import { describe, it, expect, beforeEach } from 'vitest';
import { buildAnchorRef, meshLocalToRootLocal, resolveAnchorWorld } from '../pmi-id-bridge.js';
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

function mockPanelScene(opts: {
    nodeId: string;
    width?: number;
    height?: number;
    depth?: number;
}) {
    const w = opts.width ?? 600;
    const h = opts.height ?? 720;
    const t = opts.depth ?? 18;
    const hw = w / 2;
    const hh = h / 2;
    const ht = t / 2;

    const v000 = [-hw, -hh, -ht];
    const v0H0 = [-hw, hh, -ht];

    const identity = mockMatrix([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ]);

    const root = {
        getWorldMatrix: () => identity,
        getChildMeshes: () => [faceMesh, edgeMesh, vertexMesh0, vertexMesh4],
    };

    const faceMesh = {
        parent: root,
        metadata: { faceName: 'left', panelModel: { id: opts.nodeId } },
        getWorldMatrix: () => mockMatrix([
            0, 0, -1, 0,
            0, 1, 0, 0,
            1, 0, 0, 0,
            -hw, 0, 0, 1,
        ]),
        getBoundingInfo: () => ({
            boundingBox: {
                minimum: { x: -ht, y: -hh, z: -ht },
                maximum: { x: ht, y: hh, z: ht },
            },
        }),
    };

    const edgeMesh = {
        parent: root,
        metadata: {
            type: 'edge',
            edgeKey: 'tyl_lewo',
            panelModel: { id: opts.nodeId },
            brepPoints: [v000, v0H0],
        },
        position: { x: 0, y: 0, z: 0 },
    };

    const vertexMesh0 = {
        parent: root,
        metadata: { type: 'vertex', cornerIndex: 0, panelModel: { id: opts.nodeId } },
        position: { x: v000[0], y: v000[1], z: v000[2] },
    };

    const vertexMesh4 = {
        parent: root,
        metadata: { type: 'vertex', cornerIndex: 4, panelModel: { id: opts.nodeId } },
        position: { x: v0H0[0], y: v0H0[1], z: v0H0[2] },
    };

    const panelViews = new Map([
        [opts.nodeId, { model: { id: opts.nodeId }, root }],
    ]);

    return {
        scene: { meshes: [root, faceMesh, edgeMesh, vertexMesh0, vertexMesh4] },
        panelViews,
        root,
        faceMesh,
        edgeMesh,
        v000,
        v0H0,
        hw,
        hh,
        ht,
    };
}

describe('pmi-id-bridge anchor resolution', () => {
    beforeEach(() => {
        (globalThis as any).BABYLON = { Vector3: BabylonVector3 };
    });

    it('przelicza punkt ściany z układu lokalnego siatki na układ korzenia formatki', () => {
        const data = mockPanelScene({ nodeId: 'panel_1' });
        ContextManager.instance.panelViews = data.panelViews;

        const rootLocal = meshLocalToRootLocal(data.faceMesh, v3(-9, -360, 0));

        expect(rootLocal.x).toBeCloseTo(-300, 0);
        expect(rootLocal.y).toBeCloseTo(-360, 0);
    });

    it('EDGE kotwica odczytuje zaktualizowane brepPoints po zmianie wymiarów', () => {
        const data = mockPanelScene({ nodeId: 'panel_1', height: 720 });
        ContextManager.instance.panelViews = data.panelViews;

        const anchor = buildAnchorRef(
            data.edgeMesh,
            v3(-300, -360, -9),
            v3(-300, -360, -9),
            0,
        );

        const worldBefore = resolveAnchorWorld(data.scene, anchor);
        expect(worldBefore?.y).toBeCloseTo(-360, 0);

        const newHh = 400;
        const newV0H0 = [-300, newHh, -9];
        data.edgeMesh.metadata.brepPoints = [[-300, -newHh, -9], newV0H0];

        const worldAfter = resolveAnchorWorld(data.scene, anchor);
        expect(worldAfter?.y).toBeCloseTo(-newHh, 0);
    });

    it('FACE kotwica podąża za przesuniętą ścianą po zmianie głębokości', () => {
        const data = mockPanelScene({ nodeId: 'panel_1', depth: 18 });
        ContextManager.instance.panelViews = data.panelViews;

        const anchor = buildAnchorRef(data.faceMesh, v3(-300, 0, 0), null);

        const worldBefore = resolveAnchorWorld(data.scene, anchor);
        expect(worldBefore?.x).toBeCloseTo(-300, 0);

        const newT = 36;
        const newHt = newT / 2;
        const newHw = 300;
        data.faceMesh.getBoundingInfo = () => ({
            boundingBox: {
                minimum: { x: -newHt, y: -360, z: -newHt },
                maximum: { x: newHt, y: 360, z: newHt },
            },
        });
        data.faceMesh.getWorldMatrix = () => mockMatrix([
            0, 0, -1, 0,
            0, 1, 0, 0,
            1, 0, 0, 0,
            -newHw, 0, 0, 1,
        ]);

        const worldAfter = resolveAnchorWorld(data.scene, anchor);
        expect(worldAfter?.x).toBeCloseTo(-newHw, 0);
    });
});
