import { describe, expect, it, beforeEach } from 'vitest';
import { PMIGeometryHighlighter } from '../pmi-geometry-highlight.js';

class V3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    static TransformCoordinates(v: any) { return new V3(v.x, v.y, v.z); }
    static Project() { return { x: 400, y: 300, z: 0.5 }; }
    static Distance(a: any, b: any) {
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    }
    static Lerp(a: any, b: any, t: number) {
        return new V3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    }
    static Dot(a: any, b: any) { return a.x * b.x + a.y * b.y + a.z * b.z; }
    static Cross(a: any, b: any) {
        return new V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
    }
    subtract(p: any) { return new V3(this.x - p.x, this.y - p.y, this.z - p.z); }
    normalize() { return new V3(0, 0, 1); }
    clone() { return new V3(this.x, this.y, this.z); }
}

class Color3 {
    r: number; g: number; b: number;
    constructor(r = 0, g = 0, b = 0) { this.r = r; this.g = b; this.b = b; }
    clone() { return new Color3(this.r, this.g, this.b); }
}

function fakeMesh() {
    return {
        position: null as any,
        scaling: { x: 1, y: 1, z: 1 },
        rotation: {} as any,
        rotationQuaternion: null as any,
        renderingGroupId: 0,
        isPickable: false,
        metadata: {} as any,
        material: null as any,
        onBeforeRenderObservable: { add() { /* noop */ } },
        isDisposed: () => false,
        dispose() { /* noop */ },
    };
}

function stubBabylon() {
    (globalThis as any).BABYLON = {
        Matrix: { Identity: () => ({}) },
        Vector3: V3,
        Color3,
        Quaternion: { RotationAxis: () => ({}) },
        Engine: { ALWAYS: 1 },
        MeshBuilder: {
            CreateSphere: () => fakeMesh(),
            CreateCylinder: () => fakeMesh(),
            CreateLines: () => fakeMesh(),
        },
        StandardMaterial: class {
            emissiveColor: any = null;
            diffuseColor: any = null;
            disableLighting = false;
            disableDepthWrite = false;
            depthFunction: any = null;
        },
    };
}

function baseScene(meshes: any[]) {
    return {
        meshes,
        activeCamera: { viewport: { toGlobal: () => ({}) } },
        getEngine: () => ({ getRenderWidth: () => 800, getRenderHeight: () => 600 }),
        getTransformMatrix: () => ({}),
        multiPick: () => [],
    };
}

describe('highlight nie zmienia wyglądu korpusu (overlay-only)', () => {
    beforeEach(() => stubBabylon());

    it('wykrycie naroża nie rusza markera ani materiału — tylko kulka overlay', () => {
        const diffuse = new Color3(1, 0.2, 0.2);
        const emissive = new Color3(0.5, 0.1, 0.1);
        const marker = {
            metadata: { type: 'vertex', cornerIndex: 3 },
            isEnabled: () => true,
            isDisposed: () => false,
            getAbsolutePosition: () => ({ x: 0, y: 0, z: 100 }),
            visibility: 0,
            material: { alpha: 0, diffuseColor: diffuse, emissiveColor: emissive },
        };
        const hl = new PMIGeometryHighlighter(baseScene([marker]));

        const res = hl.update(400, 300);
        expect(res.hit).toBe(true);

        // Korpus/marker nietknięty…
        expect(marker.visibility).toBe(0);
        expect(marker.material.alpha).toBe(0);
        expect(marker.material.diffuseColor).toBe(diffuse);
        expect(marker.material.emissiveColor).toBe(emissive);
        // …a wskazanie naroża jest (overlay).
        expect((hl as any).vertexOverlay).not.toBeNull();

        hl.clearHighlight();
        expect((hl as any).vertexOverlay).toBeNull();
        expect(marker.visibility).toBe(0);
        expect(marker.material.alpha).toBe(0);
    });

    it('wykrycie krawędzi podświetla linię (oraz nakładkę overlay) i przywraca kolor po clearHighlight', () => {
        const lineColor = new Color3(0.1, 0.1, 0.1);
        const edgeMesh: any = {
            metadata: { type: 'edge', brepPoints: [[0, 0, 100], [10, 0, 100]] },
            getWorldMatrix: () => ({}),
            isEnabled: () => true,
            isDisposed: () => false,
            color: lineColor,
        };
        const hl = new PMIGeometryHighlighter(baseScene([edgeMesh]));

        const res = hl.update(400, 300);
        expect(res.hit).toBe(true);
        expect(edgeMesh.color.r).toBeCloseTo(1.0);
        expect((hl as any).edgeOverlays.length).toBeGreaterThan(0);

        hl.clearHighlight();
        expect(edgeMesh.color.r).toBeCloseTo(0.1);
    });

    it('gdy w scenie istnieje krawędź i naroże, kursor w pobliżu naroża podświetla naroże (vertex overlay)', () => {
        const marker = {
            metadata: { type: 'vertex', cornerIndex: 0 },
            isEnabled: () => true,
            isDisposed: () => false,
            getAbsolutePosition: () => ({ x: 0, y: 0, z: 100 }),
            visibility: 0,
            material: { alpha: 0, diffuseColor: new Color3(1, 0, 0), emissiveColor: new Color3(0, 0, 0) },
        };
        const edgeMesh: any = {
            metadata: { type: 'edge', brepPoints: [[0, 0, 100], [10, 0, 100]] },
            getWorldMatrix: () => ({}),
            isEnabled: () => true,
            isDisposed: () => false,
            color: new Color3(0.1, 0.1, 0.1),
        };
        const hl = new PMIGeometryHighlighter(baseScene([marker, edgeMesh]));

        const res = hl.update(400, 300);
        expect(res.hit).toBe(true);
        expect(res.geometryType).toBe('vertex');
        expect((hl as any).vertexOverlay).not.toBeNull();
    });
});
