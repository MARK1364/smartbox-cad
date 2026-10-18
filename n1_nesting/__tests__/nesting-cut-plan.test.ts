import { describe, it, expect } from 'vitest';
import { runNesting } from '../core/nesting-engine';
import { NestingPart, SheetConfig, PackedBoard } from '../core/nesting-types';
import { buildBoardCutPlan, releasedPartIds, partInstanceKey } from '../core/cut-plan';

function makeBoard(partial: Partial<PackedBoard> & Pick<PackedBoard, 'layout' | 'shelfAxis' | 'width' | 'height'>): PackedBoard {
    return {
        boardIndex: 1,
        usedArea: 0,
        totalArea: 0,
        wasteArea: 0,
        utilizationPercent: 0,
        wastePercent: 0,
        ...partial
    } as PackedBoard;
}

describe('plan cięcia (gilotynowy)', () => {
    it('odtwarza przycięcie, cięcia pasów i poprzeczne oraz uwalnia każdą formatkę raz', () => {
        // Obszar roboczy 2050 x 2780, margines 10 mm, pasy poziome.
        const board = makeBoard({
            width: 2070,
            height: 2800,
            shelfAxis: 'horizontal',
            layout: [
                { partId: 'A', name: 'A', x: 10, y: 10, w: 1000, h: 600, realW: 1000, realH: 600, rotated: false, band: 0 },
                { partId: 'B', name: 'B', x: 1010, y: 10, w: 1000, h: 600, realW: 1000, realH: 600, rotated: false, band: 0 },
                { partId: 'C', name: 'C', x: 10, y: 610, w: 2000, h: 300, realW: 2000, realH: 300, rotated: false, band: 1 }
            ]
        });

        const plan = buildBoardCutPlan(board);
        expect(plan).not.toBeNull();
        expect(plan!.axis).toBe('horizontal');
        expect(plan!.bands).toBe(2);

        // 2 przycięcia + 2 cięcia pasów + 3 cięcia poprzeczne = 7
        expect(plan!.totalCuts).toBe(7);
        expect(plan!.steps.slice(0, 2).every((s) => s.kind === 'trim')).toBe(true);
        // Każdy pas (także ostatni) jest odcinany własnym cięciem.
        const bandCuts = plan!.steps.filter((s) => s.kind === 'rip' && !s.partKey);
        expect(bandCuts.length).toBe(2);
        expect(bandCuts.some((s) => s.y1 === 910)).toBe(true); // dolna krawędź ostatniego pasa

        // Każda formatka uwolniona dokładnie raz.
        const counts = new Map<string, number>();
        plan!.steps.forEach((s) => s.releases.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
        expect(counts.get('A')).toBe(1);
        expect(counts.get('B')).toBe(1);
        expect(counts.get('C')).toBe(1);

        // Po wszystkich krokach wszystkie formatki uwolnione.
        const released = releasedPartIds(plan!, plan!.totalCuts);
        expect(released.size).toBe(3);

        // Cięcia w granicach arkusza i osiowo równoległe.
        for (const s of plan!.steps) {
            expect([s.x1, s.y1, s.x2, s.y2].every((v) => v >= 0 && v <= Math.max(board.width, board.height))).toBe(true);
            expect(s.x1 === s.x2 || s.y1 === s.y2).toBe(true);
        }
    });

    it('dodaje docięcie dla formatki niższej niż wysokość pasa', () => {
        const board = makeBoard({
            width: 2070,
            height: 2800,
            shelfAxis: 'horizontal',
            layout: [
                { partId: 'A', name: 'A', x: 10, y: 10, w: 1000, h: 600, realW: 1000, realH: 600, rotated: false, band: 0 },
                { partId: 'D', name: 'D', x: 1010, y: 10, w: 900, h: 300, realW: 900, realH: 300, rotated: false, band: 0 }
            ]
        });

        const plan = buildBoardCutPlan(board)!;
        const dSteps = plan.steps.filter((s) => s.releases.includes('D'));
        // Docięcie (rip) uwalnia D, cięcie poprzeczne go nie uwalnia.
        expect(dSteps.length).toBe(1);
        expect(dSteps[0].kind).toBe('rip');
    });

    it('filtruje plan do pojedynczej formatki (tylko jej cięcia)', () => {
        const board = makeBoard({
            width: 2070,
            height: 2800,
            shelfAxis: 'horizontal',
            layout: [
                { partId: 'A', name: 'A', x: 10, y: 10, w: 1000, h: 600, realW: 1000, realH: 600, rotated: false, band: 0 },
                { partId: 'B', name: 'B', x: 1010, y: 10, w: 1000, h: 600, realW: 1000, realH: 600, rotated: false, band: 0 },
                { partId: 'C', name: 'C', x: 10, y: 610, w: 2000, h: 300, realW: 2000, realH: 300, rotated: false, band: 1 }
            ]
        });

        const full = buildBoardCutPlan(board)!;
        const onlyA = buildBoardCutPlan(board, 'A')!;
        const onlyB = buildBoardCutPlan(board, 'B')!;
        const onlyC = buildBoardCutPlan(board, 'C')!;

        expect(full.totalCuts).toBe(7);
        // A: 2 przycięcia + 1 cięcie pasa (dolna krawędź pasa 1) + 1 poprzeczne = 4
        expect(onlyA.totalCuts).toBe(4);
        expect(onlyA.partsCount).toBe(1);
        expect(releasedPartIds(onlyA, onlyA.totalCuts)).toEqual(new Set(['A']));
        // B dochodzi cięcie poprzeczne A (lewa krawędź B), które odcina też A = 5
        expect(onlyB.totalCuts).toBe(5);
        expect(releasedPartIds(onlyB, onlyB.totalCuts)).toEqual(new Set(['A', 'B']));
        // C: 2 przycięcia + 2 cięcia pasów (górna i dolna krawędź pasa 2) + 1 poprzeczne = 5
        expect(onlyC.totalCuts).toBe(5);
        expect(releasedPartIds(onlyC, onlyC.totalCuts)).toEqual(new Set(['C']));

        // Plan A nie zawiera cięcia poprzecznego B/C.
        expect(onlyA.steps.some((s) => s.partKey === 'B' || s.partKey === 'C')).toBe(false);
        // Numeracja kroków jest ciągła od 1.
        onlyB.steps.forEach((s, i) => expect(s.order).toBe(i + 1));
    });

    it('zwraca null dla arkusza bez struktury pasów (np. CNC)', () => {
        const board = makeBoard({
            width: 2070,
            height: 2800,
            shelfAxis: undefined as any,
            layout: [
                { partId: 'A', name: 'A', x: 10, y: 10, w: 500, h: 500, realW: 500, realH: 500, rotated: false }
            ]
        });
        expect(buildBoardCutPlan(board)).toBeNull();
    });

    it('buduje plan dla rzeczywistego rozkroju piły (runNesting)', async () => {
        const config: SheetConfig = { width: 2070, height: 2800, kerf: 4, trimMargin: 10 };
        const parts: NestingPart[] = [
            { id: '1', name: 'Bok', width: 2000, height: 600, quantity: 2, thickness: 18, material: 'Biel', canRotate: true },
            { id: '2', name: 'Półka', width: 764, height: 580, quantity: 6, thickness: 18, material: 'Biel', canRotate: true },
            { id: '3', name: 'Tył', width: 796, height: 150, quantity: 4, thickness: 18, material: 'Biel', canRotate: true }
        ];

        const result = await runNesting(parts, config, { mode: 'fast', machineType: 'saw', allowRotation: true });
        expect(result.boards.length).toBeGreaterThan(0);

        for (const board of result.boards) {
            expect(board.shelfAxis).toBeDefined();
            const plan = buildBoardCutPlan(board);
            expect(plan).not.toBeNull();
            const released = releasedPartIds(plan!, plan!.totalCuts);
            // Każda instancja (sztuka) uwolniona dokładnie raz.
            expect(released.size).toBe(board.layout.length);
            board.layout.forEach((p) => expect(released.has(partInstanceKey(p))).toBe(true));
            // instanceId jest unikalny w obrębie arkusza.
            const keys = board.layout.map(partInstanceKey);
            expect(new Set(keys).size).toBe(keys.length);
        }
    });
});
