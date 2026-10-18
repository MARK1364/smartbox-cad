import { describe, expect, it, beforeEach } from 'vitest';
import { PMIGeometryHighlighter } from '../pmi-geometry-highlight.js';

declare const BABYLON: any;

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
    constructor(r = 0, g = 0, b = 0) { this.r = r; this.g = g; this.b = b; }
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
            name = '';
            emissiveColor: any = null;
            diffuseColor: any = null;
            disableLighting = false;
            disableDepthWrite = false;
            depthFunction: any = null;
            clone(name: string) {
                const c = new (BABYLON.StandardMaterial as any)();
                c.name = name;
                c.emissiveColor = this.emissiveColor?.clone ? this.emissiveColor.clone() : this.emissiveColor;
                c.diffuseColor = this.diffuseColor?.clone ? this.diffuseColor.clone() : this.diffuseColor;
                return c;
            }
            dispose() { /* noop */ }
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

    it('wykrycie krawędzi tworzy nakładkę overlay i nie mutuje koloru linii bazowej (overlay-only)', () => {
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
        // Kontrakt overlay-only: bazowy mesh sceny pozostaje nietknięty!
        expect(edgeMesh.color).toBe(lineColor);
        expect(edgeMesh.color.r).toBeCloseTo(0.1);
        // Za to nakładka overlay (linia + cylinder) jest utworzona
        expect((hl as any).edgeOverlays.length).toBeGreaterThan(0);
        expect(hl.currentHoveredSegment).not.toBeNull();

        hl.clearHighlight();
        expect(edgeMesh.color.r).toBeCloseTo(0.1);
        expect((hl as any).edgeOverlays.length).toBe(0);
        expect(hl.currentHoveredSegment).toBeNull();
    });

    it('przejście płaszczyzna -> krawędź poprawnie tworzy overlay i zachowuje currentHoveredSegment', () => {
        const sharedMat: any = new (BABYLON.StandardMaterial as any)();
        const planeMesh: any = {
            metadata: { faceName: 'front', smartId: 'panel_1' },
            material: sharedMat,
            isEnabled: () => true,
            isDisposed: () => false,
        };
        const edgeMesh: any = {
            metadata: { type: 'edge', brepPoints: [[0, 0, 100], [10, 0, 100]] },
            getWorldMatrix: () => ({}),
            isEnabled: () => true,
            isDisposed: () => false,
            color: new Color3(0.1, 0.1, 0.1),
        };

        const scene = {
            ...baseScene([planeMesh, edgeMesh]),
            multiPick: () => [{ hit: true, pickedMesh: planeMesh, pickedPoint: { x: 0, y: 0, z: 0 }, getNormal: () => ({ x: 0, y: 1, z: 0 }) }],
            pickWithRay: () => ({ hit: true, pickedMesh: planeMesh, pickedPoint: { x: 0, y: 0, z: 0 }, getNormal: () => ({ x: 0, y: 1, z: 0 }) }),
        };
        const hl = new PMIGeometryHighlighter(scene);

        // Krok 1: kursor nad płaszczyzną (daleko od krawędzi)
        const resPlane = hl.update(100, 100);
        expect(resPlane.hit).toBe(true);
        expect(resPlane.geometryType).toBe('plane');
        expect((hl as any).edgeOverlays.length).toBe(0);
        expect(hl.currentHoveredSegment).toBeNull();

        // Krok 2: przesunięcie kursora nad krawędź (400, 300)
        const resEdge = hl.update(400, 300);
        expect(resEdge.hit).toBe(true);
        expect(resEdge.geometryType).toBe('edge');
        // Overlay krawędzi i hoveredSegment NIE zostały zgubione przez clearHighlight()
        expect((hl as any).edgeOverlays.length).toBeGreaterThan(0);
        expect(hl.currentHoveredSegment).not.toBeNull();
        expect(hl.currentHoveredSegment?.mesh).toBe(edgeMesh);
    });

    it('przejście krawędź A -> krawędź B aktualizuje overlay i currentHoveredSegment bez gubienia danych', () => {
        const edgeMeshA: any = {
            metadata: { type: 'edge', brepPoints: [[0, 0, 100], [10, 0, 100]] },
            getWorldMatrix: () => ({}),
            isEnabled: () => true,
            isDisposed: () => false,
            color: new Color3(0.1, 0.1, 0.1),
        };
        const edgeMeshB: any = {
            metadata: { type: 'edge', brepPoints: [[100, 0, 100], [110, 0, 100]] },
            getWorldMatrix: () => ({}),
            isEnabled: () => true,
            isDisposed: () => false,
            color: new Color3(0.2, 0.2, 0.2),
        };
        const hl = new PMIGeometryHighlighter(baseScene([edgeMeshA, edgeMeshB]));

        // Krok 1: kursor nad krawędzią A
        (V3 as any).Project = (world: any) => {
            if (world && world.x < 50) return { x: 400, y: 300, z: 0.5 };
            return { x: 1000, y: 1000, z: 0.5 };
        };
        const resA = hl.update(400, 300);
        expect(resA.hit).toBe(true);
        expect(resA.geometryType).toBe('edge');
        expect(hl.currentHoveredSegment?.mesh).toBe(edgeMeshA);
        expect((hl as any).edgeOverlays.length).toBeGreaterThan(0);

        // Krok 2: kursor przechodzi nad krawędź B
        (V3 as any).Project = (world: any) => {
            if (world && world.x >= 50) return { x: 400, y: 300, z: 0.5 };
            return { x: 1000, y: 1000, z: 0.5 };
        };
        const resB = hl.update(400, 300);
        expect(resB.hit).toBe(true);
        expect(resB.geometryType).toBe('edge');
        expect(hl.currentHoveredSegment?.mesh).toBe(edgeMeshB);
        expect((hl as any).edgeOverlays.length).toBeGreaterThan(0);
    });

    it('zestaw wielu nakładek pomiarowych showEdgeOverlays nie jest niszczony przy ruchu wzdłuż krawędzi', () => {
        const edgeMeshA: any = {
            metadata: { type: 'edge', brepPoints: [[0, 0, 100], [10, 0, 100]] },
            getWorldMatrix: () => ({}),
            isEnabled: () => true,
            isDisposed: () => false,
            color: new Color3(0.1, 0.1, 0.1),
        };
        const hl = new PMIGeometryHighlighter(baseScene([edgeMeshA]));

        (V3 as any).Project = () => ({ x: 400, y: 300, z: 0.5 });
        hl.update(400, 300);
        const seg = hl.currentHoveredSegment!;
        expect(seg).toBeDefined();

        const seg2 = {
            ...seg,
            p1World: { x: 0, y: 50, z: 100 },
            p2World: { x: 10, y: 50, z: 100 },
        };

        // Narzędzie miarki aktywuje multi-overlay dla dwóch krawędzi
        hl.showEdgeOverlays([seg, seg2]);
        const initialOverlays = (hl as any).edgeOverlays.length;
        expect(initialOverlays).toBeGreaterThan(0);
        const keyWithSemicolon = (hl as any).edgeOverlayKey;
        expect(keyWithSemicolon).toContain(';');

        // Kolejny ruch myszy wzdłuż krawędzi seg
        hl.update(400, 300);

        // Cache rozpoznaje obecność krawędzi w aktywnym zestawie i nie niszczy multi-overlayu!
        expect((hl as any).edgeOverlayKey).toBe(keyWithSemicolon);
        expect((hl as any).edgeOverlays.length).toBe(initialOverlays);
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

    it('przejście kursora między dwoma narożnikami tej samej formatki aktualizuje overlay (naprawa cache)', () => {
        const markerA = {
            metadata: { type: 'vertex', cornerIndex: 0 },
            isEnabled: () => true,
            isDisposed: () => false,
            getAbsolutePosition: () => ({ x: 0, y: 0, z: 0 }),
            visibility: 0,
            material: { alpha: 0, diffuseColor: new Color3(1, 0, 0), emissiveColor: new Color3(0, 0, 0) },
        };
        const markerB = {
            metadata: { type: 'vertex', cornerIndex: 1 },
            isEnabled: () => true,
            isDisposed: () => false,
            getAbsolutePosition: () => ({ x: 100, y: 0, z: 0 }),
            visibility: 0,
            material: { alpha: 0, diffuseColor: new Color3(1, 0, 0), emissiveColor: new Color3(0, 0, 0) },
        };
        const hl = new PMIGeometryHighlighter(baseScene([markerA, markerB]));

        const resA = hl.update(400, 300);
        expect(resA.hit).toBe(true);
        expect(resA.cornerIndex).toBe(0);
        expect((hl as any).vertexOverlay).not.toBeNull();

        // Symulacja przesunięcia wskaźnika do drugiego narożnika
        (V3 as any).Project = (world: any) => {
            if (world && world.x > 50) return { x: 400, y: 300, z: 0.5 };
            return { x: 1000, y: 1000, z: 0.5 };
        };

        const resB = hl.update(400, 300);
        expect(resB.hit).toBe(true);
        expect(resB.cornerIndex).toBe(1);
        expect((hl as any).vertexOverlay).not.toBeNull();
    });

    it('podświetlenie płaszczyzny klonuje materiał i nie mutuje współdzielonego materiału bazowego', () => {
        const sharedMat: any = new (BABYLON.StandardMaterial as any)();
        sharedMat.name = 'shared_wood';
        sharedMat.diffuseColor = new Color3(0.8, 0.8, 0.8);
        sharedMat.emissiveColor = new Color3(0.1, 0.1, 0.1);

        const planeMesh: any = {
            metadata: { faceName: 'front', smartId: 'panel_1' },
            material: sharedMat,
            isEnabled: () => true,
            isDisposed: () => false,
        };

        const scene = {
            ...baseScene([planeMesh]),
            multiPick: () => [{ hit: true, pickedMesh: planeMesh, pickedPoint: { x: 0, y: 0, z: 0 } }],
            pickWithRay: () => ({ hit: true, pickedMesh: planeMesh, pickedPoint: { x: 0, y: 0, z: 0 } }),
        };

        const hl = new PMIGeometryHighlighter(scene);
        (V3 as any).Project = () => ({ x: 1000, y: 1000, z: 0.5 });

        (hl as any).detector.selectGeometry = () => ({
            hit: true,
            geometryType: 'plane',
            faceName: 'front',
            mesh: planeMesh,
            pickedPoint: { x: 0, y: 0, z: 0 },
            normal: { x: 0, y: 0, z: 1 },
        });

        const res = hl.update(400, 300);
        expect(res.hit).toBe(true);
        expect(res.geometryType).toBe('plane');

        expect(planeMesh.material).not.toBe(sharedMat);
        expect(sharedMat.diffuseColor.r).toBeCloseTo(0.8);
        expect(sharedMat.emissiveColor.r).toBeCloseTo(0.1);

        hl.clearHighlight();
        expect(planeMesh.material).toBe(sharedMat);
    });

    it('showEdgeOverlays z tym samym zestawem krawędzi nie niszczy i nie alokuje siatek ponownie (cache)', () => {
        const segment: any = {
            mesh: { isDisposed: () => false },
            p1World: { x: 0, y: 0, z: 0 },
            p2World: { x: 100, y: 0, z: 0 },
            closestWorld: { x: 50, y: 0, z: 0 },
            distPx: 2,
        };
        const hl = new PMIGeometryHighlighter(baseScene([]));
        hl.showEdgeOverlays([segment]);
        expect((hl as any).edgeOverlays.length).toBeGreaterThan(0);
        const originalFirstMesh = (hl as any).edgeOverlays[0];

        hl.showEdgeOverlays([segment]);
        expect((hl as any).edgeOverlays[0]).toBe(originalFirstMesh);
    });

    it('seria pustych detekcji nie zleca renderowania przy każdym ruchu kursora', () => {
        let renderRequests = 0;
        const fakeCtx = {
            viewport: {
                requestRender: () => { renderRequests++; },
            },
        };
        (globalThis as any).ContextManager = { instance: fakeCtx };

        const hl = new PMIGeometryHighlighter(baseScene([]));
        (V3 as any).Project = () => ({ x: 1000, y: 1000, z: 0.5 });

        // Pierwszy ruch w pustą przestrzeń
        hl.update(100, 100);
        const rendersAfterFirst = renderRequests;

        // Kolejne ruchy w pustej przestrzeni
        hl.update(110, 110);
        hl.update(120, 120);
        hl.update(130, 130);

        // Liczba żądań renderu nie wzrasta!
        expect(renderRequests).toBe(rendersAfterFirst);
    });

    it('ruch kursora po tej samej ścianie zachowuje świeży pickedPoint w lastDetection', () => {
        const planeMesh: any = {
            metadata: { faceName: 'top', smartId: 'panel_top' },
            material: {
                clone: () => ({ emissiveColor: new Color3(), diffuseColor: new Color3() }),
            },
            isEnabled: () => true,
            isDisposed: () => false,
        };
        const hl = new PMIGeometryHighlighter(baseScene([planeMesh]));
        (V3 as any).Project = () => ({ x: 1000, y: 1000, z: 0.5 });

        let currentHitPoint = { x: 10, y: 20, z: 30 };
        (hl as any).detector.selectGeometry = () => ({
            hit: true,
            geometryType: 'plane',
            faceName: 'top',
            mesh: planeMesh,
            pickedPoint: { ...currentHitPoint },
            normal: { x: 0, y: 1, z: 0 },
        });

        // Punkt 1 na ścianie
        hl.update(400, 300);
        expect(hl.lastDetection?.pickedPoint?.x).toBe(10);

        // Kursor przesuwa się w inne miejsce tej samej ściany
        currentHitPoint = { x: 55, y: 20, z: 88 };
        hl.update(450, 320);

        // Cache nie przebudowuje highlightu, ale lastDetection zawiera najświeższy punkt!
        expect(hl.lastDetection?.pickedPoint?.x).toBe(55);
        expect(hl.lastDetection?.pickedPoint?.z).toBe(88);
    });

    it('gdy materiał formatki nie ma metody clone, oryginalny materiał pozostaje nienaruszony', () => {
        const uncloneableMat: any = {
            // Brak metody clone!
            diffuseColor: new Color3(0.5, 0.5, 0.5),
            emissiveColor: new Color3(0.2, 0.2, 0.2),
        };
        const planeMesh: any = {
            metadata: { faceName: 'front', smartId: 'panel_uncloneable' },
            material: uncloneableMat,
            isEnabled: () => true,
            isDisposed: () => false,
        };
        const hl = new PMIGeometryHighlighter(baseScene([planeMesh]));
        (V3 as any).Project = () => ({ x: 1000, y: 1000, z: 0.5 });

        (hl as any).detector.selectGeometry = () => ({
            hit: true,
            geometryType: 'plane',
            faceName: 'front',
            mesh: planeMesh,
            pickedPoint: { x: 0, y: 0, z: 0 },
            normal: { x: 0, y: 0, z: 1 },
        });

        hl.update(400, 300);

        // mesh.material otrzymał dedykowany highlight material, a uncloneableMat nie został tknięty!
        expect(planeMesh.material).not.toBe(uncloneableMat);
        expect(uncloneableMat.diffuseColor.r).toBeCloseTo(0.5);
        expect(uncloneableMat.emissiveColor.r).toBeCloseTo(0.2);

        hl.clearHighlight();
        expect(planeMesh.material).toBe(uncloneableMat);
    });
});
