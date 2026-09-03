import { describe, expect, it } from 'vitest';
import { v3 } from '../dimension-solver.js';
import {
    buildOffsetGuideCandidates,
    globalAxisDirections,
    isGuideParallelToMeasure,
    localAxisDirections,
} from '../pmi-axis-guides.js';
import { distancePointToSegment2D, pickOffsetGuide } from '../pmi-axis-guide-pick.js';

describe('buildOffsetGuideCandidates', () => {
    const origin = v3(0, 0, 0);

    it('zawsze buduje trzy osie GLOBAL', () => {
        const candidates = buildOffsetGuideCandidates({
            origin,
            length: 1000,
            localMatrix: null,
            measureDirWorld: v3(1, 0, 0),
        });
        const globals = candidates.filter(c => c.space === 'GLOBAL');
        expect(globals).toHaveLength(3);
        expect(candidates.some(c => c.space === 'LOCAL')).toBe(false);
    });

    it('GLOBAL Y to Babylon Z (CAD głębokość)', () => {
        const dirs = globalAxisDirections();
        expect(dirs.Y.x).toBeCloseTo(0, 5);
        expect(dirs.Y.y).toBeCloseTo(0, 5);
        expect(dirs.Y.z).toBeCloseTo(1, 5);
    });

    it('bez macierzy nie dodaje LOCAL', () => {
        expect(localAxisDirections(null)).toBeNull();
    });

    it('dla obróconej formatki dodaje LOCAL i odchyla osie', () => {
        const rotatedZ90 = [
            0, 1, 0, 0,
            -1, 0, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ];
        const candidates = buildOffsetGuideCandidates({
            origin,
            length: 1000,
            localMatrix: rotatedZ90,
            measureDirWorld: v3(1, 0, 0),
        });
        expect(candidates.filter(c => c.space === 'LOCAL')).toHaveLength(3);
        const localX = candidates.find(c => c.id === 'LOCAL_X');
        expect(localX?.directionWorld.y).toBeCloseTo(1, 5);
    });

    it('gdy osie G i L się pokrywają, ukrywa LOCAL i oznacza overlap', () => {
        const identity = [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ];
        const candidates = buildOffsetGuideCandidates({
            origin,
            length: 1000,
            localMatrix: identity,
            measureDirWorld: v3(1, 0, 0),
        });
        const localY = candidates.find(c => c.id === 'LOCAL_Y');
        const globalY = candidates.find(c => c.id === 'GLOBAL_Y');
        expect(localY?.overlapped).toBe(true);
        expect(localY?.visible).toBe(false);
        expect(globalY?.overlapped).toBe(true);
        expect(globalY?.visible).toBe(true);
        expect(globalY?.label).toContain('G/L:');
    });

    it('wygasza oś równoległą do odcinka pomiaru', () => {
        expect(isGuideParallelToMeasure(v3(1, 0, 0), v3(100, 0, 0))).toBe(true);
        expect(isGuideParallelToMeasure(v3(0, 0, 1), v3(100, 0, 0))).toBe(false);

        const candidates = buildOffsetGuideCandidates({
            origin,
            length: 1000,
            localMatrix: null,
            measureDirWorld: v3(200, 0, 0),
        });
        expect(candidates.find(c => c.id === 'GLOBAL_X')?.valid).toBe(false);
        expect(candidates.find(c => c.id === 'GLOBAL_Y')?.valid).toBe(true);
    });
});

describe('pickOffsetGuide', () => {
    const origin = v3(0, 0, 0);
    const rotatedY30 = [
        0.8660254, 0, -0.5, 0,
        0, 1, 0, 0,
        0.5, 0, 0.8660254, 0,
        0, 0, 0, 1,
    ];
    const candidates = buildOffsetGuideCandidates({
        origin,
        length: 100,
        localMatrix: rotatedY30,
        measureDirWorld: v3(0, 1, 0),
    });

    /** Rzut XY na piksele 1:1, środek ekranu = origin. */
    const project = (p: { x: number; y: number; z: number }) => ({
        x: 200 + p.x,
        y: 200 - p.z,
        visible: true,
    });

    it('liczy odległość punktu od odcinka 2D', () => {
        expect(distancePointToSegment2D(5, 0, 0, 0, 10, 0)).toBeCloseTo(0, 5);
        expect(distancePointToSegment2D(5, 4, 0, 0, 10, 0)).toBeCloseTo(4, 5);
    });

    it('wybiera najbliższą ważną prowadnicę w progu', () => {
        const globalY = candidates.find(c => c.id === 'GLOBAL_Y');
        expect(globalY?.valid).toBe(true);
        const hit = pickOffsetGuide(candidates, 200, 200 - 40, project, { pickPx: 20 });
        expect(hit?.candidate.space).toBe('GLOBAL');
        expect(hit?.candidate.axisKey).toBe('Y');
    });

    it('przy histerezie zostawia sticky, dopóki kursor nie wskaże wyraźnie innej', () => {
        const sticky = pickOffsetGuide(candidates, 200, 160, project, { pickPx: 20, stickyId: 'GLOBAL_Y' });
        expect(sticky?.candidate.id).toBe('GLOBAL_Y');

        const switched = pickOffsetGuide(candidates, 220, 165, project, {
            pickPx: 20,
            holdPx: 20,
            switchMarginPx: 4,
            stickyId: 'GLOBAL_Y',
        });
        expect(switched?.candidate.id).toBe('LOCAL_Y');
    });

    it('poza progiem i bez sticky zwraca null', () => {
        const hit = pickOffsetGuide(candidates, 10, 10, project, { pickPx: 8, stickyId: null });
        expect(hit).toBeNull();
    });
});
