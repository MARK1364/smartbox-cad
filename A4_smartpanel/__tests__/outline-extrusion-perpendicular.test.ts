import { describe, it, expect } from 'vitest';
import { computeOutlineCapVertices, buildPolygonPanelTopology } from '../native_core/polygon-extrusion.js';

describe('L outline extrusion', () => {
    const plateW = 882;
    const plateD = 882;
    const thickness = 18;
    const outline2d = [
        [0, 0],
        [600, 0],
        [600, 282],
        [882, 282],
        [882, 882],
        [0, 882],
    ];

    it('ścianki wcięcia są prostopadłe do płyty (ten sam XY, różnica tylko Z)', () => {
        const { topPts, bottomPts } = computeOutlineCapVertices(outline2d, plateW, plateD, thickness);
        expect(topPts.length).toBe(bottomPts.length);
        for (let i = 0; i < topPts.length; i++) {
            expect(bottomPts[i][0]).toBeCloseTo(topPts[i][0], 9);
            expect(bottomPts[i][1]).toBeCloseTo(topPts[i][1], 9);
            expect(Math.abs(topPts[i][2] - bottomPts[i][2])).toBeCloseTo(thickness, 9);
        }
    });

    it('ściana NOTCH: krawędź góra–dół równoległa do osi grubości', () => {
        const topo = buildPolygonPanelTopology({
            outline2d,
            plateW,
            plateD,
            thickness,
        });
        const notchSides = Object.entries(topo).filter(
            ([k, v]) => k.startsWith('OUTLINE_SIDE_') && (v as any).edgeKey === 'NOTCH'
        );
        expect(notchSides.length).toBe(2);
        for (const [, side] of notchSides) {
            const p = (side as any).positions as number[];
            // p0t, p1t, p1b, p0b
            const p0t = [p[0], p[1], p[2]];
            const p0b = [p[9], p[10], p[11]];
            const dx = p0b[0] - p0t[0];
            const dy = p0b[1] - p0t[1];
            const dz = p0b[2] - p0t[2];
            expect(Math.hypot(dx, dy)).toBeCloseTo(0, 9);
            expect(Math.abs(dz)).toBeCloseTo(thickness, 9);
        }
    });
});
