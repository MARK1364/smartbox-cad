import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { v3 } from '../dimension-solver.js';
import {
    cadDeltasFromRender,
    closestPointOnSegment,
    connectedEdgeChain,
    measureDeltaSegments,
    measureTwoEdges,
    pathLength,
    PLANE_PARALLEL_ANGLE_RAD,
    planesAreParallel,
    projectMeasureElements,
    projectPointOnPlane,
    shouldShowDeltas,
} from '../pmi-measure.js';
import { formatMeasureText, PMIStore } from '../pmi-data.js';
import {
    computeMeasureLabelDimensions,
    computeMeasureScreenScale,
    MEASURE_BASE_TEXT_H,
    measureLineWidth,
    measurePointDiameter,
} from '../pmi-renderer.js';
import { findMeasureElementPick, findPlaneHit } from '../pmi-measure-pick.js';
import { planeNormalWorldFromMesh } from '../pmi-id-bridge.js';
import { GeometryType } from '../../A1_core/geometry-detector.js';
import { ContextManager } from '../../A1_core/context-manager.js';

describe('cadDeltasFromRender', () => {
    it('mapuje osie Babylon na CAD (Y↔Z)', () => {
        const deltas = cadDeltasFromRender(v3(0, 0, 0), v3(100, 40, 25));
        expect(deltas.dX).toBeCloseTo(100);
        expect(deltas.dY).toBeCloseTo(25);
        expect(deltas.dZ).toBeCloseTo(40);
        expect(deltas.length).toBeCloseTo(Math.hypot(100, 40, 25));
    });

    it('pokazuje delty tylko przy składowych na ≥2 osiach', () => {
        expect(shouldShowDeltas(cadDeltasFromRender(v3(0, 0, 0), v3(600, 0, 0)))).toBe(false);
        expect(shouldShowDeltas(cadDeltasFromRender(v3(0, 0, 0), v3(600, 0, 200)))).toBe(true);
    });
});

describe('formatMeasureText', () => {
    it('dla osi X pokazuje tylko L', () => {
        expect(formatMeasureText(v3(0, 0, 0), v3(600, 0, 0), 'METRIC_MM')).toBe('L: 600.0 mm');
    });

    it('dla przekątnej XY dodaje dX i dY', () => {
        const text = formatMeasureText(v3(0, 0, 0), v3(300, 0, 400), 'METRIC_MM');
        expect(text).toContain('L: 500.0 mm');
        expect(text).toContain('dX: 300.0 mm');
        expect(text).toContain('dY: 400.0 mm');
        expect(text).not.toContain('dZ:');
    });
});

describe('measureDeltaSegments', () => {
    it('buduje schodki X→Y→Z w przestrzeni Babylon', () => {
        const segs = measureDeltaSegments(v3(0, 0, 0), v3(10, 20, 30));
        expect(segs.map(s => s.axis)).toEqual(['X', 'Y', 'Z']);
        expect(segs[0].b).toEqual(v3(10, 0, 0));
        expect(segs[1].b).toEqual(v3(10, 0, 30));
        expect(segs[2].b).toEqual(v3(10, 20, 30));
    });

    it('pomija zerowe składowe', () => {
        const segs = measureDeltaSegments(v3(0, 0, 0), v3(100, 0, 0));
        expect(segs).toHaveLength(1);
        expect(segs[0].axis).toBe('X');
    });
});

describe('rzuty elementów', () => {
    it('rzutuje narożnik na krawędź', () => {
        const result = projectMeasureElements(
            { kind: 'vertex', worldPos: v3(5, 10, 0) },
            { kind: 'edge', worldPos: v3(0, 0, 0), edgeA: v3(0, 0, 0), edgeB: v3(20, 0, 0) },
        );
        expect(result.p2.x).toBeCloseTo(5);
        expect(result.p2.y).toBeCloseTo(0);
    });

    it('rzutuje punkt na płaszczyznę', () => {
        const p = projectPointOnPlane(v3(0, 10, 0), v3(0, 0, 0), v3(0, 1, 0));
        expect(p.y).toBeCloseTo(0);
        expect(closestPointOnSegment(v3(5, 5, 0), v3(0, 0, 0), v3(10, 0, 0))).toEqual(v3(5, 0, 0));
    });

    it('mierzy dystans dwóch równoległych płaszczyzn', () => {
        const result = projectMeasureElements(
            {
                kind: 'plane',
                worldPos: v3(0, 0, 0),
                planeOrigin: v3(0, 0, 0),
                planeNormal: v3(0, 1, 0),
            },
            {
                kind: 'plane',
                worldPos: v3(10, 18, 5),
                planeOrigin: v3(0, 18, 0),
                planeNormal: v3(0, 1, 0),
            },
        );
        expect(result.p1.y).toBeCloseTo(0);
        expect(result.p2.y).toBeCloseTo(18);
        expect(result.p2.x).toBeCloseTo(result.p1.x);
        expect(result.p2.z).toBeCloseTo(result.p1.z);
    });

    it('mierzy narożnik do płaszczyzny', () => {
        const result = projectMeasureElements(
            { kind: 'vertex', worldPos: v3(4, 12, 3) },
            {
                kind: 'plane',
                worldPos: v3(0, 0, 0),
                planeOrigin: v3(0, 0, 0),
                planeNormal: v3(0, 1, 0),
            },
        );
        expect(result.p1).toEqual(v3(4, 12, 3));
        expect(result.p2.x).toBeCloseTo(4);
        expect(result.p2.y).toBeCloseTo(0);
        expect(result.p2.z).toBeCloseTo(3);
    });

    it('mierzy krawędź do płaszczyzny', () => {
        const result = projectMeasureElements(
            {
                kind: 'edge',
                worldPos: v3(0, 10, 0),
                edgeA: v3(0, 10, 0),
                edgeB: v3(20, 10, 0),
            },
            {
                kind: 'plane',
                worldPos: v3(0, 0, 0),
                planeOrigin: v3(0, 0, 0),
                planeNormal: v3(0, 1, 0),
            },
        );
        expect(result.p1.y).toBeCloseTo(10);
        expect(result.p2.y).toBeCloseTo(0);
        expect(Math.abs(result.p1.y - result.p2.y)).toBeCloseTo(10);
    });
});

describe('connectedEdgeChain', () => {
    it('łączy krawędzie ze wspólnym narożnikiem i sumuje długości', () => {
        const chain = connectedEdgeChain(
            v3(0, 0, 0), v3(100, 0, 0),
            v3(100, 0, 0), v3(100, 50, 0),
        );
        expect(chain).not.toBeNull();
        expect(chain!.path).toHaveLength(3);
        expect(chain!.length).toBeCloseTo(150);
        expect(chain!.junction.x).toBeCloseTo(100);
    });

    it('zwraca null gdy krawędzie nie mają wspólnego końca', () => {
        expect(connectedEdgeChain(
            v3(0, 0, 0), v3(100, 0, 0),
            v3(0, 50, 0), v3(100, 50, 0),
        )).toBeNull();
    });
});

describe('measureTwoEdges', () => {
    it('Ctrl + połączone krawędzie → łańcuch i suma', () => {
        const result = measureTwoEdges(
            v3(0, 0, 0), v3(100, 0, 0),
            v3(100, 0, 0), v3(100, 80, 0),
        );
        expect(result.mode).toBe('chain');
        expect(result.path).toHaveLength(3);
        expect(result.length).toBeCloseTo(180);
        expect(result.junction).not.toBeNull();
    });

    it('Ctrl + oddzielone krawędzie → dystans', () => {
        const result = measureTwoEdges(
            v3(0, 0, 0), v3(100, 0, 0),
            v3(0, 50, 0), v3(100, 50, 0),
        );
        expect(result.mode).toBe('distance');
        expect(result.path).toHaveLength(2);
        expect(result.length).toBeCloseTo(50);
        expect(result.junction).toBeNull();
    });
});

describe('pathLength', () => {
    it('sumuje odcinki polilinii', () => {
        expect(pathLength([v3(0, 0, 0), v3(100, 0, 0), v3(100, 50, 0)])).toBeCloseTo(150);
    });
});

describe('PMIStore measurements', () => {
    let store: PMIStore;

    beforeEach(() => {
        store = PMIStore.instance;
        store.fromJSON(null);
        store.unitMode = 'METRIC_MM';
        store.showUnits = true;
    });

    it('nie zapisuje pomiarów w toJSON (szybkie podglądy)', () => {
        store.addMeasurement({
            anchor1: {
                nodeId: 'a', smartIdPath: '', kind: 'VERTEX', subKey: '', subIndex: -1,
                pointLocal: v3(0, 0, 0), pointWorldFallback: v3(0, 0, 0),
            },
            anchor2: {
                nodeId: 'a', smartIdPath: '', kind: 'VERTEX', subKey: '', subIndex: -1,
                pointLocal: v3(100, 0, 0), pointWorldFallback: v3(100, 0, 0),
            },
        });

        const json = JSON.parse(JSON.stringify(store.toJSON()));
        expect(json.measurements).toBeUndefined();

        store.fromJSON(null);
        expect(store.measurements).toHaveLength(0);

        store.fromJSON(json);
        expect(store.measurements).toHaveLength(0);
    });

    it('łańcuch krawędzi pokazuje tylko L (viaAnchor)', () => {
        store.addMeasurement({
            anchor1: {
                nodeId: 'a', smartIdPath: '', kind: 'VERTEX', subKey: '', subIndex: -1,
                pointLocal: v3(0, 0, 0), pointWorldFallback: v3(0, 0, 0),
            },
            anchor2: {
                nodeId: 'a', smartIdPath: '', kind: 'VERTEX', subKey: '', subIndex: -1,
                pointLocal: v3(100, 50, 0), pointWorldFallback: v3(100, 50, 0),
            },
            viaAnchor: {
                nodeId: '', smartIdPath: '', kind: 'FREE', subKey: '', subIndex: -1,
                pointLocal: v3(0, 0, 0), pointWorldFallback: v3(100, 0, 0),
            },
        });
        const item = store.measurements[0];
        const changed = store.applyMeasurementValue(
            item,
            v3(0, 0, 0),
            v3(100, 50, 0),
            v3(100, 0, 0),
        );
        expect(changed).toBe(true);
        expect(item.distanceMM).toBeCloseTo(150);
        expect(item.text).toBe('L: 150.0 mm');
        expect(item.text).not.toContain('dX');
    });
});

describe('etykieta miarki (skalowanie i wymiary)', () => {
    it('oblicza kompaktowe wymiary bazowe (nie przekracza 90 mm wysokości dla 4 linii)', () => {
        const lines = ['L: 600.0 mm', 'dX: 600.0 mm', 'dY: 200.0 mm', 'dZ: 50.0 mm'];
        const dims = computeMeasureLabelDimensions(lines);

        expect(dims.textHWorld).toBe(MEASURE_BASE_TEXT_H);
        expect(dims.planeH).toBeLessThan(90); // w starym kodzie było 480 mm!
        expect(dims.planeW).toBeLessThan(170); // w starym kodzie było 1185 mm!
        expect(dims.planeH).toBeGreaterThan(60);
        expect(dims.planeW).toBeGreaterThan(80);
    });

    it('dla pojedynczej linii (L:) zachowuje małą wysokość bazową', () => {
        const dims = computeMeasureLabelDimensions(['L: 120.0 mm']);
        expect(dims.planeH).toBeLessThan(32);
    });

    it('skaluje plakietkę w dół przy dużym powiększeniu (zoom in), zapobiegając zajęciu pół ekranu', () => {
        const basePlaneH = 56;
        const lineCount = 4;
        // Kamera ortograficzna z bliskiej odległości: orthoH = 400 mm, renderH = 1080 px -> pxPerMM = 2.7 px/mm
        // Bez skalowania: 56 mm * 2.7 = 151 px na ekranie (lub przy 480 mm: 1296 px!)
        const scale = computeMeasureScreenScale(basePlaneH, lineCount, 1, 1080, 400);

        expect(scale).toBeLessThan(1.0);
        const screenHPx = basePlaneH * scale * (1080 / 400);
        expect(screenHPx).toBeCloseTo(120, 1);
    });

    it('skaluje plakietkę w górę przy oddaleniu (zoom out), utrzymując czytelność z daleka', () => {
        const basePlaneH = 56;
        const lineCount = 4;
        // Kamera ortograficzna z daleka: orthoH = 6760 mm, renderH = 1080 px -> pxPerMM = 0.16 px/mm
        const scale = computeMeasureScreenScale(basePlaneH, lineCount, 1, 1080, 6760);

        expect(scale).toBeGreaterThan(1.0);
        const screenHPx = basePlaneH * scale * (1080 / 6760);
        expect(screenHPx).toBeCloseTo(120, 1);
    });

    it('dla pojedynczej linii utrzymuje mniejszą stałą wysokość ekranową ok. 54 px', () => {
        const basePlaneH = 20;
        const lineCount = 1;
        const scale = computeMeasureScreenScale(basePlaneH, lineCount, 1, 1080, 1000);
        const screenHPx = basePlaneH * scale * (1080 / 1000);
        expect(screenHPx).toBeCloseTo(54, 1);
    });
});

describe('rozmiary wizualne miarki (linia i sfery punktów)', () => {
    const originalLineWidth = PMIStore.instance.lineWidthMM;

    afterEach(() => {
        PMIStore.instance.lineWidthMM = originalLineWidth;
    });

    it('measureLineWidth bezpośrednio odzwierciedla ustawienie suwaka lineWidthMM ze store', () => {
        PMIStore.instance.lineWidthMM = 0.8;
        expect(measureLineWidth()).toBeCloseTo(0.8, 2);

        PMIStore.instance.lineWidthMM = 3.5;
        expect(measureLineWidth()).toBeCloseTo(3.5, 2);

        PMIStore.instance.lineWidthMM = 5.0;
        expect(measureLineWidth()).toBeCloseTo(5.0, 2);

        // Dolny próg bezpieczeństwa
        PMIStore.instance.lineWidthMM = 0.1;
        expect(measureLineWidth()).toBeGreaterThanOrEqual(0.5);
    });

    it('measurePointDiameter bazowo skaluje się proporcjonalnie do grubości linii', () => {
        PMIStore.instance.lineWidthMM = 1.0;
        const d1 = measurePointDiameter();
        PMIStore.instance.lineWidthMM = 2.0;
        const d2 = measurePointDiameter();
        expect(d2).toBeGreaterThan(d1);
    });

    it('przy bliskich pomiarach adaptacyjnie zmniejsza średnicę sfery, aby nie nachodziły na siebie', () => {
        // Dystans 3 mm: suma promieni (czyli 1x średnica) musi być mniejsza od dystansu 3 mm
        const d3 = measurePointDiameter(3.0);
        expect(d3).toBeLessThan(1.0);
        expect(d3).toBeGreaterThan(0.35);

        // Nawet 2 sfery obok siebie zostawiają widoczną przestrzeń: d3 < 3.0 / 2
        expect(d3).toBeLessThan(3.0 / 2);

        // Dystans 1.5 mm
        const d15 = measurePointDiameter(1.5);
        expect(d15).toBeLessThan(1.5 / 2);
    });
});

describe('priorytet snapowania w findMeasureElementPick', () => {
    it('odrzuca płaszczyznę bez dokładnej normalnej B-rep', () => {
        const result = findPlaneHit({
            hit: true,
            geometryType: GeometryType.PLANE,
            pickedPoint: { x: 1, y: 2, z: 3 },
            mesh: { metadata: { faceName: 'FACE_Z_PLUS' } },
            normal: { x: 0, y: 1, z: 0 },
        });
        expect(result).toBeNull();
    });

    it('zwraca narożnik z detekcji zarówno bez Ctrl jak i z Ctrl', () => {
        const dummyMesh = { id: 'test_mesh', metadata: {} };
        const detection = {
            hit: true,
            geometryType: GeometryType.VERTEX,
            pickedPoint: { x: 10, y: 20, z: 30 },
            mesh: dummyMesh,
        };

        const pickWithoutCtrl = findMeasureElementPick({
            scene: { meshes: [] },
            pointerX: 100,
            pointerY: 100,
            ctrl: false,
            vertexSnapPx: 14,
            edgeSnapPx: 14,
            lastDetection: detection,
        });

        expect(pickWithoutCtrl).not.toBeNull();
        expect(pickWithoutCtrl!.kind).toBe('vertex');
        expect(pickWithoutCtrl!.edge).toBeNull();
        expect(pickWithoutCtrl!.worldPos).toEqual(v3(10, 20, 30));

        const pickWithCtrl = findMeasureElementPick({
            scene: { meshes: [] },
            pointerX: 100,
            pointerY: 100,
            ctrl: true,
            vertexSnapPx: 14,
            edgeSnapPx: 14,
            lastDetection: detection,
        });

        expect(pickWithCtrl).not.toBeNull();
        expect(pickWithCtrl!.kind).toBe('vertex');
        expect(pickWithCtrl!.edge).toBeNull();
        expect(pickWithCtrl!.worldPos).toEqual(v3(10, 20, 30));
    });

    it('podświetlona płaszczyzna nie jest podmieniana przez krawędź obrysu (przypadek wąskiej ścianki ABS)', () => {
        const planeMesh = {
            metadata: { faceName: 'left', nodeId: 'p1', planeNormalLocal: { x: 0, y: 0, z: 1 } },
            parent: {},
            getWorldMatrix: () => ({ m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }),
        };
        const detection = {
            hit: true,
            geometryType: GeometryType.PLANE,
            pickedPoint: { x: 1, y: 2, z: 3 },
            mesh: planeMesh,
            normal: { x: 0, y: 0, z: 1 },
        };
        const hoveredSegment = {
            mesh: { metadata: {} },
            p1World: v3(0, 0, 0),
            p2World: v3(10, 0, 0),
            p1Local: v3(0, 0, 0),
            p2Local: v3(10, 0, 0),
            index1: 0,
            index2: 1,
            closestWorld: v3(5, 0, 0),
            distPx: 1,
            depth: 0,
        };

        const pick = findMeasureElementPick({
            scene: { meshes: [] },
            pointerX: 100,
            pointerY: 100,
            ctrl: false,
            vertexSnapPx: 12,
            edgeSnapPx: 22,
            lastDetection: detection,
            hoveredSegment,
        });

        expect(pick).not.toBeNull();
        expect(pick!.kind).toBe('plane');
        expect(pick!.anchor.kind).toBe('FACE');
        expect(pick!.edge).toBeNull();
    });

    it('nie przesuwa punktu płaszczyzny do pobliskiego narożnika', () => {
        const planeMesh = {
            metadata: { faceName: 'left', nodeId: 'p1', planeNormalLocal: { x: 0, y: 0, z: 1 } },
            parent: {},
            getWorldMatrix: () => ({ m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }),
        };
        const detection = {
            hit: true,
            geometryType: GeometryType.PLANE,
            pickedPoint: { x: 5, y: 6, z: 7 },
            mesh: planeMesh,
            normal: { x: 0, y: 0, z: 1 },
        };

        const pick = findMeasureElementPick({
            scene: { meshes: [] },
            pointerX: 100,
            pointerY: 100,
            ctrl: false,
            vertexSnapPx: 12,
            edgeSnapPx: 22,
            lastDetection: detection,
        });

        expect(pick).not.toBeNull();
        expect(pick!.kind).toBe('plane');
        expect(pick!.worldPos).toEqual(v3(5, 6, 7));
        expect(pick!.anchor.kind).toBe('FACE');
    });

    it('bez podświetlenia nie wybiera niczego (brak cichego fallbacku)', () => {
        class V3 {
            x: number; y: number; z: number;
            constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
            static TransformCoordinates(v: any) { return new V3(v.x, v.y, v.z); }
            static Project() { return { x: 400, y: 300, z: 0.5 }; }
        }
        (globalThis as any).BABYLON = {
            Matrix: { Identity: () => ({}) },
            Vector3: V3,
        };

        const vertexMesh = {
            metadata: { type: 'vertex', cornerIndex: 0 },
            isEnabled: () => true,
            isDisposed: () => false,
            getAbsolutePosition: () => ({ x: 0, y: 0, z: 100 }),
        };
        const planeMesh = {
            metadata: { faceName: 'front' },
            isEnabled: () => true,
            isPickable: true,
        };
        const scene = {
            activeCamera: { viewport: { toGlobal: () => ({}) } },
            getEngine: () => ({ getRenderWidth: () => 800, getRenderHeight: () => 600 }),
            getTransformMatrix: () => ({}),
            meshes: [vertexMesh, planeMesh],
            pick: () => ({ hit: true, pickedMesh: planeMesh, pickedPoint: { x: 5, y: 6, z: 7 } }),
            multiPick: () => [{ hit: true, pickedMesh: planeMesh, pickedPoint: { x: 5, y: 6, z: 7 }, distance: 1 }],
        };

        try {
            const pick = findMeasureElementPick({
                scene,
                pointerX: 400,
                pointerY: 300,
                ctrl: false,
                vertexSnapPx: 12,
                edgeSnapPx: 22,
                lastDetection: null,
            });

            expect(pick).toBeNull();
        } finally {
            delete (globalThis as any).BABYLON;
        }
    });

    it('liczy normalną świata z dokładnej normalnej B-rep i macierzy meshu', () => {
        const c = Math.cos(Math.PI / 2);
        const s = Math.sin(Math.PI / 2);
        const planeMesh = {
            metadata: {
                planeNormalLocal: { x: 1, y: 0, z: 0 },
            },
            getWorldMatrix: () => ({ m: [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }),
        };

        const normal = planeNormalWorldFromMesh(planeMesh);

        expect(normal).not.toBeNull();
        expect(normal!.x).toBeCloseTo(0, 12);
        expect(normal!.y).toBeCloseTo(1, 12);
        expect(normal!.z).toBeCloseTo(0, 12);
    });

    it('stosuje odwrotną transponowaną przy niejednorodnej skali (macierz meshu)', () => {
        const invSqrt2 = 1 / Math.sqrt(2);
        const planeMesh = {
            metadata: {
                planeNormalLocal: { x: invSqrt2, y: invSqrt2, z: 0 },
            },
            getWorldMatrix: () => ({ m: [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }),
        };

        const normal = planeNormalWorldFromMesh(planeMesh);

        expect(normal).not.toBeNull();
        expect(normal!.x).toBeCloseTo(1 / Math.sqrt(5), 12);
        expect(normal!.y).toBeCloseTo(2 / Math.sqrt(5), 12);
        expect(normal!.z).toBeCloseTo(0, 12);
    });

    it('stosuje odwrotną transponowaną przy niejednorodnej skali (macierz CADNode)', () => {
        const cm = ContextManager.instance;
        const prevDocument = cm.document;
        const invSqrt2 = 1 / Math.sqrt(2);
        cm.document = {
            findNode: (id: string) => id === 'p1'
                ? {
                    getWorldMatrix: () => ({
                        data: new Float64Array([2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
                    }),
                }
                : null,
        } as any;

        try {
            const planeMesh = {
                metadata: {
                    panelModel: { id: 'p1' },
                    planeNormalLocal: { x: invSqrt2, y: invSqrt2, z: 0 },
                },
                getWorldMatrix: () => ({ m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }),
            };

            const normal = planeNormalWorldFromMesh(planeMesh);

            expect(normal).not.toBeNull();
            expect(normal!.x).toBeCloseTo(1 / Math.sqrt(5), 12);
            expect(normal!.y).toBeCloseTo(2 / Math.sqrt(5), 12);
            expect(normal!.z).toBeCloseTo(0, 12);
        } finally {
            cm.document = prevDocument;
        }
    });
});

describe('równoległość płaszczyzn (parity z FreeCAD)', () => {
    it('domyślna tolerancja to 1e-12 rad', () => {
        expect(PLANE_PARALLEL_ANGLE_RAD).toBe(1e-12);
    });

    it('normalne różniące się o 1e-13 rad są równoległe', () => {
        const a = 1e-13;
        expect(planesAreParallel(v3(0, 0, 1), v3(Math.sin(a), 0, Math.cos(a)))).toBe(true);
    });

    it('normalne różniące się o 1e-11 rad nie są równoległe', () => {
        const a = 1e-11;
        expect(planesAreParallel(v3(0, 0, 1), v3(Math.sin(a), 0, Math.cos(a)))).toBe(false);
    });
});


