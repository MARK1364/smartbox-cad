import { describe, it, expect } from 'vitest';
import {
    computeCornerFillet,
    discretizeArc2D,
    buildPolygonSegmentsWithFillets,
    discretizePolygonWithFillets
} from '../arc2d.js';

describe('arc2d — geometria analityczna łuków i zaokrągleń (fillet)', () => {
    it('oblicza zaokrąglenie prostokątnego narożnika 90 stopni (R=50mm)', () => {
        // Narożnik z punktu (0, 100) przez (100, 100) do (100, 0)
        const pPrev: [number, number] = [0, 100];
        const pCurr: [number, number] = [100, 100];
        const pNext: [number, number] = [100, 0];
        const R = 50;

        const res = computeCornerFillet(pPrev, pCurr, pNext, R);
        expect(res).not.toBeNull();
        if (!res) return;

        // Punkty styczności: 50 mm przed narożnikiem na obu ramionach
        expect(res.tangentIn[0]).toBeCloseTo(50, 2);
        expect(res.tangentIn[1]).toBeCloseTo(100, 2);

        expect(res.tangentOut[0]).toBeCloseTo(100, 2);
        expect(res.tangentOut[1]).toBeCloseTo(50, 2);

        // Środek koła o promieniu 50
        expect(res.arc.center[0]).toBeCloseTo(50, 2);
        expect(res.arc.center[1]).toBeCloseTo(50, 2);
        expect(res.arc.radius).toBeCloseTo(50, 2);

        // Kąt rozpiętości 90 stopni (PI/2)
        expect(res.arc.angularSpan).toBeCloseTo(Math.PI / 2, 4);
    });

    it('dyskretyzuje łuk z kontrolowaną sagittą', () => {
        const pPrev: [number, number] = [0, 100];
        const pCurr: [number, number] = [100, 100];
        const pNext: [number, number] = [100, 0];
        const res = computeCornerFillet(pPrev, pCurr, pNext, 50);
        expect(res).not.toBeNull();
        if (!res) return;

        const pts = discretizeArc2D(res.arc, 0.05);
        expect(pts.length).toBeGreaterThan(4);

        // Pierwszy i ostatni punkt muszą dokładnie odpowiadać punktom styczności
        expect(pts[0][0]).toBeCloseTo(res.tangentIn[0], 2);
        expect(pts[0][1]).toBeCloseTo(res.tangentIn[1], 2);

        const last = pts[pts.length - 1];
        expect(last[0]).toBeCloseTo(res.tangentOut[0], 2);
        expect(last[1]).toBeCloseTo(res.tangentOut[1], 2);

        // Każdy punkt leży w odległości R od środka koła
        for (const pt of pts) {
            const dist = Math.hypot(pt[0] - res.arc.center[0], pt[1] - res.arc.center[1]);
            expect(dist).toBeCloseTo(50, 2);
        }
    });

    it('tworzy segmenty LINE i ARC dla prostokąta ze zaokrąglonymi 4 rogami', () => {
        const rect: Array<[number, number]> = [
            [0, 0],
            [600, 0],
            [600, 400],
            [0, 400]
        ];

        // 4 narożniki z R=30mm -> 4 linie proste + 4 łuki analityczne
        const segments = buildPolygonSegmentsWithFillets(rect, 30);
        expect(segments.length).toBe(8);

        const lines = segments.filter(s => s.type === 'LINE');
        const arcs = segments.filter(s => s.type === 'ARC');

        expect(lines.length).toBe(4);
        expect(arcs.length).toBe(4);

        for (const a of arcs) {
            if (a.type === 'ARC') {
                expect(a.arc.radius).toBeCloseTo(30, 2);
            }
        }
    });

    it('dyskretyzuje wielokąt z zaokrągleniami do zamkniętego obrysu 2D', () => {
        const rect: Array<[number, number]> = [
            [0, 0],
            [600, 0],
            [600, 400],
            [0, 400]
        ];
        const pts = discretizePolygonWithFillets(rect, 20);
        expect(pts.length).toBeGreaterThan(20);

        // Wszystkie punkty mieszczą się w obrysie [0..600, 0..400]
        for (const [x, y] of pts) {
            expect(x).toBeGreaterThanOrEqual(-0.01);
            expect(x).toBeLessThanOrEqual(600.01);
            expect(y).toBeGreaterThanOrEqual(-0.01);
            expect(y).toBeLessThanOrEqual(400.01);
        }
    });
});
