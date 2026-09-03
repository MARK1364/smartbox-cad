import { describe, it, expect, beforeEach } from 'vitest';
import { v3 } from '../dimension-solver.js';
import {
    cadDeltasFromRender,
    closestPointOnSegment,
    connectedEdgeChain,
    measureDeltaSegments,
    measureTwoEdges,
    pathLength,
    projectMeasureElements,
    projectPointOnPlane,
    shouldShowDeltas,
} from '../pmi-measure.js';
import { formatMeasureText, PMIStore } from '../pmi-data.js';

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

    it('zapisuje i wczytuje miarki razem z wymiarami', () => {
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
        store.fromJSON(null);
        expect(store.measurements).toHaveLength(0);

        store.fromJSON(json);
        expect(store.measurements).toHaveLength(1);
        expect(store.measurements[0].anchor2.pointLocal.x).toBeCloseTo(100);
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
