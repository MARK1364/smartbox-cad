import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PMIStore } from '../A8_pmi/pmi-data.js';
import { DrawingProjectExtractor, LIVE_PMI_STORAGE_KEY } from './drawing-project-extractor.js';

describe('DrawingProjectExtractor PMI cache', () => {
    let store: PMIStore;
    let originalAnnotations: PMIStore['annotations'];

    beforeEach(() => {
        store = PMIStore.instance;
        originalAnnotations = store.annotations;
    });

    afterEach(() => {
        store.annotations = originalAnnotations;
        localStorage.removeItem(LIVE_PMI_STORAGE_KEY);
    });

    it('does not restore stale cached dimensions when the available PMI store is empty', () => {
        store.annotations = [];
        localStorage.setItem(LIVE_PMI_STORAGE_KEY, JSON.stringify([
            {
                id: 'deleted-dimension',
                text: '900 mm',
                distanceMM: 900,
                x1: 0,
                y1: 0,
                z1: 0,
                x2: 900,
                y2: 0,
                z2: 0,
                lx1: 0,
                ly1: 0,
                lz1: 0,
                lx2: 900,
                ly2: 0,
                lz2: 0,
                nodeId: 'panel-a',
                dimType: 'LINEAR',
            },
        ]));

        expect(DrawingProjectExtractor.instance.extractPMIDimensions()).toEqual([]);
        expect(localStorage.getItem(LIVE_PMI_STORAGE_KEY)).toBeNull();
    });
});
