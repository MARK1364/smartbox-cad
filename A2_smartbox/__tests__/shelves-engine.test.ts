import { describe, it, expect } from 'vitest';
import { ShelvesEngine } from '../shelves-engine.js';

describe('ShelvesEngine Edge Banding', () => {
    it('generates shelves with default edge banding on +Y', () => {
        const engine = new ShelvesEngine();
        const plan = engine.plan({
            width: 800,
            height: 1000,
            depth: 500,
            shelfCount: 3,
            thickness: 18
        });

        expect(plan.parts.length).toBe(3);
        for (const part of plan.parts) {
            expect(part.edge_banding).toBeDefined();
            expect(part.edge_banding['+Y']).toBeDefined();
            expect(part.edge_banding['+Y'].active).toBe(true);
            expect(part.edge_banding['+Y'].type_id).toBe('0.008x0.022');

            expect(part.edge_banding['-Y']?.active).toBe(false);
            expect(part.edge_banding['+X']?.active).toBe(false);
            expect(part.edge_banding['-X']?.active).toBe(false);
        }
    });
});
