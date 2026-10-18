import { describe, it, expect } from 'vitest';
import { runNesting } from '../core/nesting-engine';
import { NestingPart, SheetConfig, PackedBoard } from '../core/nesting-types';

interface RectA {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Sprawdza, czy układ prostokątów da się rozciąć wyłącznie cięciami gilotynowymi
 * (każde cięcie od krawędzi do krawędzi). To warunek poprawności rozkroju piły.
 */
function isGuillotine(rects: RectA[]): boolean {
    if (rects.length <= 1) return true;

    const eps = 1e-6;
    const minX = Math.min(...rects.map((r) => r.x));
    const maxX = Math.max(...rects.map((r) => r.x + r.w));
    const minY = Math.min(...rects.map((r) => r.y));
    const maxY = Math.max(...rects.map((r) => r.y + r.h));

    const verticalCuts = new Set<number>();
    const horizontalCuts = new Set<number>();
    for (const r of rects) {
        if (r.x > minX + eps && r.x < maxX - eps) verticalCuts.add(r.x);
        if (r.x + r.w > minX + eps && r.x + r.w < maxX - eps) verticalCuts.add(r.x + r.w);
        if (r.y > minY + eps && r.y < maxY - eps) horizontalCuts.add(r.y);
        if (r.y + r.h > minY + eps && r.y + r.h < maxY - eps) horizontalCuts.add(r.y + r.h);
    }

    for (const cut of verticalCuts) {
        if (rects.every((r) => r.x + r.w <= cut + eps || r.x >= cut - eps)) {
            const left = rects.filter((r) => r.x < cut - eps);
            const right = rects.filter((r) => r.x >= cut - eps);
            if (isGuillotine(left) && isGuillotine(right)) return true;
        }
    }
    for (const cut of horizontalCuts) {
        if (rects.every((r) => r.y + r.h <= cut + eps || r.y >= cut - eps)) {
            const top = rects.filter((r) => r.y < cut - eps);
            const bottom = rects.filter((r) => r.y >= cut - eps);
            if (isGuillotine(top) && isGuillotine(bottom)) return true;
        }
    }
    return false;
}

function boardRects(board: PackedBoard): RectA[] {
    return board.layout.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
}

describe('nesting guillotine (piła panelowa)', () => {
    const config: SheetConfig = {
        width: 2800,
        height: 2070,
        kerf: 4,
        trimMargin: 10
    };

    const realisticParts: NestingPart[] = [
        { id: '1', name: 'Bok Lewy', width: 2000, height: 600, quantity: 2, thickness: 18, material: 'Biel Alpejska', canRotate: true },
        { id: '2', name: 'Wieniec Górny', width: 796, height: 600, quantity: 4, thickness: 18, material: 'Biel Alpejska', canRotate: true },
        { id: '3', name: 'Półka', width: 764, height: 580, quantity: 6, thickness: 18, material: 'Biel Alpejska', canRotate: true },
        { id: '4', name: 'Szuflada Bok', width: 500, height: 150, quantity: 8, thickness: 18, material: 'Biel Alpejska', canRotate: true },
        { id: '5', name: 'Tył Szuflady', width: 796, height: 150, quantity: 4, thickness: 18, material: 'Biel Alpejska', canRotate: true }
    ];

    it('generuje rozkrój piły w pełni gilotynowy (cięcia od krawędzi do krawędzi)', async () => {
        const result = await runNesting(realisticParts, config, {
            mode: 'pro',
            machineType: 'saw',
            allowRotation: true
        });

        expect(result.boards.length).toBeGreaterThan(0);
        for (const board of result.boards) {
            expect(isGuillotine(boardRects(board))).toBe(true);
        }
    });

    it('raportuje liczbę pasów (cięć pierwszego rzędu) dla każdego arkusza piły', async () => {
        const result = await runNesting(realisticParts, config, {
            mode: 'fast',
            machineType: 'saw'
        });

        for (const board of result.boards) {
            expect(typeof board.strips).toBe('number');
            expect(board.strips!).toBeGreaterThanOrEqual(1);
        }
    });

    it('nie zostawia formatek nieumieszczonych dla poprawnych danych', async () => {
        const result = await runNesting(realisticParts, config, {
            mode: 'pro',
            machineType: 'saw'
        });
        expect(result.unplacedParts.length).toBe(0);
        expect(result.totalPartsPlaced).toBe(
            realisticParts.reduce((s, p) => s + p.quantity, 0)
        );
    });
});
