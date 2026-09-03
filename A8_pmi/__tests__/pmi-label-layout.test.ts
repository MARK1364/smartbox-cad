import { describe, it, expect } from 'vitest';
import { boxesOverlap, resolveLabelOverlaps, ScreenLabel } from '../pmi-label-layout.js';

function label(id: string, x: number, y: number, w = 80, h = 28): ScreenLabel {
    return { id, x, y, w, h };
}

describe('boxesOverlap', () => {
    it('wykrywa nachodzące prostokąty', () => {
        expect(boxesOverlap(label('a', 0, 0), label('b', 10, 4))).toBe(true);
    });

    it('nie zgłasza rozdzielonych etykiet', () => {
        expect(boxesOverlap(label('a', 0, 0), label('b', 200, 0))).toBe(false);
    });
});

describe('resolveLabelOverlaps', () => {
    it('zostawia pojedynczą etykietę w miejscu', () => {
        const [a] = resolveLabelOverlaps([label('a', 40, 20)]);
        expect(a.x).toBe(40);
        expect(a.y).toBe(20);
    });

    it('nie rusza etykiet, które się nie nakładają', () => {
        const out = resolveLabelOverlaps([
            label('a', 0, 0),
            label('b', 400, 0),
        ]);
        const byId = Object.fromEntries(out.map(l => [l.id, l]));
        expect(byId.a.x).toBe(0);
        expect(byId.b.x).toBe(400);
    });

    it('rozsuwa dwie etykiety w tym samym miejscu', () => {
        const out = resolveLabelOverlaps([
            label('a', 100, 100, 80, 30),
            label('b', 100, 100, 80, 30),
        ], 8);
        expect(boxesOverlap(out[0], out[1], 8)).toBe(false);
        const moved = out.find(l => l.id === 'b')!;
        expect(Math.abs(moved.y - 100)).toBeGreaterThan(20);
    });

    it('trzy nachodzące etykiety nie nakładają się po rozstawieniu', () => {
        const out = resolveLabelOverlaps([
            label('a', 50, 50, 90, 32),
            label('b', 55, 52, 90, 32),
            label('c', 48, 54, 90, 32),
        ], 8);
        for (let i = 0; i < out.length; i++) {
            for (let j = i + 1; j < out.length; j++) {
                expect(boxesOverlap(out[i], out[j], 8)).toBe(false);
            }
        }
    });
});
