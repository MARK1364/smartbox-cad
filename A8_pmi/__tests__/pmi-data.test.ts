import { describe, it, expect, beforeEach } from 'vitest';
import { PMIAnnotationInit, PMIStore, formatDistance } from '../pmi-data.js';
import { v3 } from '../dimension-solver.js';
import type { PMIAnchorRef } from '../pmi-id-bridge.js';

function anchor(nodeId: string, x: number): PMIAnchorRef {
    return {
        nodeId,
        smartIdPath: `sb:main/part:${nodeId}`,
        kind: 'VERTEX',
        subKey: String(x),
        subIndex: -1,
        pointLocal: v3(x, 0, 0),
        pointWorldFallback: v3(x, 0, 0),
    };
}

function sampleInit(nodeId = 'panel_a'): PMIAnnotationInit {
    return {
        anchor1: anchor(nodeId, 0),
        anchor2: anchor(nodeId, 600),
        offset: v3(0, 30, 0),
        offsetSpace: 'LOCAL',
        axisSpace: 'GLOBAL',
        measureAxisKey: 'AUTO',
    };
}

describe('formatDistance', () => {
    it('formatuje milimetry, metry i cale', () => {
        expect(formatDistance(1234.5, 'METRIC_MM')).toBe('1234.5 mm');
        expect(formatDistance(1000, 'METRIC_M')).toBe('1.0000 m');
        expect(formatDistance(25.4, 'IMPERIAL')).toBe('1.00 "');
    });

    it('pomija jednostkę na życzenie', () => {
        expect(formatDistance(600, 'METRIC_MM', false)).toBe('600.0');
    });
});

describe('PMIStore', () => {
    let store: PMIStore;

    beforeEach(() => {
        store = PMIStore.instance;
        store.clearAll();
        store.fromJSON(null);
        store.unitMode = 'METRIC_MM';
        store.showUnits = true;
    });

    it('nadaje kolejne identyfikatory i ustawia dodany wymiar jako aktywny', () => {
        const first = store.addAnnotation(sampleInit());
        const second = store.addAnnotation(sampleInit());

        expect(first.id).not.toBe(second.id);
        expect(store.annotations).toHaveLength(2);
        expect(store.activeIndex).toBe(1);
    });

    it('przywraca usunięty wymiar na jego pierwotną pozycję', () => {
        const first = store.addAnnotation(sampleInit());
        const second = store.addAnnotation(sampleInit());
        store.addAnnotation(sampleInit());

        const removed = store.removeAnnotation(second.id);
        expect(removed?.index).toBe(1);
        expect(store.annotations).toHaveLength(2);

        store.insertAnnotation(removed!.annotation, removed!.index);
        expect(store.annotations[1].id).toBe(second.id);
        expect(store.annotations[0].id).toBe(first.id);
    });

    it('aktualizuje tekst przy zapisie zmierzonej wartości', () => {
        const ann = store.addAnnotation(sampleInit());
        store.setAffixes(ann.id, 'L=', ' (ref)');

        const changed = store.applyMeasuredValue(ann, 596.4, 'X');

        expect(changed).toBe(true);
        expect(ann.distanceMM).toBeCloseTo(596.4, 6);
        expect(ann.resolvedAxis).toBe('X');
        expect(ann.text).toBe('L=596.4 mm (ref)');
    });

    it('zgłasza brak zmiany, gdy wartość i tekst są takie same', () => {
        const ann = store.addAnnotation(sampleInit());
        store.applyMeasuredValue(ann, 600, 'X');

        expect(store.applyMeasuredValue(ann, 600, 'X')).toBe(false);
    });

    it('przechodzi pełen cykl zapisu i odczytu bez utraty kotwic', () => {
        const ann = store.addAnnotation(sampleInit('panel_left'));
        store.setAffixes(ann.id, 'L=', '');
        store.applyMeasuredValue(ann, 600, 'X');
        store.textSizeMM = 20;
        store.lineWidthMM = 1.5;

        const json = JSON.parse(JSON.stringify(store.toJSON()));
        store.clearAll();
        store.textSizeMM = 14;
        expect(store.annotations).toHaveLength(0);

        store.fromJSON(json);

        expect(store.annotations).toHaveLength(1);
        const restored = store.annotations[0];
        expect(restored.id).toBe(ann.id);
        expect(restored.anchor1.nodeId).toBe('panel_left');
        expect(restored.anchor2.pointLocal.x).toBeCloseTo(600, 6);
        expect(restored.offsetSpace).toBe('LOCAL');
        expect(restored.textPrefix).toBe('L=');
        expect(store.textSizeMM).toBe(20);
        expect(store.lineWidthMM).toBe(1.5);
    });

    it('nie nadaje wczytanym wymiarom kolidujących identyfikatorów', () => {
        store.addAnnotation(sampleInit());
        store.addAnnotation(sampleInit());
        const json = JSON.parse(JSON.stringify(store.toJSON()));

        store.fromJSON(json);
        const added = store.addAnnotation(sampleInit());

        const ids = store.annotations.map(a => a.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.filter(id => id === added.id)).toHaveLength(1);
    });

    it('uzupełnia braki w danych zapisanych starszym schematem', () => {
        store.fromJSON({
            version: 1,
            settings: undefined as any,
            annotations: [{ id: 'dim_7' }] as any,
        });

        const [ann] = store.annotations;
        expect(ann.id).toBe('dim_7');
        expect(ann.anchor1.nodeId).toBe('');
        expect(ann.anchor1.kind).toBe('FREE');
        expect(ann.axisSpace).toBe('GLOBAL');
        expect(ann.measureAxisKey).toBe('AUTO');
        expect(ann.visible).toBe(true);
    });
});
