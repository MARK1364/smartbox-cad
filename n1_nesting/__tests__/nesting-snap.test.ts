import { describe, it, expect } from 'vitest';
import { resolveClampedMovePosition, isPositionColliding, checkPartsOverlap, getPartAABB } from '../core/nesting-snap';
import { PackedPart } from '../core/nesting-types';

describe('Hard Collision Clamping Engine (resolveClampedMovePosition)', () => {
    const boardW = 2800;
    const boardH = 2070;
    const kerf = 4;
    const trimMargin = 10;

    // basePart is located at [x=1000..1600, y=800..1200]
    const basePart: PackedPart = {
        partId: 'part_1',
        name: 'Formatka Bazowa',
        x: 1000,
        y: 800,
        w: 600,
        h: 400,
        realW: 600,
        realH: 400,
        rotated: false,
        rotationAngle: 0
    };

    it('should clamp position to board margins (never outside board)', () => {
        const dragged: PackedPart = {
            partId: 'part_2',
            name: 'Formatka 2',
            x: 100,
            y: 100,
            w: 500,
            h: 300,
            realW: 500,
            realH: 300,
            rotated: false,
            rotationAngle: 0
        };

        // Try moving outside left/bottom
        const resLeft = resolveClampedMovePosition(dragged, -50, -50, 100, 100, [], boardW, boardH, kerf, trimMargin);
        expect(resLeft.x).toBe(10); // trimMargin
        expect(resLeft.y).toBe(10); // trimMargin

        // Try moving outside right/top
        const resRight = resolveClampedMovePosition(dragged, 3000, 3000, 100, 100, [], boardW, boardH, kerf, trimMargin);
        expect(resRight.x).toBe(boardW - trimMargin - 500); // 2290
        expect(resRight.y).toBe(boardH - trimMargin - 300); // 1760
    });

    it('should BLOCK moving RIGHT into neighbor and stop at kerf edge (x = basePart.x - w - kerf)', () => {
        const dragged: PackedPart = {
            partId: 'part_2',
            name: 'Formatka 2',
            x: 200,
            y: 800,
            w: 500,
            h: 400,
            realW: 500,
            realH: 400,
            rotated: false,
            rotationAngle: 0
        };

        // Dragging to x=900 (would penetrate basePart at x=1000)
        const res = resolveClampedMovePosition(dragged, 900, 800, 200, 800, [basePart], boardW, boardH, kerf, trimMargin);
        
        // Expected stop: 1000 - 500 - 4 = 496
        expect(res.x).toBe(496);
        expect(res.y).toBe(800);
        expect(isPositionColliding(dragged, res.x, res.y, [basePart], boardW, boardH, kerf, trimMargin)).toBe(false);
    });

    it('should BLOCK moving LEFT into neighbor and stop at kerf edge (x = basePart.x + basePart.w + kerf)', () => {
        const dragged: PackedPart = {
            partId: 'part_2',
            name: 'Formatka 2',
            x: 2000,
            y: 800,
            w: 500,
            h: 400,
            realW: 500,
            realH: 400,
            rotated: false,
            rotationAngle: 0
        };

        // Dragging left to x=1200 (would penetrate basePart at x=1000..1600)
        const res = resolveClampedMovePosition(dragged, 1200, 800, 2000, 800, [basePart], boardW, boardH, kerf, trimMargin);
        
        // Expected stop: 1000 + 600 + 4 = 1604
        expect(res.x).toBe(1604);
        expect(res.y).toBe(800);
        expect(isPositionColliding(dragged, res.x, res.y, [basePart], boardW, boardH, kerf, trimMargin)).toBe(false);
    });

    it('should BLOCK moving TOP/UP into neighbor and stop at kerf edge (y = basePart.y - h - kerf)', () => {
        const dragged: PackedPart = {
            partId: 'part_2',
            name: 'Formatka 2',
            x: 1000,
            y: 200,
            w: 500,
            h: 300,
            realW: 500,
            realH: 300,
            rotated: false,
            rotationAngle: 0
        };

        // Dragging up to y=700 (would penetrate basePart at y=800..1200)
        const res = resolveClampedMovePosition(dragged, 1000, 700, 1000, 200, [basePart], boardW, boardH, kerf, trimMargin);
        
        // Expected stop: 800 - 300 - 4 = 496
        expect(res.x).toBe(1000);
        expect(res.y).toBe(496);
        expect(isPositionColliding(dragged, res.x, res.y, [basePart], boardW, boardH, kerf, trimMargin)).toBe(false);
    });

    it('should BLOCK moving DOWN into neighbor and stop at kerf edge (y = basePart.y + basePart.h + kerf)', () => {
        const dragged: PackedPart = {
            partId: 'part_2',
            name: 'Formatka 2',
            x: 1000,
            y: 1800,
            w: 500,
            h: 300,
            realW: 500,
            realH: 300,
            rotated: false,
            rotationAngle: 0
        };

        // Dragging down to y=1000 (would penetrate basePart at y=800..1200)
        const res = resolveClampedMovePosition(dragged, 1000, 1000, 1000, 1800, [basePart], boardW, boardH, kerf, trimMargin);
        
        // Expected stop: 800 + 400 + 4 = 1204
        expect(res.x).toBe(1000);
        expect(res.y).toBe(1204);
        expect(isPositionColliding(dragged, res.x, res.y, [basePart], boardW, boardH, kerf, trimMargin)).toBe(false);
    });

    it('should accurately detect and block collision when formatka is rotated by 90 degrees', () => {
        // Dragged part: 500x300 rotated 90 deg -> effective width is 300, effective height is 500!
        const rotatedDragged: PackedPart = {
            partId: 'part_rot',
            name: 'Formatka Obrócona 90°',
            x: 200,
            y: 800,
            w: 500,
            h: 300,
            realW: 500,
            realH: 300,
            rotated: true,
            rotationAngle: 90
        };

        const aabb = getPartAABB(rotatedDragged);
        expect(aabb.w).toBe(300);
        expect(aabb.h).toBe(500);

        // Dragging right into basePart at x=1000..1600, y=800..1200
        const res = resolveClampedMovePosition(rotatedDragged, 900, 800, 200, 800, [basePart], boardW, boardH, kerf, trimMargin);
        
        // When stopped at basePart.x - kerf = 996:
        // rotatedDragged effective maxX should be 996 -> effective minX is 996 - 300 = 696.
        // offsetX is (500 - 300)/2 = 100 -> stopX is 696 - 100 = 596!
        const resAABB = getPartAABB(rotatedDragged, res.x, res.y);
        expect(resAABB.maxX).toBe(1000 - kerf); // 996
        expect(isPositionColliding(rotatedDragged, res.x, res.y, [basePart], boardW, boardH, kerf, trimMargin)).toBe(false);
    });

    it('should correctly detect overlap between parts with kerf', () => {
        // basePart: 1000..1600 x 800..1200
        // Another part at 1602 (gap is 2mm < kerf 4mm) -> overlap = true
        expect(checkPartsOverlap(1000, 800, 600, 400, 1602, 800, 500, 400, 4)).toBe(true);

        // Another part at 1604 (gap is 4mm == kerf) -> overlap = false (styk bez kolizji)
        expect(checkPartsOverlap(1000, 800, 600, 400, 1604, 800, 500, 400, 4)).toBe(false);
    });
});
