import { describe, it, expect } from 'vitest';
import { planWalls } from '../walls-engine.js';
import { planPillars, defaultPillarFillMm } from '../pillars-engine.js';
import { rulesMToMm } from '../../A1_core/cad-math/units.js';

describe('S4 walls-engine / pillars-engine', () => {
    it('rect → 4 WALL + FLOOR jako 5. element (góra na Z=0)', () => {
        const { parts } = planWalls({ preset: 'rect', roomWidth: 4000, roomDepth: 3000, wallHeight: 2700, wallThickness: 100 });
        expect(parts).toHaveLength(5);
        expect(parts.every((p) => p.custom_properties?.excludeFromProduction === true)).toBe(true);
        const back = parts.find((p) => p.key === 'WALL_BACK');
        // F/B: długość = W; boki D+2T domykają narożniki
        expect(back?.dim.x).toBe(4000);
        expect(back?.dim.z).toBe(2700);
        expect(back?.dim.y).toBe(100);
        expect(back?.loc.y).toBe(1500 + 50);
        expect(back?.loc.z).toBe(1350);
        expect(back?.lcs?.rotation).toEqual([180, 0, 0]);
        expect(back?.edge_banding?.['+X']?.active).toBe(true);

        const front = parts.find((p) => p.key === 'WALL_FRONT');
        expect(front?.lcs?.rotation).toEqual([0, 0, 0]);
        expect(front?.loc.y).toBe(-1500 - 50);
        expect(front?.dim.x).toBe(4000);

        const left = parts.find((p) => p.key === 'WALL_LEFT');
        expect(left?.dim.x).toBe(2700); // wysokość → bbHeight przez mapping Y:'x'
        expect(left?.dim.y).toBe(3200); // D+2T
        expect(left?.dim.z).toBe(100);
        expect(left?.loc.x).toBe(-2000 - 50);
        expect(left?.lcs?.rotation).toEqual([0, 0, -90]);

        const right = parts.find((p) => p.key === 'WALL_RIGHT');
        expect(right?.dim.x).toBe(2700);
        expect(right?.dim.y).toBe(3200);
        expect(right?.loc.x).toBe(2000 + 50);
        expect(right?.lcs?.rotation).toEqual([0, 0, 90]);

        const floor = parts.find((p) => p.key === 'FLOOR');
        expect(floor?.role).toBe('FLOOR');
        expect(floor?.dim.x).toBe(4200); // W+2T — pełny obrys pod ścianami
        expect(floor?.dim.y).toBe(3200); // D+2T
        expect(floor?.dim.z).toBe(100);
        expect(floor?.loc.z).toBe(-50); // góra płyty na Z=0
        expect(floor?.lcs?.rotation).toEqual([90, 0, 0]); // Rx90 = leży płasko jak półka
        expect(floor?.custom_properties?.domain).toBe('floor_segment');
    });

    it('uskok → 2 segmenty z luką', () => {
        const { parts } = planWalls({
            preset: 'uskok',
            singleLength: 3000,
            wallHeight: 2700,
            wallThickness: 100,
            uskokGapStart: 1000,
            uskokGapEnd: 1500,
        });
        expect(parts).toHaveLength(2);
        expect(parts[0].dim.x).toBe(1000);
        expect(parts[1].dim.x).toBe(1500);
        // segmenty wyśrodkowane wzdłuż X wokół 0 dla length=3000
        expect(parts[0].loc.x).toBe(-1500 + 500);
        expect(parts[1].loc.x).toBe(-1500 + 1500 + 750);
    });

    it('defaults z JSON (metry → mm)', () => {
        const { parts } = planWalls({ preset: 'single' });
        expect(parts).toHaveLength(1);
        expect(parts[0].dim.z).toBe(rulesMToMm(2.7, 2700));
        expect(parts[0].dim.y).toBe(rulesMToMm(0.1, 100));
    });

    it('filar z fills', () => {
        const fill = defaultPillarFillMm('P1');
        const { parts } = planPillars([fill], 2700);
        expect(parts).toHaveLength(1);
        expect(parts[0].role).toBe('WALL_PILLAR');
        expect(parts[0].key).toBe('P1');
        expect(parts[0].custom_properties?.excludeFromProduction).toBe(true);
    });
});
