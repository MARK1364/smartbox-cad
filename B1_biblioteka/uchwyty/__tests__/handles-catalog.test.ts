import { describe, it, expect } from 'vitest';
import { handlesFromCatalog, handleGlbTemplateId } from '../handles-from-catalog.js';
import { listHandles, getHardware } from '../../index.js';

describe('B1 uchwyty katalog', () => {
    it('parses Rejs series JSON into HANDLE items with glb', () => {
        const items = handlesFromCatalog({
            brand: 'REJS',
            series: [{
                id: 'easy',
                name: 'Easy',
                handleType: 'BAR',
                variants: [{
                    id: 'REJS_EASY_160',
                    name: 'Easy 160',
                    holeDistanceMm: 160,
                    totalLengthMm: 192,
                    drillDiameterMm: 4,
                    visual: { glb: 'Easy-160.glb', origin: 'CC_CENTER', units: 'mm' },
                }],
            }],
        });
        expect(items).toHaveLength(1);
        expect(items[0].type).toBe('HANDLE');
        expect(items[0].mount.hole_distance).toBe(160);
        expect(items[0].visual.glb).toBe('Easy-160.glb');
    });

    it('strips .glb for HardwareLoader template id', () => {
        expect(handleGlbTemplateId('Easy-160.glb')).toBe('Easy-160');
        expect(handleGlbTemplateId('Rejs/models/Niro.glb')).toBe('Niro');
    });

    it('loads real Rejs.json into library (pair with models/*.glb)', () => {
        const handles = listHandles();
        expect(handles.length).toBeGreaterThanOrEqual(30);
        const easy = getHardware('REJS_EASY_160');
        expect(easy?.type).toBe('HANDLE');
        expect(easy?.visual?.glb).toBe('Easy-160.glb');
        expect(easy?.mount?.hole_distance).toBe(160);
        const niro = getHardware('REJS_NIRO');
        expect(niro?.handleType).toBe('KNOB');
        expect(niro?.mount?.hole_distance).toBe(0);
    });
});
