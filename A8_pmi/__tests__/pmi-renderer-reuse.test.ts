import { describe, expect, it, beforeEach } from 'vitest';
import { PMIRenderer } from '../pmi-renderer.js';
import { v3 } from '../dimension-solver.js';

declare const BABYLON: any;

class MockV3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; }
    subtract(p: any) { return new MockV3(this.x - p.x, this.y - p.y, this.z - p.z); }
    normalize() { return new MockV3(0, 0, 1); }
    length() { return Math.hypot(this.x, this.y, this.z); }
    static Lerp(a: any, b: any, t: number) {
        return new MockV3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    }
    static Dot(a: any, b: any) { return a.x * b.x + a.y * b.y + a.z * b.z; }
    static Cross(a: any, b: any) {
        return new MockV3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
    }
}

class MockColor3 {
    r: number; g: number; b: number;
    constructor(r = 0, g = 0, b = 0) { this.r = r; this.g = g; this.b = b; }
}

function fakeMesh() {
    return {
        position: null as any,
        scaling: new MockV3(1, 1, 1),
        rotation: {} as any,
        rotationQuaternion: null as any,
        renderingGroupId: 0,
        isPickable: false,
        isVisible: true,
        visibility: 1,
        metadata: {} as any,
        material: null as any,
        onBeforeRenderObservable: { add() { /* noop */ } },
        isDisposed: () => false,
        dispose() { /* noop */ },
        isEnabled: true,
        setEnabled(v: boolean) { (this as any).isEnabled = v; },
    };
}

let createdCylindersCount = 0;
let createdMaterialsCount = 0;
let createdDashedLinesCount = 0;
let createdPlanesCount = 0;
let createdDynamicTexturesCount = 0;

function stubBabylon() {
    createdCylindersCount = 0;
    createdMaterialsCount = 0;
    createdDashedLinesCount = 0;
    createdPlanesCount = 0;
    createdDynamicTexturesCount = 0;

    (globalThis as any).BABYLON = {
        Vector3: MockV3,
        Color3: MockColor3,
        Quaternion: { RotationAxis: () => ({}) },
        Mesh: {
            DOUBLESIDE: 2,
            BILLBOARDMODE_ALL: 7,
            BILLBOARDMODE_NONE: 0,
        },
        MeshBuilder: {
            CreateCylinder: () => {
                createdCylindersCount++;
                return fakeMesh();
            },
            CreatePlane: () => {
                createdPlanesCount++;
                return fakeMesh();
            },
            CreateDashedLines: (name: string, opts: any) => {
                if (opts?.instance) {
                    opts.instance._points = opts.points;
                    opts.instance._dashSize = opts.dashSize;
                    opts.instance._gapSize = opts.gapSize;
                    return opts.instance;
                }
                createdDashedLinesCount++;
                const mesh: any = fakeMesh();
                mesh._points = opts.points;
                mesh._dashSize = opts.dashSize;
                mesh._gapSize = opts.gapSize;
                return mesh;
            },
        },
        DynamicTexture: class {
            constructor() {
                createdDynamicTexturesCount++;
            }
            getSize() {
                return { width: 512, height: 256 };
            }
            getContext() {
                return {
                    clearRect() { /* noop */ },
                    save() { /* noop */ },
                    restore() { /* noop */ },
                    beginPath() { /* noop */ },
                    moveTo() { /* noop */ },
                    arcTo() { /* noop */ },
                    lineTo() { /* noop */ },
                    closePath() { /* noop */ },
                    fill() { /* noop */ },
                    stroke() { /* noop */ },
                    fillText() { /* noop */ },
                };
            }
            update() { /* noop */ }
            dispose() { /* noop */ }
        },
        StandardMaterial: class {
            diffuseColor: any = null;
            emissiveColor: any = null;
            constructor() {
                createdMaterialsCount++;
            }
            dispose() { /* noop */ }
        },
    };
}

describe('PMIRenderer — reużywanie siatek w miejscu (brak churnu pamięci)', () => {
    beforeEach(() => stubBabylon());

    it('renderMeasurePreview aktualizuje istniejące tuby w miejscu podczas ruchu myszy', () => {
        const scene = {
            activeCamera: null,
        };
        const renderer = new PMIRenderer(scene);

        // Klatka 1: ruch kursora do punktu (100, 0, 0)
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(100, 0, 0)]);
        const initialCylinders = createdCylindersCount;
        expect(initialCylinders).toBeGreaterThan(0);

        // Klatka 2: zmiana kąta na tej samej długości (100 mm)
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(0, 100, 0)]);

        // Siatka cylindra została zaktualizowana w miejscu — 0 nowych cylindrów!
        expect(createdCylindersCount).toBe(initialCylinders);

        // Klatka 3: zmiana długości na 150 mm
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(150, 0, 0)]);

        // Nawet przy zmianie długości siatka tuby jest reużywana w miejscu (aktualizowana skalą)
        expect(createdCylindersCount).toBe(initialCylinders);
    });

    it('updateMeasureDeltas aktualizuje linie przerywane delt w miejscu (instance reuse) i aplikuje nowe punkty', () => {
        const scene = {
            activeCamera: null,
        };
        const renderer = new PMIRenderer(scene);

        // Klatka 1: pomiar skośny generujący delty (dX i dY)
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(100, 100, 0)]);
        const initialDashed = createdDashedLinesCount;
        expect(initialDashed).toBeGreaterThan(0);

        const vis: any = (renderer as any).measurePreview;
        const firstDeltaLine = vis.deltaLines[0];
        expect(firstDeltaLine).toBeDefined();
        const initialPoints = [...firstDeltaLine._points];

        // Klatka 2: ruch kursora do innego punktu skośnego
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(120, 140, 0)]);

        // Linie delt zaktualizowane w miejscu bez alokowania nowych meshy!
        expect(createdDashedLinesCount).toBe(initialDashed);
        expect(vis.deltaLines[0]).toBe(firstDeltaLine);

        // Punkty geometrii linii w instancji uległy rzeczywistej aktualizacji
        expect(firstDeltaLine._points[1].x).toBe(120);
        expect(firstDeltaLine._points[1].x).not.toBe(initialPoints[1].x);
    });

    it('zmiana tekstu etykiety podczas ruchu nie tworzy nowych płaszczyzn ani tekstur (in-place canvas update)', () => {
        const scene = {
            activeCamera: null,
        };
        const renderer = new PMIRenderer(scene);

        // Klatka 1: pomiar 100 mm
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(100, 0, 0)]);
        const initialPlanes = createdPlanesCount;
        const initialTextures = createdDynamicTexturesCount;
        expect(initialPlanes).toBeGreaterThan(0);
        expect(initialTextures).toBeGreaterThan(0);

        // Klatka 2: pomiar 105 mm — inny tekst wymiaru
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(105, 0, 0)]);

        // Płaszczyzna i tekstura są reużywane bez alokacji nowych instancji
        expect(createdPlanesCount).toBe(initialPlanes);
        expect(createdDynamicTexturesCount).toBe(initialTextures);

        // Klatka 3: pomiar 150 mm — kolejny inny tekst
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(150, 0, 0)]);
        expect(createdPlanesCount).toBe(initialPlanes);
        expect(createdDynamicTexturesCount).toBe(initialTextures);

        // Klatka 4: przejście do pomiaru skośnego (pojawiają się delty dX/dY/dZ — 4 linie)
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(150, 150, 150)]);
        // Wykryto zmianę liczby wierszy (z 1 na 4): tworzona jest poprawnie wyskalowana tekstura i płaszczyzna
        expect(createdPlanesCount).toBe(initialPlanes + 1);
        expect(createdDynamicTexturesCount).toBe(initialTextures + 1);
        const multiPlanes = createdPlanesCount;
        const multiTextures = createdDynamicTexturesCount;

        // Klatka 5: kolejny ruch w trybie skośnym (4 linie z innym tekstem delt)
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(160, 170, 150)]);
        // W trybie wielowierszowym tekstura i płaszczyzna są ponownie reużywane w miejscu!
        expect(createdPlanesCount).toBe(multiPlanes);
        expect(createdDynamicTexturesCount).toBe(multiTextures);
    });

    it('zasada pojedynczej etykiety: aktywny renderMeasurePreview ukrywa zatwierdzone pomiary z measureVisuals', () => {
        const scene = {
            activeCamera: null,
        };
        const renderer = new PMIRenderer(scene);

        // Symulacja zatwierdzonego pomiaru w measureVisuals (np. ze store po skośnym multiwyborze)
        const fakePlane: any = fakeMesh();
        const fakePart: any = fakeMesh();
        const existingMeasureVisual: any = {
            id: 'committed_measure_1',
            mainLineParts: [fakePart],
            deltaLines: [],
            points: [],
            textPlane: fakePlane,
        };
        (renderer as any).measureVisuals.set('committed_measure_1', existingMeasureVisual);

        expect(fakePlane.isEnabled).toBe(true);
        expect(fakePart.isEnabled).toBe(true);

        // Krok 1: pojawia się podgląd nowego pomiaru (np. najechanie na krawędź lub multi-wybór)
        renderer.renderMeasurePreview([v3(0, 0, 0), v3(200, 0, 0)]);

        // Istniejący zatwierdzony pomiar i jego etykieta zostają UKRYTE — na ekranie jest tylko 1 etykieta!
        expect(fakePlane.isEnabled).toBe(false);
        expect(fakePart.isEnabled).toBe(false);

        // Krok 2: podgląd zostaje wyczyszczony (użytkownik zjechał poza element bez kliknięcia)
        renderer.clearMeasurePreview();

        // Widoczność zatwierdzonego pomiaru zostaje przywrócona
        expect(fakePlane.isEnabled).toBe(true);
        expect(fakePart.isEnabled).toBe(true);
    });
});
