import { describe, it, expect, beforeEach } from 'vitest';
import { v3 } from '../dimension-solver.js';
import { computeMeasurementDerived, PMIStore } from '../pmi-data.js';
import { freeAnchorRef } from '../pmi-id-bridge.js';
import { buildMeasureRenderData, resolvePMIForRender } from '../pmi-resolve.js';

function mockScene(anchors: Record<string, ReturnType<typeof v3>>) {
    return {
        __anchors: anchors,
    };
}

describe('computeMeasurementDerived', () => {
    it('oblicza dystans prosty z deltami CAD', () => {
        const derived = computeMeasurementDerived(v3(0, 0, 0), v3(600, 120, 0), null, 'METRIC_MM', true);
        expect(derived.distanceMM).toBeCloseTo(611.9, 0);
        expect(derived.text).toContain('L:');
        expect(derived.text).toContain('dX:');
    });

    it('oblicza długość łańcucha bez delt', () => {
        const derived = computeMeasurementDerived(
            v3(0, 0, 0),
            v3(100, 50, 0),
            v3(100, 0, 0),
            'METRIC_MM',
            true,
        );
        expect(derived.distanceMM).toBeCloseTo(150, 1);
        expect(derived.text).toBe('L: 150.0 mm');
    });
});

describe('buildMeasureRenderData', () => {
    let store: PMIStore;

    beforeEach(() => {
        store = PMIStore.instance;
        store.clearAll();
        store.clearAllMeasurements();
        store.unitMode = 'METRIC_MM';
        store.showUnits = true;
    });

    it('rozwiązuje kotwice i aktualizuje wartości pochodne', () => {
        const item = store.addMeasurement({
            anchor1: freeAnchorRef(v3(0, 0, 0)),
            anchor2: freeAnchorRef(v3(300, 0, 0)),
        });

        const scene = mockScene({});
        const rd = buildMeasureRenderData(scene, item, store);

        expect(rd).not.toBeNull();
        expect(rd!.path).toHaveLength(2);
        expect(rd!.distanceMM).toBeCloseTo(300, 1);
        expect(rd!.labelText).toContain('L:');
        expect(item.distanceMM).toBeCloseTo(300, 1);
    });

    it('obsługuje punkt pośredni łańcucha krawędzi', () => {
        const item = store.addMeasurement({
            anchor1: freeAnchorRef(v3(0, 0, 0)),
            anchor2: freeAnchorRef(v3(100, 50, 0)),
            viaAnchor: freeAnchorRef(v3(100, 0, 0)),
        });

        const rd = buildMeasureRenderData(mockScene({}), item, store);

        expect(rd!.path).toHaveLength(3);
        expect(rd!.distanceMM).toBeCloseTo(150, 1);
        expect(rd!.labelText).toBe('L: 150.0 mm');
    });
});

describe('resolvePMIForRender', () => {
    let store: PMIStore;

    beforeEach(() => {
        store = PMIStore.instance;
        store.clearAll();
        store.clearAllMeasurements();
    });

    it('zbiera wymiary i miarki w jednej klatce resolve', () => {
        store.addMeasurement({
            anchor1: freeAnchorRef(v3(0, 0, 0)),
            anchor2: freeAnchorRef(v3(100, 0, 0)),
        });

        const frame = resolvePMIForRender(mockScene({}), store);

        expect(frame.annotations).toHaveLength(0);
        expect(frame.measurements).toHaveLength(1);
        expect(frame.measurements[0].renderData?.distanceMM).toBeCloseTo(100, 1);
    });
});
