import { describe, expect, it } from 'vitest';
import { computeFreeDragBias, perpendicularToDimension, axisVectorWorld } from '../pmi-drag.js';
import { v3, v3Sub } from '../dimension-solver.js';

describe('pmi-drag', () => {
    it('bias zeruje offset przy starcie drag w miejscu kursora', () => {
        const p1 = v3(0, 0, 0);
        const p2 = v3(100, 0, 0);
        const mid = v3(50, 0, 0);
        const startHit = v3(50, 10, 0);
        const bias = computeFreeDragBias(p1, p2, startHit, v3(0, 0, 0));
        const perp = perpendicularToDimension(v3Sub(startHit, mid), p1, p2);
        const offsetAtStart = {
            x: perp.x + bias.x,
            y: perp.y + bias.y,
            z: perp.z + bias.z,
        };
        expect(offsetAtStart.x).toBeCloseTo(0, 5);
        expect(offsetAtStart.y).toBeCloseTo(0, 5);
        expect(offsetAtStart.z).toBeCloseTo(0, 5);
    });

    it('przesuwa offset wraz z ruchem prostopadłym do krawędzi', () => {
        const p1 = v3(0, 0, 0);
        const p2 = v3(100, 0, 0);
        const mid = v3(50, 0, 0);
        const startHit = v3(50, 0, 0);
        const bias = computeFreeDragBias(p1, p2, startHit, v3(0, 0, 0));

        const hitAfter = v3(50, 25, 0);
        const perpAfter = perpendicularToDimension(v3Sub(hitAfter, mid), p1, p2);
        const offset = {
            x: perpAfter.x + bias.x,
            y: perpAfter.y + bias.y,
            z: perpAfter.z + bias.z,
        };
        expect(offset.y).toBeCloseTo(25, 5);
    });

    it('axisVectorWorld: CAD Y to Babylon Z (GLOBAL)', () => {
        const dir = axisVectorWorld('Y', 'GLOBAL', null);
        expect(dir?.x).toBeCloseTo(0, 5);
        expect(dir?.y).toBeCloseTo(0, 5);
        expect(dir?.z).toBeCloseTo(1, 5);
    });

    it('axisVectorWorld: CAD Z to Babylon Y (GLOBAL)', () => {
        const dir = axisVectorWorld('Z', 'GLOBAL', null);
        expect(dir?.x).toBeCloseTo(0, 5);
        expect(dir?.y).toBeCloseTo(1, 5);
        expect(dir?.z).toBeCloseTo(0, 5);
    });

    it('axisVectorWorld: LOCAL używa osi formatki', () => {
        const rotatedZ90 = [
            0, 1, 0, 0,
            -1, 0, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ];
        const dir = axisVectorWorld('X', 'LOCAL', rotatedZ90);
        expect(dir?.x).toBeCloseTo(0, 5);
        expect(dir?.y).toBeCloseTo(1, 5);
        expect(dir?.z).toBeCloseTo(0, 5);
    });
});
