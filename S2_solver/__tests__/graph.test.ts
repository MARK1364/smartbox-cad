import { describe, it, expect } from 'vitest';
import { ConstraintGraph } from '../core/graph.js';

describe('ConstraintGraph', () => {
    it('BFS od GROUND — odległości w krokach', () => {
        const graph = new ConstraintGraph();
        const ground = new Set(['g']);
        const edges = {
            g: ['a'],
            a: ['g', 'b'],
            b: ['a'],
        };
        const dist = graph.computeGroundDistances(ground, edges);
        expect(dist.g).toBe(0);
        expect(dist.a).toBe(1);
        expect(dist.b).toBe(2);
        expect(graph.getDistance('x')).toBe(999);
    });

    it('getConnectedComponent — pomija węzły fixed', () => {
        const fixed = new Set(['root']);
        const edges = { a: ['b'], b: ['a'] };
        const comp = ConstraintGraph.getConnectedComponent('a', edges, fixed);
        expect([...comp].sort()).toEqual(['a', 'b']);
    });
});
